import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Lock, 
  Play, 
  RotateCcw, 
  Layers, 
  Activity, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  Check, 
  Terminal, 
  Wrench, 
  ArrowRight,
  FileText,
  MapPin,
  Clock
} from 'lucide-react';
import { ClusterWithAlerts, RawAlert } from '../types';

interface AgentSpawningPageProps {
  cluster: ClusterWithAlerts;
  onBackToAlerts: () => void;
}

export const AgentSpawningPage: React.FC<AgentSpawningPageProps> = ({
  cluster,
  onBackToAlerts,
}) => {
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);
  const [pulseCount, setPulseCount] = useState<number>(0);

  const isClusterA = cluster.cluster_id.includes('A') || cluster.cluster_id.includes('0007') || cluster.primary_location.includes('7');
  const isClusterB = cluster.cluster_id.includes('B') || cluster.cluster_id.includes('0008') || cluster.primary_location.includes('BCSS');

  // Simulated agent details
  const agentName = cluster.assigned_agent || (isClusterA ? 'Agent_1_LaneInvestigator' : 'Agent_2_BCSSInvestigator');
  const agentRole = isClusterA 
    ? 'Vehicle Kinematics, Queue Order & Actuator Pressure' 
    : 'Power Distribution, DC Busbar Thermals & Switchgear';
  const tokensUsed = isClusterA ? 1140 : 1480;
  const tokenBudget = 2000;
  const tokenPct = Math.round((tokensUsed / tokenBudget) * 100);

  // Progressive automated stage advancing
  useEffect(() => {
    setCurrentStage(1);
    setIsDispatched(false);

    const t1 = setTimeout(() => setCurrentStage(2), 1200);
    const t2 = setTimeout(() => setCurrentStage(3), 2600);
    const t3 = setTimeout(() => setCurrentStage(4), 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [cluster]);

  // Pulse ticker for live conduit animation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPulseCount((prev) => (prev + 1) % 100);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const restartSimulation = () => {
    setCurrentStage(1);
    setIsDispatched(false);
    setTimeout(() => setCurrentStage(2), 1200);
    setTimeout(() => setCurrentStage(3), 2600);
    setTimeout(() => setCurrentStage(4), 4000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* Top Breadcrumb / Return Ribbon */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToAlerts}
            className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs px-3.5 py-2 rounded-xl font-mono font-bold transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Back to Alerts & Clusters</span>
          </button>
          
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {cluster.cluster_id}
              </span>
              <h2 className="font-bold text-slate-900 text-base font-sans">
                {cluster.name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3 h-3 text-sky-600" />
              <span>Location: {cluster.primary_location}</span>
              <span>•</span>
              <span>Correlated Alerts: {cluster.alerts.length}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={restartSimulation}
            className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs px-3 py-2 rounded-xl border border-slate-300 transition-all font-mono shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
            <span>Replay Spawning</span>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-1.5 text-xs px-3 py-2 rounded-xl font-mono font-semibold transition-all border ${
              isPlaying
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-white text-slate-500 border-slate-300'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin text-sky-600' : ''}`} />
            <span>{isPlaying ? 'Live Pulse' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Progress Stage Tracker Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm font-mono text-xs space-y-2">
        <div className="flex items-center justify-between text-slate-600 font-bold">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-sky-600 animate-pulse" />
            <span>
              TRIAGE PIPELINE: {currentStage === 1 && 'Stage 1: Spatial-Temporal Noise Filtering & Topology Assessment'}
              {currentStage === 2 && 'Stage 2: Instantiating Sub-Agent Sandbox & Context Isolation'}
              {currentStage === 3 && 'Stage 3: Sub-Agent Executing MCP SCADA & PLC Diagnostic Queries'}
              {currentStage >= 4 && 'Stage 4: Synthesized Root Cause Review Docket Assembled'}
            </span>
          </div>
          <span className="text-sky-700 font-bold">
            {currentStage === 1 && '25%'}
            {currentStage === 2 && '50%'}
            {currentStage === 3 && '75%'}
            {currentStage >= 4 && '100% (COMPLETE)'}
          </span>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all duration-700 shadow-sm"
            style={{ width: `${currentStage * 25}%` }}
          />
        </div>
      </div>

      {/* STAGE 2 & 3: ANIMATED AGENT ISOLATION SANDBOX CANVAS */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden font-sans">
        
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

        {/* TOP COORDINATOR NODE */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-full max-w-md bg-white border-2 border-sky-500 rounded-2xl p-4 shadow-lg shadow-sky-500/10 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-600 text-white font-mono font-bold text-[10px] px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow">
              Topological Coordinator Node
            </div>

            <div className="flex items-start justify-between mt-1">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-sky-600 relative shadow-sm">
                  <Bot className="w-6 h-6" />
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Coordinator Dispatcher</h4>
                  <p className="text-xs text-slate-500 font-mono">
                    Assessing: {cluster.primary_location} Topology Graph
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400">Context Budget</span>
                <div className="text-xs font-bold text-sky-700">512 / 8,000 tok</div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Deterministic Noise Filter: 81.7% Saved</span>
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                1 Agent Allocated
              </span>
            </div>
          </div>

          {/* ANIMATED LASER CONDUIT PIPE */}
          <div className="w-full max-w-sm h-14 relative flex items-center justify-center my-1">
            <div className="w-0.5 h-full bg-slate-300 relative">
              {isPlaying && (
                <div 
                  className="w-2 h-7 bg-sky-500 rounded-full -left-[3px] absolute shadow-lg shadow-sky-500 animate-bounce"
                  style={{ animationDuration: '1.2s' }}
                />
              )}
            </div>

            {/* Scope Isolation Barrier */}
            <div className="absolute z-20 bg-white/95 border border-sky-300 rounded-full px-4 py-1 flex items-center space-x-2 text-[11px] font-mono shadow-md backdrop-blur">
              <Lock className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
              <span className="text-slate-700 font-medium">Context Isolation Barrier:</span>
              <span className="text-emerald-700 font-bold">100% Strict Sandbox</span>
            </div>
          </div>

          {/* ISOLATED INVESTIGATOR SUB-AGENT POD */}
          <div className="w-full max-w-xl bg-white border-2 border-sky-500/80 rounded-2xl p-5 shadow-lg relative space-y-4">
            
            {/* Containment Shield Tag */}
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold tracking-wider uppercase text-slate-700">
                  ISOLATED RUNTIME POD (PID: {isClusterA ? '8841' : '8842'})
                </span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase font-mono bg-sky-100 text-sky-800 border border-sky-200">
                {cluster.cluster_id} EXCLUSIVE
              </span>
            </div>

            {/* Sub-Agent Title */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-base">{agentName}</h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Role: {agentRole}</p>
              </div>
              <div className="p-2 bg-sky-50 rounded-xl border border-sky-200 shadow-sm text-sky-600">
                <Cpu className="w-5 h-5" />
              </div>
            </div>

            {/* Token Budget Meter */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Isolated Context Budget</span>
                </span>
                <span className="font-bold text-sky-700">
                  {tokensUsed.toLocaleString()} / {tokenBudget.toLocaleString()} tok ({tokenPct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${tokenPct}%` }}
                />
              </div>
            </div>

            {/* Real-Time Executed MCP Tools */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs space-y-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-sky-600" />
                <span>Model Context Protocol (MCP) Executions</span>
              </div>
              
              <div className="space-y-1.5 text-[11px]">
                <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-800 font-semibold">
                    {isClusterA ? 'mcp-terminal-telemetry::get_lane_queue_order(Lane-07)' : 'mcp-terminal-telemetry::get_station_electrical_metrics(BCSS-02)'}
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    200 OK (42ms)
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-800 font-semibold">
                    {isClusterA ? 'mcp-terminal-diagnostics::decode_plc_fault_code(0x7E1)' : 'mcp-terminal-diagnostics::decode_plc_fault_code(0x9B4)'}
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    200 OK (51ms)
                  </span>
                </div>
              </div>
            </div>

            {/* Anti-Pollution Guarantee */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cross-Contamination: 0%</span>
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                SANDBOX VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* STAGE 4: SYNTHESIZED HUMAN REVIEW DOCKET & ACTION RESOLUTION */}
      {currentStage >= 4 && (
        <div className="bg-white border-2 border-slate-300 rounded-2xl p-6 shadow-md space-y-5 animate-fadeIn">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 font-mono">
            <span className="text-xs font-bold px-3 py-1 rounded-lg uppercase bg-red-50 text-red-700 border border-red-200">
              CRITICAL SEVERITY • ROOT CAUSE SYNTHESIZED
            </span>
            <span className="text-xs text-slate-400 font-mono">DOCKET: DOC-{cluster.cluster_id}</span>
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 font-sans">
              Consolidated Incident Resolution Docket: {cluster.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Verified by isolated investigator {agentName} using MCP SCADA telemetry.
            </p>
          </div>

          {/* Operational Impact Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-mono text-xs">
            <span className="text-red-600 font-bold">OPERATIONAL DOWNSTREAM IMPACT: </span>
            <span className="text-slate-800">
              {isClusterA 
                ? 'Quay Crane QC-03 starvation on Berth 2; trailing AGVs (AGV-109, AGV-112) halted.' 
                : 'AGV-088 battery dropped to 11.8% SoC; alternative charger BCSS-01 operating at 100% capacity.'}
            </span>
          </div>

          {/* Verified Root Cause */}
          <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-4 space-y-1 font-mono">
            <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>AI TRIAGE VERIFIED ROOT CAUSE</span>
            </div>
            <p className="text-xs text-slate-900 leading-relaxed font-semibold">
              {isClusterA 
                ? 'Mechanical twistlock pin jam on AGV-104. Hydraulic relief valve peaked at 275 bar dead-head limit under PLC command RELEASE. State mismatch verified against CAN sensor.'
                : 'DC busbar thermal runaway on BCSS-02. Copper temperature exceeded safety trip threshold (82.4°C vs 80.0°C limit) following cooling loop differential pressure drop.'}
            </p>
          </div>

          {/* Physical Evidence Verification */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>MULTIMODAL HARDWARE EVIDENCE CHECKLIST</span>
            </div>

            <div className="space-y-2">
              {cluster.alerts.map((alert, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start space-x-3 text-xs font-mono">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <span className="text-slate-900 font-medium">{alert.message}</span>
                    <div className="text-[10px] text-slate-400">
                      Source: <span className="text-sky-700 font-bold">{alert.source}</span> • Location: {alert.location} • Timestamp: {alert.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* One-Click Action Dispatch Button */}
          <div className="pt-3 border-t border-slate-200">
            <button
              onClick={() => setIsDispatched(true)}
              disabled={isDispatched}
              className={`w-full py-3.5 px-6 rounded-xl font-mono font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md ${
                isDispatched
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20 hover:shadow-lg active:scale-[0.99]'
              }`}
            >
              {isDispatched ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>ACTION DISPATCHED & LOGGED (WORK ORDER WO-88219 • FIELD CREW EN ROUTE)</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>
                    {isClusterA 
                      ? 'AUTHORIZE FIELD ACTION: DISPATCH MOBILE MECHANICAL TEAM TO AGV-104 (LANE 7)' 
                      : 'AUTHORIZE FIELD ACTION: DISPATCH HIGH-VOLTAGE ELECTRICAL CREW TO BCSS-02'}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
