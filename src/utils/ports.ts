import { RiskLevel, TransportMode } from '../types';
import { AIRPORT_DIRECTORY } from './geo';
import { REGIONAL_THERMAL_HOTSPOTS } from '../data/temperatureRiskData';
import { haversineKm, isOnGreatCirclePath } from './geoMath';

export interface PortEntry {
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
  facilityScore: number; // 0-100, higher = more reliable/certified
  isLive: boolean; // true if sourced from the connected Supabase project, false if from the static local directory
}

/**
 * Ground-truth list of IATA CEIV Pharma certified cargo hubs. The live `ports` table's
 * `ceiv_pharma_certified` column may not exist yet (it's added by a migration section in
 * SUPABASE_SQL_MIGRATION that the user runs manually), so this hardcoded list is OR'd with
 * whatever the live row reports rather than trusted exclusively — a hub certified in reality
 * should never disappear from recommendations just because the migration hasn't run yet.
 */
const CEIV_PHARMA_CERTIFIED_CODES = new Set([
  'BRU', 'FRA', 'AMS', 'ZRH', 'LGG', 'SIN', 'MIA', 'DFW', 'HKG', 'HYD', 'BOM', 'PVG', 'ATL', 'DXB', 'DWC',
]);

/**
 * Real-world cargo airports that sit directly alongside (or effectively are) one of the
 * world's major seaports — Hong Kong, Singapore, Shanghai (Yangshan), Jebel Ali/Dubai, LA/Long
 * Beach, New York/New Jersey, Incheon, Jawaharlal Nehru/Mumbai, Cape Town, Port Botany/Sydney,
 * plus Rotterdam's own airport code. Mirrors the same 'Multimodal' tagging applied to the live
 * Supabase `ports` table for these codes, so a viable Sea backup mode can be recommended for
 * these routes even in local/offline demo mode, not only when Supabase is reachable — without
 * this, `hasSeaCapablePortNear` would find no Sea/Multimodal port anywhere near most of the
 * world's actual busiest seaports, since the rest of this static directory is Air-only.
 */
const SEA_CAPABLE_HUB_CODES = new Set(['HKG', 'SIN', 'PVG', 'DXB', 'LAX', 'JFK', 'ICN', 'BOM', 'CPT', 'SYD', 'RTM']);

const COUNTRY_CODE_NAMES: Record<string, string> = {
  BE: 'Belgium', DE: 'Germany', NL: 'Netherlands', IT: 'Italy', FR: 'France', CH: 'Switzerland',
  GB: 'United Kingdom', IE: 'Ireland', ES: 'Spain', AT: 'Austria', LU: 'Luxembourg', SE: 'Sweden',
  DK: 'Denmark', US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', SG: 'Singapore',
  AE: 'United Arab Emirates', CN: 'China', HK: 'Hong Kong', IN: 'India', JP: 'Japan', KR: 'South Korea',
  ZA: 'South Africa', KE: 'Nigeria', NG: 'Nigeria', AU: 'Australia', TR: 'Turkey', QA: 'Qatar',
  TH: 'Thailand', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines', EG: 'Egypt', PA: 'Panama',
  LK: 'Sri Lanka', NZ: 'New Zealand',
};

/** Local static directory used whenever the live Supabase `ports` table isn't reachable. */
export const LOCAL_PORTS_FALLBACK: PortEntry[] = AIRPORT_DIRECTORY.map((a) => ({
  code: a.iata,
  name: a.name,
  city: a.city,
  country: a.country,
  coords: a.coords,
  portType: SEA_CAPABLE_HUB_CODES.has(a.iata.toUpperCase()) ? 'Multimodal' : 'Air',
  hasColdStorage: true,
  hasGdpCertification: true,
  ceivPharmaCertified: CEIV_PHARMA_CERTIFIED_CODES.has(a.iata.toUpperCase()),
  avgCustomsDelayHours: 3,
  facilityScore: 80,
  isLive: false,
}));

