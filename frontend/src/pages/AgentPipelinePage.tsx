import React, { useState } from 'react';
import { IncidentCluster, Alert } from '../types';
import { 
  Workflow, 
  Layers, 
  Cpu, 
  Zap, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  Bot
} from 'lucide-react';

interface AgentPipelinePageProps {
  clusters: IncidentCluster[];
  rawAlerts: Alert[];
  onSelectCluster: (clusterId: string) => void;
}

export const AgentPipelinePage: React.FC<AgentPipelinePageProps> = ({
  clusters,
  rawAlerts,
  onSelectCluster,
}) => {
  const [selectedStage, setSelectedStage] = useState<number>(2);

  const noiseFilteredCount = rawAlerts.filter(a => a.isFilteredNoise).length;
  const tokenSavings = Math.round((noiseFilteredCount / rawAlerts.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-600">
            <Workflow className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              MULTI-AGENT DETERMINISTIC TRIAGE ARCHITECTURE
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              3-Stage Noise Filtering $\rightarrow$ Sub-Agent Scope Isolation $\rightarrow$ MCP Tool Grounding
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200 font-mono text-xs">
          <span className="text-slate-500 px-2">Zero-Token Drop:</span>
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
            {tokenSavings}% Saved
          </span>
        </div>
      </div>

      {/* Cluster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 hover:border-sky-300 transition-colors"
          >
            <div className="flex items-center justify-between font-mono">
              <span className="text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 rounded uppercase">
                {cluster.id}
              </span>
              <span className="text-xs text-red-600 font-bold">{cluster.severity}</span>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">{cluster.name}</h3>
              <p className="text-xs text-slate-500 font-mono">{cluster.location}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Sub-Agent:</span>
                <span className="font-bold text-sky-700">{cluster.assignedAgent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Isolated Budget:</span>
                <span className="font-bold text-slate-700">
                  {cluster.assignedAgent.contextTokens} / {cluster.assignedAgent.maxTokens} tok
                </span>
              </div>
            </div>

            <button
              onClick={() => onSelectCluster(cluster.id)}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-mono font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
            >
              <span>Inspect Review Docket</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
