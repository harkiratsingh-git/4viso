import React, { useState, useRef, useEffect } from 'react';
import {
  Globe2,
  Layers,
  Flame,
  Filter,
  Settings2,
} from 'lucide-react';
import { TransportLane } from '../types';
import { RegionalTemperatureHeatmapView } from './RegionalTemperatureHeatmapView';
import { WorldRouteMap } from './WorldRouteMap';
import { isLaneHighRisk, isLaneExcursing } from '../utils/laneRisk';

interface GlobalNetworkMapProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
}

export const GlobalNetworkMap: React.FC<GlobalNetworkMapProps> = ({
  lanes,
  selectedLaneId,
  onSelectLane,
}) => {
  const [activeSubView, setActiveSubView] = useState<'CORRIDORS' | 'HEATMAP'>('HEATMAP');
  const [filterMode, setFilterMode] = useState<'ALL' | 'AIR' | 'SEA' | 'ROAD' | 'ALERTS'>('ALL');
  const [showCorridorFilterPopover, setShowCorridorFilterPopover] = useState(false);
  const corridorPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (corridorPopoverRef.current && !corridorPopoverRef.current.contains(e.target as Node)) {
        setShowCorridorFilterPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleLanes = lanes.filter(l => {
    if (filterMode === 'AIR') return l.mode === 'Air';
    if (filterMode === 'SEA') return l.mode === 'Sea';
    if (filterMode === 'ROAD') return l.mode === 'Road' || l.mode === 'Multimodal';
    if (filterMode === 'ALERTS') return isLaneHighRisk(l) || isLaneExcursing(l) || l.status === 'Delayed';
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
              Multi-modal corridor tracking and regional microclimate thermal heatmaps, both on real world geography
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
            World Map
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

      {/* SUB-VIEW 2: REAL-WORLD GEOGRAPHIC MAP */}
      {activeSubView === 'CORRIDORS' && (
        <div className="relative">
          {/* Single floating filter card (top-left, the only free corner — WorldRouteMap owns
              the other three) replaces what used to be a permanent filter bar above the map. */}
          <div ref={corridorPopoverRef} className="absolute top-3 left-3 z-20">
            {showCorridorFilterPopover && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100">
                {([
                  ['ALL', `All Corridors (${lanes.length})`],
                  ['AIR', 'Air (✈️)'],
                  ['SEA', 'Sea (🚢)'],
                  ['ALERTS', 'Alerts Only (⚠️)'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`w-full text-left px-2.5 py-1.5 rounded font-medium transition-all ${
                      filterMode === mode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowCorridorFilterPopover((v) => !v)}
              className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 shadow-xl hover:border-slate-600 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-bold text-slate-100">{visibleLanes.length}</span>
              <span className="text-slate-500">/ {lanes.length} corridors</span>
              <Settings2 className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>
          </div>

          <WorldRouteMap lanes={visibleLanes} selectedLaneId={selectedLaneId} onSelectLane={onSelectLane} />
        </div>
      )}

    </div>
  );
};
