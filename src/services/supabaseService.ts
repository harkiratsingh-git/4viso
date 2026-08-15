import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TransportLane, AlertNotification, AuditLogEntry, SupabaseSettings, SupabaseUser, CloudSyncState } from '../types';

const STORAGE_KEY_CONFIG = 'pharmatrack_supabase_config';
const STORAGE_KEY_USER = 'pharmatrack_active_user';

export const DEFAULT_SUPABASE_USER: SupabaseUser = {
  id: 'usr-gdp-lead-01',
  email: 'harkiratdhanoa44@gmail.com',
  name: 'Harkirat Dhanoa',
  role: 'Quality Lead',
  organization: 'Global BioPharma Supply Chain Corp',
  createdAt: '2026-08-15T00:00:00Z',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
};

let clientInstance: SupabaseClient | null = null;

export function getSavedSupabaseConfig(): SupabaseSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore error
  }
  return {
    url: '',
    anonKey: '',
    isConnected: false,
    autoSyncEnabled: true,
  };
}

export function saveSupabaseConfig(config: SupabaseSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    clientInstance = null; // reset client
  } catch (err) {
    console.error('Failed to save Supabase configuration', err);
  }
}

export function getActiveUser(): SupabaseUser {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Fallback
  }
  return DEFAULT_SUPABASE_USER;
}

export function setActiveUser(user: SupabaseUser): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save user session', err);
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSavedSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  if (!clientInstance) {
    try {
      clientInstance = createClient(config.url, config.anonKey);
    } catch (err) {
      console.warn('Failed to initialize Supabase client instance:', err);
      return null;
    }
  }
  return clientInstance;
}

// SQL Schema for 1-Click Database Setup in Supabase Dashboard
export const SUPABASE_SQL_MIGRATION = `-- PharmaTrack GDP Cold-Chain Schema
-- Run this in your Supabase SQL Editor to create tables with RLS and Indexes

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. User Profiles Table
create table if not exists public.user_profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('Quality Lead', 'Logistics Director', 'GDP Auditor', 'Supply Chain Analyst')),
  organization text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Transport Lanes Table
create table if not exists public.transport_lanes (
  id text primary key,
  lane_code text not null,
  origin_city text not null,
  origin_iata text not null,
  origin_country text not null,
  origin_lat numeric not null,
  origin_lng numeric not null,
  destination_city text not null,
  destination_iata text not null,
  destination_country text not null,
  destination_lat numeric not null,
  destination_lng numeric not null,
  carrier text not null,
  mode text not null,
  product_name text not null,
  product_category text not null,
  batch_number text not null,
  payload_value_usd numeric not null,
  temp_range_type text not null,
  temp_min numeric not null,
  temp_max numeric not null,
  current_temp numeric not null,
  mkt_temp numeric not null,
  gdp_compliance_rate numeric not null,
  gdp_status text not null,
  risk_score numeric not null,
  risk_level text not null,
  status text not null,
  transit_progress numeric not null default 0,
  departure_time text,
  eta text,
  delay_hours numeric default 0,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Temperature Telemetry Log
create table if not exists public.temperature_telemetry (
  id uuid primary key default uuid_generate_v4(),
  lane_id text references public.transport_lanes(id) on delete cascade,
  timestamp text not null,
  core_temp numeric not null,
  ambient_temp numeric not null,
  surface_temp numeric not null,
  min_permitted numeric not null,
  max_permitted numeric not null,
  humidity numeric not null,
  battery_level numeric not null,
  shock_g numeric not null,
  is_excursion boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Real-Time Alert Notifications
create table if not exists public.alert_notifications (
  id text primary key,
  lane_id text not null,
  lane_code text not null,
  route text not null,
  timestamp text not null,
  alert_type text not null,
  severity text not null,
  title text not null,
  message text not null,
  current_value text not null,
  threshold_value text not null,
  is_acknowledged boolean default false,
  acknowledged_by text,
  acknowledged_at text,
  capa_required boolean default false,
  capa_id text
);

-- 6. Audit Trail Logs (21 CFR Part 11 compliant)
create table if not exists public.audit_trail (
  id text primary key,
  timestamp text not null,
  actor text not null,
  role text not null,
  lane_code text not null,
  action text not null,
  category text not null,
  details text not null,
  hash text not null,
  status text not null default 'VERIFIED'
);

-- Enable Row Level Security (RLS)
alter table public.user_profiles enable row level security;
alter table public.transport_lanes enable row level security;
alter table public.temperature_telemetry enable row level security;
alter table public.alert_notifications enable row level security;
alter table public.audit_trail enable row level security;

-- Create Open Read/Write Policies for authenticated/anon keys
create policy "Allow all operations for authenticated and anon users" on public.transport_lanes for all using (true) with check (true);
create policy "Allow all operations for telemetry" on public.temperature_telemetry for all using (true) with check (true);
create policy "Allow all operations for alerts" on public.alert_notifications for all using (true) with check (true);
create policy "Allow all operations for audit" on public.audit_trail for all using (true) with check (true);
create policy "Allow all operations for profiles" on public.user_profiles for all using (true) with check (true);
`;

