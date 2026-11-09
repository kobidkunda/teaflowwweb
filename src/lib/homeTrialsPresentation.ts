import type { HomepageContent } from "./homepageSchema";

export const HOME_TRIAL_MEDIA_GUIDANCE = {
  desktop: { field: "trials.image_url", width: 1920, height: 720, aspect_ratio: "8:3", display: "Above 640 CSS pixels", crop: "Centered cover; keep all cups and pouches inside the frame." },
  mobile: { field: "trials.mobile_image_url", width: 960, height: 1080, aspect_ratio: "8:9", display: "640 CSS pixels and below", crop: "Use a separate 2×2 arrangement of four cup/pouch pairs. Do not crop the desktop strip." },
  format: "WebP or JPEG; preferably below 400 KB per image; existing uploader limit 5 MB.",
  text: "Upload artwork only, without headings, buttons or text. Copy is rendered as accessible HTML outside the image.",
  behavior: "Blank mobile image uses the desktop image. Blank desktop image uses mobile if provided; clear both to remove the artwork.",
  destination: "/trials",
} as const;

export const HOME_TRIAL_DEFAULTS = {
  enabled: true,
  eyebrow: "TEAFLOWW DISCOVERY KITS",
  title: "Find",
  emphasis: "your cup.",
  title_suffix: "Start with a sample.",
  description: "Small packs to explore. Different teas to compare. A favourite waiting to be found.",
  badge_text: "4 × 50g pouches · 200g per kit",
  cta: { label: "Explore all sample kits", href: "/trials" },
  image_url: "/images/trials/home-discovery-desktop.webp",
  mobile_image_url: "/images/trials/home-discovery-mobile.webp",
  image_alt: "Illustrative tasting table with four cups of milk chai and four tea pouches",
  image_caption: "Illustrative imagery",
  supporting_text: "See kit contents, current prices and brewing guides",
};

const legacyDescription = "Four 50g craft pouches from single Himalayan estates, sealed at origin in Siliguri. Cupping notes, water-to-leaf ratios, and brew guides included.";

/** Preserve operator copy; replace only exact original starter text. No storage mutation. */
export function homeTrialsPresentation(config?: Partial<NonNullable<HomepageContent["trials"]>>) {
  const legacyTitle = config?.title === "Taste Before You Commit" &&
    ["in your own cup.", "in your own kettle."].includes(config.emphasis || "");
  return {
    ...HOME_TRIAL_DEFAULTS,
    ...config,
    ...(legacyTitle ? { title: HOME_TRIAL_DEFAULTS.title, emphasis: HOME_TRIAL_DEFAULTS.emphasis, title_suffix: HOME_TRIAL_DEFAULTS.title_suffix } : {}),
    ...(config?.description === legacyDescription ? { description: HOME_TRIAL_DEFAULTS.description } : {}),
    cta: { label: config?.cta?.label === "Explore All Trial Flights" ? HOME_TRIAL_DEFAULTS.cta.label : (config?.cta?.label || HOME_TRIAL_DEFAULTS.cta.label), href: "/trials" },
  };
}
