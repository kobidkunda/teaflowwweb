import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/PrivateLabel.module.css";
import { PackagingSpecsTabs } from "./PackagingSpecsTabs";
import { PackagingDielineAction } from "./PackagingDielineAction";
import { StatusPill } from "../shared/StatusPill";
import { PreviewNotice } from "../shared/StudioPrimitives";
import type { PublicPackagingDetailResponse } from "@/lib/private-label/schemas";

export function PackagingDetailView({
  variant,
}: {
  variant: PublicPackagingDetailResponse;
}) {
  const displayTitle = variant.title || variant.name || "Custom Packaging";
  const displayFamily = variant.category || variant.family || "Packaging";
  const displayCapacity =
    variant.capacity_description ||
    (variant.net_weight_capacity_grams ? `${variant.net_weight_capacity_grams}g` : "Custom");

  const startingPriceText = variant.starting_price?.formatted_unit_price
    ? `From ${variant.starting_price.formatted_unit_price} / unit`
    : "Managed Quotation";

  const hasRealImage =
    variant.hero_image_url &&
    !variant.hero_image_url.includes("fallback") &&
    (variant.hero_image_url.startsWith("/") || variant.hero_image_url.startsWith("https://"));

  return (
    <div className={styles.pdpContainer}>
      <div className={styles.contentContainer}>
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="breadcrumbs" style={{ marginBottom: "24px" }}>
          <ol
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              listStyle: "none",
              padding: 0,
              margin: 0,
              fontSize: "0.875rem",
              color: "#65746D",
            }}
          >
            <li>
              <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
                Home
              </Link>
            </li>
            <li aria-hidden="true">&rsaquo;</li>
            <li>
              <Link href="/private-label" style={{ color: "inherit", textDecoration: "none" }}>
                Private Label
              </Link>
            </li>
            <li aria-hidden="true">&rsaquo;</li>
            <li>
              <Link href="/private-label/packaging" style={{ color: "inherit", textDecoration: "none" }}>
                Packaging
              </Link>
            </li>
            <li aria-hidden="true">&rsaquo;</li>
            <li aria-current="page" style={{ color: "#143C31", fontWeight: 600 }}>
              {displayTitle}
            </li>
          </ol>
        </nav>

        {/* 2-Column Split */}
        <div className={styles.pdpGrid}>
          {/* Left Column: Media Stage */}
          <div>
            <div className={styles.pdpMediaStage}>
              {hasRealImage ? (
                <div style={{ position: "relative", width: "100%", height: "clamp(380px, 48vh, 480px)" }}>
                  <Image
                    src={variant.hero_image_url!}
                    alt={displayTitle}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    style={{ objectFit: "contain" }}
                    priority
                  />
                </div>
              ) : (
                <div
                  data-testid="image-fallback"
                  className={styles.teaserMockupPouch}
                  style={{ width: "280px", height: "380px" }}
                >
                  <div className={styles.teaserLabelSafeZone}>
                    <span className={styles.teaserBrandHeading}>{displayTitle}</span>
                    <p className={styles.teaserTeaType}>{displayCapacity}</p>
                    <div style={{ marginTop: "16px", fontSize: "0.75rem", color: "#D7B474" }}>
                      {variant.material}
                    </div>
                  </div>
                </div>
              )}
              <PreviewNotice text="Digital mockup — illustrative only" />
            </div>
          </div>

          {/* Right Column: Information, Specs & Actions */}
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <StatusPill label={displayFamily} variant="category" />
              <StatusPill label={`SKU: ${variant.sku || "CUSTOM"}`} variant="neutral" />
            </div>

            <h1 data-testid="product-title" className={styles.heroTitle} style={{ color: "#171713", marginBottom: "12px" }}>
              {displayTitle}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "12px",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #DDE4DC",
              }}
            >
              <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#143C31" }}>
                {startingPriceText}
              </span>
              <span style={{ fontSize: "0.875rem", color: "#65746D" }}>
                (MOQ: {(variant.moq_units || 500).toLocaleString("en-IN")} units)
              </span>
            </div>

            {/* Accessible Specs Tabs */}
            <div style={{ marginBottom: "32px" }}>
              <PackagingSpecsTabs variant={variant} />
            </div>

            {/* Dieline Action */}
            <div style={{ marginBottom: "28px" }}>
              <PackagingDielineAction
                dielineUrl={variant.dieline_url}
                variantTitle={displayTitle}
              />
            </div>

            {/* Primary Action Buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link
                href={`/private-label/studio?pack=${variant.slug}`}
                className={styles.primaryCta}
                aria-label={`Configure ${displayTitle} in Studio`}
                style={{
                  flex: "1 1 220px",
                  backgroundColor: "#143C31",
                  color: "#FFFCF7",
                }}
              >
                Configure in Studio &rarr;
              </Link>
              <Link
                href="/private-label#sample-kit"
                className={styles.secondaryCta}
                style={{
                  flex: "1 1 180px",
                  color: "#143C31",
                  borderColor: "#143C31",
                }}
              >
                Order Sample Swatch
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
