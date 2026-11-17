/**
 * Idempotent, additive seed: copies the translations that used to be hardcoded
 * in code into commerce_translations so /admin/translations is the only source.
 * Existing published admin values always win; only missing keys are filled.
 *
 *   npx vite-node --config scripts/i18n/vite.config.mjs scripts/i18n/seed-builtin-translations.ts
 *   DATABASE_TYPE=postgres ...  (production, only when you deploy)
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { getDb } from "../../src/lib/db";
import { sourceFor } from "../../src/lib/international/translations";
import { hash } from "../../src/lib/international/quotes";
import { PAN_INDIA_ITEMS } from "../../src/lib/international/panIndiaDictionary";
import { traderDefaultTexts } from "../../src/lib/business/traderTranslations";
import { sourceKey } from "../../src/lib/business/sourceKey";

type Texts = Record<string, string>;
const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const db = getDb();
const report: string[] = [];

function publish(resource: string, locale: string, texts: Texts) {
  const source = sourceFor(resource);
  const wanted = Object.fromEntries(Object.entries(texts).filter(([k, v]) => v && source[k] !== undefined && v !== source[k]));
  if (!Object.keys(wanted).length) return;
  const row = db.prepare("SELECT * FROM commerce_translations WHERE resource=? AND locale=?").get(resource, locale) as
    | { id: string; source: string; published: string | null; revision: number } | undefined;
  const now = Date.now();
  if (!row) {
    const h = hash(source), doc = JSON.stringify(wanted);
    db.prepare("INSERT INTO commerce_translations (id,resource,locale,source_hash,source,draft,published,published_hash,revision,updated_ms) VALUES (?,?,?,?,?,?,?,?,1,?)")
      .run(randomUUID(), resource, locale, h, JSON.stringify(source), doc, doc, h, now);
    report.push(`${resource}/${locale}: inserted ${Object.keys(wanted).length}`);
    return;
  }
  const published: Texts = row.published ? JSON.parse(row.published) : {};
  const at: Texts = JSON.parse(row.source || "{}");
  let added = 0;
  for (const [k, v] of Object.entries(wanted)) {
    if (published[k]) continue; // admin value wins
    published[k] = v; at[k] = source[k]; added++;
  }
  if (!added) return;
  const doc = JSON.stringify(published);
  db.prepare("UPDATE commerce_translations SET source=?,draft=?,published=?,revision=?,updated_ms=? WHERE id=?")
    .run(JSON.stringify(at), doc, doc, row.revision + 1, now, row.id);
  report.push(`${resource}/${locale}: filled ${added}`);
}

// 1. Storefront interface (former panIndiaDictionary fallback)
for (const locale of ["hi", "bn", "pa", "mr", "gu", "ta", "te"] as const) {
  const t: Texts = {};
  for (const item of PAN_INDIA_ITEMS) { const v = item[locale]; t[item.id] = v; t[item.en] = v; }
  publish("interface", locale, t);
}

// 2a. Reviewed text overrides from the old Trade content tab win over built-in copy
try {
  const byLocale: Record<string, Texts> = {};
  for (const r of db.prepare("SELECT resource_key,locale,text_value FROM trade_localized_content WHERE review_status='reviewed'").all() as { resource_key: string; locale: string; text_value: string }[]) {
    if (r.locale !== "en" && r.text_value) (byLocale[r.locale] ||= {})[r.resource_key] = r.text_value;
  }
  for (const [locale, t] of Object.entries(byLocale)) publish("trade", locale, t);
} catch { /* optional table */ }
// 2b. Tea shops (former baseCopy / copy dictionaries)
const trade = read<{ locales: Record<string, Texts> }>("trade-translations.json");
for (const [locale, t] of Object.entries(trade.locales)) publish("trade", locale, t);

// 3. Tea traders Hindi
publish("tea-traders", "hi", traderDefaultTexts("hi", sourceFor("tea-traders")));

// 4. Start a tea business: static Hindi + Hindi columns admins entered in /admin/business
const starter = { ...read<Texts>("starter-hi.json") } as Texts;
const pair = (en: unknown, hi: unknown) => { if (typeof en === "string" && typeof hi === "string" && en.trim() && hi.trim() && en !== hi) starter[sourceKey(en)] ||= hi; };
function pairLeaves(en: unknown, hi: unknown) {
  if (typeof en === "string") pair(en, hi);
  else if (Array.isArray(en) && Array.isArray(hi)) en.forEach((v, i) => pairLeaves(v, hi[i]));
  else if (en && typeof en === "object" && hi && typeof hi === "object") for (const k of Object.keys(en)) pairLeaves((en as Texts)[k], (hi as Texts)[k]);
}
try {
  for (const segment of ["starter", "trader"]) {
    const e = db.prepare("SELECT * FROM b2b_page_content WHERE segment=? AND locale='en'").get(segment) as Record<string, unknown> | undefined;
    const h = db.prepare("SELECT * FROM b2b_page_content WHERE segment=? AND locale='hi'").get(segment) as Record<string, unknown> | undefined;
    if (!e || !h) continue;
    for (const k of ["eyebrow", "headline", "intro", "primary_cta", "secondary_cta", "hero_image_alt", "process_intro", "proof_title", "proof_body", "form_heading", "form_subhead", "seo_title", "seo_description"]) pair(e[k], h[k]);
    for (const k of ["steps_json", "proof_items_json", "faq_json"]) {
      try { pairLeaves(JSON.parse(String(e[k])), JSON.parse(String(h[k]))); } catch { /* column layout differs */ }
    }
  }
  for (const o of db.prepare("SELECT * FROM b2b_offers").all() as Record<string, unknown>[])
    for (const f of ["eyebrow", "title", "description", "cta_label", "image_alt", "moq_text"]) pair(o[`${f}_en`], o[`${f}_hi`]);
  for (const c of db.prepare("SELECT * FROM b2b_claims").all() as Record<string, unknown>[]) pair(c.exact_copy_en, c.exact_copy_hi);
} catch (e) { report.push(`starter dynamic pairs skipped: ${(e as Error).message}`); }
publish("starter", "hi", starter);

console.log(report.join("\n") || "Nothing to seed (already complete).");
