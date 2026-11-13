import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { getPublicSitemapData } from "@/lib/seo/htmlSitemap";
import { SitemapExplorer } from "@/components/sitemap/SitemapExplorer";
import { Compass, ShieldCheck, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: `Site Directory & HTML Sitemap · All Public Pages · ${siteConfig.name}`,
    description: `Complete directory of all public pages, single-estate tea lots, regional collections, brewing guides, and customer care policies on ${siteConfig.name}.`,
    path: "/sitemap",
  });
}

export default function SitemapPage() {
  const siteConfig = getDynamicSiteConfig();
  const sitemapData = getPublicSitemapData();

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Site Directory & Sitemap", url: "/sitemap" },
  ]);

  return (
    <div className="container page-shell tf-sitemap-page" style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* Schema.org Breadcrumbs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Accessible Breadcrumb Trail */}
      <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: 24, fontSize: 13, color: "#63685e" }}>
        <Link href="/" style={{ color: "#18231c", textDecoration: "none" }} className="hover:underline">
          Home
        </Link>{" "}
        / <span aria-current="page" style={{ fontWeight: 600, color: "#18231c" }}>Site Directory &amp; Sitemap</span>
      </nav>

      {/* Hero Page Header */}
      <header className="tf-sitemap-hero" style={{ marginBottom: 36 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "#f2ece2", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#143c31", marginBottom: 14 }}>
          <Compass size={14} aria-hidden={true} />
          <span>Public Navigation Index</span>
        </div>

        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(34px, 4vw, 48px)", fontWeight: 400, color: "#143c31", margin: "0 0 14px", lineHeight: 1.15 }}>
          Site Directory &amp; Sitemap
        </h1>

        <p style={{ fontSize: 16, color: "#50584e", maxWidth: 740, lineHeight: 1.6, margin: "0 0 20px" }}>
          Explore the complete, verified index of public pages across {siteConfig.brand}. Discover single-estate orthodox teas, regional flushes, wholesale sourcing, artisan blending atelier, educational brewing chronicles, and customer trust standards.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", fontSize: 12, color: "#616c5e" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={15} color="#287455" aria-hidden={true} />
            <span>Strictly Public Storefront Pages Only</span>
          </div>
          <span style={{ color: "#c4bcaf" }}>•</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={15} color="#b8753d" aria-hidden={true} />
            <span>Live Catalog &amp; Origin Synchronized</span>
          </div>
        </div>
      </header>

      {/* Interactive Explorer Client Component */}
      <SitemapExplorer initialData={sitemapData} />
    </div>
  );
}
