import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ImageOff } from "lucide-react";
import type { TrialPublicDto } from "@/lib/trials/types";
import { formatINR } from "@/lib/trials/storefront-helpers";
import { ProductImpression } from "@/components/analytics/ProductImpression";
import styles from "./TrialsCollection.module.css";

export interface TrialCardProps { trial: TrialPublicDto }

export function TrialCard({ trial }: TrialCardProps) {
  const href = `/trials/${trial.slug}`;
  // Replace only the known seed's landscape with disclosed conceptual artwork.
  // Operator-uploaded catalogue assets always retain their original presentation.
  const illustrated = trial.id === "trial-discovery-200g-001" &&
    trial.hero_image?.url === "/images/trials/discovery-packaging.jpg";
  const imageUrl = illustrated ? "/images/trials/discovery-shelf-kit.webp" : trial.hero_image?.url;
  const components = [...trial.components].sort((a, b) => a.slot_index - b.slot_index);

  return (
    <article data-testid="trial-card" className={`trial-card ${styles.card}`}>
      <ProductImpression item={{ item_id: trial.sku, item_name: trial.title, item_category: "Trial", price: trial.price_paise / 100 }} list="Trials Explorer" />
      <Link href={href} className={styles.cardImage} tabIndex={-1} aria-hidden="true">
        {imageUrl ? (
          <Image src={imageUrl}
            alt={illustrated ? "Illustrative presentation of a box and four tea pouches" : (trial.hero_image?.alt_text || trial.title)}
            fill sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 760px) 46vw, (max-width: 1440px) 38vw, 520px" />
        ) : (
          <span className={styles.missingImage}><ImageOff size={26} /><span>Kit image coming soon</span></span>
        )}
        {illustrated && <span className={styles.imageDisclosure}>Illustrative packaging</span>}
      </Link>
      <div className={styles.cardHeading}>
        <p className={styles.kitLabel}>TeaFloww trials</p>
        <h3><Link href={href}>{trial.title}</Link></h3>
        <p className={styles.packDetails}>
          <span>{components.length} × {components[0]?.weight_g ?? 50}g</span>
          <span>{trial.net_weight_g}g total</span>
        </p>
      </div>
      <div className={styles.contents}>
        <p className={styles.contentsLabel}>Inside this kit</p>
        <ul aria-label={`Inside ${trial.title}`}>
          {components.map((component) => (
            <li key={component.slot_index}>
              <span>{component.name}</span><span>{component.weight_g}g</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.cardBottom}>
        <div>
          <p className={styles.price}>{formatINR(trial.price_paise, true)}</p>
          <p className={styles.delivery}>+ delivery at checkout</p>
        </div>
        <Link href={href} className={styles.kitButton} aria-label={`Explore ${trial.title}`}>
          {trial.in_stock ? "View kit" : "View details"}<ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <p className={styles.stock} data-available={trial.in_stock}>
        {trial.in_stock ? "Available to order" : "Currently unavailable"}
      </p>
    </article>
  );
}
