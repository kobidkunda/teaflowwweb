import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, "public", "images");

// Specific images in about that unit tests assert size: 50KB < size < 600KB
const ABOUT_TESTED_IMAGES = new Set([
  "hero-himalayan-dawn.webp",
  "hero-himalayan-dawn.jpg",
  "cupping-laboratory.webp",
  "cupping-laboratory.jpg",
  "siliguri-packaging-craft.webp",
  "siliguri-packaging-craft.jpg",
  "two-leaves-and-a-bud.webp",
  "two-leaves-and-a-bud.jpg",
]);

async function walk(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(await walk(fullPath));
    } else {
      files.push({ fullPath, size: stat.size, name: item, dir });
    }
  }
  return files;
}

async function optimizeImages() {
  console.log("🔍 Scanning public/images...");
  const files = await walk(IMAGES_DIR);
  let totalOriginal = 0;
  let totalOptimized = 0;
  let processedCount = 0;
  let webpGenerated = 0;

  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;

    // Check if protected by about-page unit test constraints
    const isAboutProtected = file.dir.endsWith(path.join("public", "images", "about")) &&
      ABOUT_TESTED_IMAGES.has(file.name);

    // ctc-brew images are tested for >200KB and <2MB in ways-to-make-ctc-tea.test.ts
    const isCtcProtected = file.dir.includes("ctc-brew");

    if (isAboutProtected || isCtcProtected) {
      console.log(`ℹ️ Preserving unit-test constrained asset: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      continue;
    }

    try {
      const originalBuffer = fs.readFileSync(file.fullPath);
      totalOriginal += originalBuffer.length;

      const metadata = await sharp(originalBuffer).metadata();
      let pipeline = sharp(originalBuffer).rotate();

      // Determine optimal bounds
      let maxDim = 1920;
      if (file.name.startsWith("cat-") || file.name.startsWith("product-")) {
        maxDim = 1000;
      } else if (file.dir.includes("ctc-brew") || file.dir.includes("craft")) {
        maxDim = 1200;
      }

      if (metadata.width && metadata.height && (metadata.width > maxDim || metadata.height > maxDim)) {
        pipeline = pipeline.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
      }

      let optimizedBuffer;
      if (ext === ".png") {
        optimizedBuffer = await pipeline
          .png({ quality: 80, compressionLevel: 9, palette: true })
          .toBuffer();
      } else {
        optimizedBuffer = await pipeline
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
      }

      // Only overwrite if optimized is smaller
      if (optimizedBuffer.length < originalBuffer.length) {
        fs.writeFileSync(file.fullPath, optimizedBuffer);
        totalOptimized += optimizedBuffer.length;
        processedCount++;
        const savedPercent = ((1 - optimizedBuffer.length / originalBuffer.length) * 100).toFixed(1);
        console.log(`✓ Optimized ${path.relative(ROOT, file.fullPath)}: ${Math.round(originalBuffer.length / 1024)}KB -> ${Math.round(optimizedBuffer.length / 1024)}KB (-${savedPercent}%)`);
      } else {
        totalOptimized += originalBuffer.length;
      }

      // Generate paired WebP if it does not exist or original was larger
      const webpPath = file.fullPath.replace(/\.(jpg|jpeg|png)$/i, ".webp");
      if (!fs.existsSync(webpPath)) {
        let webpPipeline = sharp(originalBuffer).rotate();
        if (metadata.width && metadata.height && (metadata.width > maxDim || metadata.height > maxDim)) {
          webpPipeline = webpPipeline.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
        }
        const webpBuffer = await webpPipeline.webp({ quality: 80 }).toBuffer();
        fs.writeFileSync(webpPath, webpBuffer);
        webpGenerated++;
      }
    } catch (err) {
      console.error(`❌ Failed optimizing ${file.fullPath}:`, err.message);
    }
  }

  console.log("\n==========================================");
  console.log(`🎉 Optimization Complete:`);
  console.log(`- Files compressed: ${processedCount}`);
  console.log(`- WebP siblings generated: ${webpGenerated}`);
  console.log(`- Original total: ${(totalOriginal / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`- Optimized total: ${(totalOptimized / (1024 * 1024)).toFixed(2)} MB`);
  if (totalOriginal > 0) {
    console.log(`- Space saved: ${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}%`);
  }
  console.log("==========================================\n");
}

(async () => {
  await optimizeImages();
})();
