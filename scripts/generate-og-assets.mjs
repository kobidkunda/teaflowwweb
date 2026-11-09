import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const imagesDir = path.join(rootDir, "public", "images");

async function generateStaticOgAssets() {
  console.log("Generating static OpenGraph assets (1200x630)...");

  // 1. Default Brand OG Image (1200x630, < 200KB)
  const heroPath = path.join(imagesDir, "hero-himalayan-tea.jpg");
  const logoSvgPath = path.join(imagesDir, "logo-horizontal.svg");

  if (fs.existsSync(heroPath)) {
    const bg = await sharp(heroPath)
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .toBuffer();

    let compositeList = [];
    if (fs.existsSync(logoSvgPath)) {
      const logo = await sharp(logoSvgPath)
        .resize({ width: 260 })
        .png()
        .toBuffer();

      const badgeSvg = Buffer.from(
        '<svg width="300" height="104"><rect width="300" height="104" rx="16" fill="rgba(247, 245, 240, 0.94)" stroke="rgba(215, 204, 185, 0.8)" stroke-width="1.5"/></svg>'
      );

      const badgeWithLogo = await sharp(badgeSvg)
        .composite([{ input: logo, gravity: "centre" }])
        .png()
        .toBuffer();

      compositeList.push({ input: badgeWithLogo, top: 40, left: 40 });
    }

    const defaultOgBuffer = await sharp(bg)
      .composite(compositeList)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    fs.writeFileSync(path.join(imagesDir, "og-himalayan-tea-house.jpg"), defaultOgBuffer);
    fs.writeFileSync(path.join(imagesDir, "og-default.jpg"), defaultOgBuffer);
    fs.writeFileSync(path.join(imagesDir, "og-teafloww.jpg"), defaultOgBuffer);
    console.log(`✓ og-himalayan-tea-house.jpg created (${Math.round(defaultOgBuffer.length / 1024)} KB)`);
  }

  // 2. Blog: assam-brewing-guide.jpg
  const assamTinPath = path.join(imagesDir, "product-assam-tin.jpg");
  const assamBgSource = path.join(imagesDir, "mockup", "hero_mountains_bg.jpg");
  if (fs.existsSync(assamTinPath) && fs.existsSync(assamBgSource)) {
    const assamBg = await sharp(assamBgSource)
      .resize(1200, 630, { fit: "cover" })
      .blur(20)
      .modulate({ brightness: 0.75 })
      .toBuffer();
    const assamTin = await sharp(assamTinPath)
      .resize({ height: 540, fit: "inside" })
      .toBuffer();
    const buf = await sharp(assamBg)
      .composite([{ input: assamTin, gravity: "centre" }])
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    fs.writeFileSync(path.join(imagesDir, "assam-brewing-guide.jpg"), buf);
    console.log(`✓ assam-brewing-guide.jpg created (${Math.round(buf.length / 1024)} KB)`);
  }

  // 3. Blog: darjeeling-first-flush.jpg
  const plantationPath = path.join(imagesDir, "bento-plantation.jpg");
  if (fs.existsSync(plantationPath)) {
    const buf = await sharp(plantationPath)
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    fs.writeFileSync(path.join(imagesDir, "darjeeling-first-flush.jpg"), buf);
    console.log(`✓ darjeeling-first-flush.jpg created (${Math.round(buf.length / 1024)} KB)`);
  }

  // 4. Blog: cupping-guide.jpg
  const cupSource = path.join(imagesDir, "mockup", "gardens_to_cup.jpg");
  if (fs.existsSync(cupSource)) {
    const buf = await sharp(cupSource)
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    fs.writeFileSync(path.join(imagesDir, "cupping-guide.jpg"), buf);
    console.log(`✓ cupping-guide.jpg created (${Math.round(buf.length / 1024)} KB)`);
  }

  // 5. Blog: orthodox-vs-ctc.jpg
  const blossomPath = path.join(imagesDir, "bento-blossom.jpg");
  if (fs.existsSync(blossomPath)) {
    const buf = await sharp(blossomPath)
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    fs.writeFileSync(path.join(imagesDir, "orthodox-vs-ctc.jpg"), buf);
    console.log(`✓ orthodox-vs-ctc.jpg created (${Math.round(buf.length / 1024)} KB)`);
  }

  console.log("All static OpenGraph assets generated successfully!");
}

generateStaticOgAssets().catch((err) => {
  console.error("Error generating OG assets:", err);
  process.exit(1);
});
