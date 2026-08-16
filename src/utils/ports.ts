import { RiskLevel, TransportMode } from '../types';
import { AIRPORT_DIRECTORY } from './geo';
import { REGIONAL_THERMAL_HOTSPOTS } from '../data/temperatureRiskData';

export interface PortEntry {
  code: string;
  name: string;
  city: string;
  country: string;
  coords: [number, number];
  portType: string;
  hasColdStorage: boolean;
  hasGdpCertification: boolean;
  avgCustomsDelayHours: number;
  facilityScore: number; // 0-100, higher = more reliable/certified
  isLive: boolean; // true if sourced from the connected Supabase project, false if from the static local directory
}

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
  portType: 'Air',
  hasColdStorage: true,
  hasGdpCertification: true,
  avgCustomsDelayHours: 3,
  facilityScore: 80,
  isLive: false,
}));

export function mapPortsRowToEntry(row: any): PortEntry {
  return {
    code: String(row.code || '').toUpperCase(),
    name: String(row.name || row.code || ''),
    city: String(row.city || ''),
    country: COUNTRY_CODE_NAMES[String(row.country_code || '').toUpperCase()] || String(row.country_code || ''),
    coords: [Number(row.latitude), Number(row.longitude)],
    portType: String(row.port_type || 'Air'),
    hasColdStorage: Boolean(row.has_cold_storage),
    hasGdpCertification: Boolean(row.has_gdp_certification),
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

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// Transport mode recommendation
// ---------------------------------------------------------------------------

export interface ModeRecommendation {
  mode: TransportMode;
  reason: string;
}

export function recommendTransportMode(
  originCoords: [number, number],
  destCoords: [number, number],
  tempMin: number,
  tempMax: number,
  productCategory: string
): ModeRecommendation {
  const distanceKm = Math.round(haversineKm(originCoords, destCoords));
  const isUltraSensitive = productCategory === 'Vaccines' || productCategory === 'Cell Therapy' || tempMin <= -15;
  const isRoutine = productCategory === 'Active Ingredients' || (tempMin >= 14 && tempMax <= 25);

  if (distanceKm < 900) {
    return { mode: 'Road', reason: `Only ${distanceKm}km — door-to-door road transport avoids extra handling and keeps temperature control simplest.` };
  }
  if (isUltraSensitive) {
    return { mode: 'Air', reason: `${productCategory} has a narrow safe window — air is the only mode fast enough over ${distanceKm}km to protect it.` };
  }
  if (distanceKm > 7000 && isRoutine) {
    return { mode: 'Sea', reason: `${distanceKm}km with a stable, non-urgent payload — sea reefer is far cheaper and the product tolerates the longer transit.` };
  }
  if (distanceKm > 4000) {
    return { mode: 'Multimodal', reason: `${distanceKm}km is long-haul but not maximally time-critical — combining air/sea/road legs balances cost and speed.` };
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

export function recommendStops(
  originCoords: [number, number],
  destCoords: [number, number],
  originCode: string,
  destCode: string,
  tempMin: number,
  tempMax: number,
  ports: PortEntry[],
  limit = 3
): StopRecommendation[] {
  const directKm = haversineKm(originCoords, destCoords);
  const isColdSensitive = tempMax <= 25;

  const isNearExtremeHeat = (coords: [number, number]) =>
    REGIONAL_THERMAL_HOTSPOTS.some(
      (h) => h.thermalRiskLevel === 'Extreme Heat' && haversineKm(coords, h.coords) < 400
    );

  const candidates = ports
    .filter((p) => p.code !== originCode.toUpperCase() && p.code !== destCode.toUpperCase())
    .map((p) => {
      const detourKm = haversineKm(originCoords, p.coords) + haversineKm(p.coords, destCoords) - directKm;
      let score = p.facilityScore;
      if (isColdSensitive && p.hasColdStorage) score += 20;
      if (p.hasGdpCertification) score += 20;
      if (isColdSensitive && isNearExtremeHeat(p.coords)) score -= 40;
      score -= Math.min(60, detourKm / 100); // penalize being far off the direct path
      return { port: p, detourKm: Math.round(detourKm), score };
    })
    .filter((c) => c.detourKm < directKm * 0.6 + 1500) // only genuinely "on the way" candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return candidates.map((c) => {
    const bits: string[] = [];
    if (c.port.hasGdpCertification) bits.push('GDP certified');
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
