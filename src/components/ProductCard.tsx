"use client";
import { ProductImpression } from "@/components/analytics/ProductImpression";
import { catalogItem } from "@/lib/seo/tracking";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Product } from "@/lib/products";
import { cupsFromGrams } from "@/lib/money";
import { AddToCart } from "@/components/AddToCart";
export function ProductCard({ product }: { product: Product }) {
  const formatINR = useDisplayMoney();

  const variant = product.variants[0];
  if (!variant) return null;
  const colorClass = product.category.toLowerCase().replace(/[^a-z]/g, "");
  return <article className="product-card">
    <ProductImpression item={catalogItem(product, variant)} />
    <Link href={"/tea/" + product.slug} className={"product-art art-" + colorClass}>
      <span className="art-badge">{product.flush}</span>
      {product.primary_image_url || variant.product_image_url ? (
        <Image
          src={product.primary_image_url || variant.product_image_url || ""}
          alt={"Artisan tea caddy for " + product.name}
          width={320}
          height={360}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          loading="lazy"
        />
      ) : (
        <svg
          role="img"
          aria-label={"Artisanal tea packaging for " + product.name}
          viewBox="0 0 320 360"
          width="320"
          height="360"
          style={{ width: "100%", height: "auto" }}
        >
          <title>{product.name}</title>
          <desc>Artisanal whole leaf tea packaging</desc>
          <rect width="320" height="360" fill="#ede9df" rx="12" />
          <rect x="60" y="80" width="200" height="200" rx="8" fill="#dfd8cb" stroke="#c9c2b6" strokeWidth="2" />
          <circle cx="160" cy="180" r="45" fill="#23483a" opacity="0.15" />
          <path d="M160 150 C175 165 175 195 160 210 C145 195 145 165 160 150 Z" fill="#23483a" />
        </svg>
      )}
      <span className="art-caption">{product.origin}</span>
    </Link>
    <div className="product-info">
      <p className="eyebrow">{product.origin} · {product.category}</p>
      <Link href={"/tea/" + product.slug} className="product-title">{product.name}</Link>
      <p className="tasting-notes">{product.tasting_notes}</p>
      <div className="product-price-row">
        <strong>{formatINR(variant.price_paise)}</strong>
        {variant.compare_at_price_paise && variant.compare_at_price_paise > variant.price_paise ? (
          <>
            <del
              className="product-original-price"
              aria-label={`Original price ${formatINR(variant.compare_at_price_paise)}`}
            >
              {formatINR(variant.compare_at_price_paise)}
            </del>
            <span
              className="product-discount-pill"
              aria-label={`${Math.round(((variant.compare_at_price_paise - variant.price_paise) / variant.compare_at_price_paise) * 100)} percent discount`}
            >
              {Math.round(((variant.compare_at_price_paise - variant.price_paise) / variant.compare_at_price_paise) * 100)}<StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" /> </span>
          </>
        ) : null}
        <span>{variant.grams} <StorefrontText id="copy_6b8e375784466001" fallback="g · ~" /> {cupsFromGrams(variant.grams)} <StorefrontText id="copy_43b69e82bee632b3" fallback="cups" /> </span>
      </div>
      <AddToCart product={product} variant={variant}/>
    </div>
  </article>;
}
