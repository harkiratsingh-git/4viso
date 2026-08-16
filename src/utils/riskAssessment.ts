import { RegionalThermalHotspot, RiskLevel, TransportMode } from '../types';
import { REGIONAL_THERMAL_HOTSPOTS } from '../data/temperatureRiskData';
import { haversineKm } from './geoMath';

// Hubs with no known thermal hotspot exposure in REGIONAL_THERMAL_HOTSPOTS, used as
// suggested low-risk alternatives when a route leg is flagged.
const KNOWN_LOW_RISK_HUBS = ['FRA', 'AMS', 'ZRH', 'BRU', 'NRT', 'DUB', 'BSL'];

const HOTSPOT_INFLUENCE_RADIUS_KM = 700;

export interface RouteLegPoint {
  label: string; // 'Origin' | 'Stop 1' | ... | 'Destination'
  iata: string;
  coords: [number, number];
}

export interface RouteLegAssessment extends RouteLegPoint {
  nearbyHotspot?: RegionalThermalHotspot;
  distanceKm?: number;
  riskScore: number; // 0-100 contribution from this leg
  flags: string[];
}

export interface RouteAssessmentResult {
  overallScore: number; // 0-100
  overallLevel: RiskLevel;
  verdict: 'Recommended' | 'Review Recommended' | 'High Risk - Reroute Advised';
  legs: RouteLegAssessment[];
  recommendations: string[];
  suggestedHubs: string[];
}

function assessLeg(point: RouteLegPoint, tempMin: number, tempMax: number): RouteLegAssessment {
  let nearest: RegionalThermalHotspot | undefined;
  let nearestDist = Infinity;
  for (const h of REGIONAL_THERMAL_HOTSPOTS) {
    const d = haversineKm(point.coords, h.coords);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = h;
    }
  }

  const flags: string[] = [];
  let riskScore = 5; // baseline handling risk for any waypoint

  const isColdSensitive = tempMax <= 25;
  const isDeepFreezeOrCryo = tempMin <= -15;
  const withinInfluence = !!nearest && nearestDist <= HOTSPOT_INFLUENCE_RADIUS_KM;

  if (nearest && withinInfluence) {
    const proximityFactor = 1 - nearestDist / HOTSPOT_INFLUENCE_RADIUS_KM; // 0..1, closer = higher
    if (nearest.thermalRiskLevel === 'Extreme Heat' && isColdSensitive) {
      riskScore += 35 * proximityFactor;
      flags.push(
        `${Math.round(nearestDist)}km from ${nearest.name} (${nearest.ambientTempC}°C ambient, ${nearest.tarmacExposureRiskMins}min max tarmac exposure) — high excursion risk for a ${tempMin}°C to ${tempMax}°C payload.`
      );
    } else if (nearest.thermalRiskLevel === 'High Heat' && isColdSensitive) {
      riskScore += 18 * proximityFactor;
      flags.push(`${Math.round(nearestDist)}km from ${nearest.name} (${nearest.ambientTempC}°C ambient) — elevated ramp dwell risk.`);
    } else if (nearest.thermalRiskLevel === 'Sub-Zero Freeze' && !isDeepFreezeOrCryo) {
      riskScore += 15 * proximityFactor;
      flags.push(`${Math.round(nearestDist)}km from ${nearest.name} — risk of over-cooling a non-frozen payload.`);
    }
  }

  return {
    ...point,
    nearbyHotspot: withinInfluence ? nearest : undefined,
    distanceKm: nearest ? Math.round(nearestDist) : undefined,
    riskScore: Math.round(Math.min(100, riskScore)),
    flags,
  };
}

export function assessRoute(params: {
  origin: RouteLegPoint;
  destination: RouteLegPoint;
  stops: RouteLegPoint[];
  mode: TransportMode;
  tempMin: number;
  tempMax: number;
}): RouteAssessmentResult {
  const legs: RouteLegAssessment[] = [
    assessLeg({ ...params.origin, label: 'Origin' }, params.tempMin, params.tempMax),
    ...params.stops.map((s, i) => assessLeg({ ...s, label: `Stop ${i + 1}` }, params.tempMin, params.tempMax)),
    assessLeg({ ...params.destination, label: 'Destination' }, params.tempMin, params.tempMax),
  ];

  const modeBaseline = params.mode === 'Air' ? 8 : params.mode === 'Sea' ? 16 : params.mode === 'Road' ? 10 : 12;
  const stopHandlingRisk = params.stops.length * 4;
  const avgLegRisk = legs.reduce((sum, l) => sum + l.riskScore, 0) / legs.length;

  const overallScore = Math.round(Math.min(100, modeBaseline + stopHandlingRisk + avgLegRisk));
  const overallLevel: RiskLevel = overallScore >= 55 ? 'Critical' : overallScore >= 35 ? 'High' : overallScore >= 18 ? 'Medium' : 'Low';
  const verdict = overallScore >= 55 ? 'High Risk - Reroute Advised' : overallScore >= 30 ? 'Review Recommended' : 'Recommended';

  const recommendations: string[] = [];
  const flaggedIatas = new Set<string>();
  legs.forEach((l) => {
    l.flags.forEach((f) => recommendations.push(`${l.label} (${l.iata}): ${f}`));
    if (l.flags.length > 0) flaggedIatas.add(l.iata);
  });

  if (params.stops.length >= 3) {
    recommendations.push(
      `${params.stops.length} intermediate stops add cumulative handling and dwell-time exposure — consolidating to fewer, higher-reliability hubs would lower composite risk.`
    );
  }

  const suggestedHubs = KNOWN_LOW_RISK_HUBS.filter(
    (h) => h !== params.origin.iata && h !== params.destination.iata && !flaggedIatas.has(h)
  ).slice(0, 4);

  if (recommendations.length === 0) {
    recommendations.push('No known thermal hotspot conflicts detected along this route. Standard cold-chain SOPs apply.');
  } else if (suggestedHubs.length > 0) {
    recommendations.push(`Consider routing flagged stops via a lower-risk hub instead, e.g. ${suggestedHubs.join(', ')}.`);
  }

  return { overallScore, overallLevel, verdict, legs, recommendations, suggestedHubs };
}
