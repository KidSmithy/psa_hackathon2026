import React, { useState } from 'react';
import { Header } from './components/Header';
import { HumanDocketPage } from './pages/HumanDocketPage';
import { ChatInterface } from './components/ChatInterface';
import {
  INITIAL_CLUSTERS,
  RAW_ALERTS,
  INITIAL_DOCKETS,
} from './data/mockData';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'docket' | 'chat'>('docket');
  const [clusters, setClusters] = useState(INITIAL_CLUSTERS);
  const [selectedClusterId, setSelectedClusterId] = useState('Cluster A');
  const [rawAlerts, setRawAlerts] = useState(RAW_ALERTS);
  const [dockets, setDockets] = useState(INITIAL_DOCKETS);

  const handleRefresh = () => {
    console.log('Simulating SCADA / MCP Sync...');
  };

  const handleDispatchAction = (docketId: string, actionText: string) => {
    console.log(`Action authorized and dispatched for ${docketId}: ${actionText}`);
  };

  const toggleViewMode = () => {
    setViewMode(prev => (prev === 'docket' ? 'chat' : 'docket'));
  };

  const noiseFilteredCount = rawAlerts.filter((a) => a.isFilteredNoise).length;
  const tokenSavingsPct = Math.round((noiseFilteredCount / rawAlerts.length) * 100);

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans">
      {/* Top Header */}
      <Header
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        activeIncidentsCount={clusters.filter(c => c.status === 'READY_FOR_REVIEW').length}
        totalFilteredAlerts={noiseFilteredCount}
        tokenSavingsPct={tokenSavingsPct}
        onRefresh={handleRefresh}
      />

      {/* Main Container View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        {viewMode === 'docket' ? (
          <HumanDocketPage
            dockets={dockets}
            clusters={clusters}
            selectedClusterId={selectedClusterId}
            onSelectCluster={setSelectedClusterId}
            onDispatchAction={handleDispatchAction}
            onNavigateToChat={() => setViewMode('chat')}
          />
        ) : (
          <ChatInterface onBackToDocket={() => setViewMode('docket')} />
        )}
      </main>
    </div>
  );
};

export default App;
