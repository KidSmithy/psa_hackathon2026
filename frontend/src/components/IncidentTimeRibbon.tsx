import React, { useMemo, useRef } from 'react';
import { 
  Clock, 
  Layers, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Bot, 
  Maximize2, 
  ChevronRight, 
  Calendar,
  Zap
} from 'lucide-react';
import { 
  ClusterWithAlerts, 
  RawAlert, 
  TimeBracket, 
  IncidentLaneData, 
  SeverityLevel 
} from '../types';

interface IncidentTimeRibbonProps {
  clusters: ClusterWithAlerts[];
  rawAlerts: RawAlert[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string | null) => void;
  selectedAlertId: string | null;
  onSelectAlert: (alertId: string | null) => void;
  currentTimeSec: number;
  onScrubTime: (sec: number) => void;
  minTimeSec: number;
  maxTimeSec: number;
}

export const IncidentTimeRibbon: React.FC<IncidentTimeRibbonProps> = ({
  clusters,
  rawAlerts,
  selectedClusterId,
  onSelectCluster,
  selectedAlertId,
  onSelectAlert,
  currentTimeSec,
  onScrubTime,
  minTimeSec,
  maxTimeSec,
}) => {
  const ribbonSvgRef = useRef<SVGSVGElement>(null);

  // Convert ISO timestamp string to epoch seconds
  const toEpochSec = (isoString: string): number => {
    const d = Date.parse(isoString);
    return isNaN(d) ? 0 : d / 1000;
  };

  // Format seconds to HH:MM:SS
  const formatClock = (epochSec: number): string => {
    if (!epochSec || isNaN(epochSec)) return '00:00:00';
    const d = new Date(epochSec * 1000);
    return d.toISOString().slice(11, 19);
  };

  // Compute total time span across all alerts in dataset
  const timeSpan = Math.max(1, maxTimeSec - minTimeSec);

  // -------------------------------------------------------------
  // 20s SPLIT RULE BRACKET SEGMENTATION ALGORITHM
  // -------------------------------------------------------------
  const incidentLanes: IncidentLaneData[] = useMemo(() => {
    const SPLIT_THRESHOLD_SECONDS = 20;

    return clusters.map(cluster => {
      // 1. Sort all associated alerts chronologically by timestamp
      const sortedAlerts = [...cluster.alerts].sort(
        (a, b) => toEpochSec(a.timestamp) - toEpochSec(b.timestamp)
      );

      if (sortedAlerts.length === 0) {
        return {
          incident: cluster,
          brackets: [],
          allAlertsSorted: [],
        };
      }

      const brackets: TimeBracket[] = [];
      let currentAlerts: RawAlert[] = [sortedAlerts[0]];
      let bracketStartSec = toEpochSec(sortedAlerts[0].timestamp);
      let bracketStartTime = sortedAlerts[0].timestamp;

      // 2. Iterate through consecutive alert pairs (t_i, t_{i+1})
      for (let i = 0; i < sortedAlerts.length - 1; i++) {
        const tCurr = toEpochSec(sortedAlerts[i].timestamp);
        const tNext = toEpochSec(sortedAlerts[i + 1].timestamp);
        const delta = tNext - tCurr;

        if (delta <= SPLIT_THRESHOLD_SECONDS) {
          // Extend current bracket to encompass t_{i+1}
          currentAlerts.push(sortedAlerts[i + 1]);
        } else {
          // Close current bracket at t_i (delta > 20s)
          const bracketEndSec = tCurr;
          const bracketEndTime = sortedAlerts[i].timestamp;
          
          brackets.push({
            bracketId: `${cluster.cluster_id}-B${brackets.length + 1}`,
            incidentId: cluster.cluster_id,
            startTime: bracketStartTime,
            endTime: bracketEndTime,
            startSec: bracketStartSec,
            endSec: bracketEndSec,
            durationSec: Math.max(0, bracketEndSec - bracketStartSec),
            alertIds: currentAlerts.map(a => a.id),
            alerts: [...currentAlerts],
            severity: cluster.highestSeverity,
          });

          // Instantiate a new bracket starting at t_{i+1}
          currentAlerts = [sortedAlerts[i + 1]];
          bracketStartSec = tNext;
          bracketStartTime = sortedAlerts[i + 1].timestamp;
        }
      }

      // Close the final active bracket
      const lastAlert = sortedAlerts[sortedAlerts.length - 1];
      const finalEndSec = toEpochSec(lastAlert.timestamp);
      brackets.push({
        bracketId: `${cluster.cluster_id}-B${brackets.length + 1}`,
        incidentId: cluster.cluster_id,
        startTime: bracketStartTime,
        endTime: lastAlert.timestamp,
        startSec: bracketStartSec,
        endSec: finalEndSec,
        durationSec: Math.max(0, finalEndSec - bracketStartSec),
        alertIds: currentAlerts.map(a => a.id),
        alerts: [...currentAlerts],
        severity: cluster.highestSeverity,
      });

      return {
        incident: cluster,
        brackets,
        allAlertsSorted: sortedAlerts,
      };
    });
  }, [clusters]);

  // Safety escalation alerts (separate channel)
  const safetyAlerts = useMemo(() => {
    return rawAlerts.filter(a => a.type.includes('SAFETY') || a.type.includes('LIDAR_SAFETY'));
  }, [rawAlerts]);

  // Timeline Layout Dimensions
  const TIMELINE_WIDTH = 760;
  const LANE_HEIGHT = 44;
  const HEADER_TOP = 28;
  const TOTAL_HEIGHT = HEADER_TOP + incidentLanes.length * LANE_HEIGHT + 36;

  // Convert epoch seconds to X pixel coordinate
  const secToX = (sec: number): number => {
    const clamped = Math.min(Math.max(sec, minTimeSec), maxTimeSec);
    return ((clamped - minTimeSec) / timeSpan) * TIMELINE_WIDTH;
  };

  // Convert X pixel coordinate back to epoch seconds
  const xToSec = (x: number): number => {
    const normalized = Math.min(Math.max(x / TIMELINE_WIDTH, 0), 1);
    return minTimeSec + normalized * timeSpan;
  };

  // Handle click on timeline SVG to scrub
  const handleTimelineClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!ribbonSvgRef.current) return;
    const rect = ribbonSvgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const svgBoxWidth = rect.width;
    // Map from rendered box to timeline coordinate
    const timelineX = (clickX / svgBoxWidth) * (TIMELINE_WIDTH + 80) - 20;
    if (timelineX >= 0 && timelineX <= TIMELINE_WIDTH) {
      onScrubTime(xToSec(timelineX));
    }
  };

  const getSeverityColors = (severity: SeverityLevel) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          bg: '#7F1D1D',
          border: '#EF4444',
          text: '#FCA5A5',
          fill: '#E8503A',
          glow: 'rgba(239, 68, 68, 0.4)',
        };
      case 'HIGH':
        return {
          bg: '#78350F',
          border: '#F59E0B',
          text: '#FDE68A',
          fill: '#E3A226',
          glow: 'rgba(245, 158, 11, 0.3)',
        };
      case 'MEDIUM':
        return {
          bg: '#713F12',
          border: '#EAB308',
          text: '#FEF08A',
          fill: '#EAB308',
          glow: 'rgba(234, 179, 8, 0.25)',
        };
      case 'LOW':
      default:
        return {
          bg: '#1E293B',
          border: '#5E93B0',
          text: '#BAE6FD',
          fill: '#5E93B0',
          glow: 'rgba(94, 147, 176, 0.2)',
        };
    }
  };

  const scrubberX = secToX(currentTimeSec);

  return (
    <div className="bg-[#0C1417] border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl font-mono text-xs select-none space-y-0">
      
      {/* Top Ribbon Control HUD */}
      <div className="bg-[#101B1F] border-b border-slate-700/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-slate-300">
        
        {/* Left: Engine Title & 20s Rule Spec Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-tuas-cyan font-black tracking-wider">
            <Clock className="w-4 h-4 text-tuas-teal animate-pulse" />
            <span className="text-white text-xs uppercase font-sans">INCIDENT TIME RIBBON</span>
          </div>

          <div className="h-3.5 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <span className="bg-tuas-teal/15 text-tuas-teal border border-tuas-teal/30 px-2 py-0.5 rounded font-bold">
              20s SPLIT RULE ACTIVE
            </span>
            <span>•</span>
            <span>TOTAL SPAN: <strong className="text-white">{Math.round(timeSpan)}s</strong></span>
          </div>
        </div>

        {/* Right: Scrubber Clock Readout */}
        <div className="flex items-center space-x-3 bg-black/40 px-3 py-1.5 rounded-xl border border-slate-700">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Scrubber Timestamp:</span>
          <span className="text-tuas-cyan font-mono font-black text-sm">
            {formatClock(currentTimeSec)}
          </span>
          <span className="text-slate-500 text-[10px]">
            (+{Math.max(0, Math.round(currentTimeSec - minTimeSec))}s)
          </span>
        </div>
      </div>

      {/* Main Multi-Lane SVG Timeline Container */}
      <div className="p-4 overflow-x-auto bg-[#0C1417]">
        <svg
          ref={ribbonSvgRef}
          className="w-full h-auto min-w-[840px] cursor-crosshair"
          viewBox={`-20 0 ${TIMELINE_WIDTH + 80} ${TOTAL_HEIGHT}`}
          onClick={handleTimelineClick}
        >
          {/* 1. Time Axis Gridlines & Timestamp Labels */}
          <g className="time-grid-layer">
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((fraction, fIdx) => {
              const x = fraction * TIMELINE_WIDTH;
              const sec = minTimeSec + fraction * timeSpan;
              return (
                <g key={`time-tick-${fIdx}`}>
                  <line
                    x1={x}
                    y1={HEADER_TOP - 8}
                    x2={x}
                    y2={TOTAL_HEIGHT - 16}
                    stroke="#1E2E35"
                    strokeWidth={0.8}
                    strokeDasharray="3 4"
                  />
                  <text
                    x={x}
                    y={TOTAL_HEIGHT - 4}
                    fill="#64748B"
                    fontSize="8.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {formatClock(sec)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 2. Incident Horizontal Lanes */}
          {incidentLanes.map((lane, laneIdx) => {
            const y = HEADER_TOP + laneIdx * LANE_HEIGHT;
            const isSelected = lane.incident.cluster_id === selectedClusterId;
            const colors = getSeverityColors(lane.incident.highestSeverity);

            return (
              <g 
                key={`lane-${lane.incident.cluster_id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCluster(isSelected ? null : lane.incident.cluster_id);
                }}
                className="cursor-pointer transition-opacity"
              >
                {/* Lane Track Background */}
                <rect
                  x={0}
                  y={y}
                  width={TIMELINE_WIDTH}
                  height={LANE_HEIGHT - 8}
                  rx={4}
                  fill={isSelected ? '#182C34' : '#101B20'}
                  stroke={isSelected ? colors.border : '#1E2D33'}
                  strokeWidth={isSelected ? 1.5 : 0.8}
                />

                {/* Left Lane Header Badge / ID */}
                <text
                  x={8}
                  y={y + 16}
                  fill={isSelected ? colors.text : '#E2E8F0'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {lane.incident.cluster_id}
                </text>
                <text
                  x={8}
                  y={y + 27}
                  fill="#87A0A7"
                  fontSize="7.5"
                  fontFamily="monospace"
                >
                  {lane.incident.primary_location} ({lane.allAlertsSorted.length} alerts)
                </text>

                {/* 3. Bracket Segment Capsules (20s Split Rule) */}
                {lane.brackets.map((bracket, bIdx) => {
                  const bX1 = secToX(bracket.startSec);
                  const bX2 = secToX(bracket.endSec);
                  const capsuleWidth = Math.max(bX2 - bX1, 14); // minimum 14px width pill
                  const capsuleY = y + 7;
                  const capsuleHeight = 22;

                  return (
                    <g 
                      key={`bracket-${bracket.bracketId}-${bIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCluster(lane.incident.cluster_id);
                        onScrubTime(bracket.startSec);
                      }}
                      className="cursor-pointer group"
                    >
                      {/* Bracket Capsule Background */}
                      <rect
                        x={bX1}
                        y={capsuleY}
                        width={capsuleWidth}
                        height={capsuleHeight}
                        rx={6}
                        fill={colors.bg}
                        stroke={colors.border}
                        strokeWidth={1.2}
                        opacity={0.85}
                        className="transition-all hover:opacity-100"
                        style={{
                          filter: isSelected ? `drop-shadow(0 0 6px ${colors.glow})` : 'none',
                        }}
                      />

                      {/* Bracket Duration Tag (when width allows) */}
                      {capsuleWidth > 28 && (
                        <text
                          x={bX1 + capsuleWidth / 2}
                          y={capsuleY + 14}
                          fill={colors.text}
                          fontSize="7"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {Math.round(bracket.durationSec)}s
                        </text>
                      )}

                      {/* 4. Clickable Alert Pips inside Bracket */}
                      {bracket.alerts.map((alert, aIdx) => {
                        const alertSec = toEpochSec(alert.timestamp);
                        const alertX = secToX(alertSec);
                        const isAlertSelected = alert.id === selectedAlertId;

                        return (
                          <g
                            key={`pip-${alert.id}-${aIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAlert(alert.id);
                              onSelectCluster(lane.incident.cluster_id);
                              onScrubTime(alertSec);
                            }}
                            className="cursor-pointer"
                          >
                            {/* Alert Pip Core Diamond / Circle */}
                            <circle
                              cx={alertX}
                              cy={capsuleY + capsuleHeight / 2}
                              r={isAlertSelected ? 4.5 : 3}
                              fill={isAlertSelected ? '#FFFFFF' : colors.fill}
                              stroke="#0C1417"
                              strokeWidth={1}
                            />
                            {/* Subtle Pip Tick */}
                            <line
                              x1={alertX}
                              y1={capsuleY + 2}
                              x2={alertX}
                              y2={capsuleY + capsuleHeight - 2}
                              stroke={colors.border}
                              strokeWidth={0.8}
                              opacity={0.6}
                            />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Right Lane Summary Meta */}
                <text
                  x={TIMELINE_WIDTH + 10}
                  y={y + 22}
                  fill={colors.text}
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {lane.brackets.length} {lane.brackets.length === 1 ? 'bracket' : 'brackets'}
                </text>
              </g>
            );
          })}

          {/* 5. Safety Channel Escalation Markers */}
          {safetyAlerts.map((safeAlert, sIdx) => {
            const sX = secToX(toEpochSec(safeAlert.timestamp));
            return (
              <g key={`safety-line-${safeAlert.id}-${sIdx}`}>
                <line
                  x1={sX}
                  y1={HEADER_TOP - 12}
                  x2={sX}
                  y2={TOTAL_HEIGHT - 16}
                  stroke="#E8503A"
                  strokeWidth={1.2}
                  strokeDasharray="2 3"
                />
                <rect
                  x={sX - 18}
                  y={HEADER_TOP - 20}
                  width={36}
                  height={11}
                  rx={2}
                  fill="#7F1D1D"
                  stroke="#E8503A"
                  strokeWidth={0.8}
                />
                <text
                  x={sX}
                  y={HEADER_TOP - 12}
                  fill="#FCA5A5"
                  fontSize="6.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  SAFETY
                </text>
              </g>
            );
          })}

          {/* 6. SHARED VERTICAL SYNCHRONIZED TIME SCRUBBER */}
          <g className="scrubber-layer pointer-events-none">
            {/* Scrubber Vertical Line */}
            <line
              x1={scrubberX}
              y1={HEADER_TOP - 18}
              x2={scrubberX}
              y2={TOTAL_HEIGHT - 16}
              stroke="#38BDF8"
              strokeWidth={2}
              strokeDasharray="none"
              style={{
                filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))',
              }}
            />

            {/* Scrubber Top Handle Pill */}
            <g transform={`translate(${scrubberX}, ${HEADER_TOP - 18})`}>
              <polygon
                points="-5 -6, 5 -6, 5 0, 0 5, -5 0"
                fill="#38BDF8"
                stroke="#0C1417"
                strokeWidth={1}
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Bottom Ribbon Quick Guidance Note */}
      <div className="bg-[#101B1F] border-t border-slate-700/80 px-4 py-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>💡 Click anywhere on the timeline to scrub time. Alerts with &gt;20s gap split into separate capsules automatically.</span>
        <span>Click an alert pip to snap scrubber.</span>
      </div>
    </div>
  );
};
