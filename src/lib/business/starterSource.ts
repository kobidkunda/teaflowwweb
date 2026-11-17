import { getB2BPageContent, listAdminB2BClaims, listAdminB2BOffers, type B2BPageContentRecord } from "./repository";
import starterSource from "./starterSource.json";
import { sourceKey, type TextDict } from "./sourceKey";

const CONTENT_SCALARS = ["eyebrow", "headline", "intro", "primary_cta", "secondary_cta", "hero_image_alt", "process_intro", "proof_title", "proof_body", "form_heading", "form_subhead", "seo_title", "seo_description"] as const;
const CONTENT_LISTS = ["steps", "proof_items", "faq"] as const;

function leaves(value: unknown, out: string[]) {
  if (typeof value === "string") { if (value.trim()) out.push(value); }
  else if (Array.isArray(value)) value.forEach(v => leaves(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach(v => leaves(v, out));
}

/**
 * Source (English) for the `starter` resource: fixed UI copy extracted from the
 * components plus the English text admins edit in /admin/business (page content,
 * offers, claims). Keys are derived from the English text itself.
 */
export function starterTranslationSource(): Record<string, string> {
  const texts: Record<string, string> = { ...(starterSource as Record<string, string>) };
  const add = (en: unknown) => { if (typeof en === "string" && en.trim()) texts[sourceKey(en)] = en; };
  try {
    for (const segment of ["starter", "trader"] as const) {
      const c = getB2BPageContent(segment, "en");
      if (!c) continue;
      const found: string[] = [];
      for (const k of CONTENT_SCALARS) found.push(String(c[k] ?? ""));
      for (const k of CONTENT_LISTS) leaves(c[k], found);
      found.forEach(add);
    }
    for (const o of listAdminB2BOffers()) {
      [o.eyebrow_en, o.title_en, o.description_en, o.cta_label_en, o.image_alt_en, o.moq_text_en].forEach(add);
    }
    for (const c of listAdminB2BClaims()) add(c.exact_copy_en);
  } catch { /* Optional B2B tables may not exist in minimal databases. */ }
  return texts;
}

function mapLeaves<T>(value: T, t: (en: string) => string): T {
  if (typeof value === "string") return (value.trim() ? t(value) : value) as T;
  if (Array.isArray(value)) return value.map(v => mapLeaves(v, t)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapLeaves(v, t)])) as T;
  return value;
}

export function translateStarterContent(content: B2BPageContentRecord, t: (en: string) => string): B2BPageContentRecord {
  const copy = { ...content } as Record<string, unknown>;
  for (const k of CONTENT_SCALARS) copy[k] = mapLeaves(content[k], t);
  for (const k of CONTENT_LISTS) copy[k] = mapLeaves(content[k], t);
  return copy as unknown as B2BPageContentRecord;
}

export type { TextDict };