export function mapPortsRowToEntry(row: any): PortEntry {
  const code = String(row.code || '').toUpperCase();
  return {
    code,
    name: String(row.name || row.code || ''),
    city: String(row.city || ''),
    country: COUNTRY_CODE_NAMES[String(row.country_code || '').toUpperCase()] || String(row.country_code || ''),
    coords: [Number(row.latitude), Number(row.longitude)],
    portType: String(row.port_type || 'Air'),
    hasColdStorage: Boolean(row.has_cold_storage),
    hasGdpCertification: Boolean(row.has_gdp_certification),
    ceivPharmaCertified: Boolean(row.ceiv_pharma_certified) || CEIV_PHARMA_CERTIFIED_CODES.has(code),
    avgCustomsDelayHours: Number(row.avg_customs_delay_hours) || 0,
    facilityScore: Number(row.facility_risk_score) || 0,
    isLive: true,
  };
}

/** Merges live Supabase ports with the local directory, live entries win on a matching code. */
export function mergePortsDirectories(live: PortEntry[]): PortEntry[] {
  const byCode = new Map<string, PortEntry>();
  for (const p of LOCAL_PORTS_FALLBACK) byCode.set(p.code, p);
  for (const p of live) byCode.set(p.code, p);
  return Array.from(byCode.values());
}

export function searchPorts(ports: PortEntry[], query: string, limit = 8): PortEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ports
    .map((p) => {
      const code = p.code.toLowerCase();
      const city = p.city.toLowerCase();
      const country = p.country.toLowerCase();
      let score = -1;
      if (code === q) score = 100;
      else if (code.startsWith(q)) score = 90;
      else if (city.startsWith(q)) score = 80;
      else if (country.startsWith(q)) score = 60;
      else if (city.includes(q)) score = 40;
      else if (country.includes(q)) score = 30;
      else if (p.name.toLowerCase().includes(q)) score = 20;
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.p.facilityScore - a.p.facilityScore)
    .slice(0, limit)
    .map((s) => s.p);
}

// ---------------------------------------------------------------------------
// Transport mode recommendation
// ---------------------------------------------------------------------------

export interface ModeRecommendation {
  mode: TransportMode;
  reason: string;
}

/** Sea mode is only realistic where a genuinely sea-capable port sits near both ends of the route. */
const SEA_PORT_PROXIMITY_KM = 200;

function hasSeaCapablePortNear(coords: [number, number], ports: PortEntry[]): boolean {
  return ports.some(
    (p) => (p.portType === 'Sea' || p.portType === 'Multimodal') && haversineKm(coords, p.coords) <= SEA_PORT_PROXIMITY_KM
  );
}

export interface BackupModeRecommendation {
  mode: TransportMode;
  reason: string;
}

/**
 * A genuine alternate transport mode for this route, distinct from the primary mode's backup
 * carrier (a different carrier on the *same* mode). Only Air<->Sea swaps are considered — the
 * two long-haul modes this app has real routing data for — and only when geography actually
 * supports it (sea-capable ports near both ends for a Sea backup; short Road-range routes get
 * no Sea backup since there's no meaningful long-haul alternative to suggest). Returns null
 * rather than forcing a backup mode suggestion onto a route that doesn't have a sound one.
 */
