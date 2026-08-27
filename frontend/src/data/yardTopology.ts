/**
 * Yard Model & Topology Engine for PSA Tuas Smart Port Terminal
 *
 * Coordinates are yard-grid units (metres). Extent is x: 0..850, y: 0..480.
 * Grid counts north-up; for SVG/Canvas rendering, y is inverted: FY(y) = yMax - y.
 */

import { YardGraph, YardNode, YardEdge } from '../types';

export const YARD_EXTENT = {
  xMax: 850,
  yMax: 480,
};

export const YARD_NODES: YardNode[] = [
  // --- QUAY CRANE BERTH LINE (NORTH APPRON: Y = 400m) ---
  {
    id: 'QC-03-HANDOFF',
    type: 'crane_handoff',
    x: 150.0,
    y: 400.0,
    label: 'QC-03 (Berth 01)',
    zoneId: 'QUAY-03',
  },
  {
    id: 'QC-04-HANDOFF',
    type: 'crane_handoff',
    x: 350.0,
    y: 400.0,
    label: 'QC-04 (Berth 02)',
    zoneId: 'QUAY-04',
  },
  {
    id: 'QC-05-HANDOFF',
    type: 'crane_handoff',
    x: 550.0,
    y: 400.0,
    label: 'QC-05 (Berth 03)',
    zoneId: 'QUAY-05',
  },

  // --- FEEDER & TRANSFER LANES (CENTRAL / WEST) ---
  {
    id: 'LANE-3',
    type: 'lane',
    x: 350.0,
    y: 270.0,
    label: 'Lane 3 Feeder',
    zoneId: 'LANE-3',
  },
  {
    id: 'LANE-4',
    type: 'lane',
    x: 220.0,
    y: 180.0,
    label: 'Lane 4 Transfer',
    zoneId: 'LANE-4',
  },

  // --- BCSS CHARGING & STAGING (SOUTH SECTOR: Y = 80m) ---
  {
    id: 'CHARGER-B1',
    type: 'charger',
    x: 150.0,
    y: 80.0,
    label: 'BCSS-01 Station',
    zoneId: 'YARD-B1',
  },
  {
    id: 'CHARGER-B3',
    type: 'charger',
    x: 300.0,
    y: 80.0,
    label: 'BCSS-02 Station',
    zoneId: 'YARD-B3',
  },
  {
    id: 'SECTOR-A',
    type: 'sector',
    x: 480.0,
    y: 80.0,
    label: 'Sector A Staging',
    zoneId: 'SECTOR-A',
  },

  // --- MAINLINE CORRIDORS & JUNCTIONS (EAST SECTOR) ---
  {
    id: 'JUNCTION-L7-A',
    type: 'junction',
    x: 560.0,
    y: 200.0,
    label: 'Junction L7-A',
    zoneId: 'LANE-7',
  },
  {
    id: 'LANE-7',
    type: 'lane',
    x: 660.0,
    y: 200.0,
    label: 'Lane 7 Mainline',
    zoneId: 'LANE-7',
  },
  {
    id: 'JUNCTION-L7-B',
    type: 'junction',
    x: 760.0,
    y: 200.0,
    label: 'Junction L7-B',
    zoneId: 'LANE-7',
  },
  {
    id: 'LANE-8',
    type: 'lane',
    x: 660.0,
    y: 290.0,
    label: 'Lane 8 Buffer',
    zoneId: 'LANE-8',
  },
  {
    id: 'LANE-12',
    type: 'lane',
    x: 660.0,
    y: 380.0,
    label: 'Lane 12 Outbound',
    zoneId: 'LANE-12',
  },
];

