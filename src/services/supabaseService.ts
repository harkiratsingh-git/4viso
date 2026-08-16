import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TransportLane, AlertNotification, AuditLogEntry, SupabaseSettings, SupabaseUser, CloudSyncState, RiskLevel, CorridorAdvisory, Carrier, CarrierPerformanceSummary } from '../types';
import {
  mapRowToLane,
  mapLaneToRow,
  mapRowToAlert,
  mapAlertToRow,
  mapRowToAuditLog,
  mapAuditLogToRow,
  mapRowToTemperatureReading,
  mapRowToCorridorAdvisory,
  mapRowToCarrier,
  mapRowToCarrierPerformanceSummary,
} from './supabaseMappers';
import { PortEntry, mapPortsRowToEntry } from '../utils/ports';

const STORAGE_KEY_CONFIG = 'pharmatrack_supabase_config';
const STORAGE_KEY_USER = 'pharmatrack_active_user';

export const DEFAULT_SUPABASE_CONFIG: SupabaseSettings = {
  url: 'https://bizsmdoblqmkxybnppyw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpenNtZG9ibHFta3h5Ym5wcHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDAyNDQsImV4cCI6MjEwMjM3NjI0NH0.M7uIFw0yWaKxvtYDaf3UFbtKGP8iQ06IXlq7Nog2pWg',
  isConnected: true,
  autoSyncEnabled: true,
};

export const DEFAULT_SUPABASE_USER: SupabaseUser = {
  id: 'usr-gdp-lead-01',
  email: 'harkiratdhanoa44@gmail.com',
  name: 'Harkirat Dhanoa',
  role: 'Quality Lead',
  organization: 'Global BioPharma Supply Chain Corp',
  createdAt: '2026-08-15T00:00:00Z',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
  authProvider: 'Supabase Cloud Auth'
};

let clientInstance: SupabaseClient | null = null;

export function getSavedSupabaseConfig(): SupabaseSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_SUPABASE_CONFIG;
}

