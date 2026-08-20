// Scheduled weather sync — the only thing in this app that talks to OpenWeatherMap.
// Holds the OpenWeatherMap API key server-side (never shipped to the browser) and the
// Supabase service-role key. Invoked hourly by pg_cron (see the weather-sync-hourly job),
// never directly by the frontend.
//
// Deploy: supabase functions deploy weather-sync
// Secrets: supabase secrets set OPENWEATHER_API_KEY=...
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const DAILY_CALL_CAP = 990;
const HIGH_HEAT_THRESHOLD_C = 40;
// Freezing ambient air is only a hazard for shipments that need to stay warmer than that —
// cold-chain (2-8C) and controlled-room-temp (15-25C) product. It's irrelevant (or actively
// expected) for deep-freeze/cryogenic shipments, so we only fire it for those two ranges.
const FREEZE_THRESHOLD_C = 0;
const FREEZE_SENSITIVE_TEMP_RANGES = ['2°C to 8°C (Cold Chain)', '15°C to 25°C (Controlled Room Temp)'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PortRow {
  code: string;
  city: string;
  latitude: number;
  longitude: number;
  ceiv_pharma_certified: boolean;
}

interface ActiveLaneRow {
  id: string;
  lane_code: string;
  origin_iata: string;
  origin_city: string;
  destination_iata: string;
  destination_city: string;
  temp_range_type: string;
}

// ---------------------------------------------------------------------------
// Part 2: priority list — active-lane ports, then CEIV hubs, then round-robin
// the remainder (least-recently-fetched first, so coverage rotates on its own
// without a separate cursor to maintain).
// ---------------------------------------------------------------------------
async function buildPriorityPortList(
  client: SupabaseClient,
  ports: PortRow[],
  activeLanes: ActiveLaneRow[]
): Promise<string[]> {
  const activeLaneIds = activeLanes.map((l) => l.id);
  const activePorts = new Set<string>();
  for (const lane of activeLanes) {
    if (lane.origin_iata) activePorts.add(lane.origin_iata);
    if (lane.destination_iata) activePorts.add(lane.destination_iata);
  }
  if (activeLaneIds.length > 0) {
    const { data: legs } = await client
      .from('lane_legs')
      .select('origin_port_code, destination_port_code')
      .in('lane_id', activeLaneIds);
    for (const leg of legs || []) {
      if (leg.origin_port_code) activePorts.add(leg.origin_port_code);
      if (leg.destination_port_code) activePorts.add(leg.destination_port_code);
    }
  }

  const tier1 = ports.filter((p) => activePorts.has(p.code)).map((p) => p.code);
  const tier2 = ports.filter((p) => !activePorts.has(p.code) && p.ceiv_pharma_certified).map((p) => p.code);

  const { data: latest } = await client.from('latest_port_weather').select('port_code, fetched_at');
  const lastFetchedByPort = new Map<string, string | null>((latest || []).map((r: any) => [r.port_code, r.fetched_at]));

  const tier1And2 = new Set([...tier1, ...tier2]);
  const tier3 = ports
    .filter((p) => !tier1And2.has(p.code))
    .sort((a, b) => {
      const fa = lastFetchedByPort.get(a.code);
      const fb = lastFetchedByPort.get(b.code);
      if (!fa && !fb) return a.code.localeCompare(b.code);
      if (!fa) return -1; // never fetched sorts first
      if (!fb) return 1;
      return new Date(fa).getTime() - new Date(fb).getTime(); // oldest fetch first
    })
    .map((p) => p.code);

  return [...tier1, ...tier2, ...tier3];
}

// ---------------------------------------------------------------------------
// Part 4: real weather-triggered alerts, referencing real lane codes.
// ---------------------------------------------------------------------------
async function generateWeatherHazardAlerts(
  client: SupabaseClient,
  activeLanes: ActiveLaneRow[],
  freshWeatherByPort: Map<string, { temp_c: number; fetched_at: string }>
) {
  // Ports on active lanes not refreshed this run (budget-limited) still need checking
  // against whatever the most recent snapshot on file is.
  const activePortCodes = new Set<string>();
  for (const lane of activeLanes) {
    activePortCodes.add(lane.origin_iata);
    activePortCodes.add(lane.destination_iata);
  }
  const { data: cachedLatest } = await client
    .from('latest_port_weather')
    .select('port_code, temp_c, fetched_at')
    .in('port_code', [...activePortCodes]);
  const weatherByPort = new Map<string, { temp_c: number; fetched_at: string }>();
  for (const row of cachedLatest || []) {
    weatherByPort.set(row.port_code, { temp_c: Number(row.temp_c), fetched_at: row.fetched_at });
  }
  for (const [port, snapshot] of freshWeatherByPort) weatherByPort.set(port, snapshot); // this run's data wins

  const { data: existingAlerts } = await client
    .from('alert_notifications')
    .select('lane_id, message')
    .eq('alert_type', 'WEATHER_HAZARD')
    .eq('is_acknowledged', false);

  let alertsCreated = 0;

  for (const lane of activeLanes) {
    const legPorts = [lane.origin_iata, lane.destination_iata];
    for (const portCode of legPorts) {
      const weather = weatherByPort.get(portCode);
      if (!weather) continue;

      const isHeatHazard = weather.temp_c > HIGH_HEAT_THRESHOLD_C;
      const isFreezeHazard =
        weather.temp_c < FREEZE_THRESHOLD_C && FREEZE_SENSITIVE_TEMP_RANGES.includes(lane.temp_range_type);
      if (!isHeatHazard && !isFreezeHazard) continue;

      const alreadyAlerted = (existingAlerts || []).some(
        (a) => a.lane_id === lane.id && typeof a.message === 'string' && a.message.includes(`(${portCode})`)
      );
      if (alreadyAlerted) continue;

      const isOrigin = portCode === lane.origin_iata;
      const portCity = isOrigin ? lane.origin_city : lane.destination_city;
      const hazardLabel = isHeatHazard ? 'Extreme ambient heat' : 'Sub-freezing ambient temperature';
      const threshold = isHeatHazard ? HIGH_HEAT_THRESHOLD_C : FREEZE_THRESHOLD_C;
      const severity = isHeatHazard ? (weather.temp_c >= 45 ? 'Critical' : 'Warning') : (weather.temp_c <= -5 ? 'Critical' : 'Warning');

      const { error } = await client.from('alert_notifications').insert({
        id: `ALT-WX-${Date.now()}-${portCode}`,
        lane_id: lane.id,
        lane_code: lane.lane_code,
        route: `${lane.origin_city} -> ${lane.destination_city}`,
        timestamp: new Date().toISOString(),
        alert_type: 'WEATHER_HAZARD',
        severity,
        title: `${hazardLabel} at ${portCity} (${portCode})`,
        message: `Real-time weather at ${portCity} (${portCode}) shows ${weather.temp_c.toFixed(1)}°C ambient, ${isHeatHazard ? 'above' : 'below'} the ${threshold}°C safe-handling threshold, while lane ${lane.lane_code} is actively routing through this hub.`,
        current_value: `${weather.temp_c.toFixed(1)}°C`,
        threshold_value: `${threshold}°C`,
        is_acknowledged: false,
        capa_required: severity === 'Critical',
      });
      if (!error) alertsCreated++;
    }
  }

  return alertsCreated;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const openWeatherKey = Deno.env.get('OPENWEATHER_API_KEY');
  if (!openWeatherKey) return json({ error: 'OPENWEATHER_API_KEY is not configured on this Edge Function. Run: supabase secrets set OPENWEATHER_API_KEY=...' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase environment variables were not injected — this should never happen for a deployed function.' }, 500);

  const client = createClient(supabaseUrl, serviceRoleKey);
  const today = todayUtc();

  const { data: budgetRow } = await client.from('weather_api_budget').select('calls_used').eq('usage_date', today).maybeSingle();
  let callsUsed = budgetRow?.calls_used ?? 0;

  if (callsUsed >= DAILY_CALL_CAP) {
    console.log(`Daily OpenWeatherMap call cap reached (${callsUsed}/${DAILY_CALL_CAP}) — skipping this run.`);
    return json({ skipped: true, reason: 'daily_cap_reached', calls_used: callsUsed, cap: DAILY_CALL_CAP });
  }
  const remaining = DAILY_CALL_CAP - callsUsed;

  const { data: portsData } = await client.from('ports').select('code, city, latitude, longitude, ceiv_pharma_certified');
  const ports = (portsData || []) as PortRow[];
  const portByCode = new Map(ports.map((p) => [p.code, p]));

  const { data: activeLanesData } = await client
    .from('transport_lanes')
    .select('id, lane_code, origin_iata, origin_city, destination_iata, destination_city, temp_range_type')
    .eq('status', 'In Transit');
  const activeLanes = (activeLanesData || []) as ActiveLaneRow[];

  const priorityCodes = await buildPriorityPortList(client, ports, activeLanes);
  const toFetch = priorityCodes.slice(0, remaining);

  const freshWeatherByPort = new Map<string, { temp_c: number; fetched_at: string }>();
  let fetched = 0;
  let failed = 0;

  for (const code of toFetch) {
    const port = portByCode.get(code);
    if (!port) continue;

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${port.latitude}&lon=${port.longitude}&appid=${openWeatherKey}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`OpenWeatherMap request failed for ${code}: ${res.status} ${res.statusText}`);
        failed++;
        continue;
      }
      const data = await res.json();
      const fetchedAt = new Date().toISOString();
      const { error: insertError } = await client.from('weather_snapshots').insert({
        port_code: code,
        temp_c: data.main?.temp ?? null,
        feels_like_c: data.main?.feels_like ?? null,
        humidity_pct: data.main?.humidity ?? null,
        wind_speed_ms: data.wind?.speed ?? null,
        weather_condition: data.weather?.[0]?.main ?? null,
        weather_description: data.weather?.[0]?.description ?? null,
        fetched_at: fetchedAt,
      });
      if (insertError) {
        console.warn(`Failed to store weather snapshot for ${code}: ${insertError.message}`);
        failed++;
        continue;
      }

      callsUsed++;
      fetched++;
      if (typeof data.main?.temp === 'number') freshWeatherByPort.set(code, { temp_c: data.main.temp, fetched_at: fetchedAt });

      // Incrementing after every successful call (rather than once at the end) means a mid-run
      // crash still leaves an accurate count of what actually happened.
      await client.from('weather_api_budget').upsert({ usage_date: today, calls_used: callsUsed }, { onConflict: 'usage_date' });
    } catch (err) {
      console.warn(`OpenWeatherMap fetch threw for ${code}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  let alertsCreated = 0;
  try {
    alertsCreated = await generateWeatherHazardAlerts(client, activeLanes, freshWeatherByPort);
  } catch (err) {
    console.error('Weather hazard alert generation failed:', err);
  }

  return json({
    fetched,
    failed,
    alerts_created: alertsCreated,
    calls_used_today: callsUsed,
    daily_cap: DAILY_CALL_CAP,
    ports_considered: priorityCodes.length,
  });
});
