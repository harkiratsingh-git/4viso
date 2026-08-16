// Server-side mirror of src/utils/geoMath.ts + ports.ts + carrierRecommendation.ts +
// corridorAdvisories.ts + routeRecommendation.ts. Duplicated rather than imported across the
// Vite app / Deno Edge Function boundary (different bundlers, different deploy units) but kept
// deliberately identical in algorithm and weights, so the assistant's recommendations are the
// same recommendations the wizard would show for the same inputs — never a separate, looser
// logic path. If you change the weights/thresholds here, change them in the src/utils/
// equivalents too.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const EARTH_RADIUS_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function initialBearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function crossTrackDistanceKm(point: [number, number], start: [number, number], end: [number, number]): number {
  const d13 = haversineKm(start, point) / EARTH_RADIUS_KM;
  const theta13 = toRad(initialBearingDeg(start, point));
  const theta12 = toRad(initialBearingDeg(start, end));
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_RADIUS_KM);
}

function alongTrackDistanceKm(point: [number, number], start: [number, number], end: [number, number]): number {
  const d13 = haversineKm(start, point) / EARTH_RADIUS_KM;
  const dXt = crossTrackDistanceKm(point, start, end) / EARTH_RADIUS_KM;
  const cosAt = Math.cos(d13) / Math.cos(dXt);
  const dAt = Math.acos(Math.min(1, Math.max(-1, cosAt))) * EARTH_RADIUS_KM;
  const theta13 = toRad(initialBearingDeg(start, point));
  const theta12 = toRad(initialBearingDeg(start, end));
  const angleDiff = Math.abs(((toDeg(theta13 - theta12) + 540) % 360) - 180);
  return angleDiff > 90 ? -dAt : dAt;
}

function isOnGreatCirclePath(point: [number, number], start: [number, number], end: [number, number], corridorKm: number, endSlackKm = 300): boolean {
  const totalKm = haversineKm(start, end);
  const crossTrack = crossTrackDistanceKm(point, start, end);
  const alongTrack = alongTrackDistanceKm(point, start, end);
  return crossTrack <= corridorKm && alongTrack >= -endSlackKm && alongTrack <= totalKm + endSlackKm;
}

// ---------------------------------------------------------------------------
// Mode + CEIV stop recommendation (mirrors src/utils/ports.ts)
// ---------------------------------------------------------------------------

export interface PortRow {
  code: string;
  name: string;
  city: string;
  country: string;
  coords: [number, number];
  portType: string;
  hasColdStorage: boolean;
  hasGdpCertification: boolean;
  ceivPharmaCertified: boolean;
  avgCustomsDelayHours: number;
  facilityScore: number;
}

const CEIV_PHARMA_CERTIFIED_CODES = new Set([
  'BRU', 'FRA', 'AMS', 'ZRH', 'LGG', 'SIN', 'MIA', 'DFW', 'HKG', 'HYD', 'BOM', 'PVG', 'ATL', 'DXB', 'DWC',
]);

// Mirrors src/utils/ports.ts's COUNTRY_CODE_NAMES — the ports table stores ISO country codes,
// but carriers.primary_regions and the region-matching logic use full country names.
export const COUNTRY_CODE_NAMES: Record<string, string> = {
  BE: 'Belgium', DE: 'Germany', NL: 'Netherlands', IT: 'Italy', FR: 'France', CH: 'Switzerland',
  GB: 'United Kingdom', IE: 'Ireland', ES: 'Spain', AT: 'Austria', LU: 'Luxembourg', SE: 'Sweden',
  DK: 'Denmark', US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', SG: 'Singapore',
  AE: 'United Arab Emirates', CN: 'China', HK: 'Hong Kong', IN: 'India', JP: 'Japan', KR: 'South Korea',
  ZA: 'South Africa', KE: 'Kenya', NG: 'Nigeria', AU: 'Australia', TR: 'Turkey', QA: 'Qatar',
  TH: 'Thailand', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines', EG: 'Egypt', PA: 'Panama',
  LK: 'Sri Lanka', NZ: 'New Zealand',
};

export function mapPortRow(row: any): PortRow {
  const code = String(row.code || '').toUpperCase();
  const countryCode = String(row.country_code || '').toUpperCase();
  return {
    code,
    name: String(row.name || code),
    city: String(row.city || ''),
    country: COUNTRY_CODE_NAMES[countryCode] || countryCode,
    coords: [Number(row.latitude), Number(row.longitude)],
    portType: String(row.port_type || 'Air'),
    hasColdStorage: Boolean(row.has_cold_storage),
    hasGdpCertification: Boolean(row.has_gdp_certification),
    ceivPharmaCertified: Boolean(row.ceiv_pharma_certified) || CEIV_PHARMA_CERTIFIED_CODES.has(code),
    avgCustomsDelayHours: Number(row.avg_customs_delay_hours) || 0,
    facilityScore: Number(row.facility_risk_score) || 0,
  };
}