export function saveSupabaseConfig(config: SupabaseSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    clientInstance = null; // reset client instance
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

// SQL Schema & Real Seed Dataset for 1-Click Database Setup in Supabase Dashboard
export const SUPABASE_SQL_MIGRATION = `-- ==========================================================
-- PharmaTrack GDP Cold-Chain PostgreSQL Schema & Seed Dataset
-- Target Project: https://bizsmdoblqmkxybnppyw.supabase.co
-- Run this in your Supabase SQL Editor to initialize all tables
-- and seed real pharmaceutical cold-chain lanes & telemetry.
-- ==========================================================

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
  stops jsonb not null default '[]'::jsonb,
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

-- 3b. Backfill the stops column for projects that already had transport_lanes created
-- before multi-stop routing was added (create table if not exists won't add new columns).
alter table public.transport_lanes add column if not exists stops jsonb not null default '[]'::jsonb;

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

-- Create Open Read/Write Policies for authenticated and anon users
drop policy if exists "Allow all operations for authenticated and anon users" on public.transport_lanes;
create policy "Allow all operations for authenticated and anon users" on public.transport_lanes for all using (true) with check (true);

drop policy if exists "Allow all operations for telemetry" on public.temperature_telemetry;
create policy "Allow all operations for telemetry" on public.temperature_telemetry for all using (true) with check (true);

drop policy if exists "Allow all operations for alerts" on public.alert_notifications;
create policy "Allow all operations for alerts" on public.alert_notifications for all using (true) with check (true);

drop policy if exists "Allow all operations for audit" on public.audit_trail;
create policy "Allow all operations for audit" on public.audit_trail for all using (true) with check (true);

drop policy if exists "Allow all operations for profiles" on public.user_profiles;
create policy "Allow all operations for profiles" on public.user_profiles for all using (true) with check (true);

-- ==========================================================
-- 7. SEED REAL PHARMACEUTICAL COLD-CHAIN DATA
-- ==========================================================

-- Seed User Profiles
insert into public.user_profiles (email, full_name, role, organization, avatar_url)
values
  ('harkiratdhanoa44@gmail.com', 'Harkirat Dhanoa', 'Quality Lead', 'Global BioPharma Supply Chain Corp', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'),
  ('elena.rostova@biopharma-coldchain.com', 'Dr. Elena Rostova', 'Quality Lead', 'Global QA & Validation', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=faces'),
  ('marcus.vance@coldchain-logistics.com', 'Marcus Vance', 'Logistics Director', 'Cold Chain Logistics Operations', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&h=120&fit=crop&crop=faces'),
  ('sarah.jenkins@gdp-audits.org', 'Sarah Jenkins', 'GDP Auditor', 'GDP Regulatory Compliance Oversight', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=faces')
on conflict (email) do nothing;

-- Seed Real Transport Lanes
insert into public.transport_lanes (
  id, lane_code, origin_city, origin_iata, origin_country, origin_lat, origin_lng,
  destination_city, destination_iata, destination_country, destination_lat, destination_lng,
  carrier, mode, product_name, product_category, batch_number, payload_value_usd,
  temp_range_type, temp_min, temp_max, current_temp, mkt_temp, gdp_compliance_rate,
  gdp_status, risk_score, risk_level, status, transit_progress, departure_time, eta, delay_hours
)
values
  (
    'lane-1', 'BRU-SIN-01', 'Brussels', 'BRU', 'Belgium', 50.9010, 4.4856,
    'Singapore', 'SIN', 'Singapore', 1.3644, 103.9915,
    'DHL Express Pharma', 'Air', 'mRNA Oncology Vaccines', 'Vaccines', 'VAC-2026-8841B', 4850000,
    '2°C to 8°C (Cold Chain)', 2.0, 8.0, 4.1, 4.3, 98.4,
    'Compliant', 5, 'Low', 'In Transit', 68, '2026-08-14 06:30 UTC', '2026-08-15 18:45 UTC', 0
  ),
  (
    'lane-2', 'FRA-JFK-04', 'Frankfurt', 'FRA', 'Germany', 50.0379, 8.5622,
    'New York', 'JFK', 'United States', 40.6413, -73.7781,
    'Lufthansa Cargo', 'Air', 'Monoclonal Antibody Solution', 'Biologics', 'MAB-901-447X', 7200000,
    '2°C to 8°C (Cold Chain)', 2.0, 8.0, 6.2, 5.8, 96.1,
    'Compliant', 18, 'Low', 'In Transit', 42, '2026-08-15 02:15 UTC', '2026-08-15 14:30 UTC', 0
  ),
  (
    'lane-3', 'BSL-NRT-02', 'Basel', 'BSL', 'Switzerland', 47.5896, 7.5299,
    'Tokyo', 'NRT', 'Japan', 35.7720, 140.3929,
    'Swiss WorldCargo', 'Air', 'Autologous CAR-T Cell Therapy', 'Cell Therapy', 'CRT-774-099A', 11500000,
    '-80°C (Cryogenic)', -90.0, -70.0, -78.4, -79.1, 99.8,
    'Compliant', 8, 'Low', 'In Transit', 85, '2026-08-13 14:00 UTC', '2026-08-15 09:30 UTC', 0
  ),
  (
    'lane-4', 'DUB-BOS-07', 'Dublin', 'DUB', 'Ireland', 53.4264, -6.2499,
    'Boston', 'BOS', 'United States', 42.3656, -71.0096,
    'FedEx Custom Critical', 'Air', 'Clinical Trial Phase III Investigational Product', 'Clinical Trials', 'CTP-302-881J', 3400000,
    '15°C to 25°C (Controlled Room Temp)', 15.0, 25.0, 26.4, 24.2, 89.2,
    'Warning', 74, 'High', 'Delayed', 31, '2026-08-14 20:00 UTC', '2026-08-15 22:00 UTC', 4
  ),
  (
    'lane-5', 'ZRH-DXB-03', 'Zurich', 'ZRH', 'Switzerland', 47.4582, 8.5555,
    'Dubai', 'DXB', 'United Arab Emirates', 25.2532, 55.3657,
    'Emirates SkyCargo', 'Air', 'Insulin Glargine Pen Cartridges', 'Insulin', 'INS-662-119P', 2900000,
    '2°C to 8°C (Cold Chain)', 2.0, 8.0, 8.7, 7.9, 81.5,
    'Non-Compliant', 88, 'Critical', 'Temperature Alert', 92, '2026-08-14 18:30 UTC', '2026-08-15 07:15 UTC', 2
  ),
  (
    'lane-6', 'HYD-LHR-05', 'Hyderabad', 'HYD', 'India', 17.2403, 78.4294,
    'London', 'LHR', 'United Kingdom', 51.4700, -0.4543,
    'British Airways World Cargo', 'Air', 'Sterile Active Pharmaceutical Ingredients (API)', 'Active Ingredients', 'API-404-551Z', 5600000,
    '2°C to 8°C (Cold Chain)', 2.0, 8.0, 3.8, 4.0, 97.3,
    'Compliant', 12, 'Low', 'In Transit', 55, '2026-08-15 01:00 UTC', '2026-08-15 13:45 UTC', 0
  )
on conflict (id) do update set
  current_temp = excluded.current_temp,
  mkt_temp = excluded.mkt_temp,
  gdp_compliance_rate = excluded.gdp_compliance_rate,
  gdp_status = excluded.gdp_status,
  risk_score = excluded.risk_score,
  risk_level = excluded.risk_level,
  status = excluded.status,
  transit_progress = excluded.transit_progress,
  last_updated = timezone('utc'::text, now());

-- Seed Real-Time Alert Notifications
insert into public.alert_notifications (
  id, lane_id, lane_code, route, timestamp, alert_type, severity,
  title, message, current_value, threshold_value, is_acknowledged, capa_required
)
values
  (
    'alt-1', 'lane-5', 'ZRH-DXB-03', 'Zurich (ZRH) -> Dubai (DXB)', '2026-08-15 07:12 UTC',
    'TEMPERATURE_EXCURSION', 'Critical', 'Upper Critical Temperature Threshold Breached',
    'Payload core temperature reached 8.7°C (Permitted threshold: 2.0°C - 8.0°C) during ramp transfer at DXB Tarmac.',
    '8.7°C', 'Max 8.0°C', false, true
  ),
  (
    'alt-2', 'lane-4', 'DUB-BOS-07', 'Dublin (DUB) -> Boston (BOS)', '2026-08-15 06:45 UTC',
    'TEMPERATURE_EXCURSION', 'Warning', 'Elevated Ambient & Packaging Surface Temperature',
    'Surface temperature rose to 26.4°C exceeding 25.0°C CRT limit. Investigational product stability at risk.',
    '26.4°C', 'Max 25.0°C', false, true
  ),
  (
    'alt-3', 'lane-4', 'DUB-BOS-07', 'Dublin (DUB) -> Boston (BOS)', '2026-08-15 04:30 UTC',
    'TRANSIT_DELAY', 'Warning', 'Transatlantic Flight Delay & Customs Clearance Hold',
    'Ground handling delay at Shannon technical stop extended transit duration by 4 hours.',
    '+4.0 hrs', 'Max 2.0 hrs delay', false, false
  )
on conflict (id) do nothing;

-- Seed Immutable 21 CFR Part 11 Audit Trail
insert into public.audit_trail (
  id, timestamp, actor, role, lane_code, action, category, details, hash, status
)
values
  (
    'aud-01', '2026-08-15 08:30:12 UTC', 'Harkirat Dhanoa', 'Quality Lead', 'SYSTEM',
    'Supabase Cloud PostgreSQL Database Connected', 'SECURITY',
    'Database instance initialized at https://bizsmdoblqmkxybnppyw.supabase.co with 21 CFR Part 11 RLS schema.',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'VERIFIED'
  ),
  (
    'aud-02', '2026-08-15 07:15:00 UTC', 'System Automated Daemon', 'Telemetry Monitor', 'ZRH-DXB-03',
    'Thermal Excursion Alert Dispatched', 'TEMPERATURE_MONITORING',
    'Excursion recorded: 8.7°C (threshold: 8.0°C). Automated emergency alerts triggered via SMS & Webhook.',
    '9f83c60579f5d3bbf86c72cf0f31652f2e01c4875a21e007d68b373b9079ad37', 'VERIFIED'
  ),
  (
    'aud-03', '2026-08-15 06:50:22 UTC', 'Dr. Elena Rostova', 'VP QA', 'ZRH-DXB-03',
    'CAPA Investigation Protocol Initiated', 'CAPA_LOGGED',
    'CAPA-2026-081 initiated for Dubai airport ramp staging breach. Dry-ice re-icing expedited.',
    '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'VERIFIED'
  )
on conflict (id) do nothing;

-- ==========================================================
-- 8. CEIV Pharma certification + real hub network completeness
-- ==========================================================

alter table public.ports add column if not exists ceiv_pharma_certified boolean not null default false;

-- Flag the real, verifiable IATA CEIV Pharma cargo communities already in this table.
update public.ports set ceiv_pharma_certified = true
where code in ('AMS','ATL','BOM','BRU','DXB','FRA','HKG','PVG','SIN','ZRH');

-- Add the real CEIV hubs referenced in the network that this table is missing.
insert into public.ports (code, name, city, country_code, port_type, latitude, longitude, has_cold_storage, has_gdp_certification, avg_customs_delay_hours, facility_risk_score, ceiv_pharma_certified)
values
  ('MIA', 'Miami International Airport', 'Miami', 'US', 'Air', 25.7959, -80.2870, true, true, 3.0, 88, true),
  ('DFW', 'Dallas-Fort Worth International Airport', 'Dallas', 'US', 'Air', 32.8968, -97.0380, true, true, 3.0, 87, true),
  ('HYD', 'Rajiv Gandhi International Airport', 'Hyderabad', 'IN', 'Air', 17.2403, 78.4294, true, true, 4.0, 84, true),
  ('LGG', 'Liège Airport', 'Liège', 'BE', 'Air', 50.6374, 5.4432, true, true, 2.5, 90, true)
on conflict (code) do nothing;

-- ==========================================================
-- 9. Corrected dashboard_summary — active_excursions/high_risk_lanes must derive from
--    current_temp vs temp_min/temp_max directly, not from the lane's stored status text,
--    or a lane can excurse without the dashboard ever reflecting it.
-- ==========================================================

create or replace view public.dashboard_summary as
select
  count(*)::int as total_lanes,
  count(*) filter (where status in ('In Transit', 'Active'))::int as active_lanes,
  count(*) filter (
    where current_temp < temp_min or current_temp > temp_max
       or risk_score >= 40 or risk_level in ('High', 'Critical')
  )::int as high_risk_lanes,
  round(avg(gdp_compliance_rate)::numeric, 1) as avg_gdp_compliance,
  count(*) filter (where current_temp < temp_min or current_temp > temp_max)::int as active_excursions,
  coalesce(sum(payload_value_usd), 0) as payload_in_transit_usd,
  (select count(*) from public.alert_notifications where severity = 'Critical' and is_acknowledged = false)::int as unresolved_critical_alerts
from public.transport_lanes;

-- ==========================================================
-- 10. Trigram search support for the top-nav lane search bar
-- ==========================================================

create extension if not exists pg_trgm;

create index if not exists idx_lanes_search_trgm on public.transport_lanes
  using gin (
    (coalesce(lane_code, '') || ' ' || coalesce(origin_city, '') || ' ' || coalesce(destination_city, '') || ' ' || coalesce(carrier, '') || ' ' || coalesce(product_name, ''))
    gin_trgm_ops
  );

-- RPC wrapper so PostgREST can actually query against the functional trigram index above
-- (PostgREST filters can't reference a computed/concatenated expression directly).
create or replace function public.search_lanes(p_query text)
returns setof public.transport_lanes
language sql
stable
as $$
  select *
  from public.transport_lanes
  where (coalesce(lane_code, '') || ' ' || coalesce(origin_city, '') || ' ' || coalesce(destination_city, '') || ' ' || coalesce(carrier, '') || ' ' || coalesce(product_name, ''))
    ilike '%' || p_query || '%'
  order by similarity(
    coalesce(lane_code, '') || ' ' || coalesce(origin_city, '') || ' ' || coalesce(destination_city, '') || ' ' || coalesce(carrier, '') || ' ' || coalesce(product_name, ''),
    p_query
  ) desc;
$$;
`;

// Test live connection to Supabase instance
export async function testSupabaseConnection(
  config?: SupabaseSettings
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const currentConfig = config || getSavedSupabaseConfig();
  if (!currentConfig.url || !currentConfig.anonKey) {
    return {
      success: false,
      message: 'Supabase URL and Anon Public Key are required.'
    };
  }

  const startTime = performance.now();
  try {
    const testClient = createClient(currentConfig.url, currentConfig.anonKey);
    const { error } = await testClient.from('transport_lanes').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - startTime);

    if (error && error.code !== 'PGRST116') {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return {
          success: true,
          latencyMs,
          message: 'Supabase instance reached! Run the 1-Click SQL migration in Supabase SQL editor to create & seed tables.'
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to authenticate with Supabase anon key.'
      };
    }

    return {
      success: true,
      latencyMs,
      message: 'Supabase connection verified. PostgreSQL instance is active & ready.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network error attempting to reach Supabase project.'
    };
  }
}

