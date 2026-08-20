import React from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { ComputedRouteOption } from './ThreeWayRouteComparison';
import { useThemeTokens } from '../contexts/ViewModeContext';
import { BackupModeRecommendation } from '../utils/ports';

export interface BackupModeInfo extends BackupModeRecommendation {
  carrierName: string | null;
}

interface SimpleRouteRecommendationProps {
  options: ComputedRouteOption[] | null;
  /** A genuinely viable alternate transport mode for this route (e.g. Sea as a fallback for an
   *  Air lane), computed separately from the same-mode backup carrier below. Null when no
   *  reasonable alternate mode exists for this route — never force one just to fill the field. */
  backupMode?: BackupModeInfo | null;
  /** Part 2: both backups are real one-click actions, not just descriptive text — clicking
   *  either actually applies the swap to the draft lane being built. */
  onUseBackupCarrier?: () => void;
  onUseBackupMode?: () => void;
}

/**
 * Simple mode's plain-language stand-in for the Advanced three-way comparison grid: one route,
 * one carrier, stated directly. The backup shown here is the route's second-best carrier — a
 * real, meaningful alternative even when there are no user-added stops (the common case once
 * Simple mode hides multi-stop editing), rather than a second full route that would render
 * identically to the first with nothing to differentiate it.
 */
export const SimpleRouteRecommendation: React.FC<SimpleRouteRecommendationProps> = ({ options, backupMode, onUseBackupCarrier, onUseBackupMode }) => {
  const t = useThemeTokens();
  const recommended = options?.find((o) => o.type === 'recommended');

  if (!recommended) {
    return (
      <div className={`p-5 rounded-xl border flex items-center gap-2 text-xs ${t.cardBgSunken} ${t.border} ${t.textMuted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Working out the best route…
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border ${t.light ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/20 border-emerald-800/50'}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>
        <ShieldCheck className="w-3.5 h-3.5" /> We recommend this route
      </div>

      <div className="flex items-center flex-wrap gap-1 text-sm font-mono mb-3">
        {recommended.waypoints.map((w, i) => (
          <React.Fragment key={`${w.iata}-${i}`}>
            {i > 0 && <ArrowRight className={`w-3.5 h-3.5 ${t.light ? 'text-slate-400' : 'text-slate-600'}`} />}
            <span className={`px-2 py-0.5 rounded border ${t.light ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'}`}>{w.iata}</span>
          </React.Fragment>
        ))}
      </div>

      {recommended.legs[0]?.topCarrierPick && (
        <div className={`text-sm ${t.textSecondary}`}>
          Carrier: <strong className={t.textPrimary}>{recommended.legs[0].topCarrierPick.carrier.name}</strong>
          {(recommended.legs[0].carrierRecommendations[1] || backupMode) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {recommended.legs[0].carrierRecommendations[1] && (
                <button
                  type="button"
                  onClick={onUseBackupCarrier}
                  disabled={!onUseBackupCarrier}
                  className={`text-xs px-2 py-1 rounded-lg border font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    t.light ? 'bg-white hover:bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-900/60 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  Use backup carrier: {recommended.legs[0].carrierRecommendations[1].carrier.name} ({recommended.mode})
                </button>
              )}
              {backupMode && (
                <button
                  type="button"
                  onClick={onUseBackupMode}
                  disabled={!onUseBackupMode}
                  className={`text-xs px-2 py-1 rounded-lg border font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    t.light ? 'bg-white hover:bg-teal-100 text-teal-700 border-teal-300' : 'bg-slate-900/60 hover:bg-teal-500/20 text-teal-300 border-teal-500/30'
                  }`}
                  title={backupMode.reason}
                >
                  Use backup mode: {backupMode.mode}{backupMode.carrierName ? ` via ${backupMode.carrierName}` : ''}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`mt-3 pt-3 border-t flex items-center gap-4 text-xs ${t.light ? 'border-emerald-200' : 'border-emerald-900/40'} ${t.textMuted}`}>
        <span>{recommended.totalDistanceKm.toLocaleString()} km</span>
        <span>Risk: {recommended.totalRiskScore}%</span>
      </div>
    </div>
  );
};
