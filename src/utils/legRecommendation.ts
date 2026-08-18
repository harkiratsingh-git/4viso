// Per-leg extension of the recommendation engine. A "leg" is one origin->destination segment
// of a route (what lane_legs rows represent) — this reuses the existing lane-level tools
// (calculate_lane_base_risk, recommendCarrier) scoped to just that segment's endpoints, rather
// than reimplementing risk/carrier scoring for legs specifically.
import { Carrier, CarrierPerformanceSummary, CarrierRecommendation, RiskLevel, TemperatureRangeType, TransportMode } from '../types';
import { calculateLaneBaseRisk } from '../services/supabaseService';
import { recommendCarrier } from './carrierRecommendation';
import { haversineKm } from './geoMath';

export type LegMode = 'Air' | 'Sea' | 'Road' | 'Rail';

export interface RouteWaypoint {
  iata: string;
  city: string;
  country: string;
  coords: [number, number];
}

export interface LegRecommendation {
  legSequence: number;
  origin: RouteWaypoint;
  destination: RouteWaypoint;
  mode: LegMode;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  carrierRecommendations: CarrierRecommendation[];
  topCarrierPick: CarrierRecommendation | null;
}

/** A lane's overall TransportMode can be 'Multimodal', but each leg is single-mode — this maps
 * a lane-level mode default down to a real per-leg mode when no per-leg override is given. */
export function defaultLegMode(laneMode: TransportMode): LegMode {
  return laneMode === 'Multimodal' ? 'Air' : laneMode;
}

// ---------------------------------------------------------------------------
// Real operating-region carrier rules (Blue Dart / SF Express / Aramex)
//
// recommendCarrier() only ever sees origin/dest *country* names, which is enough for its
// generic "does this carrier's primary_regions cover this route" match — but these three
// carriers have quirks that genuinely require leg-level detail (specific hub IATA codes,
// per-leg mode, season, estimated transit time) that recommendCarrier's signature doesn't
// carry. So this layer runs after it, with the fuller leg context, rather than trying to widen
// recommendCarrier's generic contract for three specific carriers.
// ---------------------------------------------------------------------------

const INDIAN_METRO_IATA = new Set(['BOM', 'DEL', 'BLR', 'MAA', 'HYD', 'CCU', 'AMD']);
const RCEP_ASIA_COUNTRIES = new Set(['Vietnam', 'Thailand', 'Malaysia', 'Singapore', 'South Korea', 'Japan']);
/** GCC states plus the broader MENA overland corridor this app's country directory covers. */
const GCC_MENA_COUNTRIES = new Set(['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Egypt']);
const ROAD_SPEED_KMH = 70;

const WEIGHT_BLUEDART_METRO_BONUS = 15;
const WEIGHT_SFEXPRESS_RCEP_BONUS = 25;
const WEIGHT_ARAMEX_OVERLAND_BONUS = 15;
const WEIGHT_ARAMEX_NO_FLEET_AIR_PENALTY = 20;
const isTempSensitive = (tempRangeType: TemperatureRangeType) => tempRangeType !== '15°C to 25°C (Controlled Room Temp)';

/**
 * Applies real-world regional-strength/limitation rules for Blue Dart, SF Express, and Aramex
 * on top of the generic score. Returns null when the carrier should be excluded from this leg
 * entirely (not just down-ranked) — currently only Blue Dart on an India-border-crossing leg,
 * since it genuinely has no independent international long-haul network to offer.
 */
