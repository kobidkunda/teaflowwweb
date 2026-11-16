import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  listTradeEnquiries,
  updateTradeEnquiry,
} from "@/lib/trade/catalogue";
import { createTradeQuote } from "@/lib/trade/quotes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  return NextResponse.json({ enquiries: listTradeEnquiries(status) });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const enquiry = updateTradeEnquiry(body);
    return NextResponse.json({ enquiry }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid enquiry update.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update enquiry.");
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = (await req.json()) as {
      enquiryId: string;
      quoteRequest: unknown;
      assignedOwner?: string;
    };
    if (!body.enquiryId || !body.quoteRequest) {
      return invalid("enquiryId and quoteRequest are required.");
    }
    const quote = createTradeQuote(body.quoteRequest, `op_${body.enquiryId}`);
    if (quote.kind !== "confirmed") {
      return NextResponse.json(
        { error: "Quote did not resolve to confirmed.", quote },
        { status: 400 }
      );
    }
    const enquiry = updateTradeEnquiry({
      id: body.enquiryId,
      status: "quoted",
      assigned_owner: body.assignedOwner,
      converted_quote_id: quote.id,
    });
    return NextResponse.json({ enquiry, quote }, { status: 201 });
  } catch (err) {
    return invalid(err instanceof Error ? err.message : "Failed to convert enquiry.");
  }
}
