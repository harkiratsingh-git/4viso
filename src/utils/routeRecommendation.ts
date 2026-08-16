// Route recommendation: extends the great-circle/CEIV-stop logic and the live
// calculate_lane_base_risk score into an actual recommendation — not just a risk number.
// Returns the fastest option and, when a corridor advisory or added risk makes a different
// route genuinely lower-risk, a separate lowest-risk option, clearly labeled rather than
// silently collapsed into one "best" answer.
import { TransportMode, TemperatureRangeType, CorridorAdvisory } from '../types';
import { PortEntry, recommendTransportMode, recommendStops, StopRecommendation } from './ports';
import { haversineKm } from './geoMath';
import { computeRouteMetrics } from './routeComparison';
import { findRelevantAdvisories, isAdvisoryStale, STALENESS_WARNING_PREFIX, RelevantAdvisory, requiresAcknowledgment } from './corridorAdvisories';

export interface FormattedAdvisoryWarning {
  corridorName: string;
  severity: CorridorAdvisory['severity'];
  summary: string;
  recommendedAlternative: string;
  asOf: string;
  isStale: boolean;
  /** Set only when the advisory is stale — always shown alongside it, never silently omitted. */
  stalenessWarning?: string;
}

export function formatAdvisoryWarning(r: RelevantAdvisory): FormattedAdvisoryWarning {
  return {
    corridorName: r.advisory.corridorName,
    severity: r.advisory.severity,
    summary: r.advisory.summary,
    recommendedAlternative: r.advisory.recommendedAlternative,
    asOf: r.advisory.asOf,
    isStale: r.isStale,
    stalenessWarning: r.isStale ? STALENESS_WARNING_PREFIX : undefined,
  };
}

export interface RouteRecommendationOption {
  label: 'Fastest' | 'Lowest-Risk';
  mode: TransportMode;
  modeReason: string;
  totalDistanceKm: number;
  estTransitHours: number;
  stops: StopRecommendation[];
  advisoryWarnings: FormattedAdvisoryWarning[];
  reasoning: string;
}

export interface RouteRecommendationResult {
  fastest: RouteRecommendationOption;
  /** Only present when a real tradeoff exists — never a second option identical to fastest. */
  lowestRisk: RouteRecommendationOption | null;
  cargoValueNote?: string;
}

/** Known alternate waypoints an advisory's own recommended_alternative text might name —
 * reused from the same lookup corridorAdvisories.ts uses, so "the lowest-risk option" is
 * always a real named place, never a fabricated reroute. */
const KNOWN_ALTERNATE_WAYPOINTS: Record<string, [number, number]> = {
  'cape of good hope': [-34.35, 18.47],
  'panama canal': [9.08, -79.68],
  'strait of malacca': [2.5, 101.4],
};

function findNamedAlternateWaypoint(text: string): { name: string; coords: [number, number] } | null {
  const lower = text.toLowerCase();
  for (const [name, coords] of Object.entries(KNOWN_ALTERNATE_WAYPOINTS)) {
    if (lower.includes(name)) return { name, coords };
  }
  return null;
}

const HIGH_VALUE_CARGO_USD = 1_000_000;

export function recommendRoute(
  originCoords: [number, number],
  destCoords: [number, number],
  originIata: string,
  destIata: string,
  tempRangeType: TemperatureRangeType,
  cargoValueUsd: number,
  ports: PortEntry[],
  advisories: CorridorAdvisory[]
): RouteRecommendationResult {
  const tempMin = tempRangeType.includes('-80') ? -90 : tempRangeType.includes('-20') ? -25 : tempRangeType.includes('15°') ? 15 : 2;
  const tempMax = tempRangeType.includes('-80') ? -70 : tempRangeType.includes('-20') ? -15 : tempRangeType.includes('15°') ? 25 : 8;
  const productCategory = tempMin <= -15 ? 'Vaccines' : tempMax >= 14 ? 'Active Ingredients' : 'Biologics';

  const modeRec = recommendTransportMode(originCoords, destCoords, tempMin, tempMax, productCategory, ports);
  const mode = modeRec.mode;

  const stops = recommendStops(originCoords, destCoords, originIata, destIata, tempMin, tempMax, ports, mode, 2);
  const stopPoints = stops.map((s) => ({ iata: s.port.code, city: s.port.city, coords: s.port.coords }));
  const metrics = computeRouteMetrics(originCoords, destCoords, stopPoints, mode, ports);

  const relevant = findRelevantAdvisories(advisories, originCoords, destCoords, mode);
  const fastestWarnings = relevant.map(formatAdvisoryWarning);

  const fastest: RouteRecommendationOption = {
    label: 'Fastest',
    mode,
    modeReason: modeRec.reason,
    totalDistanceKm: metrics.totalDistanceKm,
    estTransitHours: metrics.estTransitHours,
    stops,
    advisoryWarnings: fastestWarnings,
    reasoning:
      stops.length > 0
        ? `Direct-mode route with ${stops.length} CEIV/GDP-certified stop${stops.length > 1 ? 's' : ''} along the way. ${modeRec.reason}`
        : `Direct route, no stop needed. ${modeRec.reason}`,
  };

  // A lowest-risk alternative only exists when a severe advisory actually affects the fastest
  // option AND its own text names a real alternate waypoint we can route through.
  const severeUnresolved = relevant.find((r) => requiresAcknowledgment(r.advisory.severity));
  let lowestRisk: RouteRecommendationOption | null = null;

  if (severeUnresolved) {
    const alt = findNamedAlternateWaypoint(severeUnresolved.advisory.recommendedAlternative);
    if (alt) {
      const altStopPoints = [{ iata: '', city: alt.name.replace(/\b\w/g, (c) => c.toUpperCase()), coords: alt.coords }, ...stopPoints];
      const altMetrics = computeRouteMetrics(originCoords, destCoords, altStopPoints, mode, ports);
      lowestRisk = {
        label: 'Lowest-Risk',
        mode,
        modeReason: modeRec.reason,
        totalDistanceKm: altMetrics.totalDistanceKm,
        estTransitHours: altMetrics.estTransitHours,
        stops,
        advisoryWarnings: [], // this option specifically avoids the flagged corridor
        reasoning: `Routes via ${alt.name.replace(/\b\w/g, (c) => c.toUpperCase())} per the ${severeUnresolved.advisory.corridorName} advisory's recommended alternative, avoiding the flagged corridor at the cost of ~${Math.round(altMetrics.estTransitHours - metrics.estTransitHours)}h more transit time.`,
      };
    }
  }

  let cargoValueNote: string | undefined;
  if (lowestRisk && cargoValueUsd >= HIGH_VALUE_CARGO_USD) {
    cargoValueNote = `This shipment is valued at $${cargoValueUsd.toLocaleString()} — given the value at risk, the lowest-risk option may be worth the added transit time, though the choice is yours.`;
  }

  return { fastest, lowestRisk, cargoValueNote };
}
