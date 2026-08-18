import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Sparkles, Wand2, Route as RouteIcon } from 'lucide-react';
import { Carrier, CarrierPerformanceSummary, TemperatureRangeType, TransportMode } from '../types';
import { PortEntry, recommendStops, recommendTransportMode } from '../utils/ports';
import { alongTrackDistanceKm, haversineKm } from '../utils/geoMath';
import { FixedWaypoint, insertRecommendedGapStops } from '../utils/routeComparison';
import { computeLegRecommendations, LegRecommendation } from '../utils/legRecommendation';
import { getRiskColor } from '../utils/formatters';

export type RouteOptionType = 'user_edited' | 'recommended' | 'recommended_from_edit';

export interface ComputedRouteOption {
  type: RouteOptionType;
  title: string;
  waypoints: FixedWaypoint[];
  mode: TransportMode;
  legs: LegRecommendation[];
  totalDistanceKm: number;
  totalRiskScore: number;
  avgCarrierScore: number;
}

interface ThreeWayRouteComparisonProps {
  origin: FixedWaypoint;
  destination: FixedWaypoint;
  userStops: FixedWaypoint[];
  mode: TransportMode;
  tempMin: number;
  tempMax: number;
  tempRangeType: TemperatureRangeType;
  productCategory: string;
  ports: PortEntry[];
  carriers: Carrier[];
  performanceByCarrierId: Map<string, CarrierPerformanceSummary>;
  selected: RouteOptionType;
  onSelect: (type: RouteOptionType) => void;
  /** Fires whenever any option finishes (re)computing, so the parent wizard always has the
   *  current three options on hand to persist to lane_route_options at finish time. */
  onOptionsComputed: (options: ComputedRouteOption[]) => void;
}

function totalDistance(waypoints: FixedWaypoint[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) total += haversineKm(waypoints[i].coords, waypoints[i + 1].coords);
  return Math.round(total);
}

async function buildOption(
  type: RouteOptionType,
  title: string,
  waypoints: FixedWaypoint[],
  mode: TransportMode,
  tempRangeType: TemperatureRangeType,
  carriers: Carrier[],
  performanceByCarrierId: Map<string, CarrierPerformanceSummary>
): Promise<ComputedRouteOption> {
  const legs = await computeLegRecommendations(waypoints, mode, tempRangeType, carriers, performanceByCarrierId);
  const totalRiskScore = legs.length ? Math.round(legs.reduce((sum, l) => sum + (l.riskScore ?? 0), 0) / legs.length) : 0;
  const scored = legs.filter((l) => l.topCarrierPick);
  const avgCarrierScore = scored.length ? Math.round(scored.reduce((sum, l) => sum + (l.topCarrierPick?.score ?? 0), 0) / scored.length) : 0;
  return { type, title, waypoints, mode, legs, totalDistanceKm: totalDistance(waypoints), totalRiskScore, avgCarrierScore };
}

const OPTION_ACCENT: Record<RouteOptionType, { ring: string; text: string; bg: string }> = {
  user_edited: { ring: 'ring-emerald-500/50 border-emerald-600/60', text: 'text-emerald-400', bg: 'bg-emerald-950/20' },
  recommended: { ring: 'ring-teal-500/50 border-teal-600/60', text: 'text-teal-400', bg: 'bg-teal-950/20' },
  recommended_from_edit: { ring: 'ring-purple-500/50 border-purple-600/60', text: 'text-purple-400', bg: 'bg-purple-950/20' },
};

