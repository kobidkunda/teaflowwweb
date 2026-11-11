import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/PrivateLabel.module.css";
import { SectionHeading } from "../shared/StudioPrimitives";
import { PackagingCard } from "../catalogue/PackagingCard";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";

export function FeaturedPackagingGrid({
  variants,
}: {
  variants?: PublicPackagingVariantDto[];
}) {
  const displayItems =
    variants ? variants.slice(0, 6) : [];

  return (
    <section className={styles.stepperSection} aria-label="Featured Packaging Formats">
      <div className={styles.contentContainer}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "36px",
          }}
        >
          <div>
            <SectionHeading
              title="Explore Packaging Directions"
              subtitle="Choose a published option, or discuss an illustrative packaging concept with our team."
            />
          </div>
          <Link
            href="/private-label/packaging"
            className={styles.secondaryCta}
            style={{
              color: "#143C31",
              borderColor: "#143C31",
              minHeight: "44px",
              padding: "10px 20px",
            }}
          >
            View All Packaging Formats &rarr;
          </Link>
        </div>

        <div className={styles.catalogueGrid}>
          {displayItems.length === 0 && ["pouch", "tin", "jar", "carton"].map(family => (
            <article key={family} className={styles.packagingCard}>
              <Image src={`/images/private-label/${family}-concept.webp`} alt={`Illustrative ${family} packaging concept`} width={800} height={800} sizes="(max-width: 640px) 100vw, 33vw" style={{ width: "100%", height: "auto" }} />
              <div className={styles.cardBody}><h3 className={styles.cardTitle} style={{ textTransform: "capitalize" }}>{family}<StorefrontText id="copy_da5e11efa36720a4" fallback="concept" /></h3><p><StorefrontText id="copy_c8e4be0266b0bf86" fallback="AI-generated illustration. Availability, materials and pricing require confirmation." /></p><Link href="/private-label#sample-kit" className={styles.cardActionLink}><StorefrontText id="copy_c495043fdb314fb2" fallback="Discuss this format →" /></Link></div>
            </article>
          ))}
          {displayItems.map((variant) => (
            <PackagingCard key={variant.id || variant.slug} variant={variant} />
          ))}
        </div>
      </div>
    </section>
  );
}
