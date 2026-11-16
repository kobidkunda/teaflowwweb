import type { BusinessLeadInput } from "./schema";

export type BusinessAttribution = BusinessLeadInput["attribution"];

const ALLOWED_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
] as const;

export function collectAttribution(search: string): BusinessAttribution {
  const params = new URLSearchParams(search);
  const record: Record<string, string> = {};
  for (const key of ALLOWED_ATTRIBUTION_KEYS) {
    const value = params.get(key)?.trim();
    if (value) {
      const maxLen = key === "utm_source" || key === "utm_medium" ? 100 : key.startsWith("utm_") ? 150 : 250;
      record[key] = value.slice(0, maxLen);
    }
  }
  return record as BusinessAttribution;
}
