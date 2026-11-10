import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { updateProjectRequestSchema } from "@/lib/private-label/schemas";
import { toPublicProjectDto } from "@/lib/private-label/public-dto";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  PrivateLabelRevisionConflictError,
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
    const project = PrivateLabelService.getProject(id, customer.id);
    const publicProject = toPublicProjectDto(project);

    return NextResponse.json({
      id: project.id,
      project_id: project.id,
      project: publicProject,
      items: project.items || [],
      total_items: project.items?.length || 0,
    });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const message = "Unable to load this project. Please retry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleUpdate(
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
      ? (body as Record<string, unknown>).data
      : body;

  const parseResult = updateProjectRequestSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const expectedRevision = Number(data.expected_revision ?? data.expectedRevision);

  try {
    const actor = {
      actor_type: "customer" as const,
      actor_id: customer.id,
      actor_email: customer.email,
    };

    const updated = PrivateLabelService.updateProjectDraft(
      id,
      expectedRevision,
      {
        title: data.title,
        target_market: data.targetMarket || data.target_market,
        notes: data.notes,
        status: data.status,
        draft_configuration: data.draftConfiguration ?? data.draft_configuration,
        items: data.items,
      },
      actor,
      customer.id
    );

    const publicProject = toPublicProjectDto(updated);

    return NextResponse.json({
      id: updated.id,
      project_id: updated.id,
      project: publicProject,
      revision: updated.revision,
    });
  } catch (error) {
    if (error instanceof PrivateLabelGateError) return NextResponse.json({ error: error.message, reasons: error.blockers }, { status: 422 });
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
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const message = "Unable to update this project. Please retry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, props);
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, props);
}