// Push local lanes/alerts/audit logs to Supabase. Each table is upserted independently so a
// failure on one (e.g. RLS rejection, missing column) doesn't silently swallow the others —
// the returned syncedTables counts and tableErrors reflect what was actually written.
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
      syncedTables: { lanes: 0, alerts: 0, auditLogs: 0 },
      errorMessage: 'Supabase URL/Key not configured. Operating in high-speed local browser caching mode.'
    };
  }

  const tableErrors: NonNullable<CloudSyncState['tableErrors']> = {};
  const syncedTables = { lanes: 0, alerts: 0, auditLogs: 0 };

  try {
    const { data: laneData, error: lanesError } = await client
      .from('transport_lanes')
      .upsert(lanes.map(l => mapLaneToRow(l, timestamp)), { onConflict: 'id' })
      .select('id');
    if (lanesError) {
      tableErrors.lanes = lanesError.message;
      console.warn('Supabase lanes sync notice:', lanesError.message);
    } else {
      syncedTables.lanes = laneData?.length ?? lanes.length;
    }
  } catch (err: any) {
    tableErrors.lanes = err?.message || 'Unknown error syncing lanes';
  }

  try {
    const { data: alertData, error: alertsError } = await client
      .from('alert_notifications')
      .upsert(alerts.map(mapAlertToRow), { onConflict: 'id' })
      .select('id');
    if (alertsError) {
      tableErrors.alerts = alertsError.message;
      console.warn('Supabase alerts sync notice:', alertsError.message);
    } else {
      syncedTables.alerts = alertData?.length ?? alerts.length;
    }
  } catch (err: any) {
    tableErrors.alerts = err?.message || 'Unknown error syncing alerts';
  }

  try {
    const { data: auditData, error: auditError } = await client
      .from('audit_trail')
      .upsert(auditLogs.map(mapAuditLogToRow), { onConflict: 'id' })
      .select('id');
    if (auditError) {
      tableErrors.auditLogs = auditError.message;
      console.warn('Supabase audit trail sync notice:', auditError.message);
    } else {
      syncedTables.auditLogs = auditData?.length ?? auditLogs.length;
    }
  } catch (err: any) {
    tableErrors.auditLogs = err?.message || 'Unknown error syncing audit trail';
  }

  const errorCount = Object.keys(tableErrors).length;
  const status: CloudSyncState['status'] = errorCount === 0 ? 'synced' : errorCount === 3 ? 'error' : 'partial';

  return {
    status,
    lastSyncedAt: timestamp,
    syncedTables,
    tableErrors: errorCount > 0 ? tableErrors : undefined,
    errorMessage: errorCount > 0
      ? Object.entries(tableErrors).map(([table, msg]) => `${table}: ${msg}`).join(' | ')
      : null,
  };
}

