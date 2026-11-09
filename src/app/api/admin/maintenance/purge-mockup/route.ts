import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { purgeMockupData } from "@/lib/maintenance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const result = purgeMockupData();
    return NextResponse.json({
      success: true,
      message: "Mockup data purge executed successfully.",
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to purge mockup data.",
      },
      { status: 500 }
    );
  }
}
