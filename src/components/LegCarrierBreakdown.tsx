import React, { useState } from 'react';
import { ArrowRight, Sparkles, Truck, Plane, Ship, Train, ChevronDown, PackageCheck } from 'lucide-react';
import { Carrier, CarrierCertificationStatus } from '../types';
import { LegMode, LegRecommendation } from '../utils/legRecommendation';
import { legsAreUnified } from '../utils/legRecommendation';
import { CertificationGate } from './CertificationGate';
import { useThemeTokens } from '../contexts/ViewModeContext';

const MODE_ICON: Record<LegMode, React.ComponentType<{ className?: string }>> = {
  Air: Plane,
  Sea: Ship,
  Road: Truck,
  Rail: Train,
};

const MODES: LegMode[] = ['Air', 'Sea', 'Road', 'Rail'];

interface LegCarrierBreakdownProps {
  legs: LegRecommendation[];
  carriers: Carrier[];
  certStatusByCarrierId: Map<string, CarrierCertificationStatus['certificationStatus']>;
  /** Which carrier is actually assigned to each leg right now — keyed by legSequence. Falls
   *  back to that leg's top recommendation when unset. */
  assignedCarrierId: Record<number, string | null>;
  assignedMode: Record<number, LegMode>;
  onCarrierChange: (legSequence: number, carrierId: string) => void;
  onModeChange: (legSequence: number, mode: LegMode) => void;
  currentUserId: string;
  onAnyLegBlocked?: (blocked: boolean) => void;
}

export const LegCarrierBreakdown: React.FC<LegCarrierBreakdownProps> = ({
  legs,
  carriers,
  certStatusByCarrierId,
  assignedCarrierId,
  assignedMode,
  onCarrierChange,
  onModeChange,
  currentUserId,
  onAnyLegBlocked,
}) => {
  const t = useThemeTokens();
  const [forceExpanded, setForceExpanded] = useState(false);
  const blockedLegs = React.useRef<Set<number>>(new Set());

  const resolvedCarrierFor = (legSeq: number, legTopPick: string | null) => assignedCarrierId[legSeq] ?? legTopPick;
  const resolvedModeFor = (legSeq: number, legDefaultMode: LegMode) => assignedMode[legSeq] ?? legDefaultMode;

  const unified =
    !forceExpanded &&
    legsAreUnified(
      legs.map((l) => ({
        mode: resolvedModeFor(l.legSequence, l.mode),
        carrierId: resolvedCarrierFor(l.legSequence, l.topCarrierPick?.carrier.id ?? null),
      }))
    );

  const findCarrier = (id: string | null) => (id ? carriers.find((c) => c.id === id) ?? null : null);

  const reportLegBlocked = (legSeq: number, blocked: boolean) => {
    if (blocked) blockedLegs.current.add(legSeq);
    else blockedLegs.current.delete(legSeq);
    onAnyLegBlocked?.(blockedLegs.current.size > 0);
  };

  if (legs.length === 0) return null;

  const selectClass = `${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1 text-[11px] ${t.textSecondary}`;

  if (unified) {
    const leg = legs[0];
    const carrierId = resolvedCarrierFor(leg.legSequence, leg.topCarrierPick?.carrier.id ?? null);
    const mode = resolvedModeFor(leg.legSequence, leg.mode);
    const carrier = findCarrier(carrierId);
    const Icon = MODE_ICON[mode];
    const status = carrierId ? certStatusByCarrierId.get(carrierId) : undefined;

    return (
      <div className={`p-3 rounded-xl ${t.cardBgSunken} border ${t.border}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${t.light ? 'bg-teal-100 text-teal-600' : 'bg-teal-500/15 text-teal-400'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-bold truncate ${t.textPrimary}`}>
                {carrier?.name ?? 'Select a carrier'} — {mode}, start to end
              </div>
              <div className={`text-[10px] ${t.textFaint}`}>
                {legs[0].origin.iata} → {legs[legs.length - 1].destination.iata} · one carrier, one mode across {legs.length} leg{legs.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForceExpanded(true)}
            className={`text-[10px] font-semibold underline flex items-center gap-1 flex-shrink-0 ${t.light ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'}`}
          >
            Edit per leg <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        {carrierId && status && (
          <CertificationGate
            carrierId={carrierId}
            carrierName={carrier?.name ?? 'this carrier'}
            status={status}
            uploadedById={currentUserId}
            onBlockedChange={(blocked) => reportLegBlocked(0, blocked)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {forceExpanded && (
        <button type="button" onClick={() => setForceExpanded(false)} className={`text-[10px] font-semibold underline ${t.light ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'}`}>
          Collapse back to a single carrier (if all legs match)
        </button>
      )}
      {legs.map((leg) => {
        const carrierId = resolvedCarrierFor(leg.legSequence, leg.topCarrierPick?.carrier.id ?? null);
        const mode = resolvedModeFor(leg.legSequence, leg.mode);
        const status = carrierId ? certStatusByCarrierId.get(carrierId) : undefined;
        const eligibleCarriers = leg.carrierRecommendations;

        return (
          <div key={leg.legSequence} className={`p-3 rounded-xl ${t.cardBgSunken} border ${t.border} space-y-2`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className={`px-1.5 py-0.5 rounded ${t.chipBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} ${t.textSecondary}`}>{leg.origin.iata}</span>
                <ArrowRight className={`w-3 h-3 ${t.textFaint}`} />
                <span className={`px-1.5 py-0.5 rounded ${t.chipBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} ${t.textSecondary}`}>{leg.destination.iata}</span>
                {leg.riskScore != null && (
                  <span className={`ml-1 text-[10px] ${t.textFaint}`}>Leg risk {leg.riskScore}% ({leg.riskLevel})</span>
                )}
              </div>
              <select
                value={mode}
                onChange={(e) => onModeChange(leg.legSequence, e.target.value as LegMode)}
                className={selectClass}
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <select
              value={carrierId ?? ''}
              onChange={(e) => onCarrierChange(leg.legSequence, e.target.value)}
              className={`w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-[11px] ${t.textPrimary}`}
            >
              <option value="" disabled>Select a carrier for this leg</option>
              {eligibleCarriers.map((c) => (
                <option key={c.carrier.id} value={c.carrier.id}>
                  {c.carrier.name} — match {c.score}/100
                </option>
              ))}
            </select>

            {leg.topCarrierPick && carrierId !== leg.topCarrierPick.carrier.id && (
              <div className={`flex items-start gap-1.5 text-[10px] ${t.light ? 'text-teal-600' : 'text-teal-300'}`}>
                <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>
                  Recommended: {leg.topCarrierPick.carrier.name} ({leg.topCarrierPick.reasons.join(' · ')}) —{' '}
                  <button type="button" onClick={() => onCarrierChange(leg.legSequence, leg.topCarrierPick!.carrier.id)} className="underline font-semibold">
                    use this
                  </button>
                </span>
              </div>
            )}

            {carrierId && status && (
              <CertificationGate
                carrierId={carrierId}
                carrierName={findCarrier(carrierId)?.name ?? 'this carrier'}
                status={status}
                uploadedById={currentUserId}
                onBlockedChange={(blocked) => reportLegBlocked(leg.legSequence, blocked)}
              />
            )}
          </div>
        );
      })}
      <div className={`flex items-center gap-1.5 text-[10px] pt-0.5 ${t.textFaint}`}>
        <PackageCheck className="w-3 h-3" /> {legs.length} legs, mixed carriers/modes across this route.
      </div>
    </div>
  );
};
