import React from 'react';
import { 
  Anchor, 
  Database, 
  Zap, 
  ShieldAlert,
  ArrowLeft,
  Activity
} from 'lucide-react';

interface HeaderProps {
  currentView: 'alerts' | 'spawning';
  onBackToAlerts?: () => void;
  totalAlertsCount: number;
  totalClustersCount: number;
  isSupabaseLive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onBackToAlerts,
  totalAlertsCount,
  totalClustersCount,
  isSupabaseLive,
}) => {
  return (
    <header className="bg-psa-navy text-white border-b border-tuas-cyan/30 px-6 py-3.5 sticky top-0 z-50 shadow-lg shadow-psa-navy/20">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
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
                TUAS SMART PORT INCIDENT DISPATCH
              </h1>
              <span className="bg-tuas-cyan/20 text-tuas-cyan border border-tuas-cyan/40 text-[10px] px-2.5 py-0.5 rounded font-mono font-bold tracking-wider">
                {currentView === 'spawning' ? 'AGENT TRIAGE RUNTIME' : 'OPERATIONAL ALERTS & CLUSTERS'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-tuas-teal animate-ping"></span>
              <span>SG::TUAS_PORT • SECTOR_A / BERTH_2 • REAL-TIME OT SCADA STREAM</span>
            </p>
          </div>
        </div>

        {/* Status Indicators & Back Button */}
        <div className="flex items-center space-x-3">
          {currentView === 'spawning' && onBackToAlerts && (
            <button
              onClick={onBackToAlerts}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-3.5 py-2 rounded-xl font-mono font-bold transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-tuas-teal" />
              <span>Back to Alerts & Clusters</span>
            </button>
          )}

          {/* Supabase Connection Status Badge */}
          <div className="flex items-center space-x-1.5 bg-black/20 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-tuas-cyan" />
            <span className="text-slate-300 font-medium">Supabase:</span>
            <span className={isSupabaseLive ? 'text-tuas-teal font-bold' : 'text-amber-400 font-bold'}>
              {isSupabaseLive ? 'Connected' : 'Fallback Sync'}
            </span>
          </div>

          {/* Active Clusters Pill */}
          <div className="flex items-center space-x-1.5 bg-psa-flame/20 border border-psa-flame/40 px-3 py-1.5 rounded-xl text-xs font-mono text-red-200 font-bold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-psa-flame opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-psa-flame"></span>
            </span>
            <span>{totalClustersCount} ACTIVE CLUSTERS</span>
          </div>

          {/* SCADA Frequency Heartbeat */}
          <div className="hidden sm:flex bg-tuas-teal/15 border border-tuas-teal/30 text-tuas-teal text-xs px-3 py-1.5 rounded-xl font-mono font-bold items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-tuas-teal" />
            <span>50Hz SCADA</span>
          </div>
        </div>
      </div>
    </header>
  );
};

