import React from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  Award, 
  Download
} from 'lucide-react';
import { GDP_TREND_DATA } from '../data/mockData';

interface GdpComplianceTrendProps {
  onOpenAuditReport: () => void;
}

export const GdpComplianceTrend: React.FC<GdpComplianceTrendProps> = ({ onOpenAuditReport }) => {
  const latestData = GDP_TREND_DATA[GDP_TREND_DATA.length - 1];

  // SVG Chart calculation for 12-week trend
  const points = GDP_TREND_DATA;
  const minRate = 55;
  const maxRate = 100;

  const getY = (val: number) => {
    return 140 - ((val - minRate) / (maxRate - minRate)) * 100;
  };

  const pathD = points.map((p, i) => {
    const x = 40 + (i / (points.length - 1)) * 520;
    const y = getY(p.complianceRate);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaD = `${pathD} L 560 140 L 40 140 Z`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg mb-6">
      
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              GDP Compliance Monitoring & Quality Audit Trails
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Slide 10: 12-Week Rolling Trend & Good Distribution Practice Verification (EU 2013/C 343/01)
          </p>
        </div>

        <button
          onClick={onOpenAuditReport}
          className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export GDP Dossier</span>
        </button>
      </div>

      {/* 4 Mini KPI Blocks (Slide 10) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        
        {/* Metric 1: GDP Compliance Rate */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            GDP Compliance Rate
          </div>
          <div className="text-2xl font-extrabold text-teal-400">
            {latestData.complianceRate}%
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" /> Up from 62.5% baseline
          </div>
        </div>

        {/* Metric 2: Audits Completed */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Audits Completed
          </div>
          <div className="text-2xl font-extrabold text-white">
            {latestData.auditsCompleted}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Logged events this week
          </div>
        </div>

        {/* Metric 3: Open Issues */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Open Regulatory Issues
          </div>
          <div className="text-2xl font-extrabold text-amber-400">
            {latestData.openIssues}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">
            1 CAPA in progress
          </div>
        </div>

        {/* Metric 4: Pass Rate */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Audit Pass Rate
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">
            {latestData.passRate}%
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5">
            Inspection-Ready
          </div>
        </div>

      </div>

      {/* 12-Week Rolling Trend Line Chart */}
      <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
          <span>12-Week Rolling Compliance Trajectory</span>
          <span className="text-emerald-400 font-bold">Current: 94.2%</span>
        </div>

        <div className="w-full h-40">
          <svg viewBox="0 0 600 160" className="w-full h-full select-none">
            <defs>
              <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1="40" y1="40" x2="560" y2="40" stroke="#1e293b" strokeDasharray="3,3" />
            <text x="35" y="44" fill="#64748b" fontSize="8" textAnchor="end">95%</text>

            <line x1="40" y1="75" x2="560" y2="75" stroke="#1e293b" strokeDasharray="3,3" />
            <text x="35" y="79" fill="#64748b" fontSize="8" textAnchor="end">80%</text>

            <line x1="40" y1="110" x2="560" y2="110" stroke="#1e293b" strokeDasharray="3,3" />
            <text x="35" y="114" fill="#64748b" fontSize="8" textAnchor="end">65%</text>

            {/* Shaded Area Under Curve */}
            <path d={areaD} fill="url(#gdpGradient)" />

            {/* Main Trend Line */}
            <path d={pathD} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" />

            {/* Data Point Nodes */}
            {points.map((p, i) => {
              const x = 40 + (i / (points.length - 1)) * 520;
              const y = getY(p.complianceRate);
              const isLast = i === points.length - 1;

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isLast ? 4.5 : 3}
                    fill={isLast ? '#10b981' : '#14b8a6'}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  <text x={x} y="155" fill="#64748b" fontSize="7.5" textAnchor="middle">
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
