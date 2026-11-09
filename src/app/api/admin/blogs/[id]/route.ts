import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, notFound, invalid, conflict } from "@/lib/adminHttp";
import { getBlogPost, upsertBlogPost, deleteBlogPost, analyzeBlogSpecs } from "@/lib/blogs";

export const runtime = "nodejs";

const updateBlogSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(200).optional(),
  slug: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1, "Article content is required.").optional(),
  summary: z.string().trim().max(1000).optional(),
  excerpt: z.string().trim().max(500).optional(),
  cover_image_url: z.string().trim().max(500).optional(),
  cover_media_id: z.number().int().positive().optional().nullable(),
  author_name: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  published_at: z.string().optional().nullable(),
  seo_title: z.string().trim().max(200).optional().nullable(),
  seo_description: z.string().trim().max(500).optional().nullable(),
  canonical_override: z.string().trim().max(500).optional().nullable(),
  noindex: z.union([z.boolean(), z.number()]).transform((v) => (v ? 1 : 0)).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const post = getBlogPost(decodedId);

  if (!post) {
    return notFound("Blog article not found.");
  }

  return NextResponse.json({ post, specs: analyzeBlogSpecs(post.content, post) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const current = getBlogPost(decodedId);

  if (!current) {
    return notFound("Blog article not found.");
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateBlogSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const updated = upsertBlogPost({
      id: current.id,
      title: parsed.data.title ?? current.title,
      slug: parsed.data.slug ?? current.slug,
      content: parsed.data.content ?? current.content,
      summary: parsed.data.summary ?? current.summary,
      excerpt: parsed.data.excerpt ?? current.excerpt,
      cover_image_url: parsed.data.cover_image_url ?? current.cover_image_url ?? undefined,
      cover_media_id: parsed.data.cover_media_id !== undefined ? parsed.data.cover_media_id : current.cover_media_id,
      author_name: parsed.data.author_name ?? current.author_name,
      status: parsed.data.status ?? current.status,
      published_at: parsed.data.published_at !== undefined ? parsed.data.published_at : current.published_at,
      seo_title: parsed.data.seo_title !== undefined ? parsed.data.seo_title : current.seo_title,
      seo_description: parsed.data.seo_description !== undefined ? parsed.data.seo_description : current.seo_description,
      canonical_override: parsed.data.canonical_override !== undefined ? parsed.data.canonical_override : current.canonical_override,
      noindex: parsed.data.noindex !== undefined ? parsed.data.noindex : current.noindex,
    });
    return NextResponse.json({ post: updated, specs: analyzeBlogSpecs(updated.content, updated) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to update blog article.";
    return conflict(msg);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const current = getBlogPost(decodedId);

  if (!current) {
    return notFound("Blog article not found.");
  }

  try {
    deleteBlogPost(current.id);
    return NextResponse.json({ success: true, message: "Blog article deleted successfully." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to delete blog article.";
    return conflict(msg);
  }
}

