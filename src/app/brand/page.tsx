import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandLogoGallery } from "@/components/admin/media/BrandLogoGallery";
import { constructMetadata } from "@/lib/seo/metadata";

import { getPageOrDefault } from "@/lib/pages";
import { getDynamicSiteConfig } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const page = getPageOrDefault("brand");
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `Brand Assets & Identity — Master Vector Logo Kit · ${siteConfig.name}`,
    description:
      page.meta_description ||
      `Official ${siteConfig.brand} branding assets, color palettes, and all vector logo formats for packaging, print, and digital media.`,
    path: "/brand",
    ogImage: "/images/og-himalayan-tea-house.jpg",
  });
}

const BRAND_PALETTE = [
  { name: "Forest Signature", hex: "#063B2F", role: "Primary brand evergreen" },
  { name: "Deep Forest", hex: "#0A362B", role: "Secondary deep tone" },
  { name: "Tea Leaf", hex: "#527F58", role: "Orthodox leaf accent" },
  { name: "Peach Sunrise", hex: "#F3CAA6", role: "Himalayan dawn sun" },
  { name: "Sunrise Gold", hex: "#EBB77A", role: "High-mountain ridgelines" },
  { name: "Artisan Cream", hex: "#F6E8D7", role: "Unbleached paper & packaging" },
  { name: "Ivory White", hex: "#FFFBF3", role: "Canvas background" },
  { name: "Mountain Earth", hex: "#8B5E3C", role: "Alluvial soil & tea hills" },
  { name: "Metallic Gold", hex: "#D8B36C", role: "Hot foil & reserve packaging" },
  { name: "Silver Moonlight", hex: "#C7D0D4", role: "Cold foil tooling" },
  { name: "Midnight Navy", hex: "#0C2835", role: "Winter flush accent" },
  { name: "Botanical Sage", hex: "#8FAD80", role: "Green tea highlights" },
];

export default function BrandIdentityPage() {
  const page = getPageOrDefault("brand");
  const siteConfig = getDynamicSiteConfig();

  const eyebrow = page.eyebrow || "Verified Sourcing & Identity System";
  const headline = page.headline || `${siteConfig.brand} Brand Identity & Master Logo Kit`;
  const subtitle = page.subtitle || `The official vector identity system for ${siteConfig.brand} Himalayan Single-Estate Teas. Includes all 40 production-oriented logo variations supplied as independent, editable SVG files with resolution-independent vector geometry and outlined typography.`;
  return (
    <div className="container page-shell brand-page py-10" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      {/* Breadcrumbs */}
      <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: 24, fontSize: 13, color: "#63685e" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#18231c", textDecoration: "none" }}>
          <BrandLogo variant="symbol" size={16} aria-hidden={true} />
          <span> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </span>
        </Link>{" "}
        / <span aria-current="page" style={{ fontWeight: 600 }}>Brand Identity &amp; Master Logos</span>
      </nav>

      {/* Hero Header */}
      <header
        style={{
          borderBottom: "1px solid #e4ded0",
          paddingBottom: 32,
          marginBottom: 36,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#2c4e38", display: "block", marginBottom: 8 }}>
            {eyebrow}
          </span>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 5vw, 42px)", color: "#18231c", lineHeight: 1.15, margin: "0 0 16px 0" }}>
            {headline}
          </h1>
          <p style={{ fontSize: 17, color: "#52594e", lineHeight: 1.6, margin: 0 }}>
            {subtitle}
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <BrandLogo variant="badge" size={100} aria-label="Teafloww Seal" />
        </div>
      </header>

      {/* Technical Principles */}
      <section style={{ marginBottom: 40, background: "#f8f5ee", borderRadius: 12, padding: "24px 28px", border: "1px solid #e8e2d4" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: "#18231c", margin: "0 0 16px 0" }}> <StorefrontText id="copy_17865f0864d3cc8a" fallback="Vector Architecture Standards" /> </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, fontSize: 13, color: "#474d42", lineHeight: 1.5 }}>
          <div>
            <strong style={{ color: "#063B2F", display: "block", marginBottom: 4 }}> <StorefrontText id="copy_ca5a4afb336ffe4b" fallback="1. True Vector Emblem" /> </strong> <StorefrontText id="copy_b6110b4af6ece63f" fallback="Hand-authored, smooth Bezier curves representing the Himalayan sunrise, terraced tea mountain slopes, and whole pluck tea leaf." /> </div>
          <div>
            <strong style={{ color: "#063B2F", display: "block", marginBottom: 4 }}> <StorefrontText id="copy_9e83ef78b9246715" fallback="2. Zero Font Dependencies" /> </strong> <StorefrontText id="copy_715da17024f5ed33" fallback="All lettering and taglines are converted to filled vector paths. No font files or HTML font fallbacks required." /> </div>
          <div>
            <strong style={{ color: "#063B2F", display: "block", marginBottom: 4 }}> <StorefrontText id="copy_10dd1a5c433a37d0" fallback="3. Pure Code Graphics" /> </strong> <StorefrontText id="copy_47a1c01a6834b388" fallback="No embedded base64 bitmaps, linked images, or raster artifacts. Losslessly scalable from a 16px favicon to a 10-meter exhibition banner." /> </div>
          <div>
            <strong style={{ color: "#063B2F", display: "block", marginBottom: 4 }}>4. Print &amp; Tooling Ready</strong> <StorefrontText id="copy_c2bce2d67891fd8f" fallback="Dedicated single-ink, foil stamping, embossing, and reverse knockout editions for gravure, flexo, and packaging dies." /> </div>
        </div>
      </section>

      {/* Official Palette */}
      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: "#18231c", margin: "0 0 16px 0" }}> <StorefrontText id="copy_576db8f118d20678" fallback="Official Color Palette" /> </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
          {BRAND_PALETTE.map((swatch) => (
            <div
              key={swatch.name}
              style={{
                borderRadius: 8,
                border: "1px solid #e0d8ca",
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              <div style={{ height: 60, backgroundColor: swatch.hex }} />
              <div style={{ padding: "10px 12px" }}>
                <strong style={{ fontSize: 13, color: "#18231c", display: "block" }}>{swatch.name}</strong>
                <code style={{ fontSize: 11, color: "#6a7066", display: "block", marginTop: 2 }}>{swatch.hex}</code>
                <span style={{ fontSize: 10, color: "#8b9186", display: "block", marginTop: 2 }}>{swatch.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Master 40 Logo Variations Gallery */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#18231c", margin: "0 0 8px 0" }}>
          All 40 Logo Variations in SVG &amp; PNG
        </h2>
        <p style={{ fontSize: 14, color: "#63685e", margin: "0 0 20px 0" }}> <StorefrontText id="copy_fdb558061c0d0a28" fallback="Browse, preview, and download every approved variation directly in vector SVG format or high-resolution PNG preview." /> </p>

        <BrandLogoGallery />
      </section>
    </div>
  );
}
