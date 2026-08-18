export type TransportMode = 'Air' | 'Sea' | 'Road' | 'Multimodal';

export type LaneStatus = 'In Transit' | 'Delayed' | 'Temperature Alert' | 'Customs Hold' | 'Critical' | 'Delivered' | 'Active';

export type GdpStatus = 'Compliant' | 'Warning' | 'Non-Compliant';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type TemperatureRangeType = '2°C to 8°C (Cold Chain)' | '-20°C (Deep Freeze)' | '-80°C (Cryogenic)' | '15°C to 25°C (Controlled Room Temp)';

export type AdvisorySeverity = 'Informational' | 'Advisory' | 'Elevated Risk' | 'Avoid';

export interface CorridorAdvisory {
  id: string;
  corridorName: string;
  affectedWaypoints: string[];
  severity: AdvisorySeverity;
  summary: string;
  recommendedAlternative: string;
  asOf: string;
  sourceNote: string;
}

export type CarrierType = 'Ocean Line' | 'Air Cargo/Integrator' | 'Freight Forwarder/3PL' | 'Regional Specialist';

export interface Carrier {
  id: string;
  name: string;
  carrierType: CarrierType;
  /** Raw mode strings from the DB — includes values like 'Rail' that fall outside this app's TransportMode union, so kept as string[] rather than forcing a mismatch. */
  modes: string[];
  headquartersCountry: string;
  primaryRegions: string[];
  ceivPharmaPartner: boolean;
  ownsDedicatedNetwork: boolean;
  reliabilityScore: number;
  coldChainSpecialist: boolean;
  notes: string;
}

export interface CarrierRecommendation {
  carrier: Carrier;
  score: number;
  reasons: string[];
}

/** From the carrier_performance_summary view — only ever returns a row once a carrier has at
 * least 5 logged shipments (see carrier_performance_logs), specifically so the app never shows
 * a fabricated-precision rate from a tiny sample. Absence of a row means "no data yet," not 0%. */
export interface CarrierPerformanceSummary {
  carrierId: string;
  shipmentCount: number;
  onTimePct: number;
  excursionRatePct: number;
  claimRatePct: number;
}

export interface LaneLeg {
  id: string;
  laneId: string;
  legSequence: number;
  originPortCode: string;
  destinationPortCode: string;
  mode: 'Air' | 'Sea' | 'Road' | 'Rail';
  carrierId: string | null;
  isRecommendedCarrier: boolean;
  stopType: 'Transit Hub' | 'Customs Clearance' | 'Cold Storage Layover' | 'Carrier Handover' | 'Origin' | 'Destination' | null;
  hoursOnGround: number;
  distanceKm: number | null;
  estTransitHours: number | null;
  customsDelayHours: number | null;
  legRiskScore: number | null;
}

/** From the lane_carrier_summary view — the single-badge-vs-per-leg-breakdown decision point. */
export interface LaneCarrierSummary {
  laneId: string;
  legCount: number;
  distinctCarrierCount: number;
  distinctModeCount: number;
  unifiedCarrierId: string | null;
  unifiedMode: string | null;
}

export interface LaneRouteOption {
  id: string;
  laneId: string | null;
  optionType: 'user_edited' | 'recommended' | 'recommended_from_edit';
  legsSnapshot: unknown;
  totalDistanceKm: number | null;
  totalTransitHours: number | null;
  totalCustomsDelayHours: number | null;
  totalRiskScore: number | null;
  wasChosen: boolean;
}

/** From carrier_certification_status — SECURITY INVOKER-safe view combining a carrier with
 * whichever of its uploaded certifications currently satisfies it, if any. */
export interface CarrierCertificationStatus {
  carrierId: string;
  name: string;
  requiresCertificationUpload: boolean;
  certificationStatus: 'Not Required' | 'Verified' | 'Pending Review' | 'Missing';
}

export interface CarrierCertification {
  id: string;
  carrierId: string;
  documentType: 'GDP Certificate' | 'CEIV Pharma' | 'ISO 9001' | 'WHO Prequalification' | 'Cold Chain Accreditation' | 'Other';
  storagePath: string;
  originalFilename: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  status: 'Pending Review' | 'Verified' | 'Rejected' | 'Expired';
  expiryDate: string | null;
  /** When a Quality Lead/GDP Auditor actually verified this document — distinct from uploadedAt,
   *  since "verified on" is the trustworthy date to surface (uploadedAt only proves someone
   *  submitted it, not that it was checked). Null until reviewed. */
  reviewedAt: string | null;
}

// ---------------------------------------------------------------------------
// Phase 4: emergency mid-transit disruption handling
// ---------------------------------------------------------------------------

export interface LaneDisruption {
  id: string;
  laneId: string;
  legId: string;
  disruptionType: 'Carrier Incapacitated' | 'Missing Documentation' | 'Customs Detention' | 'Other';
  description: string;
  reportedAt: string;
  reportedBy: string | null;
  status: 'Reported' | 'Resolved - Carrier Replaced' | 'Resolved - Contract Extended' | 'Resolved - Other';
  resolutionCarrierId: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  capaId: string | null;
}

export interface TransferDocument {
  id: string;
  disruptionId: string;
  legId: string;
  documentType: 'Customs Clearance' | 'Legal Transfer Authorization' | 'Carrier Handover' | 'Other';
  storagePath: string;
  originalFilename: string;
  uploadedBy: string | null;
  uploadedAt: string;
  notes: string | null;
}

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
  /** FK into carriers.id — optional since older rows/local demo data may not have one. */
  carrierId?: string;
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
  type: 'TEMPERATURE_EXCURSION' | 'TRANSIT_DELAY' | 'CUSTOMS_HOLD' | 'WEATHER_DISRUPTION' | 'GDP_BREACH' | 'SHOCK_IMPACT' | 'CARRIER_DISRUPTION';
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
  type: 'Severe Storm' | 'Port Congestion' | 'Airspace Closure' | 'Low Visibility' | 'Heatwave Warning' | 'Corridor Advisory';
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
