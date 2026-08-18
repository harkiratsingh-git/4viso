import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, PackageSearch, Thermometer } from 'lucide-react';
import { TransportLane } from '../types';
import { isLaneHighRisk, isLaneExcursing } from '../utils/laneRisk';
import { useViewMode } from '../contexts/ViewModeContext';
import { WorldRouteMap } from './WorldRouteMap';

interface SimpleDashboardProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
  onGoAdvanced: () => void;
}

function attentionReason(lane: TransportLane): string {
  if (isLaneExcursing(lane)) return `Temperature excursion — ${lane.currentTemp}°C outside ${lane.tempMin}–${lane.tempMax}°C range`;
  if (isLaneHighRisk(lane)) return `High risk score (${lane.riskScore}%)`;
  if (lane.status === 'Delayed') return `Delayed ${lane.delayHours}h`;
  if (lane.status === 'Customs Hold') return 'Held in customs';
  return 'Needs review';
}

/**
 * Simple mode's Global Dashboard: the first thing anyone new sees. Answers "what is this and
 * what needs my attention" in one glance — total lanes, how many need attention, where they
 * are, and a short list of which ones — instead of the full ops-console density of Advanced
 * mode. Per the Von Restorff principle already used elsewhere in this app: strong red is
 * reserved for the one number that actually needs it (Needs Attention), not repeated on every
 * panel, or a first-time viewer reads the whole page as an alarm regardless of color choice.
 */
export const SimpleDashboard: React.FC<SimpleDashboardProps> = ({ lanes, selectedLaneId, onSelectLane, onGoAdvanced }) => {
  const { theme } = useViewMode();
  const light = theme === 'light';

  const needsAttention = lanes.filter((l) => isLaneHighRisk(l) || isLaneExcursing(l) || l.status === 'Delayed' || l.status === 'Customs Hold');
  const decisionList = [...needsAttention]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
  const allClear = needsAttention.length === 0;

  const pageBg = light ? 'text-slate-900' : 'text-slate-100';
  const cardBg = light ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800';
  const mutedText = light ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={`space-y-6 ${pageBg}`}>
      {/* Plain-language statement of what this product is — the single thing missing from the
       *  ops-console view that made external reviewers unsure what they were looking at. */}
      <div className={`rounded-2xl p-6 border ${light ? 'bg-gradient-to-br from-teal-50 to-white border-teal-100' : 'bg-gradient-to-br from-teal-950/40 to-slate-900/60 border-teal-900/40'}`}>
        <h1 className={`text-xl sm:text-2xl font-bold ${light ? 'text-slate-900' : 'text-white'}`}>
          Track pharmaceutical shipments and catch temperature risk before it becomes a compliance problem.
        </h1>
        <p className={`mt-2 text-sm ${mutedText}`}>
          A live view of every cold-chain lane in transit, and what — if anything — needs a decision from you right now.
        </p>
      </div>

      {/* Two numbers, not eight. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`rounded-2xl p-5 border ${cardBg}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${mutedText}`}>Total Lanes</div>
          <div className={`mt-1 text-3xl font-bold ${light ? 'text-slate-900' : 'text-white'}`}>{lanes.length}</div>
          <div className={`mt-1 text-xs ${mutedText}`}>Active pharmaceutical shipments being tracked</div>
        </div>

        <div
          className={`rounded-2xl p-5 border ${
            allClear
              ? cardBg
              : light
              ? 'bg-rose-50 border-rose-200'
              : 'bg-rose-950/30 border-rose-800/60'
          }`}
        >
          <div className={`text-xs font-semibold uppercase tracking-wider ${allClear ? mutedText : light ? 'text-rose-600' : 'text-rose-300'}`}>
            Needs Attention
          </div>
          <div className={`mt-1 text-3xl font-bold ${allClear ? (light ? 'text-slate-900' : 'text-white') : light ? 'text-rose-600' : 'text-rose-400'}`}>
            {needsAttention.length}
          </div>
          <div className={`mt-1 text-xs ${allClear ? mutedText : light ? 'text-rose-500' : 'text-rose-300/80'}`}>
            {allClear ? 'Nothing needs a decision right now' : 'Lanes with a risk, delay, or temperature issue'}
          </div>
        </div>
      </div>

      {/* Simplified map — real geography, real lanes, none of the thermal-hotspot filter/legend
       *  controls Advanced mode layers on top. */}
      <div className={`rounded-2xl p-4 border ${cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm font-semibold ${light ? 'text-slate-800' : 'text-slate-200'}`}>Where your shipments are</h2>
        </div>
        <WorldRouteMap lanes={lanes} selectedLaneId={selectedLaneId} onSelectLane={onSelectLane} />
      </div>

      {/* Short decision list. */}
      <div className={`rounded-2xl p-5 border ${cardBg}`}>
        <h2 className={`text-sm font-semibold mb-3 ${light ? 'text-slate-800' : 'text-slate-200'}`}>What needs a decision</h2>
        {allClear ? (
          <div className={`flex items-center gap-2 text-sm ${light ? 'text-emerald-600' : 'text-emerald-400'}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>All lanes are on track — nothing needs a decision right now.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {decisionList.map((lane) => (
              <li key={lane.id}>
                <button
                  onClick={() => onSelectLane(lane)}
                  className={`w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    light ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isLaneExcursing(lane) ? (
                      <Thermometer className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold truncate ${light ? 'text-slate-900' : 'text-slate-100'}`}>{lane.laneCode}</div>
                      <div className={`text-xs truncate ${mutedText}`}>
                        {lane.originCity} → {lane.destinationCity} · {attentionReason(lane)}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 flex-shrink-0 ${mutedText}`} />
                </button>
              </li>
            ))}
            {needsAttention.length > decisionList.length && (
              <li className={`text-xs ${mutedText} px-3`}>
                +{needsAttention.length - decisionList.length} more — switch to Advanced for the full list.
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={onGoAdvanced}
          className={`flex items-center gap-1.5 text-xs font-medium ${light ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <PackageSearch className="w-3.5 h-3.5" />
          Need the full operational detail? Switch to Advanced mode.
        </button>
      </div>
    </div>
  );
};
