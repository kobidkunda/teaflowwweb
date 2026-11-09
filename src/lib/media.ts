import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { getUploadsDir } from "@/lib/uploads";

export interface MediaAsset {
  id: number;
  filename: string;
  original_name: string;
  url: string;
  mime_type: string;
  file_size: number;
  size_bytes?: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  caption: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SitePlacement {
  section_key: string;
  media_id: number | null;
  image_url: string;
  alt_text: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  updated_at: string;
}

export interface MediaReferenceCheckResult {
  inUse: boolean;
  totalReferences: number;
  breakdown: {
    productImages: number;
    categories: number;
    sliders: number;
    blogPosts: number;
    sitePlacements: number;
    sitePages?: number;
  };
}

export interface ListMediaParams {
  cursor?: number;
  limit?: number;
  search?: string;
  mime_type?: string;
}

export type PaginatedMediaList = MediaAsset[] & {
  items: MediaAsset[];
  total: number;
  nextCursor?: number | null;
};

/**
 * Checks whether a given media asset ID or URL is currently referenced by any
 * catalog or site entity: product_images, categories, sliders, blog_posts, or site_placements.
 */
export function checkMediaReferences(id: number, url?: string): MediaReferenceCheckResult {
  const db = getDb();
  let mediaUrl = url;
  if (!mediaUrl) {
    const row = db.prepare("SELECT url FROM media_uploads WHERE id = ?").get(id) as
      | { url: string }
      | undefined;
    mediaUrl = row?.url || "";
  }
  const hasUrl = !!(mediaUrl && mediaUrl.trim().length > 0);

  let prodImgs = 0;
  try {
    prodImgs = hasUrl
      ? (
          db
            .prepare("SELECT COUNT(*) AS n FROM product_images WHERE media_id = ? OR url = ?")
            .get(id, mediaUrl) as { n: number }
        ).n
      : (
          db
            .prepare("SELECT COUNT(*) AS n FROM product_images WHERE media_id = ?")
            .get(id) as { n: number }
        ).n;
  } catch {
    /* ignore if table absent */
  }

  let cats = 0;
  try {
    cats = hasUrl
      ? (
          db
            .prepare(
              "SELECT COUNT(*) AS n FROM categories WHERE media_id = ? OR cover_image_url = ?"
            )
            .get(id, mediaUrl) as { n: number }
        ).n
      : (
          db
            .prepare("SELECT COUNT(*) AS n FROM categories WHERE media_id = ?")
            .get(id) as { n: number }
        ).n;
  } catch {
    /* ignore if table absent */
  }

  let slides = 0;
  try {
    const cols = new Set(
      (db.prepare("PRAGMA table_info(sliders)").all() as Array<{ name: string }>).map((c) => c.name)
    );
    const hasFg = cols.has("fg_media_id") && cols.has("fg_image_url");
    if (hasFg) {
      slides = hasUrl
        ? (
            db
              .prepare(
                "SELECT COUNT(*) AS n FROM sliders WHERE media_id = ? OR fg_media_id = ? OR image_url = ? OR fg_image_url = ?"
              )
              .get(id, id, mediaUrl, mediaUrl) as { n: number }
          ).n
        : (
            db
              .prepare("SELECT COUNT(*) AS n FROM sliders WHERE media_id = ? OR fg_media_id = ?")
              .get(id, id) as { n: number }
          ).n;
    } else {
      slides = hasUrl
        ? (
            db
              .prepare("SELECT COUNT(*) AS n FROM sliders WHERE media_id = ? OR image_url = ?")
              .get(id, mediaUrl) as { n: number }
          ).n
        : (
            db
              .prepare("SELECT COUNT(*) AS n FROM sliders WHERE media_id = ?")
              .get(id) as { n: number }
          ).n;
    }
  } catch {
    /* ignore if table absent */
  }

  let blogPosts = 0;
  try {
    blogPosts = hasUrl
      ? (
          db
            .prepare(
              "SELECT COUNT(*) AS n FROM blog_posts WHERE cover_media_id = ? OR cover_image_url = ?"
            )
            .get(id, mediaUrl) as { n: number }
        ).n
      : (
          db
            .prepare("SELECT COUNT(*) AS n FROM blog_posts WHERE cover_media_id = ?")
            .get(id) as { n: number }
        ).n;
  } catch {
    /* ignore if table absent */
  }

  let placements = 0;
  try {
    placements = hasUrl
      ? (
          db
            .prepare(
              "SELECT COUNT(*) AS n FROM site_placements WHERE media_id = ? OR (image_url != '' AND image_url = ?)"
            )
            .get(id, mediaUrl) as { n: number }
        ).n
      : (
          db
            .prepare("SELECT COUNT(*) AS n FROM site_placements WHERE media_id = ?")
            .get(id) as { n: number }
        ).n;
  } catch {
    /* ignore if table absent */
  }

  let sitePages = 0;
  try {
    sitePages = hasUrl
      ? (
          db
            .prepare(
              "SELECT COUNT(*) AS n FROM site_pages WHERE hero_media_id = ? OR (hero_image_url != '' AND hero_image_url = ?)"
            )
            .get(id, mediaUrl) as { n: number }
        ).n
      : (
          db
            .prepare("SELECT COUNT(*) AS n FROM site_pages WHERE hero_media_id = ?")
            .get(id) as { n: number }
        ).n;
  } catch {
    /* ignore if table absent */
  }

  const total = prodImgs + cats + slides + blogPosts + placements + sitePages;
  return {
    inUse: total > 0,
    totalReferences: total,
    breakdown: {
      productImages: prodImgs,
      categories: cats,
      sliders: slides,
      blogPosts,
      sitePlacements: placements,
      sitePages,
    },
  };
}

/**
 * Safely deletes a media upload record from the database and unlinks the physical file
 * from public/uploads/. Rejects with a descriptive error if the asset is referenced.
 */
export function deleteMediaUploadSync(
  id: number
): { success: boolean; filename: string } {
  const db = getDb();
  const media = db
    .prepare("SELECT * FROM media_uploads WHERE id = ?")
    .get(id) as MediaAsset | undefined;

  if (!media) {
    throw new Error("Media asset not found.");
  }

  const refCheck = checkMediaReferences(id, media.url);
  if (refCheck.inUse) {
    throw new Error(
      `Cannot delete media asset: currently referenced by ${refCheck.totalReferences} active entity record(s). Remove all references first.`
    );
  }

  db.prepare("DELETE FROM media_uploads WHERE id = ?").run(id);

  const filePath = path.join(getUploadsDir(), media.filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    /* Best effort file unlink */
  }

  return { success: true, filename: media.filename };
}

export async function deleteMediaUpload(
  id: number
): Promise<{ success: boolean; filename: string }> {
  return deleteMediaUploadSync(id);
}

/**
 * Lists media uploads with optional search, MIME filtering, and cursor pagination.
 * Result is both an Array and an object containing { items, total, nextCursor }.
 */
export function listMedia(params: ListMediaParams = {}): PaginatedMediaList {
  const db = getDb();
  const limit = Math.min(Math.max(1, params.limit ?? 50), 100);
  const clauses: string[] = [];
  const queryParams: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    clauses.push(
      "(filename LIKE ? OR original_name LIKE ? OR alt_text LIKE ? OR caption LIKE ?)"
    );
    queryParams.push(s, s, s, s);
    countParams.push(s, s, s, s);
  }

