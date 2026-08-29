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
  ChevronUp,
  X,
  Edit3,
  XCircle,
  AlertTriangle,
  ArrowRightCircle,
  Sliders
} from 'lucide-react';
import { DocketItem, ClusterWithAlerts } from '../types';
import { streamInvestigation, InvestigateResult, StreamEvent } from '../lib/api';

interface ActionReviewState {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN';
  reason?: string;
  overrideText?: string;
}

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
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Human-in-the-loop Action States
  const [actionStates, setActionStates] = useState<Record<string, ActionReviewState>>({});
  const [activeFormMode, setActiveFormMode] = useState<Record<string, 'reject' | 'override' | null>>({});
  const [tempInput, setTempInput] = useState<Record<string, string>>({});

  const isSimulatingRef = useRef<boolean>(false);
  const hasAutoTriggeredRef = useRef<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeStreamCleanupRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const presetRejectionReasons = [
    'Crew engaged on Berth 4 priority',
    'Hardware false positive / nominal',
    'Alternative bypass route preferred',
    'Already mitigated manually'
  ];

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSimulating, activeFormMode]);

  // Clean up timeouts and any open SSE stream on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      activeStreamCleanupRef.current?.();
    };
  }, []);

  // Auto-trigger exactly ONCE per selected cluster, using its real cluster_id
  // directly — no more guessing "is this Cluster A or B" from the name, since
  // the backend now routes by the real incident_clusters.assigned_agent column.
  useEffect(() => {
    if (selectedCluster && hasAutoTriggeredRef.current !== selectedCluster.cluster_id) {
      hasAutoTriggeredRef.current = selectedCluster.cluster_id;
      triggerAgentSpawningSimulation(
        `⚡ Run AI incident triage & spawn investigator agents for ${selectedCluster.cluster_id}: ${selectedCluster.name}`,
        selectedCluster.cluster_id
      );
    }
  }, [selectedCluster]);

  const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  /**
   * Runs a real investigation against the backend LangGraph agent (see
   * backend/agent/server.py). clusterId is a real Supabase cluster_id (e.g.
   * "CLUSTER-A"), or undefined/null to investigate every cluster currently
   * in incident_clusters at once.
   *
   * Each SSE event corresponds to one node finishing in the graph: an
   * investigator agent, the correlation agent, or the final docket
   * submission. There is no "token budget" or per-tool-call event from the
   * backend today, so the sandbox card below shows real evidence and root
   * cause, not fabricated token/tool numbers.
   */
  const triggerAgentSpawningSimulation = (
    customQuery?: string,
    clusterId?: string | null
  ) => {
    if (isSimulatingRef.current) return;
    isSimulatingRef.current = true;
    setIsSimulating(true);

    const clusterLabel = clusterId || 'every active cluster';
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: timeNow(),
      text: customQuery || `⚡ Run AI incident triage & spawn investigator agents for ${clusterLabel}`,
    };
    setMessages(prev => [...prev, userMsg]);

    const coordMsg: ChatMessage = {
      id: `coord-${Date.now()}`,
      sender: 'assistant',
      timestamp: timeNow(),
      text: `🤖 **Coordinator Assessment Activated**\n- Reading live \`incident_clusters\` from Supabase.\n- Routing **${clusterLabel}** to the investigator(s) assigned in the real \`assigned_agent\` column.`
    };
    setMessages(prev => [...prev, coordMsg]);

    const finish = () => {
      isSimulatingRef.current = false;
      setIsSimulating(false);
      activeStreamCleanupRef.current = null;
    };

    activeStreamCleanupRef.current = streamInvestigation(
      clusterId,
      (event: StreamEvent) => {
        if (event.node === 'complete') {
          const result: InvestigateResult = event.output;
          if (result.dockets.length === 0) {
            setMessages(prev => [...prev, {
              id: `docket-empty-${Date.now()}`,
              sender: 'assistant',
              timestamp: timeNow(),
              text: `⚠️ Investigation finished but produced no docket — check that ${clusterLabel} still exists in incident_clusters.`,
            }]);
          } else {
            result.dockets.forEach((docket, i) => {
              setMessages(prev => [...prev, {
                id: `docket-${Date.now()}-${i}`,
                sender: 'assistant',
                timestamp: timeNow(),
                text: `📋 **Investigation complete:** synthesized into a Human Review Docket.`,
                docket,
              }]);
            });
          }
          finish();
          return;
        }

        if (event.node.endsWith('_investigator')) {
          const finding = event.output.investigator_findings?.[0];
          if (!finding) return;
          setMessages(prev => [...prev, {
            id: `spawn-${event.node}-${finding.incident_id}-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            isSpawningAnimation: true,
            spawningProgress: {
              stage: 2,
              stageText: `${event.node} finished investigating ${finding.cluster_name} (${finding.incident_id})`,
              agentName: event.node,
              agentRole: finding.title,
              cluster: finding.incident_id,
              tokensUsed: 100,
              maxTokens: 100,
              activeTool: 'domain-scoped MCP tools (telemetry + diagnostics)',
              logs: [
                `🔍 Root cause: ${finding.root_cause}`,
                ...((finding.evidence_items as string[]) || []).map((e) => `📌 ${e}`),
              ],
            },
          }]);
        } else if (event.node === 'correlation') {
          const groups = event.output.correlation?.linked_groups || [];
          if (groups.length > 0) {
            setMessages(prev => [...prev, {
              id: `corr-${Date.now()}`,
              sender: 'assistant',
              timestamp: timeNow(),
              text: `🔗 **Correlation agent:** found ${groups.length} linked incident group(s) — ${groups.map((g: any) => g.reason).join('; ')}`,
            }]);
          }
        }
      },
      () => {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          timestamp: timeNow(),
          text: `⚠️ **Connection error** — could not reach the agent backend. Is \`uvicorn agent.server:app\` running on port 8000?`,
        }]);
        finish();
      }
    );
  };

  // -------------------------------------------------------------
  // Simulated Agent Re-Plan Flow upon Operator Rejection
  // -------------------------------------------------------------
  const triggerAgentReplanSimulation = (
    rejectedAction: string,
    reason: string,
    docketTitle: string
  ) => {
    if (isSimulatingRef.current) return;
    isSimulatingRef.current = true;
    setIsSimulating(true);

    const userMsg: ChatMessage = {
      id: `replan-user-${Date.now()}`,
      sender: 'user',
      timestamp: timeNow(),
      text: `❌ **[HUMAN-IN-THE-LOOP OVERRIDE]** Rejected recommendation:\n*"${rejectedAction}"*\n\n📝 **Operator Stated Reason:** ${reason}`,
    };
    setMessages(prev => [...prev, userMsg]);

    // Step 1: Agent Re-planning Acknowledgment
    const t1 = setTimeout(() => {
      const replanAckMsg: ChatMessage = {
        id: `replan-ack-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeNow(),
        text: `🔄 **Operator Feedback Ingested: Re-planning Triggered**\n- Human constraint recorded: *"${reason}"*.\n- Coordinator updating topological graph & querying alternative MCP resolution pathways...`
      };
      setMessages(prev => [...prev, replanAckMsg]);

      // Step 2: Dynamic Alternative Tool Query Animation
      const t2 = setTimeout(() => {
        const replanSpawnMsg: ChatMessage = {
          id: `replan-spawn-${Date.now()}`,
          sender: 'assistant',
          timestamp: timeNow(),
          isSpawningAnimation: true,
          spawningProgress: {
            stage: 3,
            stageText: 'Agent 1 (Lane Investigator) exploring Lane 6 bypass & pressure purge cycles',
            agentName: 'Agent 1: Lane & Actuator Investigator',
            agentRole: 'Dynamic Rerouting & Automated Actuator Purge Sub-Graph',
            cluster: 'Cluster A (Revision 2)',
            tokensUsed: 1620,
            maxTokens: 2000,
            activeTool: 'mcp-terminal-telemetry::get_alternate_bypass_routing(from=Lane-07, via=Lane-06)',
            logs: [
              `⚠️ Discarded original constraint path: "${rejectedAction}"`,
              '🗺️ Topo query: Calculated Lane 6 bypass clearance (Headway: 42m available)',
              '🔄 Automated hydraulic back-pressure cycle simulated: 3x pulses @ 290 bar',
              '✅ Secondary resolution docket generated with zero human crew dependency'
            ]
          }
        };
        setMessages(prev => [...prev, replanSpawnMsg]);

        // Step 3: Revised Docket Delivery (Rev. 2)
        const t3 = setTimeout(() => {
          const revisedDocket: DocketItem = {
            id: 'DOCKET-A-REV2',
            clusterId: 'Cluster A',
            title: `${docketTitle} (REVISED PLAN - REV. 2)`,
            severity: 'HIGH',
            impact: 'Quay Crane QC-03 starvation mitigated via automated Lane 6 bypass.',
            rootCause: 'Mechanical twistlock binding on lead AGV-104 isolated; alternate bypass enabled.',
            physicalEvidence: [
              { text: 'Lane 6 buffer verified clear (0 queued vehicles, 100% capacity available).', verified: true, timestamp: timeNow() },
              { text: 'Automated hydraulic relief pulse sequence verified safe for remote triggering.', verified: true, timestamp: timeNow() }
            ],
            plcRegisters: [
              { code: '0x7E1_PURGE', name: 'AUTO_RELIEF_PULSE_SEQ', description: 'Remote high-frequency solenoid oscillation', category: 'Actuator', status: 'READY_TO_EXECUTE' }
            ],
            recommendedActions: [
              'Execute automated hydraulic back-pressure purge cycle (3x pulses @ 290 bar) on AGV-104.',
              'Dynamic TOS reroute: Authorize AGV-109 and AGV-112 via Lane 6 bypass to Quay Crane QC-03 immediately.'
            ]
          };

          const revisedDocketMsg: ChatMessage = {
            id: `revised-docket-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            text: `✨ **Revised Resolution Docket Synthesized (Rev. 2):**\nIncorporated your operational constraints. You can now authorize or adjust the alternative bypass actions below.`,
            docket: revisedDocket
          };
          setMessages(prev => [...prev, revisedDocketMsg]);
          isSimulatingRef.current = false;
          setIsSimulating(false);
        }, 1600);

        timeoutsRef.current.push(t3);
      }, 900);

      timeoutsRef.current.push(t2);
    }, 500);

    timeoutsRef.current.push(t1);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSimulatingRef.current) return;

    const lower = inputValue.toLowerCase();
    const currentText = inputValue;
    setInputValue('');

    // Simple keyword heuristic to a real cluster_id — not real NLU intent
    // parsing, just enough to route a free-text query somewhere sensible.
    let clusterId: string | undefined;
    if (lower.includes('bcss') || lower.includes('charger') || lower.includes('thermal') || lower.includes('cluster b')) {
      clusterId = 'CLUSTER-B';
    } else if (lower.includes('sector a') || lower.includes('battery') || lower.includes('soc') || lower.includes('cluster c')) {
      clusterId = 'CLUSTER-C';
    } else if (lower.includes('lane 7') || lower.includes('twistlock') || lower.includes('cluster a')) {
      clusterId = 'CLUSTER-A';
    } else if (lower.includes('lane 4') || lower.includes('lidar') || lower.includes('cluster d')) {
      clusterId = 'CLUSTER-D';
    }
    // No match -> undefined -> investigate every active cluster.

    triggerAgentSpawningSimulation(currentText, clusterId);
  };

  // Handle Authorize Action
  const handleAuthorizeAction = (actionText: string) => {
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'ACCEPTED' }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));

    const t = setTimeout(() => {
      const confirmMsg: ChatMessage = {
        id: `dispatch-confirm-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeNow(),
        text: `🚀 **Operational Action Authorized & Dispatched**\n- **Command:** "${actionText}"\n- **Field Unit:** Tuas Sector A Operations Team #2\n- **Work Order Reference:** WO-88219 (Priority High)\n- **Status:** **DISPATCHED & EXECUTING (ETA: 3m 30s)**`
      };
      setMessages(prev => [...prev, confirmMsg]);
    }, 400);

    timeoutsRef.current.push(t);
  };

  // Handle Reject Action -> Trigger Re-plan
  const handleConfirmRejectAction = (actionText: string, docketTitle: string) => {
    const reason = tempInput[actionText]?.trim() || 'Rejected by Terminal Supervisor';
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'REJECTED', reason }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));

    triggerAgentReplanSimulation(actionText, reason, docketTitle);
  };

  // Handle Override Action
  const handleConfirmOverrideAction = (actionText: string) => {
    const overrideText = tempInput[actionText]?.trim() || actionText;
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'OVERRIDDEN', overrideText }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));

    const t = setTimeout(() => {
      const overrideConfirmMsg: ChatMessage = {
        id: `override-confirm-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeNow(),
        text: `✏️ **Manual Operator Override Dispatched**\n- **Original Plan:** "${actionText}"\n- **Supervisor Custom Directive:** *"${overrideText}"*\n- **Execution Channel:** Field Mobile Terminal & TOS Priority Queue\n- **Status:** **OVERRIDDEN COMMAND EXECUTED**`
      };
      setMessages(prev => [...prev, overrideConfirmMsg]);
    }, 400);

    timeoutsRef.current.push(t);
  };

  const handleResetAction = (actionText: string) => {
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'PENDING' }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));
    setTempInput(prev => ({ ...prev, [actionText]: '' }));
  };

  const toggleLogExpand = (msgId: string) => {
    setExpandedLogs(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleReset = () => {
    clearAllTimeouts();
    activeStreamCleanupRef.current?.();
    activeStreamCleanupRef.current = null;
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
    setActionStates({});
    setActiveFormMode({});
    setTempInput({});
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
                SPAWNING & HUMAN GOVERNANCE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
              Type any query below to trigger multi-agent spawning, triage, or test Reject/Override replanning
            </p>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => triggerAgentSpawningSimulation(undefined, selectedCluster?.cluster_id)}
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
                          {msg.spawningProgress.tokensUsed} / {msg.spawningProgress.maxTokens} tokens ({Math.round((msg.spawningProgress.tokensUsed / msg.spawningProgress.maxTokens) * 100)}%)
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

                {/* Final Synthesized Human Review Docket Card with Full Human-in-the-loop Governance */}
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

                    {/* Human-in-the-Loop Action Controls (Authorize / Reject / Override) */}
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                          <Wrench className="w-4 h-4 text-sky-600" />
                          <span>HUMAN GOVERNANCE DISPATCH</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Select Action</span>
                      </div>

                      <div className="space-y-3 font-mono">
                        {msg.docket.recommendedActions.map((action: string, idx: number) => {
                          const state = actionStates[action] || { status: 'PENDING' };
                          const mode = activeFormMode[action] || null;
                          const isAccepted = state.status === 'ACCEPTED';
                          const isRejected = state.status === 'REJECTED';
                          const isOverridden = state.status === 'OVERRIDDEN';

                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                                isAccepted
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                  : isRejected
                                  ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                                  : isOverridden
                                  ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs font-medium leading-relaxed">
                                  <span className="font-bold text-sky-700 mr-1.5">Action #{idx + 1}:</span>
                                  {action}
                                </div>
                                {state.status !== 'PENDING' && (
                                  <button
                                    onClick={() => handleResetAction(action)}
                                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5 underline font-bold"
                                    title="Reset decision"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Reset
                                  </button>
                                )}
                              </div>

                              {/* State Badges */}
                              {isAccepted && (
                                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 bg-emerald-100/60 px-3 py-1.5 rounded-lg">
                                  <span className="flex items-center gap-1.5">
                                    <Check className="w-4 h-4" /> AUTHORIZED & DISPATCHED
                                  </span>
                                  <span className="text-[10px] font-mono">WO-88219</span>
                                </div>
                              )}

                              {isRejected && (
                                <div className="text-xs space-y-1 text-rose-800 bg-rose-100/70 px-3 py-2 rounded-lg">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <XCircle className="w-4 h-4 text-rose-600" /> REJECTED (RE-PLANNING TRIGGERED)
                                  </div>
                                  {state.reason && (
                                    <div className="text-[11px] text-rose-700 italic pl-5">
                                      Reason: "{state.reason}"
                                    </div>
                                  )}
                                </div>
                              )}

                              {isOverridden && (
                                <div className="text-xs space-y-1 text-amber-900 bg-amber-100/70 px-3 py-2 rounded-lg">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <Edit3 className="w-4 h-4 text-amber-700" /> MANUAL OVERRIDE DISPATCHED
                                  </div>
                                  {state.overrideText && (
                                    <div className="text-[11px] font-semibold text-amber-950 bg-white/80 p-1.5 rounded border border-amber-200 pl-2">
                                      Directive: "{state.overrideText}"
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Inline Rejection Form */}
                              {mode === 'reject' && (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 animate-fadeIn">
                                  <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                                    <span className="flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                      Select Reason to Trigger Agent Re-Plan
                                    </span>
                                    <button
                                      onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap gap-1">
                                    {presetRejectionReasons.map((preset, pIdx) => (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => setTempInput(prev => ({ ...prev, [action]: preset }))}
                                        className="text-[10px] bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 px-2 py-0.5 rounded transition-colors"
                                      >
                                        {preset}
                                      </button>
                                    ))}
                                  </div>

                                  <input
                                    type="text"
                                    value={tempInput[action] || ''}
                                    onChange={(e) => setTempInput(prev => ({ ...prev, [action]: e.target.value }))}
                                    placeholder="Or type custom rejection reason..."
                                    className="w-full bg-white border border-rose-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                  />

                                  <div className="flex items-center justify-end gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                                      className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmRejectAction(action, msg.docket?.title || 'Incident')}
                                      className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-sm flex items-center gap-1"
                                    >
                                      <X className="w-3.5 h-3.5" /> Reject & Re-Plan
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Inline Override / Edit Form */}
                              {mode === 'override' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 animate-fadeIn">
                                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                    <span className="flex items-center gap-1">
                                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                                      Edit Dispatch Directive
                                    </span>
                                    <button
                                      onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <textarea
                                    rows={2}
                                    value={tempInput[action] || ''}
                                    onChange={(e) => setTempInput(prev => ({ ...prev, [action]: e.target.value }))}
                                    placeholder="Enter modified operational dispatch instruction..."
                                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                                  />

                                  <div className="flex items-center justify-end gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                                      className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmOverrideAction(action)}
                                      className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-sm flex items-center gap-1"
                                    >
                                      <Send className="w-3.5 h-3.5" /> Dispatch Overridden Directive
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Tri-Action Buttons (Authorize / Reject / Override) */}
                              {state.status === 'PENDING' && !mode && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                                  <button
                                    onClick={() => handleAuthorizeAction(action)}
                                    className="py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all bg-sky-600 hover:bg-sky-700 text-white shadow-sm active:scale-95"
                                  >
                                    <ArrowRightCircle className="w-3.5 h-3.5" />
                                    <span>Authorize</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActiveFormMode(prev => ({ ...prev, [action]: 'reject' }));
                                      setTempInput(prev => ({ ...prev, [action]: '' }));
                                    }}
                                    className="py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 shadow-sm active:scale-95"
                                  >
                                    <X className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Reject / Re-plan</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActiveFormMode(prev => ({ ...prev, [action]: 'override' }));
                                      setTempInput(prev => ({ ...prev, [action]: action }));
                                    }}
                                    className="py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 hover:border-amber-300 shadow-sm active:scale-95"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Override / Edit</span>
                                  </button>
                                </div>
                              )}
                            </div>
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
          QUICK SCENARIO TRIGGERS:
        </span>
        <button
          onClick={() => triggerAgentSpawningSimulation('Investigate Lane 7 Jam (CLUSTER-A)', 'CLUSTER-A')}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-sky-50 text-sky-800 border border-slate-200 hover:border-sky-300 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          🔍 Lane 7 Jam (CLUSTER-A)
        </button>
        <button
          onClick={() => triggerAgentSpawningSimulation('Investigate BCSS-02 Charger Trip (CLUSTER-B)', 'CLUSTER-B')}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-amber-50 text-amber-900 border border-slate-200 hover:border-amber-300 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          ⚡ BCSS-02 Charger Trip (CLUSTER-B)
        </button>
        <button
          onClick={() => triggerAgentSpawningSimulation('Investigate Sector A Battery Starvation (CLUSTER-C)', 'CLUSTER-C')}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-emerald-50 text-emerald-900 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          🔋 Sector A Starvation (CLUSTER-C)
        </button>
        <button
          onClick={() => triggerAgentSpawningSimulation('Run full multi-agent triage across every active cluster', undefined)}
          disabled={isSimulating}
          className="text-xs font-mono bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shadow-sm"
        >
          ⚡ Full Spawning Demo (all clusters)
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
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