export const YARD_EDGES: YardEdge[] = [
  // Quay Apron Track (East-West across North)
  { from: 'QC-03-HANDOFF', to: 'QC-04-HANDOFF' },
  { from: 'QC-04-HANDOFF', to: 'QC-05-HANDOFF' },
  
  // Feeder connections
  { from: 'QC-04-HANDOFF', to: 'LANE-3' },
  { from: 'LANE-3', to: 'JUNCTION-L7-A' },
  { from: 'LANE-3', to: 'LANE-4' },
  { from: 'LANE-3', to: 'CHARGER-B3' },
  
  // Charger network & South Sector
  { from: 'CHARGER-B1', to: 'CHARGER-B3' },
  { from: 'CHARGER-B3', to: 'SECTOR-A' },
  { from: 'LANE-4', to: 'CHARGER-B1' },

  // Lane 7 Corridor
  { from: 'JUNCTION-L7-A', to: 'LANE-7' },
  { from: 'LANE-7', to: 'JUNCTION-L7-B' },

  // Lane 8 & 12 Parallel Buffers
  { from: 'JUNCTION-L7-A', to: 'LANE-8' },
  { from: 'LANE-8', to: 'JUNCTION-L7-B' },
  { from: 'LANE-8', to: 'LANE-12' },
  { from: 'QC-05-HANDOFF', to: 'LANE-12' },
];

export const YARD_GRAPH: YardGraph = {
  nodes: YARD_NODES,
  edges: YARD_EDGES,
  extent: YARD_EXTENT,
};

/**
 * Coordinate mapping dictionary for incident centroids and sectors
 */
export const LOCATION_COORDINATES: Record<string, { x: number; y: number; label: string }> = {
  'Lane_7': { x: 640.0, y: 200.0, label: 'Lane 7 Mainline' },
  'LANE-7': { x: 640.0, y: 200.0, label: 'Lane 7 Mainline' },
  'LANE_7': { x: 640.0, y: 200.0, label: 'Lane 7 Mainline' },
  'JUNCTION-L7-A': { x: 560.0, y: 200.0, label: 'Junction L7-A' },
  'JUNCTION-L7-B': { x: 760.0, y: 200.0, label: 'Junction L7-B' },
  
  'Station_BCSS_02': { x: 300.0, y: 80.0, label: 'BCSS-02 Station' },
  'BCSS-02': { x: 300.0, y: 80.0, label: 'BCSS-02 Station' },
  'CHARGER-B3': { x: 300.0, y: 80.0, label: 'BCSS-02 Station' },
  
  'Station_BCSS_01': { x: 150.0, y: 80.0, label: 'BCSS-01 Station' },
  'BCSS-01': { x: 150.0, y: 80.0, label: 'BCSS-01 Station' },
  'CHARGER-B1': { x: 150.0, y: 80.0, label: 'BCSS-01 Station' },
  
  'Sector_A': { x: 480.0, y: 80.0, label: 'Sector A Staging' },
  'SECTOR-A': { x: 480.0, y: 80.0, label: 'Sector A Staging' },
  
  'Lane_4': { x: 220.0, y: 180.0, label: 'Lane 4 Transfer' },
  'LANE-4': { x: 220.0, y: 180.0, label: 'Lane 4 Transfer' },
  
  'Lane_3': { x: 350.0, y: 270.0, label: 'Lane 3 Feeder' },
  'LANE-3': { x: 350.0, y: 270.0, label: 'Lane 3 Feeder' },
  
  'Lane_8': { x: 660.0, y: 290.0, label: 'Lane 8 Buffer' },
  'LANE-8': { x: 660.0, y: 290.0, label: 'Lane 8 Buffer' },
  
  'Lane_12': { x: 660.0, y: 380.0, label: 'Lane 12 Outbound' },
  'LANE-12': { x: 660.0, y: 380.0, label: 'Lane 12 Outbound' },
  
  'Berth_01': { x: 150.0, y: 400.0, label: 'Berth 01 / QC-03' },
  'QC-03': { x: 150.0, y: 400.0, label: 'QC-03 Handoff' },
  'QC-04': { x: 350.0, y: 400.0, label: 'QC-04 Handoff' },
  'QC-05': { x: 550.0, y: 400.0, label: 'QC-05 Handoff' },
  'QC-04-HANDOFF': { x: 350.0, y: 400.0, label: 'QC-04 Handoff' },
  'QC-05-HANDOFF': { x: 550.0, y: 400.0, label: 'QC-05 Handoff' },
  'Terminal_Wide': { x: 425.0, y: 240.0, label: 'Terminal Weather Sensor' },
};

