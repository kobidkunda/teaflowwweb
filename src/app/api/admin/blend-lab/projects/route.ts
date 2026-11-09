import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { listProjects } from "@/lib/blend-lab/projects";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const paymentState = url.searchParams.get("paymentState") || undefined;
  const planCode = url.searchParams.get("planCode") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

  const { projects, total } = listProjects({
    status,
    paymentState,
    planCode,
    search,
    limit,
    offset,
  });

  return NextResponse.json({ projects, total });
}