export function findBackupTransportMode(
  primaryMode: TransportMode,
  originCoords: [number, number],
  destCoords: [number, number],
  ports: PortEntry[]
): BackupModeRecommendation | null {
  const distanceKm = Math.round(haversineKm(originCoords, destCoords));
  if (primaryMode === 'Air') {
    if (distanceKm < 900) return null; // short enough that Road is the real fallback, not Sea
    if (hasSeaCapablePortNear(originCoords, ports) && hasSeaCapablePortNear(destCoords, ports)) {
      return {
        mode: 'Sea',
        reason: `A sea-capable port sits near both ends of this ${distanceKm}km route — reefer container is a slower but genuine fallback if air capacity falls through.`,
      };
    }
    return null;
  }
  if (primaryMode === 'Sea') {
    if (!hasSeaCapablePortNear(originCoords, ports) || !hasSeaCapablePortNear(destCoords, ports)) return null;
    return {
      mode: 'Air',
      reason: `Air is a costlier but viable fallback for this ${distanceKm}km route if the sailing schedule slips or cold-chain risk rises mid-voyage.`,
    };
  }
  // Road and Multimodal aren't meaningfully "backed up" by swapping to a single alternate mode
  // on the same route — Road only gets recommended when the distance is already short enough
  // that Air/Sea aren't realistic alternatives, and Multimodal already blends modes.
  return null;
}

export function recommendTransportMode(
  originCoords: [number, number],
  destCoords: [number, number],
  tempMin: number,
  tempMax: number,
  productCategory: string,
  ports: PortEntry[] = []
): ModeRecommendation {
  const distanceKm = Math.round(haversineKm(originCoords, destCoords));
  const isUltraSensitive = productCategory === 'Vaccines' || productCategory === 'Cell Therapy' || tempMin <= -15;
  const isRoutine = productCategory === 'Active Ingredients' || (tempMin >= 14 && tempMax <= 25);
  const seaViable = hasSeaCapablePortNear(originCoords, ports) && hasSeaCapablePortNear(destCoords, ports);

  if (distanceKm < 900) {
    return { mode: 'Road', reason: `Only ${distanceKm}km — door-to-door road transport avoids extra handling and keeps temperature control simplest.` };
  }
  if (isUltraSensitive) {
    return { mode: 'Air', reason: `${productCategory} has a narrow safe window — air is the only mode fast enough over ${distanceKm}km to protect it.` };
  }
  if (distanceKm > 7000 && isRoutine && seaViable) {
    return { mode: 'Sea', reason: `${distanceKm}km with a stable, non-urgent payload, and a sea-capable port sits near both ends — reefer container is far cheaper and the product tolerates the longer transit.` };
  }
  if (distanceKm > 4000) {
    const noSeaNote = isRoutine && distanceKm > 7000 && !seaViable
      ? ' No sea-capable port sits near both ends of this route, so'
      : ' Long-haul but not maximally time-critical, so';
    return { mode: 'Multimodal', reason: `${distanceKm}km route.${noSeaNote} combining air/road legs balances cost and speed.` };
  }
  return { mode: 'Air', reason: `${distanceKm}km intercontinental route — air keeps transit time (and thermal exposure) low.` };
}

// ---------------------------------------------------------------------------
// Stop recommendation
// ---------------------------------------------------------------------------

export interface StopRecommendation {
  port: PortEntry;
  detourKm: number;
  reason: string;
}

/**
 * Max perpendicular ("cross-track") distance in km a candidate stop may sit from the
 * origin→destination great-circle line to still count as genuinely "on the way". Exposed as a
 * parameter (not hardcoded) so callers can widen/narrow it — e.g. a route comparison view might
 * want to show a couple of near-miss alternatives at a looser corridor.
 */
export const DEFAULT_STOP_CORRIDOR_KM = 500;

/**
 * Max realistic nonstop range in km for a mode before a real carrier would need an
 * intermediate stop at all. This matters independently of how close a candidate hub sits to
 * the great-circle path: a hub can be geometrically almost exactly on that path (e.g.
 * Frankfurt sits only ~60km of cross-track deviation from the Paris→Singapore great circle,
 * and adds under 5km of total detour, purely because Central European hubs happen to sit
 * near the initial great-circle bearing toward Southeast Asia) and still be the wrong
 * suggestion, because modern long-haul cargo aircraft fly routes like Paris→Singapore
 * (~10,700km) nonstop — no real operator would insert a layover there. Sea/Multimodal aren't
 * gated by this since intermediate port calls / mode changes are normal regardless of range.
 */
