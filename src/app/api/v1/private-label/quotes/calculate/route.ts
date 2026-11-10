import { PrivateLabelGateError } from "@/lib/private-label/types";
import { NextResponse } from "next/server";
import { PrivateLabelService } from "@/lib/private-label/service";
import { liveQuoteCalculateSchema } from "@/lib/private-label/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? (body as Record<string, unknown>).data
      : body;

  const parseResult = liveQuoteCalculateSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  try {
    const result = PrivateLabelService.calculateLiveQuote(parseResult.data as Record<string, unknown>);

    // Whitelist projection: redact internal margin_paise from public estimate
    if (result.breakdown) {
      const publicBreakdown = { ...result.breakdown } as Record<string, unknown>;
      delete publicBreakdown.marginPaise;
      return NextResponse.json({
        ...result,
        breakdown: publicBreakdown,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PrivateLabelGateError) return NextResponse.json({ error: error.message, blockers: error.blockers }, { status: 422 });
    const message = "Estimate unavailable. Please retry or contact our team.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
