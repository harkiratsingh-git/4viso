import React, { useEffect, useState } from 'react';
import {
  Filter,
  RotateCcw,
  ThermometerSnowflake,
  AlertTriangle,
  Plane,
  Ship,
  Truck,
  Layers,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';
import { FilterState, TransportMode, RiskLevel, GdpStatus } from '../types';
import { useThemeTokens } from '../contexts/ViewModeContext';

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
  const t = useThemeTokens();
  const selectClass = `w-full ${t.cardBgSunken} ${t.textSecondary} px-2.5 py-1.5 rounded-lg border ${t.light ? 'border-slate-300' : 'border-slate-700'} focus:outline-none focus:border-emerald-500`;
  const labelClass = `block text-[11px] font-medium ${t.textMuted} mb-1`;

  const isFiltered =
    filters.mode !== 'All' ||
    filters.riskSeverity !== 'All' ||
    filters.tempStatus !== 'All' ||
    filters.gdpStatus !== 'All' ||
    filters.productCategory !== 'All' ||
    filters.showOnlyAlerts ||
    filters.searchQuery !== '';

  // Miller's Law: the 4 advanced selectors stay collapsed by default and only the 3 quick
  // presets + search (in the top nav) are visible up front. Auto-expand if one of them is
  // already active (e.g. set programmatically from a dashboard tile) so state is never hidden.
  const advancedFilters: { key: string; label: string; clear: () => void }[] = [];
  if (filters.mode !== 'All') advancedFilters.push({ key: 'mode', label: `Mode: ${filters.mode}`, clear: () => onFilterChange({ ...filters, mode: 'All' }) });
  if (filters.riskSeverity !== 'All') advancedFilters.push({ key: 'risk', label: `Risk: ${filters.riskSeverity}`, clear: () => onFilterChange({ ...filters, riskSeverity: 'All' }) });
  if (filters.tempStatus !== 'All') advancedFilters.push({ key: 'temp', label: `Temp: ${filters.tempStatus}`, clear: () => onFilterChange({ ...filters, tempStatus: 'All' }) });
  if (filters.productCategory !== 'All') advancedFilters.push({ key: 'product', label: `Product: ${filters.productCategory}`, clear: () => onFilterChange({ ...filters, productCategory: 'All' }) });

  const [showMoreFilters, setShowMoreFilters] = useState(advancedFilters.length > 0);
  useEffect(() => {
    if (advancedFilters.length > 0) setShowMoreFilters(true);
  }, [advancedFilters.length]);

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
    <div className={`${t.cardBg} border ${t.border} rounded-xl p-4 shadow-md mb-6 transition-all`}>
      <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-3 pb-3 border-b ${t.border}`}>

        {/* Title & Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${t.textSecondary}`}>
            <Filter className={`w-4 h-4 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <span>Customizable Data Filters</span>
          </div>

          <div className={`h-4 w-px hidden sm:block ${t.light ? 'bg-slate-300' : 'bg-slate-800'}`} />

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] font-medium ${t.textMuted}`}>Presets:</span>
            <button
              onClick={() => applyPreset('EXCURSIONS')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 border ${
                t.light ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border-rose-300' : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
              }`}
            >
              <AlertTriangle className={`w-3 h-3 ${t.light ? 'text-rose-600' : 'text-rose-400'}`} />
              <span>Active Excursions</span>
            </button>
            <button
              onClick={() => applyPreset('AIR_CRITICAL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 border ${
                t.light ? 'bg-sky-100 hover:bg-sky-200 text-sky-700 border-sky-300' : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/30'
              }`}
            >
              <Plane className={`w-3 h-3 ${t.light ? 'text-sky-600' : 'text-sky-400'}`} />
              <span>High-Risk Air</span>
            </button>
            <button
              onClick={() => applyPreset('CRYO')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 border ${
                t.light ? 'bg-cyan-100 hover:bg-cyan-200 text-cyan-700 border-cyan-300' : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/30'
              }`}
            >
              <ThermometerSnowflake className={`w-3 h-3 ${t.light ? 'text-cyan-600' : 'text-cyan-400'}`} />
              <span>Cryo & Cell Therapy</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMoreFilters((v) => !v)}
            aria-expanded={showMoreFilters}
            className={`min-h-[32px] flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              t.light ? 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>More Filters</span>
            {advancedFilters.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 rounded-full ${t.light ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/25 text-emerald-300'}`}>{advancedFilters.length}</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Reset Filter Button */}
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors ${
                t.light ? 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Active advanced-filter chips — visible even while the selector grid is collapsed, so filtered state is never hidden */}
      {!showMoreFilters && advancedFilters.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 mb-3">
          {advancedFilters.map((f) => (
            <button
              key={f.key}
              onClick={f.clear}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border ${
                t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
            >
              <span>{f.label}</span>
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Filter Selectors Grid — collapsed behind "More Filters" (Miller's Law: 3 presets + search stay the only always-visible controls) */}
      {showMoreFilters && (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">

        {/* Mode Selector */}
        <div>
          <label className={labelClass}>Transport Mode</label>
          <select value={filters.mode} onChange={(e) => handleModeChange(e.target.value as any)} className={selectClass}>
            <option value="All">All Modes (Air, Sea, Road, Multi)</option>
            <option value="Air">✈️ Air Express & Charter</option>
            <option value="Sea">🚢 Sea Freight Reefer</option>
            <option value="Road">🚛 Road Pharma Carrier</option>
            <option value="Multimodal">🔄 Multimodal Intermodal</option>
          </select>
        </div>

        {/* Risk Severity Selector */}
        <div>
          <label className={labelClass}>Risk Severity</label>
          <select value={filters.riskSeverity} onChange={(e) => handleRiskChange(e.target.value as any)} className={selectClass}>
            <option value="All">All Risk Levels</option>
            <option value="Critical">🔴 Critical (Score &gt; 50%)</option>
            <option value="High">🟠 High Risk (Score &gt; 40%)</option>
            <option value="Medium">🟡 Medium (Score 20-40%)</option>
            <option value="Low">🟢 Low Risk (Score &lt; 20%)</option>
          </select>
        </div>

        {/* Temperature Status */}
        <div>
          <label className={labelClass}>Temperature Status</label>
          <select value={filters.tempStatus} onChange={(e) => handleTempStatusChange(e.target.value as any)} className={selectClass}>
            <option value="All">All Temperature States</option>
            <option value="Compliant">🟢 In Range (Normal)</option>
            <option value="Warning">🟡 Approaching Limit</option>
            <option value="Excursion">🔴 Active Excursion / Breach</option>
          </select>
        </div>

        {/* Product Category Selector */}
        <div>
          <label className={labelClass}>Product Category</label>
          <select value={filters.productCategory} onChange={(e) => onFilterChange({ ...filters, productCategory: e.target.value })} className={selectClass}>
            <option value="All">All Pharmaceutical Categories</option>
            <option value="Vaccines">mRNA & Viral Vaccines</option>
            <option value="Biologics">Monoclonal Antibodies & Biologics</option>
            <option value="Insulin">Recombinant Insulin</option>
            <option value="Cell Therapy">CAR-T & Gene Therapies</option>
            <option value="Active Ingredients">Active Pharmaceutical Ingredients (API)</option>
          </select>
        </div>

      </div>
      )}
    </div>
  );
};
