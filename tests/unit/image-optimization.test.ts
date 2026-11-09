import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import pkg from "../../package.json";
import fs from "fs";
import path from "path";

describe("Next.js Image Optimization Configuration", () => {
  it("should configure AVIF and WebP modern image formats in next.config.ts", () => {
    expect(nextConfig.images).toBeDefined();
    expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
  });

  it("should configure responsive deviceSizes and imageSizes", () => {
    const images = nextConfig.images;
    expect(images?.deviceSizes).toEqual([640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840]);
    expect(images?.imageSizes).toEqual([16, 32, 48, 64, 96, 128, 256, 384]);
    expect(images?.minimumCacheTTL).toBeGreaterThanOrEqual(60);
  });

  it("should list sharp in production dependencies", () => {
    expect(pkg.dependencies).toHaveProperty("sharp");
    expect(pkg.dependencies.sharp).toBeTruthy();
  });

  it("should have zero un-migrated raw <img tags in src/app and src/components", () => {
    const srcDir = path.resolve(__dirname, "../../src");
    
    function scanDir(dir: string): string[] {
      let files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx"))) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const tsxFiles = scanDir(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        // Match <img (case-sensitive or lowercase JSX) but not <img> in comments or imports.
        // Quoted string literals are stripped first: transactional email templates
        // legitimately embed raw <img> markup as data strings (email HTML cannot
        // use next/image), which is not an un-migrated storefront raster image.
        // Complete template literals go before the unterminated-tail pattern so
        // a closing backtick's trailing `)}` is not eaten first.
        const codeOnly = line.replace(/`[^`]*`/g, "").replace(/`[^`]*$/g, "").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
        if (/<img(\s|>)/i.test(codeOnly) && !line.trim().startsWith("//") && !line.trim().startsWith("/*") && !line.trim().startsWith("*")) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
