import { NextResponse } from "next/server";
import { readdirSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Readiness probe: is this instance ready to serve traffic?
// Checks (all boolean, no secret values or PII leaked):
//   database   — SQLite file opens and answers SELECT 1
//   migrations — every scripts/migrations/*.mjs has a schema_migrations row
//   env        — SESSION_SECRET / MCP_TOKEN configured (presence only)
// Returns 200 { status: "ready" } or 503 { status: "not-ready", pending }.
// Deploy flow must run `npm run db:migrate` BEFORE routing traffic here —
// the app never auto-migrates inside a request path.
export function GET() {
  const checks: Record<string, boolean> = {
    database: false,
    migrations: false,
    env: false,
  };
  let pending: string[] = [];
  try {
    getDb().prepare("SELECT 1").get();
    checks.database = true;
  } catch (error) {
    logger.error("readiness database check failed", {
      route: "/api/ready",
      code: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
  }
  if (checks.database) {
    try {
      const dir = path.resolve(process.cwd(), "scripts/migrations");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".mjs"))
        .sort()
        .map((f) => f.replace(/\.mjs$/, ""));
      let applied = new Set<string>();
      try {
        applied = new Set(
          (
            getDb()
              .prepare("SELECT version FROM schema_migrations")
              .all() as { version: string }[]
          ).map((r) => r.version)
        );
      } catch {
        applied = new Set();
      }
      pending = files.filter((v) => !applied.has(v));
      checks.migrations = pending.length === 0;
    } catch (error) {
      logger.error("readiness migration check failed", {
        route: "/api/ready",
        code: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });
    }
  }
  checks.env = Boolean(process.env.SESSION_SECRET) && Boolean(process.env.MCP_TOKEN);
  const ready = checks.database && checks.migrations;
  const body: Record<string, unknown> = { checks, envConfigured: checks.env };
  if (ready) {
    return NextResponse.json({ status: "ready", ...body });
  }
  return NextResponse.json(
    { status: "not-ready", pending, ...body },
    { status: 503 }
  );
}
