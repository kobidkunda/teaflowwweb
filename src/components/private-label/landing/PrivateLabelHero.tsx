import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/PrivateLabel.module.css";
import { SectionEyebrow, PreviewNotice } from "../shared/StudioPrimitives";

export interface PrivateLabelHeroProps {
  whatsappNumber?: string;
}

export function PrivateLabelHero(_props: PrivateLabelHeroProps = {}) {
  return (
    <section className={styles.heroSection} aria-label="Hero">
      <div className={styles.contentContainer}>
        <div className={styles.heroGrid}>
          <div>
            <SectionEyebrow><StorefrontText id="copy_ed30fbb1c102eaf2" fallback="YOUR TEA BRAND, STEP BY STEP" /></SectionEyebrow>
            <h1 className={styles.heroTitle}><StorefrontText id="copy_349dad8a4fd25011" fallback="Bring Your Tea Brand to Life." />
            </h1>
            <p className={styles.heroSubtitle}><StorefrontText id="copy_603edb56529ed13f" fallback="Explore tea and packaging options, preview your brand, and request an itemized quotation. Our team will confirm sourcing, materials and production requirements for your project." />
            </p>
            <div className={styles.heroActions}>
              <Link
                href="/private-label/studio"
                className={styles.primaryCta}
                aria-label="Start Your Brand in Studio"
              >
                Start Your Brand &rarr;
              </Link>
              <Link
                href="/private-label/packaging"
                className={styles.secondaryCta}
                aria-label="Explore Packaging Catalogue"
              ><StorefrontText id="copy_6781c0a4c58a9185" fallback="Explore Packaging Catalogue" />
              </Link>
            </div>
            <div className={styles.heroTrustIndicators}>
              <span>Tea & packaging selection</span>
              <span><StorefrontText id="copy_765fbd3828679d9f" fallback="Configuration-specific minimums" /></span>
              <span><StorefrontText id="copy_3059c165c8d1ec31" fallback="Proof review before production" /></span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
            <div className={styles.heroMediaCard}>
              <div className={styles.heroMediaImageWrapper}>
                <Image
                  src="/images/private-label/atelier-concept.webp"
                  alt="Concept arrangement of a green pouch, brass tin, amber jar and ivory tea carton"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px"
                  className={styles.heroMediaImage}
                />
              </div>
              <div style={{ marginTop: "12px", width: "100%" }}>
                <PreviewNotice text="AI-generated packaging concepts — illustrative only" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
