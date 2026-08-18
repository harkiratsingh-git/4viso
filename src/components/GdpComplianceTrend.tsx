import React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Download,
  History
} from 'lucide-react';
import { GDP_TREND_DATA } from '../data/mockData';
import { GdpComplianceSnapshot, CapaRecord } from '../services/supabaseService';
import { useThemeTokens, ThemeTokens } from '../contexts/ViewModeContext';

interface GdpComplianceTrendProps {
  onOpenAuditReport: () => void;
  /** Real daily snapshots from gdp_compliance_snapshots, ordered oldest-first. Null when not
   *  cloud-connected (offline/local demo mode) — the local GDP_TREND_DATA constant is shown
   *  instead in that case, since there's no live table to read from. */
  snapshots: GdpComplianceSnapshot[] | null;
  capaRecords: CapaRecord[];
}

const MIN_HISTORY_FOR_TREND_LINE = 4;

/** SVG grid/text colors read poorly against a white card (they're tuned for the dark slate-950
 *  chart background), so the chart gets its own light palette rather than reusing the hex values
 *  verbatim in both themes. */
function chartColors(t: ThemeTokens) {
  return t.light
    ? { grid: '#cbd5e1', label: '#64748b', line: '#0d9488', dot: '#0d9488', dotLast: '#059669', dotStroke: '#f8fafc' }
    : { grid: '#1e293b', label: '#64748b', line: '#14b8a6', dot: '#14b8a6', dotLast: '#10b981', dotStroke: '#0f172a' };
}

