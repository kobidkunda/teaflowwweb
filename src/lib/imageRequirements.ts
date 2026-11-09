/**
 * Himalayan Tea House — Storefront Image Dimension Specifications & Requirements
 * Single source of truth for required image dimensions, aspect ratios, min/max bounds,
 * and format rules across all storefront entities, sliders, placements, and blogs.
 */

export interface ImageDimensionSpec {
  entity_type: "product" | "category" | "slider" | "site_placement" | "blog" | "page";
  section_key?: string;
  name: string;
  recommended_width: number;
  recommended_height: number;
  aspect_ratio: string;
  aspect_ratio_decimal: number;
  min_width: number;
  min_height: number;
  max_width: number;
  max_height: number;
  max_file_size_mb: number;
  allowed_mime_types: readonly string[];
  recommended_format: string;
  description: string;
  display_locations: string[];
}

export interface DimensionMatchResult {
  matches_recommended_ratio: boolean;
  meets_minimum_dimensions: boolean;
  ratio_deviation_percent: number;
  status: "optimal" | "acceptable" | "suboptimal" | "unknown";
  feedback: string;
}

export const COMMON_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const IMAGE_DIMENSION_SPECS: Record<string, ImageDimensionSpec> = {
  // 1. Product Photography
  product: {
    entity_type: "product",
    name: "Product Packshot & Gallery Photography",
    recommended_width: 1200,
    recommended_height: 1200,
    aspect_ratio: "1:1",
    aspect_ratio_decimal: 1.0,
    min_width: 800,
    min_height: 800,
    max_width: 2400,
    max_height: 2400,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Square whole-leaf catalogue photography and packaging assets. Used for zoomable PDP galleries, tasting notes cupping sheets (dry leaf, wet leaf, liquor, estate), shop cards, and cart items.",
    display_locations: [
      "Product Detail Page Zoom Gallery (/tea/[slug])",
      "Catalog Grid & Tasting Dossier (/shop)",
      "Connoisseur Cupping Sheet & Terroir Dossier",
      "Slide-Over Cart & Order Summary",
      "Google Merchant & Meta Product Feeds",
    ],
  },

  // 2. Category Covers & Navigation
  category: {
    entity_type: "category",
    name: "Category Cover Banners & Navigation Circulars",
    recommended_width: 1200,
    recommended_height: 800,
    aspect_ratio: "3:2 / 4:3 (Cards) or 1:1 (Circle Strip)",
    aspect_ratio_decimal: 1.5,
    min_width: 400,
    min_height: 400,
    max_width: 2400,
    max_height: 1600,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Cover imagery for collection archive headers, category grid cards (rendered aspect-4/3), and homepage circular navigation ribbon items (rendered 96x96 circle).",
    display_locations: [
      "Collection Pages (/collections/[slug])",
      "Homepage Category Circular Strip",
      "Admin Category Tree & Hierarchy View",
    ],
  },

  // 3. Homepage Editorial Sliders
  slider: {
    entity_type: "slider",
    name: "Homepage Editorial Hero Sliders & Campaigns",
    recommended_width: 1920,
    recommended_height: 800,
    aspect_ratio: "2.4:1 / 16:9",
    aspect_ratio_decimal: 2.4,
    min_width: 1280,
    min_height: 600,
    max_width: 2560,
    max_height: 1200,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Ultra-wide panoramic scenic photography of Himalayan tea gardens at sunrise, seasonal flushes, or promotional campaign banners.",
    display_locations: [
      "Storefront Homepage Hero Carousel (/)",
      "Promotional Campaign Banners",
    ],
  },
  "slider:fg": {
    entity_type: "slider",
    name: "Homepage Slider Foreground Card Photography",
    recommended_width: 800,
    recommended_height: 500,
    aspect_ratio: "16:10 / 8:5",
    aspect_ratio_decimal: 1.6,
    min_width: 400,
    min_height: 250,
    max_width: 1600,
    max_height: 1000,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Featured foreground card photography of tea plucking in emerald gardens, artisanal tasting ceremony, or master planter crafts.",
    display_locations: [
      "Storefront Homepage Hero Foreground Card (/)",
      "Featured Origin Story Cards",
    ],
  },

  // 4. Educational Blog & Journal Covers
  blog: {
    entity_type: "blog",
    name: "Tea Academy & Educational Journal Cover",
    recommended_width: 1200,
    recommended_height: 675,
    aspect_ratio: "16:9 (Widescreen) / 1.91:1 (Social OG)",
    aspect_ratio_decimal: 1.778,
    min_width: 800,
    min_height: 450,
    max_width: 2400,
    max_height: 1350,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Editorial cover imagery for tea education masterclasses, brewing guides, harvest histories, and OpenGraph social preview cards.",
    display_locations: [
      "Tea Knowledge Masterclass Hub (/learn)",
      "Article Detail View (/learn/[slug])",
      "OpenGraph / Twitter Social Sharing Previews",
    ],
  },

  // 5. Site Placements — Dedicated Section Keys
  "site_placement:home_hero": {
    entity_type: "site_placement",
    section_key: "home_hero",
    name: "Storefront Hero Showcase Banner",
    recommended_width: 1920,
    recommended_height: 800,
    aspect_ratio: "2.4:1 / 16:9",
    aspect_ratio_decimal: 2.4,
    min_width: 1440,
    min_height: 600,
    max_width: 2560,
    max_height: 1200,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Full-bleed panoramic atmospheric background behind primary headline, harvesting pills, and call-to-action buttons.",
    display_locations: ["Storefront Homepage Main Hero (/)"],
  },

  "site_placement:home_story": {
    entity_type: "site_placement",
    section_key: "home_story",
    name: "Origin Bento Story Scenic Panel",
    recommended_width: 1200,
    recommended_height: 800,
    aspect_ratio: "3:2",
    aspect_ratio_decimal: 1.5,
    min_width: 600,
    min_height: 400,
    max_width: 2400,
    max_height: 1600,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Left landscape bento panel featuring estate slopes with scenic play overlay and origin philosophy copy.",
    display_locations: ["Storefront Homepage Bento Grid Origin Story Section"],
  },

  "site_placement:home_story_collage_top": {
    entity_type: "site_placement",
    section_key: "home_story_collage_top",
    name: "Bento Story Right Collage — Top Photo (Tea Plucking)",
    recommended_width: 800,
    recommended_height: 600,
    aspect_ratio: "4:3",
    aspect_ratio_decimal: 1.333,
    min_width: 400,
    min_height: 300,
    max_width: 1600,
    max_height: 1200,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Top half of the right-column photo collage in the homepage bento grid story section. Typically depicts hands holding freshly plucked tea leaves.",
    display_locations: ["Storefront Homepage Bento Grid — Right Collage Top (/)"],
  },

  "site_placement:home_story_collage_bot": {
    entity_type: "site_placement",
    section_key: "home_story_collage_bot",
    name: "Bento Story Right Collage — Bottom Photo (Blossom / Nature)",
    recommended_width: 800,
    recommended_height: 600,
    aspect_ratio: "4:3",
    aspect_ratio_decimal: 1.333,
    min_width: 400,
    min_height: 300,
    max_width: 1600,
    max_height: 1200,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Bottom half of the right-column photo collage in the homepage bento grid story section. Typically depicts a camellia sinensis blossom or close-up garden detail.",
    display_locations: ["Storefront Homepage Bento Grid — Right Collage Bottom (/)"],
  },

  "site_placement:home_craft": {
    entity_type: "site_placement",
    section_key: "home_craft",
    name: "Artisanal Craft & Steeping Ritual Panel",
    recommended_width: 1200,
    recommended_height: 800,
    aspect_ratio: "3:2",
    aspect_ratio_decimal: 1.5,
    min_width: 800,
    min_height: 600,
    max_width: 2400,
    max_height: 1600,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Editorial craft showcase depicting whole leaf sorting, orthodox withered leaves, or Gaiwan steeping rituals.",
    display_locations: ["Storefront Homepage Craft & Ritual Section"],
  },

  "site_placement:home_newsletter": {
    entity_type: "site_placement",
    section_key: "home_newsletter",
    name: "Tea Society Newsletter Community Artwork",
    recommended_width: 1200,
    recommended_height: 600,
    aspect_ratio: "2:1 (Banner) or 1:1 (Square)",
    aspect_ratio_decimal: 2.0,
    min_width: 600,
    min_height: 600,
    max_width: 2400,
    max_height: 1200,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Community invitation graphic with wax seal and authentic harvest dispatch stamp.",
    display_locations: ["Storefront Homepage Tea Society Newsletter Strip"],
  },

  "site_placement:home_values": {
    entity_type: "site_placement",
    section_key: "home_values",
    name: "Direct Garden Sourcing Assurance",
    recommended_width: 800,
    recommended_height: 800,
    aspect_ratio: "1:1 (Square) or 4:3",
    aspect_ratio_decimal: 1.0,
    min_width: 400,
    min_height: 400,
    max_width: 1600,
    max_height: 1600,
    max_file_size_mb: 5,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description:
      "Supporting illustration or photo reinforcing fair garden trade, zero middlemen, and truthful batch provenance.",
    display_locations: ["Storefront Homepage Direct Origin Values Pillar"],
  },

  page: {
    entity_type: "page",
    name: "Editorial Page Hero & Feature Banner",
    recommended_width: 1920,
    recommended_height: 1080,
    aspect_ratio: "16:9",
    aspect_ratio_decimal: 1.78,
    min_width: 800,
    min_height: 450,
    max_width: 3840,
    max_height: 2160,
    max_file_size_mb: 8,
    allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
    recommended_format: "image/webp",
    description: "High-resolution hero and editorial banners for custom and content pages (About, Brand, Leaf to Cup, Wholesale, etc.).",
    display_locations: ["Content Pages (/about, /brand, /leaf-to-cup, /pages/[slug])"],
  },
};

