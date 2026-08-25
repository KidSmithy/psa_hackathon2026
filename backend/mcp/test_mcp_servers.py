"""
Enterprise Security, RBAC & Audit Logging Test Suite for MCP Servers
Aligned with Navis N4 ATT Terminology and Schema Contract 1.1.0
"""

import time
import unittest
from telemetry_server import get_lane_lead_agv, get_agv_telemetry, get_vehicle_telemetry, get_bcss_charger_status
from docket_server import submit_incident_docket
from diagnostics_server import decode_plc_fault_code, get_maintenance_history, get_asset_impact
from security import RBAC_PERMISSIONS, is_role_permitted
from supabase_client import get_supabase_client


class TestEnterpriseSecurityAndRBAC(unittest.TestCase):

    def setUp(self):
        self.client = get_supabase_client()
        self.investigator_ctx = {
            "user_id": "USR-AGENT-01",
            "user_email": "agent.lane@terminal.psa",
            "user_role": "AGENT_INVESTIGATOR",
            "client_ip": "10.0.1.15",
        }
        self.engineer_ctx = {
            "user_id": "USR-ENG-04",
            "user_email": "engineer.ops@terminal.psa",
            "user_role": "LANE_OPERATIONS_ENGINEER",
            "client_ip": "10.0.2.22",
        }
        self.coordinator_ctx = {
            "user_id": "USR-COORD-09",
            "user_email": "coordinator.main@terminal.psa",
            "user_role": "SYSTEM_COORDINATOR",
            "client_ip": "10.0.0.1",
        }
        self.restricted_ctx = {
            "user_id": "USR-VIEW-99",
            "user_email": "viewer.guest@terminal.psa",
            "user_role": "RESTRICTED_VIEWER",
            "client_ip": "192.168.1.100",
        }

    def test_investigator_permitted_and_audit_logged(self):
        # AGENT_INVESTIGATOR querying ATT-142 vehicle telemetry -> SUCCESS
        res = get_vehicle_telemetry(vehicle_id="ATT-142", actor_context=self.investigator_ctx)
        self.assertIsInstance(res, dict)
        self.assertEqual(res["vehicle_id"], "ATT-142")
        self.assertEqual(res["hydraulic_pressure_bar"], 275.0)
        self.assertEqual(res["wi_status"], "PENDING_REJECTION")
        self.assertEqual(res["error_register"], "SPREADER_LOCK_FAULT")

        # Check Supabase mcp_audit_logs
        time.sleep(0.5)
        audit_res = (
            self.client.table("mcp_audit_logs")
            .select("*")
            .eq("user_id", self.investigator_ctx["user_id"])
            .eq("tool_name", "get_vehicle_telemetry")
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        self.assertTrue(len(audit_res.data) > 0)
        log = audit_res.data[0]
        self.assertEqual(log["user_role"], "AGENT_INVESTIGATOR")
        self.assertEqual(log["status"], "SUCCESS")
        self.assertGreater(float(log["execution_time_ms"]), 0.0)
        self.assertEqual(log["parameters"]["vehicle_id"], "ATT-142")

    def test_restricted_viewer_blocked_on_submit_docket(self):
        # RESTRICTED_VIEWER attempting submit_incident_docket -> PERMISSION_DENIED
        sample_incidents = [
            {
                "incident_id": "INC-TEST-01",
                "cluster_name": "Lane 7 Bottleneck",
                "root_cause": "ATT-142 spreader lock fault",
                "evidence": {"vehicle": "ATT-142"},
                "recommended_action": "Clear lane",
            }
        ]
        res = submit_incident_docket(incidents=sample_incidents, actor_context=self.restricted_ctx)
        self.assertIsInstance(res, dict)
        self.assertEqual(res["status"], "UNAUTHORIZED")
        self.assertIn("PERMISSION_DENIED", res["error"])

        # Check Supabase mcp_audit_logs for UNAUTHORIZED record
        time.sleep(0.5)
        audit_res = (
            self.client.table("mcp_audit_logs")
            .select("*")
            .eq("user_id", self.restricted_ctx["user_id"])
            .eq("tool_name", "submit_incident_docket")
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        self.assertTrue(len(audit_res.data) > 0)
        log = audit_res.data[0]
        self.assertEqual(log["user_role"], "RESTRICTED_VIEWER")
        self.assertEqual(log["status"], "UNAUTHORIZED")

    def test_restricted_viewer_allowed_tools(self):
        # RESTRICTED_VIEWER can read lane lead vehicle and charger status
        res_lane = get_lane_lead_agv(lane_id="LANE-7", actor_context=self.restricted_ctx)
        self.assertEqual(res_lane["status"], "BLOCKED")
        self.assertEqual(res_lane["lead_vehicle_id"], "ATT-142")

        res_bcss = get_bcss_charger_status(station_id="BCSS-02", actor_context=self.restricted_ctx)
        self.assertEqual(res_bcss["breaker_state"], "TRIPPED")

    def test_investigator_blocked_on_maintenance_history(self):
        # AGENT_INVESTIGATOR cannot access maintenance history
        res = get_maintenance_history(asset_id="ATT-142", actor_context=self.investigator_ctx)
        self.assertEqual(res["status"], "UNAUTHORIZED")
        self.assertIn("PERMISSION_DENIED", res["error"])

    def test_engineer_allowed_maintenance_history_blocked_docket(self):
        # LANE_OPERATIONS_ENGINEER can view maintenance history for ATT-142
        res_maint = get_maintenance_history(asset_id="ATT-142", actor_context=self.engineer_ctx)
        self.assertEqual(res_maint["status"], "SUCCESS")
        self.assertTrue(res_maint["count"] > 0)

        # But cannot submit docket
        res_docket = submit_incident_docket(incidents=[{"incident_id": "1"}], actor_context=self.engineer_ctx)
        self.assertEqual(res_docket["status"], "UNAUTHORIZED")

    def test_coordinator_allowed_submit_docket(self):
        # SYSTEM_COORDINATOR can submit docket
        sample_incidents = [
            {
                "incident_id": "INC-2026-0824-0007",
                "cluster_name": "Lane 7 Spreader Lock Fault & Bottleneck",
                "root_cause": "Twistlock timeout on lead vehicle ATT-142",
                "evidence": {"pressure": 275.0, "vehicle_id": "ATT-142"},
                "recommended_action": "Dispatch mechanical crew for manual release",
            }
        ]
        res = submit_incident_docket(incidents=sample_incidents, actor_context=self.coordinator_ctx)
        self.assertEqual(res["status"], "CREATED")
        self.assertIn("docket_id", res)


if __name__ == "__main__":
    unittest.main()
