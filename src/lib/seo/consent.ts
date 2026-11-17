import type { PublicTrackingConfig } from "@/lib/trackingSettings";

export const CONSENT_KEY = "tf_tracking_consent_v1";
export const CONSENT_EVENT = "tf:tracking-consent";
export type TrackingConsent = { analytics: boolean; marketing: boolean };
export const DENIED_CONSENT: TrackingConsent = { analytics: false, marketing: false };

export function readTrackingConsent(): TrackingConsent {
  if (typeof window === "undefined") return DENIED_CONSENT;
  if (window.__tfConsent) return window.__tfConsent;
  try {
    const value = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null");
    if (value?.version === 1 && typeof value.analytics === "boolean" && typeof value.marketing === "boolean") {
      return { analytics: value.analytics, marketing: value.marketing };
    }
  } catch { /* Storage may be unavailable. Default to denied. */ }
  return DENIED_CONSENT;
}

export function googleConsent(consent: TrackingConsent) {
  return {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
  };
}

export function updateTrackingConsent(consent: TrackingConsent) {
  window.__tfConsent = { ...consent };
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, ...consent })); } catch {}
  window.gtag?.("consent", "update", googleConsent(consent));
  window.fbq?.("consent", consent.marketing ? "grant" : "revoke");
  window.dataLayer ||= [];
  window.dataLayer.push({ event: "consent_updated", analytics_consent: consent.analytics, marketing_consent: consent.marketing });
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function trackingRouteAllowed(path: string) {
  return !/^\/(?:admin|api|account|login|auth|track)(?:\/|$)/.test(path);
}

/** Never include private order IDs, credentials, search input, or arbitrary query strings. */
export function safeTrackingUrl(value: string, base = "https://teafloww.com") {
  try {
    const url = new URL(value, base);
    let path = url.pathname;
    if (/^\/(?:purchase|order)(?:\/|$)/.test(path)) path = path.split("/").slice(0, 2).join("/");
    if (/^\/private-label\/(?:quotes|projects)(?:\/|$)/.test(path)) path = path.split("/").slice(0, 3).join("/");
    if (!trackingRouteAllowed(path)) path = "/private";
    // Only acquisition parameters survive; never forward customer-entered search fields.
    const query = new URLSearchParams();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "dclid", "gbraid", "wbraid", "fbclid"]) {
      const v = url.searchParams.get(key);
      if (v && v.length <= 200 && !/@|%40/i.test(v) && /^[\w .~+-]+$/.test(v)) query.set(key, v);
    }
    return url.origin + path + (query.size ? `?${query}` : "");
  } catch { return base; }
}

export function collectDirectGoogleIds(config: PublicTrackingConfig): { ga4Ids: string[]; adsIds: string[] } {
  const gtmActive = Boolean(config.gtmEnabled && /^GTM-[A-Z0-9]+$/i.test(config.gtmContainerId));
  const ga4Ids = new Set<string>();
  const adsIds = new Set<string>();

  if (config.ga4Enabled && /^G-[A-Z0-9]+$/i.test(config.ga4MeasurementId) && (!gtmActive || config.ga4RunAlongsideGtm)) {
    ga4Ids.add(config.ga4MeasurementId.toUpperCase());
  }
  if (config.googleAdsEnabled && /^AW-\d+$/i.test(config.googleAdsId)) {
    adsIds.add(config.googleAdsId.toUpperCase());
  }
  for (const rule of config.conversionRules || []) {
    if (!rule.enabled || rule.delivery === "gtm_datalayer") continue;
    if (rule.platform === "google_ads") {
      const target = (rule.ads_conversion_id || config.googleAdsId || "").trim().toUpperCase();
      if (/^AW-\d+$/.test(target)) adsIds.add(target);
    } else if (rule.platform === "ga4" && /^G-[A-Z0-9]+$/i.test(config.ga4MeasurementId)) {
      ga4Ids.add(config.ga4MeasurementId.toUpperCase());
    }
  }
  return { ga4Ids: [...ga4Ids], adsIds: [...adsIds] };
}

export function collectDirectMetaPixelIds(config: PublicTrackingConfig): string[] {
  const gtmActive = Boolean(config.gtmEnabled && /^GTM-[A-Z0-9]+$/i.test(config.gtmContainerId));
  const ids = new Set<string>();
  if (config.metaPixelEnabled && /^\d+$/.test(config.metaPixelId) && (!gtmActive || config.metaRunAlongsideGtm)) {
    ids.add(config.metaPixelId);
  }
  for (const rule of config.conversionRules || []) {
    if (!rule.enabled || rule.delivery === "gtm_datalayer" || rule.platform !== "meta") continue;
    const target = (rule.meta_pixel_id || config.metaPixelId || "").trim();
    if (/^\d+$/.test(target)) ids.add(target);
  }
  return [...ids];
}

/** Runs synchronously before GTM or React effects. No vendor requests before consent. */
export function trackingBootstrap(config: PublicTrackingConfig) {
  const encoded = JSON.stringify(config).replace(/</g, "\\u003c");
  const { ga4Ids, adsIds } = collectDirectGoogleIds(config);
  const directConfigs = [
    ...ga4Ids.map((id) => `window.gtag('config','${id}',{send_page_view:false});`),
    ...adsIds.map((id) => `window.gtag('config','${id}',{send_page_view:false,allow_enhanced_conversions:false});`),
  ];
  return `window.__tfTracking=${encoded};
window.dataLayer=window.dataLayer||[];
window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
try{var c=JSON.parse(localStorage.getItem('${CONSENT_KEY}')||'null');if(c&&c.version===1&&typeof c.analytics==='boolean'&&typeof c.marketing==='boolean'){window.__tfConsent={analytics:c.analytics,marketing:c.marketing};window.gtag('consent','update',{analytics_storage:c.analytics?'granted':'denied',ad_storage:c.marketing?'granted':'denied',ad_user_data:c.marketing?'granted':'denied',ad_personalization:c.marketing?'granted':'denied'});}}catch(e){}
window.gtag('set',{ads_data_redaction:true,url_passthrough:false,send_page_view:false});
${directConfigs.length ? `window.gtag('js',new Date());${directConfigs.join("")}` : ""}`;
}

declare global {
  interface Window {
    __tfTracking?: PublicTrackingConfig;
    __tfConsent?: TrackingConsent;
    __tfPurchases?: Set<string>;
    __tfMetaInitialized?: boolean;
    __tfMetaInitializedIds?: Set<string>;
  }
}

export function gtmLoaderScript(containerId: string) {
  if (!/^GTM-[A-Z0-9]+$/.test(containerId)) return "";
  return `if(!window.__gtm_loaded){window.__gtm_loaded=true;window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id=${containerId}';document.head.appendChild(s);}`;
}