function applyCarrierRegionalRules(
  rec: CarrierRecommendation,
  origin: RouteWaypoint,
  destination: RouteWaypoint,
  mode: LegMode,
  tempRangeType: TemperatureRangeType
): CarrierRecommendation | null {
  const { carrier } = rec;
  let score = rec.score;
  const reasons = [...rec.reasons];

  if (carrier.id === 'CARR-BLUEDART') {
    const originIsIndia = origin.country === 'India';
    const destIsIndia = destination.country === 'India';
    if (originIsIndia !== destIsIndia) {
      // Crosses India's border — Blue Dart has no independent international long-haul network;
      // it hands off to DHL at the gateway, so it's not a real option for this leg at all.
      return null;
    }
    if (originIsIndia && destIsIndia) {
      const bothMetro = INDIAN_METRO_IATA.has(origin.iata) && INDIAN_METRO_IATA.has(destination.iata);
      if (bothMetro) {
        score += WEIGHT_BLUEDART_METRO_BONUS;
        reasons.push('India-domestic metro-to-metro leg — inside Blue Dart\'s core network.');
      } else if (isTempSensitive(tempRangeType) && tempRangeType === '2°C to 8°C (Cold Chain)') {
        reasons.push('Destination is outside Blue Dart\'s major-metro network — flag for passive-shipper/72h-holdover handling rather than standard linehaul for this active 2-8°C reefer requirement.');
      }
    }
  }

  if (carrier.id === 'CARR-SFEXPRESS') {
    const originIsChina = origin.country === 'China';
    const destIsChina = destination.country === 'China';
    const isRcepCorridor = (originIsChina && RCEP_ASIA_COUNTRIES.has(destination.country)) || (destIsChina && RCEP_ASIA_COUNTRIES.has(origin.country));
    if (isRcepCorridor) {
      score += WEIGHT_SFEXPRESS_RCEP_BONUS;
      reasons.push('Intra-Asia/RCEP corridor — within SF Express\'s regional network.');
    }
    if ((originIsChina || destIsChina) && isTempSensitive(tempRangeType)) {
      reasons.push('Temperature-controlled China leg — prefer routing via SF Express\'s Ezhou (EHU) hub, its purpose-built cold-chain cargo facility.');
    }
  }

  if (carrier.id === 'CARR-ARAMEX') {
    const gccOverland = GCC_MENA_COUNTRIES.has(origin.country) && GCC_MENA_COUNTRIES.has(destination.country) && mode === 'Road';
    if (gccOverland) {
      score += WEIGHT_ARAMEX_OVERLAND_BONUS;
      reasons.push('GCC/MENA overland cross-border leg — Aramex\'s core network.');
      const estTransitHours = haversineKm(origin.coords, destination.coords) / ROAD_SPEED_KMH;
      const month = new Date().getUTCMonth() + 1; // 1-12
      if (month >= 5 && month <= 9 && estTransitHours > 36) {
        reasons.push(`High-ambient-temperature warning: ~${Math.round(estTransitHours)}h overland transit during May-September — confirm active (not passive) cooling is selected.`);
      }
    }
    if (mode === 'Air') {
      score -= WEIGHT_ARAMEX_NO_FLEET_AIR_PENALTY;
      reasons.push('Aramex owns no aircraft — this Air leg would be brokered capacity, not a dedicated network; weighted down relative to carriers with their own fleet.');
    }
  }

  return { carrier, score: Math.round(score), reasons };
}

/**
 * Computes, for every consecutive pair of waypoints (origin -> stop1 -> ... -> destination),
 * the same live corridor-risk score and carrier recommendation ranking used at the whole-lane
 * level — just scoped to that one segment, then layers the real regional-carrier rules above
 * on top before re-ranking. legModeOverrides lets the caller pin a specific leg (by sequence,
 * 1-based) to a mode other than the lane default, e.g. a multimodal route where one leg is
 * genuinely Sea and another is Road.
 */
export async function computeLegRecommendations(
  waypoints: RouteWaypoint[],
  laneMode: TransportMode,
  tempRangeType: TemperatureRangeType,
  carriers: Carrier[],
  performanceByCarrierId: Map<string, CarrierPerformanceSummary>,
  legModeOverrides: Record<number, LegMode> = {},
  resultLimit = 4
): Promise<LegRecommendation[]> {
  if (waypoints.length < 2) return [];

  const legs = waypoints.slice(0, -1).map((origin, i) => ({
    legSequence: i + 1,
    origin,
    destination: waypoints[i + 1],
    mode: legModeOverrides[i + 1] ?? defaultLegMode(laneMode),
  }));

  return Promise.all(
    legs.map(async (leg) => {
      const baseRisk = await calculateLaneBaseRisk(leg.origin.iata, leg.destination.iata, leg.mode, tempRangeType);
      // Get every eligible carrier scored (not pre-sliced to 4) so the regional-rule exclusion
      // below (e.g. Blue Dart on a border-crossing leg) can't silently shrink the final list.
      const baseScored = recommendCarrier(carriers, leg.mode, tempRangeType, leg.origin.country, leg.destination.country, carriers.length, performanceByCarrierId);
      const carrierRecommendations = baseScored
        .map((rec) => applyCarrierRegionalRules(rec, leg.origin, leg.destination, leg.mode, tempRangeType))
        .filter((rec): rec is CarrierRecommendation => rec !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, resultLimit);
      return {
        legSequence: leg.legSequence,
        origin: leg.origin,
        destination: leg.destination,
        mode: leg.mode,
        riskScore: baseRisk?.riskScore ?? null,
        riskLevel: baseRisk?.riskLevel ?? null,
        carrierRecommendations,
        topCarrierPick: carrierRecommendations[0] ?? null,
      };
    })
  );
}

/** True when every leg shares the same carrier and mode — the "collapse to one badge" case.
 * Mirrors the lane_carrier_summary view's distinct_carrier_count/distinct_mode_count logic,
 * usable client-side before a lane (and its legs) even exist in the database yet. */
export function legsAreUnified(legs: { mode: LegMode; carrierId: string | null }[]): boolean {
  if (legs.length === 0) return true;
  const firstMode = legs[0].mode;
  const firstCarrier = legs[0].carrierId;
  return legs.every((l) => l.mode === firstMode && l.carrierId === firstCarrier && firstCarrier !== null);
}
