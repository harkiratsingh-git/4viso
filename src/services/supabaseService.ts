import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TransportLane, AlertNotification, AuditLogEntry, SupabaseSettings, SupabaseUser, CloudSyncState, RiskLevel, GdpStatus, CorridorAdvisory, Carrier, CarrierPerformanceSummary, LaneLeg, LaneCarrierSummary, LaneRouteOption, CarrierCertificationStatus, CarrierCertification, LaneDisruption, TransferDocument } from '../types';
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
  mapRowToLaneLeg,
  mapLaneLegToRow,
  mapRowToLaneCarrierSummary,
  mapRowToLaneRouteOption,
  mapLaneRouteOptionToRow,
  mapRowToCarrierCertificationStatus,
  mapRowToCarrierCertification,
  mapRowToLaneDisruption,
  mapRowToTransferDocument,
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

/**
 * The identity shown when genuinely not authenticated (Local Simulation) — deliberately a
 * generic placeholder, not a real person. This used to be a hardcoded real name/email/avatar
 * (the app owner's own), shown to every anonymous visitor as if they were a signed-in Quality
 * Lead — both an identity-consistency bug (it disagreed with the separate role-persona display
 * elsewhere) and a real person's PII displayed to every stranger who never authenticated.
 * `authProvider` is deliberately left unset here since 'None' isn't a real provider name.
 */
export const DEFAULT_SUPABASE_USER: SupabaseUser = {
  id: 'demo-visitor',
  email: '',
  name: 'Demo Visitor',
  role: 'Supply Chain Analyst',
  organization: 'Local Simulation',
  createdAt: new Date(0).toISOString(),
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

-- Scoped read/write policies for authenticated users only. Earlier versions of this script
-- used "for all using (true) with check (true)" policies open to anon+authenticated, which
-- gave unauthenticated read/write access to the entire dataset despite RLS being "enabled" —
-- that was found live on this project and fixed; this script now matches the fixed baseline
-- so re-running it (e.g. on a fresh project) can't reintroduce the same hole.
drop policy if exists "Allow all operations for authenticated and anon users" on public.transport_lanes;
drop policy if exists "Read all lanes" on public.transport_lanes;
create policy "Read all lanes" on public.transport_lanes for select to authenticated using (true);
drop policy if exists "Create lanes" on public.transport_lanes;
create policy "Create lanes" on public.transport_lanes for insert to authenticated with check (true);
drop policy if exists "Update lanes" on public.transport_lanes;
create policy "Update lanes" on public.transport_lanes for update to authenticated using (true);

drop policy if exists "Allow all operations for telemetry" on public.temperature_telemetry;
drop policy if exists "Read all telemetry" on public.temperature_telemetry;
create policy "Read all telemetry" on public.temperature_telemetry for select to authenticated using (true);

drop policy if exists "Allow all operations for alerts" on public.alert_notifications;
drop policy if exists "Read all alerts" on public.alert_notifications;
create policy "Read all alerts" on public.alert_notifications for select to authenticated using (true);
drop policy if exists "Create alerts" on public.alert_notifications;
create policy "Create alerts" on public.alert_notifications for insert to authenticated with check (true);
drop policy if exists "Acknowledge alerts" on public.alert_notifications;
create policy "Acknowledge alerts" on public.alert_notifications for update to authenticated
  using (exists (select 1 from public.user_profiles where user_profiles.id = auth.uid() and user_profiles.role in ('Quality Lead', 'GDP Auditor')));

drop policy if exists "Allow all operations for audit" on public.audit_trail;
drop policy if exists "Read audit trail" on public.audit_trail;
create policy "Read audit trail" on public.audit_trail for select to authenticated using (true);
drop policy if exists "Append audit trail" on public.audit_trail;
create policy "Append audit trail" on public.audit_trail for insert to authenticated with check (true);

drop policy if exists "Allow all operations for profiles" on public.user_profiles;
drop policy if exists "Read all profiles" on public.user_profiles;
create policy "Read all profiles" on public.user_profiles for select to authenticated using (true);
drop policy if exists "Create own profile" on public.user_profiles;
create policy "Create own profile" on public.user_profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Update own profile" on public.user_profiles;
create policy "Update own profile" on public.user_profiles for update to authenticated using (auth.uid() = id);

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
--    NOTE: the live project's actual dashboard_summary view now computes active_excursions
--    from alert_notifications.alert_type = 'TEMPERATURE_EXCURSION' instead (that table is
--    the real source of truth once an excursion has been triaged into an alert), so this
--    script's version and the live view have diverged — this is the fallback definition for
--    a fresh project, not a mirror of production. security_invoker is required: a plain
--    (definer-mode) view here would bypass every RLS policy above, which is exactly the bug
--    that was found and fixed live (anon could read full dashboard_summary contents through
--    the view even with correct RLS on transport_lanes/alert_notifications).
-- ==========================================================

create or replace view public.dashboard_summary
with (security_invoker = true)
as
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

/**
 * Inserts a single newly-created lane into transport_lanes. This was missing entirely from the
 * Add Lane wizard's save path — handleFinish() only ever updated local React state, so a
 * cloud-connected session's new lane existed solely in that browser tab's memory (gone on
 * reload) and the lane_legs/lane_route_options writes for it were silently failing server-side
 * on the foreign key, since the lane row they reference never actually existed. Returns false
 * (not an error) when offline/local — callers should treat that as "nothing more to persist
 * server-side," not a failure.
 */
export async function insertLaneToSupabase(lane: TransportLane): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('transport_lanes').insert(mapLaneToRow(lane, new Date().toISOString()));
  if (error) {
    console.warn('transport_lanes insert notice:', error.message);
    return false;
  }
  return true;
}

