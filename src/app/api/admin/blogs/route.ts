import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { listBlogPosts, upsertBlogPost, analyzeBlogSpecs } from "@/lib/blogs";

export const runtime = "nodejs";

const createBlogSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(200),
  slug: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1, "Article content is required."),
  summary: z.string().trim().max(1000).optional().default(""),
  excerpt: z.string().trim().max(500).optional().default(""),
  cover_image_url: z.string().trim().max(500).optional().default(""),
  cover_media_id: z.number().int().positive().optional().nullable(),
  author_name: z.string().trim().max(100).optional().default("Himalayan Tea House"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  published_at: z.string().optional().nullable(),
  seo_title: z.string().trim().max(200).optional().nullable(),
  seo_description: z.string().trim().max(500).optional().nullable(),
  canonical_override: z.string().trim().max(500).optional().nullable(),
  noindex: z.union([z.boolean(), z.number()]).transform((v) => (v ? 1 : 0)).optional().default(0),
});

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);

  try {
    const posts = listBlogPosts({ status, q, limit });
    return NextResponse.json({ posts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to list blog posts.";
    return conflict(msg);
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createBlogSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const post = upsertBlogPost(parsed.data);
    return NextResponse.json({ post, specs: analyzeBlogSpecs(post.content, post) }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to create blog article.";
    return conflict(msg);
  }
}

