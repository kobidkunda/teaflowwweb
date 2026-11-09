import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guard } from "@/lib/adminHttp";
import {
  TOOL_DEFINITIONS,
  RESOURCE_DEFINITIONS,
  RESOURCE_TEMPLATE_DEFINITIONS,
  PROMPT_DEFINITIONS,
  MCP_CAPABILITIES,
} from "@/lib/mcp";

export const runtime = "nodejs";

const MCP_PROTOCOL_VERSION = "2025-03-26";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const db = getDb();
    db.prepare("SELECT 1").get();

    return NextResponse.json({
      status: "ok",
      database: "sqlite",
      mcp_protocol_version: MCP_PROTOCOL_VERSION,
      uptime_seconds: Math.floor(process.uptime()),
      tools_count: TOOL_DEFINITIONS.length,
      resources_count: RESOURCE_DEFINITIONS.length,
      resource_templates_count: RESOURCE_TEMPLATE_DEFINITIONS.length,
      prompts_count: PROMPT_DEFINITIONS.length,
      capabilities: MCP_CAPABILITIES,
      capabilities_coverage: "100%",
      endpoint: "/mcp",
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        mcp_protocol_version: MCP_PROTOCOL_VERSION,
        uptime_seconds: Math.floor(process.uptime()),
        tools_count: TOOL_DEFINITIONS.length,
        resources_count: RESOURCE_DEFINITIONS.length,
        resource_templates_count: RESOURCE_TEMPLATE_DEFINITIONS.length,
        prompts_count: PROMPT_DEFINITIONS.length,
        capabilities: MCP_CAPABILITIES,
        capabilities_coverage: "100%",
        endpoint: "/mcp",
      },
      { status: 503 }
    );
  }
}
