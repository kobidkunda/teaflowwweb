import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { upsertProduct, getProduct, getProductBySlug } from "@/lib/products";
import {
  detectPdfMimeType,
  validatePdfUpload,
  savePdfUpload,
  UploadValidationError,
  getUploadsDir,
} from "@/lib/uploads";
import { GET as uploadsRouteGet } from "@/app/uploads/[...path]/route";
import path from "node:path";
import fs from "node:fs";

describe("Product PDF Dossier & Certification Suite", () => {
  const dummyPdfHeader = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF");

  beforeEach(() => {
    const db = getDb();
    // Ensure test product slug clean with FK cascade
    const rows = db.prepare("SELECT id FROM products WHERE slug LIKE 'test-pdf-%'").all() as { id: number }[];
    for (const r of rows) {
      db.prepare("DELETE FROM variants WHERE product_id = ?").run(r.id);
      db.prepare("DELETE FROM product_images WHERE product_id = ?").run(r.id);
      db.prepare("DELETE FROM products WHERE id = ?").run(r.id);
    }
  });

  describe("1. PDF File Detection & Validation", () => {
    it("detects valid %PDF- header magic bytes", () => {
      expect(detectPdfMimeType(dummyPdfHeader)).toBe("application/pdf");
    });

    it("rejects non-PDF payloads (PNG, JPEG, HTML, SVG)", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const htmlHeader = Buffer.from("<!DOCTYPE html><html><body>Test</body></html>");
      expect(detectPdfMimeType(pngHeader)).toBeNull();
      expect(detectPdfMimeType(htmlHeader)).toBeNull();
    });

    it("validates valid PDF upload options", () => {
      const result = validatePdfUpload(dummyPdfHeader, {
        originalFilename: "Giddapahar-First-Flush-2026.pdf",
        declaredMimeType: "application/pdf",
      });
      expect(result.mimeType).toBe("application/pdf");
      expect(result.extension).toBe(".pdf");
    });

    it("throws UploadValidationError on empty buffer", () => {
      expect(() => validatePdfUpload(Buffer.alloc(0))).toThrow(UploadValidationError);
    });

    it("throws UploadValidationError when SVG masquerades as PDF", () => {
      const svgAsPdf = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><text>hello</text></svg>");
      expect(() =>
        validatePdfUpload(svgAsPdf, { originalFilename: "fake.pdf" })
      ).toThrow(UploadValidationError);
    });

    it("throws UploadValidationError when buffer exceeds 15MB", () => {
      const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
      largeBuffer[0] = 0x25;
      largeBuffer[1] = 0x50;
      largeBuffer[2] = 0x44;
      largeBuffer[3] = 0x46;
      largeBuffer[4] = 0x2d;
      expect(() => validatePdfUpload(largeBuffer)).toThrow("exceeds 15MB limit");
    });
  });

  describe("2. PDF Upload & Disk Storage", () => {
    it("saves a valid PDF upload to uploads directory and records in media_uploads", async () => {
      const record = await savePdfUpload({
        fileBuffer: dummyPdfHeader,
        originalFilename: "Estate-Certificate-2026.pdf",
        altText: "Certified Estate Organic Certificate",
        caption: "Single-estate tea harvest analysis",
      });

      expect(record.id).toBeGreaterThan(0);
      expect(record.url).toMatch(/^\/uploads\/upload_\d+_[a-f0-9]+_estate-certificate-2026\.pdf$/);
      expect(record.mime_type).toBe("application/pdf");
      expect(record.file_size).toBe(dummyPdfHeader.length);

      // Verify file physically exists on disk
      const uploadsDir = getUploadsDir();
      const filename = path.basename(record.url);
      const filePath = path.join(uploadsDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      // Clean up test file
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    });
  });

  describe("3. Product Model & Database Persistence with PDF", () => {
    it("creates a product with attached pdf_url and pdf_title", () => {
      const slug = "test-pdf-darjeeling-first-flush";
      const result = upsertProduct({
        slug,
        name: "Test PDF Darjeeling First Flush",
        origin: "Darjeeling, India",
        estate: "Giddapahar Estate",
        flush: "First Flush",
        harvest_date: "Spring 2026",
        description: "Exquisite high-elevation harvest.",
        tasting_notes: "Muscatel, citrus blossoms, mountain pine",
        brew_temp: 90,
        brew_seconds: 180,
        price: 350,
        pdf_url: "/uploads/giddapahar-harvest-dossier-2026.pdf",
        pdf_title: "2026 Giddapahar Estate Harvest & Cupping Dossier",
      });

      const product = getProduct(result.id);
      expect(product).toBeDefined();
      expect(product?.pdf_url).toBe("/uploads/giddapahar-harvest-dossier-2026.pdf");
      expect(product?.pdf_title).toBe("2026 Giddapahar Estate Harvest & Cupping Dossier");

      // Verify retrieval by slug
      const bySlug = getProductBySlug(slug);
      expect(bySlug?.pdf_url).toBe("/uploads/giddapahar-harvest-dossier-2026.pdf");
      expect(bySlug?.pdf_title).toBe("2026 Giddapahar Estate Harvest & Cupping Dossier");
    });

    it("updates an existing product's pdf_url and pdf_title", () => {
      const slug = "test-pdf-assam-golden-tips";
      const result = upsertProduct({
        slug,
        name: "Test Assam Golden Tips",
        origin: "Assam, India",
        estate: "Mangalam Estate",
        flush: "Second Flush",
        harvest_date: "Summer 2026",
        description: "Rich malty orthodoxy.",
        tasting_notes: "Malt, honey, cocoa",
        brew_temp: 95,
        brew_seconds: 240,
        price: 280,
      });

      // Initially no PDF
      const initial = getProduct(result.id);
      expect(initial?.pdf_url).toBeNull();
      expect(initial?.pdf_title).toBeNull();

      // Update with PDF
      upsertProduct({
        id: result.id,
        slug,
        name: "Test Assam Golden Tips",
        origin: "Assam, India",
        estate: "Mangalam Estate",
        flush: "Second Flush",
        harvest_date: "Summer 2026",
        description: "Rich malty orthodoxy.",
        tasting_notes: "Malt, honey, cocoa",
        brew_temp: 95,
        brew_seconds: 240,
        pdf_url: "/uploads/mangalam-cupping-sheet.pdf",
        pdf_title: "Mangalam Estate Cupping & Terroir Report",
      });

      const updated = getProduct(result.id);
      expect(updated?.pdf_url).toBe("/uploads/mangalam-cupping-sheet.pdf");
      expect(updated?.pdf_title).toBe("Mangalam Estate Cupping & Terroir Report");

      // Clear PDF
      upsertProduct({
        id: result.id,
        slug,
        name: "Test Assam Golden Tips",
        origin: "Assam, India",
        estate: "Mangalam Estate",
        flush: "Second Flush",
        harvest_date: "Summer 2026",
        description: "Rich malty orthodoxy.",
        tasting_notes: "Malt, honey, cocoa",
        brew_temp: 95,
        brew_seconds: 240,
        pdf_url: null,
        pdf_title: null,
      });

      const cleared = getProduct(result.id);
      expect(cleared?.pdf_url).toBeNull();
      expect(cleared?.pdf_title).toBeNull();
    });
  });

  describe("4. Uploads Serving Route for PDF", () => {
    it("serves PDF files with application/pdf and inline disposition, or attachment when download=1", async () => {
      // 1. Save a sample PDF file
      const record = await savePdfUpload({
        fileBuffer: dummyPdfHeader,
        originalFilename: "Tasting-Guide-Test.pdf",
      });
      const filename = path.basename(record.url);

      // 2. Request the file inline
      const inlineReq = new Request(`http://localhost:3000/uploads/${filename}`);
      const inlineRes = await uploadsRouteGet(inlineReq, {
        params: Promise.resolve({ path: [filename] }),
      });

      expect(inlineRes.status).toBe(200);
      expect(inlineRes.headers.get("Content-Type")).toBe("application/pdf");
      expect(inlineRes.headers.get("Content-Disposition")).toBe("inline");

      // 3. Request the file as direct download (?download=1)
      const dlReq = new Request(`http://localhost:3000/uploads/${filename}?download=1`);
      const dlRes = await uploadsRouteGet(dlReq, {
        params: Promise.resolve({ path: [filename] }),
      });

      expect(dlRes.status).toBe(200);
      expect(dlRes.headers.get("Content-Type")).toBe("application/pdf");
      expect(dlRes.headers.get("Content-Disposition")).toContain("attachment; filename=");

      // Cleanup
      const filePath = path.join(getUploadsDir(), filename);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    });
  });
});
