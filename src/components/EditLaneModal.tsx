import React, { useMemo, useState } from 'react';
import { X, Plane, Ship, Truck, Layers, Save, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { TransportLane, TransportMode, TemperatureRangeType, RouteStop } from '../types';
import { AirportAutocomplete, AirportValue } from './AirportAutocomplete';
import { RouteStopsEditor, DraftStop } from './RouteStopsEditor';
import { recommendTransportMode, checkRouteCertification, CertificationIssue } from '../utils/ports';
import { usePorts } from '../contexts/PortsContext';

interface EditLaneModalProps {
  lane: TransportLane;
  onClose: () => void;
  onSave: (
    laneId: string,
    updates: {
      originCity: string; originIata: string; originCountry: string; originCoords: [number, number];
      destinationCity: string; destinationIata: string; destinationCountry: string; destinationCoords: [number, number];
      stops: RouteStop[];
      mode: TransportMode;
      carrier: string;
      productName: string;
      productCategory: TransportLane['productCategory'];
      tempRangeType: TemperatureRangeType;
      tempMin: number;
      tempMax: number;
    },
    certificationIssues: CertificationIssue[]
  ) => void;
}

function toDraftStops(stops: RouteStop[]): DraftStop[] {
  return stops.map((s) => ({
    id: s.id, city: s.city, iata: s.iata, country: s.country, coords: s.coords,
    stopType: s.stopType, plannedDwellHours: s.plannedDwellHours,
  }));
}

const MODES: { mode: TransportMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'Air', icon: <Plane className="w-4 h-4" />, label: 'Air' },
  { mode: 'Sea', icon: <Ship className="w-4 h-4" />, label: 'Sea' },
  { mode: 'Road', icon: <Truck className="w-4 h-4" />, label: 'Road' },
  { mode: 'Multimodal', icon: <Layers className="w-4 h-4" />, label: 'Multimodal' },
];

export const EditLaneModal: React.FC<EditLaneModalProps> = ({ lane, onClose, onSave }) => {
  const { ports } = usePorts();

  const [origin, setOrigin] = useState<AirportValue>({ city: lane.originCity, iata: lane.originIata, country: lane.originCountry, coords: lane.originCoords });
  const [destination, setDestination] = useState<AirportValue>({ city: lane.destinationCity, iata: lane.destinationIata, country: lane.destinationCountry, coords: lane.destinationCoords });
  const [stops, setStops] = useState<DraftStop[]>(toDraftStops(lane.stops));
  const [mode, setMode] = useState<TransportMode>(lane.mode);
  const [carrier, setCarrier] = useState<string>(lane.carrier);
  const [productName, setProductName] = useState<string>(lane.productName);
  const [productCategory, setProductCategory] = useState<TransportLane['productCategory']>(lane.productCategory);
  const [tempRangeType, setTempRangeType] = useState<TemperatureRangeType>(lane.tempRangeType);
  const [tempMin, setTempMin] = useState<number>(lane.tempMin);
  const [tempMax, setTempMax] = useState<number>(lane.tempMax);

  const handleRangeTypeChange = (type: TemperatureRangeType) => {
    setTempRangeType(type);
    if (type === '2°C to 8°C (Cold Chain)') { setTempMin(2.0); setTempMax(8.0); }
    else if (type === '-20°C (Deep Freeze)') { setTempMin(-25.0); setTempMax(-15.0); }
    else if (type === '-80°C (Cryogenic)') { setTempMin(-90.0); setTempMax(-70.0); }
    else if (type === '15°C to 25°C (Controlled Room Temp)') { setTempMin(15.0); setTempMax(25.0); }
  };

  const modeRecommendation = useMemo(
    () => (origin.iata && destination.iata ? recommendTransportMode(origin.coords, destination.coords, tempMin, tempMax, productCategory) : null),
    [origin, destination, tempMin, tempMax, productCategory]
  );

  const certificationIssues = useMemo(() => {
    const legs = [
      { iata: origin.iata, city: origin.city },
      ...stops.filter((s) => s.iata.trim()).map((s) => ({ iata: s.iata, city: s.city })),
      { iata: destination.iata, city: destination.city },
    ];
    return checkRouteCertification(legs, ports, tempMax);
  }, [origin, destination, stops, ports, tempMax]);

  const canSave = origin.iata.trim().length > 0 && destination.iata.trim().length > 0;

  const handleSave = () => {
    const routeStops: RouteStop[] = stops
      .filter((s) => s.iata.trim())
      .map((s, i) => ({
        id: s.id, sequence: i + 1, city: s.city || s.iata.toUpperCase(), iata: s.iata.toUpperCase(),
        country: s.country, coords: s.coords, stopType: s.stopType, plannedDwellHours: s.plannedDwellHours,
      }));

    onSave(lane.id, {
      originCity: origin.city, originIata: origin.iata.toUpperCase(), originCountry: origin.country, originCoords: origin.coords,
      destinationCity: destination.city, destinationIata: destination.iata.toUpperCase(), destinationCountry: destination.country, destinationCoords: destination.coords,
      stops: routeStops,
      mode, carrier, productName, productCategory, tempRangeType, tempMin, tempMax,
    }, certificationIssues);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Edit Lane: {lane.laneCode}</h2>
            <p className="text-xs text-slate-400">Reroute in an emergency, change carrier or cargo details, or adjust stops</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs text-slate-200">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <AirportAutocomplete label="Origin" value={origin} onChange={setOrigin} />
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <AirportAutocomplete label="Destination" value={destination} onChange={setDestination} />
            </div>
          </div>

          <RouteStopsEditor origin={origin} destination={destination} stops={stops} onStopsChange={setStops} tempMin={tempMin} tempMax={tempMax} />

          {/* Transport Mode */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Transport Mode</label>
              {modeRecommendation && mode !== modeRecommendation.mode && (
                <button
                  type="button"
                  onClick={() => setMode(modeRecommendation.mode)}
                  className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
                  title={modeRecommendation.reason}
                >
                  <Sparkles className="w-3 h-3" /> Recommended: {modeRecommendation.mode}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => setMode(m.mode)}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    mode === m.mode ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Carrier & Product */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Carrier</label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
              />
            </div>
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
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
              />
            </div>
          </div>

          {/* Temperature Range */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="block text-[11px] font-bold text-teal-400 uppercase tracking-wider">Required Temperature Range</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['2°C to 8°C (Cold Chain)', '-20°C (Deep Freeze)', '-80°C (Cryogenic)', '15°C to 25°C (Controlled Room Temp)'] as TemperatureRangeType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleRangeTypeChange(type)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    tempRangeType === type ? 'bg-teal-500/20 text-teal-300 border-teal-500 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-[11px]">{type}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Certification Check */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
            certificationIssues.length === 0 ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-amber-950/30 border-amber-800/50'
          }`}>
            {certificationIssues.length === 0 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className={`text-xs font-bold ${certificationIssues.length === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {certificationIssues.length === 0 ? 'All ports on this route are certified for this cargo' : `${certificationIssues.length} certification issue${certificationIssues.length > 1 ? 's' : ''} on this route`}
              </div>
              {certificationIssues.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {certificationIssues.map((issue, i) => (
                    <li key={i} className="text-[11px] text-slate-300">{issue.issue}</li>
                  ))}
                </ul>
              )}
              {certificationIssues.length > 0 && (
                <p className="text-[10px] text-slate-500 mt-1">Saving will still be allowed, but an alert will be logged for QA follow-up.</p>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>

      </div>
    </div>
  );
};
