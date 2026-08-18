// Shared metrics for comparing two candidate routes (the user's manually entered route vs. a
// computed suggested alternative) in the lane wizard — real great-circle distance/transit-time
// estimate, summed customs delay from the ports directory, and per-stop certification status.
import { TransportMode } from '../types';
import { PortEntry, recommendStops } from './ports';
import { haversineKm } from './geoMath';

export interface RouteOptionStop {
  iata: string;
  city: string;
  ceivPharmaCertified: boolean;
  hasGdpCertification: boolean;
  avgCustomsDelayHours: number;
}

export interface RouteOptionMetrics {
  totalDistanceKm: number;
  estTransitHours: number;
  totalCustomsDelayHours: number;
  stopDetails: RouteOptionStop[];
}

/** Rough cruise/transit speed in km/h per mode, used only to estimate transit time for the comparison — not a substitute for the app's real ETA/ops logic. */
const CRUISE_SPEED_KMH: Partial<Record<TransportMode, number>> = {
  Air: 800,
  Sea: 35,
  Road: 70,
  Multimodal: 200,
};

export function computeRouteMetrics(
  originCoords: [number, number],
  destCoords: [number, number],
  routeStops: { iata: string; city: string; coords: [number, number] }[],
  mode: TransportMode,
  ports: PortEntry[]
): RouteOptionMetrics {
  const waypoints = [originCoords, ...routeStops.map((s) => s.coords), destCoords];
  let totalDistanceKm = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistanceKm += haversineKm(waypoints[i], waypoints[i + 1]);
  }

  const speed = CRUISE_SPEED_KMH[mode] ?? 500;
  const estTransitHours = totalDistanceKm / speed;

  const stopDetails: RouteOptionStop[] = routeStops.map((s) => {
    const port = ports.find((p) => p.code === s.iata.toUpperCase());
    return {
      iata: s.iata.toUpperCase(),
      city: s.city || port?.city || s.iata.toUpperCase(),
      ceivPharmaCertified: port?.ceivPharmaCertified ?? false,
      hasGdpCertification: port?.hasGdpCertification ?? false,
      avgCustomsDelayHours: port?.avgCustomsDelayHours ?? 0,
    };
  });

  const totalCustomsDelayHours = stopDetails.reduce((sum, s) => sum + s.avgCustomsDelayHours, 0);

  return {
    totalDistanceKm: Math.round(totalDistanceKm),
    estTransitHours,
    totalCustomsDelayHours,
    stopDetails,
  };
}

export interface FixedWaypoint {
  iata: string;
  city: string;
  country: string;
  coords: [number, number];
}

/**
 * "Recommended-from-your-edit" (Phase 2, option 3): the user's own stops stay fixed points —
 * this only looks for a genuinely missing stop *inside* a gap between two of those fixed
 * points (reusing the same range-cap logic recommendStops already applies per mode), never
 * removes or reorders anything the user placed. Returns the full waypoint list including the
 * user's own fixed points, with any inserted stops spliced in at the right position.
 */
export function insertRecommendedGapStops(
  fixedWaypoints: FixedWaypoint[],
  tempMin: number,
  tempMax: number,
  ports: PortEntry[],
  mode: TransportMode
): FixedWaypoint[] {
  if (fixedWaypoints.length < 2) return fixedWaypoints;

  const result: FixedWaypoint[] = [fixedWaypoints[0]];
  for (let i = 0; i < fixedWaypoints.length - 1; i++) {
    const from = fixedWaypoints[i];
    const to = fixedWaypoints[i + 1];
    const candidates = recommendStops(from.coords, to.coords, from.iata, to.iata, tempMin, tempMax, ports, mode, 1);
    if (candidates.length > 0) {
      const c = candidates[0].port;
      result.push({ iata: c.code, city: c.city, country: c.country, coords: c.coords });
    }
    result.push(to);
  }
  return result;
}

/** True if two stop lists represent a materially different route (order-insensitive). */
export function stopSetsDiffer(a: { iata: string }[], b: { iata: string }[]): boolean {
  const setA = a.map((s) => s.iata.toUpperCase()).sort().join(',');
  const setB = b.map((s) => s.iata.toUpperCase()).sort().join(',');
  return setA !== setB;
}
