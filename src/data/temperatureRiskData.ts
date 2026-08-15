import { RegionalThermalHotspot } from '../types';

export const REGIONAL_THERMAL_HOTSPOTS: RegionalThermalHotspot[] = [
  {
    id: 'hotspot-dxb',
    name: 'Dubai World Central & DXB Hub',
    region: 'Middle East (Persian Gulf Corridor)',
    coords: [25.2532, 55.3657],
    ambientTempC: 45.8,
    rampSurfaceTempC: 59.4,
    humidityPercent: 48,
    solarRadiationUv: 11.5,
    thermalRiskLevel: 'Extreme Heat',
    riskScore: 92,
    activeLanesCount: 3,
    affectedLaneCodes: ['BRU-SIN-01', 'DXB-JNB-03', 'FRA-SIN-02'],
    coldStorageFacilityRating: 'IATA CEIV Pharma Certified (Pharma Cargo Cool Dolls Active)',
    tarmacExposureRiskMins: 8,
    recommendation: 'Mandatory thermal blanket cover (TSS VIP-Shield) & refrigerated high-loader dollies on tarmac.'
  },
  {
    id: 'hotspot-sin',
    name: 'Singapore Changi Air Cargo Complex',
    region: 'Southeast Asia Tropical Zone',
    coords: [1.3644, 103.9915],
    ambientTempC: 33.6,
    rampSurfaceTempC: 46.2,
    humidityPercent: 89,
    solarRadiationUv: 9.8,
    thermalRiskLevel: 'High Heat',
    riskScore: 74,
    activeLanesCount: 4,
    affectedLaneCodes: ['BRU-SIN-01', 'FRA-SIN-02', 'BOM-SIN-06'],
    coldStorageFacilityRating: 'SATS Coolport + dnata CoolChain Centre',
    tarmacExposureRiskMins: 18,
    recommendation: 'High-humidity condensation prevention active; utilize sealed moisture-barrier secondary packaging.'
  },
  {
    id: 'hotspot-redsea',
    name: 'Red Sea & Bab-el-Mandeb Maritime Pass',
    region: 'Equatorial Shipping Route',
    coords: [14.0, 42.5],
    ambientTempC: 42.1,
    rampSurfaceTempC: 54.0,
    humidityPercent: 78,
    solarRadiationUv: 11.0,
    thermalRiskLevel: 'Extreme Heat',
    riskScore: 88,
    activeLanesCount: 2,
    affectedLaneCodes: ['RTM-SHA-03'],
    coldStorageFacilityRating: 'Ocean Reefer GenSet Dual Telemetry',
    tarmacExposureRiskMins: 12,
    recommendation: 'Monitor redundant diesel generator fuel levels and daily reefer compressor duty-cycle telemetry.'
  },
  {
    id: 'hotspot-mia',
    name: 'Miami International Airport (MIA) Cargo Center',
    region: 'North America / Caribbean Subtropical Front',
    coords: [25.7959, -80.2870],
    ambientTempC: 35.2,
    rampSurfaceTempC: 49.8,
    humidityPercent: 82,
    solarRadiationUv: 10.2,
    thermalRiskLevel: 'High Heat',
    riskScore: 78,
    activeLanesCount: 3,
    affectedLaneCodes: ['MIA-GRU-05', 'JFK-MIA-08'],
    coldStorageFacilityRating: 'IATA CEIV Certified Cargo Hub',
    tarmacExposureRiskMins: 15,
    recommendation: 'Tropical convective cloudburst alert; verify waterproof thermal over-pack shields.'
  },
  {
    id: 'hotspot-bom',
    name: 'Mumbai Chhatrapati Shivaji Cargo Terminal',
    region: 'South Asia Monsoon Corridor',
    coords: [19.0896, 72.8656],
    ambientTempC: 37.4,
    rampSurfaceTempC: 51.0,
    humidityPercent: 85,
    solarRadiationUv: 10.5,
    thermalRiskLevel: 'High Heat',
    riskScore: 82,
    activeLanesCount: 2,
    affectedLaneCodes: ['BOM-SIN-06', 'BOM-FRA-09'],
    coldStorageFacilityRating: 'CEIV Pharma Dedicated Cold Zone (Air India / Adani)',
    tarmacExposureRiskMins: 14,
    recommendation: 'Heavy rainfall tarmac delay protocol active; enforce maximum 12-minute staging threshold.'
  },
  {
    id: 'hotspot-gru',
    name: 'São Paulo Guarulhos (GRU) Airport',
    region: 'South America Equatorial Transit',
    coords: [-23.4356, -46.4731],
    ambientTempC: 31.8,
    rampSurfaceTempC: 43.5,
    humidityPercent: 72,
    solarRadiationUv: 8.9,
    thermalRiskLevel: 'Moderate',
    riskScore: 54,
    activeLanesCount: 2,
    affectedLaneCodes: ['MIA-GRU-05'],
    coldStorageFacilityRating: 'GRU Airport Pharma Hub 15-25°C & 2-8°C Active',
    tarmacExposureRiskMins: 25,
    recommendation: 'Customs clearance pre-validation reduces warehouse staging time from 4.2h to 45 mins.'
  },
  {
    id: 'hotspot-fra',
    name: 'Frankfurt Airport CargoCity South (FRA)',
    region: 'Western Europe Continental',
    coords: [50.0379, 8.5622],
    ambientTempC: 24.5,
    rampSurfaceTempC: 31.0,
    humidityPercent: 55,
    solarRadiationUv: 5.8,
    thermalRiskLevel: 'Optimal Controlled',
    riskScore: 22,
    activeLanesCount: 5,
    affectedLaneCodes: ['FRA-JFK-04', 'BRU-SIN-01', 'FRA-SIN-02'],
    coldStorageFacilityRating: 'Lufthansa Cargo Cool Center (World-Class GDP Master Facility)',
    tarmacExposureRiskMins: 45,
    recommendation: 'Optimal ambient window. Automated thermal tracking active with <0.1°C variance.'
  },
  {
    id: 'hotspot-icn',
    name: 'Seoul Incheon Cargo Hub (ICN)',
    region: 'East Asia Pacific Corridor',
    coords: [37.4602, 126.4407],
    ambientTempC: 29.2,
    rampSurfaceTempC: 38.0,
    humidityPercent: 68,
    solarRadiationUv: 7.4,
    thermalRiskLevel: 'Moderate',
    riskScore: 42,
    activeLanesCount: 3,
    affectedLaneCodes: ['ICN-LAX-07', 'SHA-ICN-02'],
    coldStorageFacilityRating: 'Korean Air & Asiana CEIV Pharma Centers',
    tarmacExposureRiskMins: 30,
    recommendation: 'Standard GDP handling; tarmac cool-dollies deployed for biologic payloads.'
  },
  {
    id: 'hotspot-anc',
    name: 'Anchorage Ted Stevens Transit Hub (ANC)',
    region: 'Northern Sub-Zero Polar Transit Corridor',
    coords: [61.1743, -149.9963],
    ambientTempC: -7.5,
    rampSurfaceTempC: -9.0,
    humidityPercent: 60,
    solarRadiationUv: 2.1,
    thermalRiskLevel: 'Sub-Zero Freeze',
    riskScore: 76,
    activeLanesCount: 2,
    affectedLaneCodes: ['NRT-ANC-JFK-01', 'ICN-ANC-ORD-04'],
    coldStorageFacilityRating: 'Heated Apron Transition Warehousing',
    tarmacExposureRiskMins: 10,
    recommendation: 'Risk of freezing excursion (<+2°C) for liquid mRNA/biologics. Active heating cargo blankets deployed.'
  },
  {
    id: 'hotspot-ord',
    name: "Chicago O'Hare International (ORD)",
    region: 'North America Midwest',
    coords: [41.9742, -87.9073],
    ambientTempC: 26.8,
    rampSurfaceTempC: 35.5,
    humidityPercent: 62,
    solarRadiationUv: 6.9,
    thermalRiskLevel: 'Moderate',
    riskScore: 35,
    activeLanesCount: 3,
    affectedLaneCodes: ['FRA-JFK-04', 'ORD-LHR-02'],
    coldStorageFacilityRating: 'Swissport Pharma Center & Worldwide Flight Services GDP',
    tarmacExposureRiskMins: 35,
    recommendation: 'Standard transit protocol; pre-conditioned reefer trucks on standby for intermodal transfer.'
  }
];

