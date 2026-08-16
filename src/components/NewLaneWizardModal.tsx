import React, { useState } from 'react';
import { 
  X, 
  Plane, 
  Ship, 
  Truck, 
  Layers, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Thermometer, 
  Bell, 
  ShieldCheck, 
  Clock, 
  Zap,
  Sparkles
} from 'lucide-react';
import { TransportLane, TransportMode, TemperatureRangeType, RiskFactor } from '../types';
import { getAirportCoords } from '../utils/geo';

interface NewLaneWizardModalProps {
  onClose: () => void;
  onCreateLane: (newLane: TransportLane) => void;
}

export const NewLaneWizardModal: React.FC<NewLaneWizardModalProps> = ({
  onClose,
  onCreateLane,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Mode
  const [mode, setMode] = useState<TransportMode>('Air');

  // Step 2: Route & Cargo
  const [originCity, setOriginCity] = useState<string>('Frankfurt');
  const [originIata, setOriginIata] = useState<string>('FRA');
  const [originCountry, setOriginCountry] = useState<string>('Germany');
  const [destCity, setDestCity] = useState<string>('Singapore');
  const [destIata, setDestIata] = useState<string>('SIN');
  const [destCountry, setDestCountry] = useState<string>('Singapore');
  const [carrier, setCarrier] = useState<string>('Lufthansa Cargo');
  const [productName, setProductName] = useState<string>('Lyophilized Biologics & Vaccines');
  const [productCategory, setProductCategory] = useState<TransportLane['productCategory']>('Vaccines');
  const [payloadValue, setPayloadValue] = useState<number>(3500000);
  const [tempRangeType, setTempRangeType] = useState<TemperatureRangeType>('2°C to 8°C (Cold Chain)');
  const [tempMin, setTempMin] = useState<number>(2.0);
  const [tempMax, setTempMax] = useState<number>(8.0);

  // Step 3: Threshold Alerts
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

  const handleFinish = () => {
    const laneCode = `${originIata.toUpperCase()}-${destIata.toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;
    const initTemp = Number(((tempMin + tempMax) / 2 + 0.2).toFixed(1));

    // Automated Composite Risk Calculation
    let initialRiskScore = mode === 'Air' ? 14 : mode === 'Sea' ? 24 : mode === 'Road' ? 18 : 20;
    if (tempRangeType.includes('-80') || tempRangeType.includes('-20')) {
      initialRiskScore += 10;
    }

    const defaultRisks: RiskFactor[] = [
      {
        id: `r-${Date.now()}-1`,
        category: 'Handling Quality',
        title: `${originIata} to ${destIata} Intermodal Ramp Handover`,
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
        title: `${carrier} Cold-Chain SOP Compliance`,
        description: 'Carrier SLA and thermal container maintenance validation.',
        severity: 'Low',
        score: 8,
        likelihood: 'Low',
        impact: 'Minor',
        mitigationStrategy: 'IoT telemetry probe linked to carrier tracking API.',
        recommendedAction: 'Continuous automated polling enabled.'
      }
    ];

    const newLane: TransportLane = {
      id: `lane-${Date.now()}`,
      laneCode,
      originCity,
      originIata: originIata.toUpperCase(),
      originCountry,
      originCoords: getAirportCoords(originIata),
      destinationCity: destCity,
      destinationIata: destIata.toUpperCase(),
      destinationCountry: destCountry,
      destinationCoords: getAirportCoords(destIata),
      carrier,
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
      departureTime: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Wizard Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              {step}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Lane Creation: Guided 3-Step Wizard
              </h2>
              <p className="text-xs text-slate-400">
                Slide 9: "Under 3 Minutes: From mode selection to a fully monitored, alert-ready lane"
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
        <div className="bg-slate-950/80 px-6 py-3 border-b border-slate-800 grid grid-cols-3 gap-2 text-xs">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step >= 1 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800'
            }`}>
              1
            </span>
            <span>1. Transport Mode</span>
          </div>

          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step >= 2 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800'
            }`}>
              2
            </span>
            <span>2. Route & Cargo</span>
          </div>

          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step >= 3 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800'
            }`}>
              3
            </span>
            <span>3. Threshold Alerts</span>
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs text-slate-200">
          
          {/* STEP 1: Select Transport Mode */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Step 1: Select Transport Mode
                </h3>
                <p className="text-slate-400">
                  Choose Air, Sea, Road, or Multimodal — each optimized for a different balance of speed, cost, and flexibility.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                
                {/* Mode: Air */}
                <div
                  onClick={() => setMode('Air')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'Air'
                      ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                      <Plane className="w-5 h-5" />
                    </div>
                    {mode === 'Air' && <Check className="w-5 h-5 text-sky-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Air Express & Charter</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Highest speed, dedicated temperature-controlled holds (Envirotainer/CSafe), ideal for vaccines and biologics.
                  </p>
                </div>

                {/* Mode: Sea */}
                <div
                  onClick={() => setMode('Sea')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'Sea'
                      ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Ship className="w-5 h-5" />
                    </div>
                    {mode === 'Sea' && <Check className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Sea Reefer Container</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Cost-effective bulk distribution, active reefer units, requires robust power redundancy and dwell monitoring.
                  </p>
                </div>

                {/* Mode: Road */}
                <div
                  onClick={() => setMode('Road')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'Road'
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                      <Truck className="w-5 h-5" />
                    </div>
                    {mode === 'Road' && <Check className="w-5 h-5 text-amber-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Road Pharma Carrier</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Direct point-to-point European or regional delivery, dual-temp trailers, door-to-door temperature integrity.
                  </p>
                </div>

                {/* Mode: Multimodal */}
                <div
                  onClick={() => setMode('Multimodal')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'Multimodal'
                      ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    {mode === 'Multimodal' && <Check className="w-5 h-5 text-purple-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Multimodal / Intermodal</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Combines air, road, and bonded rail; requires continuous handoff telemetry and ramp shock monitoring.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* STEP 2: Define Route & Cargo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Step 2: Define Route & Cargo Sensitivity
                </h3>
                <p className="text-slate-400">
                  Map the origin, destination, carrier, and pharmaceutical product profile so the lane mirrors the real shipment path.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Origin Hub */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-400">Origin Departure Hub</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">City</label>
                      <input
                        type="text"
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">IATA / Code</label>
                      <input
                        type="text"
                        value={originIata}
                        onChange={(e) => setOriginIata(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Destination Hub */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-400">Destination Arrival Hub</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">City</label>
                      <input
                        type="text"
                        value={destCity}
                        onChange={(e) => setDestCity(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">IATA / Code</label>
                      <input
                        type="text"
                        value={destIata}
                        onChange={(e) => setDestIata(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Carrier & Product */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Carrier Partner</label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                  >
                    <option value="DHL Express">DHL Express Pharma Gold</option>
                    <option value="Lufthansa Cargo">Lufthansa Cargo Pharma Special</option>
                    <option value="Maersk Line">Maersk Line StarCare Reefer</option>
                    <option value="Emirates SkyCargo">Emirates SkyCargo Pharma</option>
                    <option value="Swiss WorldCargo">Swiss WorldCargo Pharma</option>
                    <option value="FedEx Custom Critical">FedEx Custom Critical Thermal</option>
                    <option value="Cargolux">Cargolux CV Pharma</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Pharmaceutical Category</label>
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
                    Temperature Control Specification
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

              </div>
            </div>
          )}

          {/* STEP 3: Set Threshold Alerts */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Step 3: Set Automatic Alert Thresholds
                </h3>
                <p className="text-slate-400">
                  Configure temperature excursion, transit delay, and shock limits that trigger automatic risk alerts.
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
                    Alert triggers if temp deviates beyond target for this continuous duration.
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
                    <label className="font-semibold text-slate-200">Pre-Excursion Warning Buffer</label>
                    <span className="font-mono font-bold text-amber-400">±{warningTolerance}°C</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Early warning alert before payload reaches critical limit.
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
                    Flags transit risk if route delay exceeds buffer time.
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
                    <label className="font-semibold text-slate-200">Shock G-Force Limit</label>
                    <span className="font-mono font-bold text-purple-400">{maxShockG} G</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Flags pallet drop or rough handling incident.
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
                  <div className="font-bold text-slate-200">Automated Notification Dispatch</div>
                  <div className="text-slate-400 text-[11px]">Direct SMS & Email broadcast to on-duty QA & Logistics team</div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="accent-emerald-500 rounded"
                    />
                    <span>Email SOP</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsAlerts}
                      onChange={(e) => setSmsAlerts(e.target.checked)}
                      className="accent-emerald-500 rounded"
                    />
                    <span>SMS Urgent</span>
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

          {step < 3 ? (
            <button
              onClick={() => setStep((step + 1) as any)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Provision Active Lane</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
