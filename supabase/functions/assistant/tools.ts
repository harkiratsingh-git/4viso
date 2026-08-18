// Tool definitions (Claude API `tools` array) and their execution against Supabase. Every
// tool here reads/writes the exact same tables and columns the frontend does — there is no
// separate, looser path for the assistant to create a lane or read fleet state.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  mapPortRow,
  findPort,
  recommendTransportMode,
  recommendStops,
  recommendCarrierWithRegionalRules,
  findRelevantAdvisories,
  requiresAcknowledgment,
  isAdvisoryStale,
  STALENESS_WARNING_PREFIX,
  isTempRangeSensitive,
  tempRangeBounds,
  haversineKm,
  COUNTRY_CODE_NAMES,
  type PortRow,
  type CarrierRow,
  type AdvisoryRow,
  type PerformanceRow,
} from './recommendation.ts';
import { buildSummaryReportDocx } from './report.ts';

const VALID_TEMP_RANGES = [
  '2°C to 8°C (Cold Chain)',
  '-20°C (Deep Freeze)',
  '-80°C (Cryogenic)',
  '15°C to 25°C (Controlled Room Temp)',
];
const VALID_MODES = ['Air', 'Sea', 'Road', 'Multimodal'];
const VALID_PRODUCT_CATEGORIES = ['Vaccines', 'Biologics', 'Insulin', 'Cell Therapy', 'Clinical Trials', 'Active Ingredients'];

// ---------------------------------------------------------------------------
// Tool schemas — passed as `tools` on every Claude Messages API call.
// ---------------------------------------------------------------------------