// Helper to determine thermal risk category color
export function getThermalRiskColor(level: RegionalThermalHotspot['thermalRiskLevel']): {
  fill: string;
  stroke: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
} {
  switch (level) {
    case 'Extreme Heat':
      return {
        fill: '#ef4444',
        stroke: '#f87171',
        glow: 'rgba(239, 68, 68, 0.4)',
        badgeBg: 'bg-rose-500/20 border-rose-500/30',
        badgeText: 'text-rose-300'
      };
    case 'High Heat':
      return {
        fill: '#f97316',
        stroke: '#fb923c',
        glow: 'rgba(249, 115, 22, 0.35)',
        badgeBg: 'bg-orange-500/20 border-orange-500/30',
        badgeText: 'text-orange-300'
      };
    case 'Moderate':
      return {
        fill: '#eab308',
        stroke: '#fde047',
        glow: 'rgba(234, 179, 8, 0.3)',
        badgeBg: 'bg-amber-500/20 border-amber-500/30',
        badgeText: 'text-amber-300'
      };
    case 'Sub-Zero Freeze':
      return {
        fill: '#818cf8',
        stroke: '#a5b4fc',
        glow: 'rgba(129, 140, 248, 0.4)',
        badgeBg: 'bg-indigo-500/20 border-indigo-500/30',
        badgeText: 'text-indigo-300'
      };
    case 'Optimal Controlled':
    default:
      return {
        fill: '#10b981',
        stroke: '#34d399',
        glow: 'rgba(16, 185, 129, 0.3)',
        badgeBg: 'bg-emerald-500/20 border-emerald-500/30',
        badgeText: 'text-emerald-300'
      };
  }
}
