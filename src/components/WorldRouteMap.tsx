import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography, Line, Marker } from 'react-simple-maps';
import { ShieldCheck } from 'lucide-react';
import { TransportLane } from '../types';
import { getRiskColor } from '../utils/formatters';
import { usePorts } from '../contexts/PortsContext';
import { getEffectiveRiskLevel, getEffectiveRiskScore } from '../utils/laneRisk';
import { useThemeTokens } from '../contexts/ViewModeContext';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldRouteMapProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
}

// react-simple-maps takes [lng, lat]; the rest of the app stores coords as [lat, lng].
const toLngLat = (coords: [number, number]): [number, number] => [coords[1], coords[0]];

export const WorldRouteMap: React.FC<WorldRouteMapProps> = ({ lanes, selectedLaneId, onSelectLane }) => {
  const { ports, isLive } = usePorts();
  const [hoveredLane, setHoveredLane] = useState<TransportLane | null>(null);
  const t = useThemeTokens();

  const activeLane = hoveredLane || lanes.find((l) => l.id === selectedLaneId) || null;

  // The map canvas keeps its own deliberate palette in both themes (like most map products) —
  // just a lighter "ocean" instead of dark navy, not the app's slate/white scaffolding.
  const landFill = t.light ? '#e2e8f0' : '#152238';
  const landStroke = t.light ? '#cbd5e1' : '#1e2f4a';
  const landHoverFill = t.light ? '#d5dee8' : '#1c2d47';
  const markerStroke = t.light ? '#f8fafc' : '#0f172a';

  return (
    <div className={`relative w-full aspect-[2/1] min-h-[380px] max-h-[520px] rounded-xl border overflow-hidden ${t.light ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
      <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: '100%', height: '100%' }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={landFill}
                stroke={landStroke}
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', fill: landHoverFill },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {/* Route lines, through any intermediate stops */}
        {lanes.map((lane) => {
          const points: [number, number][] = [lane.originCoords, ...lane.stops.map((s) => s.coords), lane.destinationCoords];
          const isSelected = selectedLaneId === lane.id;
          const color = getRiskColor(getEffectiveRiskLevel(lane)).fill;

          return (
            <g
              key={lane.id}
              onClick={() => onSelectLane(lane)}
              onMouseEnter={() => setHoveredLane(lane)}
              onMouseLeave={() => setHoveredLane(null)}
              style={{ cursor: 'pointer' }}
            >
              {points.slice(0, -1).map((p, i) => {
                const from = toLngLat(p);
                const to = toLngLat(points[i + 1]);
                return (
                  <React.Fragment key={i}>
                    {/* wide invisible line for an easier click target */}
                    <Line from={from} to={to} stroke="transparent" strokeWidth={10} />
                    <Line
                      from={from}
                      to={to}
                      stroke={color}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                      strokeOpacity={isSelected ? 1 : 0.65}
                      strokeDasharray={lane.mode === 'Sea' ? '3,3' : undefined}
                    />
                  </React.Fragment>
                );
              })}
            </g>
          );
        })}

        {/* Known ports/hubs (real GDP-certification data when connected to Supabase) */}
        {ports.map((p) => (
          <Marker key={p.code} coordinates={toLngLat(p.coords)}>
            <circle
              r={p.hasGdpCertification ? 2.4 : 1.6}
              fill={p.hasGdpCertification ? '#38bdf8' : '#64748b'}
              stroke={markerStroke}
              strokeWidth={0.5}
            />
          </Marker>
        ))}

        {/* Origin/destination/stop markers for visible lanes */}
        {lanes.map((lane) => (
          <React.Fragment key={`markers-${lane.id}`}>
            <Marker coordinates={toLngLat(lane.originCoords)}>
              <circle r={selectedLaneId === lane.id ? 4 : 3} fill="#10b981" stroke={markerStroke} strokeWidth={1} />
            </Marker>
            {lane.stops.map((s) => (
              <Marker key={s.id} coordinates={toLngLat(s.coords)}>
                <circle r={2.5} fill={t.light ? '#334155' : '#f8fafc'} stroke={markerStroke} strokeWidth={1} />
              </Marker>
            ))}
            <Marker coordinates={toLngLat(lane.destinationCoords)}>
              <circle r={selectedLaneId === lane.id ? 4 : 3} fill="#a855f7" stroke={markerStroke} strokeWidth={1} />
            </Marker>
          </React.Fragment>
        ))}
      </ComposableMap>

      {/* Data source badge */}
      <div className={`absolute top-3 right-3 backdrop-blur-md border rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5 ${t.light ? 'bg-white/90 border-slate-200 text-slate-600' : 'bg-slate-900/90 border-slate-800 text-slate-300'}`}>
        <ShieldCheck className={`w-3 h-3 ${isLive ? (t.light ? 'text-emerald-600' : 'text-emerald-400') : t.textFaint}`} />
        <span>{isLive ? 'Live Supabase ports directory' : 'Local ports directory'}</span>
      </div>

      {/* Hovered/selected lane info */}
      {activeLane && (
        <div className={`absolute bottom-3 left-3 border p-3 rounded-lg shadow-xl backdrop-blur-md max-w-xs text-xs z-10 pointer-events-none ${t.light ? 'bg-white/95 border-slate-300 text-slate-700' : 'bg-slate-900/95 border-slate-700 text-slate-200'}`}>
          <div className={`flex items-center justify-between gap-2 border-b pb-1.5 mb-1.5 ${t.light ? 'border-slate-200' : 'border-slate-800'}`}>
            <span className={`font-bold text-sm flex items-center gap-1.5 ${t.light ? 'text-slate-900' : 'text-white'}`}>
              {activeLane.laneCode}
              <span className={`text-[10px] px-1.5 py-0.2 rounded ${t.chipBg} ${t.textSecondary}`}>{activeLane.mode}</span>
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: `${getRiskColor(getEffectiveRiskLevel(activeLane)).fill}22`, color: getRiskColor(getEffectiveRiskLevel(activeLane)).fill }}
            >
              Risk {getEffectiveRiskScore(activeLane)}%
            </span>
          </div>
          <div className={`font-medium ${t.textSecondary}`}>
            {activeLane.originCity} ({activeLane.originIata})
            {activeLane.stops.map((s) => ` › ${s.iata}`).join('')}
            {' '}→ {activeLane.destinationCity} ({activeLane.destinationIata})
          </div>
          <div className={`text-[11px] mt-0.5 ${t.textMuted}`}>{activeLane.carrier} • {activeLane.productName}</div>
        </div>
      )}

      {/* Legend */}
      <div className={`absolute bottom-3 right-3 backdrop-blur-md border rounded-lg p-2.5 text-[10px] space-y-1 ${t.light ? 'bg-white/90 border-slate-200 text-slate-600' : 'bg-slate-900/90 border-slate-800 text-slate-300'}`}>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Origin</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Destination</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> GDP-certified port</div>
      </div>
    </div>
  );
};
