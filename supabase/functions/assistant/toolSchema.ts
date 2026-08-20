// One canonical, provider-neutral description of the Advanced assistant's tool set — standard
// JSON Schema (lowercase types), the same shape Claude's `input_schema` and OpenAI's Chat
// Completions `function.parameters` already use natively. Each adapter in ./adapters/ converts
// this into its own wire format at request time (Gemini needs an uppercase-Type version; see
// adapters/gemini.ts's toGeminiSchema). This is what "translating the same underlying tool set
// into each provider's function-calling format" means in practice: one description, defined
// once, formatted three ways — never three independently hand-written copies that could drift.
//
// The actual tool *execution* logic (grounded in real Supabase data) lives in tools.ts and is
// equally shared — nothing provider-specific about running a query against transport_lanes.

export interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  description?: string;
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

const VALID_TEMP_RANGES = [
  '2°C to 8°C (Cold Chain)',
  '-20°C (Deep Freeze)',
  '-80°C (Cryogenic)',
  '15°C to 25°C (Controlled Room Temp)',
];
const VALID_MODES = ['Air', 'Sea', 'Road', 'Multimodal'];
const VALID_PRODUCT_CATEGORIES = ['Vaccines', 'Biologics', 'Insulin', 'Cell Therapy', 'Clinical Trials', 'Active Ingredients'];

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_lane_status',
    description:
      "Get the current status of transport lanes — route, mode, carrier, live temperature, risk score, GDP status, and any active alerts. ALWAYS call this before answering any question about a specific lane or set of lanes; never answer from general knowledge about what a lane's status might be.",
    parameters: {
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
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'recommend_route',
    description:
      'Recommend a route between two hubs, including transport mode, any CEIV Pharma-certified stops needed, and corridor advisory warnings (e.g. Suez Canal). Returns the fastest option and, when a real tradeoff exists, a separately labeled lowest-risk option. Advisory only — never blocks anything.',
    parameters: {
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
    parameters: {
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
      "Create a new transport lane in transport_lanes, through the exact same validation and default field derivation the manual lane wizard uses. Requires real origin/destination hubs (validated against the ports table), a valid mode, temperature range, and product category. Use recommend_route/recommend_carrier first and pass the user's actual choice (which may differ from the recommendation) here.",
    parameters: {
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
    parameters: { type: 'object', properties: {} },
  },
];

export const SYSTEM_PROMPT = `You are the PharmaTrack assistant, embedded in a pharmaceutical cold-chain logistics dashboard used by Quality Leads, GDP Auditors, and Logistics Directors.

Rules:
- ALWAYS call get_dashboard_summary or get_lane_status before answering any factual question about current fleet or lane state (counts, GDP compliance, temperatures, risk, delays). Never answer from general knowledge about what a "typical" value might be — this is a regulated GDP environment and stale or invented numbers are a real compliance problem.
- recommend_route and recommend_carrier are advisory only. Present the recommendation and its reasoning clearly, but never imply the user must follow it. If the user says they want to proceed with something different from the recommendation, that's their call — just make sure they know what they're setting aside and why (route advisory severity, carrier score gap, etc.) so they can make an informed choice.
- Before calling create_lane, make sure you have a real origin, destination, mode, carrier, product name/category, payload value, and temperature range — ask the user for anything missing rather than guessing. If recommend_route/recommend_carrier haven't been called yet for this conversation, consider calling them first so you can tell the user how their choice compares to the recommendation.
- Every corridor advisory has an as_of date. If a tool result includes is_stale: true, you MUST pass its staleness_warning along to the user verbatim before or alongside the advisory content — never present a stale advisory as settled fact.
- generate_summary_report takes a few seconds; let the user know it's running, then share the download link it returns.
- Keep replies concise and concrete — lane codes, numbers, and named reasons, not vague reassurance.`;
