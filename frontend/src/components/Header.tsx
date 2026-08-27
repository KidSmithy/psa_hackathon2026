import React from 'react';
import { 
  Anchor, 
  Database, 
  Zap, 
  ShieldAlert,
  ArrowLeft,
  Activity,
  Compass,
  Clock,
  Layers
} from 'lucide-react';

export type MainViewType = 'yardMap' | 'timeRibbon' | 'alerts' | 'spawning';

interface HeaderProps {
  currentView: MainViewType;
  onChangeView: (view: MainViewType) => void;
  onBackToAlerts?: () => void;
  totalAlertsCount: number;
  totalClustersCount: number;
  isSupabaseLive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onChangeView,
  onBackToAlerts,
  totalAlertsCount,
  totalClustersCount,
  isSupabaseLive,
}) => {
  return (
    <header className="bg-psa-navy text-white border-b border-tuas-cyan/30 px-4 md:px-6 py-3 sticky top-0 z-50 shadow-lg shadow-psa-navy/20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Brand Identity & Header Left */}
        <div className="flex items-center space-x-3.5">
          <div className="bg-white/10 border border-tuas-cyan/40 p-2 rounded-xl flex items-center justify-center shadow-inner">
            <Anchor className="w-6 h-6 text-tuas-teal animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-tuas-teal text-psa-navy tracking-wider">
                PSA
              </span>
              <h1 className="font-black text-base md:text-lg text-white tracking-wide font-sans">
                TUAS SMART PORT OPERATIONS
              </h1>
              <span className="bg-tuas-cyan/20 text-tuas-cyan border border-tuas-cyan/40 text-[10px] px-2.5 py-0.5 rounded font-mono font-bold tracking-wider hidden sm:inline-block">
                {currentView === 'spawning' ? 'AGENT TRIAGE RUNTIME' : 'MULTI-VIEW DISPATCH PORTAL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-tuas-teal animate-ping"></span>
              <span>SG::TUAS_PORT • SECTOR_A / BERTH_2 • LIVE SUPABASE TELEMETRY</span>
            </p>
          </div>
        </div>

        {/* 3 Dedicated Page Navigation Switcher Tabs */}
        {currentView !== 'spawning' ? (
          <nav className="flex items-center bg-black/40 p-1 rounded-xl border border-tuas-cyan/30 font-mono text-xs shadow-inner">
            <button
              onClick={() => onChangeView('yardMap')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                currentView === 'yardMap'
                  ? 'bg-gradient-to-r from-tuas-teal to-tuas-cyan text-psa-navy shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${currentView === 'yardMap' ? 'text-psa-navy' : 'text-tuas-teal'}`} />
              <span>1. AGV Yard Map</span>
            </button>

            <button
              onClick={() => onChangeView('timeRibbon')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                currentView === 'timeRibbon'
                  ? 'bg-gradient-to-r from-tuas-teal to-tuas-cyan text-psa-navy shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${currentView === 'timeRibbon' ? 'text-psa-navy' : 'text-tuas-teal'}`} />
              <span>2. Time Ribbon</span>
            </button>

            <button
              onClick={() => onChangeView('alerts')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                currentView === 'alerts'
                  ? 'bg-gradient-to-r from-tuas-teal to-tuas-cyan text-psa-navy shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${currentView === 'alerts' ? 'text-psa-navy' : 'text-tuas-teal'}`} />
              <span>3. Incident Queue</span>
            </button>
          </nav>
        ) : (
          onBackToAlerts && (
            <button
              onClick={onBackToAlerts}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-4 py-2 rounded-xl font-mono font-bold transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-tuas-teal" />
              <span>Back to Dispatch Dashboard</span>
            </button>
          )
        )}

        {/* Status Indicators */}
        <div className="flex items-center space-x-2.5">
          {/* Supabase Status */}
          <div className="flex items-center space-x-1.5 bg-black/30 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-tuas-cyan" />
            <span className="text-slate-300 text-[11px]">DB:</span>
            <span className={isSupabaseLive ? 'text-tuas-teal font-bold' : 'text-amber-400 font-bold'}>
              {isSupabaseLive ? 'Supabase Live' : 'Fallback'}
            </span>
          </div>

          {/* Active Clusters Pill */}
          <div className="flex items-center space-x-1.5 bg-psa-flame/20 border border-psa-flame/40 px-3 py-1.5 rounded-xl text-xs font-mono text-red-200 font-bold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-psa-flame opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-psa-flame"></span>
            </span>
            <span>{totalClustersCount} INCIDENTS</span>
          </div>
        </div>
      </div>
    </header>
  );
};
