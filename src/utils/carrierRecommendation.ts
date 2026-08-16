// Carrier recommendation: weighs reliability_score, ceiv_pharma_partner, cold_chain_specialist,
// owns_dedicated_network, and — with real, visible weight rather than as an afterthought —
// whether a Regional Specialist's primary_regions actually cover this route. A domestic
// specialist operating in its home market can legitimately outrank a larger international
// carrier operating outside its core strength; every score comes with the reasons that
// produced it, since a bare ranked list isn't something a Quality Lead can defend in an audit.
import { Carrier, CarrierPerformanceSummary, CarrierRecommendation, TemperatureRangeType, TransportMode } from '../types';

/** Rough country -> macro-region lookup, covering the countries that appear in this app's
 * airport/port directories. Unknown countries simply contribute no extra region tags rather
 * than guessing — the domestic ("<Country> domestic") match below still works for them. */
const COUNTRY_REGION: Record<string, 'Europe' | 'Asia' | 'Middle East' | 'Africa' | 'North America' | 'Latin America' | 'Oceania'> = {
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

/** Region tags this route plausibly falls under, matched against carriers' primary_regions. */
export function inferRouteRegions(originCountry: string, destCountry: string): Set<string> {
  const regions = new Set<string>();
  regions.add('Global'); // every carrier whose primary_regions includes 'Global' legitimately covers any route

  if (originCountry && originCountry === destCountry) {
    regions.add(`${originCountry} domestic`);
  }

  const originRegion = COUNTRY_REGION[originCountry];
  const destRegion = COUNTRY_REGION[destCountry];
  if (originRegion && destRegion) {
    if (originRegion === 'Europe' && destRegion === 'Europe') regions.add('Europe');
    if ((originRegion === 'Asia' && destRegion === 'Europe') || (originRegion === 'Europe' && destRegion === 'Asia')) regions.add('Asia-Europe');
    if ((originRegion === 'North America' && destRegion === 'Europe') || (originRegion === 'Europe' && destRegion === 'North America')) regions.add('Transatlantic');
    if ((originRegion === 'North America' && destRegion === 'Asia') || (originRegion === 'Asia' && destRegion === 'North America')) regions.add('Transpacific');
    if (originRegion === 'Asia' && destRegion === 'Asia' && originCountry !== destCountry) regions.add('Intra-Asia');
  }
  if (originRegion === 'Middle East' || destRegion === 'Middle East') regions.add('Middle East');
  if (originRegion === 'Africa' || destRegion === 'Africa') regions.add('Africa');
  if (originRegion === 'Latin America' || destRegion === 'Latin America') regions.add('Latin America');

  return regions;
}

function isTempSensitive(tempRangeType: TemperatureRangeType): boolean {
  return tempRangeType !== '15°C to 25°C (Controlled Room Temp)';
}

const WEIGHT_CEIV_PARTNER = 12;
const WEIGHT_COLD_CHAIN_SPECIALIST = 10;
const WEIGHT_DEDICATED_NETWORK = 6;
/** The single largest static weight in the model — a real, decisive factor per the explicit
 * requirement that a Regional Specialist match should be able to outrank a larger
 * international carrier, not be a minor tiebreaker. */
const WEIGHT_REGIONAL_MATCH = 30;

/**
 * Real logged performance (carrier_performance_summary) outweighs everything else when it
 * exists, since it's actual outcomes on actual shipments rather than a static estimate — but
 * the view itself only ever returns a row once a carrier has 5+ logged shipments, specifically
 * so a tiny sample never masquerades as a reliable rate. Until real data accumulates this is a
 * no-op for every carrier, which is the correct, honest behavior.
 */
function applyPerformanceAdjustment(score: number, reasons: string[], perf?: CarrierPerformanceSummary): number {
  if (!perf) return score;
  let adjusted = score;
  if (perf.onTimePct >= 90) adjusted += 10;
  else if (perf.onTimePct < 70) adjusted -= 10;
  if (perf.excursionRatePct > 5) adjusted -= 15;
  if (perf.claimRatePct > 3) adjusted -= 10;
  reasons.push(`${perf.onTimePct}% on-time, ${perf.excursionRatePct}% excursion rate across ${perf.shipmentCount} logged shipments`);
  return adjusted;
}

export function recommendCarrier(
  carriers: Carrier[],
  mode: TransportMode,
  tempRangeType: TemperatureRangeType,
  originCountry: string,
  destCountry: string,
  limit = 4,
  performanceByCarrierId?: Map<string, CarrierPerformanceSummary>
): CarrierRecommendation[] {
  const sensitive = isTempSensitive(tempRangeType);
  const routeRegions = inferRouteRegions(originCountry, destCountry);

  // Seed data never tags a carrier's modes with the literal string 'Multimodal' — a
  // multimodal lane needs a carrier capable of more than one mode instead.
  const eligible = carriers.filter((c) => (mode === 'Multimodal' ? c.modes.length >= 2 : c.modes.some((m) => m === mode)));

  const scored = eligible.map((carrier) => {
    let score = carrier.reliabilityScore;
    const reasons: string[] = [`Reliability score ${carrier.reliabilityScore}/100`];

    if (sensitive && carrier.ceivPharmaPartner) {
      score += WEIGHT_CEIV_PARTNER;
      reasons.push('CEIV Pharma certified partner');
    }
    if (sensitive && carrier.coldChainSpecialist) {
      score += WEIGHT_COLD_CHAIN_SPECIALIST;
      reasons.push('cold-chain specialist');
    }
    if (carrier.ownsDedicatedNetwork) {
      score += WEIGHT_DEDICATED_NETWORK;
      reasons.push('owns its dedicated network end-to-end');
    }

    const matchedRegions = carrier.primaryRegions.filter((r) => routeRegions.has(r) && r !== 'Global');
    if (carrier.carrierType === 'Regional Specialist' && matchedRegions.length > 0) {
      score += WEIGHT_REGIONAL_MATCH;
      reasons.push(`regional specialist in ${matchedRegions.join(', ')} — this route is inside its core strength`);
    }

    score = applyPerformanceAdjustment(score, reasons, performanceByCarrierId?.get(carrier.id));

    return { carrier, score: Math.round(score), reasons };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Builds the audit-defensible "X recommended over Y" sentence for the top pick vs. the
 * next-best alternative, e.g. "Blue Dart recommended over DHL for this Mumbai-internal leg:
 * regional specialist, domestic network." */
export function explainTopPick(ranked: CarrierRecommendation[]): string | null {
  if (ranked.length < 2) return null;
  const [top, runnerUp] = ranked;
  return `${top.carrier.name} recommended over ${runnerUp.carrier.name}: ${top.reasons.join(', ')}.`;
}
