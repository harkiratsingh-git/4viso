import React from 'react';
import { ShieldCheck, Thermometer, ArrowRight, LogIn, PackageSearch, AlertTriangle } from 'lucide-react';
import { TransportLane } from '../types';
import { isLaneHighRisk, isLaneExcursing } from '../utils/laneRisk';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface LandingPageProps {
  lanes: TransportLane[];
  dataSource: 'loading' | 'cloud' | 'local';
  onTryDemo: () => void;
  onSignIn: () => void;
}

/**
 * The actual first thing a cold visitor sees, before either the demo or a login form — this is
 * what has to carry the "what even is this" first impression, not the dashboard itself. Every
 * number below is computed from the same `lanes` array the rest of the app renders from (either
 * the real Supabase dataset or the local demo one, whichever is currently loaded) — never an
 * invented marketing figure — and is labeled honestly as live or demo data accordingly.
 */
export const LandingPage: React.FC<LandingPageProps> = ({ lanes, dataSource, onTryDemo, onSignIn }) => {
  const t = useThemeTokens();

  const totalLanes = lanes.length;
  const avgGdpCompliance = totalLanes > 0
    ? Math.round((lanes.reduce((sum, l) => sum + l.gdpComplianceRate, 0) / totalLanes) * 10) / 10
    : null;
  const flaggedLanes = lanes.filter((l) => isLaneHighRisk(l) || isLaneExcursing(l)).length;
  const isLive = dataSource === 'cloud';
  const environmentLabel = isLive ? 'live Supabase environment' : 'local demo dataset';

  return (
    <div className={`min-h-screen flex flex-col ${t.pageBg}`}>
      <header className="px-6 py-5 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <span className={`font-extrabold text-sm tracking-wider ${t.textPrimary}`}>PHARMATRACK</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl text-center">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-5 ${
            t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            <Thermometer className="w-3 h-3" /> Pharmaceutical Cold-Chain Risk Tracking
          </span>

          <h1 className={`text-2xl sm:text-4xl font-black tracking-tight leading-tight ${t.textPrimary}`}>
            Track pharmaceutical shipments and catch temperature risk<br className="hidden sm:block" /> before it becomes a compliance problem.
          </h1>

          <p className={`mt-4 text-sm sm:text-base max-w-xl mx-auto leading-relaxed ${t.textMuted}`}>
            Built for quality assurance and logistics teams moving cold-chain pharmaceuticals — vaccines, biologics,
            insulin, cell therapies — across air, sea, and road. It watches every lane's live temperature against its
            required range, flags GDP compliance risk, and recommends a carrier or route fix the moment something
            goes wrong, so a deviation gets caught before a batch is lost.
          </p>

          {/* Real numbers, honestly labeled — never invented marketing figures. */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto">
            <div className={`rounded-xl p-4 border ${t.cardBg} ${t.border}`}>
              <div className={`text-2xl font-black ${t.textPrimary}`}>{totalLanes}</div>
              <div className={`text-[11px] mt-0.5 ${t.textMuted}`}>lanes monitored</div>
            </div>
            <div className={`rounded-xl p-4 border ${t.cardBg} ${t.border}`}>
              <div className={`text-2xl font-black ${t.textPrimary}`}>{avgGdpCompliance !== null ? `${avgGdpCompliance}%` : '—'}</div>
              <div className={`text-[11px] mt-0.5 ${t.textMuted}`}>avg. GDP compliance</div>
            </div>
            <div className={`rounded-xl p-4 border ${t.cardBg} ${t.border}`}>
              <div className={`text-2xl font-black ${flaggedLanes > 0 ? (t.light ? 'text-rose-600' : 'text-rose-400') : t.textPrimary}`}>{flaggedLanes}</div>
              <div className={`text-[11px] mt-0.5 ${t.textMuted}`}>lanes flagged right now</div>
            </div>
          </div>
          <p className={`mt-2.5 text-[11px] flex items-center justify-center gap-1 ${t.textFaint}`}>
            <AlertTriangle className="w-3 h-3" />
            {isLive ? `From the ${environmentLabel} — real numbers, not a projection.` : `From the ${environmentLabel} — for evaluation only, not live production data.`}
          </p>

          {/* Two clear paths, neither buried. */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onTryDemo}
              className="min-h-[46px] w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-700/20 transition-all active:scale-95"
            >
              <PackageSearch className="w-4 h-4" />
              <span>Try the demo — no account needed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onSignIn}
              className={`min-h-[46px] w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border text-sm font-bold transition-all ${
                t.light ? 'bg-white hover:bg-slate-50 text-slate-900 border-slate-300' : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in</span>
            </button>
          </div>
          <p className={`mt-3 text-[11px] ${t.textFaint}`}>
            The demo drops you straight into Simple mode. Sign-in is only needed for the full operational console — Advanced
            mode, per-leg carrier assignment, disruption reporting, and the audit trail.
          </p>
        </div>
      </main>

      <footer className={`px-6 py-4 text-center text-[11px] ${t.textFaint}`}>
        Good Distribution Practice Compliant (GDP 2013/C 343/01)
      </footer>
    </div>
  );
};
