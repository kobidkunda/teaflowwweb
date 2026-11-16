import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const nextDir = path.join(rootDir, "node_modules", "next");

if (!fs.existsSync(nextDir)) {
  console.log("[patch-next-image-cache] Next.js is not installed yet; skipping patch.");
  process.exit(0);
}

let patchedAny = false;

// 1. Patch disk-lru-cache.external.js in both dist/server and dist/esm/server
const diskLruFiles = [
  path.join(nextDir, "dist", "server", "lib", "disk-lru-cache.external.js"),
  path.join(nextDir, "dist", "esm", "server", "lib", "disk-lru-cache.external.js"),
];

for (const filePath of diskLruFiles) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");

  // Skip if already patched
  if (content.includes("entry.size > 0")) {
    continue;
  }

  const target = "for (const entry of entries){\n                lru.set(entry.key, entry.size);\n            }";
  const alternateTarget = "for (const entry of entries){\n        lru.set(entry.key, entry.size);\n    }";

  const replacement = "for (const entry of entries){\n                if (entry && entry.size > 0) {\n                    lru.set(entry.key, entry.size);\n                }\n            }";
  const alternateReplacement = "for (const entry of entries){\n        if (entry && entry.size > 0) {\n            lru.set(entry.key, entry.size);\n        }\n    }";

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
    patchedAny = true;
    console.log(`[patch-next-image-cache] Patched ${path.relative(rootDir, filePath)}`);
  } else if (content.includes(alternateTarget)) {
    content = content.replace(alternateTarget, alternateReplacement);
    fs.writeFileSync(filePath, content, "utf8");
    patchedAny = true;
    console.log(`[patch-next-image-cache] Patched ${path.relative(rootDir, filePath)}`);
  }
}

// 2. Patch image-optimizer.js in both dist/server and dist/esm/server
const imageOptimizerFiles = [
  path.join(nextDir, "dist", "server", "image-optimizer.js"),
  path.join(nextDir, "dist", "esm", "server", "image-optimizer.js"),
];

for (const filePath of imageOptimizerFiles) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");

  // Skip if already patched
  if (content.includes("buffer.byteLength > 0")) {
    continue;
  }

  const target = `const { expireAt, buffer } = await readFromCacheDir(cacheDir, cacheKey);
            entries.push({
                key: cacheKey,
                size: buffer.byteLength,
                expireAt
            });`;

  const replacement = `const { expireAt, buffer } = await readFromCacheDir(cacheDir, cacheKey);
            if (buffer && buffer.byteLength > 0) {
                entries.push({
                    key: cacheKey,
                    size: buffer.byteLength,
                    expireAt
                });
            } else if (typeof deleteFromCacheDir === "function") {
                deleteFromCacheDir(cacheDir, cacheKey).catch(()=>{});
            }`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
    patchedAny = true;
    console.log(`[patch-next-image-cache] Patched ${path.relative(rootDir, filePath)}`);
  }
}

if (!patchedAny) {
  console.log("[patch-next-image-cache] Next.js image cache files already verified/patched.");
} else {
  console.log("[patch-next-image-cache] All Next.js image cache safeguards applied successfully.");
}
