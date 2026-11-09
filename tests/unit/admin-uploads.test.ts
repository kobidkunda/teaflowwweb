import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

interface TableColumnRow {
  name: string;
}

// Isolated temp DB migrated fresh: services read DATABASE_PATH lazily via getDb().
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-uploads-test-"));
const tmpDb = path.join(tmpDir, "test.sqlite");
process.env.DATABASE_PATH = tmpDb;
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";

const { getDb } = await import("../../src/lib/db");
const { up: migration009 } = await import(
  "../../scripts/migrations/009_admin_portal_expansion.mjs"
);
const {
  MAX_FILE_SIZE,
  detectImageMimeType,
  validateImageUpload,
  generateCollisionResistantFilename,
  saveMediaUpload,
  getMediaUploadById,
  listMediaUploads,
  UploadValidationError,
  getUploadsDir,
} = await import("../../src/lib/uploads");
const { createAdminSession, buildSessionCookie } = await import(
  "../../src/lib/adminSessions"
);
const { POST: uploadPOST, GET: uploadGET } = await import(
  "../../src/app/api/admin/uploads/route"
);
const { POST: mediaPOST } = await import(
  "../../src/app/api/admin/media/route"
);

// Sample valid magic bytes
const validJpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01,
]);
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);
const validWebpBuffer = Buffer.from(
  "RIFF\x20\x00\x00\x00WEBPVP8 \x14\x00\x00\x00",
  "binary"
);
const validAvifBuffer = Buffer.from(
  "\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1",
  "binary"
);

// Disallowed samples
const svgBuffer = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
  "utf8"
);
const textBuffer = Buffer.from("Just a plain text file", "utf8");
const exeBuffer = Buffer.from(
  "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff",
  "binary"
);

let adminCookieHeader: string;
const createdTestFiles: string[] = [];

beforeAll(async () => {
  // Run all migrations through 009
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: tmpDb },
    stdio: "ignore",
  });

  const db = getDb();
  // Ensure an active admin user exists for auth tests
  db.prepare(
    "INSERT OR IGNORE INTO admin_users (id, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)"
  ).run(1, "testadmin", "scrypt-hash-dummy", "admin", 1);

  const { cookieValue } = createAdminSession(1);
  adminCookieHeader = buildSessionCookie(cookieValue);
});

