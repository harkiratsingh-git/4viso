// Shared default-risk-factor generation, used both when a new lane is provisioned (the wizard)
// and to hydrate a cloud lane that was fetched from Supabase with no risk factors — risks are
// never persisted server-side (see App.tsx's onHydrateRiskFactors), so a cloud lane otherwise
// arrives with an empty risks array and nothing for the Risk Assessment modal to show.
import { RiskFactor, TransportMode } from '../types';
import { assessRoute } from './riskAssessment';

export interface RiskFactorGenerationInput {
  originIata: string;
  originCoords: [number, number];
  destinationIata: string;
  destinationCoords: [number, number];
  stops: { iata: string; coords: [number, number]; city?: string }[];
  mode: TransportMode;
  tempMin: number;
  tempMax: number;
  carrierName: string;
}

export function generateDefaultRiskFactors(input: RiskFactorGenerationInput): RiskFactor[] {
  const { originIata, originCoords, destinationIata, destinationCoords, stops, mode, tempMin, tempMax, carrierName } = input;

  const assessment = assessRoute({
    origin: { iata: originIata, coords: originCoords, label: 'Origin' },
    destination: { iata: destinationIata, coords: destinationCoords, label: 'Destination' },
    stops: stops.map((s) => ({ iata: s.iata, coords: s.coords, label: s.city || s.iata })),
    mode,
    tempMin,
    tempMax,
  });

  const now = Date.now();

  return [
    {
      id: `r-${now}-1`,
      category: 'Handling Quality',
      title: `${originIata} to ${destinationIata} Intermodal Ramp Handover`,
      description: 'Tarmac loading and transfer between cold warehouse and aircraft main deck.',
      severity: 'Low',
      score: 12,
      likelihood: 'Low',
      impact: 'Minor',
      mitigationStrategy: 'Pre-book temperature-controlled pharma dollies with GHA.',
      recommendedAction: 'Verify thermal cover wrap on arrival.',
      status: 'Open',
    },
    {
      id: `r-${now}-2`,
      category: 'Carrier Reliability',
      title: `${carrierName} Cold-Chain SOP Compliance`,
      description: 'Carrier SLA and thermal container maintenance validation.',
      severity: 'Low',
      score: 8,
      likelihood: 'Low',
      impact: 'Minor',
      mitigationStrategy: 'IoT telemetry probe linked to carrier tracking API.',
      recommendedAction: 'Continuous automated polling enabled.',
      status: 'Open',
    },
    ...assessment.legs
      .filter((l) => l.flags.length > 0)
      .map((l, i) => ({
        id: `r-${now}-hotspot-${i}`,
        category: 'Weather & Environment' as const,
        title: `${l.label} (${l.iata}) Thermal Corridor Exposure`,
        description: l.flags.join(' '),
        severity: (l.riskScore >= 30 ? 'High' : 'Medium') as RiskFactor['severity'],
        score: l.riskScore,
        likelihood: 'Moderate' as const,
        impact: 'Major' as const,
        mitigationStrategy: l.label.startsWith('Stop')
          ? assessment.suggestedHubs.length
            ? `Consider rerouting via ${assessment.suggestedHubs.join(', ')} instead.`
            : 'Deploy thermal cover wrap and minimize tarmac dwell time at this stop.'
          : 'Fixed origin/destination point — cannot be rerouted. Apply additional ground-handling mitigation (pre-conditioned ULDs/containers, expedited tarmac transfer, CEIV Pharma-certified facility handling) instead.',
        recommendedAction: 'Reassess this leg before dispatch; monitor telemetry closely on arrival.',
        status: 'Open' as const,
      })),
  ];
}
