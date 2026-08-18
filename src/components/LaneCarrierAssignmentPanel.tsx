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

interface LaneCarrierAssignmentPanelProps {
  lane: TransportLane;
}

/**
 * The existing-lane counterpart to the wizard's Phase 1 carrier assignment step: loads the
 * lane's real lane_legs rows, shows the same collapse-to-one-badge-or-per-leg-breakdown UI,
 * and lets a Quality Lead/Logistics Director correct an assignment after the fact — always
 * editable, per the spec, not just at creation time.
 */
export const LaneCarrierAssignmentPanel: React.FC<LaneCarrierAssignmentPanelProps> = ({ lane }) => {
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

    Promise.all([fetchCarriers(), fetchCarrierPerformanceSummary(), fetchCarrierCertificationStatuses(), fetchLaneLegs(lane.id)]).then(
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
  }, [lane.id, lane.originIata, lane.destinationIata, lane.mode, lane.tempRangeType]);

  const handleSave = async () => {
    if (!legs) return;
    setSaving(true);
    setSaveMessage(null);
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
      legRiskScore: l.riskScore,
    }));
    const success = await replaceLaneLegs(lane.id, rows);
    setSaving(false);
    setSaveMessage(success ? 'Carrier assignment saved.' : 'Failed to save — check your connection and try again.');
  };

  if (!legs) {
    return (
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading carrier assignment…
      </div>
    );
  }

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-4 h-4 text-teal-400" />
          Carrier Assignment
        </h3>
        <button
          onClick={handleSave}
          disabled={saving || anyLegBlocked}
          className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

      {saveMessage && <p className="text-[11px] text-slate-400 mt-2">{saveMessage}</p>}
    </div>
  );
};
