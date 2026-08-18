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
import { useThemeTokens } from '../contexts/ViewModeContext';

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
  const t = useThemeTokens();
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
    <div className="space-y-3">

      {/* High-Risk Lanes — first, largest, and the only card sized/colored to stand out (Von Restorff) */}
      <div
        onClick={() => onSelectFilter('riskSeverity', 'High')}
        className={`p-4 rounded-xl shadow-md transition-all cursor-pointer group border ${
          hasRiskIssue
            ? t.light ? 'bg-rose-50 border-rose-200 hover:border-rose-300' : 'bg-rose-950/30 border-rose-800/50 hover:border-rose-700/70'
            : `${t.cardBg} ${t.border} ${t.hoverBorder}`
        }`}
      >
        <div className={`flex items-center justify-between ${t.textMuted} mb-2`}>
          <span className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>High-Risk Lanes</span>
          <div className={`p-1.5 rounded-lg ${hasRiskIssue ? (t.light ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/15 text-rose-400') : `${t.chipBg} ${t.textFaint}`}`}>
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-4xl font-extrabold tracking-tight ${hasRiskIssue ? (t.light ? 'text-rose-600' : 'text-rose-400') : (t.light ? 'text-slate-700' : 'text-slate-200')}`}>{highRiskLanes}</span>
          {unresolvedCritical > 0 && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold border ${t.light ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
              {unresolvedCritical} unresolved critical
            </span>
          )}
        </div>
        <div className={`mt-2 flex items-center justify-between text-[11px] ${t.textMuted} border-t ${t.borderSubtle} pt-2`}>
          <span className={hasRiskIssue ? (t.light ? 'text-amber-600 font-medium' : 'text-amber-400 font-medium') : (t.light ? 'text-emerald-600 font-medium' : 'text-emerald-400 font-medium')}>
            {hasRiskIssue ? 'Requires attention' : 'All lanes nominal'}
          </span>
          <span className={`${t.textFaint} group-hover:text-rose-400 transition-colors flex items-center gap-0.5`}>
            Inspect <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Fleet Health group — proximity + common region reads these as "how is the fleet doing" */}
      <div className={`${t.cardBgMuted} border ${t.borderSubtle} rounded-2xl p-3 space-y-3`}>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${t.textFaint} px-1`}>Fleet Health</div>

        <div
          onClick={() => onSelectFilter('mode', 'All')}
          className={`${t.cardBg} ${t.hoverBg} border ${t.border} ${t.hoverBorder} p-3.5 rounded-xl transition-all cursor-pointer group`}
        >
          <div className={`flex items-center justify-between ${t.textMuted} mb-1.5`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>Active Lanes</span>
            <div className={`p-1.5 rounded-lg transition-colors ${t.light ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200' : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'}`}>
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold tracking-tight ${t.textPrimary}`}>{activeLanes}</span>
            <span className={`text-xs ${t.textMuted} font-medium`}>/ {totalLanes} Total</span>
          </div>
          <div className={`mt-1.5 flex items-center justify-between text-[11px] ${t.textMuted}`}>
            <span className={`${t.light ? 'text-emerald-600' : 'text-emerald-400'} font-medium flex items-center gap-0.5`}>
              <TrendingUp className="w-3 h-3" /> 100% Monitored
            </span>
          </div>
        </div>

        <div
          onClick={() => onSelectFilter('gdpStatus', 'Compliant')}
          className={`${t.cardBg} ${t.hoverBg} border ${t.border} ${t.light ? 'hover:border-emerald-300' : 'hover:border-emerald-900/50'} p-3.5 rounded-xl transition-all cursor-pointer group`}
        >
          <div className={`flex items-center justify-between ${t.textMuted} mb-1.5`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>GDP Compliance</span>
            <div className={`p-1.5 rounded-lg transition-colors ${t.light ? 'bg-teal-100 text-teal-600 group-hover:bg-teal-200' : 'bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-extrabold tracking-tight ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>{avgGdpCompliance}%</span>
            <span className={`text-[11px] ${t.textFaint}`}>12-week rolling</span>
          </div>
        </div>
      </div>

      {/* Urgency & Value group — separate region so the eye reads these as a different question */}
      <div className={`${t.light ? 'bg-slate-50/60' : 'bg-slate-900/30'} border ${t.borderSubtle} rounded-2xl p-3 space-y-3`}>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${t.textFaint} px-1`}>Urgency &amp; Value</div>

        <div
          onClick={() => onSelectFilter('tempStatus', 'Excursion')}
          className={`p-3.5 rounded-xl transition-all cursor-pointer group border ${
            tempDeviations > 0
              ? t.light ? 'bg-amber-50 border-amber-200' : 'bg-amber-950/25 border-amber-800/50'
              : `${t.cardBg} ${t.border} ${t.light ? 'hover:border-amber-300' : 'hover:border-amber-900/50'}`
          }`}
        >
          <div className={`flex items-center justify-between ${t.textMuted} mb-1.5`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>Temp Deviations</span>
            <div className={`p-1.5 rounded-lg ${tempDeviations > 0 ? (t.light ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-amber-500/20 text-amber-400 animate-pulse') : `${t.chipBg} ${t.textMuted}`}`}>
              <ThermometerSnowflake className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold tracking-tight ${tempDeviations > 0 ? (t.light ? 'text-amber-600' : 'text-amber-400') : (t.light ? 'text-slate-700' : 'text-slate-200')}`}>
              {tempDeviations}
            </span>
            <span className={`text-xs ${t.textMuted} font-medium`}>Active Excursions</span>
          </div>
        </div>

        {/* Monitored Payload Value — informational, deliberately the calmest card on the board */}
        <div className={`${t.light ? 'bg-white/70' : 'bg-slate-900/60'} border ${t.borderSubtle} p-3.5 rounded-xl`}>
          <div className={`flex items-center justify-between ${t.textMuted} mb-1.5`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>Payload In Transit</span>
            <div className={`p-1.5 rounded-lg ${t.light ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-extrabold tracking-tight ${t.light ? 'text-slate-800' : 'text-slate-100'}`}>
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div className={`mt-1.5 text-[11px] ${t.textFaint}`}>{totalLanes} Batches · Critical Biologics</div>
        </div>
      </div>

    </div>
  );
};
