import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Compass, 
  Truck, 
  Battery, 
  Gauge, 
  AlertTriangle, 
  ShieldAlert, 
  Maximize2,
  Zap,
  Layers
} from 'lucide-react';
import { 
  YardGraph, 
  RawAlert, 
  ClusterWithAlerts, 
  AGVTelemetryRow, 
  LaneQueueRow, 
  InterpolatedAGVState 
} from '../types';
import { YARD_GRAPH, YARD_EXTENT, resolveYardCoordinates, VEHICLE_INITIAL_SLOTS } from '../data/yardTopology';

interface YardMapVisualizerProps {
  yardGraph?: YardGraph;
  clusters: ClusterWithAlerts[];
  rawAlerts: RawAlert[];
  telemetryList: AGVTelemetryRow[];
  laneQueues?: LaneQueueRow[];
  selectedClusterId: string | null;
  selectedVehicleId: string | null;
  onSelectCluster: (clusterId: string | null) => void;
  onSelectVehicle: (vehicleId: string | null) => void;
  currentTimeSec?: number;
}

interface PanState {
  x: number;
  y: number;
}

export const YardMapVisualizer: React.FC<YardMapVisualizerProps> = ({
  yardGraph = YARD_GRAPH,
  clusters,
  rawAlerts,
  telemetryList,
  laneQueues = [],
  selectedClusterId,
  selectedVehicleId,
  onSelectCluster,
  onSelectVehicle,
  currentTimeSec,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Viewport transform: 0.78x default zoom for wide, spacious overview of full terminal
  const [zoom, setZoom] = useState<number>(0.78);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<PanState>({ x: 0, y: 0 });
  const [cursorCoords, setCursorCoords] = useState<PanState | null>(null);

  // Layer visibility toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showTracks, setShowTracks] = useState<boolean>(true);
  const [showHalos, setShowHalos] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  const { xMax, yMax } = yardGraph.extent;
  // Convert yard Y (0 at bottom, north-up) to SVG Y (0 at top)
  const FY = (y: number) => yMax - y;

  // Build telemetry lookup
  const telemetryByVehicle = useMemo(() => {
    const map = new Map<string, AGVTelemetryRow>();
    telemetryList.forEach(t => map.set(t.vehicle_id, t));
    return map;
  }, [telemetryList]);

  // Consolidated & De-duplicated Canonical AGV Fleet
  const agvStates: InterpolatedAGVState[] = useMemo(() => {
    const CANONICAL_VEHICLES = [
      { primaryId: 'ATT-142', aliasId: 'AGV-104', defaultSlot: VEHICLE_INITIAL_SLOTS['ATT-142'] },
      { primaryId: 'ATT-089', aliasId: 'AGV-109', defaultSlot: VEHICLE_INITIAL_SLOTS['ATT-089'] },
      { primaryId: 'ATT-112', aliasId: 'AGV-112', defaultSlot: VEHICLE_INITIAL_SLOTS['ATT-112'] },
      { primaryId: 'ATT-733', aliasId: null, defaultSlot: VEHICLE_INITIAL_SLOTS['ATT-733'] },
      { primaryId: 'AGV-088', aliasId: null, defaultSlot: VEHICLE_INITIAL_SLOTS['AGV-088'] },
      { primaryId: 'AGV-072', aliasId: null, defaultSlot: VEHICLE_INITIAL_SLOTS['AGV-072'] },
      { primaryId: 'ATT-055', aliasId: 'AGV-055', defaultSlot: VEHICLE_INITIAL_SLOTS['ATT-055'] },
      { primaryId: 'AGV-061', aliasId: null, defaultSlot: VEHICLE_INITIAL_SLOTS['AGV-061'] },
      { primaryId: 'ATT-201', aliasId: 'AGV-201', defaultSlot: VEHICLE_INITIAL_SLOTS['ATT-201'] },
      { primaryId: 'AGV-303', aliasId: null, defaultSlot: VEHICLE_INITIAL_SLOTS['AGV-303'] },
    ];

    return CANONICAL_VEHICLES.map(({ primaryId, aliasId, defaultSlot }) => {
      const telem = telemetryByVehicle.get(primaryId) || (aliasId ? telemetryByVehicle.get(aliasId) : undefined);
      const vAlerts = rawAlerts.filter(a => a.source === primaryId || (aliasId && a.source === aliasId));
      const latestAlert = vAlerts[0] || null;

      const parentCluster = clusters.find(c => 
        c.raw_alert_ids?.some(aid => vAlerts.some(va => va.id === aid)) ||
        c.primary_location.includes(primaryId) ||
        (aliasId && c.primary_location.includes(aliasId))
      );

      const speedVal = telem ? Number(telem.speed_mps) || 0 : 0;
      const hasError = telem ? (telem.error_register !== 'OK' && telem.error_register !== '') : false;
      const isCritical = latestAlert?.severity === 'CRITICAL' || hasError;
      const isWarning = latestAlert?.severity === 'HIGH' || latestAlert?.severity === 'MEDIUM' || Boolean(telem?.protective_field_violation);

      return {
        vehicleId: primaryId,
        x: defaultSlot.x,
        y: defaultSlot.y,
        speed: speedVal,
        headingRad: defaultSlot.heading,
        drivingState: telem?.driving_state || (speedVal > 0 ? 'DRIVING' : 'STOPPED'),
        loadState: telem?.load_state || 'LOADED',
        batteryPct: telem ? Number(telem.battery_soc_percent) || 75 : 75,
        hydraulicPressureBar: telem ? Number(telem.hydraulic_pressure_bar) || 160 : 160,
        motorTempC: telem ? Number(telem.motor_temp_c) || 40 : 40,
        errorRegister: telem?.error_register || (latestAlert ? latestAlert.type : 'OK'),
        isProtectiveFieldViolated: Boolean(telem?.protective_field_violation),
        isWarning,
        isCritical,
        activeIncidentId: parentCluster ? parentCluster.cluster_id : null,
        currentAlertId: latestAlert ? latestAlert.id : null,
        nearestNamedFeature: defaultSlot.nearest,
      };
    });
  }, [telemetryList, rawAlerts, clusters, telemetryByVehicle]);

  // Spatial Incident Centroids
  const clusterCentroids = useMemo(() => {
    return clusters.map(c => {
      const coords = resolveYardCoordinates(c.primary_location);
      const isSelected = c.cluster_id === selectedClusterId;
      const isCritical = c.highestSeverity === 'CRITICAL';
      const isHigh = c.highestSeverity === 'HIGH';

      return {
        clusterId: c.cluster_id,
        name: c.name,
        locationName: c.primary_location,
        x: coords.x,
        y: coords.y,
        severity: c.highestSeverity,
        isCritical,
        isHigh,
        isSelected,
        alertCount: c.alerts.length,
      };
    });
  }, [clusters, selectedClusterId]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.45), 3.5));
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const viewBoxWidth = (xMax + 100) / zoom;
      const viewBoxHeight = (yMax + 100) / zoom;
      const yardX = (clientX / rect.width) * viewBoxWidth - 50;
      const yardY = yMax - ((clientY / rect.height) * viewBoxHeight - 50);

      if (yardX >= 0 && yardX <= xMax && yardY >= 0 && yardY <= yMax) {
        setCursorCoords({ x: Math.round(yardX), y: Math.round(yardY) });
      } else {
        setCursorCoords(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(0.78);
    setPan({ x: 0, y: 0 });
  };

  const handleFocusIncident = () => {
    if (!selectedClusterId) return;
    const target = clusterCentroids.find(c => c.clusterId === selectedClusterId);
    if (!target) return;

    setZoom(1.45);
    setPan({
      x: -target.x * 0.45 + 240,
      y: -(FY(target.y)) * 0.45 + 160,
    });
  };

  useEffect(() => {
    if (selectedClusterId) {
      handleFocusIncident();
    }
  }, [selectedClusterId]);

  return (
    <div className="flex flex-col bg-[#060B0D] border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl font-mono text-xs select-none relative">
      
      {/* Top Visualizer HUD Bar */}
      <div className="bg-[#0C1518] border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-slate-300 z-10">
        
        {/* Left: Terminal HUD Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-tuas-teal font-black tracking-wider">
            <Compass className="w-4 h-4 text-tuas-teal animate-spin-slow" />
            <span className="text-white text-xs uppercase font-sans font-bold">SPACED AGV YARD MAP (850m × 480m)</span>
          </div>
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setZoom(z => Math.min(z * 1.2, 3.5))}
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z * 0.8, 0.45))}
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded"
              title="Reset Yard View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {selectedClusterId && (
              <button
                onClick={handleFocusIncident}
                className="px-2.5 py-1 bg-tuas-teal/20 text-tuas-teal hover:bg-tuas-teal hover:text-psa-navy rounded text-[10px] font-bold border border-tuas-teal/40 transition-all flex items-center space-x-1"
                title="Center on Incident"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Focus</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main SVG Viewport */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[540px] md:h-[620px] bg-[#060B0D] overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`-50 -50 ${xMax + 100} ${yMax + 100}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Soft Radial Gradients for Incident Halos */}
            <radialGradient id="haloCriticalGlow">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#DC2626" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="haloWarningGlow">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#D97706" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
            </radialGradient>

            {/* Velocity Arrowhead */}
            <marker
              id="velArrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#38BDF8" />
            </marker>
          </defs>

          {/* Background Sector Watermarks for Maximum Clarity */}
          <g className="sector-watermarks opacity-30 pointer-events-none">
            <text x="350" y={FY(430)} fill="#1E3842" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              BERTH APRON • QUAY CRANES (QC-03 / 04 / 05)
            </text>
            <text x="240" y={FY(35)} fill="#1E3842" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              BCSS CHARGING & SWAPPING STATIONS
            </text>
            <text x="660" y={FY(155)} fill="#1E3842" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              EAST MAINLINE CORRIDORS (LANE 7, 8, 12)
            </text>
          </g>

          {/* 1. LAYER: METRIC GRID */}
          {showGrid && (
            <g className="grid-layer">
              {/* Vertical 100m lines */}
              {[0, 100, 200, 300, 400, 500, 600, 700, 800].map(x => (
                <g key={`gx-${x}`}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={yMax}
                    stroke="#0F1D22"
                    strokeWidth={0.8}
                  />
                  <text
                    x={x}
                    y={yMax + 16}
                    fill="#314B54"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {x}m
                  </text>
                </g>
              ))}

              {/* Horizontal 100m lines */}
              {[0, 100, 200, 300, 400].map(y => {
                const sy = FY(y);
                return (
                  <g key={`gy-${y}`}>
                    <line
                      x1={0}
                      y1={sy}
                      x2={xMax}
                      y2={sy}
                      stroke="#0F1D22"
                      strokeWidth={0.8}
                    />
                    <text
                      x={-10}
                      y={sy + 3.5}
                      fill="#314B54"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {y}m
                    </text>
                  </g>
                );
              })}

              {/* Outer Boundary Frame */}
              <rect
                x={0}
                y={0}
                width={xMax}
                height={yMax}
                fill="none"
                stroke="#1A2D33"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* 2. LAYER: ROADWAY CORRIDORS & TRACKS */}
          {showTracks && (
            <g className="tracks-layer">
              {yardGraph.edges.map((e, idx) => {
                const nodeA = yardGraph.nodes.find(n => n.id === e.from);
                const nodeB = yardGraph.nodes.find(n => n.id === e.to);
                if (!nodeA || !nodeB) return null;

                const x1 = nodeA.x, y1 = FY(nodeA.y);
                const x2 = nodeB.x, y2 = FY(nodeB.y);

                return (
                  <g key={`track-${e.from}-${e.to}-${idx}`}>
                    {/* Outer Road Bed */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#102026"
                      strokeWidth={18}
                      strokeLinecap="round"
                    />
                    {/* Asphalt Surface */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#18313A"
                      strokeWidth={14}
                      strokeLinecap="round"
                    />
                    {/* Guidance Dashed Centerline */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#385F6B"
                      strokeWidth={0.9}
                      strokeDasharray="6 6"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* 3. LAYER: YARD INFRASTRUCTURE NODES */}
          <g className="nodes-layer">
            {yardGraph.nodes.map(node => {
              const cx = node.x;
              const cy = FY(node.y);
              const isJunction = node.type === 'junction';
              const isCharger = node.type === 'charger';
              const isCrane = node.type === 'crane_handoff';

              return (
                <g key={`infra-${node.id}`}>
                  {/* Quay Crane Gantry Box */}
                  {isCrane && (
                    <g>
                      <rect
                        x={cx - 22}
                        y={cy - 12}
                        width={44}
                        height={24}
                        rx={4}
                        fill="#0A2233"
                        stroke="#38BDF8"
                        strokeWidth={1.5}
                      />
                      <text
                        x={cx}
                        y={cy + 4}
                        fill="#38BDF8"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {node.id.replace('-HANDOFF', '')}
                      </text>
                    </g>
                  )}

                  {/* BCSS Charger Station Box */}
                  {isCharger && (
                    <g>
                      <rect
                        x={cx - 20}
                        y={cy - 11}
                        width={40}
                        height={22}
                        rx={4}
                        fill="#0B2B20"
                        stroke="#10B981"
                        strokeWidth={1.5}
                      />
                      <text
                        x={cx}
                        y={cy + 4}
                        fill="#10B981"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ⚡ {node.id.replace('CHARGER-', '')}
                      </text>
                    </g>
                  )}

                  {/* Junction Diamond */}
                  {isJunction && (
                    <g>
                      <rect
                        x={cx - 8}
                        y={cy - 8}
                        width={16}
                        height={16}
                        transform={`rotate(45 ${cx} ${cy})`}
                        fill="#142B33"
                        stroke="#5E93B0"
                        strokeWidth={1.5}
                      />
                      {showLabels && (
                        <text
                          x={cx}
                          y={cy - 15}
                          fill="#7EABB8"
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {node.id.replace('JUNCTION-', 'J-')}
                        </text>
                      )}
                    </g>
                  )}

                  {/* Lane Marker Node */}
                  {!isCrane && !isCharger && !isJunction && (
                    <g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#142B33"
                        stroke="#45707E"
                        strokeWidth={1.2}
                      />
                      {showLabels && (
                        <text
                          x={cx}
                          y={cy + 16}
                          fill="#6893A1"
                          fontSize="8.5"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {node.label}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 4. LAYER: CLEAN SPACED INCIDENT HALOS & FLOATING BADGES */}
          {showHalos && (
            <g className="halos-layer">
              {clusterCentroids.map(c => {
                const cy = FY(c.y);
                const haloRadius = 32; // Clean, non-overlapping radius

                return (
                  <g
                    key={`halo-${c.clusterId}`}
                    onClick={() => onSelectCluster(c.isSelected ? null : c.clusterId)}
                    className="cursor-pointer group"
                  >
                    {/* Gentle Pulsing Radial Halo */}
                    <circle
                      cx={c.x}
                      cy={cy}
                      r={c.isSelected ? haloRadius * 1.15 : haloRadius}
                      fill={c.isCritical ? 'url(#haloCriticalGlow)' : 'url(#haloWarningGlow)'}
                      className={c.isCritical ? 'animate-pulse' : ''}
                    />

                    {/* Spatial Boundary Window Ring */}
                    <circle
                      cx={c.x}
                      cy={cy}
                      r={haloRadius}
                      fill="none"
                      stroke={c.isCritical ? '#EF4444' : '#F59E0B'}
                      strokeWidth={c.isSelected ? 2 : 1.2}
                      strokeDasharray={c.isSelected ? '4 3' : '3 4'}
                      opacity={c.isSelected ? 0.95 : 0.65}
                    />

                    {/* Floating Incident Pill Badge (Cleanly Elevated Above) */}
                    <g transform={`translate(${c.x}, ${cy - haloRadius - 8})`}>
                      <rect
                        x={-42}
                        y={-7}
                        width={84}
                        height={14}
                        rx={3}
                        fill="#060E12"
                        stroke={c.isCritical ? '#EF4444' : '#F59E0B'}
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={3.5}
                        fill={c.isCritical ? '#FCA5A5' : '#FDE68A'}
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {c.clusterId} ({c.alertCount})
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* 5. LAYER: DE-DUPLICATED CANONICAL AGVs (SPACED QUEUES) */}
          <g className="agv-layer">
            {agvStates.map(agv => {
              const cx = agv.x;
              const cy = FY(agv.y);
              const isSelected = agv.vehicleId === selectedVehicleId;
              const isLeadIncident = agv.activeIncidentId === selectedClusterId;
              const speed = agv.speed;

              // Velocity Arrow (when moving)
              const vectorLength = Math.max(speed * 7, 16);
              const vx = cx + Math.cos(agv.headingRad) * vectorLength;
              const vy = cy - Math.sin(agv.headingRad) * vectorLength;

              return (
                <g
                  key={`agv-marker-${agv.vehicleId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectVehicle(isSelected ? null : agv.vehicleId);
                    if (agv.activeIncidentId) {
                      onSelectCluster(agv.activeIncidentId);
                    }
                  }}
                  className="cursor-pointer group"
                >
                  {/* Selection Pulsing Ring */}
                  {(isSelected || isLeadIncident) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={20}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                      className="animate-spin-slow"
                    />
                  )}

                  {/* Velocity Vector Arrow (when driving) */}
                  {speed > 0 && (
                    <line
                      x1={cx}
                      y1={cy}
                      x2={vx}
                      y2={vy}
                      stroke="#38BDF8"
                      strokeWidth={2.4}
                      markerEnd="url(#velArrow)"
                      strokeLinecap="round"
                    />
                  )}

                  {/* AGV Vehicle Chassis Body */}
                  <rect
                    x={cx - 14}
                    y={cy - 8}
                    width={28}
                    height={16}
                    rx={3.5}
                    fill={
                      agv.isCritical 
                        ? '#5E1414' 
                        : agv.isWarning 
                        ? '#5C2D0E' 
                        : speed > 0 
                        ? '#0C3545' 
                        : '#14272E'
                    }
                    stroke={
                      agv.isCritical 
                        ? '#EF4444' 
                        : agv.isWarning 
                        ? '#F59E0B' 
                        : isSelected 
                        ? '#38BDF8' 
                        : '#588897'
                    }
                    strokeWidth={isSelected ? 2.2 : 1.4}
                    transform={`rotate(${-agv.headingRad * (180 / Math.PI)} ${cx} ${cy})`}
                  />

                  {/* LED Beacon Status */}
                  <circle
                    cx={cx + 8}
                    cy={cy - 4}
                    r={2.5}
                    fill={agv.isCritical ? '#EF4444' : speed > 0 ? '#38BDF8' : '#10B981'}
                    className={agv.isCritical ? 'animate-ping' : ''}
                  />

                  {/* Clean Floating ID Tag Above */}
                  <g transform={`translate(${cx}, ${cy - 14})`}>
                    <rect
                      x={-20}
                      y={-6}
                      width={40}
                      height={12}
                      rx={2.5}
                      fill="#060E12"
                      stroke={agv.isCritical ? '#EF4444' : isSelected ? '#38BDF8' : '#2F4F5A'}
                      strokeWidth={0.9}
                    />
                    <text
                      x={0}
                      y={3}
                      fill={agv.isCritical ? '#FCA5A5' : isSelected ? '#BAE6FD' : '#E2E8F0'}
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {agv.vehicleId}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Mini Legend HUD (Bottom Right Corner) */}
        <div className="absolute bottom-3 right-3 bg-[#0C1518]/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl text-[10px] space-y-1.5 pointer-events-none z-10">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-800 pb-1">
            Yard Symbols
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Critical Halo (≥0.55)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Warning Halo (≥0.35)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-emerald-500" />
              <span>BCSS Charger</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-sky-400" />
              <span>Quay Crane Apron</span>
            </span>
          </div>
        </div>

        {/* Selected Vehicle Telemetry HUD Drawer */}
        {selectedVehicleId && (
          <div className="absolute top-3 right-3 bg-[#0C1518]/95 backdrop-blur-md border-2 border-sky-500/80 rounded-xl p-4 shadow-2xl w-68 text-slate-200 space-y-2.5 z-20 animate-fadeIn font-mono">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <div className="flex items-center space-x-1.5 text-white font-bold text-xs">
                <Truck className="w-4 h-4 text-sky-400" />
                <span>{selectedVehicleId}</span>
              </div>
              <button
                onClick={() => onSelectVehicle(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>

            {(() => {
              const v = agvStates.find(a => a.vehicleId === selectedVehicleId);
              if (!v) return <p className="text-slate-400 text-xs">No active telemetry snapshot.</p>;
              return (
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Position:</span>
                    <span className="text-white font-bold">{v.x}m, {v.y}m ({v.nearestNamedFeature})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Speed:</span>
                    <span className="text-white font-bold">{v.speed.toFixed(1)} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Driving State:</span>
                    <span className="text-tuas-cyan font-bold">{v.drivingState}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Battery SoC:</span>
                    <span className="text-emerald-400 font-bold">{v.batteryPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hydraulic Relief:</span>
                    <span className={v.hydraulicPressureBar > 250 ? 'text-red-400 font-bold' : 'text-slate-200'}>
                      {v.hydraulicPressureBar} bar
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">PLC Error:</span>
                    <span className={v.errorRegister !== 'OK' ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                      {v.errorRegister}
                    </span>
                  </div>
                  {v.activeIncidentId && (
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        onClick={() => onSelectCluster(v.activeIncidentId)}
                        className="w-full bg-psa-navy hover:bg-sky-700 text-white py-1.5 rounded-lg text-[11px] font-bold text-center transition-all border border-sky-400/40"
                      >
                        Inspect Cluster {v.activeIncidentId}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
