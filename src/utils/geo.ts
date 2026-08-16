// Approximate coordinates for major pharmaceutical & cargo air hubs, keyed by IATA code.
// Used to place newly provisioned lanes on the network maps without a live geocoding API.
const IATA_COORDS: Record<string, [number, number]> = {
  BRU: [50.9010, 4.4856],
  SIN: [1.3644, 103.9915],
  FRA: [50.0379, 8.5622],
  JFK: [40.6413, -73.7781],
  RTM: [51.9244, 4.4777],
  SHA: [31.2304, 121.4737],
  PVG: [31.1443, 121.8083],
  BOM: [19.0896, 72.8656],
  DXB: [25.2532, 55.3657],
  BSL: [47.5896, 7.5299],
  BOS: [42.3656, -71.0096],
  NRT: [35.7720, 140.3929],
  DUB: [53.4264, -6.2499],
  ORD: [41.9742, -87.9073],
  AMS: [52.3105, 4.7683],
  HKG: [22.3080, 113.9185],
  HYD: [17.2403, 78.4294],
  LHR: [51.4700, -0.4543],
  ZRH: [47.4582, 8.5555],
  CDG: [49.0097, 2.5479],
  MUC: [48.3538, 11.7861],
  MXP: [45.6301, 8.7255],
  MAD: [40.4936, -3.5668],
  LUX: [49.6233, 6.2044],
  MEM: [35.0424, -89.9767],
  ANR: [51.1894, 4.4603],
  ICN: [37.4602, 126.4407],
  PEK: [40.0801, 116.5846],
  NBO: [-1.3192, 36.9278],
  JNB: [-26.1392, 28.2460],
  LOS: [6.5774, 3.3212],
  CPT: [-33.9715, 18.6021],
  GRU: [-23.4356, -46.4731],
  MEX: [19.4363, -99.0721],
  YYZ: [43.6777, -79.6248],
  LAX: [33.9416, -118.4085],
  ATL: [33.6407, -84.4277],
  MIA: [25.7959, -80.2870],
  DEL: [28.5562, 77.1000],
  SYD: [-33.9399, 151.1753],
};

/** Simple deterministic hash spread used only when an IATA code isn't in the known-hub table. */
function fallbackCoordsFromCode(code: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  const lat = (hash % 10000) / 10000 * 130 - 55; // -55 to 75
  const lng = ((hash >>> 8) % 10000) / 10000 * 360 - 180; // -180 to 180
  return [Number(lat.toFixed(4)), Number(lng.toFixed(4))];
}

export function getAirportCoords(iataCode: string): [number, number] {
  const code = iataCode.trim().toUpperCase();
  return IATA_COORDS[code] || fallbackCoordsFromCode(code);
}
