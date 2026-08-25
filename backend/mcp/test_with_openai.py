"""
End-to-End Test for Port Terminal MCP Servers using OpenAI Function Calling

Demonstrates an automated root cause analysis workflow where OpenAI LLM acts as an
Investigator Agent, discovering MCP tools, invoking them over MCP / FastMCP, querying live
Supabase telemetry & diagnostics, and generating a consolidated Incident Review Docket.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv
from openai import OpenAI

# Force UTF-8 output encoding for Windows consoles
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Load backend environment variables
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Import MCP server instances
from telemetry_server import mcp as telemetry_mcp
from diagnostics_server import mcp as diagnostics_mcp
from docket_server import mcp as docket_mcp


def fastmcp_tool_to_openai_schema(tool) -> Dict[str, Any]:
    """Converts a FastMCP tool definition into an OpenAI function calling tool schema."""
    parameters = tool.parameters if hasattr(tool, "parameters") and tool.parameters else {
        "type": "object",
        "properties": {},
    }
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description or "",
            "parameters": parameters,
        },
    }


class MCPRegistry:
    """Manages routing tool invocations across multiple FastMCP servers."""

    def __init__(self):
        self.servers = {
            "telemetry": telemetry_mcp,
            "diagnostics": diagnostics_mcp,
            "docket": docket_mcp,
        }
        self.tool_to_server: Dict[str, Any] = {}
        self.openai_tools: List[Dict[str, Any]] = []

    async def initialize(self):
        self.openai_tools = []
        self.tool_to_server = {}
        for server_name, server in self.servers.items():
            tools = await server.list_tools()
            for t in tools:
                self.tool_to_server[t.name] = server
                self.openai_tools.append(fastmcp_tool_to_openai_schema(t))
        print(f"[OK] Loaded {len(self.openai_tools)} MCP tools across servers: {list(self.tool_to_server.keys())}")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        if tool_name not in self.tool_to_server:
            return json.dumps({"error": f"Tool '{tool_name}' not found in registry", "status": "ERROR"})
        
        # Inject actor_context if not explicitly provided by the LLM
        if "actor_context" not in arguments and "auth_context" not in arguments:
            arguments["actor_context"] = {
                "user_id": "OPENAI-AGENT-01",
                "user_email": "openai.agent@terminal.psa",
                "user_role": "SYSTEM_COORDINATOR",
                "client_ip": "127.0.0.1",
            }

        server = self.tool_to_server[tool_name]
        result = await server.call_tool(tool_name, arguments)
        # Extract serialized text from FastMCP ToolResult
        if hasattr(result, "content") and result.content:
            for item in result.content:
                if hasattr(item, "text"):
                    return item.text
        return json.dumps(result if isinstance(result, (dict, list)) else {"result": str(result)})


async def run_openai_investigation():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY is not set in backend/.env")
        return

    client = OpenAI(api_key=api_key)
    registry = MCPRegistry()
    await registry.initialize()

    print("\n" + "="*80)
    print("STARTING AGENTIC INVESTIGATION VIA OPENAI + MCP SERVERS")
    print("="*80 + "\n")

    user_prompt = """
An incident alert has been triggered for:
1. Transfer Lane 7 Bottleneck & Spreader Jam (Incident INC-2026-0824-0007 / LANE-7)
2. Charger BCSS-02 Trip (Incident INC-2026-0824-0008 / Station_BCSS_02)

Please investigate both incidents by querying the appropriate MCP telemetry and diagnostic tools:
- Check lane queues, lead vehicles (ATT-142), and actuator telemetry for LANE-7.
- Check BCSS-02 charger status, busbar temperatures, and breaker states.
- Decode any PLC fault codes identified during the sensor inspection (e.g. SPREADER_LOCK_FAULT, BCSS_CHARGER_TRIP).
- Check maintenance history for the affected assets (ATT-142, BCSS-02).
- Assess downstream topological impact on quay cranes / yard infrastructure.
- Finally, submit the completed incident findings using submit_incident_docket.

Summarize your findings clearly for the terminal operator.
"""

    messages = [
        {
            "role": "system",
            "content": (
                "You are an automated root cause investigation agent for a PSA automated container terminal. "
                "You have access to live MCP tools for telemetry, PLC diagnostics, topology impact, and docket publishing. "
                "Always call the tools to retrieve actual data from the terminal SCADA and Supabase database. "
                "Base all your conclusions strictly on the tool outputs."
            ),
        },
        {"role": "user", "content": user_prompt},
    ]

    # Iterative agent tool-calling loop (Max 10 turns)
    for turn in range(1, 11):
        print(f"\n--- Investigator Agent Turn {turn} ---")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=registry.openai_tools,
            tool_choice="auto",
        )

        response_message = response.choices[0].message
        messages.append(response_message)

        # Check if the model requested any tool calls
        if response_message.tool_calls:
            print(f"[Agent] LLM requested {len(response_message.tool_calls)} tool call(s):")
            for tool_call in response_message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                
                print(f"   -> Calling MCP Tool: {fn_name}({fn_args})")
                tool_output_str = await registry.call_tool(fn_name, fn_args)
                print(f"      Output: {tool_output_str[:160]}{'...' if len(tool_output_str) > 160 else ''}")

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": fn_name,
                    "content": tool_output_str,
                })
        else:
            # Model has completed the reasoning and provided final response
            print("\n" + "="*80)
            print("FINAL AGENT DIAGNOSTIC REPORT (OPENAI RESPONSE):")
            print("="*80)
            print(response_message.content)
            print("="*80)
            print("Investigation completed successfully!")
            break


if __name__ == "__main__":
    asyncio.run(run_openai_investigation())
