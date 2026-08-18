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
}

/**
 * Simple mode's plain-language stand-in for the Advanced three-way comparison grid: one route,
 * one carrier, stated directly. The backup shown here is the route's second-best carrier — a
 * real, meaningful alternative even when there are no user-added stops (the common case once
 * Simple mode hides multi-stop editing), rather than a second full route that would render
 * identically to the first with nothing to differentiate it.
 */
export const SimpleRouteRecommendation: React.FC<SimpleRouteRecommendationProps> = ({ options, backupMode }) => {
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
        <p className={`text-sm ${t.textSecondary}`}>
          Carrier: <strong className={t.textPrimary}>{recommended.legs[0].topCarrierPick.carrier.name}</strong>
          {(recommended.legs[0].carrierRecommendations[1] || backupMode) && (
            <span className={`block text-xs mt-1 ${t.textMuted}`}>
              {recommended.legs[0].carrierRecommendations[1] && (
                <>Backup carrier: <strong className={t.textSecondary}>{recommended.legs[0].carrierRecommendations[1].carrier.name}</strong> ({recommended.mode})</>
              )}
              {recommended.legs[0].carrierRecommendations[1] && backupMode && <span className="mx-1.5">·</span>}
              {backupMode && (
                <>Backup mode: <strong className={t.textSecondary}>{backupMode.mode}</strong>{backupMode.carrierName ? ` via ${backupMode.carrierName}` : ''}</>
              )}
            </span>
          )}
        </p>
      )}

      <div className={`mt-3 pt-3 border-t flex items-center gap-4 text-xs ${t.light ? 'border-emerald-200' : 'border-emerald-900/40'} ${t.textMuted}`}>
        <span>{recommended.totalDistanceKm.toLocaleString()} km</span>
        <span>Risk: {recommended.totalRiskScore}%</span>
      </div>
    </div>
  );
};