/**
 * Returns required image specifications matching optional entity type or site placement section key.
 */
export function getImageRequirements(filter?: {
  entity_type?: string;
  section_key?: string;
}): {
  selected?: ImageDimensionSpec | null;
  slots: ImageDimensionSpec[];
  general_rules: {
    max_file_size_mb: number;
    allowed_mime_types: readonly string[];
    security_rules: string[];
  };
} {
  const allSpecs = Object.values(IMAGE_DIMENSION_SPECS);
  let selected: ImageDimensionSpec | null = null;

  if (filter?.section_key) {
    const key = `site_placement:${filter.section_key}`;
    selected = IMAGE_DIMENSION_SPECS[key] || IMAGE_DIMENSION_SPECS["site_placement:home_hero"] || null;
  } else if (filter?.entity_type) {
    if (filter.entity_type === "site_placement") {
      selected = IMAGE_DIMENSION_SPECS["site_placement:home_hero"];
    } else {
      selected = IMAGE_DIMENSION_SPECS[filter.entity_type] || null;
    }
  }

  return {
    selected,
    slots: allSpecs,
    general_rules: {
      max_file_size_mb: 5,
      allowed_mime_types: COMMON_ALLOWED_MIME_TYPES,
      security_rules: [
        "SVG uploads are strictly disallowed to prevent stored XSS.",
        "MIME type and file signature magic-bytes are verified cryptographically.",
        "Images exceeding 5MB are rejected with HTTP 413.",
        "WebP format is strongly recommended for high fidelity and compression.",
      ],
    },
  };
}

