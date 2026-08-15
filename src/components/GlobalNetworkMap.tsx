import React, { useState } from 'react';
import { 
  Globe2, 
  Layers, 
  Flame, 
  MapPin, 
  Plane, 
  Ship, 
  Truck, 
  AlertTriangle,
  Info,
  Compass,
  Sparkles,
  Map as MapIcon
} from 'lucide-react';
import { TransportLane } from '../types';
import { RegionalTemperatureHeatmapView } from './RegionalTemperatureHeatmapView';
import { GoogleMapsNetworkView } from './GoogleMapsNetworkView';

interface GlobalNetworkMapProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
  onOpenGoogleMapsConfig?: () => void;
}

// Simple Mercator-like projection for 1000x500 SVG canvas
function projectCoordinates(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 920 + 40;
  const y = ((80 - lat) / 140) * 420 + 40;
  return [Math.max(20, Math.min(980, x)), Math.max(20, Math.min(480, y))];
}

export const GlobalNetworkMap: React.FC<GlobalNetworkMapProps> = ({
  lanes,
  selectedLaneId,
  onSelectLane,
  onOpenGoogleMapsConfig
}) => {
  const [activeSubView, setActiveSubView] = useState<'CORRIDORS' | 'HEATMAP' | 'GOOGLE_MAPS'>('HEATMAP');
  const [hoveredLane, setHoveredLane] = useState<TransportLane | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'AIR' | 'SEA' | 'ROAD' | 'ALERTS'>('ALL');

  const visibleLanes = lanes.filter(l => {
    if (filterMode === 'AIR') return l.mode === 'Air';
    if (filterMode === 'SEA') return l.mode === 'Sea';
    if (filterMode === 'ROAD') return l.mode === 'Road' || l.mode === 'Multimodal';
    if (filterMode === 'ALERTS') return l.riskScore >= 40 || l.status === 'Temperature Alert' || l.status === 'Delayed';
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg mb-6 relative overflow-hidden">
      
      {/* Header & Sub-View Switcher Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Global Cold-Chain Network & Thermal Risk Map
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
                {visibleLanes.length} Active Routes
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Multi-modal corridor tracking, regional microclimate heatmaps, and Google Maps GIS intelligence
            </p>
          </div>
        </div>

        {/* Sub-View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubView('HEATMAP')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeSubView === 'HEATMAP'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            Regional Thermal Heatmap
          </button>

          <button
            onClick={() => setActiveSubView('CORRIDORS')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeSubView === 'CORRIDORS'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            Global Corridors & Telemetry
          </button>

          <button
            onClick={() => setActiveSubView('GOOGLE_MAPS')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeSubView === 'GOOGLE_MAPS'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5 text-blue-400" />
            Google Maps (Optional)
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: REGIONAL TEMPERATURE HEATMAP OVERLAY */}
      {activeSubView === 'HEATMAP' && (
        <RegionalTemperatureHeatmapView
          lanes={visibleLanes}
          selectedLaneId={selectedLaneId}
          onSelectLane={onSelectLane}
        />
      )}

      {/* SUB-VIEW 2: GOOGLE MAPS PLATFORM GIS */}
      {activeSubView === 'GOOGLE_MAPS' && (
        <GoogleMapsNetworkView
          lanes={visibleLanes}
          selectedLaneId={selectedLaneId}
          onSelectLane={onSelectLane}
          showThermalHeatmap={true}
          onOpenApiKeyHelp={onOpenGoogleMapsConfig}
        />
      )}

      {/* SUB-VIEW 3: TACTICAL SVG CORRIDORS & FLIGHT ARCS */}
      {activeSubView === 'CORRIDORS' && (
        <div>
          {/* Mode Filters Bar */}
          <div className="flex items-center justify-between mb-3 bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium mr-1">Corridor Filter:</span>
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  filterMode === 'ALL' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Corridors ({lanes.length})
              </button>
              <button
                onClick={() => setFilterMode('AIR')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  filterMode === 'AIR' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Air (✈️)
              </button>
              <button
                onClick={() => setFilterMode('SEA')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  filterMode === 'SEA' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sea (🚢)
              </button>
              <button
                onClick={() => setFilterMode('ALERTS')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  filterMode === 'ALERTS' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Alerts Only (⚠️)
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-[2/1] min-h-[300px] max-h-[460px] bg-slate-950/90 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 1000 500" className="w-full h-full object-cover select-none">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
                </pattern>
                
                <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <rect width="1000" height="500" fill="#090e17" />
              <rect width="1000" height="500" fill="url(#grid)" />

              {/* Continents */}
              <g fill="#132032" stroke="#1e324a" strokeWidth="0.8" opacity="0.6">
                <path d="M 120 90 Q 200 80 260 110 T 320 160 Q 290 220 220 250 T 170 230 Q 140 180 120 90 Z" />
                <path d="M 270 270 Q 340 290 320 380 T 260 460 Q 240 400 250 320 Z" />
                <path d="M 460 100 Q 550 90 560 140 T 490 200 Q 450 180 460 100 Z" />
                <path d="M 470 210 Q 560 210 570 300 T 520 420 Q 460 380 450 280 Z" />
                <path d="M 570 90 Q 750 80 840 140 T 800 280 Q 680 260 620 200 Z" />
                <path d="M 770 340 Q 860 330 870 400 T 780 430 Q 750 380 770 340 Z" />
              </g>

              {/* Weather Hazard Disruption Zones */}
              <ellipse cx="360" cy="140" rx="45" ry="25" fill="#f43f5e" fillOpacity="0.08" stroke="#f43f5e" strokeDasharray="3,3" strokeWidth="1">
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
              </ellipse>
              <text x="360" y="143" fill="#fda4af" fontSize="9" textAnchor="middle" fontWeight="bold">⚠️ Cyclone Alert</text>

              <ellipse cx="780" cy="205" rx="35" ry="20" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeDasharray="3,3" strokeWidth="1">
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.5s" repeatCount="indefinite" />
              </ellipse>
              <text x="780" y="208" fill="#fde68a" fontSize="8" textAnchor="middle" fontWeight="bold">Port Delay +48h</text>

              {/* Route Arcs */}
              {visibleLanes.map((lane) => {
                const [x1, y1] = projectCoordinates(lane.originCoords[0], lane.originCoords[1]);
                const [x2, y2] = projectCoordinates(lane.destinationCoords[0], lane.destinationCoords[1]);

                const isSelected = selectedLaneId === lane.id;
                const isCritical = lane.status === 'Temperature Alert' || lane.riskScore >= 50;
                const isWarning = lane.riskScore >= 30 || lane.status === 'Delayed';

                const midX = (x1 + x2) / 2;
                const midY = Math.min(y1, y2) - Math.abs(x1 - x2) * 0.18;
                const pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

                const t = lane.transitProgress / 100;
                const curX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
                const curY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;

                const strokeColor = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';

                return (
                  <g key={lane.id} className="cursor-pointer" onClick={() => onSelectLane(lane)}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="20"
                      onMouseEnter={() => setHoveredLane(lane)}
                      onMouseLeave={() => setHoveredLane(null)}
                    />

                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3.5 : 2}
                      strokeOpacity={isSelected ? 1 : 0.75}
                      strokeDasharray={lane.mode === 'Sea' ? '4,4' : undefined}
                      filter={isSelected || isCritical ? (isCritical ? 'url(#glow-rose)' : 'url(#glow-emerald)') : undefined}
                    />

                    <circle cx={x1} cy={y1} r={isSelected ? 4.5 : 3.5} fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />
                    <text x={x1} y={y1 - 6} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">
                      {lane.originIata}
                    </text>

                    <circle cx={x2} cy={y2} r={isSelected ? 4.5 : 3.5} fill="#a855f7" stroke="#0f172a" strokeWidth="1" />
                    <text x={x2} y={y2 - 6} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">
                      {lane.destinationIata}
                    </text>

                    <g transform={`translate(${curX}, ${curY})`}>
                      <circle
                        r={isSelected ? 7 : 5}
                        fill={strokeColor}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="animate-pulse"
                      />
                      {isCritical && (
                        <circle r="11" fill="none" stroke="#f43f5e" strokeWidth="1.5" opacity="0.8">
                          <animate attributeName="r" values="6;16;6" dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.9;0;0.9" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* Hovered Lane Quick-Info Popup */}
            {(hoveredLane || (selectedLaneId && lanes.find(l => l.id === selectedLaneId))) && (
              <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md max-w-xs text-xs text-slate-200 z-10 transition-all pointer-events-none">
                {(() => {
                  const active = hoveredLane || lanes.find(l => l.id === selectedLaneId)!;
                  return (
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                        <span className="font-bold text-white text-sm flex items-center gap-1.5">
                          {active.laneCode}
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {active.mode}
                          </span>
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          active.riskScore >= 50 ? 'bg-rose-500/20 text-rose-300' : active.riskScore >= 25 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          Risk {active.riskScore}%
                        </span>
                      </div>
                      <div className="text-slate-300 font-medium">
                        {active.originCity} ({active.originIata}) → {active.destinationCity} ({active.destinationIata})
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {active.carrier} • {active.productName}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800">
                        <span>Temp: <strong className={active.currentTemp > active.tempMax || active.currentTemp < active.tempMin ? 'text-rose-400' : 'text-emerald-400'}>{active.currentTemp}°C</strong></span>
                        <span>Progress: <strong>{active.transitProgress}%</strong></span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
