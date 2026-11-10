import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import {
  getBrochureSettings,
  updateBrochureSettings,
  getBrochureLocalPath,
  formatBytes,
} from "@/lib/brochure";
import { getUploadsDir } from "@/lib/uploads";
import {
  GET as adminBrochureGET,
  POST as adminBrochurePOST,
  DELETE as adminBrochureDELETE,
} from "@/app/api/admin/brochure/route";
import { GET as publicBrochureGET } from "@/app/api/brochure/route";
import { GET as publicBrochureDownloadGET } from "@/app/api/brochure/download/route";
import BrochurePage from "@/app/brochure/page";

describe("Brochure & Product Catalogue Module", () => {
  let env: TestEnv;
  let authCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");

    // Ensure dummy brochure PDF exists in uploadsDir
    const uploadsDir = getUploadsDir();
    const samplePath = path.join(uploadsDir, "test-brochure.pdf");
    fs.writeFileSync(samplePath, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
  });

  afterAll(() => {
    try {
      const samplePath = path.join(getUploadsDir(), "test-brochure.pdf");
      if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);
    } catch {}
    env.cleanup();
  });

  describe("Utility & Settings Management (src/lib/brochure.ts)", () => {
    it("formatBytes formats byte counts cleanly", () => {
      expect(formatBytes(null)).toBeNull();
      expect(formatBytes(undefined)).toBeNull();
      expect(formatBytes(0)).toBeNull();
      expect(formatBytes(-100)).toBeNull();
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(2048)).toBe("2.0 KB");
      expect(formatBytes(3230)).toBe("3.2 KB");
      expect(formatBytes(15 * 1024 * 1024)).toBe("15.00 MB");
    });

    it("getBrochureLocalPath safely resolves local paths and blocks directory traversal", () => {
      // Valid path in uploads
      const valid = getBrochureLocalPath("/uploads/test-brochure.pdf");
      expect(valid).not.toBeNull();
      expect(valid?.endsWith("test-brochure.pdf")).toBe(true);

      // Traversal attacks must return null
      expect(getBrochureLocalPath("/uploads/../../etc/passwd")).toBeNull();
      expect(getBrochureLocalPath("../../../secret.env")).toBeNull();
      expect(getBrochureLocalPath("http://external.com/brochure.pdf")).toBeNull();
      expect(getBrochureLocalPath("https://external.com/brochure.pdf")).toBeNull();
      expect(getBrochureLocalPath("")).toBeNull();
      expect(getBrochureLocalPath(null)).toBeNull();
    });

    it("retrieves baseline brochure settings with sensible defaults", () => {
      const settings = getBrochureSettings();
      expect(settings).toBeDefined();
      expect(typeof settings.title).toBe("string");
      expect(typeof settings.button_label).toBe("string");
      expect(typeof settings.enabled).toBe("boolean");
    });

    it("updates brochure settings transactionally in store_settings", () => {
      const updated = updateBrochureSettings({
        url: "/uploads/test-brochure.pdf",
        title: "TeaFloww Special Reserve Harvest 2026",
        description: "Official cupping and tasting profiles of spring flush harvests.",
        button_label: "Download Full Catalogue",
        enabled: true,
      });

      expect(updated.title).toBe("TeaFloww Special Reserve Harvest 2026");
      expect(updated.url).toBe("/uploads/test-brochure.pdf");
      expect(updated.button_label).toBe("Download Full Catalogue");
      expect(updated.enabled).toBe(true);
      expect(updated.file_exists).toBe(true);
      expect(updated.file_size).toBeGreaterThan(0);

      // Verify persistence via direct read
      const fresh = getBrochureSettings();
      expect(fresh.title).toBe("TeaFloww Special Reserve Harvest 2026");
    });
  });

  describe("Admin Brochure API (/api/admin/brochure)", () => {
    it("guards GET /api/admin/brochure from unauthenticated requests", async () => {
      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "GET",
      });
      const res = await adminBrochureGET(req);
      expect(res.status).toBe(401);
    });

    it("allows authenticated admin to GET current settings and media library PDFs", async () => {
      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "GET",
        headers: { Cookie: authCookie },
      });
      const res = await adminBrochureGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.settings.title).toBe("TeaFloww Special Reserve Harvest 2026");
      expect(Array.isArray(json.recentPdfs)).toBe(true);
    });

    it("guards POST /api/admin/brochure from unauthenticated requests", async () => {
      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brochure_title: "Hacked Title" }),
      });
      const res = await adminBrochurePOST(req);
      expect(res.status).toBe(401);
    });

    it("updates brochure settings via JSON POST", async () => {
      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "POST",
        headers: {
          Cookie: authCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brochure_title: "TeaFloww 2026 Sourcing Brochure",
          brochure_description: "Darjeeling, Assam, and Dooars tea brochure.",
          brochure_button_label: "Download Brochure (PDF)",
          brochure_enabled: true,
          brochure_url: "/uploads/test-brochure.pdf",
        }),
      });

      const res = await adminBrochurePOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.settings.title).toBe("TeaFloww 2026 Sourcing Brochure");
      expect(json.settings.button_label).toBe("Download Brochure (PDF)");
    });

    it("rejects invalid JSON payload with 400", async () => {
      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "POST",
        headers: {
          Cookie: authCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brochure_title: "", // empty title violates min(1)
        }),
      });

      const res = await adminBrochurePOST(req);
      expect(res.status).toBe(400);
    });

    it("uploads and attaches a new PDF brochure via multipart/form-data POST", async () => {
      const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([pdfBytes], { type: "application/pdf" }),
        "harvest-catalogue-spring-2026.pdf"
      );
      formData.append("title", "Harvest Catalogue Spring 2026");
      formData.append("description", "Direct estate harvest specifications.");
      formData.append("button_label", "Download Harvest PDF");
      formData.append("enabled", "1");

      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "POST",
        headers: {
          Cookie: authCookie,
        },
        body: formData,
      });

      const res = await adminBrochurePOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.settings.title).toBe("Harvest Catalogue Spring 2026");
      expect(json.settings.url).toContain("harvest-catalogue-spring-2026");
      expect(json.settings.file_exists).toBe(true);
    });

    it("disables brochure download on website via DELETE /api/admin/brochure", async () => {
      const req = new Request("http://localhost:3000/api/admin/brochure", {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });
      const res = await adminBrochureDELETE(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.settings.enabled).toBe(false);
    });
  });

  describe("Public Storefront API & Download Routes", () => {
    it("returns public brochure metadata via GET /api/brochure", async () => {
      // First enable the brochure
      updateBrochureSettings({
        url: "/uploads/test-brochure.pdf",
        title: "Public Single-Estate Catalogue",
        description: "Public tea tasting notes.",
        button_label: "Download Brochure",
        enabled: true,
      });

      const res = await publicBrochureGET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enabled).toBe(true);
      expect(json.title).toBe("Public Single-Estate Catalogue");
      expect(json.download_url).toBe("/api/brochure/download");
    });

    it("serves PDF file with attachment disposition via GET /api/brochure/download", async () => {
      const req = new Request("http://localhost:3000/api/brochure/download");
      const res = await publicBrochureDownloadGET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
      expect(res.headers.get("Cache-Control")).toContain("public");

      const arrayBuf = await res.arrayBuffer();
      const text = Buffer.from(arrayBuf).toString("utf-8");
      expect(text.startsWith("%PDF-")).toBe(true);
    });

    it("serves PDF file with inline disposition when ?view=1 is requested", async () => {
      const req = new Request("http://localhost:3000/api/brochure/download?view=1");
      const res = await publicBrochureDownloadGET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toContain("inline; filename=");
    });

    it("returns 404 when brochure is disabled", async () => {
      updateBrochureSettings({ enabled: false });
      const req = new Request("http://localhost:3000/api/brochure/download");
      const res = await publicBrochureDownloadGET(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBeDefined();

      // Restore enabled
      updateBrochureSettings({ enabled: true });
    });
  });

  describe("Storefront /brochure Page", () => {
    it("renders the brochure landing page with semantic headings and download button", () => {
      updateBrochureSettings({
        url: "/uploads/test-brochure.pdf",
        title: "TeaFloww 2026 Sourcing Brochure",
        description: "Explore single-estate orthodox teas direct from Siliguri.",
        button_label: "Download Brochure (PDF)",
        enabled: true,
      });

      const markup = renderToStaticMarkup(React.createElement(BrochurePage));
      expect(markup).toContain("TeaFloww 2026 Sourcing Brochure");
      expect(markup).toContain("Explore single-estate orthodox teas direct from Siliguri.");
      expect(markup).toContain("/api/brochure/download");
      expect(markup).toContain("Download Brochure (PDF)");
      expect(markup).toContain("Single-Estate Provenance");
      expect(markup).toContain("Sensory Cupping &amp; Grades");
      expect(markup).toContain("Direct Siliguri Logistics");
    });
  });
});
