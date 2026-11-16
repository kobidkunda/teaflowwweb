import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getAuthorizedTradeOrder,
  saveReorderReminder,
  TradeCheckoutError,
} from "@/lib/trade/checkout";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const token = req.nextUrl.searchParams.get("token") || "";
    const order = getAuthorizedTradeOrder(id, token);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json({ order }, { status: 200 });
  } catch (err) {
    if (err instanceof TradeCheckoutError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to load order." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const reminder = saveReorderReminder({ ...body, orderId: id });
    return NextResponse.json({ reminder }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid reminder request.", issues: err.issues },
        { status: 400 }
      );
    }
    if (err instanceof TradeCheckoutError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to save reminder." }, { status: 500 });
  }
}
