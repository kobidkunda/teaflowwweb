export type BusinessEvent =
  | "business_page_view"
  | "business_quote_start"
  | "business_quote_submit"
  | "business_whatsapp_click"
  | "qualified_business_lead"
  | "business_quote_sent"
  | "first_b2b_paid_order";

type SafeProperties = Record<string, string | number | boolean | undefined>;

const BLOCKED_PII_KEYS = new Set([
  "phone",
  "mobile",
  "name",
  "email",
  "pincode",
  "postal_code",
  "address",
  "company",
  "note",
  "message",
]);

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    __tfAnalyticsConsent?: boolean;
  }
}

export function sanitizeBusinessEventProperties(properties: SafeProperties): SafeProperties {
  const clean: SafeProperties = {};
  for (const [key, val] of Object.entries(properties)) {
    if (BLOCKED_PII_KEYS.has(key.toLowerCase())) continue;
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

export function trackBusinessEvent(event: BusinessEvent, properties: SafeProperties = {}): boolean {
  if (typeof window === "undefined") return false;
  // Respect consent flag when explicitly set to false; allow when consent is granted
  // or when existing site consent cookie/flag is active.
  if (window.__tfAnalyticsConsent === false) return false;
  const safeProps = sanitizeBusinessEventProperties(properties);
  window.dataLayer ??= [];
  window.dataLayer.push({ event, ...safeProps });
  return true;
}
