import { getDb } from "@/lib/db";

export interface ContentBlock {
  key: string;
  content: string;
  content_type: string;
  description: string;
  updated_at: string;
}

export interface AnnouncementSettings {
  text: string;
  highlight: string;
  link_url: string;
  link_label: string;
  wholesale_label: string;
  enabled: boolean;
}

export interface UpdateAnnouncementInput {
  text?: string;
  highlight?: string;
  link_url?: string;
  linkUrl?: string;
  link_label?: string;
  linkLabel?: string;
  wholesale_label?: string;
  wholesaleLabel?: string;
  enabled?: boolean;
}

export interface NavLinkItem {
  label: string;
  href: string;
  highlight?: boolean;
}

export interface SiteNavigation {
  brand: string;
  tagline: string;
  header_links: NavLinkItem[];
  footer_links: NavLinkItem[];
  footer_text: string;
  footer_copyright: string;
  footer_disclosure: string;
}

export function getContentBlock(key: string, fallback: string = ""): string {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT content FROM site_content_blocks WHERE key = ?")
      .get(key.trim()) as { content: string } | undefined;
    return row ? row.content : fallback;
  } catch {
    return fallback;
  }
}

export function getContentBlockRecord(key: string): ContentBlock | null {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM site_content_blocks WHERE key = ?")
      .get(key.trim()) as ContentBlock | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

export function listContentBlocks(prefix?: string): ContentBlock[] {
  try {
    const db = getDb();
    if (prefix && prefix.trim()) {
      return db
        .prepare("SELECT * FROM site_content_blocks WHERE key LIKE ? ORDER BY key ASC")
        .all(`${prefix.trim()}%`) as ContentBlock[];
    }
    return db
      .prepare("SELECT * FROM site_content_blocks ORDER BY key ASC")
      .all() as ContentBlock[];
  } catch {
    return [];
  }
}

export function upsertContentBlock(
  key: string,
  content: string,
  contentType: string = "text",
  description: string = ""
): ContentBlock {
  const db = getDb();
  const cleanKey = key.trim();
  db.prepare(`
    INSERT INTO site_content_blocks (key, content, content_type, description, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      content = excluded.content,
      content_type = excluded.content_type,
      description = CASE WHEN excluded.description != '' THEN excluded.description ELSE site_content_blocks.description END,
      updated_at = CURRENT_TIMESTAMP
  `).run(cleanKey, content, contentType, description);

  return getContentBlockRecord(cleanKey)!;
}

export function deleteContentBlock(key: string): boolean {
  try {
    const db = getDb();
    const res = db.prepare("DELETE FROM site_content_blocks WHERE key = ?").run(key.trim());
    return res.changes > 0;
  } catch {
    return false;
  }
}

/** Announcement Bar helper */
export function getAnnouncementSettings(): AnnouncementSettings {
  const text = getContentBlock("announcement.text", "FREE SHIPPING ON ORDERS ABOVE ₹999");
  const highlight = getContentBlock("announcement.highlight", "✨ FREE SHIPPING ON ORDERS ABOVE ₹999");
  const link_url = getContentBlock("announcement.link_url", "/shop");
  const link_label = getContentBlock("announcement.link_label", "Shop Now");
  const wholesale_label = getContentBlock("announcement.wholesale_label", "🌿 Wholesale & Bulk Orders");
  const enabledStr = getContentBlock("announcement.enabled", "1");
  const enabled = enabledStr === "1" || enabledStr.toLowerCase() === "true";

  return {
    text,
    highlight,
    link_url,
    link_label,
    wholesale_label,
    enabled,
  };
}

export function updateAnnouncementSettings(input: UpdateAnnouncementInput): AnnouncementSettings {
  const current = getAnnouncementSettings();

  const text = input.text !== undefined ? input.text : current.text;
  const highlight = input.highlight !== undefined ? input.highlight : current.highlight;
  const linkUrl = input.link_url ?? input.linkUrl ?? current.link_url;
  const linkLabel = input.link_label ?? input.linkLabel ?? current.link_label;
  const wholesaleLabel = input.wholesale_label ?? input.wholesaleLabel ?? current.wholesale_label;
  const enabled = input.enabled !== undefined ? input.enabled : current.enabled;

  upsertContentBlock("announcement.text", text, "text", "Top marquee announcement line");
  upsertContentBlock("announcement.highlight", highlight, "text", "Top announcement highlight pill");
  upsertContentBlock("announcement.link_url", linkUrl, "text", "Top announcement destination URL");
  upsertContentBlock("announcement.link_label", linkLabel, "text", "Top announcement link text");
  upsertContentBlock("announcement.wholesale_label", wholesaleLabel, "text", "Top announcement wholesale button label");
  upsertContentBlock("announcement.enabled", enabled ? "1" : "0", "boolean", "Show or hide top announcement marquee");

  return getAnnouncementSettings();
}

/** Navigation & Footer Content */
export function getSiteNavigation(): SiteNavigation {
  const brand = getContentBlock("brand.name", "TEAFLOWW");
  const tagline = getContentBlock("brand.tagline", "Himalayan Single-Estate Teas");
  const footerText = getContentBlock("footer.text", "Single-estate loose leaf teas direct from small Himalayan tea makers.");
  const footerCopyright = getContentBlock("footer.copyright", "© Himalayan Tea House Private Limited. All rights reserved.");
  const footerDisclosure = getContentBlock("footer.disclosure", "Direct from origin. Graded and packaged at our Siliguri headquarters.");

  const defaultNav: NavLinkItem[] = [
    { label: "Shop Tea", href: "/shop" },
    { label: "Leaf to Cup", href: "/leaf-to-cup" },
    { label: "Black Teas", href: "/collections/black-tea" },
    { label: "Wholesale & Bulk", href: "/wholesale" },
    { label: "Blend Lab", href: "/blend-lab" },
    { label: "Tea Finder", href: "/tea-finder" },
    { label: "Trials & Samples", href: "/trials" },
  ];

  const defaultFooterLinks: NavLinkItem[] = [
    { label: "Shop Tea", href: "/shop" },
    { label: "Wholesale & Bulk", href: "/wholesale" },
    { label: "Product Feeds", href: "/feeds" },
    { label: "Brand Assets", href: "/brand" },
    { label: "Shipping", href: "/shipping" },
    { label: "Returns", href: "/returns" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact Us", href: "/contact" },
  ];

  let headerLinks = defaultNav;
  let footerLinks = defaultFooterLinks;

  const rawHeader = getContentBlock("nav.header_links", "");
  if (rawHeader) {
    try {
      const parsed = JSON.parse(rawHeader);
      if (Array.isArray(parsed) && parsed.length > 0) headerLinks = parsed;
    } catch { /* use default */ }
  }

  const rawFooter = getContentBlock("nav.footer_links", "");
  if (rawFooter) {
    try {
      const parsed = JSON.parse(rawFooter);
      if (Array.isArray(parsed) && parsed.length > 0) footerLinks = parsed;
    } catch { /* use default */ }
  }

  return {
    brand,
    tagline,
    header_links: headerLinks,
    footer_links: footerLinks,
    footer_text: footerText,
    footer_copyright: footerCopyright,
    footer_disclosure: footerDisclosure,
  };
}

export function updateSiteNavigation(input: {
  brand?: string;
  tagline?: string;
  header_links?: NavLinkItem[];
  footer_links?: NavLinkItem[];
  footer_text?: string;
  footer_copyright?: string;
  footer_disclosure?: string;
}): SiteNavigation {
  if (input.brand !== undefined) upsertContentBlock("brand.name", input.brand, "text", "Brand name");
  if (input.tagline !== undefined) upsertContentBlock("brand.tagline", input.tagline, "text", "Brand tagline");
  if (input.header_links !== undefined) {
    upsertContentBlock("nav.header_links", JSON.stringify(input.header_links), "json", "Header navigation links");
  }
  if (input.footer_links !== undefined) {
    upsertContentBlock("nav.footer_links", JSON.stringify(input.footer_links), "json", "Footer navigation links");
  }
  if (input.footer_text !== undefined) upsertContentBlock("footer.text", input.footer_text, "text", "Footer summary text");
  if (input.footer_copyright !== undefined) upsertContentBlock("footer.copyright", input.footer_copyright, "text", "Footer copyright line");
  if (input.footer_disclosure !== undefined) upsertContentBlock("footer.disclosure", input.footer_disclosure, "text", "Footer legal disclosure");

  return getSiteNavigation();
}
