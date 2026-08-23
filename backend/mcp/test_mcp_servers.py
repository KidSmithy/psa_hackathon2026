"""
Verification script for Port Terminal Incident Investigation MCP Servers (No Fallbacks)
"""

import unittest
from telemetry_server import get_lane_lead_agv, get_agv_telemetry, get_bcss_charger_status
from docket_server import submit_incident_docket, DOCKET_STORE
from diagnostics_server import decode_plc_fault_code, get_maintenance_history, get_asset_impact
from mock_data import MOCK_STAGE1_CLUSTERS, get_stage1_clusters
from supabase_client import get_supabase_client


class TestTerminalTelemetryMCP(unittest.TestCase):

    def test_get_lane_lead_agv_found(self):
        result = get_lane_lead_agv("Lane_7")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["lane_id"], "Lane_7")
        self.assertEqual(result["lead_agv_id"], "AGV-104")
        self.assertEqual(result["blocked_vehicles"], ["AGV-104", "AGV-109", "AGV-112"])
        self.assertEqual(result["status"], "BLOCKED")

    def test_get_lane_lead_agv_flowing(self):
        result = get_lane_lead_agv("Lane_8")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["status"], "FLOWING")

    def test_get_lane_lead_agv_not_found(self):
        result = get_lane_lead_agv("Lane_NONEXISTENT_999")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["status"], "NOT_FOUND")
        self.assertIn("error", result)
        self.assertIn("not found in database", result["error"])

    def test_get_agv_telemetry_found(self):
        result = get_agv_telemetry("AGV-104")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["agv_id"], "AGV-104")
        self.assertEqual(result["speed_mps"], 0.0)
        self.assertEqual(result["twistlock_sensor"], "ENGAGED")
        self.assertEqual(result["twistlock_command"], "RELEASE")
        self.assertEqual(result["hydraulic_pressure_bar"], 275.0)
        self.assertEqual(result["error_register"], "ERR_TWISTLOCK_TIMEOUT")

    def test_get_agv_telemetry_not_found(self):
        result = get_agv_telemetry("AGV-NONEXISTENT")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["status"], "NOT_FOUND")
        self.assertIn("error", result)
        self.assertIn("not found in database", result["error"])

    def test_get_bcss_charger_status_found(self):
        result = get_bcss_charger_status("BCSS-02")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["station_id"], "BCSS-02")
        self.assertEqual(result["breaker_state"], "TRIPPED")
        self.assertEqual(result["bus_temperature_c"], 82.4)
        self.assertEqual(result["voltage_v"], 0.0)
        self.assertEqual(result["trip_reason"], "OVERTEMP_THERMAL_CUTOFF")

    def test_get_bcss_charger_status_not_found(self):
        result = get_bcss_charger_status("BCSS-UNKNOWN")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["status"], "NOT_FOUND")
        self.assertIn("error", result)
        self.assertIn("not found in database", result["error"])


class TestDocketServiceMCP(unittest.TestCase):

    def test_submit_incident_docket_success(self):
        sample_incidents = [
            {
                "incident_id": "INC-001",
                "cluster_name": "Lane 7 Bottleneck",
                "root_cause": "AGV-104 twistlock disengagement physical timeout under high hydraulic relief pressure (275 bar)",
                "evidence": {
                    "lead_agv": "AGV-104",
                    "twistlock_sensor": "ENGAGED",
                    "twistlock_command": "RELEASE",
                    "hydraulic_pressure_bar": 275.0,
                    "error_register": "ERR_TWISTLOCK_TIMEOUT"
                },
                "recommended_action": "Dispatch emergency field tech to inspect AGV-104 twistlock corner casting mechanical binding."
            }
        ]

        response = submit_incident_docket(sample_incidents)
        self.assertIsInstance(response, dict)
        self.assertIn("docket_id", response)
        self.assertEqual(response["status"], "CREATED")
        self.assertIn("timestamp", response)

    def test_submit_incident_docket_validation_failure(self):
        # Empty list
        response = submit_incident_docket([])
        self.assertEqual(response["status"], "VALIDATION_FAILED")
        self.assertIn("error", response)

        # Missing required field
        invalid_incidents = [{"incident_id": "INC-001"}]
        response_invalid = submit_incident_docket(invalid_incidents)
        self.assertEqual(response_invalid["status"], "VALIDATION_FAILED")
        self.assertIn("missing required fields", response_invalid["error"])


class TestDiagnosticsServiceMCP(unittest.TestCase):

    def test_decode_plc_fault_found(self):
        res = decode_plc_fault_code("ERR_TWISTLOCK_TIMEOUT")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["fault_code"], "ERR_TWISTLOCK_TIMEOUT")
        self.assertIn("twistlock", res["description"].lower())

    def test_decode_plc_fault_not_found(self):
        res = decode_plc_fault_code("ERR_NONEXISTENT_CODE")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["status"], "NOT_FOUND")
        self.assertIn("not found in database", res["error"])

    def test_get_maintenance_history_found(self):
        res = get_maintenance_history("AGV-104")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["count"] > 0)
        self.assertEqual(res["records"][0]["asset_id"], "AGV-104")

    def test_get_maintenance_history_not_found(self):
        res = get_maintenance_history("AGV-NONEXISTENT")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["status"], "NOT_FOUND")
        self.assertEqual(res["count"], 0)

    def test_get_asset_impact_found(self):
        res = get_asset_impact("Lane_7")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["asset_id"], "Lane_7")
        self.assertIn("downstream_impact", res)

    def test_get_asset_impact_not_found(self):
        res = get_asset_impact("UNKNOWN_ASSET_XYZ")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["status"], "NOT_FOUND")
        self.assertIn("error", res)


class TestStage1Filter(unittest.TestCase):

    def test_stage1_clusters(self):
        raw_alerts = [f"ALT-{i:03d}" for i in range(1, 16)]
        clusters = get_stage1_clusters(raw_alerts)
        
        self.assertIn("Cluster_A", clusters)
        self.assertIn("Cluster_B", clusters)
        self.assertEqual(len(clusters["Cluster_A"]["matched_alerts"]), 9)
        self.assertEqual(len(clusters["Cluster_B"]["matched_alerts"]), 6)


if __name__ == "__main__":
    unittest.main()
