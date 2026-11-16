import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimitResponse } from "@/lib/rateLimit";
import { businessLeadSchema } from "@/lib/business/schema";
import {
  createBusinessLeadWithOutbox,
  getB2BSettings,
  IdempotencyConflictError,
} from "@/lib/business/repository";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 8192;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.SITE_ORIGIN;

  if (!origin) {
    if (configuredOrigin) return false;
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
      return false;
    }
    return process.env.NODE_ENV !== "production";
  }

  let source: URL;
  try {
    source = new URL(origin);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(source.protocol)) {
    return false;
  }

  if (configuredOrigin && origin === configuredOrigin) {
    return true;
  }

  // Next's internal request URL can use the bind host (0.0.0.0). Compare the
  // browser's Origin host with the incoming Host header or nextUrl.host.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (source.host === host) {
    return true;
  }

  if (origin === request.nextUrl.origin) return true;
  if (
    process.env.NODE_ENV !== "production" &&
    (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))
  ) {
    return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const limited = rateLimitResponse(request, "business-leads", 15);
  if (limited) return limited;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "JSON required" }, { status: 415, headers: NO_STORE_HEADERS });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE_HEADERS });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!UUID_REGEX.test(idempotencyKey)) {
    return NextResponse.json({ error: "Invalid request token" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const settings = getB2BSettings();
    if (!settings.leads_enabled) {
      return NextResponse.json(
        { error: "Business quotation intake is temporarily unavailable." },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const rawText = await request.text();
    if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE_HEADERS });
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = businessLeadSchema.safeParse(rawJson);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] ? String(issue.path[0]) : "_form";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Please review your details.",
          fieldErrors,
        },
        { status: 422, headers: NO_STORE_HEADERS }
      );
    }

    const lead = parsed.data;
    if (lead.honeypot && lead.honeypot.trim().length > 0) {
      return NextResponse.json({ error: "Please retry" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const result = createBusinessLeadWithOutbox(lead, idempotencyKey);
    return NextResponse.json(
      { reference: result.reference },
      { status: result.duplicate ? 200 : 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: "Request token reused with different details." },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
    logger.error("Failed to persist business lead", {
      route: "/api/business-leads",
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not save enquiry. Please retry." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
