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
import { MarkdownRenderer } from './MarkdownRenderer';

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
    toolsUsed: { tool: string; args: Record<string, any> }[];
    logs: string[];
  };
  docket?: DocketItem;
}

interface ChatInterfaceProps {
  selectedCluster?: ClusterWithAlerts | null;
  onBackToDocket: () => void;
}

interface TurnGroup {
  id: string;
  userMessage?: ChatMessage;
  trajectoryMessages: ChatMessage[];
  finalMessages: ChatMessage[];
}

const isTrajectoryMessage = (msg: ChatMessage): boolean => {
  if (msg.isSpawningAnimation) return true;
  if (msg.text && (
    msg.text.includes('Assigning Investigator Agent') ||
    msg.text.includes('Operator Feedback Ingested: Re-planning Triggered') ||
    msg.text.includes('Correlation agent:') ||
    msg.text.includes('Dynamic Alternative Tool Query')
  )) {
    return true;
  }
  return false;
};

const groupMessagesIntoTurns = (messages: ChatMessage[]): TurnGroup[] => {
  const turns: TurnGroup[] = [];
  let currentTurn: TurnGroup = {
    id: 'turn-initial',
    trajectoryMessages: [],
    finalMessages: [],
  };

  messages.forEach((msg) => {
    if (msg.sender === 'user') {
      if (currentTurn.userMessage || currentTurn.trajectoryMessages.length > 0 || currentTurn.finalMessages.length > 0) {
        turns.push(currentTurn);
      }
      currentTurn = {
        id: msg.id,
        userMessage: msg,
        trajectoryMessages: [],
        finalMessages: [],
      };
    } else {
      if (isTrajectoryMessage(msg)) {
        currentTurn.trajectoryMessages.push(msg);
      } else {
        currentTurn.finalMessages.push(msg);
      }
    }
  });

  if (currentTurn.userMessage || currentTurn.trajectoryMessages.length > 0 || currentTurn.finalMessages.length > 0) {
    turns.push(currentTurn);
  }

  return turns;
};

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;

export const stripEmojis = (text: string): string => {
  if (!text) return text;
  return text.replace(EMOJI_REGEX, '').trim();
};

