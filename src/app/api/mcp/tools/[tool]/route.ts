import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import { isMcpAuthorized } from "@/lib/mcpAuth";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";

function checkBearerOrParamAuth(request: Request): boolean {
  if (isMcpAuthorized(request)) return true;
  const expected = process.env.MCP_TOKEN || "";
  if (!expected) return false;
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tool: string }> }
) {
  const limited = rateLimitResponse(request, "mcp", RATE_LIMITS.mcp);
  if (limited) return limited;

  if (!checkBearerOrParamAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid MCP token via ?token= or Authorization: Bearer." },
      { status: 401 }
    );
  }

  const { tool } = await params;
  const toolName = decodeURIComponent(tool);

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  try {
    const result = dispatchToolCall(toolName, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof McpError) {
      const status =
        error.code === -32602 ? 400 :
        error.code === -32004 ? 404 :
        error.code === -32009 ? 409 :
        error.code === -32601 ? 404 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Internal tool execution error." }, { status: 500 });
  }
}