export interface LaneRouteUpdate {
  originCity: string; originIata: string; originCountry: string; originCoords: [number, number];
  destinationCity: string; destinationIata: string; destinationCountry: string; destinationCoords: [number, number];
  stops: TransportLane['stops'];
  mode: TransportLane['mode'];
  carrier: string;
  productName: string;
  productCategory: TransportLane['productCategory'];
  tempRangeType: TransportLane['tempRangeType'];
  tempMin: number;
  tempMax: number;
}

/**
 * Persists an Edit Lane (emergency reroute / carrier / cargo change) to transport_lanes. This
 * was entirely missing — the Edit Lane modal only ever updated local React state, so a
 * cloud-connected session's reroute existed solely in that browser tab's memory (reverted on
 * reload) even though the audit trail entry describing it was real and permanent. Caller is
 * responsible for the dataSource === 'cloud' gate, matching every other cloud-only write in
 * this app.
 */
export async function updateLaneRouteInSupabase(laneId: string, updates: LaneRouteUpdate): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client
    .from('transport_lanes')
    .update({
      origin_city: updates.originCity,
      origin_iata: updates.originIata,
      origin_country: updates.originCountry,
      origin_lat: updates.originCoords[0],
      origin_lng: updates.originCoords[1],
      destination_city: updates.destinationCity,
      destination_iata: updates.destinationIata,
      destination_country: updates.destinationCountry,
      destination_lat: updates.destinationCoords[0],
      destination_lng: updates.destinationCoords[1],
      stops: updates.stops,
      mode: updates.mode,
      carrier: updates.carrier,
      product_name: updates.productName,
      product_category: updates.productCategory,
      temp_range_type: updates.tempRangeType,
      temp_min: updates.tempMin,
      temp_max: updates.tempMax,
      last_updated: new Date().toISOString(),
    })
    .eq('id', laneId);
  if (error) {
    console.warn('transport_lanes route update notice:', error.message);
    return false;
  }
  return true;
}

/** Persists a Manage Route Stops change to transport_lanes.stops — same missing-persistence gap
 *  as updateLaneRouteInSupabase, for the narrower "just the stops" edit flow. */
export async function updateLaneStopsInSupabase(laneId: string, stops: TransportLane['stops']): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client
    .from('transport_lanes')
    .update({ stops, last_updated: new Date().toISOString() })
    .eq('id', laneId);
  if (error) {
    console.warn('transport_lanes stops update notice:', error.message);
    return false;
  }
  return true;
}

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

