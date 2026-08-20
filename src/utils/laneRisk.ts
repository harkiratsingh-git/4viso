import { TransportLane, RiskLevel, GdpStatus } from '../types';

// Single source of truth for "is this lane currently in trouble" — several places in the
// app used to read lane.riskScore/riskLevel directly, which are only updated by a handful
// of user actions and never by the temperature simulation itself. A lane could sit in a
// live excursion (currentTemp outside tempMin/tempMax, or status already 'Temperature Alert')
// while its stored risk fields were still whatever they were when the lane was created —
// exactly the "0 High-Risk Lanes but 3 active excursions" contradiction. Every dashboard
// count, filter, and badge should derive risk through these functions instead of reading
// the stored fields directly, so they can never disagree with each other again.

export function isLaneExcursing(lane: TransportLane): boolean {
  return lane.status === 'Temperature Alert' || lane.currentTemp < lane.tempMin || lane.currentTemp > lane.tempMax;
}

/** Risk level as the rest of the app should treat it "right now", not just as last stored. */
export function getEffectiveRiskLevel(lane: TransportLane): RiskLevel {
  if (isLaneExcursing(lane)) return 'Critical';
  return lane.riskLevel;
}

/** Risk score as the rest of the app should treat it "right now", not just as last stored. */
export function getEffectiveRiskScore(lane: TransportLane): number {
  if (isLaneExcursing(lane)) return Math.max(lane.riskScore, 75);
  return lane.riskScore;
}

export function isLaneHighRisk(lane: TransportLane): boolean {
  const level = getEffectiveRiskLevel(lane);
  return getEffectiveRiskScore(lane) >= 40 || level === 'High' || level === 'Critical';
}

export function isHighOrCritical(level: RiskLevel): boolean {
  return level === 'High' || level === 'Critical';
}

/** Same thresholds `assessRoute` uses for its overall route score — the one place a 0-100 risk
 *  score is turned into a level, so every recompute path (Edit Lane, per-leg reassignment,
 *  disruption resolution) agrees with the wizard's own scoring on what counts as High/Critical. */
export function deriveRiskLevelFromScore(score: number): RiskLevel {
  return score >= 55 ? 'Critical' : score >= 35 ? 'High' : score >= 18 ? 'Medium' : 'Low';
}

/** A lane's GDP status follows directly from its risk level post-recompute — Non-Compliant at
 *  Critical (an active excursion-grade risk is itself a compliance failure), Warning at High,
 *  Compliant otherwise. */
export function gdpStatusForRiskLevel(level: RiskLevel): GdpStatus {
  return level === 'Critical' ? 'Non-Compliant' : level === 'High' ? 'Warning' : 'Compliant';
}
