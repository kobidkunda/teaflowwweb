import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import starterSource from "@/lib/business/starterSource.json";
import { makeTr, sourceKey } from "@/lib/business/sourceKey";
import { SITE_LOCALES, intlLocale, isSiteLocale, localizedHref, resolveLocale } from "@/lib/i18n/locale";

const DEVANAGARI = /[\u0900-\u097F]/;

describe("shared locale helpers", () => {
  it("builds path-prefixed URLs and leaves English unprefixed", () => {
    expect(localizedHref("/start-tea-business", "pa")).toBe("/pa/start-tea-business");
    expect(localizedHref("/start-tea-business", "en")).toBe("/start-tea-business");
    expect(localizedHref("/", "hi")).toBe("/hi");
    expect(localizedHref("/x", "xx")).toBe("/x");
  });
  it("resolves only supported locales", () => {
    expect(resolveLocale("zz", "ta")).toBe("ta");
    expect(resolveLocale(null, undefined)).toBe("en");
    expect(isSiteLocale("pa")).toBe(true);
    expect(SITE_LOCALES).toContain("te");
    expect(intlLocale("pa")).toBe("pa-IN");
  });
});

describe("starter translation source", () => {
  it("keys are derived from the English text", () => {
    for (const [key, en] of Object.entries(starterSource as Record<string, string>)) expect(sourceKey(en)).toBe(key);
  });
  it("contains English only (translations live in Admin → Translations)", () => {
    for (const en of Object.values(starterSource as Record<string, string>)) expect(DEVANAGARI.test(en)).toBe(false);
  });
  it("falls back to English when no translation is published", () => {
    expect(makeTr(null)("Get a quote")).toBe("Get a quote");
    expect(makeTr({ [sourceKey("Get a quote")]: "ਕੋਟੇਸ਼ਨ ਲਓ" })("Get a quote")).toBe("ਕੋਟੇਸ਼ਨ ਲਓ");
  });
});

describe("no hardcoded translations in page code", () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
  it("business components have no inline Devanagari strings", () => {
    const dir = path.join(process.cwd(), "src/components/business");
    const bad = walk(dir).filter(f => DEVANAGARI.test(fs.readFileSync(f, "utf8")) && !/BusinessLanguageSwitch/.test(f));
    expect(bad).toEqual([]);
  });
  it("trade copy modules are English only", () => {
    for (const f of ["baseCopy.ts", "copy.ts"]) expect(DEVANAGARI.test(fs.readFileSync(path.join(process.cwd(), "src/lib/trade", f), "utf8"))).toBe(false);
  });
});
