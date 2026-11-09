import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GET as ogGetHandler, HEAD as ogHeadHandler } from "@/app/api/og/route";
import { constructMetadata } from "@/lib/seo/metadata";

describe("Open Graph & Social Share Dynamic Resizing API (/api/og)", () => {
  it("generates default 1200x630 JPEG under 300KB when called with no parameters", async () => {
    const req = new Request("https://teafloww.com/api/og");
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toContain("public");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Must be under WhatsApp's 300KB ceiling
    expect(buffer.length).toBeLessThan(300 * 1024);

    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("resizes square product images (1024x1024) into centered 1200x630 JPEG with atmospheric background (<300KB)", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=/uploads/product-darjeeling-tin.jpg"
    );
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");

    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.length).toBeLessThan(300 * 1024);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
    expect(meta.format).toBe("jpeg");
  });

  it("resizes category square images into 1200x630 JPEG under 300KB", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=/uploads/cat-black-tea.jpg"
    );
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");

    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.length).toBeLessThan(300 * 1024);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("resizes landscape hero images into 1200x630 JPEG with cover fit", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=/images/hero-himalayan-tea.jpg"
    );
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.length).toBeLessThan(300 * 1024);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("safely handles non-existent image paths by serving fallback without crashing", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=/uploads/non-existent-tea-xyz.jpg"
    );
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");

    const buffer = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("blocks directory traversal attempts and serves fallback", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=../../etc/passwd"
    );
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("blocks SSRF attempts to external URLs and serves fallback", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=http://169.254.169.254/latest/meta-data"
    );
    const res = await ogGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("supports HEAD requests for social crawler content-length/type checks", async () => {
    const req = new Request(
      "https://teafloww.com/api/og?image=/uploads/product-darjeeling-tin.jpg"
    );
    const res = await ogHeadHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Length")).toBeTruthy();
    expect(Number(res.headers.get("Content-Length"))).toBeGreaterThan(0);
  });
});

describe("Metadata Engine Social Media Integration (constructMetadata)", () => {
  it("routes raw product upload image through /api/og with 1200x630 tags", () => {
    const meta = constructMetadata({
      title: "Darjeeling Spring",
      description: "First flush single estate.",
      path: "/tea/darjeeling-spring",
      ogImage: "/uploads/product-darjeeling-tin.jpg",
    });

    const ogImages = meta.openGraph?.images as Array<{
      url: string;
      secureUrl?: string;
      width?: number;
      height?: number;
      type?: string;
    }>;

    expect(ogImages).toBeDefined();
    expect(ogImages).toHaveLength(1);
    expect(ogImages[0].url).toContain("/api/og?image=");
    expect(ogImages[0].url).toContain(encodeURIComponent("/uploads/product-darjeeling-tin.jpg"));
    expect(ogImages[0].secureUrl).toBe(ogImages[0].url);
    expect(ogImages[0].width).toBe(1200);
    expect(ogImages[0].height).toBe(630);
    expect(ogImages[0].type).toBe("image/jpeg");

    // Twitter Card
    const twitter = meta.twitter as { card?: string; images?: string[] };
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.images?.[0]).toBe(ogImages[0].url);
  });

  it("uses default static OG image when ogImage is omitted", () => {
    const meta = constructMetadata({
      title: "Himalayan Tea House",
      path: "/",
    });

    const ogImages = meta.openGraph?.images as Array<{ url: string; width?: number; height?: number }>;
    expect(ogImages[0].url).toContain("/images/og-himalayan-tea-house.jpg");
    expect(ogImages[0].width).toBe(1200);
    expect(ogImages[0].height).toBe(630);
  });
});

describe("Static OpenGraph Physical Files On Disk", () => {
  const imagesDir = path.join(process.cwd(), "public", "images");

  const requiredFiles = [
    "og-himalayan-tea-house.jpg",
    "og-default.jpg",
    "assam-brewing-guide.jpg",
    "darjeeling-first-flush.jpg",
    "cupping-guide.jpg",
    "orthodox-vs-ctc.jpg",
  ];

  for (const fileName of requiredFiles) {
    it(`verifies ${fileName} exists and is 1200x630 JPEG under 300KB`, async () => {
      const filePath = path.join(imagesDir, fileName);
      expect(fs.existsSync(filePath), `Missing ${fileName}`).toBe(true);

      const stat = fs.statSync(filePath);
      expect(stat.size).toBeLessThan(300 * 1024);

      const meta = await sharp(filePath).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(630);
    });
  }
});
