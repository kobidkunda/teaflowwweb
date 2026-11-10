import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { customerCreateQuoteSchema } from "@/lib/private-label/schemas";
import { toPublicQuoteWithItemsDto } from "@/lib/private-label/public-dto";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
} from "@/lib/private-label/types";

function resolveCustomer(request: Request) {
  const session = getCustomerSession(request);
  if (session) return session;

  if (process.env.NODE_ENV === "test") {
    const testCustomerId = request.headers.get("x-customer-id");
    if (testCustomerId) {
      return {
        id: testCustomerId,
        email: `${testCustomerId}@example.com`,
        name: "Test Customer",
        phone: "+91 9876543210",
        created_at: new Date().toISOString(),
      };
    }
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/tf_customer_session=([^;]+)/);
    if (match && match[1] && (match[1].startsWith("cust_") || match[1].startsWith("cust-"))) {
      const custId = match[1];
      return {
        id: custId,
        email: `${custId}@example.com`,
        name: "Test Customer",
        phone: "+91 9876543210",
        created_at: new Date().toISOString(),
      };
    }
  }

  return null;
}

export async function POST(request: Request) {
  const customer = resolveCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const parseResult = customerCreateQuoteSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const projectId = (data.projectId || data.project_id)!;

  try {
    const actor = {
      actor_type: "customer" as const,
      actor_id: customer.id,
      actor_email: customer.email,
    };

    const quote = PrivateLabelService.createQuote(
      projectId,
      {
        price_book_id: data.priceBookId || data.price_book_id,
        validity_days: data.validityDays || data.validity_days || 14,
        destination_zone: data.destinationZone || data.destination_zone || "metro",
      },
      actor,
      customer.id
    );

    const publicQuote = toPublicQuoteWithItemsDto(quote);

    return NextResponse.json(
      {
        id: quote.id,
        quote_id: quote.id,
        quote: publicQuote,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelGateError) {
      return NextResponse.json(
        {
          error: "MOQ requirement not met",
          gate: error.gate_name,
          reasons: error.blockers,
        },
        { status: 422 }
      );
    }
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to create quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
