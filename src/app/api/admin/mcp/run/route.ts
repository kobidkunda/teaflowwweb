import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { guard, invalid } from "@/lib/adminHttp";
import {
  TOOL_DEFINITIONS,
  dispatchToolCall,
  dispatchResourceRead,
  dispatchPromptGet,
  dispatchCompletion,
  McpError,
} from "@/lib/mcp";

export const runtime = "nodejs";

const runSchema = z.object({
  method: z.enum(["tools/call", "resources/read", "prompts/get", "completion/complete"]).optional(),
  tool: z.string().optional(),
  uri: z.string().optional(),
  prompt: z.string().optional(),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
  ref: z.record(z.string(), z.unknown()).optional(),
  argument: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const { method: requestedMethod, tool, uri, prompt, arguments: args, ref, argument } = parsed.data;

  // Infer method if not explicitly specified
  let effectiveMethod = requestedMethod;
  if (!effectiveMethod) {
    if (uri) effectiveMethod = "resources/read";
    else if (prompt) effectiveMethod = "prompts/get";
    else effectiveMethod = "tools/call";
  }

  const startTime = Date.now();
  const db = getDb();
  let targetName = "";
  let targetArgs: unknown = args;

  try {
    let result: unknown;

    if (effectiveMethod === "tools/call") {
      const toolName = tool || "";
      if (!toolName) {
        return NextResponse.json({ ok: false, error: "Tool name is required for tools/call." }, { status: 400 });
      }
      targetName = toolName;
      const toolDef = TOOL_DEFINITIONS.find((t) => t.name === toolName);
      if (!toolDef) {
        return NextResponse.json(
          { ok: false, error: `Tool '${toolName}' is not registered in the MCP server.` },
          { status: 404 }
        );
      }
      result = dispatchToolCall(toolName, args);
    } else if (effectiveMethod === "resources/read") {
      if (!uri) {
        return NextResponse.json({ ok: false, error: "URI is required for resources/read." }, { status: 400 });
      }
      targetName = uri;
      targetArgs = { uri };
      result = dispatchResourceRead(uri);
    } else if (effectiveMethod === "prompts/get") {
      if (!prompt) {
        return NextResponse.json({ ok: false, error: "Prompt name is required for prompts/get." }, { status: 400 });
      }
      targetName = prompt;
      result = dispatchPromptGet(prompt, args);
    } else if (effectiveMethod === "completion/complete") {
      targetName = "completion";
      targetArgs = { ref, argument };
      result = dispatchCompletion(ref, argument);
    } else {
      return NextResponse.json({ ok: false, error: `Unsupported method '${effectiveMethod}'.` }, { status: 400 });
    }

    const durationMs = Math.max(0, Date.now() - startTime);

    try {
      db.prepare(`
        INSERT INTO mcp_logs (method, tool_name, arguments, status, duration_ms)
        VALUES (?, ?, ?, 'success', ?)
      `).run(effectiveMethod, targetName, JSON.stringify(targetArgs || {}), durationMs);
    } catch {
      // Best-effort logging
    }

    return NextResponse.json({
      ok: true,
      method: effectiveMethod,
      tool: targetName,
      target: targetName,
      result,
      duration_ms: durationMs,
    });
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startTime);
    const errorCode = error instanceof McpError ? error.code : -32603;
    const errorMessage = error instanceof Error ? error.message : "MCP execution failed.";

    try {
      db.prepare(`
        INSERT INTO mcp_logs (method, tool_name, arguments, status, error_code, error_message, duration_ms)
        VALUES (?, ?, ?, 'error', ?, ?, ?)
      `).run(effectiveMethod, targetName, JSON.stringify(targetArgs || {}), errorCode, errorMessage, durationMs);
    } catch {
      // Best-effort logging
    }

    return NextResponse.json({
      ok: false,
      method: effectiveMethod,
      tool: targetName,
      target: targetName,
      code: errorCode,
      error: errorMessage,
      duration_ms: durationMs,
    });
  }
}