const DIRECT_RANGE_KM_BY_MODE: Partial<Record<TransportMode, number>> = {
  Air: 12000,
  Road: 900,
};

export function recommendStops(
  originCoords: [number, number],
  destCoords: [number, number],
  originCode: string,
  destCode: string,
  tempMin: number,
  tempMax: number,
  ports: PortEntry[],
  mode: TransportMode = 'Air',
  limit = 3,
  corridorKm = DEFAULT_STOP_CORRIDOR_KM
): StopRecommendation[] {
  const directKm = haversineKm(originCoords, destCoords);
  const rangeCap = DIRECT_RANGE_KM_BY_MODE[mode];
  if (rangeCap !== undefined && directKm <= rangeCap) return [];

  const isColdSensitive = tempMax <= 25;

  const isNearExtremeHeat = (coords: [number, number]) =>
    REGIONAL_THERMAL_HOTSPOTS.some(
      (h) => h.thermalRiskLevel === 'Extreme Heat' && haversineKm(coords, h.coords) < 400
    );

  const candidates = ports
    .filter((p) => p.code !== originCode.toUpperCase() && p.code !== destCode.toUpperCase())
    // Only a real CEIV Pharma or GDP-certified hub is eligible — a high facility score alone
    // isn't enough, and it must sit genuinely near the great-circle path (not just be
    // "somewhat close" to both endpoints, which a backwards-direction hub can satisfy too).
    .filter((p) => p.ceivPharmaCertified || p.hasGdpCertification)
    .filter((p) => isOnGreatCirclePath(p.coords, originCoords, destCoords, corridorKm))
    .map((p) => {
      const detourKm = Math.round(haversineKm(originCoords, p.coords) + haversineKm(p.coords, destCoords) - directKm);
      let score = p.facilityScore;
      if (isColdSensitive && p.hasColdStorage) score += 20;
      if (p.hasGdpCertification) score += 15;
      if (p.ceivPharmaCertified) score += 25; // strongest pharma-specific certification signal
      if (isColdSensitive && isNearExtremeHeat(p.coords)) score -= 40;
      score -= Math.min(60, detourKm / 100); // still penalize added distance among on-path candidates
      return { port: p, detourKm, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return candidates.map((c) => {
    const bits: string[] = [];
    if (c.port.ceivPharmaCertified) bits.push('CEIV Pharma certified');
    else if (c.port.hasGdpCertification) bits.push('GDP certified');
    if (isColdSensitive && c.port.hasColdStorage) bits.push('cold storage on-site');
    bits.push(`~${c.detourKm}km detour`);
    bits.push(`facility score ${c.port.facilityScore}/100`);
    return { port: c.port, detourKm: c.detourKm, reason: bits.join(' · ') };
  });
}

// ---------------------------------------------------------------------------
// Certification compliance check ("legal certifications to pass through ports")
// ---------------------------------------------------------------------------

export interface CertificationIssue {
  code: string;
  city: string;
  issue: string;
}

/** Flags any stop that lacks GDP certification (always required) or cold storage (when the cargo needs it). */
export function checkRouteCertification(
  stops: { iata: string; city: string }[],
  ports: PortEntry[],
  tempMax: number
): CertificationIssue[] {
  const issues: CertificationIssue[] = [];
  const needsColdStorage = tempMax <= 25;

  for (const stop of stops) {
    const port = ports.find((p) => p.code === stop.iata.toUpperCase());
    if (!port) continue; // unknown hub — nothing we can verify, not flagged as a failure
    if (!port.hasGdpCertification) {
      issues.push({ code: stop.iata, city: stop.city, issue: `${port.name || stop.city} is not GDP certified for pharmaceutical transit.` });
    }
    if (needsColdStorage && !port.hasColdStorage) {
      issues.push({ code: stop.iata, city: stop.city, issue: `${port.name || stop.city} has no on-site cold storage for this temperature-controlled cargo.` });
    }
  }
  return issues;
}
