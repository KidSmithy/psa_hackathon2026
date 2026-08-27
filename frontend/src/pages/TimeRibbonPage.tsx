import React from 'react';
import { 
  Clock, 
  Layers, 
  RefreshCw, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Bot, 
  Activity, 
  Info,
  Calendar,
  Zap,
  ArrowRight
} from 'lucide-react';
import { 
  ClusterWithAlerts, 
  RawAlert, 
  SeverityLevel 
} from '../types';
import { IncidentTimeRibbon } from '../components/IncidentTimeRibbon';
import { TimeScrubberControls } from '../components/TimeScrubberControls';

interface TimeRibbonPageProps {
  clusters: ClusterWithAlerts[];
  rawAlerts: RawAlert[];
  selectedClusterId: string | null;
  selectedAlertId: string | null;
  onSelectCluster: (clusterId: string | null) => void;
  onSelectAlert: (alertId: string | null) => void;
  onResolveIncident: (cluster: ClusterWithAlerts) => void;
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

export const TimeRibbonPage: React.FC<TimeRibbonPageProps> = ({
  clusters,
  rawAlerts,
  selectedClusterId,
  selectedAlertId,
  onSelectCluster,
  onSelectAlert,
  onResolveIncident,
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
  const selectedCluster = clusters.find(c => c.cluster_id === selectedClusterId);
  const selectedAlert = rawAlerts.find(a => a.id === selectedAlertId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      
      {/* Top Banner & Title Bar */}
      <div className="bg-psa-navy text-white border border-tuas-cyan/30 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-tuas-cyan/20 border border-tuas-cyan/40 rounded-xl text-tuas-cyan">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-sans">
              PAGE 2: INCIDENT TIME RIBBON & 20s SPLIT ENGINE
            </h2>
            <p className="text-slate-300 text-xs font-mono">
              Deterministic temporal bracket segmentation (&le;20s grouped, &gt;20s split) across incident streams
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-1.5 text-white bg-white/10 hover:bg-white/20 border border-tuas-cyan/40 px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-tuas-teal ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Syncing...' : 'Sync Supabase'}</span>
        </button>
      </div>

      {/* Main Incident Time Ribbon Viewport */}
      <IncidentTimeRibbon
        clusters={clusters}
        rawAlerts={rawAlerts}
        selectedClusterId={selectedClusterId}
        onSelectCluster={onSelectCluster}
        selectedAlertId={selectedAlertId}
        onSelectAlert={onSelectAlert}
        currentTimeSec={currentTimeSec}
        onScrubTime={onScrubTime}
        minTimeSec={minTimeSec}
        maxTimeSec={maxTimeSec}
      />

      {/* Playback & Scrubber Controls */}
      <TimeScrubberControls
        currentTimeSec={currentTimeSec}
        minTimeSec={minTimeSec}
        maxTimeSec={maxTimeSec}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onTogglePlay={onTogglePlay}
        onScrub={onScrubTime}
        onSetSpeed={onSetSpeed}
        onReset={onResetTime}
      />

      {/* Split Rule Specification Explainer & Selected Incident Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 20s Split Rule Documentation Card */}
        <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-sm space-y-3 font-mono text-xs text-slate-700">
          <div className="flex items-center space-x-2 font-bold text-psa-navy-dark text-sm border-b border-slate-200 pb-2">
            <Info className="w-4 h-4 text-tuas-cyan-dark" />
            <span>20s SPLIT ALGORITHM RULE</span>
          </div>

          <p className="leading-relaxed text-slate-600">
            For each incident lane, member alerts are ordered by <code className="bg-slate-100 px-1 py-0.5 rounded text-psa-navy font-bold">timestamp</code>:
          </p>

          <ul className="space-y-2 list-disc list-inside text-[11px] text-slate-700">
            <li>
              <strong>Δt ≤ 20s:</strong> Consecutive alerts merge into a continuous visual bracket capsule.
            </li>
            <li>
              <strong>Δt &gt; 20s:</strong> Current bracket closes; a new distinct capsule starts (e.g. <span className="font-bold text-amber-700">CLUSTER-C</span> 25s gap split).
            </li>
            <li>
              <strong>Safety Stream:</strong> Hard-wired safety trips bypass scoring and display as cross-lane dashed lines.
            </li>
          </ul>
        </div>

        {/* Selected Incident Inspector */}
        <div className="lg:col-span-2 bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-sm space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-2 font-bold text-psa-navy-dark text-sm">
              <ShieldAlert className="w-4 h-4 text-tuas-cyan-dark" />
              <span>
                {selectedCluster 
                  ? `SELECTED CLUSTER: ${selectedCluster.cluster_id}`
                  : 'TIMELINE INSPECTION DRAWER'}
              </span>
            </div>
            {selectedCluster && (
              <span className="text-[10px] bg-tuas-teal/20 text-psa-navy px-2 py-0.5 rounded font-bold">
                {selectedCluster.alerts.length} Correlated Alerts
              </span>
            )}
          </div>

          {selectedCluster ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-psa-navy-dark font-sans">{selectedCluster.name}</h3>
                  <p className="text-slate-500 text-xs">
                    Primary Sector: <strong className="text-psa-navy">{selectedCluster.primary_location}</strong> • Agent: <strong className="text-tuas-teal-dark">{selectedCluster.assigned_agent}</strong>
                  </p>
                </div>

                <button
                  onClick={() => onResolveIncident(selectedCluster)}
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-psa-navy to-tuas-cyan-dark hover:from-tuas-cyan-dark hover:to-tuas-teal text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5 text-tuas-teal" />
                  <span>DISPATCH AGENT</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Correlated Alerts List */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Alerts along Timeline:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {selectedCluster.alerts.map(a => {
                    const isAlertSelected = a.id === selectedAlertId;
                    return (
                      <div
                        key={a.id}
                        onClick={() => onSelectAlert(isAlertSelected ? null : a.id)}
                        className={`p-2.5 rounded-xl border text-[11px] cursor-pointer transition-all ${
                          isAlertSelected
                            ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-psa-navy">{a.id}</span>
                          <span className="text-slate-500 text-[10px]">{a.timestamp.slice(11, 19)}</span>
                        </div>
                        <p className="text-slate-700 truncate mt-0.5">{a.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 font-mono space-y-1">
              <Clock className="w-6 h-6 text-slate-400 mx-auto animate-pulse" />
              <p className="font-bold text-psa-navy-dark">Click any incident lane or bracket capsule to inspect details.</p>
              <p className="text-xs text-slate-400">Scrubber automatically snaps to clicked alert timestamps.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
