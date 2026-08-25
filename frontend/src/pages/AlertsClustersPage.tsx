import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  Search, 
  Filter, 
  ArrowRight, 
  MapPin, 
  Bot, 
  Zap, 
  Radio, 
  RefreshCw, 
  FileText, 
  Activity,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import { RawAlert, IncidentClusterRow, ClusterWithAlerts, SeverityLevel } from '../types';

interface AlertsClustersPageProps {
  clusters: IncidentClusterRow[];
  rawAlerts: RawAlert[];
  isLoading: boolean;
  onRefresh: () => void;
  onResolveIncident: (cluster: ClusterWithAlerts) => void;
}

export const AlertsClustersPage: React.FC<AlertsClustersPageProps> = ({
  clusters,
  rawAlerts,
  isLoading,
  onRefresh,
  onResolveIncident,
}) => {
  const [activeTab, setActiveTab] = useState<'clusters' | 'allAlerts'>('clusters');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClusterIds, setExpandedClusterIds] = useState<Record<string, boolean>>({});

  const toggleExpandCluster = (id: string) => {
    setExpandedClusterIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Map raw alerts to their respective clusters
  const clustersWithAlerts: ClusterWithAlerts[] = useMemo(() => {
    const alertMap = new Map<string, RawAlert>();
    rawAlerts.forEach(a => alertMap.set(a.id, a));

    return clusters.map(c => {
      const matchedAlerts: RawAlert[] = [];
      const alertIds = Array.isArray(c.raw_alert_ids) ? c.raw_alert_ids : [];
      
      alertIds.forEach(id => {
        const found = alertMap.get(id);
        if (found) {
          matchedAlerts.push(found);
        }
      });

      // Determine highest severity
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
        highestSeverity
      };
    });
  }, [clusters, rawAlerts]);

  // Unique locations for filter
  const locations = useMemo(() => {
    const set = new Set<string>();
    rawAlerts.forEach(a => {
      if (a.location) set.add(a.location);
    });
    return ['ALL', ...Array.from(set)];
  }, [rawAlerts]);

  // Filtered Clusters
  const filteredClusters = useMemo(() => {
    return clustersWithAlerts.filter(c => {
      if (selectedSeverity !== 'ALL' && c.highestSeverity !== selectedSeverity) {
        return false;
      }
      if (selectedLocation !== 'ALL' && c.primary_location !== selectedLocation && !c.alerts.some(a => a.location === selectedLocation)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCluster = c.cluster_id.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.primary_location.toLowerCase().includes(q) ||
          c.assigned_agent.toLowerCase().includes(q);
        const matchesAlert = c.alerts.some(a => 
          a.id.toLowerCase().includes(q) || 
          a.message.toLowerCase().includes(q) || 
          a.source.toLowerCase().includes(q)
        );
        return matchesCluster || matchesAlert;
      }
      return true;
    });
  }, [clustersWithAlerts, selectedSeverity, selectedLocation, searchQuery]);

  // Filtered Raw Alerts
  const filteredRawAlerts = useMemo(() => {
    return rawAlerts.filter(a => {
      if (selectedSeverity !== 'ALL' && a.severity !== selectedSeverity) {
        return false;
      }
      if (selectedLocation !== 'ALL' && a.location !== selectedLocation) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return a.id.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          (a.location ? a.location.toLowerCase().includes(q) : false) ||
          a.type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rawAlerts, selectedSeverity, selectedLocation, searchQuery]);

  const criticalCount = rawAlerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = rawAlerts.filter(a => a.severity === 'HIGH').length;

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-yellow-50 text-yellow-800 border border-yellow-200 whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-600" />
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            LOW
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      
      {/* Minimalist Top Summary Metrics Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Total SCADA Alerts:</span>
            <span className="font-bold text-slate-900 text-sm">{rawAlerts.length}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Incident Clusters:</span>
            <span className="font-bold text-sky-700 text-sm">{clusters.length}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <span className="text-red-600 font-semibold">Critical:</span>
            <span className="font-bold text-red-700 text-sm">{criticalCount}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <span className="text-amber-700 font-semibold">High:</span>
            <span className="font-bold text-amber-800 text-sm">{highCount}</span>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl transition-all shadow-sm whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Syncing...' : 'Sync Supabase'}</span>
        </button>
      </div>

      {/* Filter and View Switcher Ribbon */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Tab Switcher */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 font-mono text-xs">
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                activeTab === 'clusters'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Incident Clusters ({clusters.length})
            </button>
            <button
              onClick={() => setActiveTab('allAlerts')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                activeTab === 'allAlerts'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Raw Alerts ({rawAlerts.length})
            </button>
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex items-center space-x-2 font-mono text-xs">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 whitespace-nowrap"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
              <option value="INFO">Info Only</option>
            </select>

            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 whitespace-nowrap"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>
                  {loc === 'ALL' ? 'All Sectors' : loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Minimal Search Bar */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident title, alert ID, asset (AGV-104, BCSS-02), or fault code..."
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 font-mono"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: 1 CARD PER ROW (EXPANDED HORIZONTAL ROWS) */}
      {activeTab === 'clusters' && (
        <div className="space-y-4">
          {filteredClusters.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 font-mono space-y-2">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">No incident clusters matched your filter criteria.</p>
              <p className="text-xs text-slate-400">Try resetting the search or filter settings.</p>
            </div>
          ) : (
            filteredClusters.map((cluster) => {
              const isExpanded = expandedClusterIds[cluster.cluster_id];
              const isCritical = cluster.highestSeverity === 'CRITICAL';

              return (
                <div
                  key={cluster.cluster_id}
                  className={`bg-white border rounded-2xl p-5 md:p-6 shadow-sm transition-all duration-200 hover:border-sky-400 w-full space-y-4 ${
                    isCritical ? 'border-red-200/90' : 'border-slate-200'
                  }`}
                >
                  {/* Single Expanded Row Layout */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 w-full">
                    
                    {/* Left: Metadata, Title, Location, Agent */}
                    <div className="space-y-2.5 flex-[1.4] min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {getSeverityBadge(cluster.highestSeverity)}
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap flex-shrink-0">
                          {cluster.cluster_id}
                        </span>
                        <span className="text-xs font-mono text-slate-600 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-sky-600" />
                          <span>{cluster.primary_location}</span>
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base md:text-lg font-sans leading-snug">
                        {cluster.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-slate-500">
                        <span className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-sky-600" />
                          <span>{cluster.assigned_agent}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="whitespace-nowrap text-slate-600 font-medium flex-shrink-0">
                          {cluster.alerts.length} correlated alerts
                        </span>
                      </div>
                    </div>

                    {/* Middle: Telemetry Highlight Preview */}
                    <div className="hidden lg:flex flex-col space-y-1.5 flex-1 min-w-[280px] text-xs font-mono text-slate-600 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Telemetry Highlight:</span>
                      <div className="truncate text-slate-800 font-medium text-xs">
                        {cluster.alerts.length > 0 
                          ? `${cluster.alerts[0].id}: ${cluster.alerts[0].message}`
                          : 'Telemetry nominal'}
                      </div>
                      {cluster.alerts.length > 1 && (
                        <div className="truncate text-slate-500 text-[11px]">
                          + {cluster.alerts[1].id} ({cluster.alerts[1].type})
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {cluster.alerts.length > 0 && (
                        <button
                          onClick={() => toggleExpandCluster(cluster.cluster_id)}
                          className="flex items-center space-x-1.5 text-xs font-mono text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                        >
                          <span>{isExpanded ? 'Hide Alerts' : `View ${cluster.alerts.length} Alerts`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => onResolveIncident(cluster)}
                        className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white font-mono font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-sky-600/20 hover:shadow-lg transition-all active:scale-95 whitespace-nowrap flex-shrink-0"
                      >
                        <Zap className="w-4 h-4 animate-pulse" />
                        <span>RESOLVE INCIDENT</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Alerts Drawer */}
                  {isExpanded && cluster.alerts.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                      <div className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wide">
                        Correlated Supabase Raw Alerts:
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {cluster.alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900">{alert.id}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-sky-700 font-semibold">{alert.source}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {alert.type}
                              </span>
                            </div>
                            <p className="text-slate-700 text-[11px] leading-relaxed">
                              {alert.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: ALL RAW ALERTS STREAM (MINIMALIST TABLE) */}
      {activeTab === 'allAlerts' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-slate-900">
              RAW SCADA TELEMETRY STREAM ({filteredRawAlerts.length} ALERTS)
            </span>
            <span className="text-slate-500">Live Supabase Database Query</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">ALERT ID</th>
                  <th className="py-3 px-4 font-bold">TIMESTAMP</th>
                  <th className="py-3 px-4 font-bold">SOURCE ASSET</th>
                  <th className="py-3 px-4 font-bold">SECTOR</th>
                  <th className="py-3 px-4 font-bold">FAULT TYPE</th>
                  <th className="py-3 px-4 font-bold">SEVERITY</th>
                  <th className="py-3 px-4 font-bold">MESSAGE SUMMARY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRawAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-sky-700">{alert.id}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">{alert.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{alert.source}</td>
                    <td className="py-3 px-4 text-slate-600">{alert.location || '—'}</td>
                    <td className="py-3 px-4 text-sky-800 font-semibold">{alert.type}</td>
                    <td className="py-3 px-4">{getSeverityBadge(alert.severity)}</td>
                    <td className="py-3 px-4 text-slate-700 text-xs max-w-md leading-relaxed">{alert.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
