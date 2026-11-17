import { publishedTexts } from "@/lib/international/translations";
import { makeTr, type TextDict } from "./sourceKey";

/** Published texts for the `starter` resource (Admin → Translations). English is the source. */
export function starterDict(locale: string): TextDict | null {
  if (locale === "en") return null;
  return publishedTexts("starter", locale);
}

export function serverTr(locale: string) {
  return makeTr(starterDict(locale));
}
