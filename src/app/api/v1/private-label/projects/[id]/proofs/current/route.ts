import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { toPublicDesignVersionDto } from "@/lib/private-label/public-dto";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";

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
  const actor = {
    actor_type: "customer" as const,
    actor_id: customer.id,
    actor_email: customer.email,
  };

  try {
    const latest = PrivateLabelService.getLatestDesignVersion(id, customer.id, actor);
    if (!latest) {
      return NextResponse.json(
        {
          proof: null,
          message: "No proof generated yet for this project",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        proof: toPublicDesignVersionDto(latest),
        version_number: latest.version_number,
        status: latest.status,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch proof";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
