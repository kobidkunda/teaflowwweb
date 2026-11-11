import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BlendLabContentData } from "@/lib/blend-lab/content";

export function BlendLabHero({ content }: { content?: BlendLabContentData }) {
  // Preserve operator-authored copy; give the original starter headline the selected design treatment.
  const title = content?.texts.heroTitle;
  const headline = !title || title === "Your tea. Our expertise. A better way to blend."
    ? "Your next signature tea starts here." : title;
  const image = content?.heroPlacement;
  return (
    <section className="bl-hero" aria-labelledby="blend-lab-hero-title">
      <div className="bl-hero-copy">
        <p className="bl-eyebrow">{content?.texts.heroEyebrow || "THE BLEND WORKSHOP"}</p>
        <h1 id="blend-lab-hero-title">{headline}</h1>
        <p className="bl-hero-description">{content?.texts.heroDescription || "A professional tea evaluation and blending service for cafés, tea brands and bulk buyers. Get practical insights, explore possibilities and create a blend that fits your taste and business goals."}</p>
        <div className="bl-actions">
          <Link className="bl-button" href="#plans">{image?.cta_label || "Choose your evaluation"}<ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="bl-button bl-button-outline" href="#method"><StorefrontText id="copy_348810b9a22e4e40" fallback="Explore the method" /></Link>
        </div>
        <ul className="bl-hero-notes" aria-label="Our approach"><li>Leaf, infusion & cup</li><li><StorefrontText id="copy_6b7fa5cd9cbd32f0" fallback="Practical sensory insights" /></li><li><StorefrontText id="copy_a744020f712951d2" fallback="Your brewing method" /></li></ul>
      </div>
      <figure className="bl-hero-art">
        <Image src={image?.image_url || "/images/blend-lab/workshop-hero.webp"} alt={image?.alt_text || "Illustration of dry tea, infused leaves, amber liquor and milk tea in porcelain tasting bowls"} fill priority sizes="(max-width: 700px) 100vw, 55vw" />
        <figcaption>{image?.image_url ? "A look at the Blend Lab" : "AI-generated illustration of sensory cupping"}</figcaption>
      </figure>
    </section>
  );
}
