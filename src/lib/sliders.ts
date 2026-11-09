import { getDb } from "@/lib/db";
import { idempotent } from "@/lib/adminStore";
import type { SliderInput } from "@/lib/validation";
export type Slider = {
  id: number;
  title: string;
  subtitle: string;
  image_url: string;
  fg_image_url?: string;
  cta_label: string;
  cta_href: string;
  sort_order: number;
  is_active: number;
  starts_at: string | null;
  ends_at: string | null;
  media_id?: number | null;
  fg_media_id?: number | null;
  card_tag?: string;
  card_title?: string;
  card_subtitle?: string;
  card_tasting_notes?: string;
  card_quote?: string;
  card_badge?: string;
  card_cta_label?: string;
  card_cta_href?: string;
  card_enabled?: number;
  chapter_label?: string;
  page_target?: "home" | "shop" | "all";
  category_slug?: string;
  created_at: string;
};
export function listSliders(opts: {
  activeOnly?: boolean;
  limit?: number;
  cursor?: number;
  pageTarget?: "home" | "shop" | "all" | string;
  categorySlug?: string;
} = {}): Slider[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts.activeOnly) {
    clauses.push("is_active = 1");
    clauses.push("(starts_at IS NULL OR starts_at <= datetime('now'))");
    clauses.push("(ends_at IS NULL OR ends_at >= datetime('now'))");
  }
  if (opts.pageTarget) {
    if (opts.pageTarget === "home") {
      clauses.push("(page_target = 'home' OR page_target = 'all')");
    } else if (opts.pageTarget === "shop") {
      clauses.push("(page_target = 'shop' OR page_target = 'all')");
    } else {
      clauses.push("page_target = ?");
      params.push(opts.pageTarget);
    }
  }
  if (opts.categorySlug !== undefined && opts.categorySlug !== "") {
    clauses.push("(category_slug = ? OR category_slug = '' OR category_slug = 'all')");
    params.push(opts.categorySlug);
  }
  if (opts.cursor) { clauses.push("id > ?"); params.push(opts.cursor); }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  return getDb().prepare("SELECT * FROM sliders" + where + " ORDER BY sort_order ASC, id ASC LIMIT ?").all(...params, limit) as Slider[];
}
export function getSlider(id: number): Slider | null {
  return (getDb().prepare("SELECT * FROM sliders WHERE id=?").get(id) as Slider | undefined) ?? null;
}
export function createSlider(input: SliderInput): Slider {
  const bgImage = input.bg_image_url || input.image_url;
  const fgImage = input.card_image_url !== undefined ? input.card_image_url : (input.fg_image_url ?? "");
  const info = getDb().prepare(
    "INSERT INTO sliders (title, subtitle, image_url, fg_image_url, cta_label, cta_href, sort_order, is_active, starts_at, ends_at, media_id, fg_media_id, card_tag, card_title, card_subtitle, card_tasting_notes, card_quote, card_badge, card_cta_label, card_cta_href, card_enabled, chapter_label, page_target, category_slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    input.title,
    input.subtitle ?? "",
    bgImage,
    fgImage,
    input.cta_label ?? "",
    input.cta_href ?? "",
    input.sort_order ?? 0,
    input.is_active ?? 1,
    input.starts_at ?? null,
    input.ends_at ?? null,
    input.media_id ?? null,
    input.fg_media_id ?? null,
    input.card_tag ?? "",
    input.card_title ?? "",
    input.card_subtitle ?? "",
    input.card_tasting_notes ?? "",
    input.card_quote ?? "",
    input.card_badge ?? "",
    input.card_cta_label ?? "",
    input.card_cta_href ?? "",
    input.card_enabled ?? 1,
    input.chapter_label ?? "",
    input.page_target ?? "home",
    input.category_slug ?? ""
  );
  return getSlider(Number(info.lastInsertRowid))!;
}
export function updateSlider(id: number, input: Partial<SliderInput>): Slider | null {
  const db = getDb();
  const current = getSlider(id);
  if (!current) return null;

  const title = input.title !== undefined ? input.title : current.title;
  const subtitle = input.subtitle !== undefined ? input.subtitle : current.subtitle;
  const image_url = input.bg_image_url !== undefined
    ? input.bg_image_url
    : (input.image_url !== undefined ? input.image_url : current.image_url);
  const fg_image_url = input.card_image_url !== undefined
    ? input.card_image_url
    : (input.fg_image_url !== undefined ? input.fg_image_url : (current.fg_image_url ?? ""));
  const cta_label = input.cta_label !== undefined ? input.cta_label : current.cta_label;
  const cta_href = input.cta_href !== undefined ? input.cta_href : current.cta_href;
  const sort_order = input.sort_order !== undefined ? input.sort_order : current.sort_order;
  const is_active = input.is_active !== undefined ? input.is_active : current.is_active;
  const starts_at = input.starts_at !== undefined ? input.starts_at : current.starts_at;
  const ends_at = input.ends_at !== undefined ? input.ends_at : current.ends_at;
  const media_id = input.media_id !== undefined ? input.media_id : (current.media_id ?? null);
  const fg_media_id = input.fg_media_id !== undefined ? input.fg_media_id : (current.fg_media_id ?? null);

  const card_tag = input.card_tag !== undefined ? input.card_tag : (current.card_tag ?? "");
  const card_title = input.card_title !== undefined ? input.card_title : (current.card_title ?? "");
  const card_subtitle = input.card_subtitle !== undefined ? input.card_subtitle : (current.card_subtitle ?? "");
  const card_tasting_notes = input.card_tasting_notes !== undefined ? input.card_tasting_notes : (current.card_tasting_notes ?? "");
  const card_quote = input.card_quote !== undefined ? input.card_quote : (current.card_quote ?? "");
  const card_badge = input.card_badge !== undefined ? input.card_badge : (current.card_badge ?? "");
  const card_cta_label = input.card_cta_label !== undefined ? input.card_cta_label : (current.card_cta_label ?? "");
  const card_cta_href = input.card_cta_href !== undefined ? input.card_cta_href : (current.card_cta_href ?? "");
  const card_enabled = input.card_enabled !== undefined ? input.card_enabled : (current.card_enabled ?? 1);
  const chapter_label = input.chapter_label !== undefined ? input.chapter_label : (current.chapter_label ?? "");
  const page_target = input.page_target !== undefined ? input.page_target : (current.page_target ?? "home");
  const category_slug = input.category_slug !== undefined ? input.category_slug : (current.category_slug ?? "");

  db.prepare(
    "UPDATE sliders SET title=?, subtitle=?, image_url=?, fg_image_url=?, cta_label=?, cta_href=?, sort_order=?, is_active=?, starts_at=?, ends_at=?, media_id=?, fg_media_id=?, card_tag=?, card_title=?, card_subtitle=?, card_tasting_notes=?, card_quote=?, card_badge=?, card_cta_label=?, card_cta_href=?, card_enabled=?, chapter_label=?, page_target=?, category_slug=? WHERE id=?"
  ).run(
    title,
    subtitle,
    image_url,
    fg_image_url,
    cta_label,
    cta_href,
    sort_order,
    is_active,
    starts_at,
    ends_at,
    media_id,
    fg_media_id,
    card_tag,
    card_title,
    card_subtitle,
    card_tasting_notes,
    card_quote,
    card_badge,
    card_cta_label,
    card_cta_href,
    card_enabled,
    chapter_label,
    page_target,
    category_slug,
    id
  );
  return getSlider(id);
}
export function deleteSlider(id: number): boolean {
  return getDb().prepare("DELETE FROM sliders WHERE id=?").run(id).changes > 0;
}
// Canonical upsert: replays on idempotencyKey return the original row.
export function upsertSlider(input: SliderInput): { id: number; deduped: boolean } {
  const execute = () => {
    if (input.id) {
      const updated = updateSlider(input.id, input);
      if (updated) return { id: updated.id };
    }
    return { id: createSlider(input).id };
  };
  if (!input.idempotencyKey) return { ...execute(), deduped: false };
  const { body, deduped } = idempotent("slider", input.idempotencyKey, execute);
  return { ...body, deduped };
}