export const TOOL_DEFINITIONS = [
  {
    name: 'get_lane_status',
    description:
      "Get the current status of transport lanes — route, mode, carrier, live temperature, risk score, GDP status, and any active alerts. ALWAYS call this before answering any question about a specific lane or set of lanes; never answer from general knowledge about what a lane's status might be.",
    input_schema: {
      type: 'object',
      properties: {
        lane_code: { type: 'string', description: "Exact lane code, e.g. 'MXP-AMS-002'. Omit to use filters across all lanes instead." },
        risk_level: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
        mode: { type: 'string', enum: VALID_MODES },
        status: { type: 'string', description: "e.g. 'In Transit', 'Delayed', 'Delivered', 'Temperature Alert'" },
      },
    },
  },
  {
    name: 'get_dashboard_summary',
    description:
      "Get fleet-wide numbers — total/active/high-risk lane counts, average GDP compliance, active excursions, payload in transit, unresolved critical alerts — read directly from the dashboard_summary view. ALWAYS call this for any fleet-wide question (\"how many lanes\", \"what's our GDP compliance\", etc.) rather than guessing or computing it yourself; this view is the single source of truth the UI itself reads from.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'recommend_route',
    description:
      'Recommend a route between two hubs, including transport mode, any CEIV Pharma-certified stops needed, and corridor advisory warnings (e.g. Suez Canal). Returns the fastest option and, when a real tradeoff exists, a separately labeled lowest-risk option. Advisory only — never blocks anything.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Origin IATA code or city name, e.g. "FRA" or "Frankfurt".' },
        destination: { type: 'string', description: 'Destination IATA code or city name.' },
        temp_range_type: { type: 'string', enum: VALID_TEMP_RANGES },
        cargo_value_usd: { type: 'number', description: 'Total shipment value in USD — higher-value cargo weighs more toward the lowest-risk option in the reasoning shown to the user.' },
      },
      required: ['origin', 'destination', 'temp_range_type'],
    },
  },
  {
    name: 'recommend_carrier',
    description:
      "Recommend a carrier for a route, weighing reliability score, CEIV Pharma partnership, cold-chain specialization, dedicated network ownership, and — with real weight — whether a Regional Specialist's home market covers this exact route (a regional specialist can outrank a larger international carrier on its own turf). Always returns the reasoning behind the top pick, never a bare ranked list. Advisory only.",
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Origin IATA code or city name.' },
        destination: { type: 'string', description: 'Destination IATA code or city name.' },
        mode: { type: 'string', enum: VALID_MODES },
        temp_range_type: { type: 'string', enum: VALID_TEMP_RANGES },
      },
      required: ['origin', 'destination', 'mode', 'temp_range_type'],
    },
  },
  {
    name: 'create_lane',
    description:
      'Create a new transport lane in transport_lanes, through the exact same validation and default field derivation the manual lane wizard uses. Requires real origin/destination hubs (validated against the ports table), a valid mode, temperature range, and product category. Use recommend_route/recommend_carrier first and pass the user\'s actual choice (which may differ from the recommendation) here.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Origin IATA code or city name.' },
        destination: { type: 'string', description: 'Destination IATA code or city name.' },
        mode: { type: 'string', enum: VALID_MODES },
        carrier: { type: 'string', description: 'Carrier name.' },
        product_name: { type: 'string' },
        product_category: { type: 'string', enum: VALID_PRODUCT_CATEGORIES },
        payload_value_usd: { type: 'number' },
        temp_range_type: { type: 'string', enum: VALID_TEMP_RANGES },
        batch_number: { type: 'string', description: 'Optional — a plausible batch number is generated if omitted.' },
      },
      required: ['origin', 'destination', 'mode', 'carrier', 'product_name', 'product_category', 'payload_value_usd', 'temp_range_type'],
    },
  },
  {
    name: 'generate_summary_report',
    description:
      'Generate a downloadable .docx summary report covering active lanes by risk level, at-risk lanes, lanes requiring documentation, and a fleet summary table sourced from dashboard_summary. Takes 5-10 seconds; returns a signed download link once ready.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Shared data loading
// ---------------------------------------------------------------------------

async function loadPorts(client: SupabaseClient): Promise<PortRow[]> {
  const { data } = await client.from('ports').select('*');
  return (data || []).map(mapPortRow);
}

async function loadAdvisories(client: SupabaseClient): Promise<AdvisoryRow[]> {
  const { data } = await client.from('corridor_advisories').select('*');
  return (data || []) as AdvisoryRow[];
}

async function loadCarriers(client: SupabaseClient): Promise<CarrierRow[]> {
  const { data } = await client.from('carriers').select('*');
  return (data || []) as CarrierRow[];
}

async function loadPerformanceByCarrierId(client: SupabaseClient): Promise<Map<string, PerformanceRow>> {
  const { data } = await client.from('carrier_performance_summary').select('*');
  const rows = (data || []) as PerformanceRow[];
  return new Map(rows.map((r) => [r.carrier_id, r]));
}

function resolvePort(ports: PortRow[], query: string): { port: PortRow | null; error?: string } {
  const port = findPort(ports, query);
  if (!port) {
    return { port: null, error: `"${query}" doesn't match any known hub in the ports directory. Ask the user for a valid IATA code or city name.` };
  }
  return { port };
}

function formatAdvisories(advisories: AdvisoryRow[]) {
  return advisories.map((a) => ({
    corridor_name: a.corridor_name,
    severity: a.severity,
    summary: a.summary,
    recommended_alternative: a.recommended_alternative,
    as_of: a.as_of,
    is_stale: isAdvisoryStale(a.as_of),
    staleness_warning: isAdvisoryStale(a.as_of) ? STALENESS_WARNING_PREFIX : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolGetLaneStatus(client: SupabaseClient, input: any) {
  let query = client.from('transport_lanes').select('*');
  if (input.lane_code) query = query.ilike('lane_code', input.lane_code);
  if (input.risk_level) query = query.eq('risk_level', input.risk_level);
  if (input.mode) query = query.eq('mode', input.mode);
  if (input.status) query = query.ilike('status', `%${input.status}%`);

  const { data: lanes, error } = await query.limit(25);
  if (error) return { error: error.message };
  if (!lanes || lanes.length === 0) return { lanes: [], note: 'No lanes matched.' };

  const laneIds = lanes.map((l: any) => l.id);
  const { data: alerts } = await client.from('alert_notifications').select('*').in('lane_id', laneIds).eq('is_acknowledged', false);

  return {
    lanes: lanes.map((l: any) => ({
      lane_code: l.lane_code,
      route: `${l.origin_iata} -> ${l.destination_iata}`,
      mode: l.mode,
      carrier: l.carrier,
      status: l.status,
      risk_level: l.risk_level,
      risk_score: l.risk_score,
      current_temp_c: l.current_temp,
      temp_range: `${l.temp_min}°C to ${l.temp_max}°C`,
      gdp_status: l.gdp_status,
      gdp_compliance_rate: l.gdp_compliance_rate,
      transit_progress_pct: l.transit_progress,
      delay_hours: l.delay_hours,
      departure_time: l.departure_time,
      eta: l.eta,
      active_alerts: (alerts || [])
        .filter((a: any) => String(a.lane_id) === String(l.id))
        .map((a: any) => ({ severity: a.severity, title: a.title, message: a.message })),
    })),
  };
}

async function toolGetDashboardSummary(client: SupabaseClient) {
  const { data, error } = await client.from('dashboard_summary').select('*').maybeSingle();
  if (error || !data) return { error: error?.message || 'dashboard_summary view returned no row.' };
  return { summary: data };
}

async function toolRecommendRoute(client: SupabaseClient, input: any) {
  if (!VALID_TEMP_RANGES.includes(input.temp_range_type)) return { error: `temp_range_type must be one of: ${VALID_TEMP_RANGES.join(', ')}` };
  const ports = await loadPorts(client);
  const { port: origin, error: originErr } = resolvePort(ports, input.origin);
  if (originErr) return { error: originErr };
  const { port: destination, error: destErr } = resolvePort(ports, input.destination);
  if (destErr) return { error: destErr };

  const { min: tempMin, max: tempMax } = tempRangeBounds(input.temp_range_type);
  const productCategory = tempMin <= -15 ? 'Vaccines' : tempMax >= 14 ? 'Active Ingredients' : 'Biologics';
  const modeRec = recommendTransportMode(origin!.coords, destination!.coords, tempMin, tempMax, productCategory, ports);
  const stops = recommendStops(origin!.coords, destination!.coords, origin!.code, destination!.code, tempMax, ports, modeRec.mode);
  const directKm = Math.round(haversineKm(origin!.coords, destination!.coords));
  const stopDetourKm = stops.reduce((sum, s) => sum + s.detourKm, 0);

  const advisories = await loadAdvisories(client);
  const relevant = findRelevantAdvisories(advisories, origin!.coords, destination!.coords, modeRec.mode);

  const fastest = {
    label: 'Fastest',
    mode: modeRec.mode,
    mode_reason: modeRec.reason,
    total_distance_km: directKm + stopDetourKm,
    stops: stops.map((s) => ({ code: s.port.code, city: s.port.city, ceiv_pharma_certified: s.port.ceivPharmaCertified, reason: s.reason })),
    advisory_warnings: formatAdvisories(relevant),
  };

  let lowestRisk: any = null;
  const severe = relevant.find((a) => requiresAcknowledgment(a.severity));
  if (severe) {
    lowestRisk = {
      label: 'Lowest-Risk',
      mode: modeRec.mode,
      note: `Avoids the ${severe.corridor_name} advisory per its recommended alternative: ${severe.recommended_alternative}`,
      advisory_avoided: severe.corridor_name,
    };
  }

  const cargoValueUsd = Number(input.cargo_value_usd) || 0;
  const cargoValueNote =
    lowestRisk && cargoValueUsd >= 1_000_000
      ? `This shipment is valued at $${cargoValueUsd.toLocaleString()} — given the value at risk, the lowest-risk option may be worth the added transit time, though the choice is the user's.`
      : undefined;

  return { origin: origin!.code, destination: destination!.code, fastest, lowest_risk: lowestRisk, cargo_value_note: cargoValueNote };
}

async function toolRecommendCarrier(client: SupabaseClient, input: any) {
  if (!VALID_MODES.includes(input.mode)) return { error: `mode must be one of: ${VALID_MODES.join(', ')}` };
  if (!VALID_TEMP_RANGES.includes(input.temp_range_type)) return { error: `temp_range_type must be one of: ${VALID_TEMP_RANGES.join(', ')}` };

  const ports = await loadPorts(client);
  const { port: origin, error: originErr } = resolvePort(ports, input.origin);
  if (originErr) return { error: originErr };
  const { port: destination, error: destErr } = resolvePort(ports, input.destination);
  if (destErr) return { error: destErr };

  const carriers = await loadCarriers(client);
  const performanceByCarrierId = await loadPerformanceByCarrierId(client);
  const sensitive = isTempRangeSensitive(input.temp_range_type);
  const ranked = recommendCarrierWithRegionalRules(carriers, input.mode, sensitive, origin!, destination!, 4, performanceByCarrierId);

  if (ranked.length === 0) return { error: `No carriers found offering ${input.mode} on this route.` };

  const [top, runnerUp] = ranked;
  const explanation = runnerUp ? `${top.carrier.name} recommended over ${runnerUp.carrier.name}: ${top.reasons.join(', ')}.` : null;

  return {
    route: `${origin!.code} -> ${destination!.code}`,
    ranked: ranked.map((r) => ({ name: r.carrier.name, score: r.score, reasons: r.reasons })),
    explanation,
  };
}

async function toolCreateLane(client: SupabaseClient, input: any, actor: { name: string; role: string }) {
  if (!VALID_MODES.includes(input.mode)) return { error: `mode must be one of: ${VALID_MODES.join(', ')}` };
  if (!VALID_TEMP_RANGES.includes(input.temp_range_type)) return { error: `temp_range_type must be one of: ${VALID_TEMP_RANGES.join(', ')}` };
  if (!VALID_PRODUCT_CATEGORIES.includes(input.product_category)) return { error: `product_category must be one of: ${VALID_PRODUCT_CATEGORIES.join(', ')}` };
  if (!input.product_name || !String(input.product_name).trim()) return { error: 'product_name is required.' };
  if (!input.carrier || !String(input.carrier).trim()) return { error: 'carrier is required.' };
  const payloadValueUsd = Number(input.payload_value_usd);
  if (!Number.isFinite(payloadValueUsd) || payloadValueUsd <= 0) return { error: 'payload_value_usd must be a positive number.' };

  const ports = await loadPorts(client);
  const { port: origin, error: originErr } = resolvePort(ports, input.origin);
  if (originErr) return { error: originErr };
  const { port: destination, error: destErr } = resolvePort(ports, input.destination);
  if (destErr) return { error: destErr };
  if (origin!.code === destination!.code) return { error: 'Origin and destination must be different hubs.' };

  const carriers = await loadCarriers(client);
  const matchedCarrier = carriers.find((c) => c.name.toLowerCase() === String(input.carrier).toLowerCase());

  const { min: tempMin, max: tempMax } = tempRangeBounds(input.temp_range_type);
  const initTemp = Number(((tempMin + tempMax) / 2 + 0.2).toFixed(1));
  const distanceKm = haversineKm(origin!.coords, destination!.coords);
  const speedKmh: Record<string, number> = { Air: 800, Sea: 35, Road: 70, Multimodal: 200 };
  const transitHours = distanceKm / (speedKmh[input.mode] || 500);

  let riskScore = input.mode === 'Air' ? 14 : input.mode === 'Sea' ? 24 : input.mode === 'Road' ? 18 : 20;
  if (input.temp_range_type.includes('-80') || input.temp_range_type.includes('-20')) riskScore += 10;
  const { data: riskRpc } = await client.rpc('calculate_lane_base_risk', {
    p_origin_iata: origin!.code,
    p_destination_iata: destination!.code,
    p_mode: input.mode,
    p_temp_range_type: input.temp_range_type,
  });
  if (riskRpc && riskRpc[0]) riskScore = Number(riskRpc[0].risk_score) || riskScore;
  const riskLevel = riskScore >= 50 ? 'Critical' : riskScore >= 35 ? 'High' : riskScore >= 20 ? 'Medium' : 'Low';

  const now = new Date();
  const laneCode = `${origin!.code}-${destination!.code}-${Math.floor(10 + Math.random() * 89)}`;
  const id = `lane-${Date.now()}`;

  const row = {
    id,
    lane_code: laneCode,
    origin_city: origin!.city,
    origin_iata: origin!.code,
    origin_country: origin!.country,
    origin_lat: origin!.coords[0],
    origin_lng: origin!.coords[1],
    destination_city: destination!.city,
    destination_iata: destination!.code,
    destination_country: destination!.country,
    destination_lat: destination!.coords[0],
    destination_lng: destination!.coords[1],
    stops: [],
    carrier: input.carrier,
    carrier_id: matchedCarrier?.id ?? null,
    mode: input.mode,
    product_name: input.product_name,
    product_category: input.product_category,
    batch_number: input.batch_number || `BATCH-${now.getUTCFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
    payload_value_usd: payloadValueUsd,
    temp_range_type: input.temp_range_type,
    temp_min: tempMin,
    temp_max: tempMax,
    current_temp: initTemp,
    mkt_temp: initTemp,
    gdp_compliance_rate: 99.0,
    gdp_status: 'Compliant',
    risk_score: riskScore,
    risk_level: riskLevel,
    status: 'Active',
    transit_progress: 5,
    departure_time: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    eta: new Date(now.getTime() + transitHours * 3600_000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    delay_hours: 0,
    last_updated: now.toISOString(),
  };

  const { error: insertError } = await client.from('transport_lanes').insert(row);
  if (insertError) return { error: `Failed to create lane: ${insertError.message}` };

  await client.from('temperature_telemetry').insert([
    { lane_id: id, timestamp: '10:00', core_temp: initTemp, ambient_temp: 21.0, surface_temp: initTemp + 0.1, min_permitted: tempMin, max_permitted: tempMax, humidity: 45, battery_level: 100, shock_g: 0.1, is_excursion: false },
  ]);

  await client.from('audit_trail').insert({
    id: `log-${Date.now()}`,
    timestamp: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    actor: actor.name,
    role: actor.role,
    lane_code: laneCode,
    action: 'New Transport Lane Provisioned (via Assistant)',
    category: 'LANE_CONFIGURATION',
    details: `Provisioned ${input.mode} lane ${laneCode} (${origin!.code} -> ${destination!.code}) via conversational assistant with threshold alert automation.`,
    hash: '0x' + Math.random().toString(16).slice(2, 18),
    status: 'VERIFIED',
  });

  return {
    created: true,
    lane_code: laneCode,
    origin: origin!.code,
    destination: destination!.code,
    mode: input.mode,
    carrier: input.carrier,
    risk_score: riskScore,
    risk_level: riskLevel,
    eta: row.eta,
  };
}

async function toolGenerateSummaryReport(client: SupabaseClient) {
  const { buffer, filename } = await buildSummaryReportDocx(client);

  const { error: uploadError } = await client.storage.from('reports').upload(filename, buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: false,
  });
  if (uploadError) return { error: `Report generated but upload failed: ${uploadError.message}` };

  const { data: signed, error: signError } = await client.storage.from('reports').createSignedUrl(filename, 60 * 60 * 24);
  if (signError || !signed) return { error: `Report generated but signing the download link failed: ${signError?.message}` };

  return { generated: true, filename, download_url: signed.signedUrl, expires_in_hours: 24 };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function executeTool(
  name: string,
  input: any,
  client: SupabaseClient,
  actor: { name: string; role: string }
): Promise<any> {
  switch (name) {
    case 'get_lane_status':
      return toolGetLaneStatus(client, input);
    case 'get_dashboard_summary':
      return toolGetDashboardSummary(client);
    case 'recommend_route':
      return toolRecommendRoute(client, input);
    case 'recommend_carrier':
      return toolRecommendCarrier(client, input);
    case 'create_lane':
      return toolCreateLane(client, input, actor);
    case 'generate_summary_report':
      return toolGenerateSummaryReport(client);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