/**
 * Self-heals a missing user_profiles row on sign-in — signUpWithEmail's own upsert only has a
 * real session to authenticate with when email confirmation is disabled; when confirmation is
 * required (the common case), that upsert silently runs unauthenticated and is rejected by RLS,
 * so the row genuinely doesn't exist yet by the time the user first signs in. Always inserts the
 * lowest-privilege default — this must never touch an existing row (an admin may have already
 * elevated it), so it's a plain INSERT gated on "row doesn't exist yet", not an upsert.
 */
async function ensureProfileRow(client: SupabaseClient, authUser: { id: string; email?: string | null; user_metadata?: any }, existing: any | null): Promise<any | null> {
  if (existing) return existing;
  const meta = authUser.user_metadata || {};
  const { data, error } = await client
    .from('user_profiles')
    .insert({
      id: authUser.id,
      email: authUser.email || '',
      full_name: meta.full_name || (authUser.email || '').split('@')[0],
      role: 'Supply Chain Analyst',
      organization: meta.organization || 'Unassigned Organization',
    })
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('user_profiles self-heal insert notice:', error.message);
    return null;
  }
  return data;
}

/**
 * `user_metadata` on the Supabase Auth user (authUser.user_metadata) is NOT a trustworthy
 * source for role/privilege — it's editable by the user themselves via a plain
 * `supabase.auth.updateUser({ data: {...} })` call, which no RLS policy can restrict (RLS only
 * governs table rows, not the auth.users JWT claims). The only authoritative source for role is
 * user_profiles.role, which the "Update own profile" RLS policy now blocks a user from changing
 * on themselves. So this deliberately does NOT fall back to meta.role for `role` — a missing
 * profile row means the lowest-privilege default, never whatever the signup metadata claims.
 * (Non-privilege display fields like full_name/organization are low-stakes enough to still take
 * the metadata as a fallback purely for a smoother first-run display before the profile row
 * exists.)
 */
