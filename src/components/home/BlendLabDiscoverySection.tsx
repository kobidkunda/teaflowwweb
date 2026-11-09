import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getContentBlock } from "@/lib/contentBlocks";
import { getSitePlacement } from "@/lib/media";
import styles from "./HomeBlendLab.module.css";

const DEFAULT_TITLE = "Your tea. A world of possibilities.";
const STARTER_TITLES = [
  "Your tea. Our expertise. A more competitive blend.",
  "Is your tea as competitive as it could be?",
];

export function BlendLabDiscoverySection() {
  const savedTitle = getContentBlock("blend_lab.home_title", DEFAULT_TITLE).trim();
  const title = !savedTitle || STARTER_TITLES.includes(savedTitle) ? DEFAULT_TITLE : savedTitle;
  const eyebrow = getContentBlock("blend_lab.home_eyebrow", "TEAFLOWW BLEND LAB");
  const description = getContentBlock(
    "blend_lab.home_description",
    "Professional tasting and custom blend development for cafés, tea brands and bulk buyers."
  );
  const placement = getSitePlacement("home_blend_lab");
  const customImage = Boolean(placement?.image_url);

  return (
    <section id="home-blend-lab" className={`blend-lab-discovery-section ${styles.invitation} ${customImage ? styles.customArt : ""}`} aria-labelledby="blend-lab-home-heading">
      <figure className={styles.art}>
        <Image
          src={placement?.image_url || "/images/blend-lab/home-invitation.webp"}
          alt={placement?.alt_text || "AI-generated illustration of dry tea leaves, infused leaves, amber liquor and milk tea in porcelain tasting bowls"}
          fill
          sizes="100vw"
          className={styles.image}
        />
        <figcaption className={styles.caption}>
          <span className={styles.cupStages}>Leaf <span aria-hidden="true">·</span> Infusion <span aria-hidden="true">·</span> Liquor <span aria-hidden="true">·</span> Milk</span>
          <span className={styles.disclosure}>{customImage ? "A look at Blend Lab" : "AI-generated illustrative imagery"}</span>
        </figcaption>
      </figure>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id="blend-lab-home-heading" className={styles.title}>
          {title === DEFAULT_TITLE ? <><span>Your tea.</span>{" "}<span>A world of</span>{" "}<span>possibilities.</span></> : title}
        </h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <Link href="/blend-lab" className={styles.primary}>{placement?.cta_label || "Explore Blend Lab"}<ArrowRight size={21} aria-hidden="true" /></Link>
          <Link href="/blend-lab#method" className={styles.secondary}>See how it works</Link>
        </div>
        <ol className={styles.steps} role="list" aria-label="Your Blend Lab journey">
          <li>Send a sample</li><li>Explore your cup</li><li>Shape your blend</li>
        </ol>
      </div>
    </section>
  );
}
