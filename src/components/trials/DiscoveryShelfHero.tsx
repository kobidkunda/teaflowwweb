import React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import styles from "./TrialsCollection.module.css";

export function DiscoveryShelfHero() {
  return (
    <section className={styles.hero} aria-labelledby="trials-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>The discovery shelf</p>
          <h1 id="trials-title">So many ways to<br />find <em>your cup.</em></h1>
          <p className={styles.heroDescription}>
            A little exploration. A more personal tea ritual. Discover what’s inside
            each kit, brew it your way, and find the teas you love.
          </p>
          <a href="#trials-catalogue" className={styles.heroButton}>
            Browse discovery kits <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className={styles.heroNote}>Small packs. Room to explore.</p>
        </div>
        <figure className={styles.heroVisual}>
          <Image src="/images/trials/discovery-shelf-hero.webp"
            alt="An illustrative tasting table with four cups of milk chai, tea pouches and spices"
            fill priority sizes="(max-width: 760px) 100vw, 58vw" />
          <figcaption>Illustrative imagery</figcaption>
        </figure>
      </div>
    </section>
  );
}
