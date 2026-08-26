import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  Layers, 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  Lock, 
  Wrench, 
  Activity, 
  Zap,
  ArrowLeft,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DocketItem, ClusterWithAlerts } from '../types';
import { INITIAL_DOCKETS } from '../data/mockData';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  text?: string;
  isSpawningAnimation?: boolean;
  spawningProgress?: {
    stage: number;
    stageText: string;
    agentName: string;
    agentRole: string;
    cluster: string;
    tokensUsed: number;
    maxTokens: number;
    activeTool: string;
    logs: string[];
  };
  docket?: DocketItem;
}

interface ChatInterfaceProps {
  selectedCluster?: ClusterWithAlerts | null;
  onBackToDocket: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  selectedCluster, 
  onBackToDocket 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      timestamp: '20:45:00',
      text: selectedCluster
        ? `👋 **Welcome to PSA Incident Copilot.** Live SCADA stream synchronized at 50Hz.\n\nSelected incident: **${selectedCluster.cluster_id}: ${selectedCluster.name}** (${selectedCluster.primary_location}).\n\nClick **"Trigger Spawn Demo"** or press **Enter** below to launch the isolated multi-agent triage and investigation sequence.`
        : '👋 **Welcome to PSA Incident Copilot.** Live SCADA stream synchronized at 50Hz.\n\nType any inquiry below (e.g. *"Investigate Lane 7 bottleneck"*, *"What caused the BCSS-02 trip?"*, or *"Simulate agent spawning"*) and press **Enter** to watch the multi-agent spawning and triage animation.',
    }
  ]);

  const [inputValue, setInputValue] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [dispatchedActions, setDispatchedActions] = useState<Record<string, boolean>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const isSimulatingRef = useRef<boolean>(false);
  const hasAutoTriggeredRef = useRef<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSimulating]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, []);

  // Auto-trigger exactly ONCE per selected cluster
  useEffect(() => {
    if (selectedCluster && hasAutoTriggeredRef.current !== selectedCluster.cluster_id) {
      hasAutoTriggeredRef.current = selectedCluster.cluster_id;
      const isBCSS = selectedCluster.cluster_id.includes('B') || 
                     selectedCluster.cluster_id.includes('0008') || 
                     selectedCluster.primary_location.includes('BCSS');
      
      triggerAgentSpawningSimulation(
        `⚡ Run AI incident triage & spawn investigator agents for ${selectedCluster.cluster_id}: ${selectedCluster.name}`,
        isBCSS ? 'Cluster B' : 'Cluster A',
        selectedCluster
      );
    }
  }, [selectedCluster]);

  const triggerAgentSpawningSimulation = (
    customQuery?: string, 
    targetCluster: 'Cluster A' | 'Cluster B' = 'Cluster A',
    customClusterObj?: ClusterWithAlerts | null
  ) => {
    // Synchronous mutex lock to prevent duplicate runs
    if (isSimulatingRef.current) return;
    isSimulatingRef.current = true;
    setIsSimulating(true);

    const isClusterA = targetCluster === 'Cluster A';
    const clusterLabel = customClusterObj 
      ? `${customClusterObj.cluster_id}: ${customClusterObj.name}`
      : isClusterA 
        ? 'Cluster A: Transfer Lane 7 Bottleneck' 
        : 'Cluster B: BCSS-02 Charger Trip';

    const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: timeNow(),
      text: customQuery || `⚡ Run AI incident triage & spawn investigator agents for ${clusterLabel}`,
    };
    setMessages(prev => [...prev, userMsg]);

    // Step 1: Coordinator Stage
    const t1 = setTimeout(() => {
      const coordMsg: ChatMessage = {
        id: `coord-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeNow(),
        text: `🤖 **Stage 1: Coordinator Assessment Activated**\n- Ingested **142 field alerts** from SCADA message bus.\n- Deterministic spatial-temporal filter dropped 116 baseline noise events (**81.7% zero-token savings**).\n- Coordinator evaluated ${customClusterObj?.primary_location || (isClusterA ? 'Lane 7 & Berth 2' : 'Station BCSS-02')} topology graph $\\rightarrow$ **Spawning dedicated investigator sub-agent** in an isolated runtime sandbox.`
      };
      setMessages(prev => [...prev, coordMsg]);

      // Step 2: Sub-Agent Sandbox Pod & Token Budget
      const t2 = setTimeout(() => {
        const spawnMsgId = `spawn-${Date.now()}`;
        const spawnMsg: ChatMessage = {
          id: spawnMsgId,
          sender: 'assistant',
          timestamp: timeNow(),
          isSpawningAnimation: true,
          spawningProgress: {
            stage: 2,
            stageText: isClusterA 
              ? 'Agent 1 (Lane Investigator) instantiated with exclusive PID 8841' 
              : 'Agent 2 (Infrastructure Investigator) instantiated with exclusive PID 8842',
            agentName: customClusterObj?.assigned_agent || (isClusterA ? 'Agent 1: Lane & Actuator Investigator' : 'Agent 2: Infrastructure & Power Investigator'),
            agentRole: isClusterA ? 'Vehicle Kinematics, Queue Order & Actuators' : 'Power Distribution & DC Busbar Thermals',
            cluster: customClusterObj?.cluster_id || targetCluster,
            tokensUsed: isClusterA ? 1140 : 1480,
            maxTokens: 2000,
            activeTool: isClusterA 
              ? 'mcp-terminal-telemetry::get_lane_queue_order(Lane-07)' 
              : 'mcp-terminal-telemetry::get_station_electrical_metrics(BCSS-02)',
            logs: isClusterA ? [
              '🔒 Isolated sandbox container initialized [0% Cross-Contamination]',
              '📦 Ingested schema: [LaneTopology, ActuatorCAN, HeadwayRadar]',
              '🔍 Lead stalled vehicle identified: AGV-104 (Velocity: 0.0 m/s)',
              '⚡ Querying Actuator PLC register: 0x7E1 under 275 bar relief pressure'
            ] : [
              '🔒 Isolated sandbox container initialized [0% Cross-Contamination]',
              '📦 Ingested schema: [HV_Switchgear, CoolantLoop, SubstationBusbar]',
              '🌡️ DC Busbar thermal anomaly flagged: 82.4°C (Safe limit: 70.0°C)',
              '⚡ Decoding PLC breaker trip register: 0x9B4 (OVERTEMP_THERMAL_CUTOFF)'
            ]
          }
        };
        setMessages(prev => [...prev, spawnMsg]);

        // Step 3: Synthesized Review Docket
        const t3 = setTimeout(() => {
          const docketData = isClusterA ? INITIAL_DOCKETS[0] : INITIAL_DOCKETS[1];
          const docketMsg: ChatMessage = {
            id: `docket-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            text: `📋 **Stage 3 & 4 Complete:** Multi-agent investigation synthesized into a consolidated Human Review Docket backed by **100% verified hardware proof**.`,
            docket: {
              ...docketData,
              title: customClusterObj ? customClusterObj.name : docketData.title,
              clusterId: customClusterObj ? customClusterObj.cluster_id : docketData.clusterId,
            }
          };
          setMessages(prev => [...prev, docketMsg]);
          isSimulatingRef.current = false;
          setIsSimulating(false);
        }, 1800);

        timeoutsRef.current.push(t3);
      }, 1000);

      timeoutsRef.current.push(t2);
    }, 600);

    timeoutsRef.current.push(t1);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSimulatingRef.current) return;

    const lower = inputValue.toLowerCase();
    const currentText = inputValue;
    setInputValue('');

    const targetCluster = (lower.includes('bcss') || lower.includes('cluster b') || lower.includes('charger') || lower.includes('thermal') || lower.includes('0008'))
      ? 'Cluster B'
      : 'Cluster A';

    triggerAgentSpawningSimulation(currentText, targetCluster);
  };

  const handleDispatchAction = (actionText: string) => {
    setDispatchedActions(prev => ({ ...prev, [actionText]: true }));

    const t = setTimeout(() => {
      const confirmMsg: ChatMessage = {
        id: `dispatch-confirm-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: `🚀 **Operational Action Dispatched & Logged**\n- **Authorized Action:** "${actionText}"\n- **Field Unit:** Tuas Sector A Mobile Mechanical Team #2\n- **Work Order Reference:** WO-88219 (Priority High)\n- **Status:** **Dispatched (Field ETA: 3m 30s)**`
      };
      setMessages(prev => [...prev, confirmMsg]);
    }, 500);

    timeoutsRef.current.push(t);
  };

  const toggleLogExpand = (msgId: string) => {
    setExpandedLogs(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleReset = () => {
    clearAllTimeouts();
    isSimulatingRef.current = false;
    hasAutoTriggeredRef.current = null;
    setIsSimulating(false);
    setMessages([
      {
        id: 'msg-welcome',
        sender: 'assistant',
        timestamp: '20:45:00',
        text: '👋 **Welcome to PSA Incident Copilot.** Live SCADA stream synchronized at 50Hz.\n\nType any inquiry below (e.g. *"Investigate Lane 7 bottleneck"*, *"What caused the BCSS-02 trip?"*, or *"Simulate agent spawning"*) and press **Enter** to watch the multi-agent spawning and triage animation.',
      }
    ]);
    setDispatchedActions({});
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      
      {/* Top Copilot Header Bar */}
      <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToDocket}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 shadow-sm transition-colors flex items-center space-x-1.5 text-xs font-mono font-bold whitespace-nowrap active:scale-95"
            title="Return to Alerts & Clusters"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Docket</span>
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-wide font-sans">
                PSA INCIDENT COPILOT
              </h2>
              <span className="bg-sky-100 text-sky-700 border border-sky-200 text-[10px] px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap">
                SPAWNING VISUALIZER
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
              Type any query below to trigger multi-agent spawning & triage
            </p>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => triggerAgentSpawningSimulation(undefined, 'Cluster A', selectedCluster)}
            disabled={isSimulating}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shadow-sm whitespace-nowrap ${
              isSimulating
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20 active:scale-95'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : 'animate-pulse'}`} />
            <span>{isSimulating ? 'Spawning Agents...' : 'Trigger Spawn Demo'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="Reset Conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Feed Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`p-2 rounded-xl border flex-shrink-0 shadow-sm ${
                  isUser
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-sky-600 border-slate-200'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`space-y-3 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Text Bubble */}
                {msg.text && (
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed font-sans shadow-sm ${
                      isUser
                        ? 'bg-sky-600 text-white rounded-tr-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none font-sans'
                    }`}
                  >
                    <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>
                    <div className={`text-[10px] mt-2 font-mono ${isUser ? 'text-sky-100' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                )}

                {/* Sub-Agent Spawning Sandbox Card */}
                {msg.isSpawningAnimation && msg.spawningProgress && (
                  <div className="bg-white border-2 border-sky-300 rounded-2xl p-5 shadow-md space-y-3.5 font-mono text-xs w-full animate-fadeIn">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-sky-50 rounded-xl text-sky-600 border border-sky-200 shadow-sm">
                          <Layers className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{msg.spawningProgress.agentName}</div>
                          <div className="text-[10px] text-slate-500">{msg.spawningProgress.agentRole}</div>
                        </div>
                      </div>

                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        0% CONTAMINATION
                      </span>
                    </div>

                    {/* Token Budget Meter */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-sky-600" />
                          <span>Isolated Context Sandbox:</span>
                        </span>
                        <span className="font-bold text-sky-700">
                          {msg.spawningProgress.tokensUsed} / {msg.spawningProgress.maxTokens} tokens (57%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-600 rounded-full transition-all duration-700 shadow-sm"
                          style={{ width: `${(msg.spawningProgress.tokensUsed / msg.spawningProgress.maxTokens) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Active MCP Execution Ticker */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-600" />
                        <span>Active MCP Tool Call:</span>
                      </div>
                      <div className="text-slate-800 text-[11px] font-bold truncate">
                        {msg.spawningProgress.activeTool}
                      </div>
                    </div>

                    {/* Expandable Logs */}
                    <div className="pt-1">
                      <button
                        onClick={() => toggleLogExpand(msg.id)}
                        className="text-[11px] text-sky-700 hover:text-sky-800 font-semibold flex items-center space-x-1"
                      >
                        <span>Diagnostic Schema Logs ({msg.spawningProgress.logs.length})</span>
                        {expandedLogs[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {expandedLogs[msg.id] && (
                        <div className="mt-2 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                          {msg.spawningProgress.logs.map((log, i) => (
                            <div key={i} className="text-slate-700 py-0.5">
                              {log}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Final Synthesized Human Review Docket Card */}
                {msg.docket && (
                  <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-md space-y-4 w-full animate-fadeIn">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase ${
                        msg.docket.severity === 'CRITICAL' 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {msg.docket.severity} SEVERITY • ACTION REQUIRED
                      </span>
                      <span className="text-xs font-mono text-slate-400">DOCKET ID: {msg.docket.id}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 font-sans">
                      {msg.docket.title}
                    </h3>

                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-1">
                      <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5 font-mono">
                        <Sparkles className="w-4 h-4 text-sky-600" />
                        <span>AI VERIFIED ROOT CAUSE</span>
                      </div>
                      <p className="text-xs text-slate-800 font-mono leading-relaxed">
                        {msg.docket.rootCause}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>MULTIMODAL HARDWARE EVIDENCE</span>
                      </div>

                      <div className="space-y-1.5">
                        {msg.docket.physicalEvidence.map((ev: { text: string; timestamp: string; verified: boolean }, i: number) => (
                          <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-start space-x-2 text-xs font-mono">
                            <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-800 text-[11px] leading-relaxed">{ev.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-sky-600" />
                        <span>AUTHORIZE ACTION DISPATCH</span>
                      </div>

                      <div className="space-y-2">
                        {msg.docket.recommendedActions.map((action: string, idx: number) => {
                          const isDispatched = dispatchedActions[action];
                          return (
                            <button
                              key={idx}
                              onClick={() => handleDispatchAction(action)}
                              disabled={isDispatched}
                              className={`w-full p-3 rounded-xl text-xs font-mono font-bold flex items-center justify-between transition-all ${
                                isDispatched
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 active:scale-[0.99]'
                              }`}
                            >
                              <span className="text-left font-medium">{idx + 1}. {action}</span>
                              {isDispatched ? (
                                <span className="flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                  <Check className="w-3 h-3" /> DISPATCHED
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 bg-sky-700 px-2.5 py-1 rounded text-[10px]">
                                  AUTHORIZE <ArrowRight className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Spawning Triggers Chips */}
      <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold flex-shrink-0">
          QUICK SPAWNING TRIGGERS:
        </span>
        <button
          onClick={() => triggerAgentSpawningSimulation('Investigate Lane 7 Jam (Cluster A)', 'Cluster A')}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-sky-50 text-sky-800 border border-slate-200 hover:border-sky-300 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          🔍 Lane 7 Jam (Cluster A)
        </button>
        <button
          onClick={() => triggerAgentSpawningSimulation('Investigate BCSS-02 Charger Trip (Cluster B)', 'Cluster B')}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-amber-50 text-amber-900 border border-slate-200 hover:border-amber-300 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          ⚡ BCSS-02 Charger Trip (Cluster B)
        </button>
        <button
          onClick={() => triggerAgentSpawningSimulation('Simulate full multi-agent triage and context isolation', 'Cluster A')}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          ⚡ Full Spawning Demo
        </button>
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 shadow-inner">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type any message (e.g. 'Investigate Lane 7' or 'Test agent spawning') and press Enter..."
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none font-sans"
            disabled={isSimulating}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSimulating}
            className={`p-2 rounded-lg transition-all ${
              inputValue.trim() && !isSimulating
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
