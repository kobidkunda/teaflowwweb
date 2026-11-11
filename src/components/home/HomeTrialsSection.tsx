import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HomepageContent } from "@/lib/homepageSchema";
import type { TrialPublicDto } from "@/lib/trials/types";
import { homeTrialsPresentation } from "@/lib/homeTrialsPresentation";
import styles from "./HomeTrialsSection.module.css";

export interface HomeTrialsSectionProps {
  config?: Partial<NonNullable<HomepageContent["trials"]>>;
  featuredTrial: TrialPublicDto;
  otherTrials?: TrialPublicDto[];
}

export function HomeTrialsSection({ config, featuredTrial }: HomeTrialsSectionProps) {
  if (!featuredTrial || config?.enabled === false) return null;
  const content = homeTrialsPresentation(config);
  const desktop = content.image_url || content.mobile_image_url;
  const mobile = content.mobile_image_url || desktop;
  return (
    <section id="home-trials" className={`tf-home-trials ${styles.section}`} aria-labelledby="home-trials-heading">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h2 id="home-trials-heading">{content.title}{" "}<em>{content.emphasis}</em>{" "}{content.title_suffix}</h2>
        <p className={styles.description}>{content.description}</p>
      </div>
      {desktop && <figure className={styles.visual}>
        <picture>
          <source media="(max-width: 640px)" srcSet={mobile} />
          <Image src={desktop} alt={content.image_alt} fill sizes="(max-width: 1440px) 100vw, 1440px" quality={75} />
        </picture>
        {content.image_caption && <figcaption>{content.image_caption}</figcaption>}
      </figure>}
      <div className={styles.action}>
        <p className={styles.actionEyebrow}><StorefrontText id="copy_c1abf2cadafd11db" fallback="The discovery starts here" /></p>
        {/* Explicit top fragment avoids retaining the invitation's deep scroll position. */}
        <Link href="/trials#top" className={styles.cta}>{content.cta.label}<ArrowRight size={23} aria-hidden="true" /></Link>
        {content.supporting_text && <p className={styles.supporting}>{content.supporting_text}</p>}
        <p className={styles.pack}>{featuredTrial.components.length} × {featuredTrial.components[0]?.weight_g ?? 50}<StorefrontText id="copy_4f0fa1e01ae0f94e" fallback="g pouches ·" /> {featuredTrial.net_weight_g}<StorefrontText id="copy_a9299e652d13216a" fallback="g per kit" /></p>
      </div>
    </section>
  );
}
