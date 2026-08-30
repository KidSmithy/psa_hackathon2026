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
  Sliders,
  Video,
  Film
} from 'lucide-react';
import { DocketItem, ClusterWithAlerts } from '../types';
import { streamInvestigation, InvestigateResult, StreamEvent } from '../lib/api';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ActionReviewState {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN';
  reason?: string;
  overrideText?: string;
}

export interface LiveToolCall {
  id: string;
  tool: string;
  input?: any;
  output?: any;
  status: 'running' | 'completed';
  timestamp: string;
}

export interface LiveTriageState {
  activeNode: string;
  agentName: string;
  agentRole: string;
  currentPhase: number;
  phaseLabel: string;
  streamedThought: string;
  toolCalls: LiveToolCall[];
}

const INITIAL_LIVE_STATE: LiveTriageState = {
  activeNode: 'coordinator',
  agentName: 'System Coordinator',
  agentRole: 'Dynamic Incident Fan-Out & Routing',
  currentPhase: 1,
  phaseLabel: '1. Routing & Context Assignment',
  streamedThought: '',
  toolCalls: [],
};

const NODE_METADATA: Record<string, { name: string; role: string; phase: number; phaseLabel: string }> = {
  coordinator: {
    name: 'System Coordinator',
    role: 'Dynamic Incident Fan-Out & Routing',
    phase: 1,
    phaseLabel: '1. Routing & Context Assignment',
  },
  video_analysis: {
    name: 'CCTV Video Analyst Agent',
    role: 'Gemini Vision — Independent Footage Assessment',
    phase: 1,
    phaseLabel: '1. CCTV Footage Analysis',
  },
  orchestrator: {
    name: 'Orchestrator Agent',
    role: 'Investigator Selection from Cause, Telemetry & Footage',
    phase: 1,
    phaseLabel: '1. Orchestrator Agent Assignment',
  },
  aggregator: {
    name: 'Findings Aggregator',
    role: 'Multi-Specialist Reconciliation & Conflict Surfacing',
    phase: 3,
    phaseLabel: '3. Reconciling Specialist Findings',
  },
  lane_investigator: {
    name: 'Lane Operations Specialist',
    role: 'Transfer Lane Telemetry & PLC Register Diagnostics',
    phase: 2,
    phaseLabel: '2. MCP Telemetry & PLC Diagnostics',
  },
  power_investigator: {
    name: 'BCSS Power Specialist',
    role: 'Charger Telemetry & Thermal Overload Diagnostics',
    phase: 2,
    phaseLabel: '2. MCP Telemetry & PLC Diagnostics',
  },
  fleet_power_investigator: {
    name: 'Fleet Power Specialist',
    role: 'Fleet State-of-Charge & Grid Load Balancing',
    phase: 2,
    phaseLabel: '2. MCP Telemetry & PLC Diagnostics',
  },
  general_investigator: {
    name: 'General Systems Specialist',
    role: 'Multi-Domain Anomaly Triage',
    phase: 2,
    phaseLabel: '2. MCP Telemetry & PLC Diagnostics',
  },
  correlation: {
    name: 'Cross-Incident Correlation Agent',
    role: 'Causal Linkage & Shared-Root Synthesis',
    phase: 3,
    phaseLabel: '3. Cross-Incident Correlation',
  },
  submit_docket: {
    name: 'Human Review',
    role: 'TOS Action Dispatch & Docket Synthesis',
    phase: 4,
    phaseLabel: '4. Synthesizing Human Review Docket',
  },
};

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
    msg.text.includes('Operator Feedback Ingested: Re-planning Triggered') ||
    msg.text.includes('Correlation agent:') ||
    msg.text.includes('CCTV Video Analyst Agent:') ||
    msg.text.includes('Orchestrator Agent:') ||
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
    })),
    videoEvidence: (docket.videoEvidence || []).map(v => ({
      ...v,
      summary: stripEmojis(v.summary || ''),
      description: stripEmojis(v.description || ''),
      observations: (v.observations || []).map(o => ({
        ...o,
        what_happens: stripEmojis(o.what_happens || '')
      }))
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
        ? `**Welcome to Port Incident Sherlock.**\n\nTarget Incident: **${selectedCluster.cluster_id}: ${selectedCluster.name}** (${selectedCluster.primary_location}).`
        : '**Welcome to Port Incident Sherlock.**\n\nClick a quick scenario trigger above to start multi-agent triage.',
    }
  ]);

  const [inputValue, setInputValue] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [liveTriageState, setLiveTriageState] = useState<LiveTriageState>(INITIAL_LIVE_STATE);
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
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeStreamCleanupRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thoughtScrollRef = useRef<HTMLDivElement>(null);
  const toolsScrollRef = useRef<HTMLDivElement>(null);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: isSimulating ? 'auto' : 'smooth' });
    if (thoughtScrollRef.current) {
      thoughtScrollRef.current.scrollTop = thoughtScrollRef.current.scrollHeight;
    }
    if (toolsScrollRef.current) {
      toolsScrollRef.current.scrollTop = toolsScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSimulating, activeFormMode, liveTriageState.streamedThought, liveTriageState.toolCalls, liveTriageState.currentPhase]);

  // Clean up timeouts and any open SSE stream on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      activeStreamCleanupRef.current?.();
    };
  }, []);

  /**
   * Runs a live multi-agent investigation query over Server-Sent Events (SSE).
   */
  const triggerAgentSpawningSimulation = (
    customQuery?: string,
    clusterId?: string | null
  ) => {
    console.log('[ChatInterface] Starting investigation stream for clusterId:', clusterId);
    activeStreamCleanupRef.current?.();
    setIsSimulating(true);
    setLiveTriageState(INITIAL_LIVE_STATE);

    const clusterLabel = clusterId || 'every active cluster';
    const userMsgText = customQuery || `Run Agentic AI investigation for ${clusterLabel}`;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: timeNow(),
      text: userMsgText,
    };

    setMessages(prev => {
      if (prev.some(m => m.text === userMsgText)) return prev;
      return [...prev, userMsg];
    });

    const finish = () => {
      setIsSimulating(false);
      activeStreamCleanupRef.current = null;
    };

    activeStreamCleanupRef.current = streamInvestigation(
      clusterId,
      (event: StreamEvent) => {
        // 1. Started
        if (event.node === 'started' || (event.type === 'node_status' && event.node === 'started')) {
          setLiveTriageState(INITIAL_LIVE_STATE);
          return;
        }

        // 2. Stream Error
        if (event.type === 'error' || event.node === 'error') {
          setMessages(prev => [...prev, {
            id: `stream-error-${Date.now()}`,
            sender: 'assistant',
            timestamp: timeNow(),
            text: `**Investigation failed on the backend:**\n\`${event.output?.message || 'Unknown error'}\`\n\nCheck the backend logs for details.`,
          }]);
          setLiveTriageState(INITIAL_LIVE_STATE);
          finish();
          return;
        }

        // 3. Node State Transitions
        if (event.type === 'node_status' || (event.status === 'running' && event.node)) {
          const nodeKey = event.node || 'coordinator';
          const meta = NODE_METADATA[nodeKey] || {
            name: nodeKey,
            role: 'Active Domain Sub-Graph Worker',
            phase: 2,
            phaseLabel: `Running ${nodeKey}`,
          };
          setLiveTriageState(prev => ({
            ...prev,
            activeNode: nodeKey,
            agentName: meta.name,
            agentRole: meta.role,
            currentPhase: Math.max(prev.currentPhase, meta.phase),
            phaseLabel: meta.phaseLabel,
          }));
          return;
        }

        // 4. Live Streamed AI Thoughts / Reasoning
        if (event.type === 'thought' && event.chunk) {
          setLiveTriageState(prev => ({
            ...prev,
            streamedThought: prev.streamedThought + event.chunk,
            currentPhase: Math.max(prev.currentPhase, 3),
            phaseLabel: '3. AI Reasoning & Hypothesis Formulation',
          }));
          return;
        }

        // 5. Real-Time MCP Tool Call Started
        if (event.type === 'tool_start' && event.tool) {
          const newToolCall: LiveToolCall = {
            id: `tool-${event.tool}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            tool: event.tool,
            input: event.input,
            status: 'running',
            timestamp: event.timestamp || timeNow(),
          };
          setLiveTriageState(prev => ({
            ...prev,
            currentPhase: Math.max(prev.currentPhase, 2),
            phaseLabel: `2. Executing MCP Tool: ${event.tool}`,
            toolCalls: [...prev.toolCalls, newToolCall],
          }));
          return;
        }

        // 6. Real-Time MCP Tool Call Completed
        if (event.type === 'tool_end' && event.tool) {
          setLiveTriageState(prev => {
            const toolCalls = [...prev.toolCalls];
            let updated = false;
            for (let i = toolCalls.length - 1; i >= 0; i--) {
              if (toolCalls[i].tool === event.tool && toolCalls[i].status === 'running') {
                toolCalls[i] = {
                  ...toolCalls[i],
                  status: 'completed',
                  output: event.output,
                };
                updated = true;
                break;
              }
            }
            if (!updated) {
              toolCalls.push({
                id: `tool-end-${event.tool || 'tool'}-${Date.now()}`,
                tool: event.tool || 'MCP Tool',
                output: event.output,
                status: 'completed',
                timestamp: event.timestamp || timeNow(),
              });
            }
            return {
              ...prev,
              toolCalls,
            };
          });
          return;
        }

        // 7. Node Findings / Sub-Graph Completed
        if (
          event.type === 'node_output' ||
          (event.node && (event.node.endsWith('_investigator') || event.node === 'investigator' || event.node === 'correlation'))
        ) {
          const nodeName = event.node || '';
          if (nodeName.endsWith('_investigator') || nodeName === 'investigator') {
            const finding = event.output?.investigator_findings?.[0];
            if (finding) {
              const agentLabel = stripEmojis(finding.assigned_agent || (nodeName === 'investigator' ? 'Domain Investigator' : nodeName));
              const roleClean = stripEmojis(finding.title || '');

              setMessages(prev => {
                const spawnId = `spawn-${nodeName}-${finding.incident_id}`;
                if (prev.some(m => m.id.startsWith(spawnId))) return prev;
                return [...prev, {
                  id: `${spawnId}-${Date.now()}`,
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
                  },
                }];
              });
            }
          } else if (nodeName === 'correlation') {
            const groups = event.output?.correlation?.linked_groups || [];
            if (groups.length > 0) {
              setMessages(prev => [...prev, {
                id: `corr-${Date.now()}`,
                sender: 'assistant',
                timestamp: timeNow(),
                text: `**Correlation agent:** found ${groups.length} linked incident group(s) — ${groups.map((g: any) => stripEmojis(g.reason)).join('; ')}`,
              }]);
            }
          } else if (nodeName === 'video_analysis') {
            const videoFindings: Record<string, any[]> = event.output?.video_findings || {};
            const incidentIds = Object.keys(videoFindings);
            if (incidentIds.length > 0) {
              const lines = incidentIds.flatMap((incidentId) =>
                (videoFindings[incidentId] || []).map((clip: any) =>
                  `- **${incidentId}**: ${clip.assessment || 'UNKNOWN'} (${clip.severity || 'NONE'}) — ${stripEmojis(clip.summary || '')}`
                )
              );
              setMessages(prev => [...prev, {
                id: `video-${Date.now()}`,
                sender: 'assistant',
                timestamp: timeNow(),
                text: `**CCTV Video Analyst Agent:** reviewed footage for ${incidentIds.length} incident(s)\n${lines.join('\n')}`,
              }]);
            }
          } else if (nodeName === 'orchestrator') {
            const orchestration: Record<string, any> = event.output?.orchestration || {};
            const incidentIds = Object.keys(orchestration);
            if (incidentIds.length > 0) {
              const lines = incidentIds.map((incidentId) => {
                const o = orchestration[incidentId];
                const domains = (o.domains || []).join(' + ') || 'general_investigator';
                const videoNote = o.had_video ? ' (video-informed)' : '';
                return `- **${incidentId}** → ${domains}${videoNote}: ${stripEmojis(o.rationale || '')}`;
              });
              setMessages(prev => [...prev, {
                id: `orch-${Date.now()}`,
                sender: 'assistant',
                timestamp: timeNow(),
                text: `**Orchestrator Agent:** assigned sub-agents (investigators) for ${incidentIds.length} incident(s)\n${lines.join('\n')}`,
              }]);
            }
          }
          return;
        }

        // 8. Investigation Complete -> Emit Final Docket
        if (event.type === 'complete' || event.node === 'complete') {
          const result: InvestigateResult = event.output;
          if (!result || result.dockets.length === 0) {
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
                text: '`Investigation complete:`',
                docket: sanitizeDocket(docket),
              }]);
            });
          }
          setLiveTriageState(INITIAL_LIVE_STATE);
          finish();
          return;
        }
      },
      (err) => {
        console.error('SSE Stream error:', err);
        setMessages(prev => [...prev, {
          id: `stream-err-${Date.now()}`,
          sender: 'assistant',
          timestamp: timeNow(),
          text: `**Stream connection to backend failed.**\nEnsure the backend server is reachable at \`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}\`.`,
        }]);
        setLiveTriageState(INITIAL_LIVE_STATE);
        finish();
      }
    );
  };

  // Auto-trigger on mount or when selectedCluster changes (Strict-mode safe)
  useEffect(() => {
    if (!selectedCluster?.cluster_id) return;
    const clusterId = selectedCluster.cluster_id;

    triggerAgentSpawningSimulation(
      `Run Agentic AI investigation for ${clusterId}`,
      clusterId
    );

    return () => {
      activeStreamCleanupRef.current?.();
      setIsSimulating(false);
      setLiveTriageState(INITIAL_LIVE_STATE);
    };
  }, [selectedCluster?.cluster_id]);


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
  };

  // Handle Reject Action
  const handleRejectAction = (actionText: string) => {
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'REJECTED' }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));
  };

  // Handle Override Action
  const handleConfirmOverrideAction = (actionText: string) => {
    const overrideText = tempInput[actionText]?.trim() || actionText;
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'OVERRIDDEN', overrideText }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));
  };

  const handleResetAction = (actionText: string) => {
    setActionStates(prev => ({
      ...prev,
      [actionText]: { status: 'PENDING' }
    }));
    setActiveFormMode(prev => ({ ...prev, [actionText]: null }));
    setTempInput(prev => ({ ...prev, [actionText]: '' }));
  };

  const handleReset = () => {
    clearAllTimeouts();
    activeStreamCleanupRef.current?.();
    activeStreamCleanupRef.current = null;
    isSimulatingRef.current = false;
    setIsSimulating(false);
    setLiveTriageState(INITIAL_LIVE_STATE);
    setMessages([
      {
        id: 'msg-welcome',
        sender: 'assistant',
        timestamp: '20:45:00',
        text: '**Welcome to Port Incident Sherlock.**\n\nClick a quick scenario trigger above to watch the multi-agent spawning and triage animation.',
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
                PORT INCIDENT SHERLOCK
              </h2>
              <span className="bg-sky-100 text-sky-700 border border-sky-200 text-[10px] px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap">
                RESPONSIBLE & TRANSPARENT AI
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
                                ({turn.trajectoryMessages.length} step{turn.trajectoryMessages.length > 1 ? 's' : ''}{subAgentCount > 0 ? ` · ${subAgentCount} domain investigator` : ''})
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

                            {/* CCTV Video Analysis & Footage */}
                            {fMsg.docket.videoEvidence && fMsg.docket.videoEvidence.length > 0 && (
                              <div className="space-y-3 pt-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 font-mono">
                                  <span className="flex items-center gap-1.5 text-sky-900">
                                    <Video className="w-3.5 h-3.5 text-sky-600" />
                                    <span>CCTV FOOTAGE & AI VIDEO ANALYSIS ({fMsg.docket.videoEvidence.length})</span>
                                  </span>
                                  <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-mono">
                                    Gemini 3.7 Flash VLM
                                  </span>
                                </div>

                                <div className="space-y-3">
                                  {fMsg.docket.videoEvidence.map((clip, cIdx) => {
                                    const videoSrc = clip.public_url || clip.uri || (clip.filename ? `http://localhost:8000/api/video/${clip.filename}` : '');
                                    const isIncident = clip.assessment === 'CONFIRMED_INCIDENT';
                                    const isHazard = clip.assessment === 'POTENTIAL_HAZARD';

                                    return (
                                      <div key={cIdx} className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 space-y-3 shadow-sm font-sans">
                                        {/* Header: Camera info & assessment badge */}
                                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                                          <div className="flex items-center space-x-2">
                                            <div className="p-1.5 bg-slate-800 text-sky-400 rounded-lg">
                                              <Film className="w-4 h-4" />
                                            </div>
                                            <div>
                                              <div className="font-bold text-xs text-slate-100">
                                                {clip.description || clip.filename || `Camera Clip #${cIdx + 1}`}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-mono">
                                                Zone: {clip.location || 'Port Yard'} {clip.filename ? `· ${clip.filename}` : ''}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center space-x-2">
                                            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                                              isIncident
                                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                                : isHazard
                                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                            }`}>
                                              {clip.assessment?.replace(/_/g, ' ') || 'ANALYZED'}
                                            </span>
                                            {typeof clip.confidence === 'number' && (
                                              <span className="text-[10px] text-slate-400 font-mono">
                                                {(clip.confidence * 100).toFixed(0)}% conf
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Video Player */}
                                        {videoSrc && (
                                          <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
                                            <video
                                              controls
                                              className="w-full max-h-64 object-contain rounded-lg bg-black"
                                              src={videoSrc}
                                              preload="metadata"
                                            >
                                              Your browser does not support the video tag.
                                            </video>
                                          </div>
                                        )}

                                        {/* AI Summary */}
                                        {clip.summary && (
                                          <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700/70 text-xs text-slate-200 leading-relaxed">
                                            <span className="font-bold text-sky-400 font-mono text-[11px] block mb-0.5">
                                              Visual AI Assessment:
                                            </span>
                                            {clip.summary}
                                          </div>
                                        )}

                                        {/* Key Observations */}
                                        {clip.observations && clip.observations.length > 0 && (
                                          <div className="space-y-1.5 text-xs">
                                            <div className="text-[11px] font-bold text-slate-400 font-mono">
                                              Temporal Timeline Observations:
                                            </div>
                                            <div className="space-y-1 pl-1">
                                              {clip.observations.map((obs, oIdx) => (
                                                <div key={oIdx} className="flex items-start space-x-2 text-[11px] text-slate-300">
                                                  <span className="bg-slate-800 text-sky-400 px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 border border-slate-700">
                                                    {obs.timestamp}
                                                  </span>
                                                  <span className="flex-1 leading-snug">{obs.what_happens}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Visual Cues & Entities */}
                                        {((clip.entities_involved && clip.entities_involved.length > 0) || (clip.visual_cues && clip.visual_cues.length > 0)) && (
                                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                                            {(clip.entities_involved || []).map((ent, eIdx) => (
                                              <span key={`ent-${eIdx}`} className="text-[10px] bg-sky-950/70 text-sky-300 border border-sky-800 px-2 py-0.5 rounded font-mono">
                                                🏷️ {ent}
                                              </span>
                                            ))}
                                            {(clip.visual_cues || []).map((cue, qIdx) => (
                                              <span key={`cue-${qIdx}`} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                                                👁️ {cue}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

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
                                    <span>SUGGESTED ACTIONS (HUMAN IN THE LOOP)</span>
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
                                              <Check className="w-3.5 h-3.5" /> Accepted
                                            </div>
                                          )}

                                          {isRejected && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg shrink-0">
                                              <XCircle className="w-3.5 h-3.5" /> Rejected
                                            </div>
                                          )}

                                          {isOverridden && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
                                              <Edit3 className="w-3.5 h-3.5" /> Manual Override
                                            </div>
                                          )}

                                          {state.status === 'PENDING' && !mode && (
                                            <div className="flex items-center space-x-1.5 shrink-0">
                                              <button
                                                onClick={() => handleAuthorizeAction(action)}
                                                className="px-2.5 py-1 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer"
                                              >
                                                <ArrowRightCircle className="w-3 h-3" /> Accept
                                              </button>
                                              <button
                                                onClick={() => handleRejectAction(action)}
                                                className="px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all active:scale-95 cursor-pointer"
                                                title="Reject recommendation"
                                              >
                                                Reject
                                              </button>
                                            </div>
                                          )}
                                        </div>
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
          <div className="bg-white border-2 border-sky-400/90 rounded-2xl p-4 md:p-5 shadow-lg space-y-4 font-mono text-xs w-full animate-fadeIn transition-all">
            {/* Header with live pulse & agent name */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-sky-50 border border-sky-200 rounded-xl text-sky-600 animate-pulse flex-shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 font-sans text-sm">
                      {liveTriageState.agentName || 'Agentic Workflow Orchestrator'}
                    </span>
                    <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      LIVE MULTI-AGENT RUNTIME
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {liveTriageState.agentRole || 'Gathering telemetry, querying diagnostics tools, and formulating root cause'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1 rounded-lg">
                <Zap className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span className="font-bold">{liveTriageState.phaseLabel}</span>
              </div>
            </div>

            {/* 4-Phase Stepper */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-sans text-[11px]">
              {[
                { step: 1, title: '1. Dynamic Routing' },
                { step: 2, title: '2. MCP Diagnostics' },
                { step: 3, title: '3. AI Reasoning' },
                { step: 4, title: '4. Docket Synthesis' }
              ].map((p) => {
                const isDone = liveTriageState.currentPhase > p.step;
                const isCurrent = liveTriageState.currentPhase === p.step;
                return (
                  <div
                    key={p.step}
                    className={`p-2 rounded-xl border flex items-center space-x-2 transition-all ${
                      isDone
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 font-semibold'
                        : isCurrent
                        ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200/70 text-slate-400'
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <Zap className="w-3.5 h-3.5 text-sky-600 animate-pulse shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span className="truncate">{p.title}</span>
                  </div>
                );
              })}
            </div>

            {/* Live MCP Tool Invocations (Step 2) */}
            {liveTriageState.toolCalls.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-600" />
                    <span>MCP Diagnostics ({liveTriageState.toolCalls.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Live Telemetry & Sensor Queries</span>
                </div>

                <div 
                  ref={toolsScrollRef}
                  className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scroll-smooth"
                >
                  {liveTriageState.toolCalls.map((tc) => (
                    <div
                      key={tc.id}
                      className={`p-2.5 rounded-xl border transition-all text-xs ${
                        tc.status === 'running'
                          ? 'bg-amber-50/70 border-amber-300 text-amber-950 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                        <span className="font-bold text-sky-900 flex items-center gap-1.5">
                          <Wrench className="w-3 h-3 text-sky-600 shrink-0" />
                          <span>{tc.tool}</span>
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            tc.status === 'running'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tc.status === 'running' ? 'EXECUTING...' : 'COMPLETED'}
                        </span>
                      </div>

                      {tc.input && Object.keys(tc.input).length > 0 && (
                        <div className="text-[11px] text-slate-600 bg-white/80 p-1.5 rounded border border-slate-200/70 font-mono mt-1">
                          <span className="text-slate-400">args: </span>
                          {JSON.stringify(tc.input)}
                        </div>
                      )}

                      {tc.output && (
                        <div className="text-[11px] text-slate-700 bg-white/90 p-1.5 rounded border border-slate-200/80 font-mono mt-1 truncate">
                          <span className="text-emerald-700 font-semibold">result: </span>
                          {typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Streamed AI Thoughts / Reasoning (Step 3) - Below MCP Diagnostics */}
            {liveTriageState.streamedThought && (
              <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 shadow-inner border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-800">
                  <span className="flex items-center gap-1.5 font-bold text-sky-400">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>AI Reasoning Stream</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">tokens streaming</span>
                </div>
                <div 
                  ref={thoughtScrollRef}
                  className="text-xs font-sans text-slate-200 leading-relaxed max-h-48 overflow-y-auto pr-1 scroll-smooth"
                >
                  <MarkdownRenderer content={liveTriageState.streamedThought} isUser={false} />
                  <span className="inline-block w-1.5 h-3.5 bg-sky-400 animate-pulse ml-1 align-middle" />
                </div>
              </div>
            )}
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

      {/* Message Input Box — disabled for this iteration, use the trigger chips above */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 opacity-60 cursor-not-allowed">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Chat with Sherlock - Coming Soon"
            className="flex-1 bg-transparent text-xs text-slate-400 placeholder:text-slate-400 focus:outline-none font-sans cursor-not-allowed"
            disabled
          />
          <button
            type="submit"
            disabled
            className="p-2 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
