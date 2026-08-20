// Tool declarations for the Gemini function-calling schema (a different shape from Claude's
// `input_schema` — this one uses `parameters` with uppercase Type enum values, per
// https://ai.google.dev/gemini-api/docs/function-calling), and their execution against
// Supabase. The tool *implementations* below are provider-agnostic plain data access — they
// don't reference Claude or Gemini at all — so they're the same grounding logic
// ../assistant/tools.ts uses; only the schema declarations were re-authored for Gemini rather
// than copy-pasted, since that's the part that's actually incompatible between the two APIs.
//
// create_lane is intentionally NOT offered here — lane creation is excluded from the
// unauthenticated demo tier; a signed-in user gets it through the Claude-backed `assistant`
// function instead.
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

// ---------------------------------------------------------------------------
// Tool schemas — Gemini's functionDeclarations format, passed as
// `tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS }]` on every generateContent call.
// ---------------------------------------------------------------------------

export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: 'get_lane_status',
    description:
      "Get the current status of transport lanes — route, mode, carrier, live temperature, risk score, GDP status, and any active alerts. ALWAYS call this before answering any question about a specific lane or set of lanes; never answer from general knowledge about what a lane's status might be.",
    parameters: {
      type: 'OBJECT',
      properties: {
        lane_code: { type: 'STRING', description: "Exact lane code, e.g. 'MXP-AMS-002'. Omit to use filters across all lanes instead." },
        risk_level: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'Critical'] },
        mode: { type: 'STRING', enum: VALID_MODES },
        status: { type: 'STRING', description: "e.g. 'In Transit', 'Delayed', 'Delivered', 'Temperature Alert'" },
      },
    },
  },
  {
    name: 'get_dashboard_summary',
    description:
      "Get fleet-wide numbers — total/active/high-risk lane counts, average GDP compliance, active excursions, payload in transit, unresolved critical alerts — read directly from the dashboard_summary view. ALWAYS call this for any fleet-wide question (\"how many lanes\", \"what's our GDP compliance\", etc.) rather than guessing or computing it yourself; this view is the single source of truth the UI itself reads from.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'recommend_route',
    description:
      'Recommend a route between two hubs, including transport mode, any CEIV Pharma-certified stops needed, and corridor advisory warnings (e.g. Suez Canal). Returns the fastest option and, when a real tradeoff exists, a separately labeled lowest-risk option. Advisory only — never blocks anything.',
    parameters: {
      type: 'OBJECT',
      properties: {
        origin: { type: 'STRING', description: 'Origin IATA code or city name, e.g. "FRA" or "Frankfurt".' },
        destination: { type: 'STRING', description: 'Destination IATA code or city name.' },
        temp_range_type: { type: 'STRING', enum: VALID_TEMP_RANGES },
        cargo_value_usd: { type: 'NUMBER', description: 'Total shipment value in USD — higher-value cargo weighs more toward the lowest-risk option in the reasoning shown to the user.' },
      },
      required: ['origin', 'destination', 'temp_range_type'],
    },
  },
  {
    name: 'recommend_carrier',
    description:
      "Recommend a carrier for a route, weighing reliability score, CEIV Pharma partnership, cold-chain specialization, dedicated network ownership, and — with real weight — whether a Regional Specialist's home market covers this exact route (a regional specialist can outrank a larger international carrier on its own turf). Always returns the reasoning behind the top pick, never a bare ranked list. Advisory only.",
    parameters: {
      type: 'OBJECT',
      properties: {
        origin: { type: 'STRING', description: 'Origin IATA code or city name.' },
        destination: { type: 'STRING', description: 'Destination IATA code or city name.' },
        mode: { type: 'STRING', enum: VALID_MODES },
        temp_range_type: { type: 'STRING', enum: VALID_TEMP_RANGES },
      },
      required: ['origin', 'destination', 'mode', 'temp_range_type'],
    },
  },
  {
    name: 'generate_summary_report',
    description:
      'Generate a downloadable .docx summary report covering active lanes by risk level, at-risk lanes, lanes requiring documentation, and a fleet summary table sourced from dashboard_summary. Takes 5-10 seconds; returns a signed download link once ready.',
    parameters: { type: 'OBJECT', properties: {} },
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
// Tool implementations — identical grounding logic to ../assistant/tools.ts, minus
// toolCreateLane (not offered in the demo tier).
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

export async function executeTool(name: string, input: any, client: SupabaseClient): Promise<any> {
  switch (name) {
    case 'get_lane_status':
      return toolGetLaneStatus(client, input);
    case 'get_dashboard_summary':
      return toolGetDashboardSummary(client);
    case 'recommend_route':
      return toolRecommendRoute(client, input);
    case 'recommend_carrier':
      return toolRecommendCarrier(client, input);
    case 'generate_summary_report':
      return toolGenerateSummaryReport(client);
    case 'create_lane':
      return { error: 'Lane creation is not available in the demo assistant — sign in for full access.' };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
