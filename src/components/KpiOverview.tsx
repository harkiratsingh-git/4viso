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

export const KpiOverview: React.FC<KpiOverviewProps> = ({ lanes, summary, onSelectFilter }) => {
  const totalLanes = summary?.totalLanes ?? lanes.length;
  const activeLanes = summary?.activeLanes ?? lanes.filter(l => l.status === 'In Transit' || l.status === 'Active').length;
  const highRiskLanes = summary?.highRiskLanes ?? lanes.filter(isLaneHighRisk).length;
  const criticalRiskLanes = lanes.filter(l => getEffectiveRiskLevel(l) === 'Critical').length;
  const avgGdpCompliance = (summary?.avgGdpCompliance ?? (totalLanes > 0 ? lanes.reduce((acc, l) => acc + l.gdpComplianceRate, 0) / totalLanes : 0)).toFixed(1);
  const tempDeviations = summary?.activeExcursions ?? lanes.filter(isLaneExcursing).length;
  const totalValue = summary?.payloadInTransitUsd ?? lanes.reduce((acc, l) => acc + l.payloadValueUsd, 0);
  const unresolvedCritical = summary?.unresolvedCriticalAlerts ?? criticalRiskLanes;

  const hasRiskIssue = highRiskLanes > 0 || unresolvedCritical > 0;

  return (
    <div className="space-y-3 mb-6">

      {/* Cluster A: Fleet Health — proximity + common region groups these 3 as "how is the fleet doing" */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1 mb-2">Fleet Health</div>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">

          {/* High-Risk Lanes — top-left, largest tile: the single most important number (F-pattern) */}
          <div
            onClick={() => onSelectFilter('riskSeverity', 'High')}
            className={`sm:col-span-3 p-4 rounded-xl shadow-md transition-all cursor-pointer group border ${
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
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-extrabold tracking-tight ${hasRiskIssue ? 'text-rose-400' : 'text-slate-200'}`}>{highRiskLanes}</span>
              {unresolvedCritical > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {unresolvedCritical} unresolved critical alert{unresolvedCritical > 1 ? 's' : ''}
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

          {/* Active Lanes */}
          <div
            onClick={() => onSelectFilter('mode', 'All')}
            className="sm:col-span-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-xl shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Lanes</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">{activeLanes}</span>
              <span className="text-xs text-slate-400 font-medium">/ {totalLanes} Total</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> 100% Monitored
              </span>
              <span className="text-slate-500">Air, Sea, Road</span>
            </div>
          </div>

          {/* GDP Compliance */}
          <div
            onClick={() => onSelectFilter('gdpStatus', 'Compliant')}
            className="sm:col-span-1 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-900/50 p-4 rounded-xl shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">GDP</span>
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20 transition-colors">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-teal-400 tracking-tight">{avgGdpCompliance}%</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              12-Week Rolling
            </div>
          </div>

        </div>
      </div>

      {/* Cluster B: Urgency & Value — separate region so the eye reads these as a different question */}
      <div className="bg-slate-900/30 border border-slate-800/40 rounded-2xl p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1 mb-2">Urgency &amp; Value</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Temperature Deviations */}
          <div
            onClick={() => onSelectFilter('tempStatus', 'Excursion')}
            className={`p-4 rounded-xl shadow-md transition-all cursor-pointer group border ${
              tempDeviations > 0 ? 'bg-amber-950/25 border-amber-800/50' : 'bg-slate-900/80 border-slate-800 hover:border-amber-900/50'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Temp Deviations</span>
              <div className={`p-1.5 rounded-lg ${tempDeviations > 0 ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                <ThermometerSnowflake className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${tempDeviations > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                {tempDeviations}
              </span>
              <span className="text-xs text-slate-400 font-medium">Active Excursions</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className={tempDeviations > 0 ? 'text-rose-400 font-medium' : 'text-emerald-400'}>
                {tempDeviations > 0 ? 'Excursion in reefer' : 'All probes normal'}
              </span>
              <span className="text-slate-500">Live IoT Feed</span>
            </div>
          </div>

          {/* Monitored Payload Value — informational, deliberately the calmest tile on the board */}
          <div className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payload In Transit</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-100 tracking-tight">
                {formatCurrency(totalValue)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-blue-400 font-medium">Critical Biologics</span>
              <span className="text-slate-500">{totalLanes} Batches</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
