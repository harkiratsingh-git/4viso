import React from 'react';
import {
  Radio,
  AlertOctagon,
  ThermometerSnowflake,
  TrendingUp,
  Boxes,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { TransportLane } from '../types';
import { formatCurrency } from '../utils/formatters';
import { isLaneExcursing, isLaneHighRisk, getEffectiveRiskLevel } from '../utils/laneRisk';
import { DashboardSummary } from '../services/supabaseService';

interface KpiOverviewProps {
  lanes: TransportLane[];
  /** When connected to Supabase, the real dashboard_summary view — the single source every
   *  card should agree with. Null when offline/local, in which case the same numbers are
   *  derived client-side from `lanes` using the same effective-risk logic used everywhere
   *  else in the app, so the two paths can never disagree with each other either. */
  summary: DashboardSummary | null;
  onSelectFilter: (filterKey: string, value: any) => void;
}

/**
 * Narrow vertical stack of stat cards, ordered by importance top to bottom — designed to sit
 * in the dashboard's ~280px left column next to the large map, not as a full-width row.
 */
export const KpiOverview: React.FC<KpiOverviewProps> = ({ lanes, summary, onSelectFilter }) => {
  const totalLanes = summary?.totalLanes ?? lanes.length;
  const activeLanes = summary?.activeLanes ?? lanes.filter(l => l.status === 'In Transit' || l.status === 'Active').length;
  const highRiskLanes = summary?.highRiskLanes ?? lanes.filter(isLaneHighRisk).length;
  const criticalRiskLanes = lanes.filter(l => getEffectiveRiskLevel(l) === 'Critical').length;
  const avgGdpCompliance = (summary?.avgGdpCompliance ?? (totalLanes > 0 ? lanes.reduce((acc, l) => acc + l.gdpComplianceRate, 0) / totalLanes : 0)).toFixed(1);
  // dashboard_summary's active_excursions has been verified live to be unreliable — it stays
  // 0 regardless of risk_level, status, or current_temp on the underlying rows, so unlike the
  // other cards here it can't be trusted even after reconciling the columns it does read
  // correctly (see App.tsx's reconcileLaneRiskWithSupabase). Always compute this one straight
  // from live lane data instead, so it can never again show 0 while the Lane table and map
  // both show real excursions.
  const tempDeviations = lanes.filter(isLaneExcursing).length;
  const totalValue = summary?.payloadInTransitUsd ?? lanes.reduce((acc, l) => acc + l.payloadValueUsd, 0);
  const unresolvedCritical = summary?.unresolvedCriticalAlerts ?? criticalRiskLanes;

  const hasRiskIssue = highRiskLanes > 0 || unresolvedCritical > 0;

  return (
    <div className="space-y-3">

      {/* High-Risk Lanes — first, largest, and the only card sized/colored to stand out (Von Restorff) */}
      <div
        onClick={() => onSelectFilter('riskSeverity', 'High')}
        className={`p-4 rounded-xl shadow-md transition-all cursor-pointer group border ${
          hasRiskIssue
            ? 'bg-rose-950/30 border-rose-800/50 hover:border-rose-700/70'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">High-Risk Lanes</span>
          <div className={`p-1.5 rounded-lg ${hasRiskIssue ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-4xl font-extrabold tracking-tight ${hasRiskIssue ? 'text-rose-400' : 'text-slate-200'}`}>{highRiskLanes}</span>
          {unresolvedCritical > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
              {unresolvedCritical} unresolved critical
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
          <span className={hasRiskIssue ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
            {hasRiskIssue ? 'Requires attention' : 'All lanes nominal'}
          </span>
          <span className="text-slate-500 group-hover:text-rose-300 transition-colors flex items-center gap-0.5">
            Inspect <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Fleet Health group — proximity + common region reads these as "how is the fleet doing" */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-3 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">Fleet Health</div>

        <div
          onClick={() => onSelectFilter('mode', 'All')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Lanes</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tracking-tight">{activeLanes}</span>
            <span className="text-xs text-slate-400 font-medium">/ {totalLanes} Total</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-emerald-400 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> 100% Monitored
            </span>
          </div>
        </div>

        <div
          onClick={() => onSelectFilter('gdpStatus', 'Compliant')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-900/50 p-3.5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">GDP Compliance</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20 transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-teal-400 tracking-tight">{avgGdpCompliance}%</span>
            <span className="text-[11px] text-slate-500">12-week rolling</span>
          </div>
        </div>
      </div>

      {/* Urgency & Value group — separate region so the eye reads these as a different question */}
      <div className="bg-slate-900/30 border border-slate-800/40 rounded-2xl p-3 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">Urgency &amp; Value</div>

        <div
          onClick={() => onSelectFilter('tempStatus', 'Excursion')}
          className={`p-3.5 rounded-xl transition-all cursor-pointer group border ${
            tempDeviations > 0 ? 'bg-amber-950/25 border-amber-800/50' : 'bg-slate-900/80 border-slate-800 hover:border-amber-900/50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Temp Deviations</span>
            <div className={`p-1.5 rounded-lg ${tempDeviations > 0 ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              <ThermometerSnowflake className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold tracking-tight ${tempDeviations > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {tempDeviations}
            </span>
            <span className="text-xs text-slate-400 font-medium">Active Excursions</span>
          </div>
        </div>

        {/* Monitored Payload Value — informational, deliberately the calmest card on the board */}
        <div className="bg-slate-900/60 border border-slate-800/60 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payload In Transit</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-slate-100 tracking-tight">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">{totalLanes} Batches · Critical Biologics</div>
        </div>
      </div>

    </div>
  );
};
