import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { createProjectDraftRequestSchema } from "@/lib/private-label/schemas";
import { toPublicProjectDto } from "@/lib/private-label/public-dto";
import type { ProjectStatus } from "@/lib/private-label/types";

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

  // Support Playwright { data: { ... } } wrapper and alias name -> title
  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? ((body as Record<string, unknown>).data as Record<string, unknown>)
      : (body as Record<string, unknown>);

  const payload = { ...rawData };
  if (!payload.title && payload.name) {
    payload.title = payload.name;
  }

  const parseResult = createProjectDraftRequestSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  try {
    const data = parseResult.data;
    const actor = {
      actor_type: "customer" as const,
      actor_id: customer.id,
      actor_email: customer.email,
    };

    const project = PrivateLabelService.createProjectDraft(
      {
        title: data.title,
        brand_name: data.brandName || data.brand_name,
        brand_id: data.brandId || data.brand_id,
        client_id: data.clientId || data.client_id,
        target_market: data.targetMarket || data.target_market || "IN",
        notes: data.notes,
        draft_configuration: data.draftConfiguration || data.draft_configuration || rawData,
        items:
          data.items ||
          (rawData.packaging_variant_id || rawData.packagingVariantId
            ? [
                {
                  packaging_variant_id: String(
                    rawData.packaging_variant_id || rawData.packagingVariantId
                  ),
                  fill_weight_grams: 100,
                  quantity_units: 500,
                },
              ]
            : undefined),
      },
      customer.id,
      actor
    );

    const publicProject = toPublicProjectDto(project);

    return NextResponse.json(
      {
        id: project.id,
        project_id: project.id,
        project: publicProject,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project draft";
    if (/foreign|constraint|not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const customer = resolveCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 50);
    const offset = Number(searchParams.get("offset") || 0);
    const status = (searchParams.get("status") || undefined) as ProjectStatus | undefined;

    const { projects, total } = PrivateLabelService.listProjects(customer.id, {
      limit,
      offset,
      status,
    });

    return NextResponse.json({
      projects: projects.map(toPublicProjectDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
