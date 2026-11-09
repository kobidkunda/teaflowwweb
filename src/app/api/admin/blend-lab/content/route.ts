import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  getBlendLabContent,
  updateBlendLabContent,
} from "@/lib/blend-lab/content";

export const runtime = "nodejs";

const imagePlacementSchema = z.object({
  imageUrl: z.string().min(1).max(500),
  altText: z.string().max(300).optional(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  ctaLabel: z.string().max(100).optional(),
  ctaHref: z.string().max(300).optional(),
  mediaId: z.number().int().positive().optional().nullable(),
});

const faqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
  category: z.string().max(100).optional(),
});

const updateContentSchema = z.object({
  homeEyebrow: z.string().max(100).optional(),
  homeTitle: z.string().max(200).optional(),
  homeDescription: z.string().max(1000).optional(),
  heroEyebrow: z.string().max(100).optional(),
  heroTitle: z.string().max(200).optional(),
  heroDescription: z.string().max(1000).optional(),
  heroImage: imagePlacementSchema.optional(),
  homeImage: imagePlacementSchema.optional(),
  faqs: z.array(faqItemSchema).optional(),
});

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const content = getBlendLabContent();
  return NextResponse.json(content);
}

export async function PUT(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const updated = updateBlendLabContent(parsed.data);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not update Blend Lab content.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
