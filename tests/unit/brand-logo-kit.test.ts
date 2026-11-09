import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BRAND_LOGOS } from "../../src/lib/brandLogos";
import { BrandLogo } from "../../src/components/BrandLogo";

describe("Teafloww Master Vector Logo Kit", () => {
  const rootDir = process.cwd();

  it("contains exactly 40 brand logos in dataset", () => {
    expect(BRAND_LOGOS).toHaveLength(40);
    BRAND_LOGOS.forEach((item, index) => {
      expect(item.id).toBe(index + 1);
      expect(item.filename).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.svgUrl).toMatch(/^\/logo\/svg\/.+\.svg$/);
      expect(item.pngUrl).toMatch(/^\/logo\/png\/.+\.png$/);
    });
  });

  it("verifies all 40 vector SVG files exist in public/logo/svg/", () => {
    for (const item of BRAND_LOGOS) {
      const filePath = path.join(rootDir, "public", item.svgUrl.replace(/^\//, ""));
      expect(fs.existsSync(filePath), `Missing SVG file: ${filePath}`).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("<svg");
      expect(content).toContain("</svg>");
      expect(content).not.toContain("data:image/"); // Pure vectors, no embedded bitmaps
    }
  });

  it("verifies all 40 raster PNG files exist in public/logo/png/", () => {
    for (const item of BRAND_LOGOS) {
      const filePath = path.join(rootDir, "public", item.pngUrl.replace(/^\//, ""));
      expect(fs.existsSync(filePath), `Missing PNG file: ${filePath}`).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(5000);
    }
  });

  it("verifies canonical brand assets and App Router icons without duplicate public routes", () => {
    const requiredAssets = [
      "public/images/logo.png",
      "public/images/logo.svg",
      "public/images/logo-horizontal.svg",
      "public/images/logo-symbol.svg",
      "src/app/icon.svg",
      "public/apple-touch-icon.png",
      "src/app/favicon.ico",
      "public/favicon-32x32.png",
      "public/favicon-16x16.png",
      "public/icon-192.png",
      "public/icon-512.png",
      "public/site.webmanifest",
      "public/manifest.json",
    ];

    expect(fs.existsSync(path.join(rootDir, "public/icon.svg"))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, "public/favicon.ico"))).toBe(false);
    for (const relPath of requiredAssets) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath), `Required asset missing: ${relPath}`).toBe(true);
    }
  });

  describe("BrandLogo Component Rendering & A11y", () => {
    it("renders default symbol variant with correct viewBox and paths", () => {
      const markup = renderToStaticMarkup(
        React.createElement(BrandLogo, {
          variant: "symbol",
          size: 40,
          "aria-label": "Teafloww Symbol",
        })
      );

      expect(markup).toContain('viewBox="0 0 370 360"');
      expect(markup).toContain('role="img"');
      expect(markup).toContain('aria-label="Teafloww Symbol"');
      expect(markup).toContain('width="40"');
      expect(markup).toContain('height="40"');
      expect(markup).toContain('fill="#F3CAA6"'); // Sunrise path
    });

    it("renders symbol-gold variant for luxury dark panels", () => {
      const markup = renderToStaticMarkup(
        React.createElement(BrandLogo, {
          variant: "symbol-gold",
          size: 24,
          "aria-hidden": true,
        })
      );

      expect(markup).toContain('viewBox="0 0 370 360"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('fill="#D6B26C"');
    });

    it("renders horizontal lockup with wordmark and tagline", () => {
      const markup = renderToStaticMarkup(
        React.createElement(BrandLogo, {
          variant: "horizontal",
          width: 200,
          height: 64,
        })
      );

      expect(markup).toContain('viewBox="0 0 1200 385"');
      expect(markup).toContain('width="200"');
      expect(markup).toContain('height="64"');
      expect(markup).toContain('fill="#063B2F"');
    });

    it("renders circular heritage badge variant", () => {
      const markup = renderToStaticMarkup(
        React.createElement(BrandLogo, {
          variant: "badge",
          size: 80,
        })
      );

      expect(markup).toContain('viewBox="0 0 560 560"');
      expect(markup).toContain("<circle");
    });

    it("renders pure vector wordmark variant", () => {
      const markup = renderToStaticMarkup(
        React.createElement(BrandLogo, {
          variant: "wordmark",
          size: 32,
        })
      );

      expect(markup).toContain('viewBox="0 0 720 185"');
    });
  });
});
