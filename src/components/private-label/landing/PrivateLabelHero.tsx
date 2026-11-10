import React from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import styles from "../styles/PrivateLabel.module.css";
import { SectionEyebrow, PreviewNotice } from "../shared/StudioPrimitives";
import { formatWhatsAppDigits } from "@/lib/private-label/whatsapp";

export interface PrivateLabelHeroProps {
  whatsappNumber?: string;
}

export function PrivateLabelHero({ whatsappNumber = "+91 7001304853" }: PrivateLabelHeroProps = {}) {
  const cleanDigits = formatWhatsAppDigits(whatsappNumber);
  const whatsappUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(
    "Hello TeaFloww! I'm interested in Private Label Tea Sourcing & Packaging and would like to consult with your tea desk.\n\nURL: https://teafloww.com/private-label"
  )}`;

  return (
    <section className={styles.heroSection} aria-label="Hero">
      <div className={styles.contentContainer}>
        <div className={styles.heroGrid}>
          <div>
            <SectionEyebrow>YOUR TEA BRAND, STEP BY STEP</SectionEyebrow>
            <h1 className={styles.heroTitle}>
              Bring Your Tea Brand to Life.
            </h1>
            <p className={styles.heroSubtitle}>
              Explore tea and packaging options, preview your brand, and request an itemized quotation. Our team will confirm sourcing, materials and production requirements for your project.
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
              >
                Explore Packaging Catalogue
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappCta}
                aria-label="Chat directly on WhatsApp with our tea & packaging desk"
              >
                <MessageCircle size={18} fill="#25D366" color="#25D366" className={styles.whatsappIcon} />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
            <div className={styles.heroTrustIndicators}>
              <span>Tea & packaging selection</span>
              <span>Configuration-specific minimums</span>
              <span>Proof review before production</span>
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