  if (params.mime_type) {
    clauses.push("mime_type = ?");
    queryParams.push(params.mime_type);
    countParams.push(params.mime_type);
  }

  const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM media_uploads${whereClause}`)
      .get(...countParams) as { n: number }
  ).n;

  if (params.cursor !== undefined && params.cursor > 0) {
    clauses.push("id < ?");
    queryParams.push(params.cursor);
  }

  const filterWhere = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  queryParams.push(limit);

  const rows = db
    .prepare(
      `SELECT * FROM media_uploads${filterWhere} ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(...queryParams) as MediaAsset[];

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  const result = rows as PaginatedMediaList;
  result.items = rows;
  result.total = total;
  result.nextCursor = nextCursor;

  return result;
}

/**
 * Retrieves a single media upload by ID.
 */
export function getMediaById(id: number): MediaAsset | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM media_uploads WHERE id = ?")
    .get(id) as MediaAsset | undefined;
  return row || null;
}

/**
 * Updates metadata (alt_text, caption, sort_order) for a media asset.
 */
export function updateMediaMetadata(
  id: number,
  data: { alt_text?: string; caption?: string; sort_order?: number }
): MediaAsset {
  const db = getDb();
  const existing = getMediaById(id);
  if (!existing) {
    throw new Error("Media asset not found.");
  }

  const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const params: (string | number)[] = [];

  if (data.alt_text !== undefined) {
    sets.push("alt_text = ?");
    params.push(data.alt_text.trim());
  }
  if (data.caption !== undefined) {
    sets.push("caption = ?");
    params.push(data.caption.trim());
  }
  if (data.sort_order !== undefined) {
    sets.push("sort_order = ?");
    params.push(Number(data.sort_order));
  }

  params.push(id);
  db.prepare(`UPDATE media_uploads SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  return getMediaById(id)!;
}

/**
 * Retrieves a single site placement by section key.
 */
export function getSitePlacement(sectionKey: string): SitePlacement | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM site_placements WHERE section_key = ?")
    .get(sectionKey) as SitePlacement | undefined;
  return row || null;
}

/**
 * Lists all site placements ordered by section key.
 */
export function listSitePlacements(): SitePlacement[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM site_placements ORDER BY section_key ASC")
    .all() as SitePlacement[];
}

/**
 * Upserts a site placement record.
 */
export function upsertSitePlacement(placement: {
  section_key: string;
  media_id?: number | null;
  image_url?: string;
  alt_text?: string;
  title?: string;
  subtitle?: string;
  cta_label?: string;
  cta_href?: string;
}): SitePlacement {
  const db = getDb();
  const cleanKey = placement.section_key.trim();
  const mediaId = placement.media_id ?? null;
  const imageUrl = placement.image_url?.trim() ?? "";
  const altText = placement.alt_text?.trim() ?? "";
  const title = placement.title?.trim() ?? "";
  const subtitle = placement.subtitle?.trim() ?? "";
  const ctaLabel = placement.cta_label?.trim() ?? "";
  const ctaHref = placement.cta_href?.trim() ?? "";

  db.prepare(`
    INSERT INTO site_placements (section_key, media_id, image_url, alt_text, title, subtitle, cta_label, cta_href, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(section_key) DO UPDATE SET
      media_id = excluded.media_id,
      image_url = excluded.image_url,
      alt_text = excluded.alt_text,
      title = excluded.title,
      subtitle = excluded.subtitle,
      cta_label = excluded.cta_label,
      cta_href = excluded.cta_href,
      updated_at = CURRENT_TIMESTAMP
  `).run(cleanKey, mediaId, imageUrl, altText, title, subtitle, ctaLabel, ctaHref);

  return getSitePlacement(cleanKey)!;
}

export function deleteSitePlacement(sectionKey: string): boolean {
  const db = getDb();
  return db.prepare("DELETE FROM site_placements WHERE section_key = ?").run(sectionKey.trim()).changes > 0;
}
