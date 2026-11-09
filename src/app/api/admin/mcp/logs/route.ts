import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guard } from "@/lib/adminHttp";

export const runtime = "nodejs";

export interface McpLogEntry {
  id: number;
  method: string;
  tool_name: string;
  arguments: string;
  status: "success" | "error";
  error_code: number | null;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitParam) ? limitParam : 50));
  const statusFilter = url.searchParams.get("status");

  const db = getDb();

  let logs: McpLogEntry[];
  if (statusFilter && (statusFilter === "success" || statusFilter === "error")) {
    logs = db
      .prepare(
        "SELECT id, method, tool_name, arguments, status, error_code, error_message, duration_ms, created_at FROM mcp_logs WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ?"
      )
      .all(statusFilter, limit) as McpLogEntry[];
  } else {
    logs = db
      .prepare(
        "SELECT id, method, tool_name, arguments, status, error_code, error_message, duration_ms, created_at FROM mcp_logs ORDER BY created_at DESC, id DESC LIMIT ?"
      )
      .all(limit) as McpLogEntry[];
  }

  return NextResponse.json({ logs });
}
