/** Isomorphic helpers for the `starter` translation resource (Start a tea business). */
export type TextDict = Record<string, string>;

/** Stable key for an English source string (FNV-1a, 32-bit, plus length). */
export function sourceKey(en: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < en.length; i++) {
    h ^= en.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `s.${h.toString(36)}${en.length.toString(36)}`;
}

/** English is the source text; a published translation replaces it per key. */
export function makeTr(dict: TextDict | null | undefined) {
  return (en: string): string => (dict && dict[sourceKey(en)]) || en;
}
