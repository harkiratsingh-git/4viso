import React, { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle2, FileText, Loader2, Repeat, ShieldCheck, UploadCloud } from 'lucide-react';
import { Carrier, CarrierPerformanceSummary, LaneDisruption, TransferDocument, TransportLane, LaneLeg } from '../types';
import {
  fetchLaneDisruptions,
  reportLaneDisruption,
  checkCanExtendCarrierContract,
  resolveLaneDisruption,
  fetchTransferDocuments,
  uploadTransferDocument,
  fetchLaneLegs,
  fetchCarriers,
  fetchCarrierPerformanceSummary,
  fetchVerifiedCertificationForCarrier,
  getActiveUser,
} from '../services/supabaseService';
import { computeLegRecommendations, LegMode, LegRecommendation, RouteWaypoint } from '../utils/legRecommendation';
import { getAirportCoords } from '../utils/geo';
import { PortEntry } from '../utils/ports';
import { usePorts } from '../contexts/PortsContext';
import { useThemeTokens } from '../contexts/ViewModeContext';
import { recomputeLaneRiskFromLegScores, resolutionMessage, RecomputedLaneRisk } from '../utils/laneRiskRecompute';
import { getEffectiveRiskLevel } from '../utils/laneRisk';

interface LaneDisruptionPanelProps {
  lane: TransportLane;
  dataSource: 'loading' | 'cloud' | 'local';
  /** Controlled from LaneRiskAssessmentModal's header "Report Disruption" button, so reporting
   *  isn't only reachable from an inline toggle buried inside this panel. */
  showReportForm: boolean;
  onShowReportFormChange: (show: boolean) => void;
  /** Part 1: same sink LaneCarrierAssignmentPanel uses — a carrier replaced/extended here must
   *  trigger the same recompute a manual reassignment would. */
  onRiskUpdated: (laneId: string, risk: RecomputedLaneRisk) => void;
}

const DISRUPTION_TYPES: LaneDisruption['disruptionType'][] = ['Carrier Incapacitated', 'Missing Documentation', 'Customs Detention', 'Other'];

function waypointForPort(code: string, ports: PortEntry[]): RouteWaypoint {
  const p = ports.find((p) => p.code === code);
  return p
    ? { iata: p.code, city: p.city, country: p.country, coords: p.coords }
    : { iata: code, city: code, country: '', coords: getAirportCoords(code) };
}

/**
 * Phase 4: emergency mid-transit disruption handling. Cloud-only, same as the rest of this
 * app's write paths — local/demo mode has no real session for RLS to accept and no real UUID
 * user id to attribute the report to, so this panel stays read-only (in fact invisible, since
 * there's nothing to report against) outside dataSource === 'cloud'.
 */
