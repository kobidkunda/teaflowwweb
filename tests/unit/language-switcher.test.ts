import { describe, it, expect } from "vitest";
import { LANGUAGES } from "@/lib/international/models";
import { PAN_INDIA_ITEMS } from "@/lib/international/panIndiaDictionary";

describe("LanguageSwitcher & Pan-India Locales", () => {
  it("contains all 7 Pan-India locales with correct scripts and directions", () => {
    const panIndiaLocales = [
      { code: "en", name: "English", dir: "ltr" },
      { code: "hi", name: "हिन्दी", dir: "ltr" },
      { code: "bn", name: "বাংলা", dir: "ltr" },
      { code: "pa", name: "ਪੰਜਾਬੀ", dir: "ltr" },
      { code: "mr", name: "मराठी", dir: "ltr" },
      { code: "gu", name: "ગુજરાતી", dir: "ltr" },
      { code: "ta", name: "தமிழ்", dir: "ltr" },
      { code: "te", name: "తెలుగు", dir: "ltr" },
    ];

    for (const expected of panIndiaLocales) {
      const match = LANGUAGES.find((l) => l.code === expected.code);
      expect(match).toBeDefined();
      expect(match?.name).toBe(expected.name);
      expect(match?.dir).toBe(expected.dir);
    }
  });

  it("ensures every PAN_INDIA_ITEMS string has non-empty translations for all 7 Indian languages", () => {
    const requiredLanguages = ["hi", "bn", "pa", "mr", "gu", "ta", "te"] as const;
    for (const item of PAN_INDIA_ITEMS) {
      expect(item.en.trim().length).toBeGreaterThan(0);
      for (const lang of requiredLanguages) {
        expect(item[lang]).toBeDefined();
        expect(item[lang].trim().length).toBeGreaterThan(0);
      }
    }
  });
});
