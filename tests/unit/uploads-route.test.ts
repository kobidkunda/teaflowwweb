import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GET, HEAD } from "@/app/uploads/[...path]/route";
import { getUploadsDir } from "@/lib/uploads";

describe("Uploads Route Handler (/uploads/[...path])", () => {
  const uploadsDir = getUploadsDir();
  const testFilename = "test_route_fixture_1920x800.webp";
  const testFilePath = path.join(uploadsDir, testFilename);

  beforeAll(async () => {
    // 1x1 dummy webp header bytes
    const sampleWebp = Buffer.from(
      "524946461a00000057454250565038200e0000003001009d012a010001000000",
      "hex"
    );
    await fs.promises.writeFile(testFilePath, sampleWebp);
  });

  afterAll(async () => {
    try {
      await fs.promises.unlink(testFilePath);
    } catch {
      // ignore
    }
  });

  it("serves an existing uploaded file with 200 and image/webp Content-Type", async () => {
    const req = new Request(`http://localhost:3000/uploads/${testFilename}`);
    const res = await GET(req, {
      params: Promise.resolve({ path: [testFilename] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("public");
    expect(res.headers.get("etag")).toBeDefined();

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("returns 304 Not Modified when ETag matches If-None-Match header", async () => {
    const req1 = new Request(`http://localhost:3000/uploads/${testFilename}`);
    const res1 = await GET(req1, {
      params: Promise.resolve({ path: [testFilename] }),
    });
    const etag = res1.headers.get("etag")!;

    const req2 = new Request(`http://localhost:3000/uploads/${testFilename}`, {
      headers: { "if-none-match": etag },
    });
    const res2 = await GET(req2, {
      params: Promise.resolve({ path: [testFilename] }),
    });

    expect(res2.status).toBe(304);
  });

  it("supports HEAD request returning headers without body", async () => {
    const req = new Request(`http://localhost:3000/uploads/${testFilename}`, {
      method: "HEAD",
    });
    const res = await HEAD(req, {
      params: Promise.resolve({ path: [testFilename] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const text = await res.text();
    expect(text).toBe("");
  });

  it("returns 404 for non-existent file", async () => {
    const req = new Request("http://localhost:3000/uploads/non_existent_file_9999.webp");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["non_existent_file_9999.webp"] }),
    });

    expect(res.status).toBe(404);
  });

  it("blocks directory traversal attempts with 403 Forbidden", async () => {
    const req = new Request("http://localhost:3000/uploads/../../etc/passwd");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
    });

    expect(res.status).toBe(403);
  });
});
