import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import { toPublicDesignVersionDto } from "@/lib/private-label/public-dto";
import {
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
} from "@/lib/private-label/types";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const admin = getAdminUser(request);
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

  const proofUrl = (rawData.proof_url || rawData.proofUrl || rawData.preview_render_url) as string | undefined;
  const versionNumber = (rawData.version || rawData.version_number) as number | undefined;

  const actor = {
    actor_type: "admin" as const,
    actor_id: String(admin?.id || "admin_system"),
    actor_email: admin?.username || "admin@teafloww.com",
  };

  try {
    const designVersion = PrivateLabelService.createDesignVersion(
      id,
      {
        scene_json: { proof_url: proofUrl, requested_version: versionNumber },
        preview_render_url: proofUrl,
        print_ready_pdf_url: proofUrl,
      },
      actor
    );

    return NextResponse.json(
      {
        success: true,
        design_version: toPublicDesignVersionDto(designVersion),
        version_number: designVersion.version_number,
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
    const message = error instanceof Error ? error.message : "Failed to create proof";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
