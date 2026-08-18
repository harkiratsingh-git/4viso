import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plane,
  Ship,
  Truck,
  Layers,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { TransportLane, TransportMode, TemperatureRangeType, RiskFactor, RouteStop, Carrier, CorridorAdvisory, AuditLogEntry, CarrierPerformanceSummary, CarrierCertificationStatus } from '../types';
import { getAirportCoords } from '../utils/geo';
import { assessRoute } from '../utils/riskAssessment';
import { recommendTransportMode } from '../utils/ports';
import { stopSetsDiffer } from '../utils/routeComparison';
import { getRiskColor } from '../utils/formatters';
import { formatUtcCompactNoSeconds } from '../utils/dateFormat';
import {
  fetchCarriers,
  fetchCorridorAdvisories,
  fetchCarrierPerformanceSummary,
  fetchCarrierCertificationStatuses,
  insertLaneToSupabase,
  replaceLaneLegs,
  insertLaneRouteOption,
  getActiveUser,
} from '../services/supabaseService';
import { findRelevantAdvisories, RelevantAdvisory, STALENESS_WARNING_PREFIX, requiresAcknowledgment } from '../utils/corridorAdvisories';
import { AirportAutocomplete, AirportValue } from './AirportAutocomplete';
import { RouteStopsEditor, DraftStop } from './RouteStopsEditor';
import { usePorts } from '../contexts/PortsContext';
import { OverrideAcknowledgmentModal, PendingOverride } from './OverrideAcknowledgmentModal';
import { ThreeWayRouteComparison, ComputedRouteOption, RouteOptionType } from './ThreeWayRouteComparison';
import { LegCarrierBreakdown } from './LegCarrierBreakdown';
import { SimpleRouteRecommendation } from './SimpleRouteRecommendation';
import { LegMode, legsAreUnified } from '../utils/legRecommendation';
import { useViewMode } from '../contexts/ViewModeContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NewLaneWizardModalProps {
  onClose: () => void;
  onCreateLane: (newLane: TransportLane) => void;
  onViewLane: (lane: TransportLane) => void;
  onLogAuditEntry: (laneCode: string, action: string, category: AuditLogEntry['category'], details: string) => void;
  /** Only attempt the Supabase writes (transport_lanes/lane_legs/lane_route_options) when
   *  genuinely cloud-connected — matching every other cloud-only read/write in this app. In
   *  local/demo mode there's no real backing session to write against (RLS correctly rejects
   *  it), and it would pollute the shared project with demo data even if it somehow succeeded. */
  dataSource: 'loading' | 'cloud' | 'local';
}

const defaultOrigin = (): AirportValue => ({ city: 'Frankfurt', iata: 'FRA', country: 'Germany', coords: getAirportCoords('FRA') });
const defaultDestination = (): AirportValue => ({ city: 'Singapore', iata: 'SIN', country: 'Singapore', coords: getAirportCoords('SIN') });