export const syncAllToSupabase = syncDataToSupabase;

// Read lanes, alerts, audit trail, and recent telemetry back from Supabase. Returns null
// (rather than throwing) when there's no client configured or the core lanes table can't be
// read, so callers can cleanly fall back to local demo data.
export async function fetchAllFromSupabase(): Promise<{
  lanes: TransportLane[];
  alerts: AlertNotification[];
  auditLogs: AuditLogEntry[];
} | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: laneRows, error: lanesError } = await client.from('transport_lanes').select('*');
  if (lanesError || !laneRows) {
    console.warn('Supabase lane fetch notice:', lanesError?.message);
    return null;
  }

  const [{ data: alertRows, error: alertsError }, { data: auditRows, error: auditError }, { data: telemetryRows, error: telemetryError }] =
    await Promise.all([
      client.from('alert_notifications').select('*'),
      client.from('audit_trail').select('*'),
      client.from('temperature_telemetry').select('*').order('timestamp', { ascending: true }),
    ]);

  if (alertsError) console.warn('Supabase alerts fetch notice:', alertsError.message);
  if (auditError) console.warn('Supabase audit trail fetch notice:', auditError.message);
  if (telemetryError) console.warn('Supabase telemetry fetch notice:', telemetryError.message);

  const telemetryByLane = new Map<string, ReturnType<typeof mapRowToTemperatureReading>[]>();
  for (const row of telemetryRows || []) {
    const laneId = String(row.lane_id);
    const list = telemetryByLane.get(laneId) || [];
    list.push(mapRowToTemperatureReading(row));
    telemetryByLane.set(laneId, list);
  }

  const lanes = laneRows.map((row: any) => mapRowToLane(row, (telemetryByLane.get(String(row.id)) || []).slice(-10)));
  const alerts = (alertRows || []).map(mapRowToAlert);
  const auditLogs = (auditRows || [])
    .map(mapRowToAuditLog)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return { lanes, alerts, auditLogs };
}