export interface ModeRecommendation {
  mode: string;
  reason: string;
}

const SEA_PORT_PROXIMITY_KM = 200;
function hasSeaCapablePortNear(coords: [number, number], ports: PortRow[]): boolean {
  return ports.some((p) => (p.portType === 'Sea' || p.portType === 'Multimodal') && haversineKm(coords, p.coords) <= SEA_PORT_PROXIMITY_KM);
}

export function recommendTransportMode(
  originCoords: [number, number],
  destCoords: [number, number],
  tempMin: number,
  tempMax: number,
  productCategory: string,
  ports: PortRow[]
): ModeRecommendation {
  const distanceKm = Math.round(haversineKm(originCoords, destCoords));
  const isUltraSensitive = productCategory === 'Vaccines' || productCategory === 'Cell Therapy' || tempMin <= -15;
  const isRoutine = productCategory === 'Active Ingredients' || (tempMin >= 14 && tempMax <= 25);
  const seaViable = hasSeaCapablePortNear(originCoords, ports) && hasSeaCapablePortNear(destCoords, ports);

  if (distanceKm < 900) return { mode: 'Road', reason: `Only ${distanceKm}km — door-to-door road transport avoids extra handling.` };
  if (isUltraSensitive) return { mode: 'Air', reason: `${productCategory} has a narrow safe window — air is the only mode fast enough over ${distanceKm}km.` };
  if (distanceKm > 7000 && isRoutine && seaViable) return { mode: 'Sea', reason: `${distanceKm}km, stable non-urgent payload, sea-capable ports near both ends — reefer container is far cheaper.` };
  if (distanceKm > 4000) return { mode: 'Multimodal', reason: `${distanceKm}km long-haul route, combining legs balances cost and speed.` };
  return { mode: 'Air', reason: `${distanceKm}km intercontinental route — air keeps transit time low.` };
}

const DIRECT_RANGE_KM_BY_MODE: Record<string, number> = { Air: 12000, Road: 900 };
export const DEFAULT_STOP_CORRIDOR_KM = 500;

export interface StopRecommendation {
  port: PortRow;
  detourKm: number;
  reason: string;
}

