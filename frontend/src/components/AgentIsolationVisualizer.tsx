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
  Network,
  CheckCircle2,
  X
} from 'lucide-react';

interface SubAgentState {
  id: string;
  name: string;
  cluster: string;
  target: string;
  role: string;
  tokensUsed: number;
  tokenBudget: number;
  status: 'spawning' | 'isolating' | 'investigating' | 'completed';
  activeStep: string;
  logs: string[];
  color: 'cyan' | 'blue' | 'amber';
}

interface AgentIsolationVisualizerProps {
  onClose?: () => void;
}

export const AgentIsolationVisualizer: React.FC<AgentIsolationVisualizerProps> = ({ onClose }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isSpawningAnimation, setIsSpawningAnimation] = useState<boolean>(false);
  const [activeStageText, setActiveStageText] = useState<string>('Live Investigation Active');
  const [progressPct, setProgressPct] = useState<number>(100);

  const [agents, setAgents] = useState<SubAgentState[]>([
    {
      id: 'agent-lane',
      name: 'Agent 1: Lane Investigator',
      cluster: 'Cluster A',
      target: 'Transfer Lane 7 & AGV-104',
      role: 'Vehicle Kinematics, Queue Order & Mechanical Actuators',
      tokensUsed: 1140,
      tokenBudget: 2000,
      status: 'investigating',
      activeStep: 'Querying mcp-terminal-telemetry :: 275 bar relief pressure',
      logs: [
        '🔒 Isolated context container initialized (PID: 8841)',
        '📦 Ingested schema: [LaneTopology, ActuatorCAN]',
        '🔍 Lead vehicle resolved: AGV-104 (Zero-headway)',
        '⚡ Dispatched PLC fault query 0x7E1'
      ],
      color: 'cyan'
    },
    {
      id: 'agent-infra',
      name: 'Agent 2: Infrastructure Investigator',
      cluster: 'Cluster B',
      target: 'Station BCSS-02 & Substation',
      role: 'Power Distribution, Thermal Curves & Switchgear',
      tokensUsed: 1480,
      tokenBudget: 2000,
      status: 'investigating',
      activeStep: 'Decoding PLC register 0x9B4 :: OVERTEMP_THERMAL_CUTOFF',
      logs: [
        '🔒 Isolated context container initialized (PID: 8842)',
        '📦 Ingested schema: [HV_Switchgear, CoolantLoop]',
        '🌡️ Busbar temp anomaly verified: 82.4°C',
        '⚡ Contactor trip root cause: Coolant drop'
      ],
      color: 'amber'
    }
  ]);

  // Handle live replay animation with progressive steps
  const triggerSpawnAnimation = () => {
    setIsSpawningAnimation(true);
    setIsPlaying(true);
    setProgressPct(15);
    setActiveStageText('Stage 1: Coordinator evaluating terminal topology graph...');

    // Step 1 -> Step 2
    setTimeout(() => {
      setProgressPct(45);
      setActiveStageText('Stage 2: Instantiating Sub-Agent Sandboxes & Allocating Context Budgets...');
    }, 1200);

    // Step 2 -> Step 3
    setTimeout(() => {
      setProgressPct(80);
      setActiveStageText('Stage 3: Sub-Agents querying MCP SCADA Telemetry & Decoding PLC Faults...');
    }, 2400);

    // Step 3 -> Completed
    setTimeout(() => {
      setProgressPct(100);
      setActiveStageText('Triage Complete: Zero Cross-Contamination Verified (82% Token Savings)');
      setIsSpawningAnimation(false);
    }, 3600);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-2xl relative overflow-hidden font-sans max-w-4xl mx-auto">
      {/* Background Animated Scanning Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />

      {/* Header Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-600 shadow-sm">
            <Layers className={`w-6 h-6 ${isSpawningAnimation ? 'animate-spin text-sky-600' : 'animate-pulse'}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base tracking-wide font-sans">
                STAGE 2: AGENT INSTANTIATION & SCOPE ISOLATION
              </h3>
              <span className="bg-sky-100 text-sky-700 border border-sky-200 text-[10px] px-2.5 py-0.5 rounded font-mono font-bold">
                ZERO-LEAK RUNTIME
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Coordinator allocates strict context budgets & isolated MCP boundaries per incident cluster.
            </p>
          </div>
        </div>

        {/* Action Buttons & Close */}
        <div className="flex items-center space-x-2">
          <button
            onClick={triggerSpawnAnimation}
            disabled={isSpawningAnimation}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all shadow-sm ${
              isSpawningAnimation
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSpawningAnimation ? 'animate-spin' : ''}`} />
            <span>{isSpawningAnimation ? 'Spawning Agents...' : 'Replay Spawning Animation'}</span>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-1.5 text-xs px-3 py-2 rounded-lg font-mono font-semibold transition-all border ${
              isPlaying
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-white text-slate-500 border-slate-300'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin' : ''}`} />
            <span>{isPlaying ? 'Live Pulse' : 'Paused'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors ml-2"
              title="Close Visualizer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Simulation Progress Banner */}
      <div className="relative z-10 my-4 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm font-mono text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-700 font-semibold">
            <Sparkles className="w-4 h-4 text-sky-600 animate-pulse" />
            <span>Live Triage Status: <span className="text-sky-700 font-bold">{activeStageText}</span></span>
          </div>
          <span className="text-slate-500 font-bold">{progressPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main Diagram Canvas */}
      <div className="relative z-10 my-6 flex flex-col items-center">
        
        {/* TOP NODE: COORDINATOR AGENT */}
        <div className={`w-full max-w-md bg-white border-2 rounded-2xl p-5 shadow-lg relative transition-all duration-500 ${
          isSpawningAnimation ? 'border-sky-600 ring-4 ring-sky-500/20 scale-[1.02]' : 'border-sky-500 shadow-sky-500/10'
        }`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-600 text-white font-mono font-bold text-[10px] px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow">
            Topological Coordinator Node
          </div>

          <div className="flex items-start justify-between mt-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-sky-200 text-sky-600 relative shadow-sm">
                <Bot className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Coordinator Dispatch Node</h4>
                <p className="text-xs text-slate-500 font-mono">
                  Queries Terminal Topology & Instantiates Sub-Agents
                </p>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-400">Context Budget</span>
              <div className="text-xs font-bold text-sky-700">512 / 8,000 tok</div>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-sky-600" />
              <span>Assessing: Berth 2 & Sector A layout</span>
            </span>
            <span className="text-emerald-700 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              2 Agents Dispatched
            </span>
          </div>
        </div>

        {/* ANIMATED LASER CONDUITS / PIPELINES */}
        <div className="w-full max-w-2xl h-16 relative flex items-center justify-around my-1">
          {/* Left Branch to Agent 1 */}
          <div className="absolute left-1/4 top-0 bottom-0 w-0.5 bg-slate-300">
            {isPlaying && (
              <div 
                className="w-2 h-7 bg-sky-500 rounded-full -left-[3px] absolute shadow-lg shadow-sky-500 animate-bounce"
                style={{ animationDuration: '1.2s' }}
              />
            )}
          </div>

          {/* Right Branch to Agent 2 */}
          <div className="absolute right-1/4 top-0 bottom-0 w-0.5 bg-slate-300">
            {isPlaying && (
              <div 
                className="w-2 h-7 bg-amber-500 rounded-full -left-[3px] absolute shadow-lg shadow-amber-500 animate-bounce"
                style={{ animationDuration: '1.4s' }}
              />
            )}
          </div>

          {/* Scope Isolation Barrier Ribbon */}
          <div className="z-20 bg-white/95 border border-sky-300 rounded-full px-4 py-1.5 flex items-center space-x-2 text-xs font-mono shadow-md backdrop-blur">
            <Lock className="w-4 h-4 text-sky-600 animate-pulse" />
            <span className="text-slate-700 font-medium">Context Isolation Barrier:</span>
            <span className="text-emerald-700 font-bold">100% Strict Sandbox</span>
          </div>
        </div>

        {/* ISOLATED INVESTIGATOR SUB-AGENT PODS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
          {agents.map((agent, index) => {
            const isCyan = agent.color === 'cyan';
            const pct = Math.round((agent.tokensUsed / agent.tokenBudget) * 100);

            return (
              <div
                key={agent.id}
                className={`relative rounded-2xl p-5 border-2 transition-all duration-500 shadow-md bg-white overflow-hidden ${
                  isCyan
                    ? 'border-sky-500/80 hover:border-sky-600 hover:shadow-sky-500/10'
                    : 'border-amber-500/80 hover:border-amber-600 hover:shadow-amber-500/10'
                } ${isSpawningAnimation ? 'scale-[1.01]' : ''}`}
              >
                {/* Containment Shield Hologram Tag */}
                <div className="flex items-center justify-between font-mono mb-3">
                  <div className="flex items-center space-x-1.5">
                    <ShieldCheck className={`w-4 h-4 ${isCyan ? 'text-sky-600' : 'text-amber-600'}`} />
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-700">
                      SANDBOX POD #{index + 1}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase font-mono ${
                    isCyan 
                      ? 'bg-sky-100 text-sky-800 border border-sky-200' 
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {agent.cluster} EXCLUSIVE
                  </span>
                </div>

                {/* Sub-Agent Title & Target */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{agent.name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Target: {agent.target}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <Cpu className={`w-5 h-5 ${isCyan ? 'text-sky-600' : 'text-amber-600'}`} />
                  </div>
                </div>

                {/* Dedicated Token Budget Bar */}
                <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Isolated Token Budget</span>
                    <span className={`font-bold ${isCyan ? 'text-sky-700' : 'text-amber-700'}`}>
                      {agent.tokensUsed.toLocaleString()} / {agent.tokenBudget.toLocaleString()} tok ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isCyan ? 'bg-sky-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Active Diagnostic Step */}
                <div className="mt-3.5 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Current MCP Execution</span>
                  </div>
                  <div className="text-slate-800 text-xs truncate font-semibold">
                    {agent.activeStep}
                  </div>
                </div>

                {/* Isolated Diagnostic Log Stream */}
                <div className="mt-3 space-y-1.5 font-mono text-[11px]">
                  {agent.logs.map((log, i) => (
                    <div key={i} className="text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 truncate">
                      {log}
                    </div>
                  ))}
                </div>

                {/* Anti-Pollution Guarantee Footer */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cross-Contamination: 0%</span>
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    PROTECTED
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Callout */}
      <div className="relative z-10 mt-4 bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs font-mono text-slate-600 shadow-sm">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-sky-600" />
          <span>
            Strict isolation prevents schema cross-contamination and minimizes total LLM token overhead by 82%.
          </span>
        </div>
        <span className="text-sky-700 font-bold">PSA HACKATHON 2026</span>
      </div>
    </div>
  );
};
