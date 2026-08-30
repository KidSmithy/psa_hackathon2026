import React, { useState, useEffect, useMemo } from 'react';
import { Header, MainViewType } from './components/Header';
import { YardVisualizerPage } from './pages/YardVisualizerPage';
import { TimeRibbonPage } from './pages/TimeRibbonPage';
import { AlertsClustersPage } from './pages/AlertsClustersPage';
import { ChatInterface } from './components/ChatInterface';
import { 
  RawAlert, 
  IncidentClusterRow, 
  ClusterWithAlerts, 
  AGVTelemetryRow, 
  LaneQueueRow, 
  SeverityLevel 
} from './types';
import { supabase, CLUSTERS_TABLE } from './lib/supabase';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation: 3 dedicated pages ('yardMap' | 'timeRibbon' | 'alerts') + agent triage ('spawning')
  const [currentView, setCurrentView] = useState<MainViewType>('yardMap');
  
  // Data state (pure live Supabase data, no mock fallbacks)
  const [clusters, setClusters] = useState<IncidentClusterRow[]>([]);
  const [rawAlerts, setRawAlerts] = useState<RawAlert[]>([]);
  const [telemetryList, setTelemetryList] = useState<AGVTelemetryRow[]>([]);
  const [laneQueues, setLaneQueues] = useState<LaneQueueRow[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cross-component synchronized selection state
  const [selectedCluster, setSelectedCluster] = useState<ClusterWithAlerts | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Time scrubber and playback state
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Helper to convert ISO string to epoch seconds
  const toEpoch = (iso: string) => {
    const t = Date.parse(iso);
    return isNaN(t) ? 0 : t / 1000;
  };

  // Compute bounding timeline range across all alerts with padding
  const { minTimeSec, maxTimeSec } = useMemo(() => {
    if (rawAlerts.length === 0) return { minTimeSec: 0, maxTimeSec: 100 };
    const times = rawAlerts.map(a => toEpoch(a.timestamp)).filter(t => t > 0);
    if (times.length === 0) return { minTimeSec: 0, maxTimeSec: 100 };
    const min = Math.min(...times);
    const max = Math.max(...times);
    return {
      minTimeSec: Math.max(0, min - 5),
      maxTimeSec: Math.max(min + 1, max + 10),
    };
  }, [rawAlerts]);

  // Sync initial currentTimeSec and default selections when data loads
  useEffect(() => {
    if (minTimeSec > 0 && currentTimeSec === 0) {
      setCurrentTimeSec(minTimeSec);
    }
  }, [minTimeSec, currentTimeSec]);

  // Fetch telemetry, alerts, and incident clusters from Supabase
  const fetchData = async () => {
    setIsLoading(true);
    const errors: string[] = [];

    try {
      // 1. Fetch raw alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('raw_alerts')
        .select('*')
        .order('timestamp', { ascending: true });

      if (alertsError) {
        errors.push(`raw_alerts error: ${alertsError.message}`);
      } else {
        setRawAlerts((alertsData as RawAlert[]) || []);
      }

      // 2. Fetch incident clusters
      const { data: clustersData, error: clustersError } = await supabase
        .from(CLUSTERS_TABLE)
        .select('*')
        .order('cluster_id', { ascending: true });

      if (clustersError) {
        errors.push(`${CLUSTERS_TABLE} error: ${clustersError.message}`);
      } else {
        const clusterRows = (clustersData as IncidentClusterRow[]) || [];
        setClusters(clusterRows);
        if (!selectedClusterId && clusterRows.length > 0) {
          setSelectedClusterId(clusterRows[0].cluster_id);
        }
      }

      // 3. Fetch AGV telemetry
      const { data: telemData, error: telemError } = await supabase
        .from('agv_telemetry')
        .select('*');

      if (telemError) {
        errors.push(`agv_telemetry error: ${telemError.message}`);
      } else {
        const telems = (telemData as AGVTelemetryRow[]) || [];
        setTelemetryList(telems);
        if (!selectedVehicleId && telems.length > 0) {
          setSelectedVehicleId(telems[0].vehicle_id);
        }
      }

      // 4. Fetch lane queues
      const { data: queueData, error: queueError } = await supabase
        .from('lane_queues')
        .select('*');

      if (queueError) {
        errors.push(`lane_queues error: ${queueError.message}`);
      } else {
        setLaneQueues((queueData as LaneQueueRow[]) || []);
      }

      if (errors.length > 0) {
        setErrorMessage(errors.join(' • '));
        setIsSupabaseLive(false);
      } else {
        setErrorMessage(null);
        setIsSupabaseLive(true);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect to Supabase database';
      setErrorMessage(msg);
      setIsSupabaseLive(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map raw alerts to their respective clusters with highest severity
  const clustersWithAlerts: ClusterWithAlerts[] = useMemo(() => {
    const alertMap = new Map<string, RawAlert>();
    rawAlerts.forEach(a => alertMap.set(a.id, a));

    return clusters.map(c => {
      const matchedAlerts: RawAlert[] = [];
      const alertIds = Array.isArray(c.raw_alert_ids) ? c.raw_alert_ids : [];
      
      alertIds.forEach(id => {
        const found = alertMap.get(id);
        if (found) matchedAlerts.push(found);
      });

      let highestSeverity: SeverityLevel = 'LOW';
      if (matchedAlerts.some(a => a.severity === 'CRITICAL')) {
        highestSeverity = 'CRITICAL';
      } else if (matchedAlerts.some(a => a.severity === 'HIGH')) {
        highestSeverity = 'HIGH';
      } else if (matchedAlerts.some(a => a.severity === 'MEDIUM')) {
        highestSeverity = 'MEDIUM';
      } else if (matchedAlerts.some(a => a.severity === 'INFO')) {
        highestSeverity = 'INFO';
      }

      return {
        ...c,
        alerts: matchedAlerts,
        highestSeverity,
      };
    });
  }, [clusters, rawAlerts]);

  // Synchronize selection
  const handleSelectCluster = (clusterId: string | null) => {
    setSelectedClusterId(clusterId);
    if (clusterId) {
      const found = clustersWithAlerts.find(c => c.cluster_id === clusterId);
      if (found) {
        setSelectedCluster(found);
        if (found.alerts.length > 0) {
          setCurrentTimeSec(toEpoch(found.alerts[0].timestamp));
        }
      }
    } else {
      setSelectedCluster(null);
    }
  };

  const [resolveSessionId, setResolveSessionId] = useState<number>(0);

  const handleResolveIncident = (cluster: ClusterWithAlerts) => {
    setSelectedCluster(cluster);
    setSelectedClusterId(cluster.cluster_id);
    setResolveSessionId(Date.now());
    setCurrentView('spawning');
  };

  return (
    <div className="bg-psa-canvas text-psa-navy-dark min-h-screen flex flex-col font-sans bg-grid-pattern">
      {/* Global Application Header with 3 Page Navigation */}
      <Header
        currentView={currentView}
        onChangeView={setCurrentView}
        totalAlertsCount={rawAlerts.length}
        totalClustersCount={clusters.length}
      />

      {/* Main Page Viewport Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 space-y-4">
        {/* Supabase Connection / Query Error Banner */}
        {errorMessage && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-red-800 flex flex-wrap items-center justify-between gap-3 shadow-sm font-mono text-xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 border border-red-200 rounded-xl text-red-600">
                <AlertCircle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-sm text-red-900 font-sans">Supabase Query / Connection Error</p>
                <p className="text-red-700 text-xs mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Reconnecting...' : 'Retry Connection'}</span>
            </button>
          </div>
        )}

        {/* PAGE 1: AGV YARD MAP VISUALIZER */}
        {currentView === 'yardMap' && (
          <YardVisualizerPage
            clusters={clustersWithAlerts}
            rawAlerts={rawAlerts}
            telemetryList={telemetryList}
            laneQueues={laneQueues}
            selectedClusterId={selectedClusterId}
            selectedVehicleId={selectedVehicleId}
            onSelectCluster={(clusterId) => {
              if (clusterId) {
                handleSelectCluster(clusterId);
                setCurrentView('alerts');
              } else {
                handleSelectCluster(null);
              }
            }}
            onSelectVehicle={setSelectedVehicleId}
            currentTimeSec={currentTimeSec}
            onScrubTime={setCurrentTimeSec}
            minTimeSec={minTimeSec}
            maxTimeSec={maxTimeSec}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSetSpeed={setPlaybackSpeed}
            onResetTime={() => {
              setIsPlaying(false);
              setCurrentTimeSec(minTimeSec);
            }}
            isLoading={isLoading}
            onRefresh={fetchData}
          />
        )}

        {/* PAGE 2: INCIDENT TIME RIBBON */}
        {currentView === 'timeRibbon' && (
          <TimeRibbonPage
            clusters={clustersWithAlerts}
            rawAlerts={rawAlerts}
            selectedClusterId={selectedClusterId}
            selectedAlertId={selectedAlertId}
            onSelectCluster={handleSelectCluster}
            onSelectAlert={setSelectedAlertId}
            onResolveIncident={handleResolveIncident}
            currentTimeSec={currentTimeSec}
            onScrubTime={setCurrentTimeSec}
            minTimeSec={minTimeSec}
            maxTimeSec={maxTimeSec}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSetSpeed={setPlaybackSpeed}
            onResetTime={() => {
              setIsPlaying(false);
              setCurrentTimeSec(minTimeSec);
            }}
            isLoading={isLoading}
            onRefresh={fetchData}
          />
        )}

        {/* PAGE 3: INCIDENT CLUSTERS & RAW ALERTS QUEUE */}
        {currentView === 'alerts' && (
          <AlertsClustersPage
            clusters={clusters}
            rawAlerts={rawAlerts}
            isLoading={isLoading}
            onRefresh={fetchData}
            onResolveIncident={handleResolveIncident}
            selectedClusterId={selectedClusterId}
            onClearSelectedCluster={() => setSelectedClusterId(null)}
          />
        )}

        {/* PAGE 4: AGENT TRIAGE CHAT RUNTIME */}
        {currentView === 'spawning' && (
          <ChatInterface
            key={selectedCluster ? `${selectedCluster.cluster_id}-${resolveSessionId}` : 'copilot'}
            selectedCluster={selectedCluster}
            onBackToDocket={() => {
              setSelectedCluster(null);
              setCurrentView('alerts');
            }}
          />
        )}
      </main>
    </div>
  );
};

export default App;
