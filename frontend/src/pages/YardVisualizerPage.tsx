import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Truck, 
  Activity, 
  Battery, 
  Gauge, 
  ShieldAlert, 
  AlertTriangle, 
  Maximize2, 
  RefreshCw, 
  Clock, 
  Layers, 
  Search, 
  Filter, 
  Zap,
  CheckCircle2
} from 'lucide-react';
import { 
  ClusterWithAlerts, 
  RawAlert, 
  AGVTelemetryRow, 
  LaneQueueRow 
} from '../types';
import { YardMapVisualizer } from '../components/YardMapVisualizer';
import { TimeScrubberControls } from '../components/TimeScrubberControls';

interface YardVisualizerPageProps {
  clusters: ClusterWithAlerts[];
  rawAlerts: RawAlert[];
  telemetryList: AGVTelemetryRow[];
  laneQueues: LaneQueueRow[];
  selectedClusterId: string | null;
  selectedVehicleId: string | null;
  onSelectCluster: (clusterId: string | null) => void;
  onSelectVehicle: (vehicleId: string | null) => void;
  currentTimeSec: number;
  onScrubTime: (sec: number | ((prev: number) => number)) => void;
  minTimeSec: number;
  maxTimeSec: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
  onResetTime: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const YardVisualizerPage: React.FC<YardVisualizerPageProps> = ({
  clusters,
  rawAlerts,
  telemetryList,
  laneQueues,
  selectedClusterId,
  selectedVehicleId,
  onSelectCluster,
  onSelectVehicle,
  currentTimeSec,
  onScrubTime,
  minTimeSec,
  maxTimeSec,
  isPlaying,
  playbackSpeed,
  onTogglePlay,
  onSetSpeed,
  onResetTime,
  isLoading,
  onRefresh,
}) => {
  // Search & Filter state for the right-side Telemetry Roster
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'FAULT' | 'MOVING' | 'LOW_BATT'>('ALL');

  // Filtered telemetry list
  const filteredVehicles = useMemo(() => {
    return telemetryList.filter((t) => {
      const matchesSearch = t.vehicle_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.error_register && t.error_register.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const speed = Number(t.speed_mps) || 0;
      const hasFault = t.error_register !== 'OK' && t.error_register !== '';
      const battery = Number(t.battery_soc_percent) || 0;

      if (filterMode === 'FAULT') return hasFault;
      if (filterMode === 'MOVING') return speed > 0;
      if (filterMode === 'LOW_BATT') return battery < 25;
      return true;
    });
  }, [telemetryList, searchQuery, filterMode]);

  // Status counts for roster header
  const counts = useMemo(() => {
    let faulted = 0;
    let moving = 0;
    let lowBatt = 0;

    telemetryList.forEach((t) => {
      if (t.error_register !== 'OK' && t.error_register !== '') faulted++;
      if ((Number(t.speed_mps) || 0) > 0) moving++;
      if ((Number(t.battery_soc_percent) || 0) < 25) lowBatt++;
    });

    return { total: telemetryList.length, faulted, moving, lowBatt };
  }, [telemetryList]);

  return (
    <div className="space-y-4 max-w-full mx-auto pb-10 font-sans">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-psa-navy text-white border border-tuas-cyan/30 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-tuas-cyan/20 border border-tuas-cyan/40 rounded-xl text-tuas-cyan">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-sans">
              PAGE 1: REAL-TIME AGV YARD MAP VISUALIZER
            </h2>
            <p className="text-slate-300 text-xs font-mono">
              Live spatial coordinates (850m × 480m), kinematic vectors, and synchronized fleet telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1.5 text-white bg-white/10 hover:bg-white/20 border border-tuas-cyan/40 px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-tuas-teal ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Sync Supabase'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout: Map Visualizer on Left (col-span-8), Telemetry Roster on Right (col-span-4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN (8 Cols): Yard Map Visualizer */}
        <div className="lg:col-span-8 space-y-4">
          {/* Interactive Yard Map SVG Viewport */}
          <YardMapVisualizer
            clusters={clusters}
            rawAlerts={rawAlerts}
            telemetryList={telemetryList}
            laneQueues={laneQueues}
            selectedClusterId={selectedClusterId}
            selectedVehicleId={selectedVehicleId}
            onSelectCluster={onSelectCluster}
            onSelectVehicle={onSelectVehicle}
            currentTimeSec={currentTimeSec}
          />
        </div>

        {/* RIGHT COLUMN (4 Cols): Connected AGV Telemetry Roster Sidebar */}
        <div className="lg:col-span-4 bg-[#0C1518] border-2 border-slate-700/80 rounded-2xl p-4 shadow-2xl font-mono text-xs space-y-3.5 flex flex-col">
          
          {/* Header & Quick Counter Badges */}
          <div className="border-b border-slate-800 pb-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white font-bold text-xs">
                <Truck className="w-4 h-4 text-tuas-cyan" />
                <span>AGV FLEET ROSTER</span>
                <span className="bg-tuas-cyan/20 text-tuas-cyan border border-tuas-cyan/40 px-2 py-0.5 rounded text-[10px] font-bold">
                  {telemetryList.length} VEHICLES
                </span>
              </div>
              {selectedVehicleId && (
                <button
                  onClick={() => onSelectVehicle(null)}
                  className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition-all"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Quick Status Chips */}
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  filterMode === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'bg-black/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                onClick={() => setFilterMode('FAULT')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  filterMode === 'FAULT'
                    ? 'bg-red-900/60 text-red-200 border border-red-500/50'
                    : 'bg-black/40 text-red-400 hover:text-red-300'
                }`}
              >
                Fault ({counts.faulted})
              </button>
              <button
                onClick={() => setFilterMode('MOVING')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  filterMode === 'MOVING'
                    ? 'bg-sky-900/60 text-sky-200 border border-sky-500/50'
                    : 'bg-black/40 text-sky-400 hover:text-sky-300'
                }`}
              >
                Active ({counts.moving})
              </button>
              <button
                onClick={() => setFilterMode('LOW_BATT')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  filterMode === 'LOW_BATT'
                    ? 'bg-amber-900/60 text-amber-200 border border-amber-500/50'
                    : 'bg-black/40 text-amber-400 hover:text-amber-300'
                }`}
              >
                Low Batt ({counts.lowBatt})
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search AGV ID or error code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#060B0D] border border-slate-800 focus:border-tuas-cyan rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Scrollable Vehicle Cards Container */}
          <div className="space-y-2.5 max-h-[580px] md:max-h-[640px] overflow-y-auto pr-1">
            {filteredVehicles.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-1">
                <Truck className="w-6 h-6 mx-auto opacity-40" />
                <p className="text-xs">No matching AGVs found.</p>
              </div>
            ) : (
              filteredVehicles.map((t) => {
                const isSelected = t.vehicle_id === selectedVehicleId;
                const speed = Number(t.speed_mps) || 0;
                const hasFault = t.error_register !== 'OK' && t.error_register !== '';
                const battery = Number(t.battery_soc_percent) || 0;
                const isLowBatt = battery < 25;

                return (
                  <div
                    key={t.vehicle_id}
                    onClick={() => onSelectVehicle(isSelected ? null : t.vehicle_id)}
                    className={`bg-[#060B0D] border-2 rounded-xl p-3 space-y-2 cursor-pointer transition-all shadow-md hover:border-slate-600 ${
                      isSelected
                        ? 'border-sky-400 ring-2 ring-sky-500/40 bg-sky-950/20'
                        : hasFault
                        ? 'border-red-500/80 bg-red-950/10'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* Top Row: ID, Speed, Driving State */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-black text-white">
                        <Truck className={`w-3.5 h-3.5 ${hasFault ? 'text-red-400' : speed > 0 ? 'text-sky-400' : 'text-tuas-teal'}`} />
                        <span>{t.vehicle_id}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1 rounded">
                            FOCUSED
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        speed > 0
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {speed > 0 ? `${speed.toFixed(1)} m/s` : t.driving_state || 'STOPPED'}
                      </span>
                    </div>

                    {/* Middle Row: Battery & Hydraulic */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <Battery className={`w-3.5 h-3.5 ${isLowBatt ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
                        <span>SoC: <strong className={isLowBatt ? 'text-red-400' : 'text-slate-200'}>{battery}%</strong></span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <Gauge className="w-3.5 h-3.5 text-slate-400" />
                        <span className={Number(t.hydraulic_pressure_bar) > 250 ? 'text-red-400 font-bold' : 'text-slate-200'}>
                          {t.hydraulic_pressure_bar} bar
                        </span>
                      </div>
                    </div>

                    {/* Bottom Fault / Work Order Tag */}
                    {hasFault ? (
                      <div className="text-[10px] font-bold bg-red-950/60 text-red-300 border border-red-800/80 px-2 py-1 rounded flex items-center space-x-1.5 truncate">
                        <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        <span className="truncate">{t.error_register}</span>
                      </div>
                    ) : t.wa_id ? (
                      <div className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded flex items-center justify-between border border-slate-800">
                        <span>WA: <strong className="text-slate-300">{t.wa_id}</strong></span>
                        <span className="text-tuas-teal text-[9px]">{t.wi_status}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
