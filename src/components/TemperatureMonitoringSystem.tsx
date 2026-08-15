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
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  RefreshCw, 
  BellRing,
  ShieldCheck,
  Download,
  Flame,
  Radio
} from 'lucide-react';
import { TransportLane, TemperatureReading } from '../types';

interface TemperatureMonitoringSystemProps {
  lane: TransportLane;
  onClose: () => void;
  onUpdateLaneTemp: (laneId: string, newTemp: number, isExcursion: boolean) => void;
  onOpenReports: () => void;
}

export const TemperatureMonitoringSystem: React.FC<TemperatureMonitoringSystemProps> = ({
  lane,
  onClose,
  onUpdateLaneTemp,
  onOpenReports,
}) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isExcursion ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
            }`}>
              <ThermometerSnowflake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  Environmental Integrity & Temperature Control
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                  {lane.laneCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isExcursion 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                    : isWarning 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {isExcursion ? '🔴 THERMAL EXCURSION' : isWarning ? '🟡 UPPER WARNING' : '🟢 WITHIN GDP SPEC'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Target Envelope: <strong>{lane.tempMin}°C to {lane.tempMax}°C</strong> ({lane.tempRangeType}) • Carrier: <strong>{lane.carrier}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Feedback Toast */}
          {controlActionMessage && (
            <div className="bg-teal-950/80 border border-teal-500/50 p-3 rounded-lg text-xs text-teal-200 flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <span>{controlActionMessage}</span>
            </div>
          )}

          {/* Telemetry Sensor KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* Core Payload Temp */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Core Temp</span>
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className={`text-2xl font-extrabold font-mono my-1 ${
                isExcursion ? 'text-rose-400 animate-pulse' : isWarning ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {latestReading.coreTemp}°C
              </div>
              <div className="text-[10px] text-slate-400">
                Probe T-01 (Core)
              </div>
            </div>

            {/* Mean Kinetic Temp (MKT) */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>MKT (Mean)</span>
                <Activity className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-teal-300 my-1">
                {lane.mktTemp}°C
              </div>
              <div className="text-[10px] text-slate-400">
                USP &lt;1079&gt; Calculated
              </div>
            </div>

            {/* Ambient Hold Temp */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Ambient Hold</span>
                <ThermometerSun className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-200 my-1">
                {latestReading.ambientTemp}°C
              </div>
              <div className="text-[10px] text-slate-400">
                Hold Delta: {(latestReading.ambientTemp - latestReading.coreTemp).toFixed(1)}°C
              </div>
            </div>

            {/* Relative Humidity */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Humidity</span>
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-sky-300 my-1">
                {latestReading.humidity}%
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">
                Within Spec (40-60%)
              </div>
            </div>

            {/* Shock & Tilt */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Shock (3-Axis)</span>
                <Zap className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-200 my-1">
                {latestReading.shockG} G
              </div>
              <div className="text-[10px] text-slate-400">
                Threshold: &lt; {lane.thresholdAlerts.notifyOnShockAboveG} G
              </div>
            </div>

            {/* Battery & Beacon */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>IoT Battery</span>
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-300 my-1">
                {latestReading.batteryLevel}%
              </div>
              <div className="text-[10px] text-slate-400">
                Satellite Uplink OK
              </div>
            </div>

          </div>

          {/* Real-Time Interactive Temperature Curve & Safe Band Graph */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
            
            {/* Chart Header & Multi-Probe Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Continuous Temperature Profile & Excursion Safe-Zone
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time telemetry plotted against calibrated GDP upper ({lane.tempMax}°C) and lower ({lane.tempMin}°C) thresholds
                </p>
              </div>

              {/* Probe Selector */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
                <button
                  onClick={() => setActiveProbe('core')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeProbe === 'core' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Core Payload (Probe 1)
                </button>
                <button
                  onClick={() => setActiveProbe('ambient')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeProbe === 'ambient' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ambient Container
                </button>
                <button
                  onClick={() => setActiveProbe('surface')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeProbe === 'surface' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Surface Shipper
                </button>
              </div>
            </div>

            {/* SVG Visual Graph */}
            <div className="relative w-full h-52 bg-slate-950 rounded-lg border border-slate-800/80 p-2 select-none overflow-hidden">
              <svg viewBox="0 0 600 200" className="w-full h-full">
                
                {/* Permissible Safe Band Background (Green Zone) */}
                <rect
                  x="40"
                  y={Math.min(safeZoneTop, safeZoneBottom)}
                  width="540"
                  height={safeZoneHeight}
                  fill="#10b981"
                  fillOpacity="0.09"
                  stroke="#10b981"
                  strokeOpacity="0.3"
                  strokeDasharray="2,2"
                />
                <text x="45" y={safeZoneTop + 14} fill="#6ee7b7" fontSize="9" fontWeight="bold">
                  Safe Envelope ({lane.tempMin}°C - {lane.tempMax}°C)
                </text>

                {/* Upper Warning / Excursion Line */}
                <line x1="40" y1={safeZoneTop} x2="580" y2={safeZoneTop} stroke="#f43f5e" strokeWidth="1" strokeDasharray="3,3" />
                <text x="540" y={safeZoneTop - 4} fill="#fda4af" fontSize="9" fontWeight="bold">
                  Max {lane.tempMax}°C
                </text>

                {/* Lower Limit Line */}
                <line x1="40" y1={safeZoneBottom} x2="580" y2={safeZoneBottom} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
                <text x="540" y={safeZoneBottom + 12} fill="#bae6fd" fontSize="9" fontWeight="bold">
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
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                      <text x={x} y={y - 8} fill="#e2e8f0" fontSize="9" textAnchor="middle" fontWeight="bold">
                        {val}°C
                      </text>
                      <text x={x} y="195" fill="#64748b" fontSize="8" textAnchor="middle">
                        {p.timestamp}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Section: Active Temperature Control System Simulator */}
          <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Active Temperature Control System & Reefer Dispatch
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Unit #RF-{lane.laneCode.slice(0, 3)}-CONTROL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              
              {/* Controller 1: Setpoint Adjustment */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adjust Reefer Target Setpoint
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={reeferSetpoint}
                    onChange={(e) => setReeferSetpoint(parseFloat(e.target.value))}
                    className="w-24 bg-slate-950 text-white font-mono font-bold px-2 py-1.5 rounded border border-slate-700 text-xs"
                  />
                  <span className="text-xs text-slate-400">°C</span>
                  <button
                    onClick={() => handleApplyControl('SET_SETPOINT')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold rounded text-xs transition-colors"
                  >
                    Calibrate
                  </button>
                </div>
              </div>

              {/* Controller 2: Auxiliary Chiller Boost */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    Auxiliary Chiller Compressor
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Rapid -2.5°C thermal pull-down
                  </div>
                </div>
                <button
                  onClick={() => handleApplyControl('BOOST_COOLING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isChillerBoostActive
                      ? 'bg-teal-500 text-white animate-pulse'
                      : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30'
                  }`}
                >
                  {isChillerBoostActive ? 'Chilling Active...' : 'Boost Cooling'}
                </button>
              </div>

              {/* Controller 3: Emergency Dry-Ice / CAPA Protocol */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    Emergency Cold Replenish
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Restore thermal envelope & log CAPA
                  </div>
                </div>
                <button
                  onClick={() => handleApplyControl('EMERGENCY_DRY_ICE')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
                >
                  Deploy Replenish
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Sensor Probe Calibration: <strong className="text-slate-200">NIST Traceable (Valid till Nov 2026)</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReports}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
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
