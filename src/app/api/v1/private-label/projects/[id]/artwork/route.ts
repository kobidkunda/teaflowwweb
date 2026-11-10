import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { PrivateLabelService } from "@/lib/private-label/service";
import { updateArtworkRequestSchema } from "@/lib/private-label/schemas";
import { toPublicDesignVersionDto } from "@/lib/private-label/public-dto";
import {
  PrivateLabelNotFoundError,
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

export async function PATCH(
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

  const parseResult = updateArtworkRequestSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const expectedRevision = data.expected_revision ?? data.expectedRevision;
  const logoAssetId = data.logo_asset_id ?? data.logoAssetId;
  const artworkUrl = data.artwork_url ?? data.artworkUrl;
  const sceneJson = data.scene_json || data.sceneJson || {};

  const actor = {
    actor_type: "customer" as const,
    actor_id: customer.id,
    actor_email: customer.email,
  };

  try {
    const designVersion = PrivateLabelService.createDesignVersion(
      id,
      {
        expected_revision: expectedRevision,
        scene_json: { ...sceneJson, logoAssetId, artworkUrl },
        front_artwork_asset_id: logoAssetId,
        asset_url: artworkUrl,
      },
      actor,
      customer.id
    );

    return NextResponse.json(
      {
        id: designVersion.id,
        design_version: toPublicDesignVersionDto(designVersion),
        version_number: designVersion.version_number,
        status: designVersion.status || "preflight_pending",
        revision: designVersion.version_number,
      },
      { status: 200 }
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
    const message = error instanceof Error ? error.message : "Failed to update artwork";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
