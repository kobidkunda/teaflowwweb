import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { createTradeEnquiry } from "@/lib/trade/quotes";

export const runtime = "nodejs";

const TRADE_SESSION_COOKIE = "tf_trade_sid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const sessionId =
      cookieStore.get(TRADE_SESSION_COOKIE)?.value ||
      `ts_${randomUUID().replace(/-/g, "")}`;

    const result = createTradeEnquiry(body, sessionId);
    return NextResponse.json(result, { status: result.deduped ? 200 : 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid enquiry request.", issues: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Unable to submit enquiry right now." },
      { status: 500 }
    );
  }
}
