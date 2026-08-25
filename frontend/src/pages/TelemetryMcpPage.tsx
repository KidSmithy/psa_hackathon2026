import React, { useState } from 'react';
import { MCPToolCall, TerminalTelemetryPoint } from '../types';
import { 
  Terminal, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Activity, 
  Radio, 
  ShieldCheck, 
  Database,
  ArrowRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface TelemetryMcpPageProps {
  toolCalls: MCPToolCall[];
  telemetryStream: TerminalTelemetryPoint[];
}

export const TelemetryMcpPage: React.FC<TelemetryMcpPageProps> = ({
  toolCalls,
  telemetryStream,
}) => {
  const [activeServerFilter, setActiveServerFilter] = useState<string>('ALL');

  const filteredTools = activeServerFilter === 'ALL'
    ? toolCalls
    : toolCalls.filter(t => t.server === activeServerFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-600">
            <Terminal className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              STAGE 3: MODEL CONTEXT PROTOCOL (MCP) & 50Hz SCADA
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Deterministic diagnostic queries to OT database servers and live hardware telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200 font-mono text-xs">
          {['ALL', 'mcp-terminal-telemetry', 'mcp-terminal-diagnostics'].map((srv) => (
            <button
              key={srv}
              onClick={() => setActiveServerFilter(srv)}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                activeServerFilter === srv
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {srv === 'ALL' ? 'All Servers' : srv.replace('mcp-terminal-', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Telemetry Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Activity className="w-5 h-5 text-sky-600" />
            <span>LIVE 50Hz SCADA TELEMETRY & HARDWARE ANOMALY PROOF</span>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded font-bold">
            CAN-BUS STREAMING
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetryStream}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="time" stroke="#64748B" fontSize={11} fontFamily="monospace" />
              <YAxis stroke="#64748B" fontSize={11} fontFamily="monospace" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace' }}
              />
              <Line 
                type="monotone" 
                dataKey="agvPressureBar" 
                name="AGV-104 Hydraulic Pressure (Bar)" 
                stroke="#DC2626" 
                strokeWidth={2} 
                dot={{ r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="bcssBusTempC" 
                name="BCSS-02 Busbar Temp (°C)" 
                stroke="#D97706" 
                strokeWidth={2} 
                dot={{ r: 4 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MCP Tool Calls Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Database className="w-5 h-5 text-sky-600" />
            <span>DISPATCHED MCP TOOL CALL AUDIT LOG</span>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Strict Zero-Leak Boundary Verified
          </span>
        </div>

        <div className="space-y-3">
          {filteredTools.map((call) => (
            <div
              key={call.id}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-bold">
                    {call.server}
                  </span>
                  <span className="text-slate-900 font-bold">{call.tool}()</span>
                </div>
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                  {call.status} ({call.durationMs}ms)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-bold">Parameters:</span>
                  <pre className="text-slate-800 overflow-x-auto">{JSON.stringify(call.params, null, 2)}</pre>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-bold">MCP Response:</span>
                  <pre className="text-slate-800 overflow-x-auto">{JSON.stringify(call.result || call.response, null, 2)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
