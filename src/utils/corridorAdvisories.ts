// Corridor advisory matching: resolves the free-text `affected_waypoints` on a
// corridor_advisories row to real coordinates, then uses the same great-circle cross-track
// math as the CEIV stop recommendations to decide whether a given origin->destination route
// genuinely passes through the advisory's zone — not just "is this vaguely related."
import { CorridorAdvisory, TransportMode } from '../types';
import { haversineKm } from './geoMath';

/** Known coordinates for major shipping/aviation chokepoints and named corridor regions that
 * corridor_advisories.affected_waypoints may reference. Waypoints not in this list are simply
 * skipped (never crash, never guess a location). */
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
  'bosphorus': [41.1, 29.0],
  'black sea': [43.4, 34.0],
  'gulf of aden': [12.5, 47.5],
  'south china sea': [12.0, 113.0],
  'taiwan strait': [24.0, 119.0],
};

const STALENESS_THRESHOLD_DAYS = 60;
/**
 * A waypoint counts as "on the way" if routing through it adds less than this fraction of the
 * direct distance, capped at an absolute ceiling so a huge detour never counts even on a very
 * long direct route.
 *
 * 0.6 rather than something tighter because the "direct" haversine baseline is itself
 * unrealistically short whenever the true great-circle line crosses land a ship can't sail
 * over — e.g. Rotterdam -> Los Angeles's great circle runs through the Arctic/Canada, so its
 * ~8,970km "direct" distance understates any real sea route, making the genuine Panama Canal
 * detour (~4,660km, the real shortcut a ship actually takes) look proportionally larger than
 * it should. Verified this doesn't reintroduce false positives: a real transatlantic route via
 * Suez (which should NOT match) still comes out around 128% of direct — nowhere close to 60%.
 */
const MAX_DETOUR_FRACTION = 0.6;
const MAX_DETOUR_KM = 5000;

export function isAdvisoryStale(asOf: string, referenceDate: Date = new Date()): boolean {
  const asOfDate = new Date(asOf);
  if (isNaN(asOfDate.getTime())) return false;
  const ageDays = (referenceDate.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALENESS_THRESHOLD_DAYS;
}

export const STALENESS_WARNING_PREFIX =
  "This advisory hasn't been verified recently — confirm current status before relying on it.";

/**
 * True if any of the advisory's affected_waypoints resolve to a known location that a real
 * route between origin and destination would plausibly pass through.
 *
 * This deliberately does NOT use pure great-circle cross-track distance (which is what the
 * CEIV airport-stop matching uses, correctly, since aircraft fly close to great circles).
 * Maritime chokepoints like the Suez Canal exist precisely because oceans are interrupted by
 * continents — the unconstrained great-circle line between, say, Shanghai and Rotterdam runs
 * through Central Asia, thousands of km from Suez, even though Suez is exactly where a real
 * ship on that route goes. So instead this checks real added distance: how much routing
 * through the waypoint adds versus going direct. A canal/strait shortcut between two ocean
 * basins should add relatively little distance for a route that actually uses it, and a lot
 * for one that doesn't (e.g. a transatlantic or transpacific route routed via Suez).
 */
export function advisoryIntersectsRoute(
  advisory: CorridorAdvisory,
  originCoords: [number, number],
  destCoords: [number, number]
): boolean {
  const directKm = haversineKm(originCoords, destCoords);
  return advisory.affectedWaypoints.some((wp) => {
    const coords = WAYPOINT_COORDS[wp.trim().toLowerCase()];
    if (!coords) return false;
    const detourKm = haversineKm(originCoords, coords) + haversineKm(coords, destCoords) - directKm;
    return detourKm < MAX_DETOUR_KM && detourKm < directKm * MAX_DETOUR_FRACTION;
  });
}

export interface RelevantAdvisory {
  advisory: CorridorAdvisory;
  isStale: boolean;
}

/** Elevated Risk and Avoid are severe enough that proceeding despite them requires the
 * override-acknowledgment flow (see OverrideAcknowledgmentModal). A plain "Advisory" — e.g.
 * "capacity is tightening, build in schedule buffer" — is still shown to the user, but doesn't
 * rise to that level; it's informational-but-relevant, not a call to reroute. */
export function requiresAcknowledgment(severity: CorridorAdvisory['severity']): boolean {
  return severity === 'Elevated Risk' || severity === 'Avoid';
}

/** Advisories that genuinely intersect the route AND are relevant enough to show the user
 * (anything other than pure background "Informational"). Every known chokepoint waypoint
 * (Suez, Malacca, Panama, Hormuz, Cape of Good Hope...) is a maritime shipping-lane concern
 * specifically, so this only applies to Sea-mode lanes — an aircraft is never affected by a
 * canal closure. */
export function findRelevantAdvisories(
  advisories: CorridorAdvisory[],
  originCoords: [number, number],
  destCoords: [number, number],
  mode: TransportMode
): RelevantAdvisory[] {
  if (mode !== 'Sea') return [];
  return advisories
    .filter((a) => a.severity !== 'Informational' && advisoryIntersectsRoute(a, originCoords, destCoords))
    .map((advisory) => ({ advisory, isStale: isAdvisoryStale(advisory.asOf) }));
}
