// Shared metrics for comparing two candidate routes (the user's manually entered route vs. a
// computed suggested alternative) in the lane wizard — real great-circle distance/transit-time
// estimate, summed customs delay from the ports directory, and per-stop certification status.
import { TransportMode } from '../types';
import { PortEntry } from './ports';
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

/** True if two stop lists represent a materially different route (order-insensitive). */
export function stopSetsDiffer(a: { iata: string }[], b: { iata: string }[]): boolean {
  const setA = a.map((s) => s.iata.toUpperCase()).sort().join(',');
  const setB = b.map((s) => s.iata.toUpperCase()).sort().join(',');
  return setA !== setB;
}
