import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { createTradeQuote, TradeQuoteError } from "@/lib/trade/quotes";

export const runtime = "nodejs";

const TRADE_SESSION_COOKIE = "tf_trade_sid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(TRADE_SESSION_COOKIE)?.value;
    let isNewSession = false;
    if (!sessionId || sessionId.length < 8) {
      sessionId = `ts_${randomUUID().replace(/-/g, "")}`;
      isNewSession = true;
    }

    const result = createTradeQuote(body, sessionId);
    const res = NextResponse.json(result, { status: 200 });
    if (isNewSession) {
      res.cookies.set(TRADE_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid quote request.", issues: err.issues },
        { status: 400 }
      );
    }
    if (err instanceof TradeQuoteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { kind: "temporarily_unavailable", retryable: true },
      { status: 503 }
    );
  }
}