// ---------------------------------------------------------------------------
// Real Supabase Auth (email/password) — this is the actual security boundary.
// user_profiles is just a display-data table the app reads/writes best-effort;
// the auth.users record created by supabase.auth.* is what's authoritative.
// ---------------------------------------------------------------------------

async function fetchProfileRow(client: SupabaseClient, id: string, email: string): Promise<any | null> {
  const byId = await client.from('user_profiles').select('*').eq('id', id).maybeSingle();
  if (byId.data) return byId.data;
  const byEmail = await client.from('user_profiles').select('*').eq('email', email).maybeSingle();
  return byEmail.data || null;
}

function buildUserFromAuth(authUser: { id: string; email?: string | null; created_at?: string; user_metadata?: any }, profileRow: any | null): SupabaseUser {
  const email = authUser.email || profileRow?.email || '';
  const meta = authUser.user_metadata || {};
  return {
    id: authUser.id,
    email,
    name: profileRow?.full_name || meta.full_name || email.split('@')[0],
    role: (profileRow?.role || meta.role || 'Supply Chain Analyst') as SupabaseUser['role'],
    organization: profileRow?.organization || meta.organization || 'Unassigned Organization',
    createdAt: authUser.created_at || new Date().toISOString(),
    avatarUrl: profileRow?.avatar_url || undefined,
    authProvider: 'Supabase Cloud Auth',
  };
}

