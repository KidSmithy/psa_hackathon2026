import React, { useState } from 'react';
import { DocketItem } from '../types';
import { FileText, ShieldAlert, CheckCircle2, Cpu, Wrench, ArrowRightCircle, Sparkles, AlertOctagon, Check } from 'lucide-react';

interface HumanReviewDocketProps {
  dockets: DocketItem[];
  selectedClusterId: string;
  onDispatchAction?: (docketId: string, actionText: string) => void;
}

export const HumanReviewDocket: React.FC<HumanReviewDocketProps> = ({
  dockets,
  selectedClusterId,
  onDispatchAction,
}) => {
  const currentDocket = dockets.find(d => d.clusterId === selectedClusterId) || dockets[0];
  const [dispatched, setDispatched] = useState<Record<string, boolean>>({});

  const handleDispatch = (action: string) => {
    setDispatched(prev => ({ ...prev, [action]: true }));
    if (onDispatchAction) {
      onDispatchAction(currentDocket.id, action);
    }
  };

  if (!currentDocket) {
    return (
      <div className="bg-maritime-slate border border-maritime-border rounded-xl p-6 text-center text-slate-400 font-mono text-xs">
        No active docket generated for this cluster.
      </div>
    );
  }

  const isCritical = currentDocket.severity === 'CRITICAL';

  return (
    <div className="bg-maritime-slate border border-maritime-border rounded-xl flex flex-col h-full overflow-hidden shadow-2xl">
      {/* Panel Header */}
      <div className="p-4 border-b border-maritime-border bg-maritime-surface/60 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-port-cyan" />
          <div>
            <h2 className="font-bold text-white text-sm tracking-wide">
              SYNTHESIZED HUMAN REVIEW DOCKET
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              CONSOLIDATED OPERATIONAL DOSSIER
            </p>
          </div>
        </div>

        <span className="bg-hazard-red/20 text-hazard-red border border-hazard-red/40 text-[10px] px-2.5 py-1 rounded font-mono font-bold uppercase animate-pulse">
          ACTION REQUIRED
        </span>
      </div>

      {/* Docket Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 font-sans text-xs">
        {/* Incident Summary Card */}
        <div className="bg-abyss/90 border border-maritime-border rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between font-mono">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                isCritical
                  ? 'bg-hazard-red/20 text-hazard-red border border-hazard-red/40'
                  : 'bg-caution-amber/20 text-caution-amber border border-caution-amber/40'
              }`}
            >
              {currentDocket.severity} SEVERITY
            </span>
            <span className="text-slate-400 text-[11px]">ID: {currentDocket.id}</span>
          </div>

          <h3 className="text-base font-bold text-white mt-2">
            {currentDocket.title}
          </h3>

          <div className="mt-2 text-slate-300 bg-maritime-surface/80 p-2.5 rounded-lg border border-maritime-border font-mono text-[11px]">
            <span className="text-hazard-red font-semibold">Operational Impact: </span>
            {currentDocket.impact}
          </div>
        </div>

        {/* Root Cause Analysis (Deterministic AI Handoff) */}
        <div className="bg-abyss/80 border border-maritime-border rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-port-cyan font-mono font-semibold text-xs">
            <Sparkles className="w-4 h-4 text-port-cyan" />
            <span>VERIFIED ROOT CAUSE</span>
          </div>
          <p className="text-slate-200 text-xs leading-relaxed bg-port-cyan/5 border border-port-cyan/20 p-3 rounded-lg font-mono">
            {currentDocket.rootCause}
          </p>
        </div>

        {/* Multimodal Hardware Evidence Checklist */}
        <div className="bg-abyss/80 border border-maritime-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between font-mono text-xs text-slate-300">
            <div className="flex items-center space-x-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-nominal-emerald" />
              <span>PHYSICAL EVIDENCE VERIFICATION</span>
            </div>
            <span className="text-[10px] text-slate-500">MCP Verified</span>
          </div>

          <div className="space-y-2">
            {currentDocket.physicalEvidence.map((evidence, idx) => (
              <div
                key={idx}
                className="bg-maritime-surface/70 border border-maritime-border/80 rounded-lg p-2.5 flex items-start space-x-2.5"
              >
                <div className="mt-0.5 bg-nominal-emerald/10 text-nominal-emerald p-1 rounded">
                  <Check className="w-3 h-3 text-nominal-emerald" />
                </div>
                <div className="flex-1">
                  <div className="text-slate-200 font-mono text-[11px] leading-relaxed">
                    {evidence.text}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Timestamp: {evidence.timestamp} • SCADA Certified
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PLC Fault Registers Inspector */}
        {currentDocket.plcRegisters && (
          <div className="bg-abyss/80 border border-maritime-border rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-slate-300 font-mono font-semibold text-xs">
              <Cpu className="w-4 h-4 text-port-cyan" />
              <span>PLC HEX FAULT REGISTERS DECODED</span>
            </div>
            <div className="space-y-1.5 font-mono">
              {currentDocket.plcRegisters.map((reg, idx) => (
                <div
                  key={idx}
                  className="bg-maritime-surface p-2.5 rounded-lg border border-maritime-border flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="bg-port-cyan/20 text-port-cyan px-1.5 py-0.2 rounded font-bold">
                        {reg.code}
                      </span>
                      <span className="text-white font-semibold">{reg.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{reg.description}</div>
                  </div>
                  <span className="text-[10px] bg-hazard-red/20 text-hazard-red px-2 py-0.5 rounded font-bold">
                    {reg.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions & One-Click Operator Dispatch */}
        <div className="bg-abyss/90 border border-port-cyan/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-white font-mono font-bold text-xs">
            <Wrench className="w-4 h-4 text-port-cyan" />
            <span>RECOMMENDED OPERATIONAL ACTIONS</span>
          </div>

          <div className="space-y-2 font-mono">
            {currentDocket.recommendedActions.map((action, idx) => {
              const isActionDispatched = dispatched[action];
              return (
                <div
                  key={idx}
                  className="bg-maritime-surface border border-maritime-border rounded-lg p-3 space-y-2"
                >
                  <div className="text-slate-200 text-xs leading-relaxed">
                    {idx + 1}. {action}
                  </div>
                  <button
                    onClick={() => handleDispatch(action)}
                    disabled={isActionDispatched}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                      isActionDispatched
                        ? 'bg-nominal-emerald/20 text-nominal-emerald border border-nominal-emerald/40 cursor-default'
                        : 'bg-port-cyan hover:bg-port-cyan-glow text-abyss font-bold shadow-lg shadow-port-cyan/10 hover:shadow-port-cyan/25'
                    }`}
                  >
                    {isActionDispatched ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>DISPATCHED TO FIELD TERMINAL</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightCircle className="w-3.5 h-3.5" />
                        <span>AUTHORIZE & EXECUTE ACTION</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