export function recommendStops(
  originCoords: [number, number],
  destCoords: [number, number],
  originCode: string,
  destCode: string,
  tempMax: number,
  ports: PortRow[],
  mode: string,
  limit = 2,
  corridorKm = DEFAULT_STOP_CORRIDOR_KM
): StopRecommendation[] {
  const directKm = haversineKm(originCoords, destCoords);
  const rangeCap = DIRECT_RANGE_KM_BY_MODE[mode];
  if (rangeCap !== undefined && directKm <= rangeCap) return [];

  const isColdSensitive = tempMax <= 25;
  const candidates = ports
    .filter((p) => p.code !== originCode.toUpperCase() && p.code !== destCode.toUpperCase())
    .filter((p) => p.ceivPharmaCertified || p.hasGdpCertification)
    .filter((p) => isOnGreatCirclePath(p.coords, originCoords, destCoords, corridorKm))
    .map((p) => {
      const detourKm = Math.round(haversineKm(originCoords, p.coords) + haversineKm(p.coords, destCoords) - directKm);
      let score = p.facilityScore;
      if (isColdSensitive && p.hasColdStorage) score += 20;
      if (p.hasGdpCertification) score += 15;
      if (p.ceivPharmaCertified) score += 25;
      score -= Math.min(60, detourKm / 100);
      return { port: p, detourKm, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return candidates.map((c) => {
    const bits: string[] = [];
    if (c.port.ceivPharmaCertified) bits.push('CEIV Pharma certified');
    else if (c.port.hasGdpCertification) bits.push('GDP certified');
    bits.push(`~${c.detourKm}km detour`);
    return { port: c.port, detourKm: c.detourKm, reason: bits.join(' · ') };
  });
}

// ---------------------------------------------------------------------------
// Corridor advisories (mirrors src/utils/corridorAdvisories.ts)
// ---------------------------------------------------------------------------

const WAYPOINT_COORDS: Record<string, [number, number]> = {
  'suez canal': [30.5, 32.35],
  'bab-el-mandeb': [12.6, 43.35],
  'red sea': [20.0, 38.0],
  'strait of hormuz': [26.6, 56.25],
  'persian gulf': [26.5, 52.0],
  'strait of malacca': [2.5, 101.4],
  'panama canal': [9.08, -79.68],
  balboa: [8.96, -79.57],
  colon: [9.36, -79.9],
  'cape of good hope': [-34.35, 18.47],
  'english channel': [50.3, 1.4],
  'strait of gibraltar': [35.95, -5.6],
  bosphorus: [41.1, 29.0],
  'black sea': [43.4, 34.0],
  'gulf of aden': [12.5, 47.5],
  'south china sea': [12.0, 113.0],
  'taiwan strait': [24.0, 119.0],
};

// 0.6, not tighter — mirrors src/utils/corridorAdvisories.ts's reasoning: the "direct"
// haversine baseline is itself unrealistically short whenever the great circle crosses land a
// ship can't sail over (e.g. Rotterdam -> LA runs through the Arctic), which makes a genuine
// Panama Canal detour look proportionally larger than it should against that baseline.
const MAX_DETOUR_FRACTION = 0.6;
const MAX_DETOUR_KM = 5000;
export const STALENESS_THRESHOLD_DAYS = 60;
export const STALENESS_WARNING_PREFIX =
  "This advisory hasn't been verified recently — confirm current status before relying on it.";

export function isAdvisoryStale(asOf: string, referenceDate: Date = new Date()): boolean {
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return false;
  return (referenceDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) > STALENESS_THRESHOLD_DAYS;
}

export interface AdvisoryRow {
  id: string;
  corridor_name: string;
  affected_waypoints: string[];
  severity: string;
  summary: string;
  recommended_alternative: string;
  as_of: string;
}

// Elevated Risk and Avoid require the override-acknowledgment flow if the user proceeds
// anyway; a plain Advisory is still surfaced (it's real and relevant) but isn't severe enough
// to demand that — mirrors src/utils/corridorAdvisories.ts's requiresAcknowledgment().
export function requiresAcknowledgment(severity: string): boolean {
  return severity === 'Elevated Risk' || severity === 'Avoid';
}

export function findRelevantAdvisories(
  advisories: AdvisoryRow[],
  originCoords: [number, number],
  destCoords: [number, number],
  mode: string
): AdvisoryRow[] {
  if (mode !== 'Sea') return [];
  const directKm = haversineKm(originCoords, destCoords);
  return advisories.filter((a) => {
    if (a.severity === 'Informational') return false;
    return (a.affected_waypoints || []).some((wp) => {
      const coords = WAYPOINT_COORDS[String(wp).trim().toLowerCase()];
      if (!coords) return false;
      const detourKm = haversineKm(originCoords, coords) + haversineKm(coords, destCoords) - directKm;
      return detourKm < MAX_DETOUR_KM && detourKm < directKm * MAX_DETOUR_FRACTION;
    });
  });
}

// ---------------------------------------------------------------------------
// Carrier recommendation (mirrors src/utils/carrierRecommendation.ts)
// ---------------------------------------------------------------------------

const COUNTRY_REGION: Record<string, string> = {
  Belgium: 'Europe', Germany: 'Europe', Netherlands: 'Europe', Italy: 'Europe', France: 'Europe',
  Switzerland: 'Europe', 'United Kingdom': 'Europe', Ireland: 'Europe', Spain: 'Europe', Austria: 'Europe',
  Luxembourg: 'Europe', Sweden: 'Europe', Denmark: 'Europe', Turkey: 'Europe',
  China: 'Asia', 'Hong Kong': 'Asia', India: 'Asia', Japan: 'Asia', 'South Korea': 'Asia',
  Singapore: 'Asia', Thailand: 'Asia', Malaysia: 'Asia', Indonesia: 'Asia', Philippines: 'Asia', 'Sri Lanka': 'Asia',
  'United Arab Emirates': 'Middle East', Qatar: 'Middle East', Egypt: 'Middle East',
  'South Africa': 'Africa', Kenya: 'Africa', Nigeria: 'Africa',
  'United States': 'North America', Canada: 'North America', Mexico: 'North America', Panama: 'North America',
  Brazil: 'Latin America',
  Australia: 'Oceania',
};

function inferRouteRegions(originCountry: string, destCountry: string): Set<string> {
  const regions = new Set<string>(['Global']);
  if (originCountry && originCountry === destCountry) regions.add(`${originCountry} domestic`);
  const o = COUNTRY_REGION[originCountry];
  const d = COUNTRY_REGION[destCountry];
  if (o && d) {
    if (o === 'Europe' && d === 'Europe') regions.add('Europe');
    if ((o === 'Asia' && d === 'Europe') || (o === 'Europe' && d === 'Asia')) regions.add('Asia-Europe');
    if ((o === 'North America' && d === 'Europe') || (o === 'Europe' && d === 'North America')) regions.add('Transatlantic');
    if ((o === 'North America' && d === 'Asia') || (o === 'Asia' && d === 'North America')) regions.add('Transpacific');
    if (o === 'Asia' && d === 'Asia' && originCountry !== destCountry) regions.add('Intra-Asia');
  }
  if (o === 'Middle East' || d === 'Middle East') regions.add('Middle East');
  if (o === 'Africa' || d === 'Africa') regions.add('Africa');
  if (o === 'Latin America' || d === 'Latin America') regions.add('Latin America');
  return regions;
}

export interface CarrierRow {
  id: string;
  name: string;
  carrier_type: string;
  modes: string[];
  primary_regions: string[];
  ceiv_pharma_partner: boolean;
  owns_dedicated_network: boolean;
  reliability_score: number;
  cold_chain_specialist: boolean;
}

export interface ScoredCarrier {
  carrier: CarrierRow;
  score: number;
  reasons: string[];
}

const WEIGHT_CEIV_PARTNER = 12;
const WEIGHT_COLD_CHAIN_SPECIALIST = 10;
const WEIGHT_DEDICATED_NETWORK = 6;
const WEIGHT_REGIONAL_MATCH = 30;

export interface PerformanceRow {
  carrier_id: string;
  shipment_count: number;
  on_time_pct: number;
  excursion_rate_pct: number;
  claim_rate_pct: number;
}

// Mirrors src/utils/carrierRecommendation.ts's applyPerformanceAdjustment — real logged
// outcomes (carrier_performance_summary only ever returns a row once 5+ shipments are logged)
// outweigh the static reliability_score estimate when they exist.
function applyPerformanceAdjustment(score: number, reasons: string[], perf?: PerformanceRow): number {
  if (!perf) return score;
  let adjusted = score;
  if (perf.on_time_pct >= 90) adjusted += 10;
  else if (perf.on_time_pct < 70) adjusted -= 10;
  if (perf.excursion_rate_pct > 5) adjusted -= 15;
  if (perf.claim_rate_pct > 3) adjusted -= 10;
  reasons.push(`${perf.on_time_pct}% on-time, ${perf.excursion_rate_pct}% excursion rate across ${perf.shipment_count} logged shipments`);
  return adjusted;
}

export function recommendCarrier(
  carriers: CarrierRow[],
  mode: string,
  tempRangeSensitive: boolean,
  originCountry: string,
  destCountry: string,
  limit = 4,
  performanceByCarrierId?: Map<string, PerformanceRow>
): ScoredCarrier[] {
  const routeRegions = inferRouteRegions(originCountry, destCountry);
  const eligible = carriers.filter((c) => (mode === 'Multimodal' ? c.modes.length >= 2 : c.modes.includes(mode)));

  const scored = eligible.map((carrier) => {
    let score = carrier.reliability_score;
    const reasons: string[] = [`Reliability score ${carrier.reliability_score}/100`];
    if (tempRangeSensitive && carrier.ceiv_pharma_partner) {
      score += WEIGHT_CEIV_PARTNER;
      reasons.push('CEIV Pharma certified partner');
    }
    if (tempRangeSensitive && carrier.cold_chain_specialist) {
      score += WEIGHT_COLD_CHAIN_SPECIALIST;
      reasons.push('cold-chain specialist');
    }
    if (carrier.owns_dedicated_network) {
      score += WEIGHT_DEDICATED_NETWORK;
      reasons.push('owns its dedicated network end-to-end');
    }
    const matchedRegions = (carrier.primary_regions || []).filter((r) => routeRegions.has(r) && r !== 'Global');
    if (carrier.carrier_type === 'Regional Specialist' && matchedRegions.length > 0) {
      score += WEIGHT_REGIONAL_MATCH;
      reasons.push(`regional specialist in ${matchedRegions.join(', ')} — this route is inside its core strength`);
    }
    score = applyPerformanceAdjustment(score, reasons, performanceByCarrierId?.get(carrier.id));
    return { carrier, score: Math.round(score), reasons };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Port lookup by IATA code or city name — grounds every tool's origin/destination
// resolution in the real ports table rather than trusting whatever string the model sends.
// ---------------------------------------------------------------------------

export function findPort(ports: PortRow[], query: string): PortRow | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byCode = ports.find((p) => p.code.toLowerCase() === q);
  if (byCode) return byCode;
  const byCity = ports.find((p) => p.city.toLowerCase() === q);
  if (byCity) return byCity;
  const byCityStarts = ports.find((p) => p.city.toLowerCase().startsWith(q));
  if (byCityStarts) return byCityStarts;
  const byName = ports.find((p) => p.name.toLowerCase().includes(q));
  return byName || null;
}

export function isTempRangeSensitive(tempRangeType: string): boolean {
  return tempRangeType !== '15°C to 25°C (Controlled Room Temp)';
}

export function tempRangeBounds(tempRangeType: string): { min: number; max: number } {
  if (tempRangeType.includes('-80')) return { min: -90, max: -70 };
  if (tempRangeType.includes('-20')) return { min: -25, max: -15 };
  if (tempRangeType.includes('15°')) return { min: 15, max: 25 };
  return { min: 2, max: 8 };
}
