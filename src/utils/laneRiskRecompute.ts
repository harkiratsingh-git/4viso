// Single entry point for "a lane's carrier/route just changed, what's its risk now" — used by
// every path that can change a lane's carrier or route (Edit Lane, per-leg reassignment,
// Execute Mitigation, Phase 4 disruption resolution) so they all recompute the same way instead
// of some of them leaving the lane's stored risk_score/risk_level/gdp_status stale. Mirrors the
// blend the wizard uses at creation time: the live `calculate_lane_base_risk` DB function (cloud)
// averaged with the local corridor assessment, or the local assessment alone when there's no
// cloud session to call the RPC against.
import { RiskLevel, GdpStatus, TransportMode, TemperatureRangeType } from '../types';
import { calculateLaneBaseRisk, syncLaneRiskToSupabase } from '../services/supabaseService';
import { assessRoute } from './riskAssessment';
import { deriveRiskLevelFromScore, gdpStatusForRiskLevel, isHighOrCritical } from './laneRisk';

export interface RecomputedLaneRisk {
  riskScore: number;
  riskLevel: RiskLevel;
  gdpStatus: GdpStatus;
}

export async function recomputeLaneRisk(params: {
  originIata: string;
  originCoords: [number, number];
  destinationIata: string;
  destinationCoords: [number, number];
  stops: { iata: string; coords: [number, number]; city?: string }[];
  mode: TransportMode;
  tempRangeType: TemperatureRangeType;
  tempMin: number;
  tempMax: number;
  dataSource: 'loading' | 'cloud' | 'local';
}): Promise<RecomputedLaneRisk> {
  const local = assessRoute({
    origin: { label: 'Origin', iata: params.originIata, coords: params.originCoords },
    destination: { label: 'Destination', iata: params.destinationIata, coords: params.destinationCoords },
    stops: params.stops.map((s, i) => ({ label: s.city || `Stop ${i + 1}`, iata: s.iata, coords: s.coords })),
    mode: params.mode,
    tempMin: params.tempMin,
    tempMax: params.tempMax,
  });

  const cloudRisk =
    params.dataSource === 'cloud'
      ? await calculateLaneBaseRisk(params.originIata, params.destinationIata, params.mode, params.tempRangeType)
      : null;

  const riskScore = cloudRisk ? Math.round((cloudRisk.riskScore + local.overallScore) / 2) : local.overallScore;
  const riskLevel = cloudRisk ? cloudRisk.riskLevel : local.overallLevel;

  return { riskScore, riskLevel, gdpStatus: gdpStatusForRiskLevel(riskLevel) };
}

/** Same idea, but for a caller that already has per-leg risk scores in hand (per-leg carrier
 *  reassignment, disruption resolution) rather than a single origin/destination pair — averages
 *  the legs instead of re-running assessRoute/the RPC for the whole lane. */
export function recomputeLaneRiskFromLegScores(legRiskScores: number[]): RecomputedLaneRisk {
  const riskScore = legRiskScores.length > 0 ? Math.round(legRiskScores.reduce((sum, s) => sum + s, 0) / legRiskScores.length) : 0;
  const riskLevel = deriveRiskLevelFromScore(riskScore);
  return { riskScore, riskLevel, gdpStatus: gdpStatusForRiskLevel(riskLevel) };
}

/** The dual-message policy Part 1 asks for: only claim "resolved" when the recomputed risk
 *  actually dropped out of High/Critical; otherwise say plainly that the change was applied and
 *  recomputed, without overstating it as a fix. */
export function resolutionMessage(previousLevel: RiskLevel, next: RecomputedLaneRisk, actorLabel: string): string {
  if (isHighOrCritical(previousLevel) && !isHighOrCritical(next.riskLevel)) {
    return `Resolved — now proceeding with ${actorLabel}. Risk re-assessed at ${next.riskScore}% (${next.riskLevel}).`;
  }
  return `Transferring to ${actorLabel}. Risk re-assessed at ${next.riskScore}% (${next.riskLevel}).`;
}

export async function syncRecomputedRisk(laneId: string, risk: RecomputedLaneRisk, dataSource: 'loading' | 'cloud' | 'local'): Promise<void> {
  if (dataSource !== 'cloud') return;
  await syncLaneRiskToSupabase(laneId, risk.riskScore, risk.riskLevel, risk.gdpStatus).catch(() => {});
}
