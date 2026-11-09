import { NextResponse } from "next/server";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { checkPincodeServiceability } from "@/lib/shiprocket";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    pincode?: string;
    weightKg?: number;
    cod?: boolean;
  };

  if (!body.pincode || !/^\d{6}$/.test(body.pincode)) {
    return invalid({ pincode: ["Enter a valid 6-digit Indian PIN code."] });
  }

  try {
    const result = await checkPincodeServiceability(
      body.pincode,
      body.weightKg || 0.5,
      Boolean(body.cod)
    );
    return NextResponse.json(result);
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Serviceability query failed.");
  }
}
