import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography, Line, Marker } from 'react-simple-maps';
import { ShieldCheck } from 'lucide-react';
import { TransportLane } from '../types';
import { getRiskColor } from '../utils/formatters';
import { usePorts } from '../contexts/PortsContext';
import { getEffectiveRiskLevel, getEffectiveRiskScore } from '../utils/laneRisk';

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

  const activeLane = hoveredLane || lanes.find((l) => l.id === selectedLaneId) || null;

  return (
    <div className="relative w-full aspect-[2/1] min-h-[380px] max-h-[520px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: '100%', height: '100%' }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#152238"
                stroke="#1e2f4a"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', fill: '#1c2d47' },
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
              stroke="#0f172a"
              strokeWidth={0.5}
            />
          </Marker>
        ))}

        {/* Origin/destination/stop markers for visible lanes */}
        {lanes.map((lane) => (
          <React.Fragment key={`markers-${lane.id}`}>
            <Marker coordinates={toLngLat(lane.originCoords)}>
              <circle r={selectedLaneId === lane.id ? 4 : 3} fill="#10b981" stroke="#0f172a" strokeWidth={1} />
            </Marker>
            {lane.stops.map((s) => (
              <Marker key={s.id} coordinates={toLngLat(s.coords)}>
                <circle r={2.5} fill="#f8fafc" stroke="#0f172a" strokeWidth={1} />
              </Marker>
            ))}
            <Marker coordinates={toLngLat(lane.destinationCoords)}>
              <circle r={selectedLaneId === lane.id ? 4 : 3} fill="#a855f7" stroke="#0f172a" strokeWidth={1} />
            </Marker>
          </React.Fragment>
        ))}
      </ComposableMap>

      {/* Data source badge */}
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 flex items-center gap-1.5">
        <ShieldCheck className={`w-3 h-3 ${isLive ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span>{isLive ? 'Live Supabase ports directory' : 'Local ports directory'}</span>
      </div>

      {/* Hovered/selected lane info */}
      {activeLane && (
        <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md max-w-xs text-xs text-slate-200 z-10 pointer-events-none">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-white text-sm flex items-center gap-1.5">
              {activeLane.laneCode}
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{activeLane.mode}</span>
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: `${getRiskColor(getEffectiveRiskLevel(activeLane)).fill}22`, color: getRiskColor(getEffectiveRiskLevel(activeLane)).fill }}
            >
              Risk {getEffectiveRiskScore(activeLane)}%
            </span>
          </div>
          <div className="text-slate-300 font-medium">
            {activeLane.originCity} ({activeLane.originIata})
            {activeLane.stops.map((s) => ` › ${s.iata}`).join('')}
            {' '}→ {activeLane.destinationCity} ({activeLane.destinationIata})
          </div>
          <div className="text-slate-400 text-[11px] mt-0.5">{activeLane.carrier} • {activeLane.productName}</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-300 space-y-1">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Origin</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Destination</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> GDP-certified port</div>
      </div>
    </div>
  );
};
