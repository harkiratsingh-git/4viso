export type TransportMode = 'Air' | 'Sea' | 'Road' | 'Multimodal';

export type LaneStatus = 'In Transit' | 'Delayed' | 'Temperature Alert' | 'Customs Hold' | 'Critical' | 'Delivered' | 'Active';

export type GdpStatus = 'Compliant' | 'Warning' | 'Non-Compliant';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type TemperatureRangeType = '2°C to 8°C (Cold Chain)' | '-20°C (Deep Freeze)' | '-80°C (Cryogenic)' | '15°C to 25°C (Controlled Room Temp)';

export interface RouteStop {
  id: string;
  sequence: number; // 1-based order between origin and destination
  city: string;
  iata: string;
  country: string;
  coords: [number, number]; // [lat, lng]
  stopType: 'Transit Hub' | 'Customs Clearance' | 'Carrier Handover' | 'Cold Storage Layover';
  plannedDwellHours: number;
  riskNote?: string;
}

export interface RiskFactor {
  id: string;
  category: 'Temperature Stability' | 'Transit Delay' | 'Handling Quality' | 'Regulatory & GDP' | 'Carrier Reliability' | 'Weather & Environment';
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  score: number; // 0 to 100
  likelihood: 'Low' | 'Moderate' | 'High';
  impact: 'Minor' | 'Moderate' | 'Major' | 'Severe';
  mitigationStrategy: string;
  recommendedAction: string;
}

export interface TemperatureReading {
  timestamp: string;
  coreTemp: number; // Payload core temp
  ambientTemp: number; // Cargo hold/ambient temp
  surfaceTemp: number;
  minPermitted: number;
  maxPermitted: number;
  humidity: number; // %
  batteryLevel: number; // %
  shockG: number; // G-force shock
  isExcursion: boolean;
}

export interface TransportLane {
  id: string;
  laneCode: string; // e.g. BRU-SIN-01
  originCity: string;
  originIata: string;
  originCountry: string;
  originCoords: [number, number]; // [lat, lng]
  destinationCity: string;
  destinationIata: string;
  destinationCountry: string;
  destinationCoords: [number, number]; // [lat, lng]
  stops: RouteStop[]; // intermediate waypoints between origin and destination, in sequence order
  carrier: string;
  carrierLogo?: string;
  mode: TransportMode;
  productName: string;
  productCategory: 'Vaccines' | 'Biologics' | 'Insulin' | 'Cell Therapy' | 'Clinical Trials' | 'Active Ingredients';
  batchNumber: string;
  payloadValueUsd: number;
  tempRangeType: TemperatureRangeType;
  tempMin: number;
  tempMax: number;
  currentTemp: number;
  mktTemp: number; // Mean Kinetic Temperature
  gdpComplianceRate: number; // % e.g. 96.5%
  gdpStatus: GdpStatus;
  riskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  status: LaneStatus;
  transitProgress: number; // 0 to 100%
  departureTime: string;
  eta: string;
  delayHours: number;
  lastUpdated: string;
  temperatureHistory: TemperatureReading[];
  risks: RiskFactor[];
  thresholdAlerts: {
    maxTempExcursionMinutes: number;
    tempWarningTolerance: number; // e.g. ±0.5°C before alert
    maxAllowedDelayHours: number;
    notifyOnShockAboveG: number;
    emailAlerts: boolean;
    smsAlerts: boolean;
  };
  notes: string;
}

export interface AlertNotification {
  id: string;
  laneId: string;
  laneCode: string;
  route: string;
  timestamp: string;
  type: 'TEMPERATURE_EXCURSION' | 'TRANSIT_DELAY' | 'CUSTOMS_HOLD' | 'WEATHER_DISRUPTION' | 'GDP_BREACH' | 'SHOCK_IMPACT';
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  message: string;
  currentValue: string;
  thresholdValue: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  capaRequired: boolean;
  capaId?: string;
}