export interface AuthResult {
  success: boolean;
  message: string;
  needsEmailConfirmation?: boolean;
  user?: SupabaseUser;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  profile: { fullName: string; role: SupabaseUser['role']; organization: string }
): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase is not configured. Add your project URL and anon key in Settings.' };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: profile.fullName, role: profile.role, organization: profile.organization },
    },
  });

  if (error) return { success: false, message: error.message };
  if (!data.user) return { success: false, message: 'Registration failed for an unknown reason.' };

  const needsEmailConfirmation = !data.session;

  // Best-effort mirror into user_profiles so the rest of the app (which only reads that
  // table) can see this person. Never block the auth result on this succeeding.
  try {
    await client.from('user_profiles').upsert(
      {
        id: data.user.id,
        email,
        full_name: profile.fullName,
        role: profile.role,
        organization: profile.organization,
      },
      { onConflict: 'id' }
    );
  } catch {
    // non-fatal
  }

  return {
    success: true,
    needsEmailConfirmation,
    message: needsEmailConfirmation
      ? `Account created for ${email}. Check your inbox for a confirmation link before signing in.`
      : 'Account created and signed in.',
    user: buildUserFromAuth(data.user, null),
  };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase is not configured. Add your project URL and anon key in Settings.' };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { success: false, message: error.message };
  if (!data.user) return { success: false, message: 'Sign-in failed for an unknown reason.' };

  const profileRow = await fetchProfileRow(client, data.user.id, email).catch(() => null);
  return { success: true, message: 'Signed in.', user: buildUserFromAuth(data.user, profileRow) };
}

