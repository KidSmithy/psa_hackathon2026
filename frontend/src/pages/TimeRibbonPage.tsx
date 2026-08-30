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
  SeverityLevel,
  alertText
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
    <div className="space-y-6 max-w-full mx-auto pb-12 font-sans">
      
      {/* Top Banner & Title Bar */}
      <div className="bg-psa-navy text-white border border-tuas-cyan/30 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-tuas-cyan/20 border border-tuas-cyan/40 rounded-xl text-tuas-cyan">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-sans">
              PAGE 2: UNIFIED INCIDENT TIMELINE
            </h2>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-1.5 text-white bg-white/10 hover:bg-white/20 border border-tuas-cyan/40 px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-tuas-teal ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Syncing...' : 'Sync Database'}</span>
        </button>
      </div>

      {/* Main 2-Column Layout: Timeline + Scrubber on Left, Explainer + Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* LEFT COLUMN (8 cols): Unified Timeline + Playback Scrubber */}
        <div className="lg:col-span-8 space-y-4">
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
        </div>

        {/* RIGHT COLUMN (4 cols): Reading the Timeline + Selected Incident Inspector */}
        <div className="lg:col-span-4 space-y-4">

          {/* How to read the unified timeline */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-sm space-y-3 font-mono text-xs text-slate-700">
            <div className="flex items-center space-x-2 font-bold text-psa-navy-dark text-sm border-b border-slate-200 pb-2">
              <Info className="w-4 h-4 text-tuas-cyan-dark" />
              <span>READING THE TIMELINE</span>
            </div>

            <p className="leading-relaxed text-slate-600">
              Every incident shares one time axis.
            </p>

            <ul className="space-y-2 list-disc list-inside text-[11px] text-slate-700">
              <li>
                <strong>Density bars:</strong> how many incidents <em>started</em> in each time bucket,
                stacked by severity. This is the part that stays readable at scale.
              </li>
              <li>
                <strong>Diamond:</strong> a correlated incident (2+ alerts).
              </li>
              <li>
                <strong>Hollow circle:</strong> a singleton &mdash; one alert that matched nothing else.
              </li>
              <li>
                <strong>Trailing line:</strong> how long that incident kept producing alerts.
              </li>
              <li>
                <strong>Safety stream:</strong> safety trips bypass priority scoring entirely and
                show as dashed vertical markers.
              </li>
              <li>
                <strong>20s split:</strong> still applied, but only drawn for the incident you select,
                as bracket capsules under the main track.
              </li>
            </ul>
          </div>

          {/* Selected Incident Inspector */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-sm space-y-4 font-mono text-xs">
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
                <span className="text-[10px] bg-tuas-teal/20 text-psa-navy px-2 py-0.5 rounded font-bold whitespace-nowrap">
                  {selectedCluster.alerts.length} Correlated Alerts
                </span>
              )}
            </div>

            {selectedCluster ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-psa-navy-dark font-sans">{selectedCluster.name}</h3>
                    <p className="text-slate-500 text-xs">
                      Primary Sector: <strong className="text-psa-navy">{selectedCluster.primary_location}</strong> • Agent: <strong className="text-tuas-teal-dark">{selectedCluster.assigned_agent}</strong>
                      {selectedCluster.problem_type && (
                        <> • Problem: <strong className="text-psa-navy">{selectedCluster.problem_type_label || selectedCluster.problem_type}</strong></>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => onResolveIncident(selectedCluster)}
                    className="w-full flex items-center justify-center space-x-1.5 bg-gradient-to-r from-psa-navy to-tuas-cyan-dark hover:from-tuas-cyan-dark hover:to-tuas-teal text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5 text-tuas-teal" />
                    <span>DISPATCH AGENT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Correlated Alerts List */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Alerts along Timeline:</span>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
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
                          <p className="text-slate-700 truncate mt-0.5">{alertText(a)}</p>
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
                <p className="text-xs text-slate-400">Timestamp automatically snaps to clicked alert timestamps.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
