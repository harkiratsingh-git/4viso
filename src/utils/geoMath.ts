// Shared great-circle math. Every "is this stop on the way" decision in the app should go
// through crossTrackDistanceKm/alongTrackDistanceKm below rather than an ad-hoc distance
// proxy — cross-track distance is the actual perpendicular distance (km) of a candidate
// point from the great-circle line between two other points, which is the correct way to
// answer "does this hub sit near the direct path" rather than just "is it somewhat close to
// both ends" (a nearby-but-backwards hub can look deceptively close using the latter).

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Initial compass bearing (0-360°) from a to b along the great circle. */
export function initialBearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Perpendicular ("cross-track") distance in km of `point` from the great-circle path start->end. */
export function crossTrackDistanceKm(point: [number, number], pathStart: [number, number], pathEnd: [number, number]): number {
  const d13 = haversineKm(pathStart, point) / EARTH_RADIUS_KM;
  const theta13 = toRad(initialBearingDeg(pathStart, point));
  const theta12 = toRad(initialBearingDeg(pathStart, pathEnd));
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_RADIUS_KM);
}

/** Distance in km along the great circle from pathStart to the point closest to `point`. Can be negative (behind pathStart) or exceed the start->end distance (beyond pathEnd). */
export function alongTrackDistanceKm(point: [number, number], pathStart: [number, number], pathEnd: [number, number]): number {
  const d13 = haversineKm(pathStart, point) / EARTH_RADIUS_KM;
  const dXt = crossTrackDistanceKm(point, pathStart, pathEnd) / EARTH_RADIUS_KM;
  const cosAt = Math.cos(d13) / Math.cos(dXt);
  const dAt = Math.acos(Math.min(1, Math.max(-1, cosAt))) * EARTH_RADIUS_KM;
  const theta13 = toRad(initialBearingDeg(pathStart, point));
  const theta12 = toRad(initialBearingDeg(pathStart, pathEnd));
  // If the point is roughly behind the start relative to the path direction, along-track is negative.
  const angleDiff = Math.abs(((toDeg(theta13 - theta12) + 540) % 360) - 180);
  return angleDiff > 90 ? -dAt : dAt;
}

/** True if `point` sits within `corridorKm` of the great-circle path AND between its two ends (with a little slack at the ends so near-endpoint hubs still count). */
export function isOnGreatCirclePath(
  point: [number, number],
  pathStart: [number, number],
  pathEnd: [number, number],
  corridorKm: number,
  endSlackKm = 300
): boolean {
  const totalKm = haversineKm(pathStart, pathEnd);
  const crossTrack = crossTrackDistanceKm(point, pathStart, pathEnd);
  const alongTrack = alongTrackDistanceKm(point, pathStart, pathEnd);
  return crossTrack <= corridorKm && alongTrack >= -endSlackKm && alongTrack <= totalKm + endSlackKm;
}
