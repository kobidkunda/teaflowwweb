import english from "./traderCopy.json";
import hindi from "./traderHindi.json";

// Match the source text as well as its key: custom admin copy must be translated
// explicitly rather than silently receiving an unrelated starter translation.
const hi: Record<keyof typeof english, string> = hindi;
export function traderDefaultTexts(locale: string, source: Record<string, string>) {
  if (locale !== "hi") return {};
  const bySource = new Map(Object.entries(english).map(([key, value]) => [value, hi[key as keyof typeof english]]));
  return Object.fromEntries(Object.entries(source).flatMap(([key, value]) => {
    const text = bySource.get(value);
    return text ? [[key, text]] : [];
  }));
}
