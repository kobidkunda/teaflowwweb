import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { testShiprocketConnection } from "@/lib/shiprocket";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  try {
    const result = await testShiprocketConnection(body.email, body.password);
    return NextResponse.json(result);
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Shiprocket connection test failed.");
  }
}
