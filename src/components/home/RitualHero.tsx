import Image from "next/image";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { ArrowRight } from "lucide-react";
import type { HomepageContent } from "@/lib/homepageSchema";

/** Selected option 3, rendered entirely from admin-managed homepage content. */
export function RitualHero({ hero }: { hero: HomepageContent["hero"] }) {
  if (!hero.title) return null;
  const altText = hero.image_alt || "Himalayan single-estate tea gardens at dawn";
  return (
    <section className="ritual-hero" aria-labelledby="hero-heading">
      <div className="hero-visual" data-testid="hero-visual" style={{ position: "relative", width: "100%", height: "100%", minHeight: "320px" }}>
        {hero.image_url ? (
          <Image className="ritual-hero-image" src={hero.image_url} alt={altText} fill priority sizes="100vw" />
        ) : (
          <svg
            role="img"
            aria-label={altText}
            viewBox="0 0 1440 600"
            className="ritual-hero-image"
            style={{ width: "100%", height: "100%", minHeight: "320px", display: "block" }}
          >
            <title>Himalayan Mountain Tea Estate</title>
            <desc>Artisanal high-altitude tea gardens</desc>
            <rect width="1440" height="600" fill="#23483a" />
          </svg>
        )}
      </div>
      <div className="ritual-container ritual-hero-content">
        <p className="ritual-eyebrow">{hero.eyebrow}</p>
        <h1 id="hero-heading">{hero.title}<em>{hero.emphasis}</em></h1>
        <p className="ritual-hero-description">{hero.description}</p>
        <div className="ritual-actions">
          {hero.primary.label && hero.primary.href && (
            <Link href={hero.primary.href} className="button button-cream">
              {hero.primary.label}<ArrowRight size={17} aria-hidden="true"/>
            </Link>
          )}
          {hero.secondary.label && hero.secondary.href && (
            <Link href={hero.secondary.href} className="ritual-text-link">
              {hero.secondary.label}<ArrowRight size={16} aria-hidden="true"/>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