/**
 * Retrieves the specific image dimension requirements for a target entity and optional ID/section key.
 */
export function getRequiredDimensionsForEntity(
  entityType: string,
  entityId?: string | number
): ImageDimensionSpec {
  if (entityType === "site_placement" && entityId) {
    const placementKey = `site_placement:${String(entityId)}`;
    if (IMAGE_DIMENSION_SPECS[placementKey]) {
      return IMAGE_DIMENSION_SPECS[placementKey];
    }
  }
  if (entityType === "slider" && (entityId === "fg" || entityId === "card")) {
    return IMAGE_DIMENSION_SPECS["slider:fg"];
  }
  if (IMAGE_DIMENSION_SPECS[entityType]) {
    return IMAGE_DIMENSION_SPECS[entityType];
  }
  // Default to product spec if unrecognized
  return IMAGE_DIMENSION_SPECS.product;
}

/**
 * Verifies if an asset's width and height match the recommended aspect ratio and resolution.
 */
export function checkDimensionMatch(
  spec: ImageDimensionSpec,
  width: number | null,
  height: number | null
): DimensionMatchResult {
  if (!width || !height || width <= 0 || height <= 0) {
    return {
      matches_recommended_ratio: false,
      meets_minimum_dimensions: false,
      ratio_deviation_percent: 0,
      status: "unknown",
      feedback: "Image dimensions could not be detected from buffer.",
    };
  }

  const actualRatio = width / height;
  const targetRatio = spec.aspect_ratio_decimal;
  const ratioDeviation = Math.abs(actualRatio - targetRatio) / targetRatio;
  const meetsMin = width >= spec.min_width && height >= spec.min_height;
  const ratioMatches = ratioDeviation <= 0.15; // Within 15% tolerance

  let status: "optimal" | "acceptable" | "suboptimal" = "suboptimal";
  let feedback = "";

  if (ratioMatches && meetsMin) {
    status = ratioDeviation <= 0.05 ? "optimal" : "acceptable";
    feedback = `Optimal fit for ${spec.name}: ${width}x${height} matches recommended ${spec.aspect_ratio} aspect ratio.`;
  } else if (!meetsMin) {
    feedback = `Resolution is below minimum ${spec.min_width}x${spec.min_height} (detected ${width}x${height}). Visuals may appear pixelated.`;
  } else {
    feedback = `Aspect ratio deviation (${actualRatio.toFixed(2)} vs target ${targetRatio.toFixed(2)}): image may be cropped to fit ${spec.aspect_ratio}.`;
  }

  return {
    matches_recommended_ratio: ratioMatches,
    meets_minimum_dimensions: meetsMin,
    ratio_deviation_percent: Math.round(ratioDeviation * 100),
    status,
    feedback,
  };
}

