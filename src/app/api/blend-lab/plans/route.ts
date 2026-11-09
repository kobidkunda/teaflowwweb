import { NextResponse } from "next/server";
import { listPlans, formatInr } from "@/lib/blend-lab/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = listPlans().map((p) => ({
      ...p,
      formattedPrice: formatInr(p.totalPaise),
      formattedInclusivePrice: `${formatInr(p.totalPaise)} (incl. 18% GST)`,
    }));

    return NextResponse.json({
      success: true,
      plans,
      currency: "INR",
      taxClassification: "B2B Professional Services",
      taxRateBps: 1800,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load Blend Lab plans" },
      { status: 500 }
    );
  }
}
