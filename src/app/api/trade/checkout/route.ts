import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { createTradeOrderFromQuote, TradeCheckoutError } from "@/lib/trade/checkout";

export const runtime = "nodejs";

const TRADE_SESSION_COOKIE = "tf_trade_sid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(TRADE_SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Trade session missing. Please request a fresh delivery quote." },
        { status: 403 }
      );
    }

    const result = createTradeOrderFromQuote(body, sessionId);
    return NextResponse.json(result, { status: result.deduped ? 200 : 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid checkout request.", issues: err.issues },
        { status: 400 }
      );
    }
    if (err instanceof TradeCheckoutError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Unable to create order. Please retry." },
      { status: 500 }
    );
  }
}