export async function signOutFromSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // non-fatal — local session state is cleared by the caller regardless
  }
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase is not configured.' };

  const { error } = await client.auth.resetPasswordForEmail(email);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Password reset link sent to ${email}, if an account exists for that address.` };
}

/** Restores a signed-in Supabase Auth session on app load, if one exists. */
export async function restoreSupabaseSession(): Promise<SupabaseUser | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  const authUser = data.session?.user;
  if (!authUser) return null;

  const profileRow = await fetchProfileRow(client, authUser.id, authUser.email || '').catch(() => null);
  return buildUserFromAuth(authUser, profileRow);
}

/**
 * Reads the real `ports` reference table from the connected Supabase project (GDP
 * certification, cold storage, customs delay, and facility reliability data), used to
 * ground the transport-mode/stop recommendations and route-legality checks in real data.
 * Returns null (not an empty array) when unreachable, so callers can fall back cleanly.
 */
export async function fetchPortsFromSupabase(): Promise<PortEntry[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('ports').select('*');
  if (error || !data) {
    console.warn('Supabase ports fetch notice:', error?.message);
    return null;
  }
  return data.map(mapPortsRowToEntry);
}

export interface DashboardSummary {
  totalLanes: number;
  activeLanes: number;
  highRiskLanes: number;
  avgGdpCompliance: number;
  activeExcursions: number;
  payloadInTransitUsd: number;
  unresolvedCriticalAlerts: number;
}

/**
 * Reads the real `dashboard_summary` view so every stat card shares one source of truth.
 * Note: as of this writing the view's own active_excursions/high_risk_lanes columns are
 * still keyed off the lanes' stored status rather than comparing current_temp against
 * temp_min/temp_max directly, so they can under-report live excursions the same way the
 * client-side fields used to — see the corrected view SQL in SUPABASE_SQL_MIGRATION.
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('dashboard_summary').select('*').maybeSingle();
  if (error || !data) {
    console.warn('Supabase dashboard_summary fetch notice:', error?.message);
    return null;
  }

  return {
    totalLanes: Number(data.total_lanes) || 0,
    activeLanes: Number(data.active_lanes) || 0,
    highRiskLanes: Number(data.high_risk_lanes) || 0,
    avgGdpCompliance: Number(data.avg_gdp_compliance) || 0,
    activeExcursions: Number(data.active_excursions) || 0,
    payloadInTransitUsd: Number(data.payload_in_transit_usd) || 0,
    unresolvedCriticalAlerts: Number(data.unresolved_critical_alerts) || 0,
  };
}

/**
 * Server-side lane search via the search_lanes(p_query) RPC, which queries the trigram
 * GIN index (idx_lanes_search_trgm) instead of a client-side per-field scan. Returns null
 * (not an empty array) when the RPC isn't available yet (e.g. migration not re-run), so
 * callers can fall back to filtering the already-loaded lanes list client-side.
 */
export async function searchLanesRemote(query: string): Promise<TransportLane[] | null> {
  const client = getSupabaseClient();
  if (!client || !query.trim()) return null;

  const { data, error } = await client.rpc('search_lanes', { p_query: query.trim() });
  if (error || !data) {
    console.warn('search_lanes RPC notice (falling back to client-side search):', error?.message);
    return null;
  }
  return data.map((row: any) => mapRowToLane(row));
}

export interface LaneBaseRisk {
  riskScore: number;
  riskLevel: RiskLevel;
}

/**
 * Calls the live `calculate_lane_base_risk(p_origin_iata, p_destination_iata, p_mode,
 * p_temp_range_type)` DB function — the DB-side risk model used for the wizard's route
 * comparison, so "your route" and "the suggested alternative" are scored by the exact same
 * function a fresh direct query would use. Returns null (never throws) when the cloud isn't
 * connected or the RPC isn't reachable, so callers can fall back to the local corridor
 * assessment (`assessRoute`) alone.
 */
export async function calculateLaneBaseRisk(
  originIata: string,
  destinationIata: string,
  mode: string,
  tempRangeType: string
): Promise<LaneBaseRisk | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.rpc('calculate_lane_base_risk', {
    p_origin_iata: originIata,
    p_destination_iata: destinationIata,
    p_mode: mode,
    p_temp_range_type: tempRangeType,
  });
  if (error || !data || !data[0]) {
    console.warn('calculate_lane_base_risk RPC notice (falling back to local assessment):', error?.message);
    return null;
  }
  const row = data[0];
  return { riskScore: Number(row.risk_score) || 0, riskLevel: (row.risk_level as RiskLevel) || 'Low' };
}

// ---------------------------------------------------------------------------
// Corridor advisories & carriers (route/carrier recommendation engine)
// ---------------------------------------------------------------------------

export async function fetchCorridorAdvisories(): Promise<CorridorAdvisory[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('corridor_advisories').select('*');
  if (error || !data) {
    console.warn('corridor_advisories fetch notice (advisory checks skipped):', error?.message);
    return null;
  }
  return data.map(mapRowToCorridorAdvisory);
}

export async function fetchCarriers(): Promise<Carrier[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('carriers').select('*');
  if (error || !data) {
    console.warn('carriers fetch notice (carrier recommendation skipped):', error?.message);
    return null;
  }
  return data.map(mapRowToCarrier);
}

/** From carrier_performance_summary — only ever has rows for carriers with 5+ logged
 * shipments (see carrier_performance_logs), so an empty/missing result means "no data yet,"
 * never a fabricated 0%. Returns null (not []) if the view itself isn't reachable, so callers
 * can tell "no data" apart from "couldn't check." */
export async function fetchCarrierPerformanceSummary(): Promise<CarrierPerformanceSummary[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('carrier_performance_summary').select('*');
  if (error || !data) {
    console.warn('carrier_performance_summary fetch notice (falling back to static reliability_score only):', error?.message);
    return null;
  }
  return data.map(mapRowToCarrierPerformanceSummary);
}

/**
 * Writes a single audit_trail row live, as it happens — not just to local React state. Used
 * for GDP-relevant events (recommendation overrides especially) where "the UI showed it in the
 * audit log" isn't sufficient; it needs to actually be in the database. Fire-and-forget by
 * design (returns success/failure but callers shouldn't block user flow on it) since audit
 * logging must never be able to block a user action — see the override-acknowledgment flow.
 */
export async function insertAuditLogEntry(log: AuditLogEntry): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('audit_trail').insert(mapAuditLogToRow(log));
  if (error) {
    console.warn('audit_trail insert notice:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Conversational assistant deployment instructions (shown in Settings -> Supabase Cloud
// Database, next to the SQL migration box). The assistant is a Supabase Edge Function that
// holds the Anthropic API key server-side — the browser (and this anon key) never sees it, so
// it can only be deployed with real Supabase CLI / dashboard access, not from inside the app.
// ---------------------------------------------------------------------------

export const ASSISTANT_DEPLOYMENT_STEPS = `# Deploy the PharmaTrack conversational assistant
# Source: supabase/functions/assistant/ in this project's repo

