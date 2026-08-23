import React from 'react';
import { 
  Anchor, 
  Cpu, 
  Zap, 
  Printer,
  Sparkles,
  ArrowLeft,
  Bot
} from 'lucide-react';

interface HeaderProps {
  viewMode: 'docket' | 'chat';
  onToggleViewMode: () => void;
  activeIncidentsCount: number;
  totalFilteredAlerts: number;
  tokenSavingsPct: number;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onToggleViewMode,
  activeIncidentsCount,
  totalFilteredAlerts,
  tokenSavingsPct,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Console Title */}
        <div className="flex items-center space-x-3">
          <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl flex items-center justify-center shadow-sm">
            <Anchor className="w-6 h-6 text-sky-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="font-bold text-lg text-slate-900 tracking-wide font-sans">
                PSA TERMINAL INCIDENT REVIEW DOCKET
              </h1>
              <span className="bg-sky-100 text-sky-700 border border-sky-200 text-[10px] px-2.5 py-0.5 rounded font-mono font-bold">
                {viewMode === 'chat' ? 'AGENT COPILOT CHAT' : 'OPERATIONAL DISPATCH CONSOLE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              TUAS SECTOR A & BERTH 2 • MULTI-AGENT ROOT CAUSE EVIDENCE TRIAGE
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center space-x-3">
          {/* Main Mode Toggle Button */}
          {viewMode === 'docket' ? (
            <button
              onClick={onToggleViewMode}
              className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-sky-600/20 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Test Agent Spawning</span>
            </button>
          ) : (
            <button
              onClick={onToggleViewMode}
              className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Back to Review Docket</span>
            </button>
          )}

          {/* Print / Export Docket (in docket view) */}
          {viewMode === 'docket' && (
            <button
              onClick={() => window.print()}
              className="hidden sm:flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-mono font-medium text-slate-700 transition-colors shadow-sm"
              title="Print Review Docket"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
          )}

          <div className="hidden lg:flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-slate-500">Zero-Token: </span>
            <span className="text-sky-700 font-bold">{tokenSavingsPct}% saved</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-red-50 border border-red-200 px-3 py-2 rounded-xl text-xs font-mono text-red-600 font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
            </span>
            <span>{activeIncidentsCount} PENDING</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-xl font-mono font-semibold flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>50Hz SCADA</span>
          </div>
        </div>
      </div>
    </header>
  );
};
