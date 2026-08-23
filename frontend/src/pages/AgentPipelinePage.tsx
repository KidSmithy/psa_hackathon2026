import React, { useState } from 'react';
import { IncidentCluster, Alert } from '../types';
import { AgentIsolationVisualizer } from '../components/AgentIsolationVisualizer';
import { 
  Filter, 
  ShieldCheck, 
  Layers, 
  Bot, 
  ArrowRight, 
  Cpu, 
  Sparkles,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface AgentPipelinePageProps {
  clusters: IncidentCluster[];
  rawAlerts: Alert[];
  onNavigateToTelemetry: () => void;
  onNavigateToDocket: () => void;
}

export const AgentPipelinePage: React.FC<AgentPipelinePageProps> = ({
  clusters,
  rawAlerts,
  onNavigateToTelemetry,
  onNavigateToDocket,
}) => {
  const [filterView, setFilterView] = useState<'all' | 'filtered' | 'dispatched'>('all');

  const filteredNoise = rawAlerts.filter((a) => a.isFilteredNoise);
  const dispatchedAlerts = rawAlerts.filter((a) => !a.isFilteredNoise);
  const tokenSavingsPct = Math.round((filteredNoise.length / rawAlerts.length) * 100);

  const displayedAlerts =
    filterView === 'filtered'
      ? filteredNoise
      : filterView === 'dispatched'
      ? dispatchedAlerts
      : rawAlerts;

  return (
    <div className="space-y-8">
      {/* Top Banner & KPI Callouts */}
      <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-maritime-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-50 dark:bg-port-cyan/10 border border-sky-200 dark:border-port-cyan/30 rounded-lg text-sky-600 dark:text-port-cyan">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide font-sans">
                MULTI-STAGE TRIAGE & AGENT ISOLATION PIPELINE
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Stage 1 Deterministic Pre-Filtering $\rightarrow$ Stage 2 Coordinator Delegation & Context Sandboxing
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onNavigateToTelemetry}
              className="bg-slate-100 dark:bg-maritime-surface hover:bg-slate-200 dark:hover:bg-maritime-border text-sky-700 dark:text-port-cyan border border-slate-300 dark:border-port-cyan/40 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition-colors shadow-sm"
            >
              <span>Next: Stage 3 MCP Evidence</span>
            </button>
            <button
              onClick={onNavigateToDocket}
              className="bg-sky-600 hover:bg-sky-700 dark:bg-port-cyan dark:hover:bg-port-cyan-glow text-white dark:text-abyss text-xs px-4 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-colors shadow-md"
            >
              <span>View Synthesized Docket</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3 Pipeline Principles KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 dark:bg-abyss/80 border border-slate-200 dark:border-maritime-border rounded-xl p-4 font-mono shadow-sm">
            <div className="flex items-center space-x-2 text-emerald-700 dark:text-nominal-emerald text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>STAGE 1: NOISE IMMUNITY</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-sans">
              {tokenSavingsPct}% Token Reduction
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
              Deterministic spatial-temporal correlation collapses {rawAlerts.length} raw alarms into {clusters.length} clusters with zero LLM overhead.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-abyss/80 border border-slate-200 dark:border-maritime-border rounded-xl p-4 font-mono shadow-sm">
            <div className="flex items-center space-x-2 text-sky-700 dark:text-port-cyan text-xs font-bold">
              <Lock className="w-4 h-4" />
              <span>STAGE 2: CONTEXT ISOLATION</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-sans">
              0% Cross-Contamination
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
              Investigator sub-agents run in isolated sandboxes with strict token budgets (2,000 max/agent).
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-abyss/80 border border-slate-200 dark:border-maritime-border rounded-xl p-4 font-mono shadow-sm">
            <div className="flex items-center space-x-2 text-blue-700 dark:text-port-blue text-xs font-bold">
              <Cpu className="w-4 h-4" />
              <span>BLAST RADIUS CONTAINMENT</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-sans">
              Isolated Execution
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
              A complex diagnosis in Lane 7 has zero risk of stalling charging station investigation in Sector A.
            </p>
          </div>
        </div>
      </div>

      {/* Stage 2 Live Animated Visualizer Section */}
      <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-sky-600 dark:text-port-cyan" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-wide font-sans">
              Stage 2: Live Agent Instantiation & Scope Isolation Visualizer
            </h3>
          </div>
          <span className="text-xs font-mono bg-emerald-50 dark:bg-nominal-emerald/10 text-emerald-700 dark:text-nominal-emerald px-3 py-1 rounded-full border border-emerald-200 dark:border-nominal-emerald/30 font-semibold">
            LIVE DYNAMIC PULSE
          </span>
        </div>

        {/* Embedded Interactive Animated Component */}
        <AgentIsolationVisualizer />
      </div>

      {/* Stage 1: Deterministic Filtering & Alert Ingestion Breakdown */}
      <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-sky-600 dark:text-port-cyan" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base font-sans">
                Stage 1: Deterministic Pre-Filtering Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Raw industrial sensor telemetry stream vs. deterministically dropped baseline noise
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-abyss p-1 rounded-lg border border-slate-200 dark:border-maritime-border text-xs font-mono shadow-inner">
            <button
              onClick={() => setFilterView('all')}
              className={`px-3 py-1.5 rounded font-medium ${
                filterView === 'all'
                  ? 'bg-sky-600 text-white dark:bg-port-cyan/20 dark:text-port-cyan dark:border dark:border-port-cyan/40 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Raw Stream ({rawAlerts.length})
            </button>
            <button
              onClick={() => setFilterView('dispatched')}
              className={`px-3 py-1.5 rounded font-medium ${
                filterView === 'dispatched'
                  ? 'bg-red-600 text-white dark:bg-hazard-red/20 dark:text-hazard-red dark:border dark:border-hazard-red/40 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Dispatched ({dispatchedAlerts.length})
            </button>
            <button
              onClick={() => setFilterView('filtered')}
              className={`px-3 py-1.5 rounded font-medium ${
                filterView === 'filtered'
                  ? 'bg-emerald-600 text-white dark:bg-nominal-emerald/20 dark:text-nominal-emerald dark:border dark:border-nominal-emerald/40 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Zero-Token Noise ({filteredNoise.length})
            </button>
          </div>
        </div>

        {/* Filtered Alerts Table / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
          {displayedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex items-start justify-between transition-all ${
                alert.isFilteredNoise
                  ? 'bg-slate-50 dark:bg-abyss/40 border-slate-200 dark:border-maritime-border/50 text-slate-500'
                  : 'bg-slate-50/80 dark:bg-abyss/90 border-slate-300 dark:border-maritime-border text-slate-800 dark:text-slate-200 shadow-sm'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-500">{alert.timestamp}</span>
                  <span className="text-[11px] bg-slate-200/80 dark:bg-maritime-surface px-2 py-0.5 rounded text-sky-800 dark:text-port-cyan border border-slate-300 dark:border-maritime-border font-semibold">
                    {alert.source}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    {alert.type}
                  </span>
                </div>
                <div className="text-xs font-sans text-slate-900 dark:text-white font-medium">{alert.message}</div>
              </div>

              {alert.isFilteredNoise ? (
                <span className="text-[10px] bg-emerald-50 dark:bg-nominal-emerald/10 text-emerald-700 dark:text-nominal-emerald border border-emerald-200 dark:border-nominal-emerald/30 px-2 py-1 rounded font-bold uppercase">
                  DROPPED (0 TOKENS)
                </span>
              ) : (
                <span className="text-[10px] bg-red-50 dark:bg-hazard-red/20 text-red-700 dark:text-hazard-red border border-red-200 dark:border-hazard-red/40 px-2 py-1 rounded font-bold uppercase">
                  CLUSTERED $\rightarrow$ AGENT
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
