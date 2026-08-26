import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AlertsClustersPage } from './pages/AlertsClustersPage';
import { ChatInterface } from './components/ChatInterface';
import { RawAlert, IncidentClusterRow, ClusterWithAlerts } from './types';
import { supabase } from './lib/supabase';
import { FALLBACK_RAW_ALERTS, FALLBACK_INCIDENT_CLUSTERS } from './data/supabaseMockFallback';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'alerts' | 'spawning'>('alerts');
  const [selectedCluster, setSelectedCluster] = useState<ClusterWithAlerts | null>(null);
  
  const [clusters, setClusters] = useState<IncidentClusterRow[]>(FALLBACK_INCIDENT_CLUSTERS);
  const [rawAlerts, setRawAlerts] = useState<RawAlert[]>(FALLBACK_RAW_ALERTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);

  // Fetch telemetry and incident clusters from Supabase
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch raw alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('raw_alerts')
        .select('*')
        .order('timestamp', { ascending: false });

      if (alertsError) {
        console.warn('Supabase raw_alerts query returned error, using fallback:', alertsError.message);
      } else if (alertsData && alertsData.length > 0) {
        setRawAlerts(alertsData as RawAlert[]);
      }

      // 2. Fetch incident clusters
      const { data: clustersData, error: clustersError } = await supabase
        .from('incident_clusters')
        .select('*')
        .order('cluster_id', { ascending: true });

      if (clustersError) {
        console.warn('Supabase incident_clusters query returned error, using fallback:', clustersError.message);
      } else if (clustersData && clustersData.length > 0) {
        setClusters(clustersData as IncidentClusterRow[]);
      }

      if (!alertsError && !clustersError && alertsData && clustersData) {
        setIsSupabaseLive(true);
      }
    } catch (err) {
      console.warn('Supabase connection failed, using local seeded dataset:', err);
      setIsSupabaseLive(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolveIncident = (cluster: ClusterWithAlerts) => {
    setSelectedCluster(cluster);
    setCurrentView('spawning');
  };

  return (
    <div className="bg-psa-canvas text-psa-navy-dark min-h-screen flex flex-col font-sans bg-grid-pattern">
      {/* Top Header */}
      <Header
        currentView={currentView}
        onBackToAlerts={() => {
          setSelectedCluster(null);
          setCurrentView('alerts');
        }}
        totalAlertsCount={rawAlerts.length}
        totalClustersCount={clusters.length}
        isSupabaseLive={isSupabaseLive}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {currentView === 'alerts' ? (
          <AlertsClustersPage
            clusters={clusters}
            rawAlerts={rawAlerts}
            isLoading={isLoading}
            onRefresh={fetchData}
            onResolveIncident={handleResolveIncident}
          />
        ) : (
          <ChatInterface
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
