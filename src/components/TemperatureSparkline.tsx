import React from 'react';
import { TemperatureReading } from '../types';

interface TemperatureSparklineProps {
  history: TemperatureReading[];
  tempMin: number;
  tempMax: number;
  width?: number;
  height?: number;
}

/**
 * Minimal Tufte-style inline trend line — no axes, gridlines, or legend, just the shape of the
 * last readings plus the safe-range band, so the eye can spot drift without reading a full chart.
 */
export const TemperatureSparkline: React.FC<TemperatureSparklineProps> = ({
  history,
  tempMin,
  tempMax,
  width = 64,
  height = 22,
}) => {
  const points = history.slice(-7);
  if (points.length < 2) return null;

  const temps = points.map((p) => p.coreTemp);
  const lo = Math.min(...temps, tempMin);
  const hi = Math.max(...temps, tempMax);
  const span = hi - lo || 1;

  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (t: number) => height - ((t - lo) / span) * height;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.coreTemp).toFixed(1)}`).join(' ');
  const bandTop = Math.max(0, y(tempMax));
  const bandBottom = Math.min(height, y(tempMin));

  const last = points[points.length - 1];
  const isExcursion = last.coreTemp > tempMax || last.coreTemp < tempMin;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0" aria-hidden="true">
      {bandBottom > bandTop && (
        <rect x={0} y={bandTop} width={width} height={bandBottom - bandTop} fill="currentColor" className="text-emerald-500/10" />
      )}
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={1.25} className={isExcursion ? 'text-rose-400' : 'text-slate-500'} />
      <circle cx={x(points.length - 1)} cy={y(last.coreTemp)} r={1.75} fill="currentColor" className={isExcursion ? 'text-rose-400' : 'text-slate-400'} />
    </svg>
  );
};
