import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { proofApprovalRequestSchema } from "@/lib/private-label/schemas";
import { toPublicApprovalEventDto } from "@/lib/private-label/public-dto";
import {
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
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

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const customer = resolveCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? ((body as Record<string, unknown>).data as Record<string, unknown>)
      : (body as Record<string, unknown>);

  const parseResult = proofApprovalRequestSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const disclaimerAccepted =
    data.disclaimer_accepted ??
    data.legal_disclaimer_accepted ??
    data.legalDisclaimerAccepted;

  if (disclaimerAccepted !== true) {
    return NextResponse.json(
      {
        error: "Legal proof disclaimer must be explicitly accepted",
        code: "DISCLAIMER_REQUIRED",
      },
      { status: 400 }
    );
  }

  const actor = {
    actor_type: "customer" as const,
    actor_id: customer.id,
    actor_email: customer.email,
  };

  try {
    const approval = PrivateLabelService.approveProof(
      id,
      {
        disclaimer_accepted: true,
        legal_disclaimer_accepted: true,
        signer_name: data.signer_name || data.signerName || customer.name || "Customer",
        actor_name: customer.name || "Customer",
        revision: data.revision,
        expected_revision: data.expected_revision ?? data.expectedRevision,
        notes: data.notes,
        ip_address: data.ip_address || request.headers.get("x-forwarded-for"),
        user_agent: data.user_agent || request.headers.get("user-agent"),
      },
      actor,
      customer.id
    );

    return NextResponse.json(
      {
        success: true,
        message: "Proof successfully approved",
        approval: toPublicApprovalEventDto(approval),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }
    if (error instanceof PrivateLabelRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    if (error instanceof PrivateLabelGateError) {
      return NextResponse.json(
        { error: error.message, blockers: error.blockers },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to approve proof";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