export const GdpComplianceTrend: React.FC<GdpComplianceTrendProps> = ({ onOpenAuditReport, snapshots, capaRecords }) => {
  const t = useThemeTokens();
  if (snapshots === null) {
    return <LocalDemoGdpComplianceTrend onOpenAuditReport={onOpenAuditReport} />;
  }

  const latest = snapshots[snapshots.length - 1];
  const openCapaCount = capaRecords.filter(c => c.status !== 'Closed').length;

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-xl p-4 sm:p-5 shadow-lg mb-6`}>
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b ${t.border}`}>
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${t.light ? 'bg-teal-100 text-teal-600' : 'bg-teal-500/10 text-teal-400'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className={`text-base font-bold ${t.textPrimary}`}>
              GDP Compliance Monitoring & Quality Audit Trails
            </h3>
          </div>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>
            Rolling Compliance Trend & Good Distribution Practice Verification (EU 2013/C 343/01)
          </p>
        </div>

        <button
          onClick={onOpenAuditReport}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
            t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/30'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export GDP Dossier</span>
        </button>
      </div>

      {!latest ? (
        <div className={`p-6 rounded-xl border text-center text-sm ${t.cardBgSunken} ${t.border} ${t.textMuted}`}>
          No compliance snapshots recorded yet. A snapshot is taken daily — check back tomorrow.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>GDP Compliance Rate</div>
              <div className={`text-2xl font-extrabold ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>{latest.avgGdpCompliance}%</div>
              <div className={`text-[10px] mt-0.5 ${t.textMuted}`}>As of {latest.snapshotDate}</div>
            </div>
            <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>Total Lanes</div>
              <div className={`text-2xl font-extrabold ${t.textPrimary}`}>{latest.totalLanes}</div>
              <div className={`text-[10px] mt-0.5 ${t.textMuted}`}>Tracked corridors</div>
            </div>
            <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>High-Risk Lanes</div>
              <div className={`text-2xl font-extrabold ${t.light ? 'text-amber-600' : 'text-amber-400'}`}>{latest.highRiskLanes}</div>
              <div className={`text-[10px] mt-0.5 ${t.light ? 'text-amber-600/80' : 'text-amber-400/80'}`}>Per latest snapshot</div>
            </div>
            <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>Open CAPAs</div>
              <div className={`text-2xl font-extrabold ${t.light ? 'text-rose-600' : 'text-rose-400'}`}>{openCapaCount}</div>
              <div className={`text-[10px] mt-0.5 ${t.textMuted}`}>From capa_records</div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${t.cardBgSunken} ${t.border}`}>
            <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${t.textSecondary}`}>
              <span>Compliance Trajectory ({snapshots.length} day{snapshots.length === 1 ? '' : 's'} of history)</span>
              <span className={`font-bold ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>Current: {latest.avgGdpCompliance}%</span>
            </div>

            {snapshots.length < MIN_HISTORY_FOR_TREND_LINE ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                <History className={`w-6 h-6 ${t.light ? 'text-slate-400' : 'text-slate-600'}`} />
                <div className={`text-sm font-medium ${t.textSecondary}`}>Not enough history yet for a trend line</div>
                <div className={`text-xs max-w-sm ${t.textMuted}`}>
                  A real snapshot is recorded once a day. {snapshots.length} of {MIN_HISTORY_FOR_TREND_LINE} needed
                  have accumulated so far — the chart will appear automatically once there's enough history.
                </div>
              </div>
            ) : (
              <GdpTrendSvg points={snapshots.map(s => ({ label: s.snapshotDate, value: s.avgGdpCompliance }))} colors={chartColors(t)} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

function GdpTrendSvg({ points, colors }: { points: { label: string; value: number }[]; colors: ReturnType<typeof chartColors> }) {
  const values = points.map(p => p.value);
  const minRate = Math.max(0, Math.min(...values) - 5);
  const maxRate = Math.min(100, Math.max(...values) + 5);
  const range = maxRate - minRate || 1;

  const getY = (val: number) => 140 - ((val - minRate) / range) * 100;
  const getX = (i: number) => 40 + (points.length === 1 ? 260 : (i / (points.length - 1)) * 520);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.value)}`).join(' ');
  const areaD = `${pathD} L ${getX(points.length - 1)} 140 L ${getX(0)} 140 Z`;

  return (
    <div className="w-full h-40">
      <svg viewBox="0 0 600 160" className="w-full h-full select-none">
        <defs>
          <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.line} stopOpacity="0.4" />
            <stop offset="100%" stopColor={colors.line} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <line x1="40" y1="40" x2="560" y2="40" stroke={colors.grid} strokeDasharray="3,3" />
        <text x="35" y="44" fill={colors.label} fontSize="8" textAnchor="end">{maxRate.toFixed(0)}%</text>
        <line x1="40" y1="110" x2="560" y2="110" stroke={colors.grid} strokeDasharray="3,3" />
        <text x="35" y="114" fill={colors.label} fontSize="8" textAnchor="end">{minRate.toFixed(0)}%</text>

        <path d={areaD} fill="url(#gdpGradient)" />
        <path d={pathD} fill="none" stroke={colors.line} strokeWidth="2.5" strokeLinecap="round" />

        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={p.label}>
              <circle cx={getX(i)} cy={getY(p.value)} r={isLast ? 4.5 : 3} fill={isLast ? colors.dotLast : colors.dot} stroke={colors.dotStroke} strokeWidth="1.5" />
              {(i % Math.ceil(points.length / 8) === 0 || isLast) && (
                <text x={getX(i)} y="155" fill={colors.label} fontSize="7.5" textAnchor="middle">
                  {p.label.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Offline/local demo mode only — mirrors GDP_TREND_DATA, never blended with live data. */
const LocalDemoGdpComplianceTrend: React.FC<{ onOpenAuditReport: () => void }> = ({ onOpenAuditReport }) => {
  const t = useThemeTokens();
  const colors = chartColors(t);
  const latestData = GDP_TREND_DATA[GDP_TREND_DATA.length - 1];
  const points = GDP_TREND_DATA;
  const minRate = 55;
  const maxRate = 100;

  const getY = (val: number) => 140 - ((val - minRate) / (maxRate - minRate)) * 100;

  const pathD = points.map((p, i) => {
    const x = 40 + (i / (points.length - 1)) * 520;
    const y = getY(p.complianceRate);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaD = `${pathD} L 560 140 L 40 140 Z`;

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-xl p-4 sm:p-5 shadow-lg mb-6`}>
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b ${t.border}`}>
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${t.light ? 'bg-teal-100 text-teal-600' : 'bg-teal-500/10 text-teal-400'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className={`text-base font-bold ${t.textPrimary}`}>
              GDP Compliance Monitoring & Quality Audit Trails
            </h3>
            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${t.chipBg} ${t.textMuted} ${t.light ? 'border-slate-300' : 'border-slate-700'}`}>
              Demo Data
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>
            Illustrative 12-Week Rolling Trend — connect Supabase for the real compliance history.
          </p>
        </div>

        <button
          onClick={onOpenAuditReport}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
            t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/30'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export GDP Dossier</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>GDP Compliance Rate</div>
          <div className={`text-2xl font-extrabold ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>{latestData.complianceRate}%</div>
          <div className={`text-[10px] font-semibold mt-0.5 flex items-center gap-0.5 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>
            <TrendingUp className="w-3 h-3" /> Up from 62.5% baseline
          </div>
        </div>
        <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>Audits Completed</div>
          <div className={`text-2xl font-extrabold ${t.textPrimary}`}>{latestData.auditsCompleted}</div>
          <div className={`text-[10px] mt-0.5 ${t.textMuted}`}>Logged events this week</div>
        </div>
        <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>Open Regulatory Issues</div>
          <div className={`text-2xl font-extrabold ${t.light ? 'text-amber-600' : 'text-amber-400'}`}>{latestData.openIssues}</div>
          <div className={`text-[10px] mt-0.5 ${t.light ? 'text-amber-600/80' : 'text-amber-400/80'}`}>1 CAPA in progress</div>
        </div>
        <div className={`p-3 rounded-xl border ${t.cardBgSunken} ${t.border}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.textFaint}`}>Audit Pass Rate</div>
          <div className={`text-2xl font-extrabold ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>{latestData.passRate}%</div>
          <div className={`text-[10px] mt-0.5 ${t.light ? 'text-emerald-600/80' : 'text-emerald-400/80'}`}>Inspection-Ready</div>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${t.cardBgSunken} ${t.border}`}>
        <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${t.textSecondary}`}>
          <span>12-Week Rolling Compliance Trajectory</span>
          <span className={`font-bold ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>Current: 94.2%</span>
        </div>

        <div className="w-full h-40">
          <svg viewBox="0 0 600 160" className="w-full h-full select-none">
            <defs>
              <linearGradient id="gdpGradientDemo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.line} stopOpacity="0.4" />
                <stop offset="100%" stopColor={colors.line} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line x1="40" y1="40" x2="560" y2="40" stroke={colors.grid} strokeDasharray="3,3" />
            <text x="35" y="44" fill={colors.label} fontSize="8" textAnchor="end">95%</text>

            <line x1="40" y1="75" x2="560" y2="75" stroke={colors.grid} strokeDasharray="3,3" />
            <text x="35" y="79" fill={colors.label} fontSize="8" textAnchor="end">80%</text>

            <line x1="40" y1="110" x2="560" y2="110" stroke={colors.grid} strokeDasharray="3,3" />
            <text x="35" y="114" fill={colors.label} fontSize="8" textAnchor="end">65%</text>

            <path d={areaD} fill="url(#gdpGradientDemo)" />
            <path d={pathD} fill="none" stroke={colors.line} strokeWidth="2.5" strokeLinecap="round" />

            {points.map((p, i) => {
              const x = 40 + (i / (points.length - 1)) * 520;
              const y = getY(p.complianceRate);
              const isLast = i === points.length - 1;

              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={isLast ? 4.5 : 3} fill={isLast ? colors.dotLast : colors.dot} stroke={colors.dotStroke} strokeWidth="1.5" />
                  <text x={x} y="155" fill={colors.label} fontSize="7.5" textAnchor="middle">
                    {p.week.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
