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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between font-mono">
          <span
            className={`text-xs font-bold px-3 py-1 rounded uppercase tracking-wider ${
              isCritical
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {currentDocket.severity} SEVERITY • ACTION REQUIRED
          </span>
          <span className="text-slate-500 text-xs font-mono">DOCKET ID: {currentDocket.id}</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-wide font-sans">
          {currentDocket.title}
        </h1>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs">
          <span className="text-red-600 font-bold">OPERATIONAL DOWNSTREAM IMPACT: </span>
          <span className="text-slate-800">{currentDocket.impact}</span>
        </div>
      </div>

      {/* Verified Root Cause */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 text-sky-700 font-mono font-bold text-sm">
          <Sparkles className="w-5 h-5 text-sky-600" />
          <span>AI TRIAGE VERIFIED ROOT CAUSE</span>
        </div>

        <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-4 font-mono text-sm text-slate-900 leading-relaxed shadow-sm">
          {currentDocket.rootCause}
        </div>
      </div>

      {/* Physical Evidence */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>MULTIMODAL HARDWARE EVIDENCE PROOF</span>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded font-bold">
            MCP CERTIFIED
          </span>
        </div>

        <div className="space-y-3">
          {currentDocket.physicalEvidence.map((evidence: { text: string; timestamp: string; verified: boolean }, idx: number) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-3.5 shadow-sm"
            >
              <div className="mt-0.5 bg-emerald-50 text-emerald-600 p-1.5 rounded-lg border border-emerald-200">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-slate-900 font-mono text-xs leading-relaxed font-medium">
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

      {/* PLC Registers */}
      {currentDocket.plcRegisters && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between font-mono">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
              <Cpu className="w-5 h-5 text-sky-600" />
              <span>PLC REGISTERS DECODED</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">CAN-BUS V3</span>
          </div>

          <div className="space-y-2.5 font-mono">
            {currentDocket.plcRegisters.map((reg: { code: string; name: string; status: string; description: string }, idx: number) => (
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

      {/* Action Dispatch */}
      <div className="bg-white border-2 border-sky-500 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 font-mono font-bold text-sm">
            <Wrench className="w-5 h-5 text-sky-600" />
            <span>OPERATIONAL ACTION DISPATCH</span>
          </div>
        </div>

        <div className="space-y-3 font-mono">
          {currentDocket.recommendedActions.map((action: string, idx: number) => {
            const isDispatched = dispatched[action];
            return (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="text-slate-900 text-xs leading-relaxed font-semibold">
                  Action #{idx + 1}: {action}
                </div>

                <button
                  onClick={() => handleDispatch(action)}
                  disabled={isDispatched}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                    isDispatched
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                      : 'bg-sky-600 hover:bg-sky-700 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {isDispatched ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span>DISPATCHED TO FIELD TERMINAL</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightCircle className="w-4 h-4" />
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