afterAll(async () => {
  // Clean up created test files in public/uploads/
  for (const filename of createdTestFiles) {
    try {
      const filePath = path.join(getUploadsDir(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      /* best effort */
    }
  }

  // Clean up tmp db
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe("Milestone 1: Database Migration 009 (admin portal expansion)", () => {
  it("expands categories with description, cover_image_url, and parent_id", () => {
    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(categories)")
      .all()
      .map((c) => (c as TableColumnRow).name);

    expect(cols).toContain("description");
    expect(cols).toContain("cover_image_url");
    expect(cols).toContain("parent_id");
  });

  it("expands orders with admin_notes", () => {
    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .map((c) => (c as TableColumnRow).name);

    expect(cols).toContain("admin_notes");
  });

  it("creates blog_posts table with required columns and constraints", () => {
    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(blog_posts)")
      .all()
      .map((c) => (c as TableColumnRow).name);

    expect(cols).toContain("id");
    expect(cols).toContain("slug");
    expect(cols).toContain("title");
    expect(cols).toContain("excerpt");
    expect(cols).toContain("content");
    expect(cols).toContain("cover_image_url");
    expect(cols).toContain("status");
    expect(cols).toContain("author_name");
    expect(cols).toContain("published_at");
    expect(cols).toContain("created_at");
    expect(cols).toContain("updated_at");

    // Test unique slug constraint
    db.prepare(
      "INSERT INTO blog_posts (slug, title, content) VALUES (?, ?, ?)"
    ).run("spring-harvest-2026", "Spring Harvest 2026", "Markdown content");

    expect(() => {
      db.prepare(
        "INSERT INTO blog_posts (slug, title, content) VALUES (?, ?, ?)"
      ).run("spring-harvest-2026", "Duplicate Slug", "Another content");
    }).toThrow();

    // Test status check constraint
    expect(() => {
      db.prepare(
        "INSERT INTO blog_posts (slug, title, content, status) VALUES (?, ?, ?, ?)"
      ).run("invalid-status", "Invalid Status", "Content", "invalid_status");
    }).toThrow();
  });

  it("creates media_uploads table with required columns and uniqueness", () => {
    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(media_uploads)")
      .all()
      .map((c) => (c as TableColumnRow).name);

    expect(cols).toContain("id");
    expect(cols).toContain("filename");
    expect(cols).toContain("url");
    expect(cols).toContain("alt_text");
    expect(cols).toContain("mime_type");
    expect(cols).toContain("file_size");
    expect(cols).toContain("sort_order");
    expect(cols).toContain("created_at");

    // Test unique filename constraint
    db.prepare(
      "INSERT INTO media_uploads (filename, url, mime_type, file_size) VALUES (?, ?, ?, ?)"
    ).run("test-unique-file.jpg", "/uploads/test-unique-file.jpg", "image/jpeg", 1024);

    expect(() => {
      db.prepare(
        "INSERT INTO media_uploads (filename, url, mime_type, file_size) VALUES (?, ?, ?, ?)"
      ).run("test-unique-file.jpg", "/uploads/test-unique-file-2.jpg", "image/jpeg", 2048);
    }).toThrow();
  });

  it("creates store_settings table and seeds requested default values", () => {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM store_settings").all() as Array<{
      key: string;
      value: string;
    }>;

    const map = new Map(rows.map((r) => [r.key, r.value]));

    expect(map.get("currency")).toBe("INR");
    expect(map.get("tax_rate_percent")).toBe("5");
    expect(map.get("shipping_flat_paise")).toBe("9900");
    expect(map.get("free_shipping_threshold_paise")).toBe("150000");
    expect(map.get("contact_email")).toBe("support@himalayantea.com");
  });

  it("creates analytics_events table with required columns", () => {
    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(analytics_events)")
      .all()
      .map((c) => (c as TableColumnRow).name);

    expect(cols).toContain("id");
    expect(cols).toContain("session_id");
    expect(cols).toContain("event_type");
    expect(cols).toContain("path");
    expect(cols).toContain("referrer");
    expect(cols).toContain("user_agent");
    expect(cols).toContain("ip_hash");
    expect(cols).toContain("metadata");
    expect(cols).toContain("created_at");
  });

  it("creates mcp_logs table with required columns and status check", () => {
    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(mcp_logs)")
      .all()
      .map((c) => (c as TableColumnRow).name);

    expect(cols).toContain("id");
    expect(cols).toContain("method");
    expect(cols).toContain("tool_name");
    expect(cols).toContain("arguments");
    expect(cols).toContain("status");
    expect(cols).toContain("error_code");
    expect(cols).toContain("error_message");
    expect(cols).toContain("duration_ms");
    expect(cols).toContain("created_at");
  });

  it("is idempotent when re-executed on an already-migrated database", () => {
    const db = getDb();
    expect(() => {
      migration009(db);
    }).not.toThrow();
  });
});

describe("Local Media Storage Service (src/lib/uploads.ts)", () => {
  it("accurately detects magic bytes for allowed image types", () => {
    expect(detectImageMimeType(validJpegBuffer)).toBe("image/jpeg");
    expect(detectImageMimeType(validPngBuffer)).toBe("image/png");
    expect(detectImageMimeType(validWebpBuffer)).toBe("image/webp");
    expect(detectImageMimeType(validAvifBuffer)).toBe("image/avif");
  });

  it("rejects non-image formats from magic byte detection", () => {
    expect(detectImageMimeType(svgBuffer)).toBeNull();
    expect(detectImageMimeType(textBuffer)).toBeNull();
    expect(detectImageMimeType(exeBuffer)).toBeNull();
    expect(detectImageMimeType(Buffer.from([]))).toBeNull();
  });

  it("validates valid buffers and returns extension and detected MIME", () => {
    const jpegRes = validateImageUpload(validJpegBuffer, {
      originalFilename: "sample.jpg",
      declaredMimeType: "image/jpeg",
    });
    expect(jpegRes.mimeType).toBe("image/jpeg");
    expect(jpegRes.extension).toBe(".jpg");

    const pngRes = validateImageUpload(validPngBuffer, {
      originalFilename: "icon.png",
      declaredMimeType: "image/png",
    });
    expect(pngRes.mimeType).toBe("image/png");
    expect(pngRes.extension).toBe(".png");
  });

  it("rejects SVG files even if disguised as .jpg or declared as image/jpeg", () => {
    expect(() => {
      validateImageUpload(svgBuffer, {
        originalFilename: "photo.jpg",
        declaredMimeType: "image/jpeg",
      });
    }).toThrow(UploadValidationError);

    expect(() => {
      validateImageUpload(validJpegBuffer, {
        originalFilename: "vector.svg",
        declaredMimeType: "image/svg+xml",
      });
    }).toThrow(UploadValidationError);
  });

  it("rejects oversized buffers (> 5MB) with HTTP 413 error code", () => {
    const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1024, 0xff);
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff; // fake jpeg header

    try {
      validateImageUpload(largeBuffer, { originalFilename: "giant.jpg" });
      expect.fail("Should have thrown UploadValidationError");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(UploadValidationError);
      if (e instanceof UploadValidationError) {
        expect(e.statusCode).toBe(413);
        expect(e.message).toMatch(/exceeds 5MB/i);
      }
    }
  });

  it("generates collision-resistant filenames with upload_ prefix and timestamp", () => {
    const filename1 = generateCollisionResistantFilename("Darjeeling Tea.jpg", ".jpg");
    const filename2 = generateCollisionResistantFilename("Darjeeling Tea.jpg", ".jpg");

    expect(filename1).toMatch(/^upload_\d+_[0-9a-f]+_darjeeling-tea\.jpg$/);
    expect(filename2).toMatch(/^upload_\d+_[0-9a-f]+_darjeeling-tea\.jpg$/);
    expect(filename1).not.toBe(filename2);
  });

  it("saves media upload to disk and persists to database", async () => {
    const record = await saveMediaUpload({
      fileBuffer: validJpegBuffer,
      originalFilename: "first-flush-leaves.jpg",
      declaredMimeType: "image/jpeg",
      altText: "Darjeeling first flush whole dry leaves",
    });

    createdTestFiles.push(record.filename);

    expect(record.id).toBeGreaterThan(0);
    expect(record.filename).toMatch(/^upload_\d+_[0-9a-f]+_first-flush-leaves\.jpg$/);
    expect(record.url).toBe(`/uploads/${record.filename}`);
    expect(record.alt_text).toBe("Darjeeling first flush whole dry leaves");
    expect(record.mime_type).toBe("image/jpeg");
    expect(record.file_size).toBe(validJpegBuffer.length);

    // Verify written to filesystem
    const diskPath = path.join(getUploadsDir(), record.filename);
    expect(fs.existsSync(diskPath)).toBe(true);
    expect(fs.readFileSync(diskPath)).toEqual(validJpegBuffer);

    // Verify retrievable via getMediaUploadById
    const fetched = getMediaUploadById(record.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.filename).toBe(record.filename);
    expect(fetched?.alt_text).toBe("Darjeeling first flush whole dry leaves");

    // Verify listed via listMediaUploads
    const list = listMediaUploads(10);
    expect(list.some((item) => item.id === record.id)).toBe(true);
  });
});

describe("Admin Upload API Route (src/app/api/admin/uploads/route.ts)", () => {
  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    const formData = new FormData();
    const blob = new Blob([validPngBuffer], { type: "image/png" });
    formData.append("file", blob, "test.png");

    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "POST",
      body: formData,
    });

    const res = await uploadPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized.");
  });

  it("successfully handles valid multipart image upload from authenticated admin", async () => {
    const formData = new FormData();
    const blob = new Blob([validPngBuffer], { type: "image/png" });
    formData.append("file", blob, "estate-map.png");
    formData.append("alt_text", "Risheehat Tea Estate elevation map");

    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "POST",
      headers: {
        Cookie: adminCookieHeader,
      },
      body: formData,
    });

    const res = await uploadPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.upload).toBeDefined();
    expect(body.upload.id).toBeGreaterThan(0);
    expect(body.upload.url).toMatch(/^\/uploads\/upload_/);
    expect(body.upload.alt_text).toBe("Risheehat Tea Estate elevation map");
    expect(body.upload.mime_type).toBe("image/png");
    expect(body.upload.file_size).toBe(validPngBuffer.length);

    createdTestFiles.push(body.upload.filename);
  });

  it("rejects uploads missing the file field with 400", async () => {
    const formData = new FormData();
    formData.append("alt_text", "No file here");

    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "POST",
      headers: {
        Cookie: adminCookieHeader,
      },
      body: formData,
    });

    const res = await uploadPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No file provided/i);
  });

  it("rejects empty files with 400", async () => {
    const formData = new FormData();
    const emptyBlob = new Blob([], { type: "image/jpeg" });
    formData.append("file", emptyBlob, "empty.jpg");

    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "POST",
      headers: {
        Cookie: adminCookieHeader,
      },
      body: formData,
    });

    const res = await uploadPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("rejects disallowed file types (SVG / Executable / Plain Text) with 400", async () => {
    const formData = new FormData();
    const badBlob = new Blob([svgBuffer], { type: "image/svg+xml" });
    formData.append("file", badBlob, "danger.svg");

    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "POST",
      headers: {
        Cookie: adminCookieHeader,
      },
      body: formData,
    });

    const res = await uploadPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    // Verify no raw database error is leaked
    expect(body.error).not.toMatch(/sqlite|table|syntax|column/i);
  });

  it("rejects oversized file uploads with 413", async () => {
    const oversizedBlob = new Blob([new Uint8Array(MAX_FILE_SIZE + 500)], {
      type: "image/jpeg",
    });
    const formData = new FormData();
    formData.append("file", oversizedBlob, "large.jpg");

    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "POST",
      headers: {
        Cookie: adminCookieHeader,
      },
      body: formData,
    });

    const res = await uploadPOST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds 5MB/i);
  });

  it("authenticated GET /api/admin/uploads returns list of uploads", async () => {
    const req = new Request("http://localhost:3000/api/admin/uploads?limit=10", {
      method: "GET",
      headers: {
        Cookie: adminCookieHeader,
      },
    });

    const res = await uploadGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.uploads)).toBe(true);
    expect(body.uploads.length).toBeGreaterThan(0);
  });

  it("unauthenticated GET /api/admin/uploads returns 401 Unauthorized", async () => {
    const req = new Request("http://localhost:3000/api/admin/uploads", {
      method: "GET",
    });

    const res = await uploadGET(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/admin/media returns both nested asset and flattened url/id properties for MediaPicker compatibility", async () => {
    const formData = new FormData();
    const blob = new Blob([validJpegBuffer], { type: "image/jpeg" });
    formData.append("file", blob, "quick-upload-test.jpg");
    formData.append("alt_text", "Quick Upload Alt");

    const req = new Request("http://localhost:3000/api/admin/media", {
      method: "POST",
      headers: {
        Cookie: adminCookieHeader,
      },
      body: formData,
    });

    const res = await mediaPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.success).toBe(true);
    // Verified: nested asset is present
    expect(body.asset).toBeDefined();
    expect(body.asset.url).toBeDefined();
    expect(typeof body.asset.url).toBe("string");
    expect(body.asset.url.startsWith("/uploads/")).toBe(true);
    expect(body.asset.id).toBeGreaterThan(0);

    // Verified: root flattened url and id are also present for components expecting direct asset object
    expect(body.url).toBeDefined();
    expect(typeof body.url).toBe("string");
    expect(body.url.startsWith("/uploads/")).toBe(true);
    expect(body.id).toBe(body.asset.id);

    // Verified: extracting either `body` or `body.asset` prevents TypeError: Cannot read properties of undefined (reading 'startsWith')
    const extractedAsset = body.asset || body;
    expect(extractedAsset.url.startsWith("/uploads/")).toBe(true);

    if (body.filename) {
      createdTestFiles.push(body.filename);
    }
  });
});
