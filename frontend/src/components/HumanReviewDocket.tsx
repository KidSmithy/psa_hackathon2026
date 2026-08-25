import React, { useState } from 'react';
import { DocketItem } from '../types';
import { 
  FileText, 
  CheckCircle2, 
  Cpu, 
  Wrench, 
  ArrowRightCircle, 
  Sparkles, 
  Check
} from 'lucide-react';

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
    if (onDispatchAction && currentDocket) {
      onDispatchAction(currentDocket.id, action);
    }
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
          {currentDocket.rootCause}
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
                  {evidence.text}
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

      {/* Action Dispatch */}
      <div className="bg-white border-2 border-tuas-cyan rounded-xl p-6 shadow-glow-cyan space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-psa-navy-dark font-mono font-bold text-sm">
            <Wrench className="w-5 h-5 text-tuas-teal" />
            <span>OPERATIONAL ACTION DISPATCH</span>
          </div>
        </div>

        <div className="space-y-3 font-mono">
          {currentDocket.recommendedActions.map((action: string, idx: number) => {
            const isDispatched = dispatched[action];
            return (
              <div
                key={idx}
                className="bg-psa-canvas border border-psa-border rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="text-psa-navy-dark text-xs leading-relaxed font-semibold">
                  Action #{idx + 1}: {action}
                </div>

                <button
                  onClick={() => handleDispatch(action)}
                  disabled={isDispatched}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all shadow-md ${
                    isDispatched
                      ? 'bg-nominal-emerald-bg text-nominal-emerald border border-nominal-emerald-border cursor-default'
                      : 'bg-gradient-to-r from-psa-navy to-tuas-cyan-dark hover:from-tuas-cyan-dark hover:to-tuas-teal text-white shadow-glow-cyan/50 hover:shadow-glow-teal active:scale-95'
                  }`}
                >
                  {isDispatched ? (
                    <>
                      <Check className="w-4 h-4 text-nominal-emerald" />
                      <span>DISPATCHED TO FIELD TERMINAL</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightCircle className="w-4 h-4 text-tuas-teal" />
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
  );
};
