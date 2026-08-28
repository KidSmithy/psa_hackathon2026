import React, { useState } from 'react';
import { DocketItem, IncidentCluster } from '../types';
import { 
  FileText, 
  CheckCircle2, 
  Cpu, 
  Wrench, 
  ArrowRightCircle, 
  Sparkles, 
  Check, 
  Clock, 
  Printer, 
  Bot,
  X,
  Edit3,
  XCircle,
  AlertTriangle,
  Send,
  RotateCcw
} from 'lucide-react';

interface ActionReviewState {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN';
  reason?: string;
  overrideText?: string;
}

interface HumanDocketPageProps {
  dockets: DocketItem[];
  clusters: IncidentCluster[];
  selectedClusterId: string;
  onSelectCluster: (id: string) => void;
  onDispatchAction?: (docketId: string, actionText: string) => void;
  onRejectAction?: (docketId: string, actionText: string, reason: string) => void;
  onOverrideAction?: (docketId: string, originalAction: string, overrideText: string) => void;
  onNavigateToChat: () => void;
}

export const HumanDocketPage: React.FC<HumanDocketPageProps> = ({
  dockets,
  clusters,
  selectedClusterId,
  onSelectCluster,
  onDispatchAction,
  onRejectAction,
  onOverrideAction,
  onNavigateToChat,
}) => {
  const currentDocket = dockets.find(d => d.clusterId === selectedClusterId) || dockets[0];
  const [actionStates, setActionStates] = useState<Record<string, ActionReviewState>>({});
  const [activeFormMode, setActiveFormMode] = useState<Record<string, 'reject' | 'override' | null>>({});
  const [tempInput, setTempInput] = useState<Record<string, string>>({});

  const presetRejectionReasons = [
    'Crew engaged on Berth 4 priority',
    'Hardware false positive / nominal',
    'Alternative bypass route preferred',
    'Already mitigated manually'
  ];

  const handleAuthorize = (action: string) => {
    setActionStates(prev => ({ ...prev, [action]: { status: 'ACCEPTED' } }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    if (onDispatchAction && currentDocket) {
      onDispatchAction(currentDocket.id, action);
    }
  };

  const handleConfirmReject = (action: string) => {
    const reason = tempInput[action]?.trim() || 'Rejected by Terminal Supervisor';
    setActionStates(prev => ({ ...prev, [action]: { status: 'REJECTED', reason } }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    if (onRejectAction && currentDocket) {
      onRejectAction(currentDocket.id, action, reason);
    }
  };

  const handleConfirmOverride = (action: string) => {
    const overrideText = tempInput[action]?.trim() || action;
    setActionStates(prev => ({ ...prev, [action]: { status: 'OVERRIDDEN', overrideText } }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    if (onOverrideAction && currentDocket) {
      onOverrideAction(currentDocket.id, action, overrideText);
    }
  };

  const handleResetAction = (action: string) => {
    setActionStates(prev => ({ ...prev, [action]: { status: 'PENDING' } }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    setTempInput(prev => ({ ...prev, [action]: '' }));
  };

  if (!currentDocket) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 font-mono">
        No active review docket generated for the selected cluster.
      </div>
    );
  }

  const isCritical = currentDocket.severity === 'CRITICAL';

  return (
    <div className="space-y-6">
      {/* Cluster Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg text-sky-600">
            <FileText className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-wide font-sans">
              SYNTHESIZED HUMAN REVIEW DOCKET
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Consolidated operational dossier for Terminal Supervisors & Human Governance
            </p>
          </div>
        </div>

        {/* Cluster Tabs */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200 font-mono text-xs shadow-inner">
          {clusters.map((c) => {
            const isSelected = c.id === selectedClusterId;
            return (
              <button
                key={c.id}
                onClick={() => onSelectCluster(c.id)}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {c.id} ({c.severity})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Docket Dossier Document */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Severity, Root Cause, Physical Evidence (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between font-mono">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider ${
                  isCritical
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {currentDocket.severity} SEVERITY • ACTION REQUIRED
              </span>
              <span className="text-slate-400 text-xs font-mono">DOCKET ID: {currentDocket.id}</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-wide font-sans">
              {currentDocket.title}
            </h1>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs">
              <span className="text-red-700 font-bold">OPERATIONAL DOWNSTREAM IMPACT: </span>
              <span className="text-slate-700">{currentDocket.impact}</span>
            </div>
          </div>

          {/* Root Cause Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-sky-800 font-mono font-bold text-sm">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <span>AI TRIAGE VERIFIED ROOT CAUSE</span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 font-mono text-sm text-slate-800 leading-relaxed">
              {currentDocket.rootCause}
            </div>
          </div>

          {/* Physical Evidence Multi-Modal Proof */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>MULTIMODAL HARDWARE EVIDENCE PROOF</span>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                MCP CERTIFIED
              </span>
            </div>

            <div className="space-y-3">
              {currentDocket.physicalEvidence.map((evidence, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-3.5"
                >
                  <div className="mt-0.5 bg-emerald-100 text-emerald-700 p-1 rounded-lg">
                    <Check className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-slate-800 font-mono text-xs leading-relaxed font-medium">
                      {evidence.text}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Timestamp: <span className="text-sky-700 font-bold">{evidence.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Decoded Registers & Human Governance Action Dispatch Center (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Decoded PLC Registers */}
          {currentDocket.plcRegisters && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between font-mono">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Cpu className="w-5 h-5 text-sky-600" />
                  <span>PLC REGISTERS DECODED</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">CAN-BUS V3</span>
              </div>

              <div className="space-y-2.5 font-mono">
                {currentDocket.plcRegisters.map((reg, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-bold text-xs">
                        {reg.code}
                      </span>
                      <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded font-bold">
                        {reg.status}
                      </span>
                    </div>
                    <div className="text-slate-900 font-bold text-xs">{reg.name}</div>
                    <div className="text-[11px] text-slate-600">{reg.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Dispatch Center */}
          <div className="bg-white border-2 border-sky-500 rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-mono font-bold text-sm">
                <Wrench className="w-5 h-5 text-sky-600" />
                <span>HUMAN-IN-THE-LOOP GOVERNANCE</span>
              </div>
              <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-mono font-bold">
                AUTHORIZE / REJECT / EDIT
              </span>
            </div>

            <p className="text-xs text-slate-600 font-mono leading-relaxed">
              Authorize field technicians, reject with justification, or manually override parameters before execution.
            </p>

            <div className="space-y-3.5 font-mono">
              {currentDocket.recommendedActions.map((action: string, idx: number) => {
                const state = actionStates[action] || { status: 'PENDING' };
                const mode = activeFormMode[action] || null;
                const isAccepted = state.status === 'ACCEPTED';
                const isRejected = state.status === 'REJECTED';
                const isOverridden = state.status === 'OVERRIDDEN';

                return (
                  <div
                    key={idx}
                    className={`border rounded-xl p-4 space-y-3 transition-all ${
                      isAccepted
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : isRejected
                        ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                        : isOverridden
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-slate-900 text-xs leading-relaxed font-semibold">
                        <span className="text-sky-700 font-bold mr-1">Action #{idx + 1}:</span>
                        {action}
                      </div>
                      {state.status !== 'PENDING' && (
                        <button
                          onClick={() => handleResetAction(action)}
                          className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5 font-bold underline"
                          title="Reset decision"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      )}
                    </div>

                    {isAccepted && (
                      <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-lg flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> AUTHORIZED & DISPATCHED
                        </div>
                        <span className="text-[10px]">WO-88219</span>
                      </div>
                    )}

                    {isRejected && (
                      <div className="bg-rose-100 text-rose-800 p-2.5 rounded-lg text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <XCircle className="w-4 h-4 text-rose-600" /> REJECTED BY SUPERVISOR
                        </div>
                        {state.reason && (
                          <div className="text-[11px] text-rose-700 italic pl-5">
                            "{state.reason}"
                          </div>
                        )}
                      </div>
                    )}

                    {isOverridden && (
                      <div className="bg-amber-100 text-amber-900 p-2.5 rounded-lg text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800">
                          <Edit3 className="w-4 h-4 text-amber-600" /> OVERRIDE DISPATCHED
                        </div>
                        {state.overrideText && (
                          <div className="text-[11px] text-amber-950 font-semibold pl-5 bg-white/70 p-1.5 rounded border border-amber-200">
                            "{state.overrideText}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Rejection Form */}
                    {mode === 'reject' && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Specify Reason
                          </span>
                          <button onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {presetRejectionReasons.map((preset, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setTempInput(prev => ({ ...prev, [action]: preset }))}
                              className="text-[10px] bg-white border border-rose-200 text-rose-700 px-2 py-0.5 rounded hover:bg-rose-100"
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
                          className="w-full bg-white border border-rose-300 rounded px-2.5 py-1 text-xs focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                            className="px-2.5 py-1 text-xs text-slate-500 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleConfirmReject(action)}
                            className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Confirm Rejection
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Override Form */}
                    {mode === 'override' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                          <span className="flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5 text-amber-700" /> Manual Override Directive
                          </span>
                          <button onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={tempInput[action] || ''}
                          onChange={(e) => setTempInput(prev => ({ ...prev, [action]: e.target.value }))}
                          className="w-full bg-white border border-amber-300 rounded p-2 text-xs focus:outline-none font-mono"
                          placeholder="Enter modified operational command..."
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                            className="px-2.5 py-1 text-xs text-slate-500 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleConfirmOverride(action)}
                            className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" /> Dispatch Overridden Directive
                          </button>
                        </div>
                      </div>
                    )}

                    {state.status === 'PENDING' && !mode && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => handleAuthorize(action)}
                          className="py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>Authorize</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveFormMode(prev => ({ ...prev, [action]: 'reject' }));
                            setTempInput(prev => ({ ...prev, [action]: '' }));
                          }}
                          className="py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveFormMode(prev => ({ ...prev, [action]: 'override' }));
                            setTempInput(prev => ({ ...prev, [action]: action }));
                          }}
                          className="py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Override</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