/**
 * Spaced operational slots for AGVs to avoid visual stacking
 */
export const VEHICLE_INITIAL_SLOTS: Record<string, { x: number; y: number; heading: number; nearest: string }> = {
  // Lane 7 Queue Train (Spaced 50m-60m apart along East Mainline: 560, 620, 680, 760)
  'ATT-142': { x: 560.0, y: 200.0, heading: 0, nearest: 'Junction L7-A' },
  'AGV-104': { x: 560.0, y: 200.0, heading: 0, nearest: 'Junction L7-A' },
  'ATT-089': { x: 620.0, y: 200.0, heading: 0, nearest: 'Lane 7 Mainline' },
  'AGV-109': { x: 620.0, y: 200.0, heading: 0, nearest: 'Lane 7 Mainline' },
  'ATT-112': { x: 680.0, y: 200.0, heading: 0, nearest: 'Lane 7 Mainline' },
  'AGV-112': { x: 680.0, y: 200.0, heading: 0, nearest: 'Lane 7 Mainline' },
  'ATT-733': { x: 760.0, y: 200.0, heading: 0, nearest: 'Junction L7-B' },

  // BCSS-02 Charger Bay (South)
  'AGV-088': { x: 300.0, y: 80.0, heading: Math.PI / 2, nearest: 'BCSS-02 Station' },

  // Sector A Staging
  'AGV-072': { x: 480.0, y: 80.0, heading: -Math.PI / 4, nearest: 'Sector A Staging' },

  // Lane 4 Queue (West)
  'ATT-055': { x: 220.0, y: 180.0, heading: 0, nearest: 'Lane 4 Transfer' },
  'AGV-055': { x: 220.0, y: 180.0, heading: 0, nearest: 'Lane 4 Transfer' },
  'AGV-061': { x: 140.0, y: 180.0, heading: 0, nearest: 'Lane 4 Transfer' },

  // Moving Traffic along Lane 8 & Lane 12
  'ATT-201': { x: 660.0, y: 290.0, heading: 0, nearest: 'Lane 8 Buffer' },
  'AGV-201': { x: 660.0, y: 290.0, heading: 0, nearest: 'Lane 8 Buffer' },
  'AGV-303': { x: 660.0, y: 380.0, heading: 0, nearest: 'Lane 12 Outbound' },
};

/**
 * Resolve location string or asset ID to yard coordinates
 */
export function resolveYardCoordinates(
  locationOrSource: string,
  vehicleId?: string,
  offsetIndex: number = 0
): { x: number; y: number; label: string } {
  if (locationOrSource && LOCATION_COORDINATES[locationOrSource]) {
    const base = LOCATION_COORDINATES[locationOrSource];
    return {
      x: base.x,
      y: base.y,
      label: base.label,
    };
  }

  if (vehicleId && VEHICLE_INITIAL_SLOTS[vehicleId]) {
    const slot = VEHICLE_INITIAL_SLOTS[vehicleId];
    return {
      x: slot.x,
      y: slot.y,
      label: slot.nearest,
    };
  }

  if (locationOrSource && VEHICLE_INITIAL_SLOTS[locationOrSource]) {
    const slot = VEHICLE_INITIAL_SLOTS[locationOrSource];
    return {
      x: slot.x,
      y: slot.y,
      label: slot.nearest,
    };
  }

  return {
    x: 425.0,
    y: 240.0,
    label: locationOrSource || 'Terminal Yard',
  };
}
