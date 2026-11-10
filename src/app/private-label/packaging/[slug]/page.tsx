import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { constructMetadata } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site";
import { PrivateLabelService } from "@/lib/private-label/service";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";
import type { PublicPackagingDetailResponse } from "@/lib/private-label/schemas";
import { PackagingDetailView } from "@/components/private-label/detail/PackagingDetailView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return constructMetadata({ title: "Packaging Not Found", noindex: true });

  try {
    const variant = PrivateLabelService.getPublicPackagingVariantBySlug(slug);
    const title = variant.title || variant.name || "Custom Tea Packaging";
    const capacity = variant.capacity_description || `${variant.net_weight_capacity_grams}g`;
    const moq = variant.moq_units || 500;

    return constructMetadata({
      title: `${title} — Custom Tea Packaging | TeaFloww Private Label`,
      description: `${title}. Food-grade ${variant.material} with ${variant.finish} finish. Net capacity: ${capacity}. Minimum run: ${moq.toLocaleString("en-IN")} units. Closure: ${variant.closure_type || "Heat Seal"}.`,
      path: `/private-label/packaging/${variant.slug}`,
      ogImage: variant.hero_image_url || "/images/private-label/atelier-concept.webp",
    });
  } catch {
    return constructMetadata({
      title: "Packaging Structure Not Found | TeaFloww",
      description: "The requested packaging structure is unavailable or in draft state.",
      noindex: true,
    });
  }
}

export default async function PackagingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug) notFound();

  let variant: PublicPackagingDetailResponse | null = null;
  try {
    variant = PrivateLabelService.getPublicPackagingVariantBySlug(slug);
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      notFound();
    }
    throw error;
  }

  if (!variant || variant.status !== "published") {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const displayTitle = variant.title || variant.name || "Custom Packaging";
  const displayCapacity =
    variant.capacity_description || `${variant.net_weight_capacity_grams}g`;
  const heroImage = variant.hero_image_url || `${siteUrl}/images/packaging-fallback.png`;

  // Schema.org JSON-LD Product & Breadcrumbs
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${siteUrl}/private-label/packaging/${variant.slug}#product`,
        name: displayTitle,
        description: `Food-grade ${variant.material} structure with ${variant.finish} finish. Net capacity ${displayCapacity}.`,
        image: [heroImage],
        sku: variant.sku || variant.slug,
        category: `Tea Packaging / ${variant.category || variant.family || "Pouch"}`,
        material: variant.material,
        brand: {
          "@type": "Brand",
          name: "TeaFloww",
        },
        offers: {
          "@type": "Offer",
          "@id": `${siteUrl}/private-label/packaging/${variant.slug}#offer`,
          priceCurrency: variant.starting_price?.currency || "INR",
          price: variant.starting_price
            ? (variant.starting_price.unit_price_paise / 100).toFixed(2)
            : "0.00",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: "TeaFloww",
            legalName: "Nirva",
          },
          eligibleQuantity: {
            "@type": "QuantitativeValue",
            minValue: variant.moq_units || 500,
            unitCode: "C62",
          },
        },
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "Exterior Dimensions",
            value: `${variant.dimensions_mm?.width || 0}mm (W) x ${variant.dimensions_mm?.height || 0}mm (H)`,
          },
          {
            "@type": "PropertyValue",
            name: "Label Safe Area",
            value: `${variant.label_safe_area_mm?.width || 0}mm (W) x ${variant.label_safe_area_mm?.height || 0}mm (H)`,
          },
          {
            "@type": "PropertyValue",
            name: "Net Tea Capacity",
            value: `${displayCapacity} (~${variant.net_weight_capacity_grams}g)`,
          },
          {
            "@type": "PropertyValue",
            name: "Closure Type",
            value: variant.closure_type || "Heat Seal",
          },
          {
            "@type": "PropertyValue",
            name: "Minimum Order Quantity",
            value: `${variant.moq_units || 500} units`,
          },
          {
            "@type": "PropertyValue",
            name: "Order Multiple",
            value: `${variant.order_multiple || 50} units`,
          },
          {
            "@type": "PropertyValue",
            name: "Production Lead Time",
            value: `${variant.lead_time_days || 14} business days`,
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/private-label/packaging/${variant.slug}#breadcrumb`,
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
          {
            "@type": "ListItem",
            position: 4,
            name: displayTitle,
            item: `${siteUrl}/private-label/packaging/${variant.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: "100%", overflowX: "clip" }}>
      {/* Schema.org JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PackagingDetailView variant={variant} />
    </div>
  );
}
