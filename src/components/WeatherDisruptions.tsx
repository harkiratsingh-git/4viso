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
  const getDisruptionIcon = (type: WeatherDisruption['type']) => {
    switch (type) {
      case 'Severe Storm':
        return <CloudLightning className="w-4 h-4 text-rose-400" />;
      case 'Port Congestion':
        return <Anchor className="w-4 h-4 text-amber-400" />;
      case 'Heatwave Warning':
        return <SunMedium className="w-4 h-4 text-orange-400" />;
      case 'Low Visibility':
        return <Wind className="w-4 h-4 text-sky-400" />;
      case 'Corridor Advisory':
        return <RouteIcon className="w-4 h-4 text-teal-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg mb-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <CloudLightning className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Weather & Route Disruption Feed
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                disruptions.length > 0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                {disruptions.length} Active Alerts
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Automated geopolitical, environmental & port congestion flags mapped to lane IDs
            </p>
          </div>
        </div>
      </div>

      {disruptions.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-slate-400 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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
                  ? 'bg-rose-950/20 border-rose-800/40 hover:border-rose-700'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              } ${isSelected ? 'ring-1 ring-emerald-500' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {getDisruptionIcon(item.type)}
                    <span className="text-xs font-bold text-slate-200">{item.region}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.severity === 'Critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {item.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 mb-2 leading-relaxed">
                  {item.impactDescription}
                </p>
              </div>

              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px]">
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {item.delayEstimated}
                </span>
                
                <div className="flex items-center gap-1 flex-wrap">
                  {item.affectedLaneCodes.map(code => (
                    <button
                      key={code}
                      onClick={() => onFilterByLaneCode(code)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 text-[10px] font-mono font-semibold transition-colors border border-slate-700"
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
