import { RawAlert, IncidentClusterRow } from '../types';

export const FALLBACK_RAW_ALERTS: RawAlert[] = [
  {
    id: 'ALRT-1094',
    timestamp: '2026-08-24 00:00:08+00',
    source: 'ATT-142',
    type: 'HYDRAULIC_HIGH_PRESSURE',
    location: 'LANE-7',
    severity: 'HIGH',
    message: 'Actuator hydraulic relief pressure spiked to 275.0 bar.'
  },
  {
    id: 'ALRT-2015',
    timestamp: '2026-08-24 00:00:06+00',
    source: 'BCSS-02',
    type: 'COOLING_LOOP_FAIL',
    location: 'Station_BCSS_02',
    severity: 'HIGH',
    message: 'Coolant circulation differential pressure drop reported.'
  },
  {
    id: 'ALRT-1092',
    timestamp: '2026-08-24 00:00:05+00',
    source: 'LANE-7_DETECTOR',
    type: 'TRAFFIC_CONGESTION',
    location: 'LANE-7',
    severity: 'HIGH',
    message: 'Transfer lane 7 blocked at junction JUNCTION-L7-A, zero headway recorded.'
  },
  {
    id: 'ALRT-2014',
    timestamp: '2026-08-24 00:00:04+00',
    source: 'BCSS-02',
    type: 'OVERTEMP_WARNING',
    location: 'Station_BCSS_02',
    severity: 'HIGH',
    message: 'DC busbar thermal sensor exceeded safety cutoff threshold (82.4°C).'
  },
  {
    id: 'ALRT-2011',
    timestamp: '2026-08-24 00:00:02+00',
    source: 'BCSS-02',
    type: 'BREAKER_TRIPPED',
    location: 'Station_BCSS_02',
    severity: 'CRITICAL',
    message: 'High-voltage charging circuit breaker protective trip executed.'
  },
  {
    id: 'ALRT-1091',
    timestamp: '2026-08-24 00:00:01+00',
    source: 'ATT-142',
    type: 'SPREADER_LOCK_FAULT',
    location: 'LANE-7',
    severity: 'CRITICAL',
    message: 'Twist-lock / spreader pin release timeout on container corner casting.'
  },
  {
    id: 'ALT-022',
    timestamp: '2026-08-23 19:02:30+00',
    source: 'AGV-055',
    type: 'OPTICAL_OCCLUSION',
    location: 'Lane_4',
    severity: 'LOW',
    message: 'LiDAR sensor window optical transmittance degraded (dust/smudge)'
  },
  {
    id: 'ALT-021',
    timestamp: '2026-08-23 19:02:12+00',
    source: 'LANE_4_MONITOR',
    type: 'UNEXPECTED_STOP',
    location: 'Lane_4',
    severity: 'MEDIUM',
    message: 'Vehicle AGV-055 stopped outside designated transfer slot'
  },
  {
    id: 'ALT-020',
    timestamp: '2026-08-23 19:02:10+00',
    source: 'AGV-055',
    type: 'LIDAR_SAFETY_TRIP',
    location: 'Lane_4',
    severity: 'HIGH',
    message: 'Front safety LiDAR triggered emergency stop at 0.8m'
  },
  {
    id: 'ALT-019',
    timestamp: '2026-08-23 19:01:45+00',
    source: 'DISPATCH_OPTIMIZER',
    type: 'DEADLOCK_RISK',
    location: 'Sector_A',
    severity: 'HIGH',
    message: '3 AGVs entering critical battery threshold in next 15 mins'
  },
  {
    id: 'ALT-018',
    timestamp: '2026-08-23 19:01:20+00',
    source: 'AGV-072',
    type: 'BATTERY_WARNING',
    location: 'Sector_A',
    severity: 'MEDIUM',
    message: 'Battery SoC below 22%, queued for charging'
  },
  {
    id: 'ALT-017',
    timestamp: '2026-08-23 19:01:05+00',
    source: 'FLEET_MANAGER',
    type: 'REROUTE_FAIL',
    location: 'Sector_A',
    severity: 'HIGH',
    message: 'Unable to assign alternative charger: BCSS-01 at 100% capacity'
  },
  {
    id: 'ALT-016',
    timestamp: '2026-08-23 19:01:00+00',
    source: 'AGV-088',
    type: 'BATTERY_LOW_CRITICAL',
    location: 'Station_BCSS_02',
    severity: 'CRITICAL',
    message: 'Battery SoC dropped below 15% (current: 11.8%)'
  },
  {
    id: 'ALT-025',
    timestamp: '2026-08-23 19:00:45+00',
    source: 'BCSS-01',
    type: 'SESSION_COMPLETED',
    location: 'Station_BCSS_01',
    severity: 'INFO',
    message: 'AGV-201 charge cycle finished (94% SoC)'
  },
  {
    id: 'ALT-024',
    timestamp: '2026-08-23 19:00:30+00',
    source: 'QC-01',
    type: 'REEFER_TEMP_NORMAL',
    location: 'Berth_01',
    severity: 'INFO',
    message: 'Container monitoring report nominal for Reefer Block 2'
  },
  {
    id: 'ALT-015',
    timestamp: '2026-08-23 19:00:16+00',
    source: 'FLEET_ROUTER',
    type: 'CHARGER_UNAVAILABLE',
    location: 'Station_BCSS_02',
    severity: 'MEDIUM',
    message: 'BCSS-02 taken out of automated routing pool'
  },
  {
    id: 'ALT-008',
    timestamp: '2026-08-23 19:00:15+00',
    source: 'LANE_7_ZONE_MONITOR',
    type: 'THROUGHPUT_DROP',
    location: 'Lane_7',
    severity: 'MEDIUM',
    message: 'Lane throughput reduced to 0 TEU/h'
  },
  {
    id: 'ALT-014',
    timestamp: '2026-08-23 19:00:13+00',
    source: 'BCSS-02',
    type: 'COOLING_LOOP_FAIL',
    location: 'Station_BCSS_02',
    severity: 'HIGH',
    message: 'Coolant flow sensor reported low delta-P'
  },
  {
    id: 'ALT-007',
    timestamp: '2026-08-23 19:00:12+00',
    source: 'AGV-104',
    type: 'HYDRAULIC_HIGH_PRESSURE',
    location: 'Lane_7',
    severity: 'HIGH',
    message: 'Pressure reached 275 bar limit'
  },
  {
    id: 'ALT-013',
    timestamp: '2026-08-23 19:00:11+00',
    source: 'BCSS_POWER_GRID',
    type: 'BUS_FAULT',
    location: 'Station_BCSS_02',
    severity: 'HIGH',
    message: 'Secondary sub-station load shedding triggered'
  },
  {
    id: 'ALT-006',
    timestamp: '2026-08-23 19:00:10+00',
    source: 'QC-03_DISPATCH',
    type: 'FEEDER_STARVATION',
    location: 'Lane_7',
    severity: 'HIGH',
    message: 'Quay crane QC-03 waiting for AGV-104 payload'
  },
  {
    id: 'ALT-012',
    timestamp: '2026-08-23 19:00:09+00',
    source: 'BCSS-02',
    type: 'CHARGING_SESSION_ABORTED',
    location: 'Station_BCSS_02',
    severity: 'MEDIUM',
    message: 'Session interrupted for target vehicle AGV-088'
  },
  {
    id: 'ALT-005',
    timestamp: '2026-08-23 19:00:08+00',
    source: 'LANE_7_FLOW_CTRL',
    type: 'HEADWAY_VIOLATION',
    location: 'Lane_7',
    severity: 'HIGH',
    message: 'Zero vehicle clearance detected in Lane 7'
  },
  {
    id: 'ALT-004',
    timestamp: '2026-08-23 19:00:07+00',
    source: 'AGV-112',
    type: 'OBSTACLE_PROXIMITY',
    location: 'Lane_7',
    severity: 'MEDIUM',
    message: 'Obstacle detected within 1.5m safety zone'
  },
  {
    id: 'ALT-011',
    timestamp: '2026-08-23 19:00:06+00',
    source: 'BCSS-02',
    type: 'VOLTAGE_DROP',
    location: 'Station_BCSS_02',
    severity: 'HIGH',
    message: 'Charging bus voltage dropped to 0V'
  },
  {
    id: 'ALT-003',
    timestamp: '2026-08-23 19:00:05+00',
    source: 'AGV-109',
    type: 'OBSTACLE_PROXIMITY',
    location: 'Lane_7',
    severity: 'MEDIUM',
    message: 'Obstacle detected within 1.5m safety zone'
  },
  {
    id: 'ALT-010',
    timestamp: '2026-08-23 19:00:04+00',
    source: 'BCSS-02',
    type: 'OVERTEMP_WARNING',
    location: 'Station_BCSS_02',
    severity: 'HIGH',
    message: 'Busbar temperature exceeded 80.0C threshold'
  },
  {
    id: 'ALT-002',
    timestamp: '2026-08-23 19:00:03+00',
    source: 'AGV-104',
    type: 'TWISTLOCK_TIMEOUT',
    location: 'Lane_7',
    severity: 'CRITICAL',
    message: 'Twistlock release actuator timed out'
  },
  {
    id: 'ALT-009',
    timestamp: '2026-08-23 19:00:02+00',
    source: 'BCSS-02',
    type: 'BREAKER_TRIPPED',
    location: 'Station_BCSS_02',
    severity: 'CRITICAL',
    message: 'Main charging circuit breaker tripped'
  },
  {
    id: 'ALT-001',
    timestamp: '2026-08-23 19:00:01+00',
    source: 'LANE_7_ENTRY_DETECTOR',
    type: 'TRAFFIC_CONGESTION',
    location: 'Lane_7',
    severity: 'HIGH',
    message: 'Traffic stopped for > 90s'
  },
  {
    id: 'ALT-023',
    timestamp: '2026-08-23 19:00:00+00',
    source: 'WEATHER_STATION_01',
    type: 'WIND_GUST_ADVISORY',
    location: 'Terminal_Wide',
    severity: 'INFO',
    message: 'Wind speed 14 m/s (below 20 m/s crane cutoff)'
  }
];

