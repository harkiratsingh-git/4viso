import React, { useMemo } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Route as RouteIcon, ArrowRight, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { RouteStop, TransportMode } from '../types';
import { AirportAutocomplete, AirportValue } from './AirportAutocomplete';
import { getAirportCoords } from '../utils/geo';
import { recommendStops, checkRouteCertification } from '../utils/ports';
import { usePorts } from '../contexts/PortsContext';
import { useThemeTokens } from '../contexts/ViewModeContext';

export interface DraftStop extends AirportValue {
  id: string;
  stopType: RouteStop['stopType'];
  plannedDwellHours: number;
}

interface RouteStopsEditorProps {
  origin: AirportValue;
  destination: AirportValue;
  stops: DraftStop[];
  onStopsChange: (stops: DraftStop[]) => void;
  /** Temperature envelope of the cargo, used to check cold-storage requirements at each stop. */
  tempMin?: number;
  tempMax?: number;
  /** Transport mode — gates whether a stop is even suggested (e.g. Air routes within realistic nonstop range get no stop suggestions at all). */
  mode?: TransportMode;
}

const emptyAirportValue = (): AirportValue => ({ city: '', iata: '', country: '', coords: getAirportCoords('') });

export const RouteStopsEditor: React.FC<RouteStopsEditorProps> = ({
  origin,
  destination,
  stops,
  onStopsChange,
  tempMin = 2,
  tempMax = 8,
  mode = 'Air',
}) => {
  const t = useThemeTokens();
  const { ports } = usePorts();

  const recommendations = useMemo(() => {
    if (!origin.iata || !destination.iata) return [];
    return recommendStops(origin.coords, destination.coords, origin.iata, destination.iata, tempMin, tempMax, ports, mode).filter(
      (r) => !stops.some((s) => s.iata.toUpperCase() === r.port.code)
    );
  }, [origin, destination, tempMin, tempMax, ports, mode, stops]);

  const certificationIssues = useMemo(
    () => checkRouteCertification(stops.map((s) => ({ iata: s.iata, city: s.city })), ports, tempMax),
    [stops, ports, tempMax]
  );
  const stopHints: Record<string, string> = {};
  for (const stop of stops) {
    const issue = certificationIssues.find((i) => i.code === stop.iata.toUpperCase());
    if (issue) stopHints[stop.id] = issue.issue;
  }

  const addStop = (preset?: Partial<DraftStop>) => {
    onStopsChange([
      ...stops,
      {
        id: `stop-${Date.now()}`,
        ...emptyAirportValue(),
        stopType: 'Transit Hub',
        plannedDwellHours: 2,
        ...preset,
      },
    ]);
  };

  const updateStop = (id: string, patch: Partial<DraftStop>) => {
    onStopsChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStop = (id: string) => {
    onStopsChange(stops.filter((s) => s.id !== id));
  };

  const moveStop = (id: string, direction: -1 | 1) => {
    const idx = stops.findIndex((s) => s.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[idx], next[target]] = [next[target], next[idx]];
    onStopsChange(next);
  };

  return (
    <div className={`p-3 rounded-xl ${t.cardBg} border ${t.border} space-y-2.5`}>
      <div className="flex items-center justify-between">
        <div className={`font-bold flex items-center gap-1.5 text-xs ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>
          <RouteIcon className="w-3.5 h-3.5" /> Stops Along the Way ({stops.length})
        </div>
        <button
          type="button"
          onClick={() => addStop()}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
            t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/30'
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> Add a Stop
        </button>
      </div>
      <p className={`text-[11px] ${t.textMuted}`}>
        Most real shipments transit through at least one hub. Add layovers, customs points, or carrier handovers — each is checked for thermal risk, and you can reorder or remove any of them.
      </p>

      {recommendations.length > 0 && (
        <div className={`p-2.5 rounded-lg border space-y-1.5 ${t.light ? 'bg-teal-50 border-teal-300' : 'bg-teal-500/10 border-teal-500/25'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${t.light ? 'text-teal-700' : 'text-teal-300'}`}>
            <Sparkles className="w-3 h-3" /> Recommended, based on real port data
          </div>
          {recommendations.map((r) => (
            <button
              key={r.port.code}
              type="button"
              onClick={() =>
                addStop({
                  city: r.port.city,
                  iata: r.port.code,
                  country: r.port.country,
                  coords: r.port.coords,
                  stopType: r.port.hasColdStorage ? 'Cold Storage Layover' : 'Transit Hub',
                })
              }
              className={`w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                t.light ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-400' : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 hover:border-teal-500/40'
              }`}
            >
              <span className={`flex items-center gap-1.5 text-[11px] min-w-0 ${t.light ? 'text-slate-800' : 'text-slate-200'}`}>
                <Plus className={`w-3 h-3 flex-shrink-0 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
                <span className="truncate">{r.port.city} ({r.port.code})</span>
                {r.port.hasGdpCertification && <ShieldCheck className={`w-3 h-3 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />}
              </span>
              <span className={`text-[10px] flex-shrink-0 ${t.textFaint}`}>{r.reason}</span>
            </button>
          ))}
        </div>
      )}

      {stops.length === 0 ? (
        <div className={`text-center py-4 text-[11px] border border-dashed rounded-lg ${t.textMuted} ${t.light ? 'border-slate-300' : 'border-slate-800'}`}>
          Direct route — no stops between origin and destination.
        </div>
      ) : (
        <div className="space-y-2.5">
          {stops.map((s, i) => (
            <div key={s.id} className={`p-3 rounded-lg ${t.cardBgSunken} border ${t.border} space-y-2`}>
              <div className="flex items-start gap-2.5">
                <span className={`w-5 h-5 mt-1 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${t.chipBg} ${t.textSecondary}`}>
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <AirportAutocomplete
                    label=""
                    value={{ city: s.city, iata: s.iata, country: s.country, coords: s.coords }}
                    onChange={(v) => updateStop(s.id, v)}
                    placeholder="Search city, country, or IATA code…"
                  />
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => moveStop(s.id, -1)}
                    disabled={i === 0}
                    className={`p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
                    title="Move earlier in route"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(s.id, 1)}
                    disabled={i === stops.length - 1}
                    className={`p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
                    title="Move later in route"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStop(s.id)}
                    className={`p-1 rounded ${t.light ? 'bg-rose-100 hover:bg-rose-200 text-rose-600' : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300'}`}
                    title="Remove stop"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-7 text-[11px]">
                <select
                  value={s.stopType}
                  onChange={(e) => updateStop(s.id, { stopType: e.target.value as RouteStop['stopType'] })}
                  className={`${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1 ${t.textSecondary}`}
                >
                  <option value="Transit Hub">Transit Hub</option>
                  <option value="Customs Clearance">Customs Clearance</option>
                  <option value="Carrier Handover">Carrier Handover</option>
                  <option value="Cold Storage Layover">Cold Storage Layover</option>
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="72"
                    value={s.plannedDwellHours}
                    onChange={(e) => updateStop(s.id, { plannedDwellHours: parseFloat(e.target.value) || 0 })}
                    className={`w-14 ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1 ${t.textPrimary}`}
                  />
                  <span className={t.textMuted}>hrs on the ground</span>
                </div>
              </div>

              {stopHints[s.id] && (
                <div className={`pl-7 text-[11px] flex items-start gap-1.5 ${t.light ? 'text-amber-700' : 'text-amber-300'}`}>
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>{stopHints[s.id]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Route Preview Breadcrumb */}
      <div className={`pt-2 border-t flex items-center flex-wrap gap-1.5 text-[11px] font-mono ${t.border} ${t.textSecondary}`}>
        <span className={`px-2 py-0.5 rounded border ${t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'}`}>
          {origin.iata || '???'}
        </span>
        {stops.map((s) => (
          <React.Fragment key={s.id}>
            <ArrowRight className={`w-3 h-3 ${t.textFaint}`} />
            <span className={`px-2 py-0.5 rounded ${t.chipBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} ${t.textSecondary}`}>{s.iata || '???'}</span>
          </React.Fragment>
        ))}
        <ArrowRight className={`w-3 h-3 ${t.textFaint}`} />
        <span className={`px-2 py-0.5 rounded border ${t.light ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-purple-500/15 text-purple-300 border-purple-500/30'}`}>
          {destination.iata || '???'}
        </span>
      </div>
    </div>
  );
};
