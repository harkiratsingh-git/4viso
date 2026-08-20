import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Truck } from 'lucide-react';
import { Carrier, CarrierCertificationStatus, CarrierPerformanceSummary, TransportLane } from '../types';
import {
  fetchCarriers,
  fetchCarrierPerformanceSummary,
  fetchCarrierCertificationStatuses,
  fetchLaneLegs,
  replaceLaneLegs,
  getActiveUser,
} from '../services/supabaseService';
import { computeLegRecommendations, LegMode, LegRecommendation } from '../utils/legRecommendation';
import { LegCarrierBreakdown } from './LegCarrierBreakdown';
import { useThemeTokens } from '../contexts/ViewModeContext';
import { recomputeLaneRiskFromLegScores, resolutionMessage, RecomputedLaneRisk } from '../utils/laneRiskRecompute';
import { getEffectiveRiskLevel } from '../utils/laneRisk';

interface LaneCarrierAssignmentPanelProps {
  lane: TransportLane;
  dataSource: 'loading' | 'cloud' | 'local';
  /** Part 1: called after Save with the lane's real recomputed composite risk (averaged across
   *  the just-saved legs, reflecting any per-leg mode override, not just the carrier swap) so the
   *  parent can update the lane's stored risk_score/risk_level/gdp_status the same way every
   *  other carrier/route-changing path does. */
  onRiskUpdated: (laneId: string, risk: RecomputedLaneRisk) => void;
}

/**
 * The existing-lane counterpart to the wizard's Phase 1 carrier assignment step: loads the
 * lane's real lane_legs rows, shows the same collapse-to-one-badge-or-per-leg-breakdown UI,
 * and lets a Quality Lead/Logistics Director correct an assignment after the fact — always
 * editable, per the spec, not just at creation time.
 *
 * A demo lane's id (e.g. "lane-3") is never a real transport_lanes row, so fetchLaneLegs/
 * replaceLaneLegs must never be attempted for one — lane_legs.lane_id is a real foreign key,
 * and a replaceLaneLegs INSERT against a nonexistent lane would fail outright. In local mode
 * this panel still computes and shows live recommendations (same engine, same UI), it just
 * can't seed from or persist to a lane_legs row that doesn't exist — "Save" confirms the
 * selection for the current session instead.
 */
