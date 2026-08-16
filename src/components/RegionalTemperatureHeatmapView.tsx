import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker, Line } from 'react-simple-maps';
import {
  Flame,
  Thermometer,
  Sun,
  Droplets,
  Wind,
  AlertTriangle,
  ShieldAlert,
  Layers,
  Eye,
  Sliders,
  Info,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Snowflake,
  ExternalLink,
  Settings2,
  Route as RouteIcon,
  X,
} from 'lucide-react';
import { TransportLane, RegionalThermalHotspot, HeatmapConfig } from '../types';
import { REGIONAL_THERMAL_HOTSPOTS, getThermalRiskColor } from '../data/temperatureRiskData';
import { isLaneExcursing } from '../utils/laneRisk';
import { haversineKm } from '../utils/geoMath';
import { HOTSPOT_INFLUENCE_RADIUS_KM } from '../utils/riskAssessment';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// react-simple-maps takes [lng, lat]; the rest of the app stores coords as [lat, lng].
const toLngLat = (coords: [number, number]): [number, number] => [coords[1], coords[0]];

interface RegionalTemperatureHeatmapViewProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
}

export const RegionalTemperatureHeatmapView: React.FC<RegionalTemperatureHeatmapViewProps> = ({
  lanes,
  selectedLaneId,
  onSelectLane,
}) => {
  const [selectedHotspot, setSelectedHotspot] = useState<RegionalThermalHotspot | null>(
    REGIONAL_THERMAL_HOTSPOTS[0]
  );
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'EXTREME' | 'HIGH' | 'FREEZE'>('ALL');
  const [opacity, setOpacity] = useState<number>(0.85);
  const [showContours, setShowContours] = useState<boolean>(true);
  const [showLaneCorridors, setShowLaneCorridors] = useState<boolean>(true);
  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const excursionCount = lanes.filter(isLaneExcursing).length;

  // REGIONAL_THERMAL_HOTSPOTS.affectedLaneCodes is illustrative mock data seeded with lane codes
  // that don't correspond to any real transport_lanes row — clicking one would find nothing. This
  // derives the real set instead: any live lane whose origin, an intermediate stop, or its
  // destination falls within the hotspot's influence radius (the same threshold assessRoute uses
  // to flag a leg) genuinely traverses this zone.
  const realAffectedLaneCodes = useMemo(() => {
    if (!selectedHotspot) return [];
    return lanes
      .filter((lane) => {
        const points: [number, number][] = [lane.originCoords, ...lane.stops.map((s) => s.coords), lane.destinationCoords];
        return points.some((p) => haversineKm(p, selectedHotspot.coords) <= HOTSPOT_INFLUENCE_RADIUS_KM);
      })
      .map((lane) => lane.laneCode);
  }, [lanes, selectedHotspot]);

  const filteredHotspots = REGIONAL_THERMAL_HOTSPOTS.filter(h => {
    if (filterLevel === 'EXTREME') return h.thermalRiskLevel === 'Extreme Heat';
    if (filterLevel === 'HIGH') return h.thermalRiskLevel === 'High Heat' || h.thermalRiskLevel === 'Extreme Heat';
    if (filterLevel === 'FREEZE') return h.thermalRiskLevel === 'Sub-Zero Freeze';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Primary Interactive Heatmap Display */}
      <div className="relative w-full aspect-[2/1] min-h-[340px] max-h-[480px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        
        <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: '100%', height: '100%' }}>
          <defs>
            {/* Radial Thermal Gradients for each hotspot */}
            {REGIONAL_THERMAL_HOTSPOTS.map((h) => {
              const isFreeze = h.thermalRiskLevel === 'Sub-Zero Freeze';
              const isExtreme = h.thermalRiskLevel === 'Extreme Heat';
              const isHigh = h.thermalRiskLevel === 'High Heat';

              const centerColor = isExtreme ? '#ef4444' : isHigh ? '#f97316' : isFreeze ? '#6366f1' : '#eab308';
              const midColor = isExtreme ? '#f87171' : isHigh ? '#fb923c' : isFreeze ? '#818cf8' : '#facc15';

              return (
                <radialGradient
                  key={`grad-${h.id}`}
                  id={`heat-grad-${h.id}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                  fx="50%"
                  fy="50%"
                >
                  <stop offset="0%" stopColor={centerColor} stopOpacity={opacity * 0.9} />
                  <stop offset="35%" stopColor={midColor} stopOpacity={opacity * 0.65} />
                  <stop offset="70%" stopColor={midColor} stopOpacity={opacity * 0.25} />
                  <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
                </radialGradient>
              );
            })}

            {/* Gaussian Blur Filter for natural Heatmap Diffusion */}
            <filter id="thermal-diffusion" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Real Country Geography Base Map */}
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#101927"
                  stroke="#1c2b3f"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#152238' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Thermal Heat Map Density Blobs (Layer 1) */}
          <g filter="url(#thermal-diffusion)">
            {filteredHotspots.map((h) => {
              const radius = h.thermalRiskLevel === 'Extreme Heat' ? 30 : h.thermalRiskLevel === 'High Heat' ? 24 : 20;
              return (
                <Marker key={`blob-${h.id}`} coordinates={toLngLat(h.coords)}>
                  <circle r={radius} fill={`url(#heat-grad-${h.id})`} />
                </Marker>
              );
            })}
          </g>

          {/* Thermal Isochrone Contour Rings (Layer 2) */}
          {showContours &&
            filteredHotspots.map((h) => {
              const isExtreme = h.thermalRiskLevel === 'Extreme Heat';
              const isFreeze = h.thermalRiskLevel === 'Sub-Zero Freeze';
              const ringColor = isExtreme ? '#f87171' : isFreeze ? '#818cf8' : '#fb923c';

              return (
                <Marker key={`contour-${h.id}`} coordinates={toLngLat(h.coords)}>
                  <g opacity="0.6">
                    <circle r="13" fill="none" stroke={ringColor} strokeWidth="0.8" strokeDasharray="3,3" />
                    <circle r="22" fill="none" stroke={ringColor} strokeWidth="0.5" strokeOpacity="0.5" />
                  </g>
                </Marker>
              );
            })}

          {/* Active Lane Corridors overlay (Layer 3), through any intermediate stops */}
          {showLaneCorridors &&
            lanes.map((lane) => {
              const points: [number, number][] = [lane.originCoords, ...lane.stops.map((s) => s.coords), lane.destinationCoords];
              const isSelected = selectedLaneId === lane.id;

              return (
                <g key={`lane-arc-${lane.id}`} onClick={() => onSelectLane(lane)} className="cursor-pointer">
                  {points.slice(0, -1).map((p, i) => (
                    <Line
                      key={i}
                      from={toLngLat(p)}
                      to={toLngLat(points[i + 1])}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? 2.5 : 1.2}
                      strokeOpacity={isSelected ? 0.9 : 0.35}
                      strokeDasharray="4,4"
                    />
                  ))}
                </g>
              );
            })}

          {/* Thermal Hotspot Markers & Telemetry Pins (Layer 4) */}
          {filteredHotspots.map((h) => {
            const isSelected = selectedHotspot?.id === h.id;
            const isExtreme = h.thermalRiskLevel === 'Extreme Heat';
            const isFreeze = h.thermalRiskLevel === 'Sub-Zero Freeze';
            const badgeBg = isExtreme ? '#dc2626' : isFreeze ? '#4f46e5' : '#ea580c';

            return (
              <Marker
                key={`pin-${h.id}`}
                coordinates={toLngLat(h.coords)}
                onClick={() => setSelectedHotspot(h)}
                className="cursor-pointer group"
              >
                {/* Pulse Ring for Extreme & Freeze */}
                {(isExtreme || isFreeze) && (
                  <circle r={isSelected ? 16 : 12} fill="none" stroke={badgeBg} strokeWidth="1.5" opacity="0.8">
                    <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Hotspot Core Pin */}
                <circle
                  r={isSelected ? 8 : 6}
                  fill={badgeBg}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2 : 1}
                  className="transition-transform group-hover:scale-125"
                />

                {/* Temperature Label */}
                <rect
                  x="-18"
                  y={isSelected ? '-24' : '-20'}
                  width="36"
                  height="14"
                  rx="3"
                  fill="#090e17"
                  fillOpacity="0.9"
                  stroke={badgeBg}
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y={isSelected ? '-14' : '-10'}
                  fill="#ffffff"
                  fontSize="8"
                  textAnchor="middle"
                  fontWeight="bold"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {h.ambientTempC > 0 ? `+${h.ambientTempC}` : h.ambientTempC}°
                </text>
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Single Floating Summary Card — route/excursion counts + a gear icon that reveals the
            detailed hazard filters, replacing what used to be a permanently-visible filter bar
            above the map. */}
        <div ref={popoverRef} className="absolute bottom-3 right-3 z-20">
          {showFilterPopover && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-400" /> Map Filters
                </span>
                <button onClick={() => setShowFilterPopover(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400" aria-label="Close filters">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <div className="text-slate-400 mb-1.5">Thermal Hazard Filter</div>
                <div className="flex flex-col gap-1">
                  {([
                    ['ALL', `All Zones (${REGIONAL_THERMAL_HOTSPOTS.length})`],
                    ['EXTREME', 'Extreme Heat (>40°C)'],
                    ['HIGH', 'High Heat (>30°C)'],
                    ['FREEZE', 'Polar Freeze (<0°C)'],
                  ] as const).map(([level, label]) => (
                    <button
                      key={level}
                      onClick={() => setFilterLevel(level)}
                      className={`px-2.5 py-1.5 rounded text-left font-medium transition-all ${
                        filterLevel === level ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showContours}
                    onChange={(e) => setShowContours(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0"
                  />
                  <span className="text-slate-300">Thermal Isochrones</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showLaneCorridors}
                    onChange={(e) => setShowLaneCorridors(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0"
                  />
                  <span className="text-slate-300">Lane Trajectories</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <span className="text-slate-400">Heat Density:</span>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="flex-1 accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-[11px] text-slate-400 w-9 text-right">{Math.round(opacity * 100)}%</span>
              </div>
            </div>
          )}

          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 shadow-xl max-w-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5">
                <RouteIcon className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-bold text-slate-100">{lanes.length}</span>
                <span className="text-slate-500">routes</span>
              </div>
              <div className="w-px h-4 bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`w-3.5 h-3.5 ${excursionCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
                <span className={`font-bold ${excursionCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>{excursionCount}</span>
                <span className="text-slate-500">excursions</span>
              </div>
              <button
                onClick={() => setShowFilterPopover((v) => !v)}
                className="ml-auto p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                aria-label="Map filters"
                title="Map filters"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Color Gradient Bar */}
            <div className="h-2 rounded-full w-full bg-gradient-to-r from-indigo-500 via-emerald-500 via-amber-400 via-orange-500 to-rose-600 mb-1.5" />
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>&lt;0°C</span>
              <span>2°-8°C</span>
              <span>25°C</span>
              <span>&gt;45°C</span>
            </div>
          </div>
        </div>

      </div>

      {/* Selected Hotspot Detailed Telemetry & Risk Mitigation Card */}
      {selectedHotspot && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                selectedHotspot.thermalRiskLevel === 'Extreme Heat'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : selectedHotspot.thermalRiskLevel === 'Sub-Zero Freeze'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}>
                {selectedHotspot.thermalRiskLevel === 'Sub-Zero Freeze' ? (
                  <Snowflake className="w-6 h-6" />
                ) : (
                  <Flame className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100">
                    {selectedHotspot.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getThermalRiskColor(selectedHotspot.thermalRiskLevel).badgeBg} ${getThermalRiskColor(selectedHotspot.thermalRiskLevel).badgeText}`}>
                    {selectedHotspot.thermalRiskLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedHotspot.region} • Hotspot Risk Score: <strong className="text-rose-400">{selectedHotspot.riskScore}/100</strong>
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
              <div className="px-2.5 py-1 text-center border-r border-slate-800">
                <div className="text-[10px] text-slate-400">Ambient Temp</div>
                <div className="font-mono font-bold text-slate-100">{selectedHotspot.ambientTempC}°C</div>
              </div>
              <div className="px-2.5 py-1 text-center border-r border-slate-800">
                <div className="text-[10px] text-slate-400">Ramp Surface</div>
                <div className="font-mono font-bold text-rose-400">{selectedHotspot.rampSurfaceTempC}°C</div>
              </div>
              <div className="px-2.5 py-1 text-center border-r border-slate-800">
                <div className="text-[10px] text-slate-400">Humidity</div>
                <div className="font-mono font-bold text-sky-400">{selectedHotspot.humidityPercent}%</div>
              </div>
              <div className="px-2.5 py-1 text-center">
                <div className="text-[10px] text-slate-400">Max Exposure</div>
                <div className="font-mono font-bold text-amber-400">{selectedHotspot.tarmacExposureRiskMins}m</div>
              </div>
            </div>
          </div>

          {/* Facility & Cold-Chain Protocol */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
              <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                CEIV Pharma Cold-Chain Infrastructure
              </div>
              <p className="text-slate-400 leading-relaxed mb-2">
                {selectedHotspot.coldStorageFacilityRating}
              </p>
              <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
                <strong className="text-teal-400">Action Protocol: </strong>
                {selectedHotspot.recommendation}
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-teal-400" />
                  Active Shipments Traversing This Zone ({realAffectedLaneCodes.length})
                </span>
              </div>
              {realAffectedLaneCodes.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-slate-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>No active lanes currently route through this zone.</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {realAffectedLaneCodes.map((code) => {
                      const matchedLane = lanes.find(l => l.laneCode === code);
                      return (
                        <button
                          key={code}
                          onClick={() => matchedLane && onSelectLane(matchedLane)}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px] flex items-center gap-1 transition-colors"
                        >
                          {code}
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Click any lane code above to inspect real-time core telemetry and thermal margin status.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
