import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import sharp from "sharp";

const ROOT = process.cwd();
const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
const DB_PATH = path.join(ROOT, "data", "store.sqlite");

async function walkDir(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(await walkDir(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function cleanAndOptimizeUploads() {
  console.log("🔍 Collecting referenced upload assets from DB and codebase...");
  const referencedFilenames = new Set();

  if (fs.existsSync(DB_PATH)) {
    const db = new Database(DB_PATH);
    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name)
    );

    const checkCol = (tbl, col) => {
      if (!tables.has(tbl)) return;
      try {
        const rows = db.prepare(`SELECT ${col} FROM ${tbl} WHERE ${col} IS NOT NULL`).all();
        for (const r of rows) {
          const val = Object.values(r)[0];
          if (typeof val === "string") {
            const m = val.match(/\/uploads\/([^"'?#]+)/);
            if (m) referencedFilenames.add(path.basename(m[1]));
            else if (!val.startsWith("/") && !val.startsWith("http")) referencedFilenames.add(path.basename(val));
          }
        }
      } catch {}
    };

    checkCol("media_uploads", "url");
    checkCol("product_images", "url");
    checkCol("categories", "cover_image_url");
    checkCol("sliders", "image_url");
    checkCol("sliders", "fg_image_url");
    checkCol("blog_posts", "cover_image_url");
    checkCol("site_placements", "image_url");
  }

  // Scan src/ and scripts/ for hardcoded references
  const scanDirs = [path.join(ROOT, "src"), path.join(ROOT, "scripts")];
  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    const codeFiles = await walkDir(dir);
    for (const f of codeFiles) {
      if (!/\.(ts|tsx|js|mjs|json)$/.test(f)) continue;
      const content = fs.readFileSync(f, "utf8");
      const matches = content.match(/\/uploads\/([a-zA-Z0-9_\-\.]+)/g);
      if (matches) {
        for (const m of matches) {
          referencedFilenames.add(path.basename(m));
        }
      }
    }
  }

  console.log(`Found ${referencedFilenames.size} unique referenced upload files.`);

  // List all files in public/uploads
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log("No public/uploads directory found.");
    return;
  }

  const uploadFiles = fs.readdirSync(UPLOADS_DIR);
  console.log(`Current files in public/uploads: ${uploadFiles.length}`);

  let deletedCount = 0;
  let deletedBytes = 0;
  let keptCount = 0;
  let optimizedCount = 0;
  let savedBytes = 0;

  for (const filename of uploadFiles) {
    const fullPath = path.join(UPLOADS_DIR, filename);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;

    // Check if referenced
    if (!referencedFilenames.has(filename)) {
      // It's an orphan test file
      fs.unlinkSync(fullPath);
      deletedCount++;
      deletedBytes += stat.size;
    } else {
      keptCount++;
      // Optimize referenced file if it's a JPEG or PNG
      const ext = path.extname(filename).toLowerCase();
      if ([".jpg", ".jpeg", ".png"].includes(ext)) {
        try {
          const originalBuffer = fs.readFileSync(fullPath);
          const meta = await sharp(originalBuffer).metadata();
          let pipeline = sharp(originalBuffer).rotate();

          let maxDim = 1200;
          if (filename.startsWith("cat-") || filename.startsWith("product-")) {
            maxDim = 1000;
          }

          if (meta.width && meta.height && (meta.width > maxDim || meta.height > maxDim)) {
            pipeline = pipeline.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
          }

          let optBuffer;
          if (ext === ".png") {
            optBuffer = await pipeline.png({ quality: 80, compressionLevel: 9, palette: true }).toBuffer();
          } else {
            optBuffer = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
          }

          if (optBuffer.length < originalBuffer.length) {
            fs.writeFileSync(fullPath, optBuffer);
            savedBytes += originalBuffer.length - optBuffer.length;
            optimizedCount++;
            console.log(`✓ Optimized referenced upload ${filename}: ${Math.round(originalBuffer.length / 1024)}KB -> ${Math.round(optBuffer.length / 1024)}KB`);
          }

          // Generate sibling webp
          const webpFilename = filename.replace(/\.(jpg|jpeg|png)$/i, ".webp");
          const webpPath = path.join(UPLOADS_DIR, webpFilename);
          if (!fs.existsSync(webpPath)) {
            let webpPipeline = sharp(originalBuffer).rotate();
            if (meta.width && meta.height && (meta.width > maxDim || meta.height > maxDim)) {
              webpPipeline = webpPipeline.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
            }
            const webpBuf = await webpPipeline.webp({ quality: 80 }).toBuffer();
            fs.writeFileSync(webpPath, webpBuf);
          }
        } catch (e) {
          console.error(`Error optimizing ${filename}:`, e.message);
        }
      }
    }
  }

  console.log("\n==========================================");
  console.log(`🎉 Uploads Clean & Optimize Results:`);
  console.log(`- Orphan test files deleted: ${deletedCount} (${(deletedBytes / (1024 * 1024)).toFixed(2)} MB freed)`);
  console.log(`- Legitimate assets kept: ${keptCount}`);
  console.log(`- Referenced images compressed: ${optimizedCount} (${(savedBytes / (1024 * 1024)).toFixed(2)} MB saved)`);
  console.log("==========================================\n");
}

cleanAndOptimizeUploads();
