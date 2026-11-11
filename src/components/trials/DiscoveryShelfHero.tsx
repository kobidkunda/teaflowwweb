import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import styles from "./TrialsCollection.module.css";

export function DiscoveryShelfHero() {
  return (
    <section className={styles.hero} aria-labelledby="trials-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><StorefrontText id="copy_62ed4b163c497c0f" fallback="The discovery shelf" /></p>
          <h1 id="trials-title"><StorefrontText id="copy_1faebb75622786d3" fallback="So many ways to" /><br /><StorefrontText id="copy_e6640de835ad09fb" fallback="find" /> <em><StorefrontText id="copy_96dc1fc3faff29fb" fallback="your cup." /></em></h1>
          <p className={styles.heroDescription}><StorefrontText id="copy_3f2a63425b7a838e" fallback="A little exploration. A more personal tea ritual. Discover what’s inside each kit, brew it your way, and find the teas you love." />
          </p>
          <a href="#trials-catalogue" className={styles.heroButton}><StorefrontText id="copy_dff9e2b30b5bc644" fallback="Browse discovery kits" /> <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className={styles.heroNote}><StorefrontText id="copy_a94416013fdb0d61" fallback="Small packs. Room to explore." /></p>
        </div>
        <figure className={styles.heroVisual}>
          <Image src="/images/trials/discovery-shelf-hero.webp"
            alt="An illustrative tasting table with four cups of milk chai, tea pouches and spices"
            fill priority sizes="(max-width: 760px) 100vw, 58vw" />
          <figcaption><StorefrontText id="copy_502a92e58a7f080b" fallback="Illustrative imagery" /></figcaption>
        </figure>
      </div>
    </section>
  );
}