/**
 * Evaluates which storefront slots an uploaded image with given dimensions can be used in.
 */
export function getCompatibleSlots(
  width: number | null,
  height: number | null
): Array<{
  slot: string;
  name: string;
  recommended: string;
  suitability: "optimal" | "acceptable" | "suboptimal";
  notes: string;
}> {
  if (!width || !height) {
    return [];
  }

  const results: Array<{
    slot: string;
    name: string;
    recommended: string;
    suitability: "optimal" | "acceptable" | "suboptimal";
    notes: string;
  }> = [];

  for (const [key, spec] of Object.entries(IMAGE_DIMENSION_SPECS)) {
    const evalResult = checkDimensionMatch(spec, width, height);
    if (evalResult.status === "optimal" || evalResult.status === "acceptable") {
      results.push({
        slot: key,
        name: spec.name,
        recommended: `${spec.recommended_width}x${spec.recommended_height} (${spec.aspect_ratio})`,
        suitability: evalResult.status,
        notes: evalResult.feedback,
      });
    }
  }

  // If no optimal/acceptable slots found, report closest with warnings
  if (results.length === 0) {
    for (const [key, spec] of Object.entries(IMAGE_DIMENSION_SPECS)) {
      results.push({
        slot: key,
        name: spec.name,
        recommended: `${spec.recommended_width}x${spec.recommended_height} (${spec.aspect_ratio})`,
        suitability: "suboptimal",
        notes: `Detected ${width}x${height}. May be scaled or letterboxed to fit ${spec.aspect_ratio}.`,
      });
    }
  }

  return results;
}