export const sanitizeDocket = (docket: DocketItem): DocketItem => {
  return {
    ...docket,
    title: stripEmojis(docket.title),
    impact: stripEmojis(docket.impact),
    rootCause: stripEmojis(docket.rootCause),
    physicalEvidence: (docket.physicalEvidence || []).map(ev => ({
      ...ev,
      text: stripEmojis(ev.text)
    })),
    recommendedActions: (docket.recommendedActions || []).map(a => stripEmojis(a)),
    plcRegisters: (docket.plcRegisters || []).map(r => ({
      ...r,
      description: stripEmojis(r.description),
      name: stripEmojis(r.name)
    }))
  };
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  selectedCluster, 
  onBackToDocket 
}) => {
  const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      timestamp: timeNow(),
      text: selectedCluster
        ? `**Welcome to PSA Incident Sherlock.**\n\nTarget Incident: **${selectedCluster.cluster_id}: ${selectedCluster.name}** (${selectedCluster.primary_location}).`
        : '**Welcome to PSA Incident Sherlock.**\n\nType any inquiry below (e.g. *"Investigate Lane 7 bottleneck"*, *"What caused the BCSS-02 trip?"*) or click a quick scenario trigger above to start multi-agent triage.',
    }
  ]);

  const [inputValue, setInputValue] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [expandedTrajectories, setExpandedTrajectories] = useState<Record<string, boolean>>({});

  // Human-in-the-loop Action States
  const [actionStates, setActionStates] = useState<Record<string, ActionReviewState>>({});
  const [activeFormMode, setActiveFormMode] = useState<Record<string, 'reject' | 'override' | null>>({});
  const [tempInput, setTempInput] = useState<Record<string, string>>({});

  const toggleTrajectory = (turnId: string) => {
    setExpandedTrajectories(prev => ({
      ...prev,
      [turnId]: !prev[turnId]
    }));
  };

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

  // Auto-trigger on mount or when selectedCluster changes (Strict-mode safe)
  useEffect(() => {
    if (!selectedCluster?.cluster_id) return;

    let isSubscribed = true;
    const clusterId = selectedCluster.cluster_id;

    console.log('[ChatInterface] Triggering triage for:', clusterId);
    setIsSimulating(true);

    const userMsgText = `Run Agentic AI investigation for ${clusterId}`;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: timeNow(),
      text: userMsgText,
    };

    const coordMsg: ChatMessage = {
      id: `coord-${Date.now()}`,
      sender: 'assistant',
      timestamp: timeNow(),
      text: `**Assigning Investigator Agent**\n- Running open clustering over live \`raw_alerts\` from Supabase.\n- Routing **${clusterId}** to the investigator agent assigned by its problem type.`
    };

    setMessages(prev => {
      if (prev.some(m => m.text === userMsgText)) return prev;
      return [...prev, userMsg, coordMsg];
    });

    const cleanup = streamInvestigation(
      clusterId,
      (event: StreamEvent) => {
        if (!isSubscribed) return;
        if (event.node === 'started') return;

        if (event.node === 'error') {
          setMessages(prev => [...prev, {
            id: `stream-error-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            text: `**Investigation failed on the backend:**\n\`${event.output?.message || 'Unknown error'}\`\n\nCheck the \`uvicorn agent.server:app\` terminal for the full traceback.`,
          }]);
          setIsSimulating(false);
          return;
        }

        if (event.node === 'complete') {
          const result: InvestigateResult = event.output;
          if (result.dockets.length === 0) {
            setMessages(prev => [...prev, {
              id: `docket-empty-${Date.now()}`,
              sender: 'assistant',
              timestamp: timeNow(),
              text: `Investigation finished but produced no docket — check that ${clusterId} still exists in incident_clusters.`,
            }]);
          } else {
            result.dockets.forEach((docket, i) => {
              setMessages(prev => [...prev, {
                id: `docket-${Date.now()}-${i}`,
                sender: 'assistant',
                timestamp: timeNow(),
                text: `**Investigation complete:** synthesized into a Human Review Docket.`,
                docket: sanitizeDocket(docket),
              }]);
            });
          }
          setIsSimulating(false);
          return;
        }

        if (event.node.endsWith('_investigator') || event.node === 'investigator') {
          const finding = event.output.investigator_findings?.[0];
          if (!finding) return;
          const agentLabel = stripEmojis(finding.assigned_agent || (event.node === 'investigator' ? 'Domain Investigator' : event.node));
          const rootCauseClean = stripEmojis(finding.root_cause || '');
          const roleClean = stripEmojis(finding.title || '');
          const evidenceClean = ((finding.evidence_items as string[]) || []).map(e => stripEmojis(e));

          setMessages(prev => [...prev, {
            id: `spawn-${event.node}-${finding.incident_id}-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            isSpawningAnimation: true,
            spawningProgress: {
              stage: 2,
              stageText: `${agentLabel} finished investigating ${stripEmojis(finding.cluster_name)} (${finding.incident_id})`,
              agentName: agentLabel,
              agentRole: roleClean,
              cluster: finding.incident_id,
              toolsUsed: (finding.tools_used as { tool: string; args: Record<string, any> }[]) || [],
              logs: [
                `Root cause: ${rootCauseClean}`,
                ...evidenceClean,
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
              text: `**Correlation agent:** found ${groups.length} linked incident group(s) — ${groups.map((g: any) => stripEmojis(g.reason)).join('; ')}`,
            }]);
          }
        }
      },
      (err) => {
        if (!isSubscribed) return;
        console.error('SSE Stream error:', err);
        setMessages(prev => [...prev, {
          id: `stream-err-${Date.now()}`,
          sender: 'assistant',
          timestamp: timeNow(),
          text: `**Stream connection to backend failed.**\nEnsure \`uvicorn agent.server:app --port 8000\` is running.`,
        }]);
        setIsSimulating(false);
      }
    );

    return () => {
      isSubscribed = false;
      cleanup();
      setIsSimulating(false);
    };
  }, [selectedCluster?.cluster_id]);

  /**
   * Runs a manual investigation query (e.g. from user text input or quick scenario trigger buttons).
   */
  const triggerAgentSpawningSimulation = (
    customQuery?: string,
    clusterId?: string | null
  ) => {
    console.log('[ChatInterface] triggerAgentSpawningSimulation executing for clusterId:', clusterId);
    activeStreamCleanupRef.current?.();
    setIsSimulating(true);

    const clusterLabel = clusterId || 'every active cluster';
    const userMsgText = customQuery || `Run Agentic AI investigation for ${clusterLabel}`;
    
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: timeNow(),
      text: userMsgText,
    };

    const coordMsg: ChatMessage = {
      id: `coord-${Date.now()}`,
      sender: 'assistant',
      timestamp: timeNow(),
      text: `**Assigning Investigator Agent**\n- Running open clustering over live \`raw_alerts\` from Supabase.\n- Routing **${clusterLabel}** to the investigator agent assigned by its problem type.`
    };

    setMessages(prev => {
      if (prev.some(m => m.text === userMsgText)) return prev;
      return [...prev, userMsg, coordMsg];
    });

    const finish = () => {
      setIsSimulating(false);
      activeStreamCleanupRef.current = null;
    };

    activeStreamCleanupRef.current = streamInvestigation(
      clusterId,
      (event: StreamEvent) => {
        if (event.node === 'started') return;

        if (event.node === 'error') {
          setMessages(prev => [...prev, {
            id: `stream-error-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            text: `**Investigation failed on the backend:**\n\`${event.output?.message || 'Unknown error'}\`\n\nCheck the \`uvicorn agent.server:app\` terminal for the full traceback.`,
          }]);
          finish();
          return;
        }

        if (event.node === 'complete') {
          const result: InvestigateResult = event.output;
          if (result.dockets.length === 0) {
            setMessages(prev => [...prev, {
              id: `docket-empty-${Date.now()}`,
              sender: 'assistant',
              timestamp: timeNow(),
              text: `Investigation finished but produced no docket — check that ${clusterLabel} still exists in incident_clusters.`,
            }]);
          } else {
            result.dockets.forEach((docket, i) => {
              setMessages(prev => [...prev, {
                id: `docket-${Date.now()}-${i}`,
                sender: 'assistant',
                timestamp: timeNow(),
                text: `**Investigation complete:** synthesized into a Human Review Docket.`,
                docket: sanitizeDocket(docket),
              }]);
            });
          }
          finish();
          return;
        }

        if (event.node.endsWith('_investigator') || event.node === 'investigator') {
          const finding = event.output.investigator_findings?.[0];
          if (!finding) return;
          const agentLabel = stripEmojis(finding.assigned_agent || (event.node === 'investigator' ? 'Domain Investigator' : event.node));
          const rootCauseClean = stripEmojis(finding.root_cause || '');
          const roleClean = stripEmojis(finding.title || '');
          const evidenceClean = ((finding.evidence_items as string[]) || []).map(e => stripEmojis(e));

          setMessages(prev => [...prev, {
            id: `spawn-${event.node}-${finding.incident_id}-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            isSpawningAnimation: true,
            spawningProgress: {
              stage: 2,
              stageText: `${agentLabel} finished investigating ${stripEmojis(finding.cluster_name)} (${finding.incident_id})`,
              agentName: agentLabel,
              agentRole: roleClean,
              cluster: finding.incident_id,
              toolsUsed: (finding.tools_used as { tool: string; args: Record<string, any> }[]) || [],
              logs: [
                `Root cause: ${rootCauseClean}`,
                ...evidenceClean,
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
              text: `**Correlation agent:** found ${groups.length} linked incident group(s) — ${groups.map((g: any) => stripEmojis(g.reason)).join('; ')}`,
            }]);
          }
        }
      },
      (err) => {
        console.error('SSE Stream error:', err);
        setMessages(prev => [...prev, {
          id: `stream-err-${Date.now()}`,
          sender: 'assistant',
          timestamp: timeNow(),
          text: `**Stream connection to backend failed.**\nEnsure \`uvicorn agent.server:app --port 8000\` is running.`,
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
      text: `**[HUMAN-IN-THE-LOOP OVERRIDE]** Rejected recommendation:\n*"${rejectedAction}"*\n\n**Operator Stated Reason:** ${reason}`,
    };
    setMessages(prev => [...prev, userMsg]);

    // Step 1: Agent Re-planning Acknowledgment
    const t1 = setTimeout(() => {
      const replanAckMsg: ChatMessage = {
        id: `replan-ack-${Date.now()}`,
        sender: 'assistant',
        timestamp: timeNow(),
        text: `**Operator Feedback Ingested: Re-planning Triggered**\n- Human constraint recorded: *"${reason}"*.\n- Coordinator updating topological graph & querying alternative MCP resolution pathways...`
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
            toolsUsed: [{ tool: 'get_alternate_bypass_routing', args: { from: 'Lane-07', via: 'Lane-06' } }],
            logs: [
              `Discarded original constraint path: "${rejectedAction}"`,
              'Topo query: Calculated Lane 6 bypass clearance (Headway: 42m available)',
              'Automated hydraulic back-pressure cycle simulated: 3x pulses @ 290 bar',
              'Secondary resolution docket generated with zero human crew dependency'
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
            text: `**Revised Resolution Docket Synthesized (Rev. 2):**\nIncorporated your operational constraints. You can now authorize or adjust the alternative bypass actions below.`,
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

    const currentText = inputValue;
    setInputValue('');

    // No fixed cluster ids exist any more — Stage 1 now generates a fresh
    // "INC-YYYY-MMDD-NNNN" id per run from whatever's actually in
    // raw_alerts (see clustering/filter.py's generate_incident_id()), so a
    // keyword-to-hardcoded-id guess can never reliably match. Free text
    // always investigates every incident Stage 1 currently finds.
    triggerAgentSpawningSimulation(currentText, undefined);
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
        text: `**Operational Action Authorized & Dispatched**\n- **Command:** "${actionText}"\n- **Field Unit:** Tuas Sector A Operations Team #2\n- **Work Order Reference:** WO-88219 (Priority High)\n- **Status:** **DISPATCHED & EXECUTING (ETA: 3m 30s)**`
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
        text: `**Manual Operator Override Dispatched**\n- **Original Plan:** "${actionText}"\n- **Supervisor Custom Directive:** *"${overrideText}"*\n- **Execution Channel:** Field Mobile Terminal & TOS Priority Queue\n- **Status:** **OVERRIDDEN COMMAND EXECUTED**`
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
        text: '**Welcome to PSA Incident Sherlock.**\n\nType any inquiry below (e.g. *"Investigate Lane 7 bottleneck"*, *"What caused the BCSS-02 trip?"*, or *"Simulate agent spawning"*) and press **Enter** to watch the multi-agent spawning and triage animation.',
      }
    ]);
    setActionStates({});
    setActiveFormMode({});
    setTempInput({});
    setExpandedTrajectories({});
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-6.5rem)] md:h-[calc(100vh-7.5rem)] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      
      {/* Top Sherlock Header Bar */}
      <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToDocket}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 shadow-sm transition-colors flex items-center space-x-1.5 text-xs font-mono font-bold whitespace-nowrap active:scale-95 cursor-pointer"
            title="Return to Incident Queue"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Incident Queue</span>
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-wide font-sans">
                PSA INCIDENT SHERLOCK
              </h2>
              <span className="bg-sky-100 text-sky-700 border border-sky-200 text-[10px] px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap">
                RESPONSIBLE AI
              </span>
            </div>
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
            <span>{isSimulating ? 'Spawning Agents...' : 'Re-trigger Agents Demo'}</span>
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
        {groupMessagesIntoTurns(messages).map((turn) => {
          const isExpanded = !!expandedTrajectories[turn.id];
          const totalLogs = turn.trajectoryMessages.reduce((sum, m) => sum + (m.spawningProgress?.logs?.length || 0), 0);
          const subAgentCount = turn.trajectoryMessages.filter(m => m.isSpawningAnimation).length;

          return (
            <div key={turn.id} className="space-y-4">
              {/* User Prompt Message */}
              {turn.userMessage && (
                <div className="flex items-start space-x-3.5 flex-row-reverse space-x-reverse">
                  <div className="p-2 rounded-xl border flex-shrink-0 shadow-sm bg-sky-600 text-white border-sky-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="space-y-3 flex-1 min-w-0 max-w-[85%] md:max-w-2xl ml-auto">
                    <div className="p-4 rounded-2xl text-xs leading-relaxed font-sans shadow-sm bg-sky-600 text-white rounded-tr-none font-medium">
                      <MarkdownRenderer content={turn.userMessage.text || ''} isUser={true} />
                      <div className="text-[10px] mt-2 font-mono text-sky-100">
                        {turn.userMessage.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Assistant Triage & Synthesis Response */}
              {(turn.trajectoryMessages.length > 0 || turn.finalMessages.length > 0) && (
                <div className="flex items-start space-x-3.5">
                  <div className="p-2 rounded-xl border flex-shrink-0 shadow-sm bg-white text-sky-600 border-slate-200">
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="space-y-3.5 flex-1 min-w-0 w-full">
                    {/* Collapsible Multi-Agent Trajectory Accordion (Intentionally hidden at 1st sight) */}
                    {turn.trajectoryMessages.length > 0 && (
                      <div className="w-full">
                        {/* Dropdown Header Pill (Inspired by Agent Thinking Trajectory) */}
                        <button
                          type="button"
                          onClick={() => toggleTrajectory(turn.id)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all text-xs font-mono shadow-2xs group cursor-pointer ${
                            isExpanded
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="p-1 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex-shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex items-center space-x-2 truncate">
                              <span className="font-bold text-slate-800">
                                View Investigation Steps
                              </span>
                              <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">
                                ({turn.trajectoryMessages.length} step{turn.trajectoryMessages.length > 1 ? 's' : ''}{subAgentCount > 0 ? ` · ${subAgentCount} domain investigator` : ''}{totalLogs > 0 ? ` · ${totalLogs} diagnostic logs` : ''})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 text-slate-500 group-hover:text-slate-900 text-xs font-sans flex-shrink-0 pl-2">
                            <span className="text-[11px] font-medium hidden sm:inline">{isExpanded ? 'Hide triage steps' : 'View triage steps'}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                          </div>
                        </button>

                        {/* Expanded Trajectory Detail Content - Clean Timeline (No nested card-in-card) */}
                        {isExpanded && (
                          <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3 animate-fadeIn text-xs font-mono">
                            <div className="border-l-2 border-sky-300 pl-3.5 ml-1 space-y-3">
                              {turn.trajectoryMessages.map((tMsg) => (
                                <div key={tMsg.id} className="space-y-2">
                                  {/* Coordinator or Correlation Step */}
                                  {tMsg.text && (
                                    <div className="text-slate-700 leading-relaxed font-sans text-xs bg-white/80 p-2.5 rounded-lg border border-slate-200/70">
                                      <MarkdownRenderer content={tMsg.text} />
                                      <div className="text-[10px] mt-1 font-mono text-slate-400">
                                        {tMsg.timestamp}
                                      </div>
                                    </div>
                                  )}

                                  {/* Sub-Agent Spawning Sandbox - Streamlined */}
                                  {tMsg.isSpawningAnimation && tMsg.spawningProgress && (
                                    <div className="bg-white/90 border border-slate-200 p-3 rounded-xl space-y-2.5">
                                      <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-100">
                                        <div className="flex items-center space-x-2">
                                          <Layers className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                                          <span className="font-bold text-slate-900">{tMsg.spawningProgress.agentName}</span>
                                          <span className="text-[11px] text-slate-500 font-sans">({tMsg.spawningProgress.agentRole})</span>
                                        </div>
                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                                          0% CONTAMINATION
                                        </span>
                                      </div>

                                      <div className="text-[11px] text-slate-600 px-1 space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                          <Activity className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span>MCP Tools Called ({tMsg.spawningProgress.toolsUsed.length}):</span>
                                        </div>
                                        {tMsg.spawningProgress.toolsUsed.length === 0 ? (
                                          <div className="pl-4 text-slate-400 italic">No tool calls recorded.</div>
                                        ) : (
                                          <ul className="pl-4 space-y-0.5">
                                            {tMsg.spawningProgress.toolsUsed.map((t, i) => (
                                              <li key={i} className="font-bold text-slate-800 truncate">
                                                {t.tool}
                                                {Object.keys(t.args || {}).length > 0 && (
                                                  <span className="font-normal text-slate-500">
                                                    ({Object.entries(t.args).map(([k, v]) => `${k}=${v}`).join(', ')})
                                                  </span>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>

                                      {/* Diagnostic Schema Logs */}
                                      <div className="pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleLogExpand(tMsg.id)}
                                          className="text-[11px] text-sky-700 hover:text-sky-800 font-semibold flex items-center space-x-1 cursor-pointer"
                                        >
                                          <span>Diagnostic Logs ({tMsg.spawningProgress.logs.length})</span>
                                          {expandedLogs[tMsg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>

                                        {expandedLogs[tMsg.id] && (
                                          <div className="mt-2 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                                            {tMsg.spawningProgress.logs.map((log, i) => (
                                              <div key={i} className="text-slate-700 py-0.5">
                                                <MarkdownRenderer content={log} />
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Final Assistant Response in Turn (Unified, Single-Container Presentation) */}
                    {turn.finalMessages.map((fMsg) => (
                      <div key={fMsg.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-xs font-sans space-y-4 text-slate-800 w-full animate-fadeIn">
                        {/* Text Lead */}
                        {fMsg.text && (
                          <div className="leading-relaxed text-slate-800">
                            <MarkdownRenderer content={fMsg.text} isUser={false} />
                          </div>
                        )}

                        {/* Integrated Synthesized Human Review Docket */}
                        {fMsg.docket && (
                          <div className="space-y-4 pt-1">
                            {/* Title & Severity Row */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                              <div className="flex items-center space-x-2">
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                  fMsg.docket.severity === 'CRITICAL' 
                                    ? 'bg-rose-100 text-rose-800' 
                                    : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {fMsg.docket.severity} SEVERITY
                                </span>
                                <h3 className="font-bold text-sm text-slate-900 font-sans">
                                  {fMsg.docket.title}
                                </h3>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">DOCKET ID: {fMsg.docket.id}</span>
                            </div>

                            {/* Verified Root Cause - Clean Left Accent */}
                            <div className="border-l-3 border-sky-500 bg-sky-50/60 p-3 rounded-r-xl space-y-1">
                              <div className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5 font-mono">
                                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                                <span>AI VERIFIED ROOT CAUSE</span>
                              </div>
                              <div className="text-slate-800 leading-relaxed text-xs">
                                <MarkdownRenderer content={fMsg.docket.rootCause} />
                              </div>
                            </div>

                            {/* Hardware Evidence - Clean List (No nested cards) */}
                            {fMsg.docket.physicalEvidence && fMsg.docket.physicalEvidence.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold text-slate-700 font-mono flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>MULTIMODAL HARDWARE EVIDENCE</span>
                                </div>
                                <ul className="space-y-1.5 pl-0.5">
                                  {fMsg.docket.physicalEvidence.map((ev: { text: string; timestamp: string; verified: boolean }, i: number) => (
                                    <li key={i} className="flex items-start space-x-2 text-slate-700 text-xs leading-relaxed">
                                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                      <span className="flex-1"><MarkdownRenderer content={ev.text} /></span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Human Governance Actions - Clean Divided List */}
                            {fMsg.docket.recommendedActions && fMsg.docket.recommendedActions.length > 0 && (
                              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 font-mono">
                                  <span className="flex items-center gap-1.5">
                                    <Wrench className="w-3.5 h-3.5 text-sky-600" />
                                    <span>HUMAN IN THE LOOP</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-normal">Operator Action Required</span>
                                </div>

                                <div className="divide-y divide-slate-100 font-mono">
                                  {fMsg.docket.recommendedActions.map((action: string, idx: number) => {
                                    const state = actionStates[action] || { status: 'PENDING' };
                                    const mode = activeFormMode[action] || null;
                                    const isAccepted = state.status === 'ACCEPTED';
                                    const isRejected = state.status === 'REJECTED';
                                    const isOverridden = state.status === 'OVERRIDDEN';

                                    return (
                                      <div key={idx} className="py-2.5 space-y-2 first:pt-0 last:pb-0">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="text-xs text-slate-800 leading-relaxed flex-1 font-sans">
                                            <span className="font-bold text-sky-700 mr-1.5 font-mono">Action #{idx + 1}:</span>
                                            <MarkdownRenderer content={action} className="inline" />
                                          </div>

                                          {/* Action Status Badges or Trigger Buttons */}
                                          {isAccepted && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                                              <Check className="w-3.5 h-3.5" /> Authorized & Dispatched
                                            </div>
                                          )}

                                          {isRejected && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg shrink-0">
                                              <XCircle className="w-3.5 h-3.5" /> Rejected (Re-planning)
                                            </div>
                                          )}

                                          {isOverridden && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
                                              <Edit3 className="w-3.5 h-3.5" /> Manual Override
                                            </div>
                                          )}

                                          {state.status === 'PENDING' && !mode && (
                                            <div className="flex items-center space-x-1 shrink-0">
                                              <button
                                                onClick={() => handleAuthorizeAction(action)}
                                                className="px-2.5 py-1 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer"
                                              >
                                                <ArrowRightCircle className="w-3 h-3" /> Authorize
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setActiveFormMode(prev => ({ ...prev, [action]: 'reject' }));
                                                  setTempInput(prev => ({ ...prev, [action]: '' }));
                                                }}
                                                className="px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all active:scale-95 cursor-pointer"
                                                title="Reject recommendation and trigger re-plan"
                                              >
                                                Reject
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setActiveFormMode(prev => ({ ...prev, [action]: 'override' }));
                                                  setTempInput(prev => ({ ...prev, [action]: action }));
                                                }}
                                                className="px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 border border-amber-200 rounded-lg transition-all active:scale-95 cursor-pointer"
                                                title="Manually edit directive"
                                              >
                                                Edit
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {/* Status Detail Sub-notes */}
                                        {isRejected && state.reason && (
                                          <p className="text-[11px] text-rose-600 italic pl-3">
                                            Operator stated reason: "{state.reason}"
                                          </p>
                                        )}

                                        {isOverridden && state.overrideText && (
                                          <p className="text-[11px] text-amber-900 bg-amber-50/70 p-2 rounded-lg border border-amber-200 pl-3 font-mono">
                                            Directive: "{state.overrideText}"
                                          </p>
                                        )}

                                        {/* Inline Rejection Form */}
                                        {mode === 'reject' && (
                                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 animate-fadeIn font-mono text-xs">
                                            <div className="flex items-center justify-between font-bold text-rose-800">
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
                                                onClick={() => handleConfirmRejectAction(action, fMsg.docket?.title || 'Incident')}
                                                className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-sm flex items-center gap-1 cursor-pointer"
                                              >
                                                <X className="w-3.5 h-3.5" /> Reject & Re-Plan
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Inline Override Form */}
                                        {mode === 'override' && (
                                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 animate-fadeIn font-mono text-xs">
                                            <div className="flex items-center justify-between font-bold text-amber-900">
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
                                                className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-sm flex items-center gap-1 cursor-pointer"
                                              >
                                                <Send className="w-3.5 h-3.5" /> Dispatch Override
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-mono pt-1">
                          {fMsg.timestamp}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isSimulating && (
          <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 animate-pulse font-mono text-xs text-sky-900 w-full">
            <div className="p-2.5 bg-sky-100 border border-sky-300 rounded-xl text-sky-700 flex-shrink-0">
              <Zap className="w-4 h-4 animate-spin" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="font-bold flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-xs text-sky-950">
                  <Activity className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                  <span>Agent Triage in Progress (LangGraph & MCP)</span>
                </span>
                <span className="text-[10px] bg-sky-200/80 px-2 py-0.5 rounded text-sky-800 font-bold uppercase tracking-wider">
                  LIVE STREAMING
                </span>
              </div>
              <p className="text-slate-600 text-[11px] font-sans">
                Gathering telemetry, querying diagnostics tools, and formulating root cause...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Scenario Triggers Chips - Minimalist Prompt Pills */}
      <div className="px-5 py-2 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
        <span className="text-slate-400 uppercase font-bold flex-shrink-0 text-[10px] mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-sky-500" />
          <span>SUGGESTED:</span>
        </span>
        {/*
          The old per-cluster chips (Lane 7 Jam / BCSS-02 / Sector A) targeted
          hardcoded CLUSTER-A/B/C ids from the pre-open-clustering demo data.
          Stage 1 now generates a fresh INC-YYYY-MMDD-NNNN id per run from
          whatever raw_alerts actually contains, so a hardcoded id can never
          reliably match a real incident any more — removed rather than kept
          pointing at ids that no longer exist.
        */}
        <button
          type="button"
          onClick={() => triggerAgentSpawningSimulation('Run full multi-agent triage across every active incident', undefined)}
          disabled={isSimulating}
          className="bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap active:scale-95 cursor-pointer"
        >
          Run Investigation (all active incidents)
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
