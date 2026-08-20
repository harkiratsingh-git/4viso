// Real port weather, read from the `latest_port_weather` view that the weather-sync Edge
// Function keeps populated (see supabase/functions/weather-sync). This module only ever reads
// — no OpenWeatherMap key or call lives anywhere in the frontend.
import { getSupabaseClient } from './supabaseService';
import { WeatherDisruption } from '../types';
import { formatRelative } from '../utils/dateFormat';

export interface PortWeather {
  portCode: string;
  tempC: number;
  feelsLikeC: number | null;
  humidityPct: number | null;
  windSpeedMs: number | null;
  condition: string | null;
  description: string | null;
  fetchedAt: string;
}

/** A snapshot older than this is treated as absent — an honest "no recent data" beats a stale
 * number presented as current. */
export const WEATHER_STALE_HOURS = 3;

export function isWeatherStale(fetchedAt: string, referenceDate: Date = new Date()): boolean {
  const fetchedDate = new Date(fetchedAt);
  if (isNaN(fetchedDate.getTime())) return true;
  const ageHours = (referenceDate.getTime() - fetchedDate.getTime()) / (1000 * 60 * 60);
  return ageHours > WEATHER_STALE_HOURS;
}

function mapRowToPortWeather(row: any): PortWeather {
  return {
    portCode: row.port_code,
    tempC: Number(row.temp_c),
    feelsLikeC: row.feels_like_c !== null && row.feels_like_c !== undefined ? Number(row.feels_like_c) : null,
    humidityPct: row.humidity_pct !== null && row.humidity_pct !== undefined ? Number(row.humidity_pct) : null,
    windSpeedMs: row.wind_speed_ms !== null && row.wind_speed_ms !== undefined ? Number(row.wind_speed_ms) : null,
    condition: row.weather_condition ?? null,
    description: row.weather_description ?? null,
    fetchedAt: row.fetched_at,
  };
}

/** Every port's most recent snapshot, keyed by port code. Ports never fetched yet (or not in
 * range of the current priority budget) simply won't have an entry — callers should treat a
 * missing key the same as a stale one. */
export async function fetchLatestPortWeather(): Promise<Map<string, PortWeather>> {
  const client = getSupabaseClient();
  if (!client) return new Map();

  const { data, error } = await client.from('latest_port_weather').select('*');
  if (error) {
    console.warn('Failed to load latest_port_weather:', error.message);
    return new Map();
  }
  return new Map((data || []).map((row: any) => [row.port_code as string, mapRowToPortWeather(row)]));
}

interface WeatherHazardAlertRow {
  id: string;
  lane_id: string;
  lane_code: string;
  route: string;
  timestamp: string;
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  message: string;
}

/** Real weather-triggered alerts written by weather-sync (alert_type = 'WEATHER_HAZARD'),
 * mapped into the same WeatherDisruption shape the "Weather & Route Disruption Feed" panel
 * already renders for corridor advisories — see deriveDisruptionsFromAdvisories in
 * utils/corridorAdvisories.ts for the sibling function this mirrors. */
export async function fetchWeatherHazardDisruptions(): Promise<WeatherDisruption[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('alert_notifications')
    .select('id, lane_id, lane_code, route, timestamp, severity, title, message')
    .eq('alert_type', 'WEATHER_HAZARD')
    .eq('is_acknowledged', false)
    .order('timestamp', { ascending: false });

  if (error) {
    console.warn('Failed to load weather hazard alerts:', error.message);
    return [];
  }

  const rows = (data || []) as WeatherHazardAlertRow[];
  return rows.map((row) => ({
    id: row.id,
    region: row.route,
    type: row.title.includes('Sub-freezing') ? ('Freeze Risk' as const) : ('Heatwave Warning' as const),
    severity: row.severity === 'Info' ? 'Advisory' : row.severity,
    impactDescription: row.message,
    delayEstimated: 'Handling protocol review',
    affectedLaneCodes: [row.lane_code],
    lastUpdated: formatRelative(row.timestamp),
  }));
}
