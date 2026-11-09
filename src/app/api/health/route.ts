import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Liveness probe: is the process alive and can it reach SQLite?
// The 200 + { status: "ok" } shape is kept for existing monitors/E2E.
// No PII, no secrets, no filesystem paths in the response.
export function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return NextResponse.json({
      status: "ok",
      database: process.env.DATABASE_TYPE === "postgres" ? "postgres" : "sqlite",
      uptime_s: Math.floor(process.uptime()),
    });
  } catch (error) {
    logger.error("health check failed", {
      route: "/api/health",
      code: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
