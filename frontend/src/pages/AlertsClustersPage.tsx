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
  Clock,
  Compass
} from 'lucide-react';
import { RawAlert, IncidentClusterRow, ClusterWithAlerts, SeverityLevel, alertText } from '../types';

interface AlertsClustersPageProps {
  clusters: IncidentClusterRow[];
  rawAlerts: RawAlert[];
  isLoading: boolean;
  onRefresh: () => void;
  onResolveIncident: (cluster: ClusterWithAlerts) => void;
  selectedClusterId?: string | null;
  onClearSelectedCluster?: () => void;
}

export const AlertsClustersPage: React.FC<AlertsClustersPageProps> = ({
  clusters,
  rawAlerts,
  isLoading,
  onRefresh,
  onResolveIncident,
  selectedClusterId,
  onClearSelectedCluster,
}) => {
  const [activeTab, setActiveTab] = useState<'clusters' | 'allAlerts'>('clusters');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClusterIds, setExpandedClusterIds] = useState<Record<string, boolean>>(() => {
    if (selectedClusterId) {
      return { [selectedClusterId]: true };
    }
    return {};
  });

  // Auto-expand and switch to clusters tab if selectedClusterId changes
  React.useEffect(() => {
    if (selectedClusterId) {
      setActiveTab('clusters');
      setExpandedClusterIds(prev => ({ ...prev, [selectedClusterId]: true }));
    }
  }, [selectedClusterId]);

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
          alertText(a).toLowerCase().includes(q) || 
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
          alertText(a).toLowerCase().includes(q) ||
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-psa-flame-bg text-psa-flame border border-psa-flame-border whitespace-nowrap flex-shrink-0 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-psa-flame animate-ping" />
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-psa-navy-light text-psa-muted border border-psa-border whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-psa-muted" />
            LOW
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-tuas-cyan-light text-tuas-cyan-dark border border-tuas-cyan-border whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-tuas-cyan" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-full mx-auto pb-12 font-sans">
      
      {/* High-Contrast Top Summary Metrics Bar */}
      <div className="bg-psa-navy text-white border border-tuas-cyan/30 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2">
            <span className="text-slate-300 font-medium">Total SCADA Alerts:</span>
            <span className="font-black text-white text-base bg-white/10 px-2 py-0.5 rounded">{rawAlerts.length}</span>
          </div>
          <div className="h-4 w-px bg-white/20 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <span className="text-tuas-cyan font-medium">Active Clusters:</span>
            <span className="font-black text-tuas-teal text-base bg-tuas-teal/10 px-2 py-0.5 rounded">{clusters.length}</span>
          </div>
          <div className="h-4 w-px bg-white/20 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <span className="text-red-300 font-bold">Critical:</span>
            <span className="font-black text-red-200 text-base bg-red-500/20 px-2 py-0.5 rounded border border-red-400/40">{criticalCount}</span>
          </div>
          <div className="h-4 w-px bg-white/20 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <span className="text-amber-300 font-bold">High:</span>
            <span className="font-black text-amber-200 text-base bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/40">{highCount}</span>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-1.5 text-white bg-white/10 hover:bg-white/20 border border-tuas-cyan/40 px-3.5 py-1.5 rounded-xl transition-all shadow-sm whitespace-nowrap active:scale-95 font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-tuas-teal ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Syncing...' : 'Sync Database'}</span>
        </button>
      </div>

      {/* Filter and View Switcher Ribbon */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Tab Switcher */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-300 font-mono text-xs">
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-4 py-2 rounded-lg font-black transition-all whitespace-nowrap ${
                activeTab === 'clusters'
                  ? 'bg-psa-navy text-white shadow-md'
                  : 'text-slate-600 hover:text-psa-navy hover:bg-slate-200'
              }`}
            >
              Incident Clusters ({clusters.length})
            </button>
            <button
              onClick={() => setActiveTab('allAlerts')}
              className={`px-4 py-2 rounded-lg font-black transition-all whitespace-nowrap ${
                activeTab === 'allAlerts'
                  ? 'bg-psa-navy text-white shadow-md'
                  : 'text-slate-600 hover:text-psa-navy hover:bg-slate-200'
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
              className="bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-psa-navy-dark focus:outline-none focus:ring-2 focus:ring-tuas-cyan whitespace-nowrap"
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
              className="bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-psa-navy-dark focus:outline-none focus:ring-2 focus:ring-tuas-cyan whitespace-nowrap"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>
                  {loc === 'ALL' ? 'All Sectors' : loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center space-x-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-tuas-cyan focus-within:border-tuas-cyan transition-all">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident title, alert ID, asset (AGV-104, BCSS-02), or fault code..."
            className="flex-1 bg-transparent text-xs text-psa-navy-dark placeholder:text-slate-400 focus:outline-none font-sans font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-500 hover:text-slate-800 font-mono font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: 1 CARD PER ROW (EXPANDED HORIZONTAL ROWS) */}
      {activeTab === 'clusters' && (
        <div className="space-y-4">
          {/* Focused Incident Notice if arriving from Map */}
          {selectedClusterId && (
            <div className="bg-sky-50 border-2 border-sky-400 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-sm">
              <div className="flex items-center space-x-2.5 text-sky-950 font-bold">
                <Compass className="w-4 h-4 text-sky-600 animate-spin-slow" />
                <span>Focused from AGV Yard Map: <strong className="bg-sky-200/80 text-sky-950 px-2 py-0.5 rounded border border-sky-300">{selectedClusterId}</strong></span>
              </div>
              {onClearSelectedCluster && (
                <button
                  onClick={onClearSelectedCluster}
                  className="text-[11px] font-bold text-sky-800 hover:text-sky-950 bg-sky-100 hover:bg-sky-200 px-3 py-1 rounded-lg border border-sky-300 transition-all active:scale-95"
                >
                  Show All Incidents / Reset Focus
                </button>
              )}
            </div>
          )}

          {filteredClusters.length === 0 ? (
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-12 text-center text-slate-500 font-mono space-y-2">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-bold text-psa-navy-dark">No incident clusters matched your filter criteria.</p>
              <p className="text-xs text-slate-500">Try resetting the search or filter settings.</p>
            </div>
          ) : (
            filteredClusters.map((cluster) => {
              const isExpanded = expandedClusterIds[cluster.cluster_id];
              const isFocused = cluster.cluster_id === selectedClusterId;

              return (
                <div
                  key={cluster.cluster_id}
                  className={`bg-white border-2 rounded-2xl p-5 md:p-6 shadow-md transition-all duration-200 hover:shadow-xl w-full space-y-4 ${
                    isFocused
                      ? 'ring-4 ring-sky-400 border-sky-500 shadow-xl'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Single Expanded Row Layout */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 w-full">
                    
                    {/* Left: Metadata, Title, Location, Agent */}
                    <div className="space-y-2.5 flex-[1.4] min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {getSeverityBadge(cluster.highestSeverity)}
                        <span className="font-mono font-black text-xs bg-psa-navy text-white px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap flex-shrink-0">
                          {cluster.cluster_id}
                        </span>
                        {isFocused && (
                          <span className="font-mono font-black text-[10px] bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-lg">
                            FOCUSED FROM MAP
                          </span>
                        )}
                        <span className="text-xs font-mono text-psa-navy-dark font-bold flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300 whitespace-nowrap flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-tuas-cyan-dark" />
                          <span>{cluster.primary_location}</span>
                        </span>
                      </div>

                      <h3 className="font-black text-psa-navy-dark text-base md:text-lg font-sans leading-snug">
                        {cluster.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                        <span className="flex items-center gap-1.5 text-psa-navy-dark bg-tuas-teal/20 px-2.5 py-1 rounded-lg border border-tuas-teal-border whitespace-nowrap flex-shrink-0 font-bold">
                          <Bot className="w-3.5 h-3.5 text-tuas-teal-dark" />
                          <span>{cluster.assigned_agent}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="whitespace-nowrap text-slate-600 font-bold flex-shrink-0">
                          {cluster.alerts.length} correlated alerts
                        </span>
                      </div>
                    </div>

                    {/* Middle: Telemetry Highlight Preview */}
                    <div className="hidden lg:flex flex-col space-y-1.5 flex-1 min-w-[280px] text-xs font-mono bg-[#EBF3FA] p-3.5 rounded-xl border border-[#BFD5EA]">
                      <span className="text-[10px] text-psa-navy font-bold uppercase tracking-wider">Telemetry Highlight:</span>
                      <div className="truncate text-psa-navy-dark font-bold text-xs">
                        {cluster.alerts.length > 0 
                          ? `${cluster.alerts[0].id}: ${alertText(cluster.alerts[0])}`
                          : 'Telemetry nominal'}
                      </div>
                      {cluster.alerts.length > 1 && (
                        <div className="truncate text-slate-600 font-medium text-[11px]">
                          + {cluster.alerts[1].id} ({cluster.alerts[1].type})
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {cluster.alerts.length > 0 && (
                        <button
                          onClick={() => toggleExpandCluster(cluster.cluster_id)}
                          className="flex items-center space-x-1.5 text-xs font-mono font-bold text-psa-navy-dark hover:text-white hover:bg-psa-navy bg-slate-100 border border-slate-300 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap shadow-sm"
                        >
                          <span>{isExpanded ? 'Hide Alerts' : `View ${cluster.alerts.length} Alerts`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => onResolveIncident(cluster)}
                        className="flex items-center space-x-2 bg-gradient-to-r from-psa-navy to-tuas-cyan-dark hover:from-tuas-cyan-dark hover:to-tuas-teal text-white font-mono font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:shadow-glow-cyan transition-all active:scale-95 whitespace-nowrap flex-shrink-0"
                      >
                        <Zap className="w-4 h-4 text-tuas-teal animate-pulse" />
                        <span>RESOLVE INCIDENT</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Alerts Drawer */}
                  {isExpanded && cluster.alerts.length > 0 && (
                    <div className="pt-4 border-t-2 border-slate-200 space-y-2.5 animate-fadeIn">
                      <div className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wide">
                        Correlated Supabase Raw Alerts:
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {cluster.alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono space-y-1 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-psa-navy-dark">{alert.id}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-tuas-cyan-dark font-bold">{alert.source}</span>
                              </div>
                              <span className="text-[10px] text-slate-600 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">
                                {alert.type}
                              </span>
                            </div>
                            <p className="text-slate-800 text-[11px] leading-relaxed">
                              {alertText(alert)}
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
        <div className="bg-white border border-psa-border rounded-2xl shadow-cyber-card overflow-hidden">
          <div className="px-6 py-3.5 border-b border-psa-border bg-psa-canvas/80 flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-psa-navy-dark">
              RAW SCADA TELEMETRY STREAM ({filteredRawAlerts.length} ALERTS)
            </span>
            <span className="text-psa-muted">Live Supabase Database Query</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-psa-navy-light text-psa-navy-dark border-b border-psa-border">
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
              <tbody className="divide-y divide-psa-border/60 text-psa-navy-dark">
                {filteredRawAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-psa-canvas transition-colors">
                    <td className="py-3 px-4 font-bold text-tuas-cyan-dark">{alert.id}</td>
                    <td className="py-3 px-4 text-psa-muted text-[11px] whitespace-nowrap">{alert.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-psa-navy-dark">{alert.source}</td>
                    <td className="py-3 px-4 text-psa-muted">{alert.location || '—'}</td>
                    <td className="py-3 px-4 text-tuas-teal-dark font-semibold">{alert.type}</td>
                    <td className="py-3 px-4">{getSeverityBadge(alert.severity)}</td>
                    <td className="py-3 px-4 text-psa-navy-dark text-xs max-w-md leading-relaxed">{alertText(alert)}</td>
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
