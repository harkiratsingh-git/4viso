import { TransportLane, RiskLevel } from '../types';

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
