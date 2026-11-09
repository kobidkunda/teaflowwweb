import { NextRequest, NextResponse } from "next/server";
import { getProjectByPublicId } from "@/lib/blend-lab/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const project = getProjectByPublicId(publicId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve project details" },
      { status: 500 }
    );
  }
}
