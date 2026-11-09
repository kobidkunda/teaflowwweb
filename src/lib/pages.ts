import { z } from "zod";
import { getDb } from "@/lib/db";

export interface PageSection {
  id?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  image_url?: string;
  cta_label?: string;
  cta_url?: string;
  items?: string[];
  [key: string]: unknown;
}

export interface SitePage {
  id: number;
  slug: string;
  title: string;
  eyebrow: string;
  headline: string;
  subtitle: string;
  hero_image_url: string;
  hero_media_id: number | null;
  body_markdown: string;
  sections_json: string;
  meta_title: string;
  meta_description: string;
  is_published: number;
  created_at: string;
  updated_at: string;
  sections?: PageSection[];
}

export const upsertPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1).max(200),
  eyebrow: z.string().max(200).optional().default(""),
  headline: z.string().max(300).optional().default(""),
  subtitle: z.string().max(500).optional().default(""),
  hero_image_url: z.string().max(500).optional().default(""),
  hero_media_id: z.number().int().positive().nullable().optional().default(null),
  body_markdown: z.string().optional().default(""),
  sections_json: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional(),
  meta_title: z.string().max(200).optional().default(""),
  meta_description: z.string().max(400).optional().default(""),
  is_published: z.union([z.boolean(), z.number()]).optional().default(true),
});

export type UpsertPageInput = z.input<typeof upsertPageSchema>;
export type UpsertPageOutput = z.output<typeof upsertPageSchema>;

function parseSections(rawJson: string): PageSection[] {
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizePageRow(row: Record<string, unknown>): SitePage {
  const sections_json = String(row.sections_json || "[]");
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    eyebrow: String(row.eyebrow || ""),
    headline: String(row.headline || ""),
    subtitle: String(row.subtitle || ""),
    hero_image_url: String(row.hero_image_url || ""),
    hero_media_id: row.hero_media_id ? Number(row.hero_media_id) : null,
    body_markdown: String(row.body_markdown || ""),
    sections_json,
    meta_title: String(row.meta_title || ""),
    meta_description: String(row.meta_description || ""),
    is_published: Number(row.is_published) ? 1 : 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    sections: parseSections(sections_json),
  };
}

export function getPageBySlug(slug: string): SitePage | null {
  const cleanSlug = slug.trim().toLowerCase();
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM site_pages WHERE slug = ?")
    .get(cleanSlug) as Record<string, unknown> | undefined;

  return row ? normalizePageRow(row) : null;
}

export function listPages(options: { publishedOnly?: boolean } = {}): SitePage[] {
  const db = getDb();
  const sql = options.publishedOnly
    ? "SELECT * FROM site_pages WHERE is_published = 1 ORDER BY title ASC"
    : "SELECT * FROM site_pages ORDER BY title ASC";
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map(normalizePageRow);
}

export function upsertPage(input: UpsertPageInput): SitePage {
  const validated = upsertPageSchema.parse(input);
  const db = getDb();

  let sectionsString = "[]";
  if (typeof validated.sections_json === "string") {
    // Validate it's valid JSON
    try {
      JSON.parse(validated.sections_json);
      sectionsString = validated.sections_json;
    } catch {
      sectionsString = "[]";
    }
  } else if (Array.isArray(validated.sections_json)) {
    sectionsString = JSON.stringify(validated.sections_json);
  }

  const isPub = validated.is_published === true || validated.is_published === 1 ? 1 : 0;

  db.prepare(`
    INSERT INTO site_pages (
      slug, title, eyebrow, headline, subtitle, hero_image_url, hero_media_id,
      body_markdown, sections_json, meta_title, meta_description, is_published,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      eyebrow = excluded.eyebrow,
      headline = excluded.headline,
      subtitle = excluded.subtitle,
      hero_image_url = excluded.hero_image_url,
      hero_media_id = excluded.hero_media_id,
      body_markdown = excluded.body_markdown,
      sections_json = excluded.sections_json,
      meta_title = excluded.meta_title,
      meta_description = excluded.meta_description,
      is_published = excluded.is_published,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    validated.slug,
    validated.title,
    validated.eyebrow ?? "",
    validated.headline ?? "",
    validated.subtitle ?? "",
    validated.hero_image_url ?? "",
    validated.hero_media_id ?? null,
    validated.body_markdown ?? "",
    sectionsString,
    validated.meta_title ?? "",
    validated.meta_description ?? "",
    isPub
  );

  return getPageBySlug(validated.slug)!;
}

export function deletePage(slugOrId: string | number): boolean {
  const db = getDb();
  let res;
  if (typeof slugOrId === "number" || /^\d+$/.test(String(slugOrId))) {
    res = db.prepare("DELETE FROM site_pages WHERE id = ?").run(Number(slugOrId));
  } else {
    res = db.prepare("DELETE FROM site_pages WHERE slug = ?").run(String(slugOrId).trim().toLowerCase());
  }
  return res.changes > 0;
}

/** Fallback generator ensuring zero regressions if DB table is unpopulated or missing page */
export function getPageOrDefault(slug: string, defaults?: Partial<SitePage>): SitePage {
  const cleanSlug = slug.trim().toLowerCase();
  const fromDb = getPageBySlug(cleanSlug);
  if (fromDb) return fromDb;

  return {
    id: 0,
    slug: cleanSlug,
    title: defaults?.title || cleanSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    eyebrow: defaults?.eyebrow || "",
    headline: defaults?.headline || "",
    subtitle: defaults?.subtitle || "",
    hero_image_url: defaults?.hero_image_url || "",
    hero_media_id: null,
    body_markdown: defaults?.body_markdown || "",
    sections_json: defaults?.sections_json || "[]",
    meta_title: defaults?.meta_title || defaults?.title || "",
    meta_description: defaults?.meta_description || defaults?.subtitle || "",
    is_published: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sections: defaults?.sections || [],
  };
}
