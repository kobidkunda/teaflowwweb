import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/PrivateLabel.module.css";
import { StatusPill } from "../shared/StatusPill";
import { PreviewNotice } from "../shared/StudioPrimitives";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";

export interface PackagingCardProps {
  variant: PublicPackagingVariantDto;
}

export function PackagingCard({ variant }: PackagingCardProps) {
  const displayTitle = variant.title || variant.name || "Custom Packaging";
  const displayFamily = variant.category || variant.family || "Packaging";
  const displayMoq = variant.moq_units || 500;
  const displayCapacity =
    variant.capacity_description ||
    (variant.net_weight_capacity_grams ? `${variant.net_weight_capacity_grams}g` : "Custom");

  const startingPriceText = variant.starting_price?.formatted_unit_price
    ? `From ${variant.starting_price.formatted_unit_price} / unit`
    : "Managed Quote";

  const hasRealImage =
    variant.hero_image_url &&
    !variant.hero_image_url.includes("fallback") &&
    (variant.hero_image_url.startsWith("/") || variant.hero_image_url.startsWith("https://"));

  return (
    <article
      data-testid="packaging-card"
      className={`${styles.packagingCard} packaging-card`}
      aria-label={`${displayTitle} - ${displayCapacity}`}
    >
      <div className={styles.packagingMediaWrapper}>
        {hasRealImage ? (
          <Image
            src={variant.hero_image_url!}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={styles.packagingImage}
          />
        ) : (
          <div data-testid="image-fallback" className={`${styles.imageFallback} img-fallback`}>
            <span style={{ fontSize: "1.75rem" }} aria-hidden="true">&#128230;</span>
            <span style={{ fontWeight: 600 }}>{displayTitle}</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              {displayCapacity} &bull; {variant.material}
            </span>
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardBadges}>
          <StatusPill label={displayFamily} variant="category" />
          <StatusPill label={variant.material} variant="material" />
          <StatusPill label={`MOQ: ${displayMoq.toLocaleString("en-IN")}`} variant="moq" />
        </div>

        <h3 className={styles.cardTitle}>
          <Link href={`/private-label/packaging/${variant.slug}`}>
            {displayTitle}
          </Link>
        </h3>

        <p className={styles.cardSpecs}><StorefrontText id="copy_54a399cddc5e79b2" fallback="Capacity:" /> {displayCapacity} &bull; Closure: {variant.closure_type || "Heat Seal"}
        </p>

        {variant.image_illustrative && (
          <PreviewNotice text="Digital mockup — illustrative only" />
        )}

        <div className={styles.cardFooter}>
          <span className={styles.cardPriceIndicator}>{startingPriceText}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <Link
              href={`/private-label/packaging/${variant.slug}`}
              className={styles.secondaryCta}
              style={{
                minHeight: "38px",
                padding: "6px 12px",
                fontSize: "0.8125rem",
                color: "#143C31",
                borderColor: "#DDE4DC",
              }}
            ><StorefrontText id="copy_e1f44367527cdf10" fallback="Specs" />
            </Link>
            <Link
              href={`/private-label/studio?pack=${variant.slug}`}
              className={styles.cardActionLink}
              aria-label={`Configure ${displayTitle} in Studio`}
            >
              Configure &rarr;
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
