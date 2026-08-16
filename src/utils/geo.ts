// Directory of major pharmaceutical & cargo hubs (airports and sea ports), used to:
//  - power the origin/destination/stop autocomplete suggestions in the lane wizard
//  - place lanes on the network maps without a live geocoding API
export interface AirportEntry {
  iata: string;
  city: string;
  country: string;
  coords: [number, number]; // [lat, lng]
  name: string;
}

export const AIRPORT_DIRECTORY: AirportEntry[] = [
  { iata: 'BRU', city: 'Brussels', country: 'Belgium', coords: [50.9010, 4.4856], name: 'Brussels Airport' },
  { iata: 'SIN', city: 'Singapore', country: 'Singapore', coords: [1.3644, 103.9915], name: 'Singapore Changi Airport' },
  { iata: 'FRA', city: 'Frankfurt', country: 'Germany', coords: [50.0379, 8.5622], name: 'Frankfurt Airport' },
  { iata: 'JFK', city: 'New York', country: 'United States', coords: [40.6413, -73.7781], name: 'John F. Kennedy International Airport' },
  { iata: 'RTM', city: 'Rotterdam', country: 'Netherlands', coords: [51.9244, 4.4777], name: 'Rotterdam – The Hague Airport / Port of Rotterdam' },
  { iata: 'SHA', city: 'Shanghai', country: 'China', coords: [31.2304, 121.4737], name: 'Shanghai Hongqiao Airport' },
  { iata: 'PVG', city: 'Shanghai', country: 'China', coords: [31.1443, 121.8083], name: 'Shanghai Pudong Airport' },
  { iata: 'BOM', city: 'Mumbai', country: 'India', coords: [19.0896, 72.8656], name: 'Chhatrapati Shivaji Maharaj Airport' },
  { iata: 'DXB', city: 'Dubai', country: 'United Arab Emirates', coords: [25.2532, 55.3657], name: 'Dubai International Airport' },
  { iata: 'BSL', city: 'Basel', country: 'Switzerland', coords: [47.5896, 7.5299], name: 'EuroAirport Basel-Mulhouse-Freiburg' },
  { iata: 'BOS', city: 'Boston', country: 'United States', coords: [42.3656, -71.0096], name: 'Boston Logan International Airport' },
  { iata: 'NRT', city: 'Tokyo', country: 'Japan', coords: [35.7720, 140.3929], name: 'Narita International Airport' },
  { iata: 'DUB', city: 'Dublin', country: 'Ireland', coords: [53.4264, -6.2499], name: 'Dublin Airport' },
  { iata: 'ORD', city: 'Chicago', country: 'United States', coords: [41.9742, -87.9073], name: "O'Hare International Airport" },
  { iata: 'AMS', city: 'Amsterdam', country: 'Netherlands', coords: [52.3105, 4.7683], name: 'Amsterdam Schiphol Airport' },
  { iata: 'HKG', city: 'Hong Kong', country: 'Hong Kong', coords: [22.3080, 113.9185], name: 'Hong Kong International Airport' },
  { iata: 'HYD', city: 'Hyderabad', country: 'India', coords: [17.2403, 78.4294], name: 'Rajiv Gandhi International Airport' },
  { iata: 'LHR', city: 'London', country: 'United Kingdom', coords: [51.4700, -0.4543], name: 'London Heathrow Airport' },
  { iata: 'ZRH', city: 'Zurich', country: 'Switzerland', coords: [47.4582, 8.5555], name: 'Zurich Airport' },
  { iata: 'CDG', city: 'Paris', country: 'France', coords: [49.0097, 2.5479], name: 'Charles de Gaulle Airport' },
  { iata: 'MUC', city: 'Munich', country: 'Germany', coords: [48.3538, 11.7861], name: 'Munich Airport' },
  { iata: 'MXP', city: 'Milan', country: 'Italy', coords: [45.6301, 8.7255], name: 'Milan Malpensa Airport' },
  { iata: 'MAD', city: 'Madrid', country: 'Spain', coords: [40.4936, -3.5668], name: 'Adolfo Suárez Madrid–Barajas Airport' },
  { iata: 'LUX', city: 'Luxembourg', country: 'Luxembourg', coords: [49.6233, 6.2044], name: 'Luxembourg Findel Airport' },
  { iata: 'MEM', city: 'Memphis', country: 'United States', coords: [35.0424, -89.9767], name: 'Memphis International Airport' },
  { iata: 'ANR', city: 'Antwerp', country: 'Belgium', coords: [51.1894, 4.4603], name: 'Antwerp Airport / Port of Antwerp' },
  { iata: 'ICN', city: 'Seoul', country: 'South Korea', coords: [37.4602, 126.4407], name: 'Incheon International Airport' },
  { iata: 'PEK', city: 'Beijing', country: 'China', coords: [40.0801, 116.5846], name: 'Beijing Capital International Airport' },
  { iata: 'NBO', city: 'Nairobi', country: 'Kenya', coords: [-1.3192, 36.9278], name: 'Jomo Kenyatta International Airport' },
  { iata: 'JNB', city: 'Johannesburg', country: 'South Africa', coords: [-26.1392, 28.2460], name: 'O.R. Tambo International Airport' },
  { iata: 'LOS', city: 'Lagos', country: 'Nigeria', coords: [6.5774, 3.3212], name: 'Murtala Muhammed International Airport' },
  { iata: 'CPT', city: 'Cape Town', country: 'South Africa', coords: [-33.9715, 18.6021], name: 'Cape Town International Airport' },
  { iata: 'GRU', city: 'São Paulo', country: 'Brazil', coords: [-23.4356, -46.4731], name: 'São Paulo–Guarulhos International Airport' },
  { iata: 'MEX', city: 'Mexico City', country: 'Mexico', coords: [19.4363, -99.0721], name: 'Mexico City International Airport' },
  { iata: 'YYZ', city: 'Toronto', country: 'Canada', coords: [43.6777, -79.6248], name: 'Toronto Pearson International Airport' },
  { iata: 'LAX', city: 'Los Angeles', country: 'United States', coords: [33.9416, -118.4085], name: 'Los Angeles International Airport' },
  { iata: 'ATL', city: 'Atlanta', country: 'United States', coords: [33.6407, -84.4277], name: 'Hartsfield–Jackson Atlanta International Airport' },
  { iata: 'MIA', city: 'Miami', country: 'United States', coords: [25.7959, -80.2870], name: 'Miami International Airport' },
  { iata: 'DEL', city: 'New Delhi', country: 'India', coords: [28.5562, 77.1000], name: 'Indira Gandhi International Airport' },
  { iata: 'SYD', city: 'Sydney', country: 'Australia', coords: [-33.9399, 151.1753], name: 'Sydney Kingsford Smith Airport' },
  { iata: 'VIE', city: 'Vienna', country: 'Austria', coords: [48.1103, 16.5697], name: 'Vienna International Airport' },
  { iata: 'CPH', city: 'Copenhagen', country: 'Denmark', coords: [55.6180, 12.6560], name: 'Copenhagen Airport' },
  { iata: 'ARN', city: 'Stockholm', country: 'Sweden', coords: [59.6519, 17.9186], name: 'Stockholm Arlanda Airport' },
  { iata: 'IST', city: 'Istanbul', country: 'Turkey', coords: [41.2753, 28.7519], name: 'Istanbul Airport' },
  { iata: 'DOH', city: 'Doha', country: 'Qatar', coords: [25.2731, 51.6081], name: 'Hamad International Airport' },
  { iata: 'AUH', city: 'Abu Dhabi', country: 'United Arab Emirates', coords: [24.4330, 54.6511], name: 'Zayed International Airport' },
  { iata: 'BKK', city: 'Bangkok', country: 'Thailand', coords: [13.6900, 100.7501], name: 'Suvarnabhumi Airport' },
  { iata: 'KUL', city: 'Kuala Lumpur', country: 'Malaysia', coords: [2.7456, 101.7099], name: 'Kuala Lumpur International Airport' },
  { iata: 'CGK', city: 'Jakarta', country: 'Indonesia', coords: [-6.1256, 106.6559], name: 'Soekarno–Hatta International Airport' },
  { iata: 'MNL', city: 'Manila', country: 'Philippines', coords: [14.5086, 121.0198], name: 'Ninoy Aquino International Airport' },
  { iata: 'CAI', city: 'Cairo', country: 'Egypt', coords: [30.1219, 31.4056], name: 'Cairo International Airport' },
  { iata: 'CAN', city: 'Guangzhou', country: 'China', coords: [23.3924, 113.2988], name: 'Guangzhou Baiyun International Airport' },
  { iata: 'SEA', city: 'Seattle', country: 'United States', coords: [47.4502, -122.3088], name: 'Seattle–Tacoma International Airport' },
  { iata: 'YVR', city: 'Vancouver', country: 'Canada', coords: [49.1967, -123.1815], name: 'Vancouver International Airport' },
  { iata: 'PTY', city: 'Panama City', country: 'Panama', coords: [9.0714, -79.3835], name: 'Tocumen International Airport (Panama Canal gateway)' },
  { iata: 'PLZ', city: 'Gqeberha', country: 'South Africa', coords: [-33.9850, 25.6173], name: 'Gqeberha (Port Elizabeth) Airport' },
  { iata: 'COL', city: 'Colombo', country: 'Sri Lanka', coords: [6.9271, 79.8612], name: 'Port of Colombo' },
];

const BY_IATA: Record<string, AirportEntry> = Object.fromEntries(
  AIRPORT_DIRECTORY.map((a) => [a.iata, a])
);

/** Simple deterministic hash spread used only when an IATA code isn't in the known-hub directory. */
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
  return BY_IATA[code]?.coords || fallbackCoordsFromCode(code);
}

export function findAirport(iataCode: string): AirportEntry | undefined {
  return BY_IATA[iataCode.trim().toUpperCase()];
}

/** Ranked, deduped suggestions for an autocomplete: matches on IATA code, city, or country. */
export function searchAirports(query: string, limit = 8): AirportEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = AIRPORT_DIRECTORY
    .map((a) => {
      const iata = a.iata.toLowerCase();
      const city = a.city.toLowerCase();
      const country = a.country.toLowerCase();
      let score = -1;
      if (iata === q) score = 100;
      else if (iata.startsWith(q)) score = 90;
      else if (city.startsWith(q)) score = 80;
      else if (country.startsWith(q)) score = 60;
      else if (city.includes(q)) score = 40;
      else if (country.includes(q)) score = 30;
      else if (a.name.toLowerCase().includes(q)) score = 20;
      return { a, score };
    })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => s.a);

  return scored;
}
