import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { createDesignVersionRequestSchema } from "@/lib/private-label/schemas";
import { toPublicDesignVersionDto } from "@/lib/private-label/public-dto";
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

  const parseResult = createDesignVersionRequestSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const actor = {
    actor_type: "customer" as const,
    actor_id: customer.id,
    actor_email: customer.email,
  };

  try {
    const designVersion = PrivateLabelService.createDesignVersion(
      id,
      {
        expected_revision: data.expected_revision ?? data.expectedRevision,
        project_item_id: data.project_item_id ?? data.projectItemId,
        scene_json: data.scene_json || data.sceneJson || {},
        asset_url: data.asset_url ?? data.assetUrl,
        front_artwork_asset_id: data.front_artwork_asset_id,
        back_artwork_asset_id: data.back_artwork_asset_id,
        preview_render_url: data.preview_render_url,
        print_ready_pdf_url: data.print_ready_pdf_url,
        // Customers submit designs; only operator review may mark preflight passed.
        preflight_report: undefined,
      },
      actor,
      customer.id
    );

    return NextResponse.json(
      {
        id: designVersion.id,
        design_version_id: designVersion.id,
        version_number: designVersion.version_number,
        status: designVersion.status,
        design_version: toPublicDesignVersionDto(designVersion),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
        { status: 422 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create design version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    const versions = PrivateLabelService.listDesignVersions(id, customer.id, actor);
    return NextResponse.json(
      {
        design_versions: versions.map(toPublicDesignVersionDto),
        total: versions.length,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to list design versions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