export const ThreeWayRouteComparison: React.FC<ThreeWayRouteComparisonProps> = ({
  origin,
  destination,
  userStops,
  mode,
  tempMin,
  tempMax,
  tempRangeType,
  productCategory,
  ports,
  carriers,
  performanceByCarrierId,
  selected,
  onSelect,
  onOptionsComputed,
}) => {
  const [options, setOptions] = useState<ComputedRouteOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fromScratchStops = useMemo(() => {
    const recs = recommendStops(origin.coords, destination.coords, origin.iata, destination.iata, tempMin, tempMax, ports, mode, 2);
    return [...recs]
      .sort((a, b) => alongTrackDistanceKm(a.port.coords, origin.coords, destination.coords) - alongTrackDistanceKm(b.port.coords, origin.coords, destination.coords))
      .map((r): FixedWaypoint => ({ iata: r.port.code, city: r.port.city, country: r.port.country, coords: r.port.coords }));
  }, [origin, destination, tempMin, tempMax, ports, mode]);

  const recommendedMode = useMemo(
    () => recommendTransportMode(origin.coords, destination.coords, tempMin, tempMax, productCategory, ports).mode,
    [origin, destination, tempMin, tempMax, productCategory, ports]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const userWaypoints = [origin, ...userStops, destination];
    const recommendedWaypoints = [origin, ...fromScratchStops, destination];
    const fixedFromUser = [origin, ...userStops, destination];
    const recommendedFromEditWaypoints = insertRecommendedGapStops(fixedFromUser, tempMin, tempMax, ports, mode);

    Promise.all([
      buildOption('user_edited', 'Your Route', userWaypoints, mode, tempRangeType, carriers, performanceByCarrierId),
      buildOption('recommended', 'Recommended', recommendedWaypoints, recommendedMode, tempRangeType, carriers, performanceByCarrierId),
      buildOption('recommended_from_edit', 'Recommended From Your Edit', recommendedFromEditWaypoints, mode, tempRangeType, carriers, performanceByCarrierId),
    ]).then((computed) => {
      if (cancelled) return;
      setOptions(computed);
      setLoading(false);
      onOptionsComputed(computed);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, userStops, mode, tempMin, tempMax, tempRangeType, productCategory, ports, carriers, performanceByCarrierId, fromScratchStops, recommendedMode]);

  if (loading || !options) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" /> Computing route options…
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
        <RouteIcon className="w-3.5 h-3.5" /> Route Comparison
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {options.map((opt) => {
          const accent = OPTION_ACCENT[opt.type];
          const isSelected = selected === opt.type;
          const riskStyles = getRiskColor(opt.totalRiskScore >= 40 ? 'High' : opt.totalRiskScore >= 20 ? 'Medium' : 'Low');
          return (
            <div key={opt.type} className={`p-3.5 rounded-xl border bg-slate-950/70 space-y-2.5 ${isSelected ? `ring-1 ${accent.ring}` : 'border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${accent.text} flex items-center gap-1`}>
                  {opt.type === 'recommended' && <Sparkles className="w-3 h-3" />}
                  {opt.type === 'recommended_from_edit' && <Wand2 className="w-3 h-3" />}
                  {opt.title}
                </span>
                {isSelected && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Selected
                  </span>
                )}
              </div>

              <div className="flex items-center flex-wrap gap-1 text-[11px] font-mono">
                {opt.waypoints.map((w, i) => (
                  <React.Fragment key={`${w.iata}-${i}`}>
                    {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                    <span className={`px-1.5 py-0.5 rounded border ${
                      i === 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                      i === opt.waypoints.length - 1 ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>{w.iata}</span>
                  </React.Fragment>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-500">Mode</div>
                  <div className="font-bold text-slate-200">{opt.mode}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-500">Distance</div>
                  <div className="font-bold text-slate-200">{opt.totalDistanceKm.toLocaleString()} km</div>
                </div>
                <div className={`p-2 rounded-lg border ${riskStyles.bg} ${riskStyles.border}`}>
                  <div className="text-slate-500">Avg Leg Risk</div>
                  <div className={`font-bold ${riskStyles.text}`}>{opt.totalRiskScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-500">Carrier Match</div>
                  <div className="font-bold text-slate-200">{opt.avgCarrierScore || '—'}</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500">
                {opt.legs.length} leg{opt.legs.length === 1 ? '' : 's'} · top pick{opt.legs.length === 1 ? '' : 's'}: {[...new Set(opt.legs.map((l) => l.topCarrierPick?.carrier.name).filter(Boolean))].join(', ') || 'none eligible'}
              </div>

              <button
                type="button"
                onClick={() => onSelect(opt.type)}
                className={`w-full min-h-[36px] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  isSelected ? 'bg-slate-800 text-slate-300 cursor-default' : `${accent.bg} hover:brightness-125 ${accent.text} border ${accent.ring.split(' ')[1]}`
                }`}
                disabled={isSelected}
              >
                {isSelected ? 'Using this route' : `Use "${opt.title}"`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
