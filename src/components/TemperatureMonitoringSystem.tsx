import React, { useState, useEffect } from 'react';
import {
  X,
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun,
  Activity,
  BatteryCharging,
  Droplets,
  Zap,
  CheckCircle2,
  Sliders,
  Download,
} from 'lucide-react';
import { TransportLane, TemperatureReading } from '../types';
import { useThemeTokens, ThemeTokens } from '../contexts/ViewModeContext';

interface TemperatureMonitoringSystemProps {
  lane: TransportLane;
  onClose: () => void;
  onUpdateLaneTemp: (laneId: string, newTemp: number, isExcursion: boolean) => void;
  onOpenReports: () => void;
}

function chartColors(t: ThemeTokens) {
  return t.light
    ? { safeBandText: '#059669', maxLabel: '#e11d48', minLabel: '#0284c7', pointLabel: '#1e293b', timeLabel: '#64748b', pointStroke: '#f8fafc', safeBandOpacity: 0.12 }
    : { safeBandText: '#6ee7b7', maxLabel: '#fda4af', minLabel: '#bae6fd', pointLabel: '#e2e8f0', timeLabel: '#64748b', pointStroke: '#0f172a', safeBandOpacity: 0.09 };
}

export const TemperatureMonitoringSystem: React.FC<TemperatureMonitoringSystemProps> = ({
  lane,
  onClose,
  onUpdateLaneTemp,
  onOpenReports,
}) => {
  const t = useThemeTokens();
  const colors = chartColors(t);
  const [activeProbe, setActiveProbe] = useState<'core' | 'ambient' | 'surface'>('core');
  const [reeferSetpoint, setReeferSetpoint] = useState<number>(lane.tempRangeType.includes('-20') ? -20 : lane.tempRangeType.includes('-80') ? -80 : 4.0);
  const [isChillerBoostActive, setIsChillerBoostActive] = useState<boolean>(false);
  const [controlActionMessage, setControlActionMessage] = useState<string | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TemperatureReading[]>(lane.temperatureHistory);

  // Sync telemetry if parent lane updates
  useEffect(() => {
    setTelemetryHistory(lane.temperatureHistory);
  }, [lane.temperatureHistory]);

  const latestReading = telemetryHistory[telemetryHistory.length - 1] || {
    coreTemp: lane.currentTemp,
    ambientTemp: 22.4,
    surfaceTemp: lane.currentTemp + 0.3,
    humidity: 48,
    batteryLevel: 94,
    shockG: 0.2,
    isExcursion: lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin,
  };

  const isExcursion = latestReading.coreTemp > lane.tempMax || latestReading.coreTemp < lane.tempMin;
  const isWarning = !isExcursion && (latestReading.coreTemp >= lane.tempMax - 0.5 || latestReading.coreTemp <= lane.tempMin + 0.5);

  // Simulate applying temperature control (cooling down / adjusting reefer)
  const handleApplyControl = (actionType: 'SET_SETPOINT' | 'BOOST_COOLING' | 'EMERGENCY_DRY_ICE') => {
    let newTemp = latestReading.coreTemp;
    let msg = '';

    if (actionType === 'SET_SETPOINT') {
      newTemp = Number(((latestReading.coreTemp + reeferSetpoint) / 2).toFixed(1));
      msg = `Reefer setpoint calibrated to ${reeferSetpoint}°C. Compressor cycle adjusted.`;
    } else if (actionType === 'BOOST_COOLING') {
      setIsChillerBoostActive(true);
      newTemp = Math.max(lane.tempMin + 0.5, Number((latestReading.coreTemp - 2.5).toFixed(1)));
      msg = `High-capacity auxiliary chiller boosted. Rapid pull-down cooling active (-2.5°C).`;
      setTimeout(() => setIsChillerBoostActive(false), 5000);
    } else if (actionType === 'EMERGENCY_DRY_ICE') {
      newTemp = Number(((lane.tempMin + lane.tempMax) / 2).toFixed(1));
      msg = `Emergency dry-ice booster pack replenishment logged. Core returned to ${newTemp}°C.`;
    }

    const excursionState = newTemp > lane.tempMax || newTemp < lane.tempMin;
    onUpdateLaneTemp(lane.id, newTemp, excursionState);

    // Append new reading to chart
    const newReading: TemperatureReading = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coreTemp: newTemp,
      ambientTemp: latestReading.ambientTemp - 1.2,
      surfaceTemp: newTemp + 0.2,
      minPermitted: lane.tempMin,
      maxPermitted: lane.tempMax,
      humidity: latestReading.humidity,
      batteryLevel: Math.max(10, latestReading.batteryLevel - 1),
      shockG: 0.1,
      isExcursion: excursionState,
    };

    setTelemetryHistory(prev => [...prev.slice(-7), newReading]);
    setControlActionMessage(msg);
    setTimeout(() => setControlActionMessage(null), 4000);
  };

  // SVG Chart Calculations
  const chartPoints = telemetryHistory;
  const minVal = Math.min(...chartPoints.map(p => Math.min(p.coreTemp, p.ambientTemp, lane.tempMin - 2)));
  const maxVal = Math.max(...chartPoints.map(p => Math.max(p.coreTemp, p.ambientTemp, lane.tempMax + 2)));
  const range = maxVal - minVal || 1;

  const getY = (val: number) => {
    return 180 - ((val - minVal) / range) * 140;
  };

  const safeZoneTop = getY(lane.tempMax);
  const safeZoneBottom = getY(lane.tempMin);
  const safeZoneHeight = Math.abs(safeZoneBottom - safeZoneTop);

  const kpiCardClass = `${t.cardBgSunken} border ${t.border} p-3 rounded-xl flex flex-col justify-between`;
  const kpiLabelClass = `text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${t.textFaint}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>

        {/* Header */}
        <div className={`p-4 sm:p-5 ${t.cardBgSunken} border-b ${t.border} flex items-start justify-between gap-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isExcursion
                ? t.light ? 'bg-rose-100 text-rose-600 border-rose-300 animate-pulse' : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                : t.light ? 'bg-teal-100 text-teal-600 border-teal-300' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'
            }`}>
              <ThermometerSnowflake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-lg sm:text-xl font-extrabold ${t.textPrimary}`}>
                  Environmental Integrity & Temperature Control
                </h2>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${t.chipBg} ${t.light ? 'text-teal-700' : 'text-teal-300'} ${t.light ? 'border-slate-300' : 'border-slate-700'}`}>
                  {lane.laneCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                  isExcursion
                    ? t.light ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : isWarning
                    ? t.light ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {isExcursion ? '🔴 THERMAL EXCURSION' : isWarning ? '🟡 UPPER WARNING' : '🟢 WITHIN GDP SPEC'}
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-0.5 ${t.textMuted}`}>
                Target Envelope: <strong className={t.textSecondary}>{lane.tempMin}°C to {lane.tempMax}°C</strong> ({lane.tempRangeType}) • Carrier: <strong className={t.textSecondary}>{lane.carrier}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${t.chipBg} ${t.hoverBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Feedback Toast */}
          {controlActionMessage && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2 border ${
              t.light ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-teal-950/80 border-teal-500/50 text-teal-200'
            }`}>
              <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
              <span>{controlActionMessage}</span>
            </div>
          )}

          {/* Telemetry Sensor KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

            {/* Core Payload Temp */}
            <div className={kpiCardClass}>
              <div className={kpiLabelClass}>
                <span>Core Temp</span>
                <Thermometer className={`w-3.5 h-3.5 ${t.light ? 'text-rose-500' : 'text-rose-400'}`} />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${
                isExcursion ? (t.light ? 'text-rose-600 animate-pulse' : 'text-rose-400 animate-pulse') : isWarning ? (t.light ? 'text-amber-600' : 'text-amber-400') : (t.light ? 'text-emerald-600' : 'text-emerald-400')
              }`}>
                {latestReading.coreTemp}°C
              </div>
              <div className={`text-[10px] ${t.textMuted}`}>
                Probe T-01 (Core)
              </div>
            </div>

            {/* Mean Kinetic Temp (MKT) */}
            <div className={kpiCardClass}>
              <div className={kpiLabelClass}>
                <span>MKT (Mean)</span>
                <Activity className={`w-3.5 h-3.5 ${t.light ? 'text-teal-500' : 'text-teal-400'}`} />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${t.light ? 'text-teal-600' : 'text-teal-300'}`}>
                {lane.mktTemp}°C
              </div>
              <div className={`text-[10px] ${t.textMuted}`}>
                USP &lt;1079&gt; Calculated
              </div>
            </div>

            {/* Ambient Hold Temp */}
            <div className={kpiCardClass}>
              <div className={kpiLabelClass}>
                <span>Ambient Hold</span>
                <ThermometerSun className={`w-3.5 h-3.5 ${t.light ? 'text-amber-500' : 'text-amber-400'}`} />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${t.textSecondary}`}>
                {latestReading.ambientTemp}°C
              </div>
              <div className={`text-[10px] ${t.textMuted}`}>
                Hold Delta: {(latestReading.ambientTemp - latestReading.coreTemp).toFixed(1)}°C
              </div>
            </div>

            {/* Relative Humidity */}
            <div className={kpiCardClass}>
              <div className={kpiLabelClass}>
                <span>Humidity</span>
                <Droplets className={`w-3.5 h-3.5 ${t.light ? 'text-sky-500' : 'text-sky-400'}`} />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${t.light ? 'text-sky-600' : 'text-sky-300'}`}>
                {latestReading.humidity}%
              </div>
              <div className={`text-[10px] font-medium ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>
                Within Spec (40-60%)
              </div>
            </div>

            {/* Shock & Tilt */}
            <div className={kpiCardClass}>
              <div className={kpiLabelClass}>
                <span>Shock (3-Axis)</span>
                <Zap className={`w-3.5 h-3.5 ${t.light ? 'text-purple-500' : 'text-purple-400'}`} />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${t.textSecondary}`}>
                {latestReading.shockG} G
              </div>
              <div className={`text-[10px] ${t.textMuted}`}>
                Threshold: &lt; {lane.thresholdAlerts.notifyOnShockAboveG} G
              </div>
            </div>

            {/* Battery & Beacon */}
            <div className={kpiCardClass}>
              <div className={kpiLabelClass}>
                <span>IoT Battery</span>
                <BatteryCharging className={`w-3.5 h-3.5 ${t.light ? 'text-emerald-500' : 'text-emerald-400'}`} />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${t.light ? 'text-emerald-600' : 'text-emerald-300'}`}>
                {latestReading.batteryLevel}%
              </div>
              <div className={`text-[10px] ${t.textMuted}`}>
                Satellite Uplink OK
              </div>
            </div>

          </div>

          {/* Real-Time Interactive Temperature Curve & Safe Band Graph */}
          <div className={`${t.cardBgSunken} border ${t.border} rounded-xl p-4`}>

            {/* Chart Header & Multi-Probe Selector */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b ${t.border}`}>
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${t.textPrimary}`}>
                  <Activity className={`w-4 h-4 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                  Continuous Temperature Profile & Excursion Safe-Zone
                </h3>
                <p className={`text-xs ${t.textMuted}`}>
                  Real-time telemetry plotted against calibrated GDP upper ({lane.tempMax}°C) and lower ({lane.tempMin}°C) thresholds
                </p>
              </div>

              {/* Probe Selector */}
              <div className={`flex items-center gap-1.5 p-1 rounded-lg border text-xs ${t.cardBg} ${t.light ? 'border-slate-300' : 'border-slate-700'}`}>
                <button
                  onClick={() => setActiveProbe('core')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeProbe === 'core'
                      ? t.light ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : `${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`
                  }`}
                >
                  Core Payload (Probe 1)
                </button>
                <button
                  onClick={() => setActiveProbe('ambient')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeProbe === 'ambient'
                      ? t.light ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : `${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`
                  }`}
                >
                  Ambient Container
                </button>
                <button
                  onClick={() => setActiveProbe('surface')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeProbe === 'surface'
                      ? t.light ? 'bg-sky-100 text-sky-700 border border-sky-300' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : `${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`
                  }`}
                >
                  Surface Shipper
                </button>
              </div>
            </div>

            {/* SVG Visual Graph */}
            <div className={`relative w-full h-52 rounded-lg border p-2 select-none overflow-hidden ${t.light ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800/80'}`}>
              <svg viewBox="0 0 600 200" className="w-full h-full">

                {/* Permissible Safe Band Background (Green Zone) */}
                <rect
                  x="40"
                  y={Math.min(safeZoneTop, safeZoneBottom)}
                  width="540"
                  height={safeZoneHeight}
                  fill="#10b981"
                  fillOpacity={colors.safeBandOpacity}
                  stroke="#10b981"
                  strokeOpacity="0.3"
                  strokeDasharray="2,2"
                />
                <text x="45" y={safeZoneTop + 14} fill={colors.safeBandText} fontSize="9" fontWeight="bold">
                  Safe Envelope ({lane.tempMin}°C - {lane.tempMax}°C)
                </text>

                {/* Upper Warning / Excursion Line */}
                <line x1="40" y1={safeZoneTop} x2="580" y2={safeZoneTop} stroke="#f43f5e" strokeWidth="1" strokeDasharray="3,3" />
                <text x="540" y={safeZoneTop - 4} fill={colors.maxLabel} fontSize="9" fontWeight="bold">
                  Max {lane.tempMax}°C
                </text>

                {/* Lower Limit Line */}
                <line x1="40" y1={safeZoneBottom} x2="580" y2={safeZoneBottom} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
                <text x="540" y={safeZoneBottom + 12} fill={colors.minLabel} fontSize="9" fontWeight="bold">
                  Min {lane.tempMin}°C
                </text>

                {/* Ambient Temperature Background Line (dashed orange) */}
                {activeProbe !== 'core' && (
                  <path
                    d={chartPoints.map((p, i) => {
                      const x = 50 + (i / Math.max(1, chartPoints.length - 1)) * 500;
                      const y = getY(p.ambientTemp);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    opacity="0.6"
                  />
                )}

                {/* Primary Plotted Line (Core or Surface) */}
                <path
                  d={chartPoints.map((p, i) => {
                    const val = activeProbe === 'ambient' ? p.ambientTemp : activeProbe === 'surface' ? p.surfaceTemp : p.coreTemp;
                    const x = 50 + (i / Math.max(1, chartPoints.length - 1)) * 500;
                    const y = getY(val);
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke={isExcursion ? '#f43f5e' : '#10b981'}
                  strokeWidth="2.5"
                />

                {/* Data Points */}
                {chartPoints.map((p, i) => {
                  const val = activeProbe === 'ambient' ? p.ambientTemp : activeProbe === 'surface' ? p.surfaceTemp : p.coreTemp;
                  const x = 50 + (i / Math.max(1, chartPoints.length - 1)) * 500;
                  const y = getY(val);
                  const isPointExcursion = val > lane.tempMax || val < lane.tempMin;

                  return (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={y}
                        r={i === chartPoints.length - 1 ? 5 : 3.5}
                        fill={isPointExcursion ? '#f43f5e' : '#10b981'}
                        stroke={colors.pointStroke}
                        strokeWidth="1.5"
                      />
                      <text x={x} y={y - 8} fill={colors.pointLabel} fontSize="9" textAnchor="middle" fontWeight="bold">
                        {val}°C
                      </text>
                      <text x={x} y="195" fill={colors.timeLabel} fontSize="8" textAnchor="middle">
                        {p.timestamp}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Section: Active Temperature Control System Simulator */}
          <div className={`rounded-xl border p-4 ${t.border} ${t.light ? 'bg-gradient-to-r from-slate-50 to-white' : 'bg-gradient-to-r from-slate-950 to-slate-900'}`}>
            <div className={`flex items-center justify-between mb-3 pb-2 border-b ${t.border}`}>
              <div className="flex items-center gap-2">
                <Sliders className={`w-4 h-4 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${t.textPrimary}`}>
                  Active Temperature Control System & Reefer Dispatch
                </h3>
              </div>
              <span className={`text-xs font-mono ${t.textMuted}`}>
                Unit #RF-{lane.laneCode.slice(0, 3)}-CONTROL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">

              {/* Controller 1: Setpoint Adjustment */}
              <div className={`p-3 rounded-lg border ${t.cardBg} ${t.border}`}>
                <label className={`block text-xs font-semibold mb-1 ${t.textSecondary}`}>
                  Adjust Reefer Target Setpoint
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={reeferSetpoint}
                    onChange={(e) => setReeferSetpoint(parseFloat(e.target.value))}
                    className={`w-24 font-mono font-bold px-2 py-1.5 rounded border text-xs ${t.cardBgSunken} ${t.textPrimary} ${t.light ? 'border-slate-300' : 'border-slate-700'}`}
                  />
                  <span className={`text-xs ${t.textMuted}`}>°C</span>
                  <button
                    onClick={() => handleApplyControl('SET_SETPOINT')}
                    className={`px-3 py-1.5 font-semibold rounded text-xs transition-colors ${t.chipBg} ${t.hoverBg} ${t.light ? 'text-teal-700' : 'text-teal-300'}`}
                  >
                    Calibrate
                  </button>
                </div>
              </div>

              {/* Controller 2: Auxiliary Chiller Boost */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${t.cardBg} ${t.border}`}>
                <div>
                  <div className={`text-xs font-semibold ${t.textSecondary}`}>
                    Auxiliary Chiller Compressor
                  </div>
                  <div className={`text-[11px] ${t.textMuted}`}>
                    Rapid -2.5°C thermal pull-down
                  </div>
                </div>
                <button
                  onClick={() => handleApplyControl('BOOST_COOLING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    isChillerBoostActive
                      ? 'bg-teal-500 text-white animate-pulse border-teal-500'
                      : t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/30'
                  }`}
                >
                  {isChillerBoostActive ? 'Chilling Active...' : 'Boost Cooling'}
                </button>
              </div>

              {/* Controller 3: Emergency Dry-Ice / CAPA Protocol */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${t.cardBg} ${t.border}`}>
                <div>
                  <div className={`text-xs font-semibold ${t.textSecondary}`}>
                    Emergency Cold Replenish
                  </div>
                  <div className={`text-[11px] ${t.textMuted}`}>
                    Restore thermal envelope & log CAPA
                  </div>
                </div>
                <button
                  onClick={() => handleApplyControl('EMERGENCY_DRY_ICE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    t.light ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  Deploy Replenish
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 ${t.cardBgSunken} border-t ${t.border} flex flex-col sm:flex-row items-center justify-between gap-3`}>
          <div className={`text-xs ${t.textMuted}`}>
            Sensor Probe Calibration: <strong className={t.textSecondary}>NIST Traceable (Valid till Nov 2026)</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReports}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
            >
              <Download className={`w-3.5 h-3.5 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
              <span>Export Thermal Dossier</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
