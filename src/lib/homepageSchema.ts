import { z } from "zod";
import { HOME_TRIAL_DEFAULTS } from "./homeTrialsPresentation";

import { isValidVideoUrl } from "./videoUtils";

// Local URLs only: content editors cannot inject schemes, protocol-relative URLs,
// control characters or escaping backslashes into storefront links or images.
export const homepagePath = z.string().max(500).refine(
  (value) => value === "" || (/^\/(?!\/)/.test(value) && !/[\\\s\u0000-\u001f]/.test(value)),
  "Use a local path beginning with /.",
);

export const videoUrlSchema = z.string().trim().max(1000).refine(
  (value) => value === "" || isValidVideoUrl(value),
  "Enter a valid YouTube video link, shorts URL, video embed URL, or local video path.",
);

const text = z.string().trim().max(500);
const link = z.object({ label: text, href: homepagePath }).strict();
export const homepageSchema = z.object({
  brand: text.min(1), tagline: text,
  navigation: z.array(link).max(8), footer_links: z.array(link).max(8),
  hero: z.object({ eyebrow: text, title: text, emphasis: text, description: text,
    image_url: homepagePath, image_alt: text, primary: link, secondary: link }).strict(),
  discovery: z.object({ eyebrow: text, title: text, emphasis: text, description: text,
    tiles: z.array(z.object({ category_id: z.number().int().positive(), eyebrow: text,
      title: text, image_url: homepagePath, image_alt: text, cta_label: text,
      tone: z.enum(["dark", "light"]) }).strict()).max(4) }).strict(),
  shelf: z.object({ eyebrow: text, title: text, emphasis: text, cta: link,
    empty_title: text, empty_description: text,
    fallback_image_url: homepagePath, fallback_image_alt: text }).strict(),
  trials: z.object({
    enabled: z.boolean().default(true),
    eyebrow: text.default(HOME_TRIAL_DEFAULTS.eyebrow),
    title: text.default(HOME_TRIAL_DEFAULTS.title),
    emphasis: text.default(HOME_TRIAL_DEFAULTS.emphasis),
    description: text.default(HOME_TRIAL_DEFAULTS.description),
    badge_text: text.default(HOME_TRIAL_DEFAULTS.badge_text),
    cta: link.default(HOME_TRIAL_DEFAULTS.cta),
    title_suffix: text.default(HOME_TRIAL_DEFAULTS.title_suffix),
    image_url: homepagePath.default(HOME_TRIAL_DEFAULTS.image_url),
    mobile_image_url: homepagePath.default(HOME_TRIAL_DEFAULTS.mobile_image_url),
    image_alt: text.default(HOME_TRIAL_DEFAULTS.image_alt),
    image_caption: text.default(HOME_TRIAL_DEFAULTS.image_caption),
    supporting_text: text.default(HOME_TRIAL_DEFAULTS.supporting_text),
    trial_slug: text.optional(),
  }).strict().optional(),
  story: z.object({ eyebrow: text, title: text, emphasis: text, description: text,
    image_url: homepagePath, image_alt: text, caption: text, cta: link,
    video_url: videoUrlSchema.optional(), video_title: text.optional(),
    scenic_tag: text.optional(), scenic_title: text.optional(), scenic_cta_label: text.optional(),
    collage_top_image_url: homepagePath.optional(), collage_top_image_alt: text.optional(),
    collage_bottom_image_url: homepagePath.optional(), collage_bottom_image_alt: text.optional(),
    banner_words: z.array(text).max(5).optional() }).strict().optional(),
  benefits: z.array(z.object({ icon: z.enum(["leaf", "mountain", "cup", "heart"]),
    title: text, description: text }).strict()).max(4).optional(),
  reviews: z.object({ eyebrow: text, title: text, emphasis: text, empty_title: text,
    empty_description: text, cta: link,
    entries: z.array(z.object({ quote: text.min(1), attribution: text.min(1),
      approved: z.boolean() }).strict()).max(6) }).strict().optional(),
  newsletter: z.object({ enabled: z.boolean(), eyebrow: text, title: text,
    description: text, image_url: homepagePath, image_alt: text, email_label: text,
    placeholder: text, button_label: text, consent_label: text, privacy: link,
    pending_label: text, success_message: text, error_message: text }).strict().optional(),
  disclosure: text, footer_text: text,
}).strict();
export type HomepageContent = z.infer<typeof homepageSchema>;
