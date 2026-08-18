import React, { useMemo, useState } from 'react';
import { X, Route as RouteIcon, Save, ShieldCheck, ShieldAlert, AlertTriangle, MapPin } from 'lucide-react';
import { TransportLane, RouteStop } from '../types';
import { RouteStopsEditor, DraftStop } from './RouteStopsEditor';
import { assessRoute } from '../utils/riskAssessment';
import { getRiskColor } from '../utils/formatters';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface ManageLaneStopsModalProps {
  lane: TransportLane;
  onClose: () => void;
  onSave: (laneId: string, stops: RouteStop[]) => void;
}

function toDraftStops(stops: RouteStop[]): DraftStop[] {
  return stops.map((s) => ({
    id: s.id,
    city: s.city,
    iata: s.iata,
    country: s.country,
    coords: s.coords,
    stopType: s.stopType,
    plannedDwellHours: s.plannedDwellHours,
  }));
}

export const ManageLaneStopsModal: React.FC<ManageLaneStopsModalProps> = ({ lane, onClose, onSave }) => {
  const t = useThemeTokens();
  const [stops, setStops] = useState<DraftStop[]>(toDraftStops(lane.stops));

  const origin = { city: lane.originCity, iata: lane.originIata, country: lane.originCountry, coords: lane.originCoords };
  const destination = { city: lane.destinationCity, iata: lane.destinationIata, country: lane.destinationCountry, coords: lane.destinationCoords };

  const assessment = useMemo(() => assessRoute({
    origin: { iata: origin.iata, coords: origin.coords, label: 'Origin' },
    destination: { iata: destination.iata, coords: destination.coords, label: 'Destination' },
    stops: stops.filter((s) => s.iata.trim()).map((s) => ({ iata: s.iata.toUpperCase(), coords: s.coords, label: s.city || s.iata })),
    mode: lane.mode,
    tempMin: lane.tempMin,
    tempMax: lane.tempMax,
  }), [stops, origin.iata, origin.coords, destination.iata, destination.coords, lane.mode, lane.tempMin, lane.tempMax]);

  const handleSave = () => {
    const routeStops: RouteStop[] = stops
      .filter((s) => s.iata.trim())
      .map((s, i) => ({
        id: s.id,
        sequence: i + 1,
        city: s.city || s.iata.toUpperCase(),
        iata: s.iata.toUpperCase(),
        country: s.country,
        coords: s.coords,
        stopType: s.stopType,
        plannedDwellHours: s.plannedDwellHours,
      }));
    onSave(lane.id, routeStops);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>

        {/* Header */}
        <div className={`p-4 sm:p-5 ${t.cardBgSunken} border-b ${t.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${t.light ? 'bg-teal-100 text-teal-600 border-teal-300' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'}`}>
              <RouteIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${t.textPrimary}`}>
                Manage Route: {lane.laneCode}
              </h2>
              <p className={`text-xs ${t.textMuted}`}>
                Add, reorder, or remove stops without touching the rest of this lane's setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${t.chipBg} ${t.hoverBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs ${t.textSecondary}`}>

          {/* Fixed Origin/Destination Context (not editable here — change via lane setup) */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl ${t.cardBgSunken} border ${t.border} flex items-center gap-2`}>
              <MapPin className={`w-4 h-4 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <div className="min-w-0">
                <div className={`text-[10px] uppercase tracking-wider ${t.textFaint}`}>Origin</div>
                <div className={`font-bold truncate ${t.textPrimary}`}>{lane.originCity} ({lane.originIata})</div>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${t.cardBgSunken} border ${t.border} flex items-center gap-2`}>
              <MapPin className={`w-4 h-4 flex-shrink-0 ${t.light ? 'text-purple-600' : 'text-purple-400'}`} />
              <div className="min-w-0">
                <div className={`text-[10px] uppercase tracking-wider ${t.textFaint}`}>Destination</div>
                <div className={`font-bold truncate ${t.textPrimary}`}>{lane.destinationCity} ({lane.destinationIata})</div>
              </div>
            </div>
          </div>

          <RouteStopsEditor origin={origin} destination={destination} stops={stops} onStopsChange={setStops} tempMin={lane.tempMin} tempMax={lane.tempMax} />

          {/* Live Risk Preview */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
            assessment.verdict === 'Recommended'
              ? t.light ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/30 border-emerald-800/50'
              : assessment.verdict === 'Review Recommended'
              ? t.light ? 'bg-amber-50 border-amber-300' : 'bg-amber-950/30 border-amber-800/50'
              : t.light ? 'bg-rose-50 border-rose-300' : 'bg-rose-950/30 border-rose-800/50'
          }`}>
            <div className="flex items-center gap-2.5">
              {assessment.verdict === 'Recommended' ? (
                <ShieldCheck className={`w-5 h-5 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
              ) : assessment.verdict === 'Review Recommended' ? (
                <ShieldAlert className={`w-5 h-5 flex-shrink-0 ${t.light ? 'text-amber-600' : 'text-amber-400'}`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${t.light ? 'text-rose-600' : 'text-rose-400'}`} />
              )}
              <div>
                <div className={`text-xs font-extrabold ${
                  assessment.verdict === 'Recommended'
                    ? t.light ? 'text-emerald-700' : 'text-emerald-300'
                    : assessment.verdict === 'Review Recommended'
                    ? t.light ? 'text-amber-700' : 'text-amber-300'
                    : t.light ? 'text-rose-700' : 'text-rose-300'
                }`}>
                  {assessment.verdict}
                </div>
                <p className={`text-[11px] ${t.textMuted}`}>Updated route risk: {assessment.overallScore}% ({assessment.overallLevel})</p>
              </div>
            </div>
            <div className={`w-20 h-1.5 rounded-full overflow-hidden flex-shrink-0 ${t.chipBg}`}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${assessment.overallScore}%`, backgroundColor: getRiskColor(assessment.overallLevel, t.light).fill }}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 ${t.cardBgSunken} border-t ${t.border} flex items-center justify-between`}>
          <button
            onClick={onClose}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Route</span>
          </button>
        </div>

      </div>
    </div>
  );
};
