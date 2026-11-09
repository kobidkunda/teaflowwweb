import { HOME_TRIAL_DEFAULTS } from "./homeTrialsPresentation";
import { getDb } from "@/lib/db";
import { homepageSchema, type HomepageContent } from "@/lib/homepageSchema";
export const HOMEPAGE_CONTENT_KEY = "homepage_content_v1";

/** No hardcoded editorial fallback: absent/invalid content renders a safe empty state. */
export function getHomepageContent(): HomepageContent | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM store_settings WHERE key=?")
      .get(HOMEPAGE_CONTENT_KEY) as { value: string } | undefined;
    if (!row) return null;
    const raw = JSON.parse(row.value);

    // If story exists, populate collage/scenic values from site_placements if unset
    if (raw && typeof raw === "object" && raw.story && typeof raw.story === "object") {
      try {
        const topPlacement = db.prepare("SELECT image_url, alt_text FROM site_placements WHERE section_key='home_story_collage_top'").get() as { image_url: string; alt_text: string } | undefined;
        const botPlacement = db.prepare("SELECT image_url, alt_text FROM site_placements WHERE section_key='home_story_collage_bot'").get() as { image_url: string; alt_text: string } | undefined;
        const scenicPlacement = db.prepare("SELECT image_url, alt_text, title, subtitle, cta_label FROM site_placements WHERE section_key='home_story'").get() as { image_url: string; alt_text: string; title?: string; subtitle?: string; cta_label?: string } | undefined;

        if (!raw.story.collage_top_image_url && topPlacement?.image_url) {
          raw.story.collage_top_image_url = topPlacement.image_url;
          raw.story.collage_top_image_alt = topPlacement.alt_text || "Hands holding freshly harvested organic tea leaves";
        }
        if (!raw.story.collage_bottom_image_url && botPlacement?.image_url) {
          raw.story.collage_bottom_image_url = botPlacement.image_url;
          raw.story.collage_bottom_image_alt = botPlacement.alt_text || "Fresh white camellia sinensis tea blossom";
        }
        if (!raw.story.scenic_tag && scenicPlacement?.subtitle) {
          raw.story.scenic_tag = scenicPlacement.subtitle;
        }
        if (!raw.story.scenic_title && scenicPlacement?.title) {
          raw.story.scenic_title = scenicPlacement.title;
        }
        if (!raw.story.scenic_cta_label && scenicPlacement?.cta_label) {
          raw.story.scenic_cta_label = scenicPlacement.cta_label;
        }
        if (!raw.story.image_url && scenicPlacement?.image_url) {
          raw.story.image_url = scenicPlacement.image_url;
          raw.story.image_alt = scenicPlacement.alt_text || "Himalayan tea plantation slopes";
        }
      } catch {}
    }

    const parsed = homepageSchema.safeParse(raw);
    if (!parsed.success) return null;
    if (!parsed.data.trials) {
      parsed.data.trials = { ...HOME_TRIAL_DEFAULTS };
    }
    return parsed.data;
  } catch { return null; }
}

export function saveHomepageContent(value: unknown): HomepageContent {
  const content = homepageSchema.parse(value);
  const db = getDb();
  db.prepare(`INSERT INTO store_settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
    .run(HOMEPAGE_CONTENT_KEY, JSON.stringify(content));

  // Keep site_placements synchronized with homepage story edits
  if (content.story) {
    try {
      if (content.story.image_url) {
        db.prepare(`INSERT INTO site_placements (section_key, image_url, alt_text, title, subtitle, cta_label, updated_at)
          VALUES ('home_story', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(section_key) DO UPDATE SET
            image_url=excluded.image_url,
            alt_text=excluded.alt_text,
            title=COALESCE(excluded.title, site_placements.title),
            subtitle=COALESCE(excluded.subtitle, site_placements.subtitle),
            cta_label=COALESCE(excluded.cta_label, site_placements.cta_label),
            updated_at=CURRENT_TIMESTAMP`)
          .run(
            content.story.image_url,
            content.story.image_alt || "Scenic Himalayan tea estate",
            content.story.scenic_title || null,
            content.story.scenic_tag || null,
            content.story.scenic_cta_label || null
          );
      }
      if (content.story.collage_top_image_url) {
        db.prepare(`INSERT INTO site_placements (section_key, image_url, alt_text, updated_at)
          VALUES ('home_story_collage_top', ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(section_key) DO UPDATE SET
            image_url=excluded.image_url,
            alt_text=excluded.alt_text,
            updated_at=CURRENT_TIMESTAMP`)
          .run(
            content.story.collage_top_image_url,
            content.story.collage_top_image_alt || "Hands holding freshly harvested organic tea leaves"
          );
      }
      if (content.story.collage_bottom_image_url) {
        db.prepare(`INSERT INTO site_placements (section_key, image_url, alt_text, updated_at)
          VALUES ('home_story_collage_bot', ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(section_key) DO UPDATE SET
            image_url=excluded.image_url,
            alt_text=excluded.alt_text,
            updated_at=CURRENT_TIMESTAMP`)
          .run(
            content.story.collage_bottom_image_url,
            content.story.collage_bottom_image_alt || "Fresh white camellia sinensis tea blossom"
          );
      }
    } catch {}
  }

  return content;
}

/** Draft quotes remain private to the authenticated editor, including RSC payloads. */
export function getStorefrontHomepageContent(): HomepageContent | null {
  const content = getHomepageContent();
  if (!content) return null;
  return { ...content, ...(content.reviews ? { reviews: { ...content.reviews,
    entries: content.reviews.entries.filter((entry) => entry.approved) } } : {}) };
}
