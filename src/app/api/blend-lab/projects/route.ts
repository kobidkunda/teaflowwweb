import { NextRequest, NextResponse } from "next/server";
import { intakeDraftSchema } from "@/lib/blend-lab/validation";
import { createProjectDraft } from "@/lib/blend-lab/projects";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Use Idempotency-Key header if provided, fallback to body
    const headerIdempotency = req.headers.get("idempotency-key");
    const payload = {
      ...json,
      idempotencyKey: headerIdempotency || json.idempotencyKey,
    };

    const parsed = intakeDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed for intake draft",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { project, reused } = createProjectDraft(parsed.data);

    return NextResponse.json(
      {
        success: true,
        reused,
        project,
      },
      { status: reused ? 200 : 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create Blend Lab project draft";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
