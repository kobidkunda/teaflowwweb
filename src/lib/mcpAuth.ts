import { timingSafeEqual } from "node:crypto";

/**
 * MCP token gate. Auth is the `?token=` query param ONLY — never the
 * Authorization header, never the body. Compared constant-time against the
 * server-only MCP_TOKEN env. Generic result, no detail, and the token value
 * is never logged (callers must strip query strings from access logs).
 */
export function mcpTokenFromUrl(request: Request): string | null {
  try {
    const token = new URL(request.url).searchParams.get("token");
    return token === null || token === "" ? null : token;
  } catch {
    return null;
  }
}

export function isMcpAuthorized(request: Request): boolean {
  const expected = process.env.MCP_TOKEN || "";
  if (!expected) return false;
  const provided = mcpTokenFromUrl(request);
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function mcpUnauthorized() {
  // Generic auth error: no hint whether the token was missing or wrong.
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized." } },
    { status: 401 }
  );
}
