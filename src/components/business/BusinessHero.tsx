import Image from "next/image";
import { ButtonLink } from "./ButtonLink";
import type { B2BPageContentRecord } from "@/lib/business/repository";
import type { BusinessLocale } from "@/lib/business/schema";

export function BusinessHero({
  content,
  locale,
}: {
  content: B2BPageContentRecord;
  locale: BusinessLocale;
}) {
  const isHi = locale === "hi";
  return (
    <section className="tf-hero" aria-labelledby="business-hero-title">
      <div className="tf-container tf-hero-grid">
        <div>
          <span className="tf-eyebrow">{content.eyebrow}</span>
          <h1 className="tf-hero-title" id="business-hero-title">
            {content.headline}
          </h1>
          <p className="tf-hero-body">{content.intro}</p>
          <div className="tf-hero-actions">
            <ButtonLink href="#business-quote" variant="gold">
              {content.primary_cta} <span aria-hidden="true">↗</span>
            </ButtonLink>
            <ButtonLink href="#solutions" variant="outline">
              {content.secondary_cta}
            </ButtonLink>
          </div>
        </div>

        <div className="tf-hero-media">
          {content.hero_image_url ? (
            <Image
              src={content.hero_image_url}
              alt={content.hero_image_alt}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 48vw"
              style={{ objectFit: "cover" }}
            />
          ) : null}
          <div className="tf-photo-caption" aria-hidden="true">
            <span className="tf-photo-pill">{isHi ? "25kg थोक विकल्प" : "25kg bulk option"}</span>
            <span className="tf-photo-pill">{isHi ? "250g–1kg रिटेल" : "250g–1kg retail"}</span>
            <span className="tf-photo-pill">{isHi ? "प्राइवेट लेबल" : "Private label"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
