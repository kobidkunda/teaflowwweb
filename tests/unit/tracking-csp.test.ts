import { describe, expect, it, vi } from "vitest";
import { SECURITY_HEADERS } from "@/lib/security";
const csp = SECURITY_HEADERS["Content-Security-Policy"];
const sources = (directive: string) => csp.split(";").map(p => p.trim().split(/\s+/)).find(p => p[0] === directive)!.slice(1);
describe("Tracking CSP resource boundaries", () => {
  it("permits Meta's GTM helper and its current unpkg redirect without opening whole CDNs", () => {
    const scripts = sources("script-src");
    for (const url of [
      "https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
      "https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
      "https://unpkg.com/meta-capi-param-builder-clientjs@1.3.3/dist/clientParamBuilder.bundle.js",
    ]) expect(scripts).toContain(url);
    for (const broad of ["*", "https:", "https://cdn.jsdelivr.net", "https://unpkg.com"]) expect(scripts).not.toContain(broad);
  });
  it("allows only pixel-configured CAPI cloud origins", () => {
    const connects = sources("connect-src");
    expect(connects).toContain("https://1c-e0e78bd7d7fd408d87142c500d5b8890.ecs.us-west-1.on.aws");
    expect(connects).toContain("https://vwdb33u4tj1q.cloud.run");
    expect(connects).not.toContain("https://*.cloud.run"); expect(connects).not.toContain("https://*.on.aws");
  });
  it("permits documented Tag Assistant preview scripts, styles and icon fonts", () => {
    expect(sources("script-src")).toContain("https://tagmanager.google.com");
    for (const origin of ["https://www.googletagmanager.com", "https://tagmanager.google.com", "https://fonts.googleapis.com"]) expect(sources("style-src")).toContain(origin);
    expect(sources("font-src")).toContain("https://fonts.gstatic.com");
  });
  it("permits Meta iframe and form transport only at the required destinations", () => {
    const frames = sources("frame-src");
    const forms = sources("form-action");
    expect(frames).toContain("https://www.facebook.com");
    expect(forms).toContain("https://www.facebook.com/tr/");
    expect(forms).toContain("https://pay.biolastic.co.in");
    for (const broad of ["*", "https:", "https://*.facebook.com", "https://facebook.com"]) {
      expect(frames).not.toContain(broad);
      expect(forms).not.toContain(broad);
    }
    expect(forms).not.toContain("https://www.facebook.com");
  });
  it("retains production eval and framing protections", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.resetModules();
    try {
      const { SECURITY_HEADERS: production } = await import("@/lib/security");
      expect(production["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
      expect(production["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
      expect(production["X-Frame-Options"]).toBe("DENY");
    } finally { vi.unstubAllEnvs(); vi.resetModules(); }
  });
});
