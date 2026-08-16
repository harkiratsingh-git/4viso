// Supabase now returns real timestamptz values (ISO 8601 with offset) for departure_time,
// eta, and every *timestamp column — format them with Intl.DateTimeFormat instead of ad-hoc
// string slicing, which only ever happened to work because the old mock data used a
// lookalike "YYYY-MM-DD HH:MM:SS UTC" string and breaks the moment the real format differs.

function parseDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** "Aug 15, 2026, 04:30 UTC" */
export function formatTimestamp(value: string | Date): string {
  const d = parseDate(value);
  if (!d) return typeof value === 'string' ? value : '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  }).format(d);
}

/** "04:30:00" (UTC, 24h) */
export function formatTime(value: string | Date): string {
  const d = parseDate(value);
  if (!d) return typeof value === 'string' ? value : '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'UTC',
  }).format(d);
}

/** "YYYY-MM-DD HH:MM:SS UTC" — used where the app still generates its own audit/log timestamps. */
export function formatUtcCompact(value: string | Date): string {
  const d = parseDate(value);
  if (!d) return typeof value === 'string' ? value : '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/** "YYYY-MM-DD HH:MM UTC" (no seconds) — for shorter display contexts like ETAs. */
export function formatUtcCompactNoSeconds(value: string | Date): string {
  const d = parseDate(value);
  if (!d) return typeof value === 'string' ? value : '—';
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** "3m ago" / "just now" / "2h ago" — for live-data freshness display. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return '—';
  const seconds = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
