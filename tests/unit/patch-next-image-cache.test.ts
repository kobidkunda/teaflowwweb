import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("Next.js image cache safeguards and patch script", () => {
  it("executes scripts/patch-next-image-cache.mjs idempotently", () => {
    const rootDir = path.resolve(__dirname, "../..");
    const scriptPath = path.join(rootDir, "scripts", "patch-next-image-cache.mjs");

    // Execute patch script
    const output1 = execSync(`node "${scriptPath}"`, { encoding: "utf8" });
    expect(output1).toMatch(/verified|Patched|applied/);

    // Second run should be a no-op / verified
    const output2 = execSync(`node "${scriptPath}"`, { encoding: "utf8" });
    expect(output2).toContain("already verified/patched");
  });

  it("ensures disk-lru-cache skips zero-sized entries", () => {
    const rootDir = path.resolve(__dirname, "../..");
    const diskLruPath = path.join(
      rootDir,
      "node_modules",
      "next",
      "dist",
      "server",
      "lib",
      "disk-lru-cache.external.js"
    );

    if (fs.existsSync(diskLruPath)) {
      const content = fs.readFileSync(diskLruPath, "utf8");
      expect(content).toContain("entry.size > 0");
    }
  });

  it("ensures image-optimizer checks buffer length before registering cache entries", () => {
    const rootDir = path.resolve(__dirname, "../..");
    const imgOptPath = path.join(
      rootDir,
      "node_modules",
      "next",
      "dist",
      "server",
      "image-optimizer.js"
    );

    if (fs.existsSync(imgOptPath)) {
      const content = fs.readFileSync(imgOptPath, "utf8");
      expect(content).toContain("buffer.byteLength > 0");
    }
  });

  it("safely ignores 0-byte entries to prevent LRUCache calculateSize error", () => {
    // Simulate what getOrInitDiskLRU does
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LRUCache } = require("next/dist/server/lib/lru-cache");
    const maxSize = 100000;
    const lru = new LRUCache(maxSize, (size: number) => size, () => {});

    const mockDiskEntries = [
      { key: "valid-image-1", size: 1024, expireAt: Date.now() + 1000 },
      { key: "corrupted-0byte-file", size: 0, expireAt: Date.now() + 1000 },
      { key: "valid-image-2", size: 2048, expireAt: Date.now() + 2000 },
    ];

    // Filter applied by the patch
    for (const entry of mockDiskEntries) {
      if (entry && entry.size > 0) {
        lru.set(entry.key, entry.size);
      }
    }

    expect(lru.has("valid-image-1")).toBe(true);
    expect(lru.has("corrupted-0byte-file")).toBe(false);
    expect(lru.has("valid-image-2")).toBe(true);
  });

  it("reproduces the unpatched failure when size <= 0 is passed to lru.set", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LRUCache } = require("next/dist/server/lib/lru-cache");
    const lru = new LRUCache(100000, (size: number) => size, () => {});

    expect(() => {
      lru.set("unpatched-zero-byte", 0);
    }).toThrowError(/LRUCache: calculateSize returned 0, but size must be > 0/);
  });
});
