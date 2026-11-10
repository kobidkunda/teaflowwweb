import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { generateQuotationPdfBuffer } from "@/lib/private-label/pdf";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";
import type { Project, Client } from "@/lib/private-label/types";
import { getDb } from "@/lib/db";

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

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const customer = resolveCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    const quote = PrivateLabelService.getQuote(id, customer.id);
    const db = getDb();
    const project = db
      .prepare("SELECT * FROM pl_projects WHERE id = ?")
      .get(quote.project_id) as Project | undefined;
    const client = project?.client_id
      ? (db.prepare("SELECT * FROM pl_clients WHERE id = ?").get(project.client_id) as Client | undefined)
      : null;

    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency") || "INR";

    const pdfBuffer = generateQuotationPdfBuffer(quote, project, client, currency);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="teafloww-quote-${quote.quote_number || quote.id}.pdf"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
