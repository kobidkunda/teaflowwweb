import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site";
import { PrivateLabelService } from "@/lib/private-label/service";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";
import { PackagingCatalogueExplorer } from "@/components/private-label/catalogue/PackagingCatalogueExplorer";
import styles from "@/components/private-label/styles/PrivateLabel.module.css";
import { SectionEyebrow } from "@/components/private-label/shared/StudioPrimitives";

export const metadata: Metadata = constructMetadata({
  title: "Packaging Formats & Structures Catalogue — Custom Tea Packaging | TeaFloww",
  description:
    "Explore our certified food-grade packaging catalogue. Stand-up barrier pouches, artisanal metal tins, amber apothecary jars, folding cartons, and pyramid sachets from 100 units.",
  path: "/private-label/packaging",
  ogImage: "/images/private-label/atelier-concept.webp",
});

export default async function PackagingCataloguePage() {
  const siteUrl = getSiteUrl();

  let initialVariants: PublicPackagingVariantDto[] = [];
  try {
    const res = PrivateLabelService.listPublicPackagingVariants({ limit: 100 });
    initialVariants = res.items;
  } catch {
    initialVariants = [];
  }

  // Schema.org CollectionPage
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/private-label/packaging#collection`,
    name: "TeaFloww Packaging Formats & Catalogue",
    description: "Certified food-grade tea packaging structures and barrier specifications.",
    url: `${siteUrl}/private-label/packaging`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: initialVariants.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/private-label/packaging/${item.slug}`,
        name: item.title || item.name,
      })),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Private Label",
          item: `${siteUrl}/private-label`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Packaging Catalogue",
          item: `${siteUrl}/private-label/packaging`,
        },
      ],
    },
  };

  return (
    <div style={{ maxWidth: "100%", overflowX: "clip" }}>
      {/* Schema.org JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Editorial Header */}
      <section
        style={{
          backgroundColor: "#143C31",
          color: "#FFFCF7",
          padding: "clamp(40px, 6vw, 72px) 0 clamp(32px, 4vw, 48px)",
          borderBottom: "1px solid rgba(221, 228, 220, 0.15)",
        }}
      >
        <div className={styles.contentContainer}>
          <SectionEyebrow><StorefrontText id="copy_64b5862b179768fd" fallback="FOOD-GRADE STRUCTURES" /></SectionEyebrow>
          <h1
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "clamp(30px, 4.5vw, 52px)",
              lineHeight: 1.12,
              fontWeight: "normal",
              margin: "0 0 16px",
              color: "#FFFCF7",
            }}
          >
            Custom Packaging Catalogue & Formats
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
              lineHeight: 1.5,
              color: "#DDE4DC",
              margin: 0,
              maxWidth: "680px",
            }}
          ><StorefrontText id="copy_a7cd04241ca80548" fallback="Certified high-barrier pouches, artisanal tins, apothecary jars, and single-serve pyramid sachets engineered for volatile aroma preservation and zero shelf degradation." />
          </p>
        </div>
      </section>

      {/* Interactive Explorer Component */}
      <PackagingCatalogueExplorer initialVariants={initialVariants} />
    </div>
  );
}
