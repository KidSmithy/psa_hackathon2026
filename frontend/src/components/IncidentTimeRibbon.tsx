import React, { useMemo, useRef } from 'react';
import { Clock, Layers } from 'lucide-react';
import {
  ClusterWithAlerts,
  RawAlert,
  TimeBracket,
  SeverityLevel,
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

/** One incident reduced to what the timeline actually draws. */
interface IncidentSpan {
  clusterId: string;
  name: string;
  location: string;
  severity: SeverityLevel;
  problemType?: string;
  isSingleton: boolean;
  startSec: number;
  endSec: number;
  alertCount: number;
}

const SEVERITY_STACK_ORDER: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

// Layout is fixed: nothing here grows with the number of incidents, so a batch
// of four and a batch of four hundred render at exactly the same height.
const TIMELINE_WIDTH = 760;
const HIST_TOP = 24;
const HIST_HEIGHT = 68;
const HIST_BASELINE = HIST_TOP + HIST_HEIGHT;
const TRACK_TOP = HIST_BASELINE + 18;
const TRACK_HEIGHT = 26;
const TRACK_MID = TRACK_TOP + TRACK_HEIGHT / 2;
const ALERT_STRIP_TOP = TRACK_TOP + TRACK_HEIGHT + 10;
const ALERT_STRIP_HEIGHT = 10;
const AXIS_LABEL_Y = ALERT_STRIP_TOP + ALERT_STRIP_HEIGHT + 16;
const BRACKET_BAND_HEIGHT = 32;
const BASE_HEIGHT = AXIS_LABEL_Y + 10;

const BUCKET_COUNT = 60;
const SPLIT_THRESHOLD_SECONDS = 20;

const toEpochSec = (isoString: string): number => {
  const d = Date.parse(isoString);
  return isNaN(d) ? 0 : d / 1000;
};

const formatClock = (epochSec: number): string => {
  if (!epochSec || isNaN(epochSec)) return '00:00:00';
  return new Date(epochSec * 1000).toISOString().slice(11, 19);
};

const getSeverityColors = (severity: SeverityLevel) => {
  switch (severity) {
    case 'CRITICAL':
      return { bg: '#7F1D1D', border: '#EF4444', text: '#FCA5A5', fill: '#E8503A', glow: 'rgba(239, 68, 68, 0.45)' };
    case 'HIGH':
      return { bg: '#78350F', border: '#F59E0B', text: '#FDE68A', fill: '#E3A226', glow: 'rgba(245, 158, 11, 0.35)' };
    case 'MEDIUM':
      return { bg: '#713F12', border: '#EAB308', text: '#FEF08A', fill: '#EAB308', glow: 'rgba(234, 179, 8, 0.3)' };
    case 'LOW':
    case 'INFO':
    default:
      return { bg: '#1E293B', border: '#5E93B0', text: '#BAE6FD', fill: '#5E93B0', glow: 'rgba(94, 147, 176, 0.25)' };
  }
};

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
  const timeSpan = Math.max(1, maxTimeSec - minTimeSec);

  // ---------------------------------------------------------------------
  // One span per incident. Nothing is grouped by AGV or by cluster lane —
  // an incident is a point in time with a duration, and that is all the
  // timeline needs to place it.
  // ---------------------------------------------------------------------
  const incidentSpans: IncidentSpan[] = useMemo(() => {
    return clusters
      .map((cluster): IncidentSpan | null => {
        const times = cluster.alerts
          .map(a => toEpochSec(a.timestamp))
          .filter(t => t > 0);
        if (times.length === 0) return null;
        return {
          clusterId: cluster.cluster_id,
          name: cluster.name,
          location: cluster.primary_location,
          severity: cluster.highestSeverity,
          problemType: cluster.problem_type,
          // v1 rows carry no is_singleton column; a one-alert incident is a
          // singleton either way, so derive it rather than require the field.
          isSingleton: cluster.is_singleton ?? cluster.alerts.length === 1,
          startSec: Math.min(...times),
          endSec: Math.max(...times),
          alertCount: cluster.alerts.length,
        };
      })
      .filter((s): s is IncidentSpan => s !== null)
      .sort((a, b) => a.startSec - b.startSec);
  }, [clusters]);

  // ---------------------------------------------------------------------
  // Onset density, stacked by severity. This is what stays readable when
  // there are hundreds of incidents: individual marks collide, a count per
  // time bucket does not.
  // ---------------------------------------------------------------------
  const { buckets, peakCount } = useMemo(() => {
    const width = timeSpan / BUCKET_COUNT;
    const empty = (): Record<SeverityLevel, number> => ({
      CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0, NOMINAL: 0,
    });
    const counts = Array.from({ length: BUCKET_COUNT }, empty);

    incidentSpans.forEach(span => {
      const idx = Math.min(
        BUCKET_COUNT - 1,
        Math.max(0, Math.floor((span.startSec - minTimeSec) / width))
      );
      const severity = SEVERITY_STACK_ORDER.includes(span.severity) ? span.severity : 'LOW';
      counts[idx][severity] += 1;
    });

    const totals = counts.map(c => SEVERITY_STACK_ORDER.reduce((sum, s) => sum + c[s], 0));
    return { buckets: counts, peakCount: Math.max(1, ...totals) };
  }, [incidentSpans, minTimeSec, timeSpan]);

  // Bracket segmentation still exists, but it now describes the *selected*
  // incident rather than giving every incident a permanent row.
  const selectedSpan = incidentSpans.find(s => s.clusterId === selectedClusterId) || null;
  const selectedCluster = clusters.find(c => c.cluster_id === selectedClusterId) || null;

  const selectedBrackets: TimeBracket[] = useMemo(() => {
    if (!selectedCluster) return [];
    const sorted = [...selectedCluster.alerts].sort(
      (a, b) => toEpochSec(a.timestamp) - toEpochSec(b.timestamp)
    );
    if (sorted.length === 0) return [];

    const brackets: TimeBracket[] = [];
    let members: RawAlert[] = [sorted[0]];
    let startTime = sorted[0].timestamp;
    let startSec = toEpochSec(startTime);

    const close = (endAlert: RawAlert) => {
      const endSec = toEpochSec(endAlert.timestamp);
      brackets.push({
        bracketId: `${selectedCluster.cluster_id}-B${brackets.length + 1}`,
        incidentId: selectedCluster.cluster_id,
        startTime,
        endTime: endAlert.timestamp,
        startSec,
        endSec,
        durationSec: Math.max(0, endSec - startSec),
        alertIds: members.map(a => a.id),
        alerts: [...members],
        severity: selectedCluster.highestSeverity,
      });
    };

    for (let i = 0; i < sorted.length - 1; i++) {
      const delta = toEpochSec(sorted[i + 1].timestamp) - toEpochSec(sorted[i].timestamp);
      if (delta <= SPLIT_THRESHOLD_SECONDS) {
        members.push(sorted[i + 1]);
      } else {
        close(sorted[i]);
        members = [sorted[i + 1]];
        startTime = sorted[i + 1].timestamp;
        startSec = toEpochSec(startTime);
      }
    }
    close(sorted[sorted.length - 1]);
    return brackets;
  }, [selectedCluster]);

  const safetyAlerts = useMemo(
    () => rawAlerts.filter(a => a.type.includes('SAFETY') || a.type.includes('LIDAR_SAFETY')),
    [rawAlerts]
  );

  const totalHeight = BASE_HEIGHT + (selectedSpan ? BRACKET_BAND_HEIGHT : 0);

  const secToX = (sec: number): number => {
    const clamped = Math.min(Math.max(sec, minTimeSec), maxTimeSec);
    return ((clamped - minTimeSec) / timeSpan) * TIMELINE_WIDTH;
  };

  const xToSec = (x: number): number => {
    const normalized = Math.min(Math.max(x / TIMELINE_WIDTH, 0), 1);
    return minTimeSec + normalized * timeSpan;
  };

  const handleTimelineClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!ribbonSvgRef.current) return;
    const rect = ribbonSvgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineX = (clickX / rect.width) * (TIMELINE_WIDTH + 80) - 20;
    if (timelineX >= 0 && timelineX <= TIMELINE_WIDTH) {
      onScrubTime(xToSec(timelineX));
    }
  };

  const scrubberX = secToX(currentTimeSec);
  const bucketWidth = TIMELINE_WIDTH / BUCKET_COUNT;
  const severityCounts = SEVERITY_STACK_ORDER.map(s => ({
    severity: s,
    count: incidentSpans.filter(i => i.severity === s).length,
  })).filter(entry => entry.count > 0);

  return (
    <div className="bg-[#0C1417] border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl font-mono text-xs select-none">

      {/* HUD */}
      <div className="bg-[#101B1F] border-b border-slate-700/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-tuas-cyan font-black tracking-wider">
            <Clock className="w-4 h-4 text-tuas-teal animate-pulse" />
            <span className="text-white text-xs uppercase font-sans">UNIFIED INCIDENT TIMELINE</span>
          </div>

          <div className="h-3.5 w-px bg-slate-700 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="bg-tuas-teal/15 text-tuas-teal border border-tuas-teal/30 px-2 py-0.5 rounded font-bold">
              {incidentSpans.length} INCIDENTS
            </span>
            <span>•</span>
            <span>{rawAlerts.length} alerts</span>
            <span>•</span>
            <span>SPAN <strong className="text-white">{Math.round(timeSpan)}s</strong></span>
            <span>•</span>
            <span>PEAK <strong className="text-white">{peakCount}</strong>/bucket</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-black/40 px-3 py-1.5 rounded-xl border border-slate-700">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Timestamp:</span>
          <span className="text-tuas-cyan font-mono font-black text-sm">{formatClock(currentTimeSec)}</span>
          <span className="text-slate-500 text-[10px]">
            (+{Math.max(0, Math.round(currentTimeSec - minTimeSec))}s)
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#0E181C] border-b border-slate-800 px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
        <span className="uppercase tracking-wider font-bold text-slate-500">Severity:</span>
        {severityCounts.map(({ severity, count }) => (
          <span key={severity} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm inline-block"
              style={{ backgroundColor: getSeverityColors(severity).fill }}
            />
            {severity} <strong className="text-slate-200">{count}</strong>
          </span>
        ))}
        {severityCounts.length === 0 && <span>no incidents in range</span>}
      </div>

      {/* Timeline */}
      <div className="p-4 overflow-x-auto bg-[#0C1417]">
        <svg
          ref={ribbonSvgRef}
          className="w-full h-auto min-w-[840px] cursor-crosshair"
          viewBox={`-20 0 ${TIMELINE_WIDTH + 80} ${totalHeight}`}
          onClick={handleTimelineClick}
        >
          {/* Time gridlines and clock labels */}
          <g>
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((fraction, i) => {
              const x = fraction * TIMELINE_WIDTH;
              return (
                <g key={`tick-${i}`}>
                  <line
                    x1={x} y1={HIST_TOP - 6} x2={x} y2={AXIS_LABEL_Y - 12}
                    stroke="#1E2E35" strokeWidth={0.8} strokeDasharray="3 4"
                  />
                  <text
                    x={x} y={AXIS_LABEL_Y} fill="#64748B" fontSize="8.5"
                    fontFamily="monospace" textAnchor="middle"
                  >
                    {formatClock(minTimeSec + fraction * timeSpan)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Band 1: incident onset density, stacked by severity */}
          <g>
            <line
              x1={0} y1={HIST_BASELINE} x2={TIMELINE_WIDTH} y2={HIST_BASELINE}
              stroke="#243840" strokeWidth={1}
            />
            <text
              x={TIMELINE_WIDTH + 8} y={HIST_TOP + 8} fill="#5E93B0"
              fontSize="7.5" fontFamily="monospace" fontWeight="bold"
            >
              {peakCount} max
            </text>
            <text
              x={TIMELINE_WIDTH + 8} y={HIST_BASELINE} fill="#87A0A7"
              fontSize="7.5" fontFamily="monospace"
            >
              onsets
            </text>

            {buckets.map((bucket, bIdx) => {
              const x = bIdx * bucketWidth;
              let stackTop = HIST_BASELINE;
              const total = SEVERITY_STACK_ORDER.reduce((sum, s) => sum + bucket[s], 0);
              if (total === 0) return null;

              return (
                <g key={`bucket-${bIdx}`}>
                  <title>
                    {`${formatClock(minTimeSec + bIdx * (timeSpan / BUCKET_COUNT))} — ${total} incident${total === 1 ? '' : 's'} started`}
                  </title>
                  {SEVERITY_STACK_ORDER.map(severity => {
                    const count = bucket[severity];
                    if (count === 0) return null;
                    const barHeight = (count / peakCount) * HIST_HEIGHT;
                    stackTop -= barHeight;
                    return (
                      <rect
                        key={`${bIdx}-${severity}`}
                        x={x + 0.5}
                        y={stackTop}
                        width={Math.max(1.5, bucketWidth - 1)}
                        height={barHeight}
                        fill={getSeverityColors(severity).fill}
                        opacity={0.85}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* Band 2: every incident on one shared track */}
          <g>
            <rect
              x={0} y={TRACK_TOP} width={TIMELINE_WIDTH} height={TRACK_HEIGHT}
              rx={4} fill="#101B20" stroke="#1E2D33" strokeWidth={0.8}
            />
            <text
              x={TIMELINE_WIDTH + 8} y={TRACK_MID + 3} fill="#87A0A7"
              fontSize="7.5" fontFamily="monospace"
            >
              incidents
            </text>

            {incidentSpans.map(span => {
              const isSelected = span.clusterId === selectedClusterId;
              const colors = getSeverityColors(span.severity);
              const x1 = secToX(span.startSec);
              const x2 = secToX(span.endSec);
              const markerSize = isSelected ? 5.5 : 3.5;

              return (
                <g
                  key={`incident-${span.clusterId}`}
                  onClick={e => {
                    e.stopPropagation();
                    onSelectCluster(isSelected ? null : span.clusterId);
                    onScrubTime(span.startSec);
                  }}
                  className="cursor-pointer"
                >
                  <title>
                    {`${span.clusterId} — ${span.name}\n${span.location} • ${span.alertCount} alert${span.alertCount === 1 ? '' : 's'} • ${span.severity}${span.isSingleton ? ' • singleton' : ''}\n${formatClock(span.startSec)} → ${formatClock(span.endSec)}`}
                  </title>

                  {/* Duration whisker: how long the incident's alerts kept arriving */}
                  {x2 > x1 + 1 && (
                    <line
                      x1={x1} y1={TRACK_MID} x2={x2} y2={TRACK_MID}
                      stroke={colors.border}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      opacity={isSelected ? 0.95 : 0.45}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Onset marker. Diamond for a correlated incident, small
                      circle for a singleton — one glance tells you whether the
                      algorithm found corroborating alerts or just the one. */}
                  {span.isSingleton ? (
                    <circle
                      cx={x1} cy={TRACK_MID} r={markerSize - 0.5}
                      fill="#0C1417" stroke={colors.fill}
                      strokeWidth={isSelected ? 2 : 1.4}
                      style={{ filter: isSelected ? `drop-shadow(0 0 5px ${colors.glow})` : 'none' }}
                    />
                  ) : (
                    <rect
                      x={x1 - markerSize} y={TRACK_MID - markerSize}
                      width={markerSize * 2} height={markerSize * 2}
                      transform={`rotate(45 ${x1} ${TRACK_MID})`}
                      fill={colors.fill} stroke={isSelected ? '#FFFFFF' : '#0C1417'}
                      strokeWidth={isSelected ? 1.5 : 1}
                      style={{ filter: isSelected ? `drop-shadow(0 0 6px ${colors.glow})` : 'none' }}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Band 3: raw alert arrivals, for texture under the incidents */}
          <g>
            {rawAlerts.map(alert => {
              const x = secToX(toEpochSec(alert.timestamp));
              const isSelected = alert.id === selectedAlertId;
              return (
                <line
                  key={`alert-tick-${alert.id}`}
                  x1={x} y1={ALERT_STRIP_TOP}
                  x2={x} y2={ALERT_STRIP_TOP + ALERT_STRIP_HEIGHT}
                  stroke={isSelected ? '#FFFFFF' : getSeverityColors(alert.severity).fill}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={isSelected ? 1 : 0.5}
                  className="cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    onSelectAlert(isSelected ? null : alert.id);
                    onScrubTime(toEpochSec(alert.timestamp));
                  }}
                >
                  <title>{`${alert.id} • ${alert.type} • ${alert.severity}\n${alert.message}`}</title>
                </line>
              );
            })}
            <text
              x={TIMELINE_WIDTH + 8} y={ALERT_STRIP_TOP + ALERT_STRIP_HEIGHT}
              fill="#87A0A7" fontSize="7.5" fontFamily="monospace"
            >
              alerts
            </text>
          </g>

          {/* Band 4: 20s split brackets, for the selected incident only */}
          {selectedSpan && selectedCluster && (
            <g>
              <text
                x={0} y={BASE_HEIGHT + 10} fill="#87A0A7"
                fontSize="7.5" fontFamily="monospace" fontWeight="bold"
              >
                {selectedSpan.clusterId} — {selectedBrackets.length} bracket
                {selectedBrackets.length === 1 ? '' : 's'} (20s split)
              </text>
              {selectedBrackets.map(bracket => {
                const bX1 = secToX(bracket.startSec);
                const bX2 = secToX(bracket.endSec);
                const colors = getSeverityColors(bracket.severity);
                return (
                  <g
                    key={bracket.bracketId}
                    onClick={e => {
                      e.stopPropagation();
                      onScrubTime(bracket.startSec);
                    }}
                    className="cursor-pointer"
                  >
                    <title>
                      {`${bracket.bracketId} • ${Math.round(bracket.durationSec)}s • ${bracket.alertIds.length} alerts`}
                    </title>
                    <rect
                      x={bX1}
                      y={BASE_HEIGHT + 14}
                      width={Math.max(bX2 - bX1, 6)}
                      height={13}
                      rx={4}
                      fill={colors.bg}
                      stroke={colors.border}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Safety-channel markers */}
          {safetyAlerts.map(safeAlert => {
            const sX = secToX(toEpochSec(safeAlert.timestamp));
            return (
              <g key={`safety-${safeAlert.id}`} className="pointer-events-none">
                <line
                  x1={sX} y1={HIST_TOP - 12} x2={sX} y2={ALERT_STRIP_TOP + ALERT_STRIP_HEIGHT}
                  stroke="#E8503A" strokeWidth={1.2} strokeDasharray="2 3" opacity={0.8}
                />
                <rect
                  x={sX - 17} y={HIST_TOP - 21} width={34} height={11} rx={2}
                  fill="#7F1D1D" stroke="#E8503A" strokeWidth={0.8}
                />
                <text
                  x={sX} y={HIST_TOP - 13} fill="#FCA5A5" fontSize="6.5"
                  fontFamily="monospace" fontWeight="bold" textAnchor="middle"
                >
                  SAFETY
                </text>
              </g>
            );
          })}

          {/* Shared scrubber */}
          <g className="pointer-events-none">
            <line
              x1={scrubberX} y1={HIST_TOP - 18} x2={scrubberX} y2={AXIS_LABEL_Y - 10}
              stroke="#38BDF8" strokeWidth={2}
              style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))' }}
            />
            <g transform={`translate(${scrubberX}, ${HIST_TOP - 18})`}>
              <polygon points="-5 -6, 5 -6, 5 0, 0 5, -5 0" fill="#38BDF8" stroke="#0C1417" strokeWidth={1} />
            </g>
          </g>
        </svg>
      </div>

      {/* Chronological incident chips — the way to reach an incident whose
          marker is buried under a busy stretch of the timeline. */}
      <div className="bg-[#0E181C] border-t border-slate-800 px-4 py-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
          <Layers className="w-3 h-3" />
          <span>Incidents in time order</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          {incidentSpans.length === 0 && (
            <span className="text-slate-600 text-[11px]">No incidents in the current range.</span>
          )}
          {incidentSpans.map(span => {
            const isSelected = span.clusterId === selectedClusterId;
            const colors = getSeverityColors(span.severity);
            return (
              <button
                key={`chip-${span.clusterId}`}
                onClick={() => {
                  onSelectCluster(isSelected ? null : span.clusterId);
                  onScrubTime(span.startSec);
                }}
                title={`${span.name} • ${span.location}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all ${
                  isSelected
                    ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                    : 'bg-black/40 border-slate-600 text-slate-100 hover:border-slate-400 hover:text-white'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colors.fill }}
                />
                <span>{span.clusterId}</span>
                <span className="text-slate-300 font-normal">{formatClock(span.startSec)}</span>
                {span.isSingleton && (
                  <span className="text-slate-300 font-normal">·1</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer guidance */}
      <div className="bg-[#101B1F] border-t border-slate-700/80 px-4 py-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        <span>Click on the diamonds, circles or incident boxes.</span>
      </div>
    </div>
  );
};