function buildUserFromAuth(authUser: { id: string; email?: string | null; created_at?: string; user_metadata?: any }, profileRow: any | null): SupabaseUser {
  const email = authUser.email || profileRow?.email || '';
  const meta = authUser.user_metadata || {};
  return {
    id: authUser.id,
    email,
    name: profileRow?.full_name || meta.full_name || email.split('@')[0],
    role: (profileRow?.role || 'Supply Chain Analyst') as SupabaseUser['role'],
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

/**
 * `role` is deliberately not part of the public signup profile — every new account starts as
 * 'Supply Chain Analyst' (see the "Create own profile" RLS policy, which now rejects any other
 * value on insert). Elevation to Quality Lead/GDP Auditor is an admin-only action performed by
 * an existing Quality Lead/GDP Auditor from Settings, never something a new signup can choose
 * for themselves.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  profile: { fullName: string; organization: string }
): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase is not configured. Add your project URL and anon key in Settings.' };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: profile.fullName, organization: profile.organization },
    },
  });

  if (error) return { success: false, message: error.message };
  if (!data.user) return { success: false, message: 'Registration failed for an unknown reason.' };

  const needsEmailConfirmation = !data.session;

  // Best-effort mirror into user_profiles so the rest of the app (which only reads that
  // table) can see this person. Only succeeds here when email confirmation is disabled (a real
  // session exists immediately) — otherwise ensureProfileRow on first sign-in creates it instead.
  try {
    await client.from('user_profiles').insert({
      id: data.user.id,
      email,
      full_name: profile.fullName,
      role: 'Supply Chain Analyst',
      organization: profile.organization,
    });
  } catch {
    // non-fatal — ensureProfileRow on sign-in covers this
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

  const existing = await fetchProfileRow(client, data.user.id, email).catch(() => null);
  const profileRow = await ensureProfileRow(client, data.user, existing).catch(() => existing);
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

  const existing = await fetchProfileRow(client, authUser.id, authUser.email || '').catch(() => null);
  const profileRow = await ensureProfileRow(client, authUser, existing).catch(() => existing);
  return buildUserFromAuth(authUser, profileRow);
}

export interface UserProfileSummary {
  id: string;
  email: string;
  fullName: string;
  role: SupabaseUser['role'];
  organization: string;
}

function mapRowToUserProfileSummary(row: any): UserProfileSummary {
  return {
    id: String(row.id),
    email: String(row.email || ''),
    fullName: String(row.full_name || row.email || 'Unknown'),
    role: row.role as SupabaseUser['role'],
    organization: String(row.organization || ''),
  };
}

/** Every registered user — "Read all profiles" is open to any authenticated user, so the
 *  Settings role-management panel gates who sees it client-side; the actual elevation write
 *  below is the real (RLS-enforced) gate. */
export async function fetchAllUserProfiles(): Promise<UserProfileSummary[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('user_profiles').select('*').order('full_name', { ascending: true });
  if (error || !data) {
    console.warn('user_profiles list fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToUserProfileSummary);
}

/**
 * Role elevation — only succeeds when the caller is themselves a Quality Lead/GDP Auditor, per
 * the "Admins can update any profile" RLS policy; a non-admin caller gets an RLS rejection here,
 * not a client-side-only block.
 */
export async function updateUserRole(userId: string, newRole: SupabaseUser['role']): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };
  const { error } = await client.from('user_profiles').update({ role: newRole }).eq('id', userId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Role updated.' };
}

/** Self-service profile update (display name, organization) — deliberately does not accept
 *  `role`; that field is only ever changed via updateUserRole, which the RLS "Admins can
 *  update any profile" policy actually enforces server-side. */
export async function updateUserProfile(userId: string, updates: { fullName: string; organization: string }): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };
  const { error } = await client.from('user_profiles').update({ full_name: updates.fullName, organization: updates.organization }).eq('id', userId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Profile updated.' };
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Uploads to the `avatars` storage bucket at `<user-id>/avatar.<ext>` — the path itself is what
 * the "own folder" RLS policy checks (storage.foldername(name)[1] = auth.uid()), so a user can
 * only ever write to their own avatar path. `upsert: true` so re-uploading replaces the same
 * object rather than accumulating orphaned files.
 */
export async function uploadAvatar(userId: string, file: File): Promise<{ success: boolean; avatarUrl?: string; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return { success: false, message: 'Unsupported file type — use PNG, JPEG, WebP, or GIF.' };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { success: false, message: 'File too large — 2MB maximum.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await client.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (uploadError) return { success: false, message: uploadError.message };

  const { data: publicUrlData } = client.storage.from('avatars').getPublicUrl(path);
  // Cache-bust — re-uploading keeps the same path, so without this the browser (and any CDN
  // cache) would keep showing the old image at that URL.
  const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await client.from('user_profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
  if (profileError) return { success: false, message: `Uploaded but failed to save to profile: ${profileError.message}` };

  return { success: true, avatarUrl, message: 'Avatar updated.' };
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
 * active_excursions is keyed off alert_notifications.alert_type = 'TEMPERATURE_EXCURSION'
 * (see the view SQL in SUPABASE_SQL_MIGRATION) rather than comparing current_temp against
 * temp_min/temp_max directly.
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

export interface CapaRecord {
  id: string;
  capaNumber: string;
  alertId: string;
  laneCode: string;
  title: string;
  description: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  owner: string;
  status: string;
  priority: string;
  dueDate: string | null;
  closedDate: string | null;
  createdAt: string;
}

function mapRowToCapaRecord(row: any): CapaRecord {
  return {
    id: String(row.id),
    capaNumber: String(row.capa_number),
    alertId: String(row.alert_id),
    laneCode: String(row.lane_code),
    title: String(row.title),
    description: String(row.description),
    rootCause: String(row.root_cause),
    correctiveAction: String(row.corrective_action),
    preventiveAction: String(row.preventive_action),
    owner: String(row.owner),
    status: String(row.status),
    priority: String(row.priority),
    dueDate: row.due_date ?? null,
    closedDate: row.closed_date ?? null,
    createdAt: String(row.created_at),
  };
}

export interface GdpComplianceSnapshot {
  snapshotDate: string;
  avgGdpCompliance: number;
  totalLanes: number;
  highRiskLanes: number;
}

export async function fetchGdpComplianceSnapshots(): Promise<GdpComplianceSnapshot[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('gdp_compliance_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true });
  if (error || !data) {
    console.warn('gdp_compliance_snapshots fetch notice:', error?.message);
    return null;
  }
  return data.map((row: any) => ({
    snapshotDate: String(row.snapshot_date),
    avgGdpCompliance: Number(row.avg_gdp_compliance) || 0,
    totalLanes: Number(row.total_lanes) || 0,
    highRiskLanes: Number(row.high_risk_lanes) || 0,
  }));
}

export async function fetchCapaRecords(): Promise<CapaRecord[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('capa_records').select('*').order('created_at', { ascending: false });
  if (error || !data) {
    console.warn('capa_records fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToCapaRecord);
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

// ---------------------------------------------------------------------------
// Lane legs, route options, and carrier certifications (per-leg recommendation system)
// ---------------------------------------------------------------------------

export async function fetchLaneLegs(laneId: string): Promise<LaneLeg[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('lane_legs').select('*').eq('lane_id', laneId).order('leg_sequence', { ascending: true });
  if (error || !data) {
    console.warn('lane_legs fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToLaneLeg);
}

/** Replaces every leg for a lane in one go (delete + reinsert) — simpler and safer than a
 * diff/upsert here since a route edit routinely changes the leg count itself (adding/removing
 * a stop shifts every later leg_sequence), so there's rarely a stable identity to upsert against. */
export async function replaceLaneLegs(laneId: string, legs: Omit<LaneLeg, 'id' | 'laneId'>[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error: deleteError } = await client.from('lane_legs').delete().eq('lane_id', laneId);
  if (deleteError) {
    console.warn('lane_legs delete notice:', deleteError.message);
    return false;
  }
  if (legs.length === 0) return true;
  const rows = legs.map((leg) => mapLaneLegToRow({ ...leg, laneId }));
  const { error: insertError } = await client.from('lane_legs').insert(rows);
  if (insertError) {
    console.warn('lane_legs insert notice:', insertError.message);
    return false;
  }
  return true;
}

/** From lane_carrier_summary — distinct_carrier_count === 1 && distinct_mode_count === 1 means
 * the UI should collapse to one unified badge instead of a per-leg breakdown. */
export async function fetchLaneCarrierSummary(laneId: string): Promise<LaneCarrierSummary | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('lane_carrier_summary').select('*').eq('lane_id', laneId).maybeSingle();
  if (error || !data) {
    console.warn('lane_carrier_summary fetch notice:', error?.message);
    return null;
  }
  return mapRowToLaneCarrierSummary(data);
}

/** lane_route_options is insert-only by design (no UPDATE policy) — a real, immutable audit
 * trail of what was recommended vs. what was actually chosen, for GDP compliance review. */
export async function insertLaneRouteOption(
  option: Omit<LaneRouteOption, 'id' | 'laneId'>,
  laneId: string | null,
  createdBy: string | null
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('lane_route_options').insert(mapLaneRouteOptionToRow(option, laneId, createdBy));
  if (error) {
    console.warn('lane_route_options insert notice:', error.message);
    return false;
  }
  return true;
}

export async function fetchLaneRouteOptions(laneId: string): Promise<LaneRouteOption[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('lane_route_options').select('*').eq('lane_id', laneId).order('created_at', { ascending: false });
  if (error || !data) {
    console.warn('lane_route_options fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToLaneRouteOption);
}

/** carrier_certification_status is already readable by any authenticated user (no new RLS
 * needed) — this is what the per-leg carrier picker checks before allowing a carrier to be used
 * without an override, and what the auto-attach logic reads to find a Verified cert. */
export async function fetchCarrierCertificationStatuses(): Promise<CarrierCertificationStatus[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('carrier_certification_status').select('*');
  if (error || !data) {
    console.warn('carrier_certification_status fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToCarrierCertificationStatus);
}

/** The Verified certification on file for a carrier, regardless of who uploaded it — this is
 * exactly what gets auto-attached when that carrier is selected. Picks the most recently
 * uploaded Verified row if more than one exists. */
export async function fetchVerifiedCertificationForCarrier(carrierId: string): Promise<CarrierCertification | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('carrier_certifications')
    .select('*')
    .eq('carrier_id', carrierId)
    .eq('status', 'Verified')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('carrier_certifications fetch notice:', error.message);
    return null;
  }
  let uploaderName: string | null = null;
  if (data.uploaded_by) {
    const { data: profile } = await client.from('user_profiles').select('full_name').eq('id', data.uploaded_by).maybeSingle();
    uploaderName = profile?.full_name ?? null;
  }
  return mapRowToCarrierCertification(data, uploaderName);
}

/** Uploads a certification document to the private carrier-certifications storage bucket and
 * records it as Pending Review — a Quality Lead/GDP Auditor must still verify it (see the
 * "Review certifications" RLS policy) before it can be auto-attached anywhere. */
export async function uploadCarrierCertification(
  carrierId: string,
  file: File,
  documentType: CarrierCertification['documentType'],
  uploadedBy: string
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  const storagePath = `${carrierId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await client.storage.from('carrier-certifications').upload(storagePath, file);
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { error: insertError } = await client.from('carrier_certifications').insert({
    carrier_id: carrierId,
    document_type: documentType,
    storage_path: storagePath,
    original_filename: file.name,
    uploaded_by: uploadedBy,
    status: 'Pending Review',
  });
  if (insertError) {
    return { success: false, message: insertError.message };
  }
  return { success: true, message: 'Certification uploaded and pending review.' };
}

// ---------------------------------------------------------------------------
// Phase 4: emergency mid-transit disruption handling
// ---------------------------------------------------------------------------

export async function fetchLaneDisruptions(laneId: string): Promise<LaneDisruption[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('lane_disruptions').select('*').eq('lane_id', laneId).order('reported_at', { ascending: false });
  if (error || !data) {
    console.warn('lane_disruptions fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToLaneDisruption);
}

export interface ReportDisruptionInput {
  laneId: string;
  laneCode: string;
  legId: string;
  route: string;
  disruptionType: LaneDisruption['disruptionType'];
  description: string;
  reportedBy: string;
  /** Drives the auto-created CAPA's priority — a disruption on a Critical-risk or high-value
   *  cargo lane genuinely warrants a Critical CAPA; a routine Low-risk, low-value lane doesn't,
   *  so this isn't hardcoded to Critical regardless of what actually got disrupted. */
  laneRiskLevel: RiskLevel;
  cargoValueUsd: number;
}

/** Thresholds are deliberately generous ($1M+/$250K+) since even a "Medium" risk lane carrying
 *  a multi-million-dollar cold-chain payload mid-transit is not a routine CAPA. */
function derivedDisruptionCapaPriority(riskLevel: RiskLevel, cargoValueUsd: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (riskLevel === 'Critical' || cargoValueUsd >= 1_000_000) return 'Critical';
  if (riskLevel === 'High' || cargoValueUsd >= 250_000) return 'High';
  if (riskLevel === 'Medium') return 'Medium';
  return 'Low';
}

/**
 * Reports a disruption and, per the spec, automatically opens the CAPA a GDP audit would
 * expect to see for a carrier failure stranding pharma cargo mid-transit — not left for
 * someone to remember to create separately. capa_records.alert_id is NOT NULL + FK'd to a real
 * alert_notifications row, so this also creates the CARRIER_DISRUPTION alert that CAPA
 * references, rather than working around the constraint. Sequenced (alert -> capa ->
 * disruption) since each later insert references the one before it.
 */
export async function reportLaneDisruption(input: ReportDisruptionInput): Promise<{ success: boolean; disruption?: LaneDisruption; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  const priority = derivedDisruptionCapaPriority(input.laneRiskLevel, input.cargoValueUsd);
  // The alert itself stays Critical severity regardless — a mid-transit carrier disruption is
  // always urgent to surface — but the CAPA's priority (which drives remediation SLA) reflects
  // how much is actually at stake on this specific lane.
  const now = new Date().toISOString();
  const alertId = `ALT-DISRUPT-${Date.now()}`;
  const { error: alertError } = await client.from('alert_notifications').insert({
    id: alertId,
    lane_id: input.laneId,
    lane_code: input.laneCode,
    route: input.route,
    timestamp: now,
    alert_type: 'CARRIER_DISRUPTION',
    severity: 'Critical',
    title: `${input.disruptionType} — ${input.laneCode}`,
    message: input.description,
    current_value: input.disruptionType,
    threshold_value: 'N/A',
    is_acknowledged: false,
    capa_required: true,
  });
  if (alertError) return { success: false, message: `Alert creation failed: ${alertError.message}` };

  const capaId = `CAPA-${new Date().getFullYear()}-D${Date.now().toString().slice(-6)}`;
  const { error: capaError } = await client.from('capa_records').insert({
    id: capaId,
    capa_number: capaId,
    alert_id: alertId,
    lane_code: input.laneCode,
    title: `Mid-Transit Disruption: ${input.disruptionType}`,
    description: input.description,
    owner: 'Unassigned',
    status: 'Open',
    priority,
  });
  if (capaError) return { success: false, message: `CAPA creation failed: ${capaError.message}` };

  const { data, error: disruptionError } = await client
    .from('lane_disruptions')
    .insert({
      lane_id: input.laneId,
      leg_id: input.legId,
      disruption_type: input.disruptionType,
      description: input.description,
      reported_by: input.reportedBy,
      status: 'Reported',
      capa_id: capaId,
    })
    .select('*')
    .single();
  if (disruptionError || !data) return { success: false, message: `Disruption record failed: ${disruptionError?.message}` };

  return { success: true, disruption: mapRowToLaneDisruption(data), message: 'Disruption reported and CAPA opened.' };
}

export interface MitigationCapaInput {
  laneId: string;
  laneCode: string;
  route: string;
  riskTitle: string;
  riskDescription: string;
  mitigationStrategy: string;
  severity: RiskLevel;
}

/**
 * "Execute Mitigation" on a Regulatory & GDP risk factor opens a real CAPA, the same way
 * reportLaneDisruption does for a carrier disruption — capa_records.alert_id is NOT NULL + FK'd
 * to alert_notifications, so a standalone CAPA isn't possible; this creates the backing
 * GDP_BREACH alert first, same sequencing (alert -> capa).
 */
export async function createMitigationCapa(input: MitigationCapaInput): Promise<{ success: boolean; capaId?: string; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  const now = new Date().toISOString();
  const alertId = `ALT-MITIGATION-${Date.now()}`;
  const alertSeverity = input.severity === 'Critical' || input.severity === 'High' ? 'Critical' : input.severity === 'Medium' ? 'Warning' : 'Info';
  const { error: alertError } = await client.from('alert_notifications').insert({
    id: alertId,
    lane_id: input.laneId,
    lane_code: input.laneCode,
    route: input.route,
    timestamp: now,
    alert_type: 'GDP_BREACH',
    severity: alertSeverity,
    title: input.riskTitle,
    message: input.riskDescription,
    current_value: input.severity,
    threshold_value: 'GDP 2013/C 343/01',
    is_acknowledged: false,
    capa_required: true,
  });
  if (alertError) return { success: false, message: `Alert creation failed: ${alertError.message}` };

  const capaId = `CAPA-${new Date().getFullYear()}-M${Date.now().toString().slice(-6)}`;
  const { error: capaError } = await client.from('capa_records').insert({
    id: capaId,
    capa_number: capaId,
    alert_id: alertId,
    lane_code: input.laneCode,
    title: input.riskTitle,
    description: input.riskDescription,
    corrective_action: input.mitigationStrategy,
    owner: 'Unassigned',
    status: 'Open',
    priority: input.severity,
  });
  if (capaError) return { success: false, message: `CAPA creation failed: ${capaError.message}` };

  return { success: true, capaId, message: 'CAPA opened and logged to audit trail.' };
}

/** Wraps the can_extend_carrier_contract(leg_id) RPC — per spec, this is an eligibility gate
 * on which resolution options are even shown (international leg + carrier already has a
 * Verified/Not-Required certification on file), not a hard block on the whole flow. */
export async function checkCanExtendCarrierContract(legId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data, error } = await client.rpc('can_extend_carrier_contract', { p_leg_id: legId });
  if (error) {
    console.warn('can_extend_carrier_contract notice:', error.message);
    return false;
  }
  return Boolean(data);
}

export interface ResolveDisruptionInput {
  disruptionId: string;
  resolutionType: 'Resolved - Carrier Replaced' | 'Resolved - Contract Extended' | 'Resolved - Other';
  /** Legs whose carrier_id should be set to newCarrierId — every remaining leg that was
   *  assigned to the disrupted carrier, not just the one flagged leg, since a carrier failure
   *  affects every leg still ahead of it that they were booked for. */
  affectedLegIds: string[];
  newCarrierId: string | null;
  notes: string;
  resolvedBy: string;
  correctiveAction: string;
  preventiveAction?: string;
  /** For the audit_trail row this write also creates — a GDP audit needs the resolution of a
   *  mid-transit disruption in the same immutable trail as every other lane action, not just
   *  reflected in lane_disruptions.status. */
  laneCode: string;
  resolvedByName: string;
  resolvedByRole: string;
}

/** Resolves a disruption: updates the affected legs' carrier assignment (a no-op value-wise
 * for the "extend contract" case, but still recorded), closes out the disruption row, closes
 * the CAPA opened when it was reported with the corrective/preventive action taken, and logs
 * the resolution to audit_trail. */
export async function resolveLaneDisruption(input: ResolveDisruptionInput): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  if (input.newCarrierId && input.affectedLegIds.length > 0) {
    const { error: legsError } = await client
      .from('lane_legs')
      .update({ carrier_id: input.newCarrierId, is_recommended_carrier: false })
      .in('id', input.affectedLegIds);
    if (legsError) return { success: false, message: `Failed to update leg carrier: ${legsError.message}` };
  }

  const now = new Date().toISOString();
  const { data: disruptionRow, error: disruptionError } = await client
    .from('lane_disruptions')
    .update({
      status: input.resolutionType,
      resolution_carrier_id: input.newCarrierId,
      resolution_notes: input.notes,
      resolved_at: now,
      resolved_by: input.resolvedBy,
    })
    .eq('id', input.disruptionId)
    .select('capa_id')
    .single();
  if (disruptionError || !disruptionRow) return { success: false, message: `Failed to update disruption: ${disruptionError?.message}` };

  if (disruptionRow.capa_id) {
    const { error: capaError } = await client
      .from('capa_records')
      .update({
        status: 'Closed',
        corrective_action: input.correctiveAction,
        preventive_action: input.preventiveAction || null,
        closed_date: now.slice(0, 10),
      })
      .eq('id', disruptionRow.capa_id);
    if (capaError) console.warn('capa_records resolution update notice:', capaError.message);
  }

  const { error: auditError } = await client.from('audit_trail').insert({
    id: `log-disrupt-resolve-${Date.now()}`,
    timestamp: now,
    actor: input.resolvedByName,
    role: input.resolvedByRole,
    lane_code: input.laneCode,
    action: `Disruption Resolved: ${input.resolutionType}`,
    category: 'CAPA_LOGGED',
    details: input.notes || input.correctiveAction,
    hash: '0x' + Math.random().toString(16).substring(2, 18),
    status: 'VERIFIED',
  });
  if (auditError) console.warn('audit_trail disruption-resolution insert notice:', auditError.message);

  return { success: true, message: 'Disruption resolved.' };
}

export async function fetchTransferDocuments(disruptionId: string): Promise<TransferDocument[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('transfer_documents').select('*').eq('disruption_id', disruptionId).order('uploaded_at', { ascending: false });
  if (error || !data) {
    console.warn('transfer_documents fetch notice:', error?.message);
    return null;
  }
  return data.map(mapRowToTransferDocument);
}

export async function uploadTransferDocument(
  disruptionId: string,
  legId: string,
  file: File,
  documentType: TransferDocument['documentType'],
  uploadedBy: string
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  const storagePath = `${disruptionId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await client.storage.from('transfer-documents').upload(storagePath, file);
  if (uploadError) return { success: false, message: uploadError.message };

  const { error: insertError } = await client.from('transfer_documents').insert({
    disruption_id: disruptionId,
    leg_id: legId,
    document_type: documentType,
    storage_path: storagePath,
    original_filename: file.name,
    uploaded_by: uploadedBy,
  });
  if (insertError) return { success: false, message: insertError.message };
  return { success: true, message: 'Transfer document uploaded.' };
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
export async function syncLaneRiskToSupabase(laneId: string, riskScore: number, riskLevel: RiskLevel, gdpStatus?: GdpStatus): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const updates: Record<string, unknown> = { risk_score: riskScore, risk_level: riskLevel };
  if (gdpStatus) updates.gdp_status = gdpStatus;
  const { error } = await client.from('transport_lanes').update(updates).eq('id', laneId);
  if (error) {
    console.warn('transport_lanes risk sync notice:', error.message);
    return false;
  }
  return true;
}
