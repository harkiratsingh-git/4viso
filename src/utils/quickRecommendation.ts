// A fast, plain-language "what's wrong and what to do about it" for any lane list view
// (Simple Dashboard's needs-attention list, the Lane Risk Management table) — reuses the same
// carrier recommendation engine used everywhere else in the app (recommendCarrier), not a
// separate heuristic invented just for this widget. Deliberately synchronous and cheap so it
// can run for every flagged row in a table without an async round-trip per row.
import { Carrier, CarrierPerformanceSummary, TransportLane } from '../types';
import { recommendCarrier } from './carrierRecommendation';
import { isLaneExcursing, isLaneHighRisk, getEffectiveRiskScore } from './laneRisk';

export interface QuickRecommendation {
  headline: string;
  severity: 'Critical' | 'High';
}

const ALT_CARRIER_SCORE_THRESHOLD = 60;

function altCarrierNote(lane: TransportLane, carriers: Carrier[], performanceByCarrierId: Map<string, CarrierPerformanceSummary>): string {
  if (carriers.length === 0) return '';
  const ranked = recommendCarrier(carriers, lane.mode, lane.tempRangeType, lane.originCountry, lane.destinationCountry, 2, performanceByCarrierId);
  const top = ranked[0];
  if (top && top.carrier.name !== lane.carrier && top.score >= ALT_CARRIER_SCORE_THRESHOLD) {
    return ` — try ${top.carrier.name} (${top.reasons[0]})`;
  }
  return '';
}

/** Null when the lane has nothing worth flagging — callers should render nothing in that case,
 *  not a reassuring "all good" message (that's what the absence of a flag already communicates). */
export function getQuickRecommendation(
  lane: TransportLane,
  carriers: Carrier[],
  performanceByCarrierId: Map<string, CarrierPerformanceSummary>
): QuickRecommendation | null {
  const excursing = isLaneExcursing(lane);
  const gdpIssue = lane.gdpStatus === 'Non-Compliant';
  const highRisk = isLaneHighRisk(lane);
  const disrupted = lane.status === 'Delayed' || lane.status === 'Customs Hold';

  if (!excursing && !gdpIssue && !highRisk && !disrupted) return null;

  const note = altCarrierNote(lane, carriers, performanceByCarrierId);

  if (excursing) {
    return { severity: 'Critical', headline: `Active excursion at ${lane.currentTemp}°C — quarantine on arrival and open a CAPA${note}` };
  }
  if (gdpIssue) {
    return { severity: 'Critical', headline: `GDP non-compliant (${lane.gdpComplianceRate}%) — file a CAPA and review handling SOP${note}` };
  }
  if (disrupted) {
    return {
      severity: 'High',
      headline: `${lane.status === 'Delayed' ? `Delayed ${lane.delayHours}h` : 'Held in customs'} — confirm updated ETA with carrier${note}`,
    };
  }
  return { severity: 'High', headline: `High composite risk (${getEffectiveRiskScore(lane)}%) — review carrier and route assignment${note}` };
}