export const LaneCarrierAssignmentPanel: React.FC<LaneCarrierAssignmentPanelProps> = ({ lane, dataSource, onRiskUpdated }) => {
  const t = useThemeTokens();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [performanceByCarrierId, setPerformanceByCarrierId] = useState<Map<string, CarrierPerformanceSummary>>(new Map());
  const [certStatusByCarrierId, setCertStatusByCarrierId] = useState<Map<string, CarrierCertificationStatus['certificationStatus']>>(new Map());
  const [legs, setLegs] = useState<LegRecommendation[] | null>(null);
  const [assignedCarrierId, setAssignedCarrierId] = useState<Record<number, string | null>>({});
  const [assignedMode, setAssignedMode] = useState<Record<number, LegMode>>({});
  const [anyLegBlocked, setAnyLegBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const currentUser = useMemo(() => getActiveUser(), []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchCarriers(),
      fetchCarrierPerformanceSummary(),
      fetchCarrierCertificationStatuses(),
      dataSource === 'cloud' ? fetchLaneLegs(lane.id) : Promise.resolve(null),
    ]).then(
      async ([carrierRows, perfRows, certRows, legRows]) => {
        if (cancelled) return;
        const carrierList = carrierRows ?? [];
        setCarriers(carrierList);
        const perfMap = new Map((perfRows ?? []).map((r) => [r.carrierId, r]));
        setPerformanceByCarrierId(perfMap);
        setCertStatusByCarrierId(new Map((certRows ?? []).map((r) => [r.carrierId, r.certificationStatus])));

        const waypoints = [
          { iata: lane.originIata, city: lane.originCity, country: lane.originCountry, coords: lane.originCoords },
          ...lane.stops.map((s) => ({ iata: s.iata, city: s.city, country: s.country, coords: s.coords })),
          { iata: lane.destinationIata, city: lane.destinationCity, country: lane.destinationCountry, coords: lane.destinationCoords },
        ];
        const computed = await computeLegRecommendations(waypoints, lane.mode, lane.tempRangeType, carrierList, perfMap);
        if (cancelled) return;
        setLegs(computed);

        // Seed the actual current assignment from lane_legs, not the fresh recommendation —
        // this panel should show what's really assigned until the user changes it.
        const carrierSeed: Record<number, string | null> = {};
        const modeSeed: Record<number, LegMode> = {};
        for (const row of legRows ?? []) {
          carrierSeed[row.legSequence] = row.carrierId;
          modeSeed[row.legSequence] = row.mode;
        }
        setAssignedCarrierId(carrierSeed);
        setAssignedMode(modeSeed);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [lane.id, lane.originIata, lane.destinationIata, lane.mode, lane.tempRangeType, dataSource]);

  const handleSave = async () => {
    if (!legs) return;
    setSaving(true);
    setSaveMessage(null);

    const previousLevel = getEffectiveRiskLevel(lane);
    const anyModeChanged = legs.some((l) => (assignedMode[l.legSequence] ?? l.mode) !== l.mode);
    // A leg's stored riskScore was computed with its *original* mode — if the user changed a
    // leg's mode here, that score is stale and must be recomputed against the mode actually
    // being saved (Part 1: any leg/route change re-runs the real risk calculation, not just
    // carrier swaps, which don't move calculate_lane_base_risk's origin/destination/mode inputs).
    const freshLegs = anyModeChanged
      ? await computeLegRecommendations(
          [
            { iata: lane.originIata, city: lane.originCity, country: lane.originCountry, coords: lane.originCoords },
            ...lane.stops.map((s) => ({ iata: s.iata, city: s.city, country: s.country, coords: s.coords })),
            { iata: lane.destinationIata, city: lane.destinationCity, country: lane.destinationCountry, coords: lane.destinationCoords },
          ],
          lane.mode,
          lane.tempRangeType,
          carriers,
          performanceByCarrierId,
          assignedMode
        )
      : legs;
    const legRiskById = new Map(freshLegs.map((l) => [l.legSequence, l.riskScore]));

    const carrierName = (id: string | null) => (id ? carriers.find((c) => c.id === id)?.name : null) ?? 'the selected carrier';
    const unifiedCarrierId = legs.length > 0 ? assignedCarrierId[legs[0].legSequence] ?? legs[0].topCarrierPick?.carrier.id ?? null : null;
    const allSameCarrier = legs.every((l) => (assignedCarrierId[l.legSequence] ?? l.topCarrierPick?.carrier.id ?? null) === unifiedCarrierId);
    const actorLabel = allSameCarrier ? carrierName(unifiedCarrierId) : 'the updated per-leg assignment';

    const recomputed = recomputeLaneRiskFromLegScores(
      legs.map((l) => legRiskById.get(l.legSequence) ?? l.riskScore).filter((s): s is number => s != null)
    );
    onRiskUpdated(lane.id, recomputed);

    if (dataSource !== 'cloud') {
      // No real lane_legs row exists to persist to for a demo lane — the selection is already
      // reflected live in the dropdowns above, so this just confirms it for the session.
      setTimeout(() => {
        setSaving(false);
        setSaveMessage(`${resolutionMessage(previousLevel, recomputed, actorLabel)} (Local Simulation — not saved to a database.)`);
      }, 300);
      return;
    }

    const rows = legs.map((l) => ({
      legSequence: l.legSequence,
      originPortCode: l.origin.iata,
      destinationPortCode: l.destination.iata,
      mode: assignedMode[l.legSequence] ?? l.mode,
      carrierId: assignedCarrierId[l.legSequence] ?? l.topCarrierPick?.carrier.id ?? null,
      isRecommendedCarrier: !assignedCarrierId[l.legSequence] && !!l.topCarrierPick,
      stopType: (l.legSequence === legs.length ? 'Destination' : 'Transit Hub') as 'Destination' | 'Transit Hub',
      hoursOnGround: 0,
      distanceKm: null,
      estTransitHours: null,
      customsDelayHours: null,
      legRiskScore: legRiskById.get(l.legSequence) ?? l.riskScore,
    }));
    const success = await replaceLaneLegs(lane.id, rows);
    setSaving(false);
    setSaveMessage(success ? resolutionMessage(previousLevel, recomputed, actorLabel) : 'Failed to save — check your connection and try again.');
  };

  if (!legs) {
    return (
      <div className={`${t.cardBgSunken} border ${t.border} rounded-xl p-4 flex items-center gap-2 text-xs ${t.textMuted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading carrier assignment…
      </div>
    );
  }

  return (
    <div className={`${t.cardBgSunken} border ${t.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${t.textSecondary}`}>
          <Truck className={`w-4 h-4 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
          Carrier Assignment
        </h3>
        <button
          onClick={handleSave}
          disabled={saving || anyLegBlocked}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/30'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>

      <LegCarrierBreakdown
        legs={legs}
        carriers={carriers}
        certStatusByCarrierId={certStatusByCarrierId}
        assignedCarrierId={assignedCarrierId}
        assignedMode={assignedMode}
        onCarrierChange={(legSeq, carrierId) => setAssignedCarrierId((prev) => ({ ...prev, [legSeq]: carrierId }))}
        onModeChange={(legSeq, m) => setAssignedMode((prev) => ({ ...prev, [legSeq]: m }))}
        currentUserId={currentUser.id}
        onAnyLegBlocked={setAnyLegBlocked}
      />

      {saveMessage && (
        <p className={`text-[11px] mt-2 px-2.5 py-1.5 rounded-lg border ${
          saveMessage.startsWith('Resolved')
            ? t.light ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
            : saveMessage.startsWith('Transferring')
              ? t.light ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-teal-950/30 border-teal-800/50 text-teal-300'
              : `border-transparent ${t.textMuted}`
        }`}>
          {saveMessage}
        </p>
      )}
    </div>
  );
};
