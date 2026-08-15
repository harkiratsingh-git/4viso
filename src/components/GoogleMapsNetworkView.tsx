import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { 
  Key, 
  Layers, 
  ExternalLink, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  Thermometer, 
  Navigation, 
  RefreshCw,
  Compass,
  Settings
} from 'lucide-react';
import { TransportLane, RegionalThermalHotspot } from '../types';
import { REGIONAL_THERMAL_HOTSPOTS } from '../data/temperatureRiskData';

interface GoogleMapsNetworkViewProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
  onOpenApiKeyHelp?: () => void;
  showThermalHeatmap?: boolean;
}

export const GoogleMapsNetworkView: React.FC<GoogleMapsNetworkViewProps> = ({
  lanes,
  selectedLaneId,
  onSelectLane,
  onOpenApiKeyHelp,
  showThermalHeatmap = false
}) => {
  const API_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    '';

  const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY.trim().length > 5;

  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [activeMarkerLane, setActiveMarkerLane] = useState<TransportLane | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<RegionalThermalHotspot | null>(null);

  // If no API key is provided, show the official Google Maps Setup Screen mandated by the GMP skill
  if (!hasValidKey) {
    return (
      <div className="relative w-full aspect-[2/1] min-h-[380px] bg-slate-950 rounded-xl border border-slate-800 p-6 flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Background visual styling */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/30 via-slate-950 to-slate-950 opacity-80 pointer-events-none" />
        
        <div className="relative z-10 max-w-lg">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Key className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-2">
            Google Maps Platform Key Required
          </h3>

          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            To view photorealistic satellite imagery, dynamic GIS vector terrain, and Google Maps Street/Corridor overlays, configure your API key:
          </p>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 text-left text-xs text-slate-300 mb-5 space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
              <span>
                Obtain a key at <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold hover:text-blue-300">Google Cloud Console</a>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
              <span>
                Open <strong>Settings</strong> (⚙️ top-right) → <strong>Secrets</strong> → add <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300 font-mono">GOOGLE_MAPS_PLATFORM_KEY</code>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
              <span>The application will automatically build and render Google Maps live.</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <a
              href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              Get Google Maps API Key <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Active Google Maps Render
  return (
    <div className="relative w-full aspect-[2/1] min-h-[380px] max-h-[500px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      
      {/* Map Layer Controls Bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-xs shadow-lg">
        <button
          onClick={() => setMapTypeId('roadmap')}
          className={`px-2.5 py-1 rounded font-medium transition-all ${
            mapTypeId === 'roadmap' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Vector Dark
        </button>
        <button
          onClick={() => setMapTypeId('satellite')}
          className={`px-2.5 py-1 rounded font-medium transition-all ${
            mapTypeId === 'satellite' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapTypeId('hybrid')}
          className={`px-2.5 py-1 rounded font-medium transition-all ${
            mapTypeId === 'hybrid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Hybrid
        </button>
        <button
          onClick={() => setMapTypeId('terrain')}
          className={`px-2.5 py-1 rounded font-medium transition-all ${
            mapTypeId === 'terrain' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Terrain
        </button>
      </div>

      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: 25.0, lng: 15.0 }}
          defaultZoom={2}
          mapTypeId={mapTypeId}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          {/* Render Origin & Destination Advanced Markers for Active Lanes */}
          {lanes.map((lane) => {
            const isSelected = selectedLaneId === lane.id;
            const isCritical = lane.status === 'Temperature Alert' || lane.riskScore >= 50;

            return (
              <React.Fragment key={lane.id}>
                {/* Origin Marker */}
                <AdvancedMarker
                  position={{ lat: lane.originCoords[0], lng: lane.originCoords[1] }}
                  title={`${lane.originCity} (${lane.originIata}) - Origin`}
                  onClick={() => {
                    setActiveMarkerLane(lane);
                    onSelectLane(lane);
                  }}
                >
                  <Pin
                    background={isCritical ? '#f43f5e' : '#38bdf8'}
                    borderColor="#0f172a"
                    glyphColor="#ffffff"
                    scale={isSelected ? 1.2 : 0.9}
                  />
                </AdvancedMarker>

                {/* Destination Marker */}
                <AdvancedMarker
                  position={{ lat: lane.destinationCoords[0], lng: lane.destinationCoords[1] }}
                  title={`${lane.destinationCity} (${lane.destinationIata}) - Destination`}
                  onClick={() => {
                    setActiveMarkerLane(lane);
                    onSelectLane(lane);
                  }}
                >
                  <Pin
                    background={isCritical ? '#f43f5e' : '#a855f7'}
                    borderColor="#0f172a"
                    glyphColor="#ffffff"
                    scale={isSelected ? 1.2 : 0.9}
                  />
                </AdvancedMarker>
              </React.Fragment>
            );
          })}

          {/* Render Regional Thermal Hotspots if thermal overlay enabled */}
          {showThermalHeatmap &&
            REGIONAL_THERMAL_HOTSPOTS.map((hotspot) => {
              const isExtreme = hotspot.thermalRiskLevel === 'Extreme Heat';
              const isFreeze = hotspot.thermalRiskLevel === 'Sub-Zero Freeze';

              return (
                <AdvancedMarker
                  key={hotspot.id}
                  position={{ lat: hotspot.coords[0], lng: hotspot.coords[1] }}
                  title={`${hotspot.name} (${hotspot.ambientTempC}°C)`}
                  onClick={() => setActiveHotspot(hotspot)}
                >
                  <div className="relative group cursor-pointer">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 ${
                      isExtreme 
                        ? 'bg-rose-600 border-rose-300 text-white animate-pulse' 
                        : isFreeze 
                          ? 'bg-indigo-600 border-indigo-300 text-white' 
                          : 'bg-amber-600 border-amber-300 text-white'
                    }`}>
                      <Thermometer className="w-4 h-4" />
                    </div>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded border border-slate-700">
                      {hotspot.ambientTempC > 0 ? `+${hotspot.ambientTempC}` : hotspot.ambientTempC}°C
                    </span>
                  </div>
                </AdvancedMarker>
              );
            })}

          {/* Active Lane Info Popup */}
          {activeMarkerLane && (
            <InfoWindow
              position={{
                lat: activeMarkerLane.originCoords[0],
                lng: activeMarkerLane.originCoords[1]
              }}
              onCloseClick={() => setActiveMarkerLane(null)}
            >
              <div className="p-1 max-w-xs text-slate-900 font-sans text-xs">
                <div className="font-bold text-sm text-slate-950 flex items-center justify-between border-b pb-1 mb-1">
                  <span>{activeMarkerLane.laneCode}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                    {activeMarkerLane.mode}
                  </span>
                </div>
                <div className="font-medium text-slate-800 mb-1">
                  {activeMarkerLane.originCity} → {activeMarkerLane.destinationCity}
                </div>
                <div className="text-slate-600 text-[11px] mb-1.5">
                  Payload: <strong>{activeMarkerLane.productName}</strong> ({activeMarkerLane.batchNumber})
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                  <span>Core Temp: <strong className={activeMarkerLane.currentTemp > activeMarkerLane.tempMax ? 'text-rose-600' : 'text-emerald-600'}>{activeMarkerLane.currentTemp}°C</strong></span>
                  <span>Risk: <strong>{activeMarkerLane.riskScore}%</strong></span>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Hotspot Info Popup */}
          {activeHotspot && (
            <InfoWindow
              position={{
                lat: activeHotspot.coords[0],
                lng: activeHotspot.coords[1]
              }}
              onCloseClick={() => setActiveHotspot(null)}
            >
              <div className="p-1 max-w-xs text-slate-900 font-sans text-xs">
                <div className="font-bold text-sm text-rose-700 flex items-center gap-1 border-b pb-1 mb-1">
                  <Thermometer className="w-4 h-4 text-rose-600" />
                  {activeHotspot.name}
                </div>
                <div className="text-slate-700 font-semibold mb-1">
                  Ambient: {activeHotspot.ambientTempC}°C | Ramp Surface: {activeHotspot.rampSurfaceTempC}°C
                </div>
                <p className="text-[11px] text-slate-600 mb-1.5">
                  {activeHotspot.recommendation}
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  Max Tarmac Exposure: <strong>{activeHotspot.tarmacExposureRiskMins} mins</strong>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};