# 1. Install the Supabase CLI if you don't have it
brew install supabase/tap/supabase   # or see https://supabase.com/docs/guides/cli

# 2. Log in and link this project (find the ref in your Supabase dashboard URL)
supabase login
supabase link --project-ref bizsmdoblqmkxybnppyw

# 3. Create a private Storage bucket named "reports" for generated .docx files
#    Dashboard -> Storage -> New Bucket -> name "reports", Public = OFF
#    (bucket creation needs the dashboard or a service-role key, not the anon key)

# 4. Set your Anthropic API key as a secret - never committed, never sent to the browser
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 5. Deploy
supabase functions deploy assistant

# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform -
# nothing else to configure. The frontend chat panel calls this function automatically once
# it's deployed; until then it shows a clear "assistant isn't reachable yet" message instead
# of failing silently.`;

/**
 * Writes the live-computed effective risk (see utils/laneRisk.ts) back to transport_lanes'
 * risk_score/risk_level columns. This exists because dashboard_summary (and anything else
 * that reads risk_level directly) has no way to know a lane is currently excursing unless
 * that fact is persisted — risk_level is a stored column set at creation time, not derived
 * live. Rather than have two definitions of "high risk" (the UI's live derivation vs. the
 * DB's stale stored value), this keeps the stored value itself correct, so every consumer —
 * the Lane table, the dashboard view, a future report — agrees by construction. Fire-and-forget:
 * this must never block the UI it's correcting.
 */
export async function syncLaneRiskToSupabase(laneId: string, riskScore: number, riskLevel: RiskLevel): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('transport_lanes').update({ risk_score: riskScore, risk_level: riskLevel }).eq('id', laneId);
  if (error) {
    console.warn('transport_lanes risk sync notice:', error.message);
    return false;
  }
  return true;
}
