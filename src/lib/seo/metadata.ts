import type { Metadata } from "next";
import { SITE_CONFIG, getSiteUrl } from "./site";
import { buildCanonicalUrl } from "./canonical";
import { LANGUAGES } from "@/lib/international/models";
import { publishedTexts } from "@/lib/international/translations";

export interface ConstructMetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string | null;
  ogType?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  canonicalOverride?: string | null;
  locale?: string;
  resource?: string;
  languages?: Record<string, string>;
}

/**
 * Constructs a fully compliant Next.js App Router Metadata object.
 * Enforces absolute HTTPS canonicals, robust OpenGraph, Twitter Cards, explicit robots directives,
 * and hreflang alternate links for published translations.
 */
export function constructMetadata({
  title,
  description = SITE_CONFIG.description,
  path = "/",
  ogImage,
  ogType = "website",
  noindex = false,
  publishedTime,
  modifiedTime,
  authors,
  canonicalOverride,
  locale = "en",
  resource,
  languages,
}: ConstructMetadataOptions = {}): Metadata {
  const siteUrl = getSiteUrl();

  let resolvedTitle = title;
  let resolvedDescription = description;
  let hasPublishedTranslation = false;

  if (resource && locale && locale !== "en") {
    try {
      const texts = publishedTexts(resource, locale);
      if (texts && Object.keys(texts).length > 0) {
        hasPublishedTranslation = true;
        resolvedTitle = texts.seo_title || texts.meta_title || texts.title || texts.name || texts["hero.title"] || resolvedTitle;
        resolvedDescription = texts.seo_description || texts.meta_description || texts.description || resolvedDescription;
      }
    } catch {
      // Defensively fallback to English if database access fails
    }
  }

  const isUntranslatedLocale = Boolean(resource && locale && locale !== "en" && !hasPublishedTranslation);
  const effectiveNoindex = noindex || isUntranslatedLocale;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const localizedPath = locale && locale !== "en" && hasPublishedTranslation ? `/${locale}${cleanPath === "/" ? "" : cleanPath}` : cleanPath;
  const canonicalUrl = canonicalOverride && canonicalOverride.trim()
    ? buildCanonicalUrl(canonicalOverride.trim())
    : buildCanonicalUrl(localizedPath);

  // Compute hreflang alternates only when published translations exist
  let resolvedLanguages: Record<string, string> | undefined = languages;
  if (!resolvedLanguages && resource) {
    try {
      const alternatesMap: Record<string, string> = {};
      let hasAlternates = false;
      for (const lang of LANGUAGES) {
        if (lang.code !== "en") {
          const t = publishedTexts(resource, lang.code);
          if (t && Object.keys(t).length > 0) {
            alternatesMap[lang.code] = buildCanonicalUrl(`/${lang.code}${cleanPath === "/" ? "" : cleanPath}`);
            hasAlternates = true;
          }
        }
      }
      if (hasAlternates) {
        alternatesMap["en"] = buildCanonicalUrl(cleanPath);
        alternatesMap["x-default"] = buildCanonicalUrl(cleanPath);
        resolvedLanguages = alternatesMap;
      }
    } catch {
      // Defensive fallback
    }
  }

  // Clean formatted title
  const fullTitle = resolvedTitle
    ? `${resolvedTitle} · ${SITE_CONFIG.name}`
    : `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;

  // Image absolute URL resolution (routes arbitrary images through /api/og for 1200x630 JPEG optimization)
  let imageUrl = `${siteUrl}${SITE_CONFIG.defaultOgImage}`;
  if (ogImage && ogImage.trim()) {
    const trimmed = ogImage.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (
          host === "teafloww.com" ||
          host === "www.teafloww.com" ||
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.includes("himalayantea")
        ) {
          imageUrl = `${siteUrl}/api/og?image=${encodeURIComponent(parsed.pathname)}`;
        } else {
          imageUrl = trimmed;
        }
      } catch {
        imageUrl = trimmed;
      }
    } else {
      const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      // Pre-baked static 1200x630 OG images can be served directly
      if (cleanPath.startsWith("/images/og-") || cleanPath.startsWith("/api/og")) {
        imageUrl = `${siteUrl}${cleanPath}`;
      } else {
        imageUrl = `${siteUrl}/api/og?image=${encodeURIComponent(cleanPath)}`;
      }
    }
  }

  const metadata: Metadata = {
    title: fullTitle,
    description: resolvedDescription,
    alternates: {
      canonical: canonicalUrl,
      ...(resolvedLanguages ? { languages: resolvedLanguages } : {}),
    },
    openGraph: {
      title: resolvedTitle || SITE_CONFIG.name,
      description: resolvedDescription,
      url: canonicalUrl,
      siteName: SITE_CONFIG.name,
      locale: locale === "en" ? SITE_CONFIG.defaultLocale : locale.replace("-", "_"),
      type: ogType,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: 1200,
          height: 630,
          type: "image/jpeg",
          alt: title || SITE_CONFIG.name,
        },
      ],
      ...(ogType === "article"
        ? {
            publishedTime: publishedTime || undefined,
            modifiedTime: modifiedTime || undefined,
            authors: authors || [SITE_CONFIG.name],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: title || SITE_CONFIG.name,
      description,
      images: [imageUrl],
      site: "@teafloww",
      creator: "@teafloww",
    },
    robots: effectiveNoindex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };

  return metadata;
}