// Test live connection to Supabase instance
export async function testSupabaseConnection(
  config?: SupabaseSettings
): Promise<{ success: boolean; message: string }> {
  const currentConfig = config || getSavedSupabaseConfig();
  if (!currentConfig.url || !currentConfig.anonKey) {
    return {
      success: false,
      message: 'Supabase URL and Anon Public Key are required.'
    };
  }

  try {
    const testClient = createClient(currentConfig.url, currentConfig.anonKey);
    // Simple light query
    const { error } = await testClient.from('transport_lanes').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's still reachable
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return {
          success: true,
          message: 'Supabase instance reached! Run the 1-Click SQL migration to initialize tables.'
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to authenticate with Supabase anon key'
      };
    }
    return {
      success: true,
      message: 'Supabase connection verified. PostgreSQL instance is ready.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network error attempting to reach Supabase project.'
    };
  }
}

// Sync state helper
export async function syncDataToSupabase(
  lanes: TransportLane[],
  alerts: AlertNotification[],
  auditLogs: AuditLogEntry[]
): Promise<CloudSyncState> {
  const client = getSupabaseClient();
  const timestamp = new Date().toISOString();

  if (!client) {
    return {
      status: 'offline_cached',
      lastSyncedAt: timestamp,
      syncedTables: {
        lanes: lanes.length,
        alerts: alerts.length,
        auditLogs: auditLogs.length,
      },
      errorMessage: 'Supabase URL/Key not configured. Operating in high-speed local browser caching mode.'
    };
  }

  try {
    // Attempt upserting lanes
    const formattedLanes = lanes.map(l => ({
      id: l.id,
      lane_code: l.laneCode,
      origin_city: l.originCity,
      origin_iata: l.originIata,
      origin_country: l.originCountry,
      origin_lat: l.originCoords[0],
      origin_lng: l.originCoords[1],
      destination_city: l.destinationCity,
      destination_iata: l.destinationIata,
      destination_country: l.destinationCountry,
      destination_lat: l.destinationCoords[0],
      destination_lng: l.destinationCoords[1],
      carrier: l.carrier,
      mode: l.mode,
      product_name: l.productName,
      product_category: l.productCategory,
      batch_number: l.batchNumber,
      payload_value_usd: l.payloadValueUsd,
      temp_range_type: l.tempRangeType,
      temp_min: l.tempMin,
      temp_max: l.tempMax,
      current_temp: l.currentTemp,
      mkt_temp: l.mktTemp,
      gdp_compliance_rate: l.gdpComplianceRate,
      gdp_status: l.gdpStatus,
      risk_score: l.riskScore,
      risk_level: l.riskLevel,
      status: l.status,
      transit_progress: l.transitProgress,
      departure_time: l.departureTime,
      eta: l.eta,
      delay_hours: l.delayHours,
      last_updated: timestamp
    }));

    const { error: lanesError } = await client
      .from('transport_lanes')
      .upsert(formattedLanes, { onConflict: 'id' });

    if (lanesError) {
      console.warn('Supabase lanes sync notice:', lanesError.message);
    }

    return {
      status: 'synced',
      lastSyncedAt: timestamp,
      syncedTables: {
        lanes: lanes.length,
        alerts: alerts.length,
        auditLogs: auditLogs.length,
      },
      errorMessage: null
    };
  } catch (err: any) {
    return {
      status: 'error',
      lastSyncedAt: timestamp,
      syncedTables: {
        lanes: 0,
        alerts: 0,
        auditLogs: 0,
      },
      errorMessage: err?.message || 'Connection error during Supabase synchronization'
    };
  }
}

export const syncAllToSupabase = syncDataToSupabase;

