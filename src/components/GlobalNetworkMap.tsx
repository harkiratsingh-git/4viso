import React, { useState } from 'react';
import {
  Globe2,
  Layers,
  Flame
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

          <WorldRouteMap lanes={visibleLanes} selectedLaneId={selectedLaneId} onSelectLane={onSelectLane} />
        </div>
      )}

    </div>
  );
};