export interface WeatherDisruption {
  id: string;
  region: string;
  type: 'Severe Storm' | 'Port Congestion' | 'Airspace Closure' | 'Low Visibility' | 'Heatwave Warning';
  severity: 'Critical' | 'Warning' | 'Advisory';
  impactDescription: string;
  delayEstimated: string;
  affectedLaneCodes: string[];
  lastUpdated: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  laneCode: string;
  action: string;
  category: 'TEMPERATURE_MONITORING' | 'LANE_CONFIGURATION' | 'RISK_OVERRIDE' | 'GDP_AUDIT' | 'ALERT_ACKNOWLEDGED' | 'CAPA_LOGGED' | 'SECURITY';
  details: string;
  hash: string;
  status: 'VERIFIED' | 'FLAGGED';
}

export interface FilterState {
  searchQuery: string;
  mode: 'All' | TransportMode;
  riskSeverity: 'All' | RiskLevel;
  gdpStatus: 'All' | GdpStatus;
  tempStatus: 'All' | 'Compliant' | 'Warning' | 'Excursion';
  productCategory: string;
  carrier: string;
  showOnlyAlerts: boolean;
}

export interface UserRole {
  id: 'quality' | 'logistics' | 'auditor' | 'executive';
  title: string;
  department: string;
  name: string;
}

export interface RegionalThermalHotspot {
  id: string;
  name: string;
  region: string;
  coords: [number, number]; // [lat, lng]
  ambientTempC: number;
  rampSurfaceTempC: number;
  humidityPercent: number;
  solarRadiationUv: number;
  thermalRiskLevel: 'Extreme Heat' | 'High Heat' | 'Moderate' | 'Optimal Controlled' | 'Sub-Zero Freeze';
  riskScore: number; // 0-100
  activeLanesCount: number;
  affectedLaneCodes: string[];
  coldStorageFacilityRating: string; // e.g. "IATA CEIV Pharma Certified"
  tarmacExposureRiskMins: number; // Max safe exposure duration before payload breach
  recommendation: string;
}

export interface HeatmapConfig {
  opacity: number; // 0.1 to 1.0
  radiusKm: number;
  colorScheme: 'thermal' | 'gdp_compliance' | 'solar_stress';
  showHotspotBadges: boolean;
  showThermalContours: boolean;
  showLaneArcs: boolean;
  minTempThreshold: number;
  maxTempThreshold: number;
  filterRisk: 'ALL' | 'EXTREME' | 'HIGH' | 'FREEZE';
}

export interface SupabaseSettings {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
}

export interface SupabaseUser {
  id: string;
  email: string;
  name: string;
  role: 'Quality Lead' | 'Logistics Director' | 'GDP Auditor' | 'Supply Chain Analyst';
  organization: string;
  createdAt: string;
  avatarUrl?: string;
  authProvider?: string;
}

export interface CloudSyncState {
  status: 'idle' | 'syncing' | 'synced' | 'partial' | 'offline_cached' | 'error';
  lastSyncedAt: string | null;
  errorMessage: string | null;
  syncedTables: {
    lanes: number;
    alerts: number;
    auditLogs: number;
  };
  tableErrors?: {
    lanes?: string;
    alerts?: string;
    auditLogs?: string;
  };
}

export interface SystemSettings {
  mktActivationEnergy: number; // kJ/mol (default 83.144)
  samplingIntervalSec: number; // seconds
  excursionWarningMinutes: number;
  temperatureUnit: 'C' | 'F';
  alertEmail: string;
  alertSms: string;
  webhookUrl: string;
  twoFactorAuth?: boolean;
  electronicSignaturePin: string;
  requireSignatureOnCapa?: boolean;
  auditLogLevel: 'ALL' | 'CRITICAL_ONLY' | 'EXCURSIONS_ONLY';
  sessionTimeoutMins: number;
  githubRepoUrl?: string;
  githubAutoSync?: boolean;
  lastBackupTimestamp?: string;
}

export interface AuthSession {
  user: SupabaseUser;
  token: string;
  expiresAt: string;
  isAuthenticated: boolean;
}
