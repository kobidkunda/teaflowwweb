import { NextRequest, NextResponse } from "next/server";
import { getProjectByPublicId } from "@/lib/blend-lab/projects";
import { canDownloadPdfReport } from "@/lib/blend-lab/plans";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicId: string; version: string }> }
) {
  try {
    const { publicId, version } = await params;
    const project = getProjectByPublicId(publicId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Check entitlement
    if (!canDownloadPdfReport(project.planCode)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your selected plan (Match & Quote) does not include a detailed laboratory PDF report. Upgrade to Tea Quality Audit or Signature Blend Lab to access complete cupping reports.",
          code: "ENTITLEMENT_RESTRICTED",
        },
        { status: 403 }
      );
    }

    // In a full production workflow, this delivers an expiring signed S3 URL or PDF stream.
    // For Milestone B, return the verified document metadata:
    return NextResponse.json({
      success: true,
      publicId: project.publicId,
      reportVersion: version,
      title: "TeaFloww Sensory & Quality Evaluation Report",
      status: "sample_report_ready",
      downloadUrl: `/uploads/sample-tea-cupping-report-v${version}.pdf`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to process report download" },
      { status: 500 }
    );
  }
}
