import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema, getPackagingProductSchema } from "@/lib/seo/schema";
import { resolveProductCommercePolicy, toClientCommercePolicy, type ProductPolicyOverrides } from "@/lib/seo/productPolicy";
import { listApprovedReviews } from "@/lib/reviews";
import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";
import type { PublicPackagingDetailResponse } from "@/lib/private-label/schemas";
import { PackagingDetailView } from "@/components/private-label/detail/PackagingDetailView";
import { ProductReviewsSection } from "@/components/ProductReviewsSection";

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

  let overrides: ProductPolicyOverrides | null = null;
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM pl_packaging_variants WHERE id = ? LIMIT 1")
      .get(variant.id) as ProductPolicyOverrides | undefined;
    if (row) overrides = row;
  } catch {
    overrides = null;
  }

  const displayTitle = variant.title || variant.name || "Custom Packaging";
  const commercePolicy = resolveProductCommercePolicy({
    entityType: "packaging",
    entityId: variant.id,
    overrides,
    extraHandlingDays: variant.lead_time_days || 14,
  });
  const approvedReviews = listApprovedReviews("packaging", variant.id);
  const rawProductNode = getPackagingProductSchema(variant, overrides, {
    policy: commercePolicy,
    reviews: approvedReviews,
  });
  const rawBreadcrumbNode = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Private Label", url: "/private-label" },
    { name: "Packaging Catalogue", url: "/private-label/packaging" },
    { name: displayTitle, url: `/private-label/packaging/${variant.slug}` },
  ]);
  const stripCtx = <T extends Record<string, unknown>>(node: T) => {
    const copy = { ...node };
    delete copy["@context"];
    return copy;
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [stripCtx(rawProductNode), stripCtx(rawBreadcrumbNode)],
  };
  const clientPolicy = toClientCommercePolicy(commercePolicy);

  return (
    <div style={{ maxWidth: "100%", overflowX: "clip" }}>
      {/* Schema.org JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PackagingDetailView variant={variant} commercePolicy={clientPolicy} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px 48px" }}>
        <ProductReviewsSection
          entityType="packaging"
          entityId={variant.id}
          productName={displayTitle}
          summary={commercePolicy.reviewSummary}
          reviews={approvedReviews}
        />
      </div>
    </div>
  );
}
