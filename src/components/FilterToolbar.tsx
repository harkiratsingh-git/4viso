import React from 'react';
import { 
  Filter, 
  RotateCcw, 
  ThermometerSnowflake, 
  AlertTriangle, 
  Plane, 
  Ship, 
  Truck, 
  Layers, 
  Sparkles 
} from 'lucide-react';
import { FilterState, TransportMode, RiskLevel, GdpStatus } from '../types';

interface FilterToolbarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onResetFilters: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
}) => {
  const isFiltered = 
    filters.mode !== 'All' || 
    filters.riskSeverity !== 'All' || 
    filters.tempStatus !== 'All' || 
    filters.gdpStatus !== 'All' ||
    filters.productCategory !== 'All' ||
    filters.showOnlyAlerts ||
    filters.searchQuery !== '';

  const handleModeChange = (mode: 'All' | TransportMode) => {
    onFilterChange({ ...filters, mode });
  };

  const handleRiskChange = (riskSeverity: 'All' | RiskLevel) => {
    onFilterChange({ ...filters, riskSeverity });
  };

  const handleTempStatusChange = (tempStatus: 'All' | 'Compliant' | 'Warning' | 'Excursion') => {
    onFilterChange({ ...filters, tempStatus });
  };

  const applyPreset = (preset: 'EXCURSIONS' | 'AIR_CRITICAL' | 'CRYO' | 'GDP_WARNINGS') => {
    switch (preset) {
      case 'EXCURSIONS':
        onFilterChange({
          ...filters,
          tempStatus: 'Excursion',
          showOnlyAlerts: true,
        });
        break;
      case 'AIR_CRITICAL':
        onFilterChange({
          ...filters,
          mode: 'Air',
          riskSeverity: 'High',
          showOnlyAlerts: false,
        });
        break;
      case 'CRYO':
        onFilterChange({
          ...filters,
          productCategory: 'Cell Therapy',
          showOnlyAlerts: false,
        });
        break;
      case 'GDP_WARNINGS':
        onFilterChange({
          ...filters,
          gdpStatus: 'Warning',
          showOnlyAlerts: false,
        });
        break;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md mb-6 transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        
        {/* Title & Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Customizable Data Filters</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">Presets:</span>
            <button
              onClick={() => applyPreset('EXCURSIONS')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Active Excursions</span>
            </button>
            <button
              onClick={() => applyPreset('AIR_CRITICAL')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all flex items-center gap-1"
            >
              <Plane className="w-3 h-3 text-sky-400" />
              <span>High-Risk Air</span>
            </button>
            <button
              onClick={() => applyPreset('CRYO')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1"
            >
              <ThermometerSnowflake className="w-3 h-3 text-cyan-400" />
              <span>Cryo & Cell Therapy</span>
            </button>
          </div>
        </div>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>

      {/* Filter Selectors Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        
        {/* Mode Selector */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Transport Mode
          </label>
          <select
            value={filters.mode}
            onChange={(e) => handleModeChange(e.target.value as any)}
            className="w-full bg-slate-950 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Modes (Air, Sea, Road, Multi)</option>
            <option value="Air">✈️ Air Express & Charter</option>
            <option value="Sea">🚢 Sea Freight Reefer</option>
            <option value="Road">🚛 Road Pharma Carrier</option>
            <option value="Multimodal">🔄 Multimodal Intermodal</option>
          </select>
        </div>

        {/* Risk Severity Selector */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Risk Severity
          </label>
          <select
            value={filters.riskSeverity}
            onChange={(e) => handleRiskChange(e.target.value as any)}
            className="w-full bg-slate-950 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Risk Levels</option>
            <option value="Critical">🔴 Critical (Score &gt; 50%)</option>
            <option value="High">🟠 High Risk (Score &gt; 40%)</option>
            <option value="Medium">🟡 Medium (Score 20-40%)</option>
            <option value="Low">🟢 Low Risk (Score &lt; 20%)</option>
          </select>
        </div>

        {/* Temperature Status */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Temperature Status
          </label>
          <select
            value={filters.tempStatus}
            onChange={(e) => handleTempStatusChange(e.target.value as any)}
            className="w-full bg-slate-950 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Temperature States</option>
            <option value="Compliant">🟢 In Range (Normal)</option>
            <option value="Warning">🟡 Approaching Limit</option>
            <option value="Excursion">🔴 Active Excursion / Breach</option>
          </select>
        </div>

        {/* Product Category Selector */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Product Category
          </label>
          <select
            value={filters.productCategory}
            onChange={(e) => onFilterChange({ ...filters, productCategory: e.target.value })}
            className="w-full bg-slate-950 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Pharmaceutical Categories</option>
            <option value="Vaccines">mRNA & Viral Vaccines</option>
            <option value="Biologics">Monoclonal Antibodies & Biologics</option>
            <option value="Insulin">Recombinant Insulin</option>
            <option value="Cell Therapy">CAR-T & Gene Therapies</option>
            <option value="Active Ingredients">Active Pharmaceutical Ingredients (API)</option>
          </select>
        </div>

      </div>
    </div>
  );
};
