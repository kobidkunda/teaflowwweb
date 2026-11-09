import { verifySessionValue, SESSION_COOKIE } from "@/lib/adminSessions";
import { cookies, headers } from "next/headers";
import { localeSchema, LANGUAGES } from "./models";
import { markets, publicMarkets } from "./store";
import { enabledLanguages, publishedTexts, UI_SOURCE } from "./translations";
import { latestFx } from "./fx";
function parsePreferredLanguage(header?: string, accepts?: (v?: string) => boolean): string | undefined {
  if (!header || !accepts) return undefined;
  const parts = header.split(",").map(p => {
    const [tag, ...params] = p.trim().split(";");
    const qParam = params.find(param => param.trim().startsWith("q="));
    const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
    return { tag: tag.trim(), q: isNaN(q) ? 0 : q };
  }).sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    if (accepts(tag)) return tag;
    const base = tag.split("-")[0];
    if (accepts(base)) return base;
    if (tag.toLowerCase().startsWith("zh") && accepts("zh-CN")) return "zh-CN";
  }
  return undefined;
}
export function resolvePreferences(input: { saved?: string; trustedCountry?: string; browserLanguage?: string; locale?: string }, available: readonly { code: string; currency: string; language: string }[] = publicMarkets(), languages: readonly { code: string }[] = enabledLanguages()) {
  let saved: { country?: string; currency?: string; locale?: string } = {};
  try { const parsed = JSON.parse(input.saved || "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed; } catch {}
  const country = /^[A-Z]{2}$/.test(saved.country || "") ? saved.country! : /^[A-Z]{2}$/.test(input.trustedCountry || "") ? input.trustedCountry! : "IN";
  const m = available.find(v => v.code === country);
  const accepts = (v?: string) => Boolean(v && languages.some(l => l.code === v));
  const browserMatch = parsePreferredLanguage(input.browserLanguage, accepts);
  const proposed = input.locale || saved.locale || browserMatch || m?.language || "en";
  const locale = accepts(proposed) ? proposed! : accepts(m?.language) ? m!.language : "en";
  const currency = saved.currency && /^[A-Z]{3}$/.test(saved.currency) ? saved.currency : m?.currency || "INR";
  return { country, currency, locale };
}
export async function requestContext() {
  let h: { get(name: string): string | null | undefined } = new Headers();
  let c: { get(name: string): { value: string } | undefined } = { get: () => undefined };
  try { h = await headers(); } catch {}
  try { c = await cookies(); } catch {}
  const available = publicMarkets(), languages = enabledLanguages();
  const rawLocale = h.get("x-teafloww-locale");
  const parsedLocale = localeSchema.safeParse(rawLocale);
  const locale = parsedLocale.success ? parsedLocale.data : undefined;
  const pref = resolvePreferences({ saved: c.get("tf_preferences")?.value, trustedCountry: process.env.TRUST_COUNTRY_HEADER === "cf-ipcountry" ? h.get("cf-ipcountry") || undefined : process.env.TRUST_COUNTRY_HEADER === "x-geo-country" ? h.get("x-geo-country") || undefined : undefined,
    browserLanguage: h.get("accept-language") || undefined, locale }, available, languages);
  const preview = c.get("tf_preview_country")?.value;
  const admin = c.get(SESSION_COOKIE)?.value;
  if (preview && admin && verifySessionValue(admin)) pref.country = preview;
  const selectedMarket = markets().find(m => m.code === pref.country);
  const translatedInterface = publishedTexts("interface", pref.locale);
  const phraseTexts = Object.fromEntries(Object.entries(UI_SOURCE).filter(([key]) => translatedInterface?.[key]).map(([key, original]) => [original, translatedInterface![key]]));
  const fx = latestFx();
  return { ...pref, requestedLocale: locale, markets: available, languages, dir: LANGUAGES.find(l => l.code === (locale || pref.locale))?.dir || "ltr", phraseTexts, fxMarkupBps: selectedMarket?.fxMarkupBps || 0, roundingMinor: selectedMarket?.roundingMinor || 1, texts: { ...Object.fromEntries(Object.entries(UI_SOURCE).filter(([key]) => !key.startsWith("copy_"))), ...translatedInterface },
    rates: fx && Date.now() <= fx.next + 48 * 3600000 ? fx.rates : { INR: "1" }, rateUpdated: fx?.updated || null, rateNext: fx?.next || null, rateStale: Boolean(fx && Date.now() > fx.next) };
}
export type InternationalContext = Awaited<ReturnType<typeof requestContext>>;
