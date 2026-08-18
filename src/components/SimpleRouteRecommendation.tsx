import React from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { ComputedRouteOption } from './ThreeWayRouteComparison';
import { useViewMode } from '../contexts/ViewModeContext';

interface SimpleRouteRecommendationProps {
  options: ComputedRouteOption[] | null;
}

/**
 * Simple mode's plain-language stand-in for the Advanced three-way comparison grid: one route,
 * one carrier, stated directly. The backup shown here is the route's second-best carrier — a
 * real, meaningful alternative even when there are no user-added stops (the common case once
 * Simple mode hides multi-stop editing), rather than a second full route that would render
 * identically to the first with nothing to differentiate it.
 */
export const SimpleRouteRecommendation: React.FC<SimpleRouteRecommendationProps> = ({ options }) => {
  const { theme } = useViewMode();
  const light = theme === 'light';
  const recommended = options?.find((o) => o.type === 'recommended');

  if (!recommended) {
    return (
      <div className={`p-5 rounded-xl border flex items-center gap-2 text-xs ${light ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-950/70 border-slate-800 text-slate-400'}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Working out the best route…
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border ${light ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/50'}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2 ${light ? 'text-emerald-700' : 'text-emerald-400'}`}>
        <ShieldCheck className="w-3.5 h-3.5" /> We recommend this route
      </div>

      <div className="flex items-center flex-wrap gap-1 text-sm font-mono mb-3">
        {recommended.waypoints.map((w, i) => (
          <React.Fragment key={`${w.iata}-${i}`}>
            {i > 0 && <ArrowRight className={`w-3.5 h-3.5 ${light ? 'text-slate-400' : 'text-slate-600'}`} />}
            <span className={`px-2 py-0.5 rounded border ${light ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'}`}>{w.iata}</span>
          </React.Fragment>
        ))}
      </div>

      {recommended.legs[0]?.topCarrierPick && (
        <p className={`text-sm ${light ? 'text-slate-700' : 'text-slate-300'}`}>
          Carrier: <strong className={light ? 'text-slate-900' : 'text-white'}>{recommended.legs[0].topCarrierPick.carrier.name}</strong>
          {recommended.legs[0].carrierRecommendations[1] && (
            <span className={`block text-xs mt-1 ${light ? 'text-slate-500' : 'text-slate-400'}`}>
              A backup option is also available: {recommended.legs[0].carrierRecommendations[1].carrier.name}.
            </span>
          )}
        </p>
      )}

      <div className={`mt-3 pt-3 border-t flex items-center gap-4 text-xs ${light ? 'border-emerald-200 text-slate-500' : 'border-emerald-900/40 text-slate-400'}`}>
        <span>{recommended.totalDistanceKm.toLocaleString()} km</span>
        <span>Risk: {recommended.totalRiskScore}%</span>
      </div>
    </div>
  );
};
