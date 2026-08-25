import React from 'react';
import { 
  Anchor, 
  Database, 
  Zap, 
  ShieldAlert,
  ArrowLeft
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
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center space-x-3.5">
          <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl flex items-center justify-center shadow-sm">
            <Anchor className="w-6 h-6 text-sky-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="font-bold text-base md:text-lg text-slate-900 tracking-wide font-sans">
                PSA TUAS INCIDENT DISPATCH CONSOLE
              </h1>
              <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] px-2.5 py-0.5 rounded font-mono font-bold">
                {currentView === 'spawning' ? 'AGENT TRIAGE RUNTIME' : 'OPERATIONAL ALERTS & CLUSTERS'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              TUAS SECTOR A & BERTH 2 • REAL-TIME OT SCADA STREAM
            </p>
          </div>
        </div>

        {/* Status Indicators & Back Button */}
        <div className="flex items-center space-x-3">
          {currentView === 'spawning' && onBackToAlerts && (
            <button
              onClick={onBackToAlerts}
              className="flex items-center space-x-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs px-3.5 py-2 rounded-xl font-mono font-bold transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Back to Alerts & Clusters</span>
            </button>
          )}

          {/* Supabase Connection Status Badge */}
          <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-slate-600 font-medium">Supabase:</span>
            <span className={isSupabaseLive ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
              {isSupabaseLive ? 'Connected' : 'Fallback Sync'}
            </span>
          </div>

          {/* Active Clusters Pill */}
          <div className="flex items-center space-x-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-mono text-red-700 font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
            </span>
            <span>{totalClustersCount} INCIDENT CLUSTERS</span>
          </div>

          {/* SCADA Frequency Heartbeat */}
          <div className="hidden sm:flex bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-mono font-semibold items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>50Hz SCADA</span>
          </div>
        </div>
      </div>
    </header>
  );
};
