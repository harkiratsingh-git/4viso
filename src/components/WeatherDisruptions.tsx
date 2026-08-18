import React from 'react';
import {
  CloudLightning,
  Anchor,
  Wind,
  SunMedium,
  AlertCircle,
  ChevronRight,
  Clock,
  Route as RouteIcon,
  CheckCircle2,
} from 'lucide-react';
import { WeatherDisruption } from '../types';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface WeatherDisruptionsProps {
  disruptions: WeatherDisruption[];
  selectedLaneCode: string | null;
  onFilterByLaneCode: (laneCode: string) => void;
}

export const WeatherDisruptions: React.FC<WeatherDisruptionsProps> = ({
  disruptions,
  selectedLaneCode,
  onFilterByLaneCode,
}) => {
  const t = useThemeTokens();

  const getDisruptionIcon = (type: WeatherDisruption['type']) => {
    switch (type) {
      case 'Severe Storm':
        return <CloudLightning className={`w-4 h-4 ${t.light ? 'text-rose-500' : 'text-rose-400'}`} />;
      case 'Port Congestion':
        return <Anchor className={`w-4 h-4 ${t.light ? 'text-amber-500' : 'text-amber-400'}`} />;
      case 'Heatwave Warning':
        return <SunMedium className={`w-4 h-4 ${t.light ? 'text-orange-500' : 'text-orange-400'}`} />;
      case 'Low Visibility':
        return <Wind className={`w-4 h-4 ${t.light ? 'text-sky-500' : 'text-sky-400'}`} />;
      case 'Corridor Advisory':
        return <RouteIcon className={`w-4 h-4 ${t.light ? 'text-teal-500' : 'text-teal-400'}`} />;
      default:
        return <AlertCircle className={`w-4 h-4 ${t.light ? 'text-amber-500' : 'text-amber-400'}`} />;
    }
  };

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-xl p-4 shadow-lg mb-6`}>
      <div className={`flex items-center justify-between border-b ${t.border} pb-3 mb-3`}>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${t.light ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/10 text-amber-400'}`}>
            <CloudLightning className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${t.textPrimary} flex items-center gap-2`}>
              Weather & Route Disruption Feed
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                disruptions.length > 0
                  ? t.light ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                {disruptions.length} Active Alerts
              </span>
            </h3>
            <p className={`text-xs ${t.textMuted}`}>
              Automated geopolitical, environmental & port congestion flags mapped to lane IDs
            </p>
          </div>
        </div>
      </div>

      {disruptions.length === 0 ? (
        <div className={`flex items-center gap-2 py-4 text-xs ${t.textMuted}`}>
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${t.light ? 'text-emerald-500' : 'text-emerald-400'}`} />
          <span>No corridor advisories currently affect any active lane's route.</span>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {disruptions.map((item) => {
          const isSelected = item.affectedLaneCodes.some(code => code === selectedLaneCode);

          return (
            <div
              key={item.id}
              className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                item.severity === 'Critical'
                  ? t.light ? 'bg-rose-50 border-rose-200 hover:border-rose-300' : 'bg-rose-950/20 border-rose-800/40 hover:border-rose-700'
                  : `${t.cardBgSunken} ${t.border} ${t.hoverBorder}`
              } ${isSelected ? 'ring-1 ring-emerald-500' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {getDisruptionIcon(item.type)}
                    <span className={`text-xs font-bold ${t.light ? 'text-slate-800' : 'text-slate-200'}`}>{item.region}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.severity === 'Critical'
                      ? t.light ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-300'
                      : t.light ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {item.severity}
                  </span>
                </div>

                <p className={`text-xs line-clamp-2 mb-2 leading-relaxed ${t.textSecondary}`}>
                  {item.impactDescription}
                </p>
              </div>

              <div className={`border-t pt-2 flex items-center justify-between text-[11px] ${t.borderSubtle}`}>
                <span className={`font-semibold flex items-center gap-1 ${t.light ? 'text-amber-600' : 'text-amber-400'}`}>
                  <Clock className="w-3 h-3" /> {item.delayEstimated}
                </span>

                <div className="flex items-center gap-1 flex-wrap">
                  {item.affectedLaneCodes.map(code => (
                    <button
                      key={code}
                      onClick={() => onFilterByLaneCode(code)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors border ${
                        t.light
                          ? 'bg-slate-100 hover:bg-slate-200 text-teal-700 hover:text-teal-800 border-slate-200'
                          : 'bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border-slate-700'
                      }`}
                      title={`Filter to lane ${code}`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
