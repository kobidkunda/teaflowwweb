import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { listTradeSharedPilots } from "@/lib/trade/catalogue";
import { registerSharedPilotInterest, TradeQuoteError } from "@/lib/trade/quotes";

export const runtime = "nodejs";

export async function GET() {
  const pilots = listTradeSharedPilots(true);
  return NextResponse.json({ pilots }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const interest = registerSharedPilotInterest(body);
    return NextResponse.json({ interest }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid shared supply request.", issues: err.issues },
        { status: 400 }
      );
    }
    if (err instanceof TradeQuoteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unable to register interest." }, { status: 500 });
  }
}