export const NewLaneWizardModal: React.FC<NewLaneWizardModalProps> = ({
  onClose,
  onCreateLane,
  onViewLane,
  onLogAuditEntry,
  dataSource,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [createdLane, setCreatedLane] = useState<TransportLane | null>(null);
  const { ports } = usePorts();

  // Carrier recommendation + corridor advisory data, fetched once on mount.
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [advisories, setAdvisories] = useState<CorridorAdvisory[]>([]);
  const [performanceByCarrierId, setPerformanceByCarrierId] = useState<Map<string, CarrierPerformanceSummary>>(new Map());
  const [certStatusByCarrierId, setCertStatusByCarrierId] = useState<Map<string, CarrierCertificationStatus['certificationStatus']>>(new Map());
  useEffect(() => {
    fetchCarriers().then((c) => c && setCarriers(c));
    fetchCorridorAdvisories().then((a) => a && setAdvisories(a));
    fetchCarrierPerformanceSummary().then((rows) => {
      if (rows) setPerformanceByCarrierId(new Map(rows.map((r) => [r.carrierId, r])));
    });
    fetchCarrierCertificationStatuses().then((rows) => {
      if (rows) setCertStatusByCarrierId(new Map(rows.map((r) => [r.carrierId, r.certificationStatus])));
    });
  }, []);
  const currentUser = useMemo(() => getActiveUser(), []);
  const { mode: viewMode } = useViewMode();
  const [advancedRoutingExpanded, setAdvancedRoutingExpanded] = useState(false);
  const showAdvancedRouting = viewMode === 'advanced' || advancedRoutingExpanded;

  // Step 1: Mode
  const [mode, setMode] = useState<TransportMode>('Air');

  // Step 2: Route & Cargo
  const [origin, setOrigin] = useState<AirportValue>(defaultOrigin());
  const [destination, setDestination] = useState<AirportValue>(defaultDestination());
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [productName, setProductName] = useState<string>('Lyophilized Biologics & Vaccines');
  const [productCategory, setProductCategory] = useState<TransportLane['productCategory']>('Vaccines');
  const [payloadValue, setPayloadValue] = useState<number>(3500000);
  const [tempRangeType, setTempRangeType] = useState<TemperatureRangeType>('2°C to 8°C (Cold Chain)');
  const [tempMin, setTempMin] = useState<number>(2.0);
  const [tempMax, setTempMax] = useState<number>(8.0);

  // Step 4: Threshold Alerts
  const [maxExcursionMinutes, setMaxExcursionMinutes] = useState<number>(15);
  const [warningTolerance, setWarningTolerance] = useState<number>(0.5);
  const [maxAllowedDelay, setMaxAllowedDelay] = useState<number>(3);
  const [maxShockG, setMaxShockG] = useState<number>(2.0);
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [smsAlerts, setSmsAlerts] = useState<boolean>(true);

  // Handle Temp Range switch
  const handleRangeTypeChange = (type: TemperatureRangeType) => {
    setTempRangeType(type);
    if (type === '2°C to 8°C (Cold Chain)') {
      setTempMin(2.0);
      setTempMax(8.0);
    } else if (type === '-20°C (Deep Freeze)') {
      setTempMin(-25.0);
      setTempMax(-15.0);
    } else if (type === '-80°C (Cryogenic)') {
      setTempMin(-90.0);
      setTempMax(-70.0);
    } else if (type === '15°C to 25°C (Controlled Room Temp)') {
      setTempMin(15.0);
      setTempMax(25.0);
    }
  };

  // Recommended transport mode for the drafted route + cargo (Step 2)
  const modeRecommendation = useMemo(() => {
    if (!origin.iata.trim() || !destination.iata.trim()) return null;
    return recommendTransportMode(origin.coords, destination.coords, tempMin, tempMax, productCategory, ports);
  }, [origin, destination, tempMin, tempMax, productCategory, ports]);

  // Live risk assessment of the drafted route (Step 3)
  const assessment = useMemo(() => {
    if (!origin.iata.trim() || !destination.iata.trim()) return null;
    return assessRoute({
      origin: { iata: origin.iata.toUpperCase(), coords: origin.coords, label: 'Origin' },
      destination: { iata: destination.iata.toUpperCase(), coords: destination.coords, label: 'Destination' },
      stops: stops
        .filter((s) => s.iata.trim())
        .map((s) => ({ iata: s.iata.toUpperCase(), coords: s.coords, label: s.city || s.iata })),
      mode,
      tempMin,
      tempMax,
    });
  }, [origin, destination, stops, mode, tempMin, tempMax]);

  const userStops = useMemo(
    () => stops.filter((s) => s.iata.trim()).map((s) => ({ iata: s.iata.toUpperCase(), city: s.city, country: s.country, coords: s.coords })),
    [stops]
  );

  // Memoized so ThreeWayRouteComparison's effect (keyed on these by reference) doesn't refire
  // on every unrelated render — origin/destination state itself is already reference-stable
  // across renders, but a fresh {...} literal in JSX is not.
  const originWaypoint = useMemo(
    () => ({ iata: origin.iata.toUpperCase(), city: origin.city, country: origin.country, coords: origin.coords }),
    [origin]
  );
  const destinationWaypoint = useMemo(
    () => ({ iata: destination.iata.toUpperCase(), city: destination.city, country: destination.country, coords: destination.coords }),
    [destination]
  );

  // Phase 2: three-way route comparison (User-edited / Recommended / Recommended-from-your-edit).
  // Simple mode has no UI to edit stops, so its default pick must be 'recommended' (what
  // SimpleRouteRecommendation actually displays) — defaulting to 'user_edited' here would let
  // the lane get created from a plain direct route that silently differs from what was shown.
  const [selectedRouteOption, setSelectedRouteOption] = useState<RouteOptionType>(viewMode === 'simple' ? 'recommended' : 'user_edited');
  const [computedRouteOptions, setComputedRouteOptions] = useState<ComputedRouteOption[] | null>(null);

  const selectRouteOption = (type: RouteOptionType) => {
    setSelectedRouteOption(type);
    const opt = computedRouteOptions?.find((o) => o.type === type);
    if (!opt) return;
    const intermediate = opt.waypoints.slice(1, -1);
    setStops(
      intermediate.map((w, i) => ({
        id: `stop-${Date.now()}-${i}-${w.iata}`,
        city: w.city,
        iata: w.iata,
        country: w.country,
        coords: w.coords,
        stopType: 'Transit Hub',
        plannedDwellHours: 2,
      }))
    );
    if (opt.mode !== mode) setMode(opt.mode);
  };

  // Phase 1: per-leg carrier/mode assignment, keyed by 1-based leg sequence — falls back to
  // that leg's top recommendation until the user overrides it.
  const [legCarrierOverrides, setLegCarrierOverrides] = useState<Record<number, string>>({});
  const [legModeOverrides, setLegModeOverrides] = useState<Record<number, LegMode>>({});

  const activeLegs = useMemo(
    () => computedRouteOptions?.find((o) => o.type === selectedRouteOption)?.legs ?? [],
    [computedRouteOptions, selectedRouteOption]
  );

  // Computed directly (not driven by whether LegCarrierBreakdown happens to be mounted) so the
  // gate still applies in Simple mode even while "Advanced routing options" is collapsed — a
  // carrier missing its required certification must block lane creation either way.
  const anyLegCertBlocked = useMemo(
    () =>
      activeLegs.some((leg) => {
        const carrierId = legCarrierOverrides[leg.legSequence] ?? leg.topCarrierPick?.carrier.id ?? null;
        return !!carrierId && certStatusByCarrierId.get(carrierId) === 'Missing';
      }),
    [activeLegs, legCarrierOverrides, certStatusByCarrierId]
  );

  const resolvedLegCarrierName = (legSequence: number, topPickId: string | null) => {
    const id = legCarrierOverrides[legSequence] ?? topPickId;
    return carriers.find((c) => c.id === id)?.name ?? 'Unassigned Carrier';
  };

  // Corridor advisories relevant to the drafted route (Sea mode only — see corridorAdvisories.ts).
  const relevantAdvisories: RelevantAdvisory[] = useMemo(() => {
    if (!origin.iata.trim() || !destination.iata.trim()) return [];
    return findRelevantAdvisories(advisories, origin.coords, destination.coords, mode);
  }, [advisories, origin, destination, mode]);
  const severeAdvisories = relevantAdvisories.filter((r) => requiresAcknowledgment(r.advisory.severity));

  // Every recommendation set aside — route, carrier, or corridor advisory — collected into one
  // acknowledgment gate at creation time rather than nagging on every intermediate change.
  const pendingOverrides: PendingOverride[] = useMemo(() => {
    const overrides: PendingOverride[] = [];
    const recommendedOption = computedRouteOptions?.find((o) => o.type === 'recommended');
    if (recommendedOption && selectedRouteOption !== 'recommended') {
      const recommendedIatas = recommendedOption.waypoints.map((w) => w.iata);
      const selectedIatas = [origin.iata.toUpperCase(), ...userStops.map((s) => s.iata), destination.iata.toUpperCase()];
      if (stopSetsDiffer(recommendedIatas.map((iata) => ({ iata })), selectedIatas.map((iata) => ({ iata })))) {
        overrides.push({
          what: 'route recommendation',
          recommended: `Recommended route via ${recommendedIatas.join(', ')}`,
          chosen: `${selectedRouteOption === 'user_edited' ? 'Your route' : 'Recommended-from-your-edit route'} via ${selectedIatas.join(', ')}`,
        });
      }
    }
    for (const leg of activeLegs) {
      const chosenId = legCarrierOverrides[leg.legSequence] ?? leg.topCarrierPick?.carrier.id ?? null;
      if (leg.topCarrierPick && chosenId !== leg.topCarrierPick.carrier.id) {
        overrides.push({
          what: `carrier recommendation for leg ${leg.legSequence} (${leg.origin.iata}→${leg.destination.iata})`,
          recommended: `${leg.topCarrierPick.carrier.name} (score ${leg.topCarrierPick.score}/100)`,
          chosen: resolvedLegCarrierName(leg.legSequence, leg.topCarrierPick.carrier.id),
        });
      }
    }
    if (severeAdvisories.length > 0) {
      const a = severeAdvisories[0].advisory;
      overrides.push({
        what: `${a.corridorName} corridor advisory (${a.severity})`,
        recommended: a.recommendedAlternative,
        chosen: `${mode} routing through the flagged corridor`,
      });
    }
    return overrides;
  }, [computedRouteOptions, selectedRouteOption, origin, destination, userStops, activeLegs, legCarrierOverrides, severeAdvisories, mode]);

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  const confirmOverridesAndFinish = (reason: string) => {
    const laneCodePreview = `${origin.iata.toUpperCase()}-${destination.iata.toUpperCase()}`;
    for (const o of pendingOverrides) {
      onLogAuditEntry(
        laneCodePreview,
        `Recommendation Overridden: ${o.what}`,
        'RISK_OVERRIDE',
        `Proceeded with "${o.chosen}" instead of the recommended "${o.recommended}".${reason ? ` Reason given: ${reason}` : ' No reason given.'}`
      );
    }
    setIsOverrideModalOpen(false);
    handleFinish();
  };

  const handleCreateLaneClick = () => {
    if (anyLegCertBlocked) return;
    if (pendingOverrides.length > 0) {
      setIsOverrideModalOpen(true);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    const laneCode = `${origin.iata.toUpperCase()}-${destination.iata.toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;
    const initTemp = Number(((tempMin + tempMax) / 2 + 0.2).toFixed(1));

    // Per-leg carrier/mode resolution: the user's override where one exists, else that leg's
    // top recommendation. Unified (single carrier + single mode across every leg) collapses to
    // one lane-level carrier; otherwise the lane is recorded as multi-carrier.
    const resolvedLegs = activeLegs.map((l) => ({
      legSequence: l.legSequence,
      originPortCode: l.origin.iata,
      destinationPortCode: l.destination.iata,
      mode: legModeOverrides[l.legSequence] ?? l.mode,
      carrierId: legCarrierOverrides[l.legSequence] ?? l.topCarrierPick?.carrier.id ?? null,
      isRecommendedCarrier: !legCarrierOverrides[l.legSequence] && !!l.topCarrierPick,
      stopType: (l.legSequence === activeLegs.length ? 'Destination' : 'Transit Hub') as 'Destination' | 'Transit Hub',
      hoursOnGround: 0,
      distanceKm: null as number | null,
      estTransitHours: null as number | null,
      customsDelayHours: null as number | null,
      legRiskScore: l.riskScore,
    }));
    const unified = legsAreUnified(resolvedLegs.map((l) => ({ mode: l.mode, carrierId: l.carrierId })));
    const unifiedCarrierId = unified ? resolvedLegs[0]?.carrierId ?? null : null;
    const unifiedCarrierObj = unifiedCarrierId ? carriers.find((c) => c.id === unifiedCarrierId) : undefined;
    const resolvedCarrierName = resolvedLegs.length === 0 ? 'Unassigned Carrier' : unified ? unifiedCarrierObj?.name ?? 'Unassigned Carrier' : 'Multiple Carriers';

    // Automated Composite Risk Calculation: prefer the per-leg calculate_lane_base_risk average
    // (the same scoring shown in the Step 1 route comparison) over the local heuristic, blended
    // with the live corridor risk assessment.
    let initialRiskScore = mode === 'Air' ? 14 : mode === 'Sea' ? 24 : mode === 'Road' ? 18 : 20;
    if (tempRangeType.includes('-80') || tempRangeType.includes('-20')) {
      initialRiskScore += 10;
    }
    const legRiskScores = resolvedLegs.map((l) => l.legRiskScore).filter((s): s is number => s != null);
    if (legRiskScores.length > 0) {
      initialRiskScore = Math.round(legRiskScores.reduce((sum, s) => sum + s, 0) / legRiskScores.length);
    }
    if (assessment) {
      initialRiskScore = Math.round((initialRiskScore + assessment.overallScore) / 2);
    }

    const routeStops: RouteStop[] = stops
      .filter((s) => s.iata.trim())
      .map((s, i) => ({
        id: s.id,
        sequence: i + 1,
        city: s.city || s.iata.toUpperCase(),
        iata: s.iata.toUpperCase(),
        country: s.country,
        coords: s.coords,
        stopType: s.stopType,
        plannedDwellHours: s.plannedDwellHours,
      }));

    const defaultRisks: RiskFactor[] = [
      {
        id: `r-${Date.now()}-1`,
        category: 'Handling Quality',
        title: `${origin.iata} to ${destination.iata} Intermodal Ramp Handover`,
        description: 'Tarmac loading and transfer between cold warehouse and aircraft main deck.',
        severity: 'Low',
        score: 12,
        likelihood: 'Low',
        impact: 'Minor',
        mitigationStrategy: 'Pre-book temperature-controlled pharma dollies with GHA.',
        recommendedAction: 'Verify thermal cover wrap on arrival.'
      },
      {
        id: `r-${Date.now()}-2`,
        category: 'Carrier Reliability',
        title: `${resolvedCarrierName} Cold-Chain SOP Compliance`,
        description: 'Carrier SLA and thermal container maintenance validation.',
        severity: 'Low',
        score: 8,
        likelihood: 'Low',
        impact: 'Minor',
        mitigationStrategy: 'IoT telemetry probe linked to carrier tracking API.',
        recommendedAction: 'Continuous automated polling enabled.'
      },
      ...(assessment
        ? assessment.legs
            .filter((l) => l.flags.length > 0)
            .map((l, i) => ({
              id: `r-${Date.now()}-hotspot-${i}`,
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
              recommendedAction: 'Reassess this leg before dispatch; monitor telemetry closely on arrival.'
            }))
        : [])
    ];

    const newLane: TransportLane = {
      id: `lane-${Date.now()}`,
      laneCode,
      originCity: origin.city,
      originIata: origin.iata.toUpperCase(),
      originCountry: origin.country,
      originCoords: origin.coords,
      destinationCity: destination.city,
      destinationIata: destination.iata.toUpperCase(),
      destinationCountry: destination.country,
      destinationCoords: destination.coords,
      stops: routeStops,
      carrier: resolvedCarrierName,
      carrierId: unifiedCarrierId ?? undefined,
      mode,
      productName,
      productCategory,
      batchNumber: `BATCH-2026-${Math.floor(100 + Math.random() * 899)}`,
      payloadValueUsd: payloadValue,
      tempRangeType,
      tempMin,
      tempMax,
      currentTemp: initTemp,
      mktTemp: initTemp,
      gdpComplianceRate: 99.0,
      gdpStatus: 'Compliant',
      riskScore: initialRiskScore,
      riskLevel: initialRiskScore > 40 ? 'High' : initialRiskScore > 20 ? 'Medium' : 'Low',
      status: 'Active',
      transitProgress: 5,
      departureTime: formatUtcCompactNoSeconds(new Date()),
      eta: '2026-08-16 14:00 UTC',
      delayHours: 0,
      lastUpdated: 'Just now',
      notes: `Newly provisioned ${mode} transport lane with threshold alert automation.`,
      thresholdAlerts: {
        maxTempExcursionMinutes: maxExcursionMinutes,
        tempWarningTolerance: warningTolerance,
        maxAllowedDelayHours: maxAllowedDelay,
        notifyOnShockAboveG: maxShockG,
        emailAlerts,
        smsAlerts,
      },
      temperatureHistory: [
        { timestamp: '10:00', coreTemp: initTemp, ambientTemp: 21.0, surfaceTemp: initTemp + 0.1, minPermitted: tempMin, maxPermitted: tempMax, humidity: 45, batteryLevel: 100, shockG: 0.1, isExcursion: false },
        { timestamp: '11:00', coreTemp: initTemp, ambientTemp: 20.8, surfaceTemp: initTemp + 0.2, minPermitted: tempMin, maxPermitted: tempMax, humidity: 46, batteryLevel: 99, shockG: 0.1, isExcursion: false },
      ],
      risks: defaultRisks,
    };

    onCreateLane(newLane);
    // Peak-end: land on a calm confirmation screen with the route/risk summary rather than
    // closing abruptly — the user's last impression of the flow should be "done, here's what
    // you got," not the wizard just vanishing.
    setCreatedLane(newLane);

    // Fire-and-forget persistence, matching the pattern used elsewhere in this wizard (e.g.
    // insertAuditLogEntry) — these writes shouldn't block the confirmation screen from showing.
    // Only attempted when genuinely cloud-connected: in local/demo mode there's no real
    // authenticated session for RLS to accept, and the demo dataset's local user id isn't even
    // a real UUID (lane_route_options.created_by requires one) — matching how every other
    // cloud-only read/write in this app is gated behind dataSource === 'cloud'. The lane itself
    // must be inserted into transport_lanes first (a no-op returning false if that fails) before
    // the legs/route-options, since both of those carry a foreign key to it — firing them in
    // parallel with the lane insert (or not inserting the lane at all, which is what this
    // wizard used to do) means they'd fail against a lane row that doesn't exist server-side.
    if (dataSource === 'cloud') {
      insertLaneToSupabase(newLane).then((created) => {
        if (!created) return;
        replaceLaneLegs(newLane.id, resolvedLegs);
        if (computedRouteOptions) {
          for (const opt of computedRouteOptions) {
            insertLaneRouteOption(
              {
                optionType: opt.type,
                legsSnapshot: opt.legs.map((l) => ({
                  legSequence: l.legSequence,
                  origin: l.origin.iata,
                  destination: l.destination.iata,
                  mode: l.mode,
                  carrierId: l.topCarrierPick?.carrier.id ?? null,
                  riskScore: l.riskScore,
                })),
                totalDistanceKm: opt.totalDistanceKm,
                totalTransitHours: null,
                totalCustomsDelayHours: null,
                totalRiskScore: opt.totalRiskScore,
                wasChosen: opt.type === selectedRouteOption,
              },
              newLane.id,
              currentUser.id
            );
          }
        }
      });
    }
  };

  const stepLabels = ['1. Route & Cargo', '2. Mode', '3. Risk Check', '4. Alert Rules'];

  const canAdvanceFromStep1 = origin.iata.trim().length > 0 && destination.iata.trim().length > 0 && computedRouteOptions !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {createdLane ? (
          /* Peak-end confirmation: calm summary + a clear next step, not an abrupt close. */
          <div className="p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center motion-safe:animate-in motion-safe:zoom-in duration-300">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Lane Provisioned</h2>
              <p className="text-xs text-slate-400 mt-1">
                {createdLane.laneCode} is now live with threshold alert automation enabled.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-3 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{createdLane.originIata}</span>
                {createdLane.stops.map((s) => (
                  <React.Fragment key={s.id}>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{s.iata}</span>
                  </React.Fragment>
                ))}
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">{createdLane.destinationIata}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-500">Mode</div>
                  <div className="font-bold text-slate-200">{createdLane.mode}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-500">Temp Range</div>
                  <div className="font-bold text-slate-200">{createdLane.tempMin}° to {createdLane.tempMax}°C</div>
                </div>
                <div className={`p-2 rounded-lg border ${getRiskColor(createdLane.riskLevel).bg} ${getRiskColor(createdLane.riskLevel).border}`}>
                  <div className="text-slate-500">Initial Risk</div>
                  <div className={`font-bold ${getRiskColor(createdLane.riskLevel).text}`}>{createdLane.riskScore}% {createdLane.riskLevel}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => {
                  onViewLane(createdLane);
                  onClose();
                }}
                className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all"
              >
                <span>View Lane</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Wizard Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              {step}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Add a New Lane
              </h2>
              <p className="text-xs text-slate-400">
                Pick a mode, map the route, check the risk, set alert rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-slate-950/80 px-6 py-3 border-b border-slate-800 grid grid-cols-4 gap-2 text-xs">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className={`flex items-center gap-2 ${step >= n ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step >= n ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800'
                }`}>
                  {n}
                </span>
                <span className="truncate">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs text-slate-200">

          {/* STEP 1: Define Route & Cargo */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Where is it going, and what is it?
                </h3>
                <p className="text-slate-400">
                  Search by city, country, or IATA code — we'll fill in the rest.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <AirportAutocomplete label="Origin" value={origin} onChange={setOrigin} />
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <AirportAutocomplete label="Destination" value={destination} onChange={setDestination} />
                </div>

                {showAdvancedRouting && (
                  <div className="sm:col-span-2">
                    <RouteStopsEditor origin={origin} destination={destination} stops={stops} onStopsChange={setStops} tempMin={tempMin} tempMax={tempMax} mode={mode} />
                  </div>
                )}

                {origin.iata.trim() && destination.iata.trim() && (
                  <div className="sm:col-span-2 space-y-2.5">
                    {viewMode === 'simple' && <SimpleRouteRecommendation options={computedRouteOptions} />}

                    {viewMode === 'simple' && (
                      <button
                        type="button"
                        onClick={() => setAdvancedRoutingExpanded((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
                      >
                        <span>Advanced routing options</span>
                        {advancedRoutingExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* ThreeWayRouteComparison stays mounted whenever origin/destination are set,
                        even collapsed in Simple mode, so it keeps computing in the background —
                        expanding "Advanced routing options" shouldn't have to wait on a fresh
                        DB round-trip for something that was already known. */}
                    <div className={showAdvancedRouting ? '' : 'hidden'}>
                      <ThreeWayRouteComparison
                        origin={originWaypoint}
                        destination={destinationWaypoint}
                        userStops={userStops}
                        mode={mode}
                        tempMin={tempMin}
                        tempMax={tempMax}
                        tempRangeType={tempRangeType}
                        productCategory={productCategory}
                        ports={ports}
                        carriers={carriers}
                        performanceByCarrierId={performanceByCarrierId}
                        selected={selectedRouteOption}
                        onSelect={selectRouteOption}
                        onOptionsComputed={setComputedRouteOptions}
                      />
                    </div>

                    {/* Per-leg (or unified) carrier assignment */}
                    {showAdvancedRouting && activeLegs.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-teal-400 uppercase tracking-wider">Carrier Assignment</label>
                        <LegCarrierBreakdown
                          legs={activeLegs}
                          carriers={carriers}
                          certStatusByCarrierId={certStatusByCarrierId}
                          assignedCarrierId={legCarrierOverrides}
                          assignedMode={legModeOverrides}
                          onCarrierChange={(legSeq, carrierId) => setLegCarrierOverrides((prev) => ({ ...prev, [legSeq]: carrierId }))}
                          onModeChange={(legSeq, m) => setLegModeOverrides((prev) => ({ ...prev, [legSeq]: m }))}
                          currentUserId={currentUser.id}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Product Type</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                  >
                    <option value="Vaccines">mRNA & Viral Vaccines</option>
                    <option value="Biologics">Monoclonal Antibodies & Biologics</option>
                    <option value="Insulin">Recombinant Insulin</option>
                    <option value="Cell Therapy">CAR-T & Cell Therapy</option>
                    <option value="Clinical Trials">Clinical Trial Supplies</option>
                    <option value="Active Ingredients">Active Pharmaceutical Ingredients (API)</option>
                  </select>
                </div>

                {/* Temperature Envelope Specification */}
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <label className="block text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                    Required Temperature Range
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      '2°C to 8°C (Cold Chain)',
                      '-20°C (Deep Freeze)',
                      '-80°C (Cryogenic)',
                      '15°C to 25°C (Controlled Room Temp)',
                    ].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleRangeTypeChange(type as TemperatureRangeType)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          tempRangeType === type
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-[11px]">{type}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {relevantAdvisories.length > 0 && (
                  <div className="sm:col-span-2 space-y-2">
                    {relevantAdvisories.map((r) => (
                      <div
                        key={r.advisory.id}
                        className={`p-3 rounded-xl border ${
                          r.advisory.severity === 'Avoid' ? 'bg-rose-950/30 border-rose-800/50' : 'bg-amber-950/25 border-amber-800/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${r.advisory.severity === 'Avoid' ? 'text-rose-400' : 'text-amber-400'}`} />
                          <div className="min-w-0 text-[11px] leading-relaxed">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-bold ${r.advisory.severity === 'Avoid' ? 'text-rose-300' : 'text-amber-300'}`}>
                                {r.advisory.corridorName} — {r.advisory.severity}
                              </span>
                              <span className="text-slate-500 font-mono">as of {r.advisory.asOf}</span>
                            </div>
                            {r.isStale && (
                              <p className="text-amber-400 font-semibold mt-1">{STALENESS_WARNING_PREFIX}</p>
                            )}
                            <p className="text-slate-300 mt-1">{r.advisory.summary}</p>
                            <p className="text-teal-300 mt-1"><strong>Recommended alternative:</strong> {r.advisory.recommendedAlternative}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* STEP 2: Select Transport Mode */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  How is this shipment moving?
                </h3>
                <p className="text-slate-400">
                  This sets the baseline risk profile and which controls apply later.
                </p>
              </div>

              {modeRecommendation && (
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-teal-300">
                      Recommended: {modeRecommendation.mode}
                      {mode !== modeRecommendation.mode && (
                        <button
                          type="button"
                          onClick={() => setMode(modeRecommendation.mode)}
                          className="ml-2 text-[10px] font-semibold text-teal-400 hover:text-teal-300 underline"
                        >
                          Use this
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{modeRecommendation.reason}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">

                {/* Mode: Air */}
                <div
                  onClick={() => setMode('Air')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    mode === 'Air'
                      ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {modeRecommendation?.mode === 'Air' && (
                    <span className="absolute -top-2 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950">Recommended</span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                      <Plane className="w-5 h-5" />
                    </div>
                    {mode === 'Air' && <Check className="w-5 h-5 text-sky-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Air</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Fastest option with temperature-controlled holds. Best for vaccines and biologics.
                  </p>
                </div>

                {/* Mode: Sea */}
                <div
                  onClick={() => setMode('Sea')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    mode === 'Sea'
                      ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {modeRecommendation?.mode === 'Sea' && (
                    <span className="absolute -top-2 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950">Recommended</span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Ship className="w-5 h-5" />
                    </div>
                    {mode === 'Sea' && <Check className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Sea</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Cost-effective for bulk cargo. Longer transit, needs reliable reefer power.
                  </p>
                </div>

                {/* Mode: Road */}
                <div
                  onClick={() => setMode('Road')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    mode === 'Road'
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {modeRecommendation?.mode === 'Road' && (
                    <span className="absolute -top-2 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950">Recommended</span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                      <Truck className="w-5 h-5" />
                    </div>
                    {mode === 'Road' && <Check className="w-5 h-5 text-amber-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Road</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Direct regional delivery in dual-temperature trailers, door to door.
                  </p>
                </div>

                {/* Mode: Multimodal */}
                <div
                  onClick={() => setMode('Multimodal')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    mode === 'Multimodal'
                      ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {modeRecommendation?.mode === 'Multimodal' && (
                    <span className="absolute -top-2 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950">Recommended</span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    {mode === 'Multimodal' && <Check className="w-5 h-5 text-purple-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Multimodal</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Combines air, road, and rail. Needs continuous handoff monitoring.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* STEP 3: Risk Assessment & Recommendation */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Is this route safe for this cargo?
                </h3>
                <p className="text-slate-400">
                  We check the route against known heat and cold corridors before you provision it.
                </p>
              </div>

              {!assessment ? (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 text-center">
                  Go back to Step 1 and pick an origin and destination to see the risk check.
                </div>
              ) : (
                <>
                  {/* Overall Verdict Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    assessment.verdict === 'Recommended'
                      ? 'bg-emerald-950/30 border-emerald-800/50'
                      : assessment.verdict === 'Review Recommended'
                      ? 'bg-amber-950/30 border-amber-800/50'
                      : 'bg-rose-950/30 border-rose-800/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {assessment.verdict === 'Recommended' ? (
                        <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                      ) : assessment.verdict === 'Review Recommended' ? (
                        <ShieldAlert className="w-8 h-8 text-amber-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-8 h-8 text-rose-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className={`text-sm font-extrabold ${
                          assessment.verdict === 'Recommended' ? 'text-emerald-300' : assessment.verdict === 'Review Recommended' ? 'text-amber-300' : 'text-rose-300'
                        }`}>
                          {assessment.verdict}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Route risk score: <strong className="text-slate-200">{assessment.overallScore}%</strong> ({assessment.overallLevel})
                        </p>
                      </div>
                    </div>
                    <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${assessment.overallScore}%`, backgroundColor: getRiskColor(assessment.overallLevel).fill }}
                      />
                    </div>
                  </div>

                  {/* Per-Leg Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assessment.legs.map((leg) => {
                      const legStyles = getRiskColor(leg.riskScore >= 30 ? 'High' : leg.riskScore >= 15 ? 'Medium' : 'Low');
                      return (
                        <div key={`${leg.label}-${leg.iata}`} className={`p-3 rounded-xl border ${legStyles.bg} ${legStyles.border}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-200">{leg.label} • {leg.iata}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${legStyles.badge}`}>
                              {leg.riskScore}%
                            </span>
                          </div>
                          {leg.flags.length === 0 ? (
                            <p className="text-[11px] text-slate-400">No known thermal-hotspot conflicts.</p>
                          ) : (
                            leg.flags.map((f, i) => (
                              <p key={i} className="text-[11px] text-slate-300 leading-relaxed mb-1">{f}</p>
                            ))
                          )}
                          {leg.label.startsWith('Stop') && (
                            <button
                              type="button"
                              onClick={() => setStops((prev) => prev.filter((s) => s.iata.toUpperCase() !== leg.iata))}
                              className="mt-1.5 text-[11px] font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Remove this stop
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommendations */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> What we'd suggest
                    </div>
                    <ul className="space-y-1.5">
                      {assessment.recommendations.map((r, i) => (
                        <li key={i} className="text-[11px] text-slate-300 leading-relaxed flex items-start gap-1.5">
                          <span className="text-teal-400 mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 4: Set Threshold Alerts */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  When should we alert you?
                </h3>
                <p className="text-slate-400">
                  Set the temperature, delay, and shock limits that trigger an automatic alert.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Max Temp Excursion Time */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-200">Max Excursion Duration</label>
                    <span className="font-mono font-bold text-emerald-400">{maxExcursionMinutes} mins</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Alert if temp stays outside range longer than this.
                  </p>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={maxExcursionMinutes}
                    onChange={(e) => setMaxExcursionMinutes(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Warning Tolerance */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-200">Early Warning Buffer</label>
                    <span className="font-mono font-bold text-amber-400">±{warningTolerance}°C</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Warn before the payload actually reaches its limit.
                  </p>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={warningTolerance}
                    onChange={(e) => setWarningTolerance(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Delay Tolerance */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-200">Max Allowed Delay</label>
                    <span className="font-mono font-bold text-slate-200">{maxAllowedDelay} hrs</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Flag the lane as at-risk if it runs later than this.
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    step="1"
                    value={maxAllowedDelay}
                    onChange={(e) => setMaxAllowedDelay(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Shock & Handling Limit */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-200">Shock Limit</label>
                    <span className="font-mono font-bold text-purple-400">{maxShockG} G</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Flag a drop or rough-handling incident above this.
                  </p>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.5"
                    value={maxShockG}
                    onChange={(e) => setMaxShockG(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

              </div>

              {/* Notification Checkboxes */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Who gets notified</div>
                  <div className="text-slate-400 text-[11px]">Sent to the on-duty QA & Logistics team</div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="accent-emerald-500 rounded"
                    />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsAlerts}
                      onChange={(e) => setSmsAlerts(e.target.checked)}
                      className="accent-emerald-500 rounded"
                    />
                    <span>SMS (urgent only)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Controls Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as any)}
              disabled={step === 1 && !canAdvanceFromStep1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {anyLegCertBlocked && (
                <span className="text-[11px] text-rose-300 font-semibold">Upload &amp; verify the missing certification(s) to continue.</span>
              )}
              <button
                onClick={handleCreateLaneClick}
                disabled={anyLegCertBlocked}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>Create Lane</span>
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {isOverrideModalOpen && (
          <OverrideAcknowledgmentModal
            overrides={pendingOverrides}
            onCancel={() => setIsOverrideModalOpen(false)}
            onConfirm={confirmOverridesAndFinish}
          />
        )}

      </div>
    </div>
  );
};
