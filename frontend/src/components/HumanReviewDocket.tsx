import React, { useState } from 'react';
import { DocketItem } from '../types';
import { 
  FileText, 
  CheckCircle2, 
  Cpu, 
  Wrench, 
  ArrowRightCircle, 
  Sparkles, 
  Check,
  X,
  Edit3,
  XCircle,
  RotateCcw,
  Sliders,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ActionReviewState {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN';
  reason?: string;
  overrideText?: string;
}

interface HumanReviewDocketProps {
  dockets: DocketItem[];
  selectedClusterId: string;
  onDispatchAction?: (docketId: string, actionText: string) => void;
  onRejectAction?: (docketId: string, actionText: string, reason: string) => void;
  onOverrideAction?: (docketId: string, originalAction: string, overrideText: string) => void;
}

export const HumanReviewDocket: React.FC<HumanReviewDocketProps> = ({
  dockets,
  selectedClusterId,
  onDispatchAction,
  onRejectAction,
  onOverrideAction,
}) => {
  const currentDocket = dockets.find(d => d.clusterId === selectedClusterId) || dockets[0];
  const [actionStates, setActionStates] = useState<Record<string, ActionReviewState>>({});
  const [activeFormMode, setActiveFormMode] = useState<Record<string, 'reject' | 'override' | null>>({});
  const [tempInput, setTempInput] = useState<Record<string, string>>({});

  const presetRejectionReasons = [
    'Crew currently engaged on higher-priority task',
    'Hardware false positive / nominal inspection',
    'Alternative bypass route preferred',
    'Already mitigated manually by field supervisor'
  ];

  const handleAuthorize = (action: string) => {
    setActionStates(prev => ({
      ...prev,
      [action]: { status: 'ACCEPTED' }
    }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    if (onDispatchAction && currentDocket) {
      onDispatchAction(currentDocket.id, action);
    }
  };

  const handleOpenRejectForm = (action: string) => {
    setActiveFormMode(prev => ({ ...prev, [action]: 'reject' }));
    setTempInput(prev => ({ ...prev, [action]: '' }));
  };

  const handleOpenOverrideForm = (action: string) => {
    setActiveFormMode(prev => ({ ...prev, [action]: 'override' }));
    setTempInput(prev => ({ ...prev, [action]: action }));
  };

  const handleConfirmReject = (action: string) => {
    const reason = tempInput[action]?.trim() || 'Rejected by Terminal Supervisor';
    setActionStates(prev => ({
      ...prev,
      [action]: { status: 'REJECTED', reason }
    }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    if (onRejectAction && currentDocket) {
      onRejectAction(currentDocket.id, action, reason);
    }
  };

  const handleConfirmOverride = (action: string) => {
    const overrideText = tempInput[action]?.trim() || action;
    setActionStates(prev => ({
      ...prev,
      [action]: { status: 'OVERRIDDEN', overrideText }
    }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    if (onOverrideAction && currentDocket) {
      onOverrideAction(currentDocket.id, action, overrideText);
    }
  };

  const handleResetAction = (action: string) => {
    setActionStates(prev => ({
      ...prev,
      [action]: { status: 'PENDING' }
    }));
    setActiveFormMode(prev => ({ ...prev, [action]: null }));
    setTempInput(prev => ({ ...prev, [action]: '' }));
  };

  if (!currentDocket) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 font-mono">
        No active review docket available.
      </div>
    );
  }

  const isCritical = currentDocket.severity === 'CRITICAL';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-psa-border rounded-xl p-6 shadow-cyber-card space-y-4">
        <div className="flex items-center justify-between font-mono">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider ${
              isCritical
                ? 'bg-psa-flame-bg text-psa-flame border border-psa-flame-border'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {currentDocket.severity} SEVERITY • ACTION REQUIRED
          </span>
          <span className="text-psa-muted text-xs font-mono font-bold">DOCKET ID: {currentDocket.id}</span>
        </div>

        <h1 className="text-2xl font-black text-psa-navy-dark tracking-wide font-sans">
          {currentDocket.title}
        </h1>

        <div className="bg-psa-canvas border border-psa-border rounded-xl p-4 font-mono text-xs">
          <span className="text-psa-flame font-bold">OPERATIONAL DOWNSTREAM IMPACT: </span>
          <span className="text-psa-navy-dark">{currentDocket.impact}</span>
        </div>
      </div>

      {/* Verified Root Cause */}
      <div className="bg-white border border-psa-border rounded-xl p-6 shadow-cyber-card space-y-3">
        <div className="flex items-center space-x-2 text-tuas-teal-dark font-mono font-bold text-sm">
          <Sparkles className="w-5 h-5 text-tuas-teal" />
          <span>AI TRIAGE VERIFIED ROOT CAUSE</span>
        </div>

        <div className="bg-tuas-teal-light/40 border-2 border-tuas-teal-border rounded-xl p-4 font-mono text-sm text-psa-navy-dark leading-relaxed shadow-sm">
          <MarkdownRenderer content={currentDocket.rootCause} />
        </div>
      </div>

      {/* Physical Evidence */}
      <div className="bg-white border border-psa-border rounded-xl p-6 shadow-cyber-card space-y-4">
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-psa-navy-dark font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-nominal-emerald" />
            <span>MULTIMODAL HARDWARE EVIDENCE PROOF</span>
          </div>
          <span className="text-xs bg-nominal-emerald-bg text-nominal-emerald border border-nominal-emerald-border px-2.5 py-0.5 rounded font-bold">
            MCP CERTIFIED
          </span>
        </div>

        <div className="space-y-3">
          {currentDocket.physicalEvidence.map((evidence: { text: string; timestamp: string; verified: boolean }, idx: number) => (
            <div
              key={idx}
              className="bg-psa-canvas border border-psa-border rounded-xl p-4 flex items-start space-x-3.5 shadow-sm"
            >
              <div className="mt-0.5 bg-nominal-emerald-bg text-nominal-emerald p-1.5 rounded-lg border border-nominal-emerald-border">
                <Check className="w-4 h-4 text-nominal-emerald" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-psa-navy-dark font-mono text-xs leading-relaxed font-medium">
                  <MarkdownRenderer content={evidence.text} />
                </div>
                <div className="text-[11px] text-psa-muted font-mono">
                  Timestamp: <span className="text-tuas-cyan-dark font-bold">{evidence.timestamp}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PLC Registers */}
      {currentDocket.plcRegisters && (
        <div className="bg-white border border-psa-border rounded-xl p-6 shadow-cyber-card space-y-4">
          <div className="flex items-center justify-between font-mono">
            <div className="flex items-center space-x-2 text-psa-navy-dark font-bold text-sm">
              <Cpu className="w-5 h-5 text-tuas-cyan-dark" />
              <span>PLC REGISTERS DECODED</span>
            </div>
            <span className="text-[10px] text-psa-muted font-mono">CAN-BUS V3</span>
          </div>

          <div className="space-y-2.5 font-mono">
            {currentDocket.plcRegisters.map((reg: { code: string; name: string; status: string; description: string }, idx: number) => (
              <div
                key={idx}
                className="bg-psa-canvas p-3.5 rounded-xl border border-psa-border space-y-1.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="bg-tuas-cyan-light text-tuas-cyan-dark border border-tuas-cyan-border px-2 py-0.5 rounded font-bold text-xs">
                    {reg.code}
                  </span>
                  <span className="text-[10px] bg-psa-flame-bg text-psa-flame border border-psa-flame-border px-2 py-0.5 rounded font-bold">
                    {reg.status}
                  </span>
                </div>
                <div className="text-psa-navy-dark font-bold text-xs">{reg.name}</div>
                <div className="text-[11px] text-psa-muted">{reg.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Dispatch & Human-in-the-Loop Override Center */}
      <div className="bg-white border-2 border-tuas-cyan rounded-xl p-6 shadow-glow-cyan space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-psa-navy-dark font-mono font-bold text-sm">
            <Wrench className="w-5 h-5 text-tuas-teal" />
            <span>HUMAN-IN-THE-LOOP ACTION DISPATCH</span>
          </div>
          <span className="text-[10px] bg-tuas-cyan-light text-tuas-cyan-dark border border-tuas-cyan-border px-2.5 py-0.5 rounded-md font-mono font-bold">
            SUPERVISOR GOVERNANCE
          </span>
        </div>

        <p className="text-xs text-psa-muted font-mono leading-relaxed">
          Review, authorize, reject, or manually override recommended operational commands before terminal execution.
        </p>

        <div className="space-y-4 font-mono">
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
                    ? 'bg-nominal-emerald-bg/30 border-nominal-emerald-border'
                    : isRejected
                    ? 'bg-rose-50/50 border-rose-200'
                    : isOverridden
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-psa-canvas border-psa-border shadow-sm'
                }`}
              >
                {/* Action Title Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 text-psa-navy-dark text-xs leading-relaxed font-semibold">
                    <span className="text-tuas-teal-dark font-bold mr-1.5">Action #{idx + 1}:</span>
                    <MarkdownRenderer content={action} className="inline" />
                  </div>
                  {state.status !== 'PENDING' && (
                    <button
                      onClick={() => handleResetAction(action)}
                      className="text-[10px] text-psa-muted hover:text-psa-navy-dark flex items-center gap-1 font-bold underline transition-colors"
                      title="Reset action decision"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>

                {/* State Badges when decided */}
                {isAccepted && (
                  <div className="bg-nominal-emerald-bg text-nominal-emerald border border-nominal-emerald-border p-2.5 rounded-lg flex items-center justify-between text-xs font-bold animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>AUTHORIZED & DISPATCHED TO FIELD TERMINAL</span>
                    </div>
                    <span className="text-[10px] opacity-80">WO-88219 ACTIVE</span>
                  </div>
                )}

                {isRejected && (
                  <div className="bg-rose-100/70 text-rose-800 border border-rose-200 p-2.5 rounded-lg text-xs space-y-1 animate-fadeIn">
                    <div className="flex items-center gap-1.5 font-bold">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>ACTION REJECTED BY SUPERVISOR</span>
                    </div>
                    {state.reason && (
                      <div className="text-[11px] text-rose-700 italic pl-5.5">
                        Reason: "{state.reason}"
                      </div>
                    )}
                  </div>
                )}

                {isOverridden && (
                  <div className="bg-amber-100/70 text-amber-900 border border-amber-300 p-2.5 rounded-lg text-xs space-y-1 animate-fadeIn">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <Edit3 className="w-4 h-4 text-amber-600" />
                      <span>MANUAL OVERRIDE DISPATCHED</span>
                    </div>
                    {state.overrideText && (
                      <div className="text-[11px] text-amber-900 font-semibold pl-5.5 bg-white/60 p-1.5 rounded border border-amber-200">
                        Custom Directive: "{state.overrideText}"
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Rejection Form */}
                {mode === 'reject' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Specify Reason for Rejection
                      </span>
                      <button
                        onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {presetRejectionReasons.map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setTempInput(prev => ({ ...prev, [action]: preset }))}
                          className="text-[10px] bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded transition-colors text-left"
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
                      className="w-full bg-white border border-rose-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmReject(action)}
                        className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-sm flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Override / Edit Form */}
                {mode === 'override' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                        Modify Action Instruction (Manual Override)
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
                      className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveFormMode(prev => ({ ...prev, [action]: null }))}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmOverride(action)}
                        className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-sm flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" /> Authorize Overridden Directive
                      </button>
                    </div>
                  </div>
                )}

                {/* Tri-Action Buttons (Authorize / Reject / Override) */}
                {state.status === 'PENDING' && !mode && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* Accept / Authorize */}
                    <button
                      onClick={() => handleAuthorize(action)}
                      className="py-2 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all bg-gradient-to-r from-psa-navy to-tuas-cyan-dark hover:from-tuas-cyan-dark hover:to-tuas-teal text-white shadow-sm active:scale-95"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5 text-tuas-teal" />
                      <span>Authorize</span>
                    </button>

                    {/* Reject / Dismiss */}
                    <button
                      onClick={() => handleOpenRejectForm(action)}
                      className="py-2 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 shadow-sm active:scale-95"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject / Dismiss</span>
                    </button>

                    {/* Override / Edit */}
                    <button
                      onClick={() => handleOpenOverrideForm(action)}
                      className="py-2 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 hover:border-amber-300 shadow-sm active:scale-95"
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
  );
};
