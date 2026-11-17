import { tradeDefaults } from "./baseCopy";
import { publishedTexts } from "@/lib/international/translations";
import type { AnyTradeLocale } from "./contracts";
import { TRADE_LANGUAGE_META, type TradeDictionary } from "./i18nMeta";

export { TRADE_LANGUAGE_META, type TradeDictionary };

export function getTradeDictionary(locale: AnyTradeLocale): TradeDictionary {
  const merged = tradeDefaults(locale);
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
