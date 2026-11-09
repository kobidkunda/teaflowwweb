import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import { listPlans, upsertPlan, type PlanCode } from "@/lib/blend-lab/plans";

export const runtime = "nodejs";

const upsertPlanSchema = z.object({
  code: z.enum(["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"] as [PlanCode, ...PlanCode[]]),
  title: z.string().min(1).max(100).optional(),
  eyebrow: z.string().max(100).optional(),
  tagline: z.string().max(250).optional(),
  description: z.string().max(1000).optional(),
  totalPaise: z.number().int().min(0).max(10000000),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  badge: z.string().max(50).optional().nullable(),
  buttonLabel: z.string().max(60).optional(),
  features: z.array(z.string().max(250)).optional(),
  exclusions: z.array(z.string().max(250)).optional(),
  entitlements: z
    .object({
      inboundShipments: z.number().int().min(0).max(10).optional(),
      outboundShipments: z.number().int().min(0).max(10).optional(),
      detailedPdf: z.boolean().optional(),
      developmentIncluded: z.boolean().optional(),
      includedRevisionRounds: z.number().int().min(0).max(10).optional(),
      includedTrialCandidates: z.number().int().min(0).max(10).optional(),
      turnaroundDays: z.number().int().min(1).max(90).optional(),
      sampleWeightGrams: z.number().int().min(10).max(5000).optional(),
    })
    .optional(),
});

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const plans = listPlans({ activeOnly: false });
  return NextResponse.json({ plans });
}

export async function PUT(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = upsertPlanSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const plan = upsertPlan({
      ...parsed.data,
      badge: parsed.data.badge === null ? undefined : parsed.data.badge,
    });
    return NextResponse.json({ plan });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not update service plan.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
