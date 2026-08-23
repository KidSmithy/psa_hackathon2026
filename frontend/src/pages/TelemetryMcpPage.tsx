import React, { useState } from 'react';
import { MCPToolCall, TerminalTelemetryPoint } from '../types';
import { 
  Activity, 
  Terminal, 
  Clock, 
  CheckCircle2, 
  Gauge, 
  ArrowRight, 
  Server,
  Filter,
  Cpu,
  Layers
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, Legend } from 'recharts';

interface TelemetryMcpPageProps {
  mcpToolCalls: MCPToolCall[];
  telemetryData: TerminalTelemetryPoint[];
  onNavigateToDocket: () => void;
  onNavigateToPipeline: () => void;
}

export const TelemetryMcpPage: React.FC<TelemetryMcpPageProps> = ({
  mcpToolCalls,
  telemetryData,
  onNavigateToDocket,
  onNavigateToPipeline,
}) => {
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'charts' | 'mcpTrace'>('charts');

  const filteredToolCalls =
    selectedServer === 'all'
      ? mcpToolCalls
      : mcpToolCalls.filter((c) => c.server === selectedServer);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-maritime-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-50 dark:bg-port-cyan/10 border border-sky-200 dark:border-port-cyan/30 rounded-lg text-sky-600 dark:text-port-cyan">
              <Terminal className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide font-sans">
                STAGE 3: MCP INDUSTRIAL GATEWAY & SENSOR TELEMETRY
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Strict typed tool interfaces querying SCADA, CAN bus registers, and PLC fault memory.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onNavigateToPipeline}
              className="bg-slate-100 dark:bg-maritime-surface hover:bg-slate-200 dark:hover:bg-maritime-border text-sky-700 dark:text-port-cyan border border-slate-300 dark:border-port-cyan/40 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition-colors shadow-sm"
            >
              <span>Back: Stage 2 Agent Isolation</span>
            </button>
            <button
              onClick={onNavigateToDocket}
              className="bg-sky-600 hover:bg-sky-700 dark:bg-port-cyan dark:hover:bg-port-cyan-glow text-white dark:text-abyss text-xs px-4 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-colors shadow-md"
            >
              <span>Open Synthesized Docket</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* View Mode Selector Tabs */}
        <div className="flex items-center space-x-3 mt-4">
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 transition-all shadow-sm ${
              activeTab === 'charts'
                ? 'bg-sky-600 text-white dark:bg-port-cyan/20 dark:text-port-cyan dark:border dark:border-port-cyan/40'
                : 'bg-slate-100 dark:bg-abyss text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-maritime-border hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>High-Frequency Telemetry Curves</span>
          </button>
          <button
            onClick={() => setActiveTab('mcpTrace')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 transition-all shadow-sm ${
              activeTab === 'mcpTrace'
                ? 'bg-sky-600 text-white dark:bg-port-cyan/20 dark:text-port-cyan dark:border dark:border-port-cyan/40'
                : 'bg-slate-100 dark:bg-abyss text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-maritime-border hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>MCP Tool Call Trace ({mcpToolCalls.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: AGV-104 Hydraulic Actuator Pressure */}
          <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-maritime-border pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm font-mono flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 dark:bg-hazard-red animate-ping" />
                  <span>AGV-104 ACTUATOR HYDRAULIC PRESSURE</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Relief valve overflow under mechanical binding in corner casting
                </p>
              </div>
              <span className="text-xs bg-red-50 dark:bg-hazard-red/20 text-red-700 dark:text-hazard-red border border-red-200 dark:border-hazard-red/40 px-2.5 py-1 rounded font-mono font-bold">
                275.4 BAR (PEAK)
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={11} fontStyle="monospace" />
                  <YAxis stroke="#64748B" fontSize={11} fontStyle="monospace" domain={[100, 300]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#0F172A',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <ReferenceLine
                    y={220}
                    label={{ value: 'Relief Limit (220 bar)', fill: '#DC2626', fontSize: 11 }}
                    stroke="#DC2626"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="hydraulicPressureBar"
                    name="Pressure (bar)"
                    stroke="#0284C7"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0284C7' }}
                    activeDot={{ r: 7, fill: '#DC2626' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-50 dark:bg-abyss/80 p-3 rounded-lg border border-slate-200 dark:border-maritime-border text-xs font-mono flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span>Command: RELEASE_DISENGAGE</span>
              <span className="text-red-700 dark:text-hazard-red font-bold">PLC 0x7E1: ERR_TWISTLOCK_TIMEOUT</span>
            </div>
          </div>

          {/* Chart 2: BCSS-02 DC Busbar Thermal Curve */}
          <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-maritime-border pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm font-mono flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span>BCSS-02 DC BUSBAR TEMPERATURE</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Substation thermal trip following coolant differential pressure drop
                </p>
              </div>
              <span className="text-xs bg-amber-50 dark:bg-caution-amber/20 text-amber-800 dark:text-caution-amber border border-amber-200 dark:border-caution-amber/40 px-2.5 py-1 rounded font-mono font-bold">
                82.4°C (EXCEEDED)
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={11} fontStyle="monospace" />
                  <YAxis stroke="#64748B" fontSize={11} fontStyle="monospace" domain={[50, 95]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#0F172A',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <ReferenceLine
                    y={70.0}
                    label={{ value: 'Safety Cutoff (70.0°C)', fill: '#D97706', fontSize: 11 }}
                    stroke="#D97706"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="busbarTempC"
                    name="Busbar Temp (°C)"
                    stroke="#D97706"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#D97706' }}
                    activeDot={{ r: 7, fill: '#DC2626' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-50 dark:bg-abyss/80 p-3 rounded-lg border border-slate-200 dark:border-maritime-border text-xs font-mono flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span>Main Contactor: OPEN_TRIPPED</span>
              <span className="text-amber-800 dark:text-caution-amber font-bold">PLC 0x9B4: OVERTEMP_THERMAL_CUTOFF</span>
            </div>
          </div>
        </div>
      )}

      {/* MCP Tool Call Trace Tab */}
      {activeTab === 'mcpTrace' && (
        <div className="bg-white dark:bg-maritime-slate border border-slate-200 dark:border-maritime-border rounded-xl p-6 shadow-sm dark:shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-maritime-border">
            <div className="flex items-center space-x-2">
              <Server className="w-5 h-5 text-sky-600 dark:text-port-cyan" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base font-sans">
                MCP Server Execution History
              </h3>
            </div>

            {/* Server Filter */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-abyss p-1 rounded-lg border border-slate-200 dark:border-maritime-border text-xs font-mono">
              <button
                onClick={() => setSelectedServer('all')}
                className={`px-3 py-1.5 rounded ${
                  selectedServer === 'all'
                    ? 'bg-sky-600 text-white dark:bg-port-cyan/20 dark:text-port-cyan dark:border dark:border-port-cyan/40 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Servers ({mcpToolCalls.length})
              </button>
              <button
                onClick={() => setSelectedServer('mcp-terminal-telemetry')}
                className={`px-3 py-1.5 rounded ${
                  selectedServer === 'mcp-terminal-telemetry'
                    ? 'bg-sky-600 text-white dark:bg-port-cyan/20 dark:text-port-cyan dark:border dark:border-port-cyan/40 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Telemetry Gateway
              </button>
              <button
                onClick={() => setSelectedServer('mcp-terminal-diagnostics')}
                className={`px-3 py-1.5 rounded ${
                  selectedServer === 'mcp-terminal-diagnostics'
                    ? 'bg-sky-600 text-white dark:bg-port-cyan/20 dark:text-port-cyan dark:border dark:border-port-cyan/40 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                PLC & Diagnostics
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {filteredToolCalls.map((call) => (
              <div
                key={call.id}
                className="bg-slate-50 dark:bg-abyss/90 border border-slate-200 dark:border-maritime-border rounded-xl p-5 space-y-3 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-200 dark:border-maritime-border/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500">{call.timestamp}</span>
                    <span className="text-sky-700 dark:text-port-cyan font-bold bg-white dark:bg-maritime-surface px-2 py-0.5 rounded border border-slate-200 dark:border-maritime-border">
                      {call.server}
                    </span>
                  </div>
                  <span className="text-emerald-700 dark:text-nominal-emerald text-[11px] flex items-center gap-1 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    {call.durationMs} ms
                  </span>
                </div>

                <div className="text-slate-900 dark:text-white font-bold text-sm">
                  {call.tool}()
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="text-slate-500 font-semibold">Parameters: </span>
                  <code>{JSON.stringify(call.params)}</code>
                </div>

                <div className="bg-white dark:bg-abyss-dark/90 p-3 rounded-lg border border-slate-200 dark:border-maritime-border/60 text-[11px] overflow-x-auto max-h-48 shadow-inner">
                  <pre className="text-slate-800 dark:text-slate-300">
                    {JSON.stringify(call.response, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
