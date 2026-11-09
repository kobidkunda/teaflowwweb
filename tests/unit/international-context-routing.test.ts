import { describe, it, expect } from "vitest";
import { resolvePreferences } from "@/lib/international/context";
import { LANGUAGES } from "@/lib/international/models";
import { SECURITY_HEADERS } from "@/lib/security";

describe("International Context & Preferences Resolution", () => {
  const dummyMarkets = [
    { code: "IN", name: "India", currency: "INR", language: "en" as const, available: true },
    { code: "US", name: "United States", currency: "USD", language: "en" as const, available: true },
    { code: "FR", name: "France", currency: "EUR", language: "fr" as const, available: true },
    { code: "AE", name: "United Arab Emirates", currency: "AED", language: "ar" as const, available: true },
    { code: "JP", name: "Japan", currency: "JPY", language: "ja" as const, available: false }, // unavailable market
  ];

  const dummyLanguages = [
    { code: "en", name: "English", dir: "ltr" as const },
    { code: "fr", name: "Français", dir: "ltr" as const },
    { code: "ar", name: "العربية", dir: "rtl" as const },
    { code: "zh-CN", name: "简体中文", dir: "ltr" as const },
  ];

  it("suggests the first country using trusted proxy/IP geolocation when saved preferences are absent", () => {
    const prefs = resolvePreferences(
      { trustedCountry: "FR", browserLanguage: "fr-FR" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.country).toBe("FR");
    expect(prefs.currency).toBe("EUR");
    expect(prefs.locale).toBe("fr");
  });

  it("defaults to India (IN) and INR when geolocation is unknown or invalid", () => {
    const prefs = resolvePreferences(
      { trustedCountry: "UNKNOWN_IP" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.country).toBe("IN");
    expect(prefs.currency).toBe("INR");
    expect(prefs.locale).toBe("en");
  });

  it("remembers explicit customer choices in saved preferences; subsequent IP changes never override them", () => {
    const saved = JSON.stringify({ country: "US", currency: "USD", locale: "en" });
    // Customer explicitly chose US, now traveling through France (trustedCountry=FR)
    const prefs = resolvePreferences(
      { saved, trustedCountry: "FR", browserLanguage: "fr-FR" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.country).toBe("US");
    expect(prefs.currency).toBe("USD");
    expect(prefs.locale).toBe("en");
  });

  it("resolves browser language when supported by enabled languages", () => {
    const prefs = resolvePreferences(
      { browserLanguage: "fr-FR,fr;q=0.9,en;q=0.8" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.locale).toBe("fr");
  });

  it("evaluates secondary weighted Accept-Language tags when the primary tag is unsupported", () => {
    // Danish (da) is not supported; French (fr;q=0.8) is supported
    const prefs = resolvePreferences(
      { browserLanguage: "da,fr;q=0.8,en;q=0.5" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.locale).toBe("fr");
  });

  it("resolves hyphenated browser language like zh-CN cleanly", () => {
    const prefs = resolvePreferences(
      { browserLanguage: "zh-CN,zh;q=0.9" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.locale).toBe("zh-CN");
  });

  it("normalizes zh-TW or generic zh to zh-CN when zh-CN is enabled", () => {
    const prefs = resolvePreferences(
      { browserLanguage: "zh-TW,zh;q=0.8" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.locale).toBe("zh-CN");
  });

  it("falls back to market default language when browser language is unsupported", () => {
    const prefs = resolvePreferences(
      { trustedCountry: "AE", browserLanguage: "de-DE,de;q=0.9" },
      dummyMarkets,
      dummyLanguages
    );
    // German (de) is not in dummyLanguages; falls back to UAE market default language (ar)
    expect(prefs.country).toBe("AE");
    expect(prefs.locale).toBe("ar");
  });

  it("falls back to English when both browser language and market language are not enabled", () => {
    const prefs = resolvePreferences(
      { trustedCountry: "JP", browserLanguage: "de-DE" },
      dummyMarkets,
      dummyLanguages
    );
    // JP market language is 'ja', which is not in dummyLanguages; falls back to 'en'
    expect(prefs.country).toBe("JP");
    expect(prefs.locale).toBe("en");
  });

  it("handles unavailable destination honestly while still permitting browsing preferences", () => {
    const prefs = resolvePreferences(
      { trustedCountry: "JP" },
      dummyMarkets,
      dummyLanguages
    );
    expect(prefs.country).toBe("JP");
    expect(prefs.currency).toBe("JPY");
  });

  it("configures RTL text direction correctly for Arabic and LTR for others", () => {
    const ar = LANGUAGES.find((l) => l.code === "ar");
    expect(ar?.dir).toBe("rtl");

    const en = LANGUAGES.find((l) => l.code === "en");
    expect(en?.dir).toBe("ltr");

    const hi = LANGUAGES.find((l) => l.code === "hi");
    expect(hi?.dir).toBe("ltr");
  });

  it("verifies Razorpay and security headers are configured without GPS prompts", () => {
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("geolocation=()");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("https://checkout.razorpay.com");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("https://api.razorpay.com");
  });
});
