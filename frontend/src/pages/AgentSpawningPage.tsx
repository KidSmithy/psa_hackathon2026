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
      <div className="bg-white border border-psa-border rounded-2xl p-4 shadow-cyber-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToAlerts}
            className="flex items-center space-x-2 bg-psa-canvas hover:bg-psa-navy-light border border-psa-border hover:border-tuas-cyan text-psa-navy-dark text-xs px-3.5 py-2 rounded-xl font-mono font-bold transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-psa-muted" />
            <span>Back to Alerts & Clusters</span>
          </button>
          
          <div className="h-6 w-px bg-psa-border hidden sm:block" />

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-tuas-cyan-dark bg-tuas-cyan-light px-2 py-0.5 rounded border border-tuas-cyan-border">
                {cluster.cluster_id}
              </span>
              <h2 className="font-bold text-psa-navy-dark text-base font-sans">
                {cluster.name}
              </h2>
            </div>
            <p className="text-xs text-psa-muted font-mono flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3 h-3 text-tuas-teal-dark" />
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
            className="flex items-center space-x-1.5 bg-white hover:bg-psa-navy-light text-psa-navy-dark text-xs px-3 py-2 rounded-xl border border-psa-border hover:border-tuas-cyan transition-all font-mono shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-tuas-cyan-dark" />
            <span>Replay Spawning</span>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-1.5 text-xs px-3 py-2 rounded-xl font-mono font-semibold transition-all border ${
              isPlaying
                ? 'bg-tuas-teal-light text-tuas-teal-dark border-tuas-teal-border shadow-sm'
                : 'bg-white text-psa-muted border-psa-border'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin text-tuas-teal' : ''}`} />
            <span>{isPlaying ? 'Live Pulse' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Progress Stage Tracker Bar */}
      <div className="bg-white border border-psa-border rounded-2xl p-4 shadow-cyber-card font-mono text-xs space-y-2">
        <div className="flex items-center justify-between text-psa-navy-dark font-bold">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-tuas-teal animate-pulse" />
            <span>
              PSA TRIAGE RUNTIME: {currentStage === 1 && 'Stage 1: Spatial-Temporal Noise Filtering & Topology Assessment'}
              {currentStage === 2 && 'Stage 2: Instantiating Sub-Agent Sandbox & Context Isolation'}
              {currentStage === 3 && 'Stage 3: Sub-Agent Executing MCP SCADA & PLC Diagnostic Queries'}
              {currentStage >= 4 && 'Stage 4: Synthesized Root Cause Review Docket Assembled'}
            </span>
          </div>
          <span className="text-tuas-cyan-dark font-bold">
            {currentStage === 1 && '25%'}
            {currentStage === 2 && '50%'}
            {currentStage === 3 && '75%'}
            {currentStage >= 4 && '100% (COMPLETE)'}
          </span>
        </div>

        <div className="w-full h-2 bg-psa-navy-light rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-psa-navy via-tuas-cyan to-tuas-teal rounded-full transition-all duration-700 shadow-sm"
            style={{ width: `${currentStage * 25}%` }}
          />
        </div>
      </div>

      {/* STAGE 2 & 3: ANIMATED AGENT ISOLATION SANDBOX POD (HIGH-TECH CYBERNETIC CONTAINER) */}
      <div className="bg-[#0B1E36] border-2 border-tuas-teal rounded-3xl p-6 md:p-8 shadow-[0_0_30px_rgba(0,201,167,0.25)] relative overflow-hidden font-sans text-white">
        
        {/* Background Dark SCADA Grid Pattern */}
        <div className="absolute inset-0 bg-tuas-grid opacity-80 pointer-events-none" />

        {/* TOP COORDINATOR NODE */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-full max-w-md bg-[#0F2A4A] border-2 border-tuas-cyan rounded-2xl p-4 shadow-[0_0_20px_rgba(0,180,216,0.3)] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-tuas-cyan text-psa-navy font-mono font-black text-[10px] px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow">
              Topological Coordinator Node
            </div>

            <div className="flex items-start justify-between mt-1">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-black/30 rounded-xl border border-tuas-cyan/50 text-tuas-cyan relative shadow-inner">
                  <Bot className="w-6 h-6 text-tuas-teal animate-pulse" />
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-tuas-teal animate-ping" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Coordinator Dispatcher</h4>
                  <p className="text-xs text-cyan-200 font-mono">
                    Assessing: {cluster.primary_location} Topology Graph
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400">Context Budget</span>
                <div className="text-xs font-bold text-tuas-teal">512 / 8,000 tok</div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-tuas-teal" />
                <span>Deterministic Noise Filter: 81.7% Saved</span>
              </span>
              <span className="text-tuas-teal font-bold bg-tuas-teal/20 px-2 py-0.5 rounded border border-tuas-teal/40">
                1 Agent Allocated
              </span>
            </div>
          </div>

          {/* ANIMATED LASER CONDUIT PIPE */}
          <div className="w-full max-w-sm h-14 relative flex items-center justify-center my-1">
            <div className="w-0.5 h-full bg-tuas-teal/40 relative">
              {isPlaying && (
                <div 
                  className="w-2 h-7 bg-tuas-teal rounded-full -left-[3px] absolute shadow-[0_0_12px_#00C9A7] animate-bounce"
                  style={{ animationDuration: '1.2s' }}
                />
              )}
            </div>

            {/* Scope Isolation Barrier */}
            <div className="absolute z-20 bg-[#0F2A4A] border border-tuas-teal/60 rounded-full px-4 py-1 flex items-center space-x-2 text-[11px] font-mono shadow-[0_0_15px_rgba(0,201,167,0.3)]">
              <Lock className="w-3.5 h-3.5 text-tuas-teal animate-pulse" />
              <span className="text-slate-200 font-medium">Context Isolation Barrier:</span>
              <span className="text-tuas-teal font-bold">100% Strict Sandbox</span>
            </div>
          </div>

          {/* ISOLATED INVESTIGATOR SUB-AGENT POD (CONTAINER MOCK) */}
          <div className="w-full max-w-xl bg-[#0F2A4A]/90 border-2 border-tuas-teal rounded-2xl p-5 shadow-[0_0_25px_rgba(0,201,167,0.3)] relative space-y-4">
            
            {/* Containment Shield Tag */}
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-tuas-teal" />
                <span className="text-xs font-bold tracking-wider uppercase text-cyan-200">
                  ISOLATED RUNTIME POD (PID: {isClusterA ? '8841' : '8842'})
                </span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase font-mono bg-tuas-teal/20 text-tuas-teal border border-tuas-teal/50">
                {cluster.cluster_id} EXCLUSIVE
              </span>
            </div>

            {/* Sub-Agent Title */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-black text-white text-base tracking-wide">{agentName}</h4>
                <p className="text-xs text-slate-300 font-mono mt-0.5">Role: {agentRole}</p>
              </div>
              <div className="p-2 bg-tuas-teal/20 rounded-xl border border-tuas-teal/50 shadow-inner text-tuas-teal">
                <Cpu className="w-5 h-5" />
              </div>
            </div>

            {/* Token Budget Meter */}
            <div className="bg-black/30 p-3 rounded-xl border border-white/10 font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-tuas-cyan" />
                  <span>Isolated Context Budget</span>
                </span>
                <span className="font-bold text-tuas-cyan">
                  {tokensUsed.toLocaleString()} / {tokenBudget.toLocaleString()} tok ({tokenPct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-tuas-cyan to-tuas-teal rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${tokenPct}%` }}
                />
              </div>
            </div>

            {/* Real-Time Executed MCP Tools */}
            <div className="bg-black/30 p-3 rounded-xl border border-white/10 font-mono text-xs space-y-2">
              <div className="text-[10px] text-tuas-cyan uppercase tracking-wide flex items-center gap-1 font-bold">
                <Terminal className="w-3.5 h-3.5 text-tuas-teal" />
                <span>Model Context Protocol (MCP) Executions</span>
              </div>
              
              <div className="space-y-1.5 text-[11px]">
                <div className="bg-[#0B1E36] p-2.5 rounded-lg border border-tuas-teal/30 flex items-center justify-between shadow-sm">
                  <span className="text-slate-200 font-semibold">
                    {isClusterA ? 'mcp-terminal-telemetry::get_lane_queue_order(Lane-07)' : 'mcp-terminal-telemetry::get_station_electrical_metrics(BCSS-02)'}
                  </span>
                  <span className="text-tuas-teal font-bold bg-tuas-teal/20 px-2 py-0.5 rounded border border-tuas-teal/40">
                    200 OK (42ms)
                  </span>
                </div>

                <div className="bg-[#0B1E36] p-2.5 rounded-lg border border-tuas-teal/30 flex items-center justify-between shadow-sm">
                  <span className="text-slate-200 font-semibold">
                    {isClusterA ? 'mcp-terminal-diagnostics::decode_plc_fault_code(0x7E1)' : 'mcp-terminal-diagnostics::decode_plc_fault_code(0x9B4)'}
                  </span>
                  <span className="text-tuas-teal font-bold bg-tuas-teal/20 px-2 py-0.5 rounded border border-tuas-teal/40">
                    200 OK (51ms)
                  </span>
                </div>
              </div>
            </div>

            {/* Anti-Pollution Guarantee */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-tuas-teal" />
                <span>Cross-Contamination: 0%</span>
              </span>
              <span className="text-tuas-teal font-bold bg-tuas-teal/20 px-2 py-0.5 rounded border border-tuas-teal/40">
                SANDBOX VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* STAGE 4: SYNTHESIZED HUMAN REVIEW DOCKET & ACTION RESOLUTION */}
      {currentStage >= 4 && (
        <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 md:p-8 shadow-xl space-y-5 animate-fadeIn">
          
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200 font-mono">
            <span className="text-xs font-black px-3 py-1 rounded-lg uppercase bg-psa-flame/15 text-psa-flame border border-psa-flame/30 shadow-sm">
              CRITICAL SEVERITY • ROOT CAUSE SYNTHESIZED
            </span>
            <span className="text-xs text-slate-500 font-mono font-bold">DOCKET: DOC-{cluster.cluster_id}</span>
          </div>

          <div>
            <h3 className="text-2xl font-black text-psa-navy-dark font-sans">
              Consolidated Incident Resolution Docket: {cluster.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Verified by isolated investigator <span className="font-bold text-psa-navy">{agentName}</span> using MCP SCADA telemetry.
            </p>
          </div>

          {/* Operational Impact Banner */}
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 font-mono text-xs shadow-sm">
            <span className="text-psa-flame font-black">OPERATIONAL DOWNSTREAM IMPACT: </span>
            <span className="text-slate-900 font-semibold">
              {isClusterA 
                ? 'Quay Crane QC-03 starvation on Berth 2; trailing AGVs (AGV-109, AGV-112) halted.' 
                : 'AGV-088 battery dropped to 11.8% SoC; alternative charger BCSS-01 operating at 100% capacity.'}
            </span>
          </div>

          {/* Verified Root Cause */}
          <div className="bg-[#EBF9FC] border-2 border-tuas-cyan/40 rounded-2xl p-4 space-y-1 font-mono shadow-sm">
            <div className="text-xs font-black text-tuas-cyan-dark flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-tuas-teal" />
              <span>AI TRIAGE VERIFIED ROOT CAUSE</span>
            </div>
            <p className="text-xs text-psa-navy-dark leading-relaxed font-bold">
              {isClusterA 
                ? 'Mechanical twistlock pin jam on AGV-104. Hydraulic relief valve peaked at 275 bar dead-head limit under PLC command RELEASE. State mismatch verified against CAN sensor.'
                : 'DC busbar thermal runaway on BCSS-02. Copper temperature exceeded safety trip threshold (82.4°C vs 80.0°C limit) following cooling loop differential pressure drop.'}
            </p>
          </div>

          {/* Physical Evidence Verification */}
          <div className="space-y-2">
            <div className="text-xs font-black text-psa-navy-dark font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-nominal-emerald" />
              <span>MULTIMODAL HARDWARE EVIDENCE CHECKLIST</span>
            </div>

            <div className="space-y-2">
              {cluster.alerts.map((alert, idx) => (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start space-x-3 text-xs font-mono shadow-sm">
                  <Check className="w-4 h-4 text-nominal-emerald mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <span className="text-psa-navy-dark font-bold">{alert.message}</span>
                    <div className="text-[10px] text-slate-500">
                      Source: <span className="text-tuas-cyan-dark font-bold">{alert.source}</span> • Location: {alert.location} • Timestamp: {alert.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* One-Click Action Dispatch Button */}
          <div className="pt-3 border-t border-psa-border">
            <button
              onClick={() => setIsDispatched(true)}
              disabled={isDispatched}
              className={`w-full py-3.5 px-6 rounded-xl font-mono font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md ${
                isDispatched
                  ? 'bg-nominal-emerald-bg text-nominal-emerald border border-nominal-emerald-border cursor-default'
                  : 'bg-gradient-to-r from-psa-navy via-psa-navy to-tuas-teal hover:from-tuas-cyan-dark hover:to-tuas-teal text-white shadow-glow-cyan/50 hover:shadow-glow-teal active:scale-[0.99]'
              }`}
            >
              {isDispatched ? (
                <>
                  <Check className="w-4 h-4 text-nominal-emerald" />
                  <span>ACTION DISPATCHED & LOGGED (WORK ORDER WO-88219 • FIELD CREW EN ROUTE)</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 text-tuas-teal" />
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
