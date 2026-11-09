import React from "react";
import { TeaMomentsImage } from "./TeaMomentsImage";
import type { Product } from "@/lib/products";
import { parseTeaMoments } from "@/lib/teaMoments";
import styles from "./TeaMoments.module.css";

export function TeaMoments({ product }: { product: Product }) {
  const content = parseTeaMoments(product.tea_moments);
  if (!content?.introduction) return null;
  const recommendations = [
    ["The moment", content.occasion],
    ["Serve it your way", content.serving_suggestion],
    ["Pair it with", content.food_pairing],
  ].filter(([, value]) => value);
  return (
    <section className={`${styles.moments} ${content.image_url ? styles.withImage : ""}`} aria-label={`Tea Moments for ${product.name}`} data-testid="tea-moments">
      {content.image_url && <TeaMomentsImage key={content.image_url} url={content.image_url} alt={content.image_alt} />}
      <div className={styles.copy}>
        <h2>{content.headline || "Make it your moment."}</h2>
        <p className={styles.introduction}>{content.introduction}</p>
        {recommendations.length > 0 && <dl className={styles.recommendations}>
          {recommendations.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>}
      </div>
    </section>
  );
}
