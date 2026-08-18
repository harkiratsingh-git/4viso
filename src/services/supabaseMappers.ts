// Tolerant mappers between this app's TypeScript types and the actual rows living in the
// connected Supabase project. The live database was seeded independently of this app (its
// column values use a different, looser vocabulary than the app's strict UI enums — e.g.
// gdp_status "At Risk" instead of 'Warning', product_category "Vaccine" instead of 'Vaccines',
// alert severity "High"/"Medium" instead of 'Critical'/'Warning'). These mappers normalize
// on read and never throw on an unrecognized value — they fall back to the closest safe
// default so a surprising row can never crash the dashboard.
import {
  TransportLane,
  AlertNotification,
  AuditLogEntry,
  TemperatureReading,
  RouteStop,
  GdpStatus,
  RiskLevel,
  TemperatureRangeType,
  CorridorAdvisory,
  AdvisorySeverity,
  Carrier,
  CarrierPerformanceSummary,
  LaneLeg,
  LaneCarrierSummary,
  LaneRouteOption,
  CarrierCertificationStatus,
  CarrierCertification,
  LaneDisruption,
  TransferDocument,
} from '../types';
import { formatUtcCompact } from '../utils/dateFormat';

function s(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function n(val: unknown, fallback = 0): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeTimestamp(raw: unknown): string {
  const str = s(raw);
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return formatUtcCompact(d);
}

function normalizeTempRangeType(raw: unknown, min: number, max: number): TemperatureRangeType {
  const v = s(raw).toLowerCase();
  if (v.includes('cryo') || min <= -70) return '-80°C (Cryogenic)';
  if (v.includes('frozen') || v.includes('deep freeze') || (min <= -10 && min > -70)) return '-20°C (Deep Freeze)';
  if (v.includes('room') || v.includes('crt') || v.includes('controlled') || min >= 14) return '15°C to 25°C (Controlled Room Temp)';
  return '2°C to 8°C (Cold Chain)';
}

function normalizeGdpStatus(raw: unknown, rate: number): GdpStatus {
  const v = s(raw).toLowerCase();
  if (v.includes('non')) return 'Non-Compliant';
  if (v.includes('risk') || v.includes('warning')) return 'Warning';
  if (v.includes('compliant')) return 'Compliant';
  if (rate < 80) return 'Non-Compliant';
  if (rate < 92) return 'Warning';
  return 'Compliant';
}

function normalizeRiskLevel(raw: unknown, score: number): RiskLevel {
  const v = s(raw);
  if (v === 'Low' || v === 'Medium' || v === 'High' || v === 'Critical') return v;
  if (score >= 50) return 'Critical';
  if (score >= 35) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
}

function normalizeProductCategory(raw: unknown): TransportLane['productCategory'] {
  const v = s(raw).toLowerCase();
  if (v.includes('vaccine')) return 'Vaccines';
  if (v.includes('insulin')) return 'Insulin';
  if (v.includes('cell') || v.includes('car-t') || v.includes('gene')) return 'Cell Therapy';
  if (v.includes('clinical')) return 'Clinical Trials';
  if (v.includes('active') || v.includes('api') || v.includes('ingredient')) return 'Active Ingredients';
  return 'Biologics'; // covers "Biologic", "Monoclonal Antibody", etc.
}

function normalizeMode(raw: unknown): TransportLane['mode'] {
  const v = s(raw).toLowerCase();
  if (v.includes('sea')) return 'Sea';
  if (v.includes('road')) return 'Road';
  if (v.includes('multi')) return 'Multimodal';
  return 'Air';
}

function normalizeLaneStatus(raw: unknown): TransportLane['status'] {
  const v = s(raw).toLowerCase();
  if (v.includes('temperature') || v.includes('excursion')) return 'Temperature Alert';
  if (v.includes('customs')) return 'Customs Hold';
  if (v.includes('delayed') || v.includes('delay')) return 'Delayed';
  if (v.includes('critical')) return 'Critical';
  if (v.includes('delivered')) return 'Delivered';
  if (v.includes('active')) return 'Active';
  return 'In Transit';
}

function normalizeAlertSeverity(raw: unknown): AlertNotification['severity'] {
  const v = s(raw).toLowerCase();
  if (v.includes('critical') || v === 'high') return 'Critical';
  if (v.includes('warning') || v === 'medium' || v === 'low') return 'Warning';
  return 'Info';
}

function normalizeAlertType(raw: unknown): AlertNotification['type'] {
  const v = s(raw).toLowerCase();
  if (v.includes('temperature')) return 'TEMPERATURE_EXCURSION';
  if (v.includes('delay')) return 'TRANSIT_DELAY';
  if (v.includes('customs')) return 'CUSTOMS_HOLD';
  if (v.includes('weather')) return 'WEATHER_DISRUPTION';
  if (v.includes('gdp')) return 'GDP_BREACH';
  if (v.includes('shock')) return 'SHOCK_IMPACT';
  if (v.includes('carrier')) return 'CARRIER_DISRUPTION';
  return 'TEMPERATURE_EXCURSION';
}

function normalizeAuditCategory(raw: unknown): AuditLogEntry['category'] {
  const v = s(raw).toLowerCase();
  if (v.includes('temperature')) return 'TEMPERATURE_MONITORING';
  if (v.includes('risk')) return 'RISK_OVERRIDE';
  if (v.includes('gdp')) return 'GDP_AUDIT';
  if (v.includes('acknowledg')) return 'ALERT_ACKNOWLEDGED';
  if (v.includes('capa') || v.includes('corrective')) return 'CAPA_LOGGED';
  if (v.includes('security') || v.includes('auth')) return 'SECURITY';
  return 'LANE_CONFIGURATION'; // covers "Shipment Tracking", lane provisioning, etc.
}

function normalizeAuditStatus(raw: unknown): AuditLogEntry['status'] {
  return s(raw).toUpperCase() === 'FLAGGED' ? 'FLAGGED' : 'VERIFIED';
}

// ---------------------------------------------------------------------------
// Transport lanes
// ---------------------------------------------------------------------------

export function mapRowToLane(row: any, telemetryHistory: TemperatureReading[] = []): TransportLane {
  const tempMin = n(row.temp_min, 2);
  const tempMax = n(row.temp_max, 8);
  const riskScore = n(row.risk_score, 10);
  const gdpRate = n(row.gdp_compliance_rate, 95);
  const currentTemp = n(row.current_temp, (tempMin + tempMax) / 2);

  let stops: RouteStop[] = [];
  if (Array.isArray(row.stops)) {
    stops = row.stops.map((raw: any, i: number) => ({
      id: s(raw.id) || `stop-${row.id}-${i}`,
      sequence: n(raw.sequence, i + 1),
      city: s(raw.city),
      iata: s(raw.iata).toUpperCase(),
      country: s(raw.country),
      coords: [n(raw.coords?.[0]), n(raw.coords?.[1])] as [number, number],
      stopType: (['Transit Hub', 'Customs Clearance', 'Carrier Handover', 'Cold Storage Layover'].includes(raw.stopType)
        ? raw.stopType
        : 'Transit Hub') as RouteStop['stopType'],
      plannedDwellHours: n(raw.plannedDwellHours, 2),
      riskNote: raw.riskNote ? s(raw.riskNote) : undefined,
    }));
  }

  return {
    id: s(row.id),
    laneCode: s(row.lane_code) || s(row.id),
    originCity: s(row.origin_city),
    originIata: s(row.origin_iata).toUpperCase(),
    originCountry: s(row.origin_country),
    originCoords: [n(row.origin_lat), n(row.origin_lng)],
    destinationCity: s(row.destination_city),
    destinationIata: s(row.destination_iata).toUpperCase(),
    destinationCountry: s(row.destination_country),
    destinationCoords: [n(row.destination_lat), n(row.destination_lng)],
    stops,
    carrier: s(row.carrier) || 'Unassigned Carrier',
    carrierId: row.carrier_id ? s(row.carrier_id) : undefined,
    mode: normalizeMode(row.mode),
    productName: s(row.product_name) || 'Unspecified Payload',
    productCategory: normalizeProductCategory(row.product_category),
    batchNumber: s(row.batch_number) || 'N/A',
    payloadValueUsd: n(row.payload_value_usd),
    tempRangeType: normalizeTempRangeType(row.temp_range_type, tempMin, tempMax),
    tempMin,
    tempMax,
    currentTemp,
    mktTemp: n(row.mkt_temp, currentTemp),
    gdpComplianceRate: gdpRate,
    gdpStatus: normalizeGdpStatus(row.gdp_status, gdpRate),
    riskScore,
    riskLevel: normalizeRiskLevel(row.risk_level, riskScore),
    status: normalizeLaneStatus(row.status),
    transitProgress: n(row.transit_progress),
    departureTime: normalizeTimestamp(row.departure_time) || s(row.departure_time),
    eta: normalizeTimestamp(row.eta) || s(row.eta),
    delayHours: n(row.delay_hours),
    lastUpdated: normalizeTimestamp(row.last_updated) || 'Synced from Supabase',
    temperatureHistory: telemetryHistory,
    risks: [],
    thresholdAlerts: {
      maxTempExcursionMinutes: 15,
      tempWarningTolerance: 0.5,
      maxAllowedDelayHours: 3,
      notifyOnShockAboveG: 2.0,
      emailAlerts: true,
      smsAlerts: true,
    },
    notes: `Loaded from Supabase cloud database (${s(row.id)}).`,
  };
}

export function mapLaneToRow(lane: TransportLane, timestamp: string) {
  return {
    id: lane.id,
    lane_code: lane.laneCode,
    origin_city: lane.originCity,
    origin_iata: lane.originIata,
    origin_country: lane.originCountry,
    origin_lat: lane.originCoords[0],
    origin_lng: lane.originCoords[1],
    destination_city: lane.destinationCity,
    destination_iata: lane.destinationIata,
    destination_country: lane.destinationCountry,
    destination_lat: lane.destinationCoords[0],
    destination_lng: lane.destinationCoords[1],
    stops: lane.stops,
    carrier: lane.carrier,
    carrier_id: lane.carrierId ?? null,
    mode: lane.mode,
    product_name: lane.productName,
    product_category: lane.productCategory,
    batch_number: lane.batchNumber,
    payload_value_usd: lane.payloadValueUsd,
    temp_range_type: lane.tempRangeType,
    temp_min: lane.tempMin,
    temp_max: lane.tempMax,
    current_temp: lane.currentTemp,
    mkt_temp: lane.mktTemp,
    gdp_compliance_rate: lane.gdpComplianceRate,
    gdp_status: lane.gdpStatus,
    risk_score: lane.riskScore,
    risk_level: lane.riskLevel,
    status: lane.status,
    transit_progress: lane.transitProgress,
    departure_time: lane.departureTime,
    eta: lane.eta,
    delay_hours: lane.delayHours,
    last_updated: timestamp,
  };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export function mapRowToAlert(row: any): AlertNotification {
  return {
    id: s(row.id),
    laneId: s(row.lane_id),
    laneCode: s(row.lane_code),
    route: s(row.route),
    timestamp: normalizeTimestamp(row.timestamp) || s(row.timestamp),
    type: normalizeAlertType(row.alert_type),
    severity: normalizeAlertSeverity(row.severity),
    title: s(row.title) || 'Alert',
    message: s(row.message),
    currentValue: s(row.current_value),
    thresholdValue: s(row.threshold_value),
    isAcknowledged: Boolean(row.is_acknowledged),
    acknowledgedBy: row.acknowledged_by ? s(row.acknowledged_by) : undefined,
    acknowledgedAt: row.acknowledged_at ? (normalizeTimestamp(row.acknowledged_at) || s(row.acknowledged_at)) : undefined,
    capaRequired: Boolean(row.capa_required),
    capaId: row.capa_id ? s(row.capa_id) : undefined,
  };
}

export function mapAlertToRow(alert: AlertNotification) {
  return {
    id: alert.id,
    lane_id: alert.laneId,
    lane_code: alert.laneCode,
    route: alert.route,
    timestamp: alert.timestamp,
    alert_type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    current_value: alert.currentValue,
    threshold_value: alert.thresholdValue,
    is_acknowledged: alert.isAcknowledged,
    acknowledged_by: alert.acknowledgedBy || null,
    acknowledged_at: alert.acknowledgedAt || null,
    capa_required: alert.capaRequired,
    capa_id: alert.capaId || null,
  };
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export function mapRowToAuditLog(row: any): AuditLogEntry {
  return {
    id: s(row.id),
    timestamp: normalizeTimestamp(row.timestamp) || s(row.timestamp),
    actor: s(row.actor) || 'Unknown',
    role: s(row.role) || 'System',
    laneCode: s(row.lane_code) || 'SYSTEM',
    action: s(row.action) || 'Recorded Event',
    category: normalizeAuditCategory(row.category),
    details: s(row.details),
    hash: s(row.hash) || '0x0',
    status: normalizeAuditStatus(row.status),
  };
}

export function mapAuditLogToRow(log: AuditLogEntry) {
  return {
    id: log.id,
    timestamp: log.timestamp,
    actor: log.actor,
    role: log.role,
    lane_code: log.laneCode,
    action: log.action,
    category: log.category,
    details: log.details,
    hash: log.hash,
    status: log.status,
  };
}

// ---------------------------------------------------------------------------
// Temperature telemetry (read-only: seeds temperatureHistory on load)
// ---------------------------------------------------------------------------

export function mapRowToTemperatureReading(row: any): TemperatureReading {
  const coreTemp = n(row.core_temp);
  return {
    timestamp: (() => {
      const str = s(row.timestamp);
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    })(),
    coreTemp,
    ambientTemp: n(row.ambient_temp, coreTemp),
    surfaceTemp: n(row.surface_temp, coreTemp),
    minPermitted: n(row.min_permitted),
    maxPermitted: n(row.max_permitted),
    humidity: n(row.humidity, 45),
    batteryLevel: n(row.battery_level, 90),
    shockG: n(row.shock_g, 0.1),
    isExcursion: Boolean(row.is_excursion),
  };
}

// ---------------------------------------------------------------------------
// Corridor advisories & carriers (route/carrier recommendation engine)
// ---------------------------------------------------------------------------

function normalizeAdvisorySeverity(val: unknown): AdvisorySeverity {
  const raw = s(val);
  if (raw === 'Elevated Risk' || raw === 'Avoid' || raw === 'Advisory' || raw === 'Informational') return raw;
  return 'Informational';
}

export function mapRowToCorridorAdvisory(row: any): CorridorAdvisory {
  return {
    id: s(row.id),
    corridorName: s(row.corridor_name),
    affectedWaypoints: Array.isArray(row.affected_waypoints) ? row.affected_waypoints.map(s) : [],
    severity: normalizeAdvisorySeverity(row.severity),
    summary: s(row.summary),
    recommendedAlternative: s(row.recommended_alternative),
    asOf: s(row.as_of),
    sourceNote: s(row.source_note),
  };
}

export function mapRowToCarrier(row: any): Carrier {
  return {
    id: s(row.id),
    name: s(row.name),
    carrierType: s(row.carrier_type) as Carrier['carrierType'],
    modes: Array.isArray(row.modes) ? row.modes.map(s) : [],
    headquartersCountry: s(row.headquarters_country),
    primaryRegions: Array.isArray(row.primary_regions) ? row.primary_regions.map(s) : [],
    ceivPharmaPartner: Boolean(row.ceiv_pharma_partner),
    ownsDedicatedNetwork: Boolean(row.owns_dedicated_network),
    reliabilityScore: n(row.reliability_score),
    coldChainSpecialist: Boolean(row.cold_chain_specialist),
    notes: s(row.notes),
  };
}

export function mapRowToLaneLeg(row: any): LaneLeg {
  return {
    id: s(row.id),
    laneId: s(row.lane_id),
    legSequence: n(row.leg_sequence),
    originPortCode: s(row.origin_port_code).toUpperCase(),
    destinationPortCode: s(row.destination_port_code).toUpperCase(),
    mode: s(row.mode) as LaneLeg['mode'],
    carrierId: row.carrier_id ? s(row.carrier_id) : null,
    isRecommendedCarrier: Boolean(row.is_recommended_carrier),
    stopType: row.stop_type ? (s(row.stop_type) as LaneLeg['stopType']) : null,
    hoursOnGround: n(row.hours_on_ground),
    distanceKm: row.distance_km != null ? n(row.distance_km) : null,
    estTransitHours: row.est_transit_hours != null ? n(row.est_transit_hours) : null,
    customsDelayHours: row.customs_delay_hours != null ? n(row.customs_delay_hours) : null,
    legRiskScore: row.leg_risk_score != null ? n(row.leg_risk_score) : null,
  };
}

export function mapLaneLegToRow(leg: Omit<LaneLeg, 'id'> & { id?: string }) {
  return {
    ...(leg.id ? { id: leg.id } : {}),
    lane_id: leg.laneId,
    leg_sequence: leg.legSequence,
    origin_port_code: leg.originPortCode,
    destination_port_code: leg.destinationPortCode,
    mode: leg.mode,
    carrier_id: leg.carrierId,
    is_recommended_carrier: leg.isRecommendedCarrier,
    stop_type: leg.stopType,
    hours_on_ground: leg.hoursOnGround,
    distance_km: leg.distanceKm,
    est_transit_hours: leg.estTransitHours,
    customs_delay_hours: leg.customsDelayHours,
    leg_risk_score: leg.legRiskScore,
  };
}

export function mapRowToLaneCarrierSummary(row: any): LaneCarrierSummary {
  return {
    laneId: s(row.lane_id),
    legCount: n(row.leg_count),
    distinctCarrierCount: n(row.distinct_carrier_count),
    distinctModeCount: n(row.distinct_mode_count),
    unifiedCarrierId: row.unified_carrier_id ? s(row.unified_carrier_id) : null,
    unifiedMode: row.unified_mode ? s(row.unified_mode) : null,
  };
}

export function mapRowToLaneRouteOption(row: any): LaneRouteOption {
  return {
    id: s(row.id),
    laneId: row.lane_id ? s(row.lane_id) : null,
    optionType: s(row.option_type) as LaneRouteOption['optionType'],
    legsSnapshot: row.legs_snapshot,
    totalDistanceKm: row.total_distance_km != null ? n(row.total_distance_km) : null,
    totalTransitHours: row.total_transit_hours != null ? n(row.total_transit_hours) : null,
    totalCustomsDelayHours: row.total_customs_delay_hours != null ? n(row.total_customs_delay_hours) : null,
    totalRiskScore: row.total_risk_score != null ? n(row.total_risk_score) : null,
    wasChosen: Boolean(row.was_chosen),
  };
}

export function mapLaneRouteOptionToRow(opt: Omit<LaneRouteOption, 'id' | 'laneId'>, laneId: string | null, createdBy: string | null) {
  return {
    lane_id: laneId,
    option_type: opt.optionType,
    legs_snapshot: opt.legsSnapshot,
    total_distance_km: opt.totalDistanceKm,
    total_transit_hours: opt.totalTransitHours,
    total_customs_delay_hours: opt.totalCustomsDelayHours,
    total_risk_score: opt.totalRiskScore,
    was_chosen: opt.wasChosen,
    created_by: createdBy,
  };
}

export function mapRowToCarrierCertificationStatus(row: any): CarrierCertificationStatus {
  return {
    carrierId: s(row.carrier_id),
    name: s(row.name),
    requiresCertificationUpload: Boolean(row.requires_certification_upload),
    certificationStatus: s(row.certification_status) as CarrierCertificationStatus['certificationStatus'],
  };
}

export function mapRowToCarrierCertification(row: any, uploaderName: string | null): CarrierCertification {
  return {
    id: s(row.id),
    carrierId: s(row.carrier_id),
    documentType: s(row.document_type) as CarrierCertification['documentType'],
    storagePath: s(row.storage_path),
    originalFilename: s(row.original_filename),
    uploadedBy: row.uploaded_by ? s(row.uploaded_by) : null,
    uploadedByName: uploaderName,
    uploadedAt: s(row.uploaded_at),
    status: s(row.status) as CarrierCertification['status'],
    expiryDate: row.expiry_date ? s(row.expiry_date) : null,
    reviewedAt: row.reviewed_at ? s(row.reviewed_at) : null,
  };
}

export function mapRowToLaneDisruption(row: any): LaneDisruption {
  return {
    id: s(row.id),
    laneId: s(row.lane_id),
    legId: s(row.leg_id),
    disruptionType: s(row.disruption_type) as LaneDisruption['disruptionType'],
    description: s(row.description),
    reportedAt: s(row.reported_at),
    reportedBy: row.reported_by ? s(row.reported_by) : null,
    status: s(row.status) as LaneDisruption['status'],
    resolutionCarrierId: row.resolution_carrier_id ? s(row.resolution_carrier_id) : null,
    resolutionNotes: row.resolution_notes ? s(row.resolution_notes) : null,
    resolvedAt: row.resolved_at ? s(row.resolved_at) : null,
    resolvedBy: row.resolved_by ? s(row.resolved_by) : null,
    capaId: row.capa_id ? s(row.capa_id) : null,
  };
}

export function mapRowToTransferDocument(row: any): TransferDocument {
  return {
    id: s(row.id),
    disruptionId: s(row.disruption_id),
    legId: s(row.leg_id),
    documentType: s(row.document_type) as TransferDocument['documentType'],
    storagePath: s(row.storage_path),
    originalFilename: s(row.original_filename),
    uploadedBy: row.uploaded_by ? s(row.uploaded_by) : null,
    uploadedAt: s(row.uploaded_at),
    notes: row.notes ? s(row.notes) : null,
  };
}

export function mapRowToCarrierPerformanceSummary(row: any): CarrierPerformanceSummary {
  return {
    carrierId: s(row.carrier_id),
    shipmentCount: n(row.shipment_count),
    onTimePct: n(row.on_time_pct),
    excursionRatePct: n(row.excursion_rate_pct),
    claimRatePct: n(row.claim_rate_pct),
  };
}
