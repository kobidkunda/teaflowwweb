"use client";
import { ProductImpression } from "@/components/analytics/ProductImpression";
import { catalogItem } from "@/lib/seo/tracking";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import React, { useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Product, Variant } from "@/lib/products";

import { useCart } from "@/components/CartProvider";
import {
  Heart,
  ShoppingBag,
  ArrowRight,
  Eye,
} from "lucide-react";

export interface ShopProductCardProps {
  product: Product;
  index: number;
  onQuickView?: (product: Product) => void;
}

export function ShopProductCard({
  product,
  index,
  onQuickView,
}: ShopProductCardProps) {
  const formatINR = useDisplayMoney();

  const { add } = useCart();
  const selectedVariantId = product.variants[0]?.id ?? 0;
  const [wishlisted, setWishlisted] = useState<boolean>(false);
  const [added, setAdded] = useState<boolean>(false);

  const activeVariant: Variant | undefined =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants[0];

  if (!activeVariant) return null;

  const colorClass = product.category.toLowerCase().replace(/[^a-z]/g, "");
  // Modern Web Guidance: fetchpriority="high", priority=true for first 2 images
  const isHighPriority = index < 2;

  // Genuine badges derived from product database values
  const badge1 = product.featured === 1 ? "RESERVE LOT" : "SINGLE ESTATE";
  const badge1Class = product.featured === 1 ? "badge-green" : "badge-dark";
  const isSpecialFlush =
    Boolean(product.flush) &&
    !["not applicable", "assorted"].includes(product.flush.toLowerCase());
  const badge2 = isSpecialFlush ? product.flush.toUpperCase() : "100% ORTHODOX";

  // Truthful provenance line
  const provenanceParts = [
    product.origin ? product.origin.split(",")[0].trim().toUpperCase() : null,
    product.estate ? product.estate.trim().toUpperCase() : null,
    isSpecialFlush ? product.flush.trim().toUpperCase() : null,
  ].filter(Boolean);

  const provenanceLine =
    provenanceParts.length > 0
      ? provenanceParts.join(" • ")
      : "SINGLE ESTATE • HIMALAYAN HIGHLANDS";

  const description =
    product.tasting_notes || product.description;

  const tags =
    product.aroma_tags && product.aroma_tags.length > 0
      ? product.aroma_tags.slice(0, 4)
      : [product.category, product.estate].filter(Boolean);

  const imageUrl =
    product.primary_image?.url ||
    product.primary_image_url ||
    activeVariant.product_image_url ||
    "/uploads/product-darjeeling-tin.jpg";

  const imageAlt =
    product.primary_image?.alt_text ||
    `Single estate tea caddy for ${product.name} from ${product.estate}`;

  const handleAddToCart = () => {
    if (activeVariant.stock < 1) return;
    add({
      variantId: activeVariant.id, sku: activeVariant.sku?.trim() || `HTH-${product.id}-${activeVariant.id}`,
      slug: product.slug,
      name: product.name,
      grams: activeVariant.grams,
      pricePaise: activeVariant.price_paise,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  };

  return (
    <div className="shop-card-wrapper">
      <article
        className="shop-product-card tf-mockup-product-card"
        data-testid={`shop-card-${product.slug}`}
      >
        <ProductImpression item={catalogItem(product, activeVariant)} list="Shop" />
        {/* 1. Visual Artwork Container */}
        <div
          className={`shop-card-art art-${colorClass} tf-mockup-card-art`}
          role="img"
          aria-label={imageAlt}
        >
          {/* Dual badges at top-left matching design system */}
          <div className="tf-card-badges-stack" aria-label="Product distinctions">
            <span className={`tf-mockup-badge ${badge1Class}`}>
              {badge1}
            </span>
            <span className="tf-mockup-badge badge-white">{badge2}</span>
          </div>

          {/* Wishlist toggle circle at top-right */}
          <button
            type="button"
            className={`tf-mockup-wishlist-btn ${wishlisted ? "active" : ""}`}
            onClick={() => setWishlisted(!wishlisted)}
            aria-label={
              wishlisted
                ? `Remove ${product.name} from wishlist`
                : `Add ${product.name} to wishlist`
            }
            aria-pressed={wishlisted}
            title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={15}
              fill={wishlisted ? "#c92a2a" : "none"}
              color={wishlisted ? "#c92a2a" : "#2d382e"}
              strokeWidth={1.75}
            />
          </button>

          {/* Product tin photography with fetchpriority optimization */}
          <Link
            href={`/tea/${product.slug}`}
            className="shop-card-art-link tf-mockup-art-link"
            tabIndex={-1}
            aria-hidden="true"
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={imageAlt}
                width={420}
                height={260}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                priority={isHighPriority}
                fetchPriority={isHighPriority ? "high" : undefined}
                loading={isHighPriority ? "eager" : "lazy"}
                className="shop-card-tin-img tf-mockup-tin-img"
              />
            ) : (
              <svg
                role="img"
                aria-label={imageAlt}
                viewBox="0 0 420 260"
                width={420}
                height={260}
                className="shop-card-tin-img tf-mockup-tin-img"
                style={{ width: "100%", height: "auto", aspectRatio: "420/260" }}
              >
                <title>{product.name}</title>
                <desc>Artisanal whole leaf tea packaging</desc>
                <rect width={420} height={260} fill="#ede9df" rx="10" />
                <rect x="110" y="40" width="200" height="180" rx="8" fill="#dfd8cb" />
              </svg>
            )}
          </Link>
        </div>

        {/* 2. Product Details Content */}
        <div className="shop-card-body tf-mockup-card-body">
          {/* Provenance & harvest uppercase subtitle */}
          <p className="tf-mockup-provenance-line">{provenanceLine}</p>

          {/* Product Title */}
          <h2 className="shop-card-title tf-mockup-card-title">
            <Link href={`/tea/${product.slug}`} title={product.name}>
              {product.name}
            </Link>
          </h2>

          {/* Short description */}
          <p className="shop-card-tasting tf-mockup-desc">{description}</p>

          {/* Taste notes pills */}
          <div className="tf-mockup-taste-chips" aria-label="Tasting notes">
            {tags.map((tag) => (
              <span key={tag} className="tf-mockup-taste-pill">
                {tag}
              </span>
            ))}
          </div>

          {/* Price & Specs row (Truthful weight & elevation) */}
          <div className="tf-mockup-price-rating-row">
            <div className="tf-mockup-price-stack">
              <strong className="tf-mockup-price">
                {formatINR(activeVariant.price_paise)}
              </strong>
              {activeVariant.compare_at_price_paise && activeVariant.compare_at_price_paise > activeVariant.price_paise ? (
                <div className="tf-mockup-discount-wrap">
                  <del
                    className="tf-mockup-original-price"
                    aria-label={`Original price ${formatINR(activeVariant.compare_at_price_paise)}`}
                  >
                    {formatINR(activeVariant.compare_at_price_paise)}
                  </del>
                  <span
                    className="tf-mockup-discount-badge"
                    aria-label={`${Math.round(((activeVariant.compare_at_price_paise - activeVariant.price_paise) / activeVariant.compare_at_price_paise) * 100)} percent discount`}
                  >
                    {Math.round(((activeVariant.compare_at_price_paise - activeVariant.price_paise) / activeVariant.compare_at_price_paise) * 100)}<StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" /> </span>
                </div>
              ) : null}
            </div>

            <div
              className="tf-mockup-rating-wrap"
              aria-label={`Format: ${activeVariant.grams}g${product.elevation_display ? `, elevation ${product.elevation_display}` : ""}`}
            >
              <span className="tf-mockup-review-count">
                {activeVariant.grams}g{product.elevation_display ? ` • ${product.elevation_display}` : ""}
              </span>
            </div>
          </div>

          {/* Full-width Add to Cart button */}
          <div className="tf-mockup-action-row">
            <button
              type="button"
              className={`tf-mockup-add-to-cart-btn ${added ? "added" : ""}`}
              onClick={handleAddToCart}
              disabled={activeVariant.stock < 1}
              aria-live="polite"
              aria-label={
                activeVariant.stock < 1
                  ? "Sold out"
                  : `Add ${product.name} to cart`
              }
            >
              <span className="tf-mockup-btn-left">
                <ShoppingBag size={15} aria-hidden="true" />
                <span>
                  {activeVariant.stock < 1
                    ? "Sold out"
                    : added
                    ? "Added to Cart ✓"
                    : "Add to Cart"}
                </span>
              </span>
              <span className="tf-mockup-btn-arrow-circle" aria-hidden="true">
                <ArrowRight size={13} />
              </span>
            </button>

            {onQuickView && (
              <button
                type="button"
                className="tf-mockup-quickview-icon-btn shop-card-quickview-btn"
                onClick={() => onQuickView(product)}
                aria-label={`Quick look tasting notes for ${product.name}`}
                title="View cupping notes & dossier"
              >
                <Eye size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
