/**
 * Single list of public site languages. Every page (storefront, tea shops,
 * start-tea-business, tea traders) must use this list. All translated text is
 * published from /admin/translations (commerce_translations); no page may ship
 * its own translated strings.
 */
export const SITE_LOCALES = ["en", "hi", "bn", "pa", "mr", "gu", "ta", "te"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];
export const DEFAULT_LOCALE: SiteLocale = "en";

export const SITE_LOCALE_NAMES: Record<SiteLocale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  pa: "ਪੰਜਾਬੀ",
  mr: "मराठी",
  gu: "ગુજરાતી",
  ta: "தமிழ்",
  te: "తెలుగు",
};

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === "string" && (SITE_LOCALES as readonly string[]).includes(value);
}

/** Pick the first valid locale from the candidates (path header, ?lang=, ...). */
export function resolveLocale(...candidates: Array<string | null | undefined>): SiteLocale {
  for (const c of candidates) if (isSiteLocale(c)) return c;
  return DEFAULT_LOCALE;
}

/** Canonical path-prefixed URL: `/pa/start-tea-business`; English has no prefix. */
export function localizedHref(path: string, locale: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!isSiteLocale(locale) || locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Intl formatting locale for a site language, e.g. `pa-IN`. */
export function intlLocale(locale: string): string {
  return `${isSiteLocale(locale) ? locale : DEFAULT_LOCALE}-IN`;
}