export const LaneDisruptionPanel: React.FC<LaneDisruptionPanelProps> = ({ lane, dataSource, showReportForm, onShowReportFormChange, onRiskUpdated }) => {
  const t = useThemeTokens();
  const { ports } = usePorts();
  const [legs, setLegs] = useState<LaneLeg[]>([]);
  const [disruptions, setDisruptions] = useState<LaneDisruption[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [performanceByCarrierId, setPerformanceByCarrierId] = useState<Map<string, CarrierPerformanceSummary>>(new Map());
  const [loading, setLoading] = useState(true);

  const [reportLegId, setReportLegId] = useState<string>('');
  const [reportType, setReportType] = useState<LaneDisruption['disruptionType']>('Carrier Incapacitated');
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const currentUser = useMemo(() => getActiveUser(), []);

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchLaneLegs(lane.id), fetchLaneDisruptions(lane.id), fetchCarriers(), fetchCarrierPerformanceSummary()]).then(
      ([legRows, disruptionRows, carrierRows, perfRows]) => {
        setLegs(legRows ?? []);
        setDisruptions(disruptionRows ?? []);
        setCarriers(carrierRows ?? []);
        setPerformanceByCarrierId(new Map((perfRows ?? []).map((r) => [r.carrierId, r])));
        setLoading(false);
        if (!reportLegId && legRows && legRows.length > 0) setReportLegId(legRows[0].id);
      }
    );
  };

  useEffect(() => {
    if (dataSource === 'cloud') loadAll();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane.id, dataSource]);

  const handleReport = async () => {
    if (!reportLegId || !reportDescription.trim()) return;
    setReporting(true);
    setReportMessage(null);
    const result = await reportLaneDisruption({
      laneId: lane.id,
      laneCode: lane.laneCode,
      legId: reportLegId,
      route: `${lane.originIata} -> ${lane.destinationIata}`,
      disruptionType: reportType,
      description: reportDescription.trim(),
      reportedBy: currentUser.id,
      laneRiskLevel: lane.riskLevel,
      cargoValueUsd: lane.payloadValueUsd,
    });
    setReporting(false);
    setReportMessage(result.message);
    if (result.success) {
      setReportDescription('');
      onShowReportFormChange(false);
      loadAll();
    }
  };

  if (dataSource !== 'cloud') {
    return (
      <div className={`${t.cardBgSunken} border ${t.border} rounded-xl p-4 text-xs ${t.textMuted}`}>
        Disruption reporting requires a cloud-connected session — not available in Local Simulation.
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${t.cardBgSunken} border ${t.border} rounded-xl p-4 flex items-center gap-2 text-xs ${t.textMuted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading disruption history…
      </div>
    );
  }

  return (
    <div className={`${t.cardBgSunken} border ${t.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${t.textSecondary}`}>
          <AlertOctagon className={`w-4 h-4 ${t.light ? 'text-rose-600' : 'text-rose-400'}`} />
          Mid-Transit Disruptions
        </h3>
      </div>

      {showReportForm && (
        <div className={`mb-4 p-3 rounded-xl ${t.cardBg} border ${t.border} space-y-2.5`}>
          <div>
            <label className={`block text-[11px] mb-1 ${t.textMuted}`}>Affected Leg</label>
            <select
              value={reportLegId}
              onChange={(e) => setReportLegId(e.target.value)}
              className={`w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-[11px] ${t.textPrimary}`}
            >
              {legs.map((l) => (
                <option key={l.id} value={l.id}>
                  Leg {l.legSequence}: {l.originPortCode} → {l.destinationPortCode} ({l.mode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-[11px] mb-1 ${t.textMuted}`}>Disruption Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as LaneDisruption['disruptionType'])}
              className={`w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-[11px] ${t.textPrimary}`}
            >
              {DISRUPTION_TYPES.map((typ) => (
                <option key={typ} value={typ}>{typ}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-[11px] mb-1 ${t.textMuted}`}>Description</label>
            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              rows={2}
              className={`w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-[11px] ${t.textPrimary}`}
              placeholder="What happened, and what's known so far…"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReport}
              disabled={reporting || !reportLegId || !reportDescription.trim()}
              className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {reporting ? 'Reporting…' : 'Report & Open CAPA'}
            </button>
            <button
              onClick={() => onShowReportFormChange(false)}
              className={`px-3 py-1.5 rounded-lg text-[11px] ${t.chipBg} ${t.textSecondary} ${t.hoverBg}`}
            >
              Cancel
            </button>
          </div>
          {reportMessage && <p className={`text-[11px] ${t.textMuted}`}>{reportMessage}</p>}
        </div>
      )}

      {disruptions.length === 0 ? (
        <p className={`text-[11px] ${t.textFaint}`}>No disruptions reported for this lane.</p>
      ) : (
        <div className="space-y-2.5">
          {disruptions.map((d) => (
            <DisruptionCard
              key={d.id}
              disruption={d}
              lane={lane}
              legs={legs}
              carriers={carriers}
              performanceByCarrierId={performanceByCarrierId}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              currentUserRole={currentUser.role}
              ports={ports}
              onResolved={loadAll}
              onRiskUpdated={onRiskUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DisruptionCard: React.FC<{
  disruption: LaneDisruption;
  lane: TransportLane;
  legs: LaneLeg[];
  carriers: Carrier[];
  performanceByCarrierId: Map<string, CarrierPerformanceSummary>;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  ports: PortEntry[];
  onResolved: () => void;
  onRiskUpdated: (laneId: string, risk: RecomputedLaneRisk) => void;
}> = ({ disruption, lane, legs, carriers, performanceByCarrierId, currentUserId, currentUserName, currentUserRole, ports, onResolved, onRiskUpdated }) => {
  const t = useThemeTokens();
  const [canExtend, setCanExtend] = useState<boolean | null>(null);
  const [existingCert, setExistingCert] = useState<{ carrierName: string; reviewedAt: string | null; uploadedAt: string } | null>(null);
  const [resolutionMode, setResolutionMode] = useState<'none' | 'replace' | 'extend' | 'other'>('none');
  const [pickedCarrierId, setPickedCarrierId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveMessage, setResolveMessage] = useState<string | null>(null);
  const [transferDocs, setTransferDocs] = useState<TransferDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [legRecommendations, setLegRecommendations] = useState<LegRecommendation[]>([]);

  const disruptedLeg = legs.find((l) => l.id === disruption.legId);

  // Every remaining leg still assigned to the disrupted carrier — a carrier failure affects
  // all of them, not just the one flagged leg.
  const affectedLegs = useMemo(() => {
    if (!disruptedLeg) return [];
    return legs
      .filter((l) => l.legSequence >= disruptedLeg.legSequence && l.carrierId === disruptedLeg.carrierId)
      .sort((a, b) => a.legSequence - b.legSequence);
  }, [legs, disruptedLeg]);

  const isOpen = disruption.status === 'Reported';

  useEffect(() => {
    if (!isOpen) return;
    checkCanExtendCarrierContract(disruption.legId).then(setCanExtend);
    fetchTransferDocuments(disruption.id).then((docs) => docs && setTransferDocs(docs));
    if (disruptedLeg?.carrierId) {
      fetchVerifiedCertificationForCarrier(disruptedLeg.carrierId).then((cert) => {
        if (cert) {
          const carrierName = carriers.find((c) => c.id === disruptedLeg.carrierId)?.name ?? disruptedLeg.carrierId;
          setExistingCert({ carrierName, reviewedAt: cert.reviewedAt, uploadedAt: cert.uploadedAt });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disruption.id, isOpen]);

  // Scores replacement candidates with the same per-leg recommendation engine the wizard's
  // carrier picker uses (real regional-carrier rules, country-aware, temperature-aware) —
  // scoped to the actual remaining route (from the disrupted leg's origin through to wherever
  // this carrier's exposure ends), instead of the generic recommendCarrier() with blank
  // origin/destination countries this used to fall back to.
  useEffect(() => {
    if (affectedLegs.length === 0) {
      setLegRecommendations([]);
      return;
    }
    let cancelled = false;
    const waypoints: RouteWaypoint[] = [
      waypointForPort(affectedLegs[0].originPortCode, ports),
      ...affectedLegs.map((l) => waypointForPort(l.destinationPortCode, ports)),
    ];
    const modeOverrides: Record<number, LegMode> = {};
    affectedLegs.forEach((l, i) => {
      modeOverrides[i + 1] = l.mode;
    });
    const eligibleCarriers = carriers.filter((c) => c.id !== disruptedLeg?.carrierId);
    // 'Multimodal' here is a nominal fallback only — every leg has an explicit entry in
    // modeOverrides above, so this lane-level default is never actually consulted; it just
    // needs to be a valid TransportMode (unlike LaneLeg['mode'], which also allows 'Rail').
    computeLegRecommendations(waypoints, 'Multimodal', lane.tempRangeType, eligibleCarriers, performanceByCarrierId, modeOverrides).then(
      (recs) => {
        if (!cancelled) setLegRecommendations(recs);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [affectedLegs, ports, carriers, performanceByCarrierId, disruptedLeg, lane.tempRangeType]);

  const carrierRecommendations = legRecommendations[0]?.carrierRecommendations ?? [];

  const handleResolve = async (resolutionType: 'Resolved - Carrier Replaced' | 'Resolved - Contract Extended' | 'Resolved - Other') => {
    setResolving(true);
    setResolveMessage(null);
    const newCarrierId = resolutionType === 'Resolved - Contract Extended' ? disruptedLeg?.carrierId ?? null : resolutionType === 'Resolved - Carrier Replaced' ? pickedCarrierId : null;
    const result = await resolveLaneDisruption({
      disruptionId: disruption.id,
      resolutionType,
      affectedLegIds: affectedLegs.map((l) => l.id),
      newCarrierId,
      notes,
      resolvedBy: currentUserId,
      correctiveAction: correctiveAction || notes || `${resolutionType} for ${disruption.disruptionType.toLowerCase()}.`,
      laneCode: lane.laneCode,
      resolvedByName: currentUserName,
      resolvedByRole: currentUserRole,
    });
    setResolving(false);

    if (result.success && resolutionType !== 'Resolved - Other') {
      // Part 1: a carrier replaced/extended is a real carrier-assignment change — recompute the
      // lane's composite risk from every leg's known risk score (route/mode are unchanged by a
      // carrier swap, so this mostly confirms the risk honestly rather than manufacturing a
      // drop, per the resolved-vs-transferring split below).
      const previousLevel = getEffectiveRiskLevel(lane);
      const legScores = legs.map((l) => l.legRiskScore).filter((s): s is number => s != null);
      const recomputed = recomputeLaneRiskFromLegScores(legScores);
      onRiskUpdated(lane.id, recomputed);
      const carrierName = newCarrierId ? carriers.find((c) => c.id === newCarrierId)?.name ?? 'the assigned carrier' : disruptedLeg?.carrierId ? carriers.find((c) => c.id === disruptedLeg.carrierId)?.name ?? 'the existing carrier' : 'the existing carrier';
      setResolveMessage(`${result.message} ${resolutionMessage(previousLevel, recomputed, carrierName)}`);
    } else {
      setResolveMessage(result.message);
    }

    if (result.success) {
      setResolutionMode('none');
      onResolved();
    }
  };

  const handleUploadDoc = async (file: File) => {
    setUploadingDoc(true);
    const result = await uploadTransferDocument(disruption.id, disruption.legId, file, 'Legal Transfer Authorization', currentUserId);
    setUploadingDoc(false);
    if (result.success) {
      fetchTransferDocuments(disruption.id).then((docs) => docs && setTransferDocs(docs));
    }
  };

  const statusColor = disruption.status === 'Reported'
    ? t.light ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
    : t.light ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300';
  const dividerClass = t.light ? 'border-slate-300/70' : 'border-white/10';
  const fieldClass = `w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-[11px] ${t.textPrimary}`;

  return (
    <div className={`p-3 rounded-xl border ${statusColor}`}>
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div>
          <div className="text-xs font-bold">{disruption.disruptionType}</div>
          <div className="text-[10px] opacity-80">
            Leg {disruptedLeg?.legSequence ?? '?'}: {disruptedLeg ? `${disruptedLeg.originPortCode} → ${disruptedLeg.destinationPortCode}` : disruption.legId} · reported {new Date(disruption.reportedAt).toLocaleString()}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.light ? 'bg-black/10' : 'bg-black/20'}`}>{disruption.status}</span>
      </div>

      <p className={`text-[11px] mt-1.5 ${t.light ? 'text-slate-700' : 'text-slate-300'}`}>{disruption.description}</p>

      {disruption.capaId && (
        <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${t.light ? 'text-slate-600' : 'text-slate-400'}`}>
          <FileText className="w-3 h-3" /> CAPA: {disruption.capaId}
        </div>
      )}

      {!isOpen && disruption.resolutionNotes && (
        <div className={`mt-2 pt-2 border-t text-[11px] ${dividerClass} ${t.light ? 'text-slate-700' : 'text-slate-300'}`}>
          <CheckCircle2 className={`w-3.5 h-3.5 inline mr-1 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
          {disruption.resolutionNotes}
        </div>
      )}

      {isOpen && (
        <div className={`mt-2.5 pt-2.5 border-t space-y-2 ${dividerClass}`}>
          {resolutionMode === 'none' && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setResolutionMode('replace')}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${
                  t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/30'
                }`}
              >
                <Repeat className="w-3 h-3" /> Replace Carrier
              </button>
              {canExtend && (
                <button
                  onClick={() => setResolutionMode('extend')}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${
                    t.light ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" /> Extend Contract (Same Carrier)
                </button>
              )}
              <button
                onClick={() => setResolutionMode('other')}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border ${
                  t.light ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300' : 'bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 border-slate-600/40'
                }`}
              >
                Mark Resolved (Other)
              </button>
            </div>
          )}

          {resolutionMode === 'replace' && (
            <div className="space-y-1.5">
              <div className={`text-[10px] ${t.light ? 'text-slate-600' : 'text-slate-400'}`}>
                Replaces the carrier on {affectedLegs.length} remaining leg{affectedLegs.length === 1 ? '' : 's'} still assigned to the disrupted carrier, ranked by the same route-aware recommendation engine used when the lane was created.
              </div>
              <select
                value={pickedCarrierId}
                onChange={(e) => setPickedCarrierId(e.target.value)}
                className={fieldClass}
              >
                <option value="" disabled>Select a replacement carrier</option>
                {carrierRecommendations.map((r) => (
                  <option key={r.carrier.id} value={r.carrier.id}>
                    {r.carrier.name} — match {r.score}/100
                  </option>
                ))}
              </select>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Resolution notes / corrective action for the CAPA…"
                className={fieldClass}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleResolve('Resolved - Carrier Replaced')}
                  disabled={resolving || !pickedCarrierId}
                  className="flex-1 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold disabled:opacity-40"
                >
                  {resolving ? 'Saving…' : 'Confirm Replacement'}
                </button>
                <button onClick={() => setResolutionMode('none')} className={`px-3 py-1.5 rounded-lg text-[11px] ${t.chipBg} ${t.textSecondary}`}>Cancel</button>
              </div>
            </div>
          )}

          {resolutionMode === 'extend' && (
            <div className="space-y-1.5">
              {existingCert && (
                <div className={`text-[10px] rounded-lg p-2 border ${t.light ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'}`}>
                  Using certification already on file for {existingCert.carrierName}, verified {existingCert.reviewedAt ? new Date(existingCert.reviewedAt).toLocaleDateString() : new Date(existingCert.uploadedAt).toLocaleDateString()}. No re-upload needed.
                </div>
              )}
              <div className={`text-[10px] ${t.light ? 'text-slate-600' : 'text-slate-400'}`}>Optionally attach a transfer/customs document for this specific event.</div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id={`transfer-doc-${disruption.id}`}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUploadDoc(e.target.files[0])}
                />
                <label
                  htmlFor={`transfer-doc-${disruption.id}`}
                  className={`text-[10px] font-bold px-2 py-1 rounded border flex items-center gap-1 cursor-pointer ${t.chipBg} ${t.hoverBg} ${t.textSecondary} ${t.light ? 'border-slate-300' : 'border-slate-700'}`}
                >
                  <UploadCloud className="w-3 h-3" /> {uploadingDoc ? 'Uploading…' : 'Upload Document'}
                </label>
                {transferDocs.length > 0 && <span className={`text-[10px] ${t.textFaint}`}>{transferDocs.length} document(s) attached</span>}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Resolution notes / corrective action for the CAPA…"
                className={fieldClass}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleResolve('Resolved - Contract Extended')}
                  disabled={resolving}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-40"
                >
                  {resolving ? 'Saving…' : 'Confirm Extension'}
                </button>
                <button onClick={() => setResolutionMode('none')} className={`px-3 py-1.5 rounded-lg text-[11px] ${t.chipBg} ${t.textSecondary}`}>Cancel</button>
              </div>
            </div>
          )}

          {resolutionMode === 'other' && (
            <div className="space-y-1.5">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="How was this resolved?"
                className={fieldClass}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleResolve('Resolved - Other')}
                  disabled={resolving || !notes.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-[11px] font-bold disabled:opacity-40"
                >
                  {resolving ? 'Saving…' : 'Confirm Resolution'}
                </button>
                <button onClick={() => setResolutionMode('none')} className={`px-3 py-1.5 rounded-lg text-[11px] ${t.chipBg} ${t.textSecondary}`}>Cancel</button>
              </div>
            </div>
          )}

          {resolveMessage && (
            <p className={`text-[10px] px-2 py-1.5 rounded-lg border ${
              resolveMessage.includes('Resolved —')
                ? t.light ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                : resolveMessage.includes('Transferring to')
                  ? t.light ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-teal-950/30 border-teal-800/50 text-teal-300'
                  : `border-transparent ${t.textFaint}`
            }`}>
              {resolveMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
