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

  const variantPrices = product.variants.map((v) => v.price_paise).filter((p) => typeof p === "number" && p > 0);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : variant.price_paise;
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : variant.price_paise;
  const hasMultiplePrices = minPrice !== maxPrice;
  const priceDisplay = hasMultiplePrices ? `${formatINR(minPrice)} – ${formatINR(maxPrice)}` : formatINR(variant.price_paise);

  const allWholesaleSlabs = product.variants.flatMap((v) =>
    (v.wholesale_slabs || []).map((s) => ({
      ...s,
      regularPricePaise: v.price_paise,
    }))
  );
  const bestWholesaleSlab = allWholesaleSlabs.length > 0
    ? [...allWholesaleSlabs].sort((a, b) => a.price_paise - b.price_paise)[0]
    : null;
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
      <div className="product-price-row" style={{ flexWrap: "wrap", gap: "6px" }}>
        <strong>{priceDisplay}</strong>
        {variant.compare_at_price_paise && variant.compare_at_price_paise > variant.price_paise && !hasMultiplePrices ? (
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
        {bestWholesaleSlab && (
          <div
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#23483a",
              background: "#eaf3e9",
              border: "1px solid #b7d6be",
              borderRadius: "4px",
              padding: "2px 6px",
              marginTop: "2px",
            }}
          >
            <span><StorefrontText id="copy_46cf537d6f511463" fallback="🌿 Wholesale from:" /></span>
            {bestWholesaleSlab.regularPricePaise > bestWholesaleSlab.price_paise && (
              <del style={{ color: "#7a8274", fontWeight: 500 }}>
                {formatINR(bestWholesaleSlab.regularPricePaise)}
              </del>
            )}
            <strong style={{ color: "#1b3022" }}>{formatINR(bestWholesaleSlab.price_paise)}</strong>
            <span style={{ color: "#465244", fontSize: "10px" }}><StorefrontText id="copy_2e4cf228d2da709a" fallback="· Min" /> {bestWholesaleSlab.min_qty}<StorefrontText id="copy_d7d4f59db48fb4b8" fallback="pcs" /></span>
          </div>
        )}
      </div>
      <AddToCart product={product} variant={variant}/>
    </div>
  </article>;
}
