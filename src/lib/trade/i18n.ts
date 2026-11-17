import { tradeDefaults } from "./baseCopy";
import { publishedTexts } from "@/lib/international/translations";
import type { AnyTradeLocale } from "./contracts";
import { listLocalizedContent } from "./catalogue";
import { TRADE_LANGUAGE_META, type TradeDictionary } from "./i18nMeta";

export { TRADE_LANGUAGE_META, type TradeDictionary };

export function getTradeDictionary(locale: AnyTradeLocale): TradeDictionary {
  const merged = tradeDefaults(locale);
  try {
    const overrides = listLocalizedContent(locale);
    for (const row of overrides) {
      if (row.resource_key in merged && row.review_status === "reviewed") {
        (merged as Record<string, string>)[row.resource_key] = row.text_value;
      }
    }
  } catch {
    // Fallback gracefully to base dictionary if DB not initialized
  }
  Object.assign(merged, publishedTexts("trade", locale) || {});
  return merged;
}

export function formatTradeMessage(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}