export const FALLBACK_INCIDENT_CLUSTERS: IncidentClusterRow[] = [
  {
    cluster_id: 'CLUSTER-A',
    name: 'Lane 7 Bottleneck & Twistlock Jam',
    primary_location: 'Lane_7',
    assigned_agent: 'Agent_1_LaneInvestigator',
    raw_alert_ids: ['ALT-001', 'ALT-002', 'ALT-003', 'ALT-004', 'ALT-005', 'ALT-006', 'ALT-007', 'ALT-008']
  },
  {
    cluster_id: 'CLUSTER-B',
    name: 'BCSS-02 Charger High-Voltage Trip',
    primary_location: 'Station_BCSS_02',
    assigned_agent: 'Agent_2_BCSSInvestigator',
    raw_alert_ids: ['ALT-009', 'ALT-010', 'ALT-011', 'ALT-012', 'ALT-013', 'ALT-014', 'ALT-015']
  },
  {
    cluster_id: 'CLUSTER-C',
    name: 'Sector A Battery Starvation Risk',
    primary_location: 'Sector_A',
    assigned_agent: 'Agent_3_FleetPowerInvestigator',
    raw_alert_ids: ['ALT-016', 'ALT-017', 'ALT-018', 'ALT-019']
  },
  {
    cluster_id: 'CLUSTER-D',
    name: 'Lane 4 Safety Stop (LiDAR Degraded)',
    primary_location: 'Lane_4',
    assigned_agent: 'Agent_1_LaneInvestigator',
    raw_alert_ids: ['ALT-020', 'ALT-021', 'ALT-022']
  },
  {
    cluster_id: 'INC-2026-0824-0007',
    name: 'Lane 7 Spreader Lock Fault & Bottleneck',
    primary_location: 'LANE-7',
    assigned_agent: 'Agent_1_LaneInvestigator',
    raw_alert_ids: ['ALRT-1091', 'ALRT-1092', 'ALRT-1094']
  },
  {
    cluster_id: 'INC-2026-0824-0008',
    name: 'BCSS-02 Fast-Charger Thermal Breaker Trip',
    primary_location: 'Station_BCSS_02',
    assigned_agent: 'Agent_2_BCSSInvestigator',
    raw_alert_ids: ['ALRT-2011', 'ALRT-2014', 'ALRT-2015']
  }
];
