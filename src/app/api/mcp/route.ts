import { NextResponse } from "next/server";
import { isMcpAuthorized, mcpUnauthorized } from "@/lib/mcpAuth";
import { getAdminUser } from "@/lib/adminAuth";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import {
  listToolDefinitions,
  dispatchToolCall,
  listResourceDefinitions,
  listResourceTemplateDefinitions,
  dispatchResourceRead,
  listPromptDefinitions,
  dispatchPromptGet,
  setMcpLogLevel,
  dispatchCompletion,
  MCP_CAPABILITIES,
  McpError,
} from "@/lib/mcp";

export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "himalayan-tea-house-mcp", version: "0.1.0" };

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
type RpcParams = {
  protocolVersion?: string;
  name?: string;
  arguments?: unknown;
  uri?: string;
  level?: string;
  ref?: unknown;
  argument?: unknown;
};

function result(id: unknown, payload: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result: payload };
}

function failure(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function handleOne(body: RpcRequest) {
  const id = body?.id ?? null;
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return { status: 400 as const, payload: failure(id, -32600, "Invalid request.") };
  }
  const params = (body.params ?? {}) as RpcParams;
  try {
    switch (body.method) {
      // Core lifecycle
      case "initialize":
        return {
          status: 200 as const,
          payload: result(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: MCP_CAPABILITIES,
            serverInfo: SERVER_INFO,
          }),
        };
      case "notifications/initialized":
      case "notifications/cancelled":
        return { status: 202 as const, payload: null };
      case "ping":
        return { status: 200 as const, payload: result(id, {}) };

      // Capability 1: Tools
      case "tools/list":
        return { status: 200 as const, payload: result(id, { tools: listToolDefinitions() }) };
      case "tools/call": {
        const name = (params as { name?: unknown }).name;
        const args = (params as { arguments?: unknown }).arguments ?? {};
        if (typeof name !== "string") {
          return { status: 200 as const, payload: failure(id, -32602, "Please check the tool arguments and try again.") };
        }
        const output = dispatchToolCall(name, args);
        return {
          status: 200 as const,
          payload: result(id, { content: [{ type: "text", text: JSON.stringify(output) }] }),
        };
      }

      // Capability 2: Resources & Resource Templates
      case "resources/list":
        return { status: 200 as const, payload: result(id, { resources: listResourceDefinitions() }) };
      case "resources/templates/list":
        return { status: 200 as const, payload: result(id, { resourceTemplates: listResourceTemplateDefinitions() }) };
      case "resources/read": {
        const uri = (params as { uri?: unknown }).uri;
        if (typeof uri !== "string" || !uri) return { status: 200 as const, payload: failure(id, -32602, "Resource URI is required.") };
        const output = dispatchResourceRead(uri);
        return { status: 200 as const, payload: result(id, output) };
      }
      case "resources/subscribe":
      case "resources/unsubscribe":
        return { status: 200 as const, payload: result(id, {}) };

      // Capability 3: Prompts
      case "prompts/list":
        return { status: 200 as const, payload: result(id, { prompts: listPromptDefinitions() }) };
      case "prompts/get": {
        const name = (params as { name?: unknown }).name;
        const args = (params as { arguments?: unknown }).arguments ?? {};
        if (typeof name !== "string") return { status: 200 as const, payload: failure(id, -32602, "Prompt name is required.") };
        const output = dispatchPromptGet(name, args);
        return { status: 200 as const, payload: result(id, output) };
      }

      // Capability 4: Logging
      case "logging/setLevel": {
        const level = (params as { level?: unknown }).level;
        const output = setMcpLogLevel(level);
        return { status: 200 as const, payload: result(id, output) };
      }

      // Capability 5: Completion
      case "completion/complete": {
        const ref = (params as { ref?: unknown }).ref;
        const argument = (params as { argument?: unknown }).argument;
        const output = dispatchCompletion(ref, argument);
        return { status: 200 as const, payload: result(id, output) };
      }

      default:
        return { status: 200 as const, payload: failure(id, -32601, "Unknown method.") };
    }
  } catch (error) {
    if (error instanceof McpError) return { status: 200 as const, payload: failure(id, error.code, error.message) };
    return { status: 200 as const, payload: failure(id, -32603, "The request could not be completed.") };
  }
}

function isRequestAuthorized(request: Request): boolean {
  return isMcpAuthorized(request) || Boolean(getAdminUser(request));
}

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "mcp", RATE_LIMITS.mcp);
  if (limited) return limited;
  const authorized = isRequestAuthorized(request);
  if (!authorized) return mcpUnauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(failure(null, -32700, "Invalid JSON."), { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = body.map((item) => {
      const handled = handleOne(item as RpcRequest);
      return handled.payload;
    });
    return NextResponse.json(out);
  }
  const handled = handleOne(body as RpcRequest);
  if (handled.status === 202) return new Response(null, { status: 202 });
  return NextResponse.json(handled.payload, { status: handled.status });
}

export function GET(request: Request) {
  const limited = rateLimitResponse(request, "mcp", RATE_LIMITS.mcp);
  if (limited) return limited;
  const authorized = isRequestAuthorized(request);
  if (!authorized) return mcpUnauthorized();
  return NextResponse.json({ error: "Use POST for MCP calls." }, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE(request: Request) {
  const limited = rateLimitResponse(request, "mcp", RATE_LIMITS.mcp);
  if (limited) return limited;
  const authorized = isRequestAuthorized(request);
  if (!authorized) return mcpUnauthorized();
  return NextResponse.json({ error: "Use POST for MCP calls." }, { status: 405, headers: { Allow: "POST" } });
}
