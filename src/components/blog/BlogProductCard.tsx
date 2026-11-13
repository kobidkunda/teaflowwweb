"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect } from "react";
import { LocalizedLink as Link, useDisplayMoney } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { ShoppingBag, Check, Sparkles } from "lucide-react";
import { useCart } from "@/components/CartProvider";

export interface BlogProductCardProps {
  slug?: string;
  highlight?: string;
  name?: string;
  origin?: string;
  pricePaise?: number;
  imageUrl?: string;
  variantId?: number;
  grams?: number;
  description?: string;
}

export function BlogProductCard({
  slug,
  highlight = "Featured Tea Pairing",
  name: initialName,
  origin: initialOrigin,
  pricePaise: initialPrice,
  imageUrl: initialImage,
  variantId: initialVariantId,
  grams: initialGrams = 100,
  description: initialDesc,
}: BlogProductCardProps) {
  const { add } = useCart();
  const formatMoney = useDisplayMoney();
  const [product, setProduct] = useState<{
    id: number;
    slug: string;
    name: string;
    origin?: string;
    estate?: string;
    description?: string;
    pricePaise: number;
    imageUrl: string;
    variantId: number;
    sku?: string;
    grams: number;
  } | null>(
    initialName && initialPrice
      ? {
          id: 1,
          slug: slug || "tea",
          name: initialName,
          origin: initialOrigin,
          description: initialDesc,
          pricePaise: initialPrice,
          imageUrl: initialImage || "/images/darjeeling-first-flush.jpg",
          variantId: initialVariantId || 1,
          grams: initialGrams,
        }
      : null
  );

  const [loading, setLoading] = useState(!product && Boolean(slug));
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (product || !slug) return;

    let isMounted = true;
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(slug!)}`);
        if (res.ok) {
          const data = await res.json();
          const found = (data.products as Array<{
            id: number;
            slug: string;
            name: string;
            origin?: string;
            estate?: string;
            description?: string;
            primaryImage?: { url: string } | null;
            variants?: Array<{ id: number; price_paise: number; grams: number; stock: number }>;
          }>)?.find((p) => p.slug === slug || p.slug.includes(slug!));

          if (found && isMounted) {
            const v = found.variants?.[0] || { id: found.id, price_paise: 29900, grams: 100, stock: 10 };
            setProduct({
              id: found.id,
              slug: found.slug,
              name: found.name,
              origin: found.origin || found.estate,
              description: found.description,
              pricePaise: v.price_paise || 29900,
              imageUrl:
                found.primaryImage?.url ||
                (found.slug.includes("darjeeling")
                  ? "/images/darjeeling-first-flush.jpg"
                  : found.slug.includes("assam")
                  ? "/images/assam-brewing-guide.jpg"
                  : "/images/orthodox-vs-ctc.jpg"),
              variantId: v.id,
              sku: (v as { sku?: string }).sku || `HTH-${found.id}-${v.id}`,
              grams: v.grams || 100,
            });
          }
        }
      } catch {
        // Keep fallback state
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchProduct();
    return () => {
      isMounted = false;
    };
  }, [slug, product]);

  const handleAddToCart = () => {
    if (!product) return;
    add({
      variantId: product.variantId,
      sku: product.sku || `HTH-${product.id}-${product.variantId}`,
      slug: product.slug,
      name: product.name,
      grams: product.grams,
      pricePaise: product.pricePaise,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  if (loading) {
    return (
      <div className="my-8 p-6 bg-[#f7f5f0] border border-[#e8e2d4] rounded-2xl animate-pulse">
        <div className="h-4 bg-[#e5dfd2] rounded w-1/3 mb-4" />
        <div className="h-6 bg-[#e5dfd2] rounded w-2/3 mb-2" />
        <div className="h-4 bg-[#e5dfd2] rounded w-1/2" />
      </div>
    );
  }

  const currentProduct = product || {
    id: 1,
    slug: slug || "darjeeling-first-flush",
    name: "Darjeeling First Flush Spring Blossom",
    origin: "Darjeeling Hills, West Bengal (4,800 ft)",
    description: "Delicate spring harvest with notes of mountain peach, lilac, and floral muscatel.",
    pricePaise: 19900,
    imageUrl: "/images/darjeeling-first-flush.jpg",
    variantId: 1,
    grams: 100,
  };

  const formattedPrice = formatMoney(currentProduct.pricePaise);

  const productHref =
    currentProduct.variantId === 0
      ? `/trials/${currentProduct.slug}`
      : `/tea/${currentProduct.slug}`;

  return (
    <div className="my-8 p-6 sm:p-7 bg-gradient-to-br from-[#ffffff] to-[#faf8f4] border border-[#e2dcd0] hover:border-[#2c4e38]/50 rounded-2xl shadow-sm transition-all duration-300">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2c4e38] mb-3">
        <Sparkles className="w-3.5 h-3.5 text-[#b36b3d]" />
        <span>{highlight}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <Link
          href={productHref}
          className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-[#ede9df] block group"
        >
          <Image
            src={currentProduct.imageUrl}
            alt={currentProduct.name}
            fill
            sizes="120px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        <div className="flex-1 min-w-0">
          {currentProduct.origin && (
            <p className="text-[11px] uppercase tracking-wider text-[#686f64] font-medium mb-1">
              {currentProduct.origin}
            </p>
          )}
          <h4 className="font-serif text-lg sm:text-xl font-bold text-[#18231c] leading-snug mb-1 hover:text-[#2c4e38] transition-colors">
            <Link href={productHref}>{currentProduct.name}</Link>
          </h4>
          {currentProduct.description && (
            <p className="text-xs text-[#52594e] line-clamp-2 leading-relaxed mb-3">
              {currentProduct.description}
            </p>
          )}

          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[#18231c]">
              {formattedPrice}
            </span>
            <span className="text-xs text-[#73786f]">
              / {currentProduct.grams} <StorefrontText id="copy_ad779ac849043d75" fallback="g pouch" /> </span>
          </div>
        </div>

        <div className="w-full sm:w-auto flex flex-row sm:flex-col gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0ede6]">
          <button
            type="button"
            onClick={handleAddToCart}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-all ${
              added
                ? "bg-[#2c4e38] text-white"
                : "bg-[#18231c] hover:bg-[#2c4e38] text-[#fbf9f4]"
            }`}
          >
            {added ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span> <StorefrontText id="copy_91cf2b03dd545340" fallback="Added ✓" /> </span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span> <StorefrontText id="copy_a1c22d74f4587d16" fallback="Quick Add" /> </span>
              </>
            )}
          </button>
          <Link
            href={productHref}
            className="w-full sm:w-auto px-4 py-2 border border-[#cfc8b8] hover:border-[#18231c] text-center text-xs font-semibold text-[#18231c] rounded-lg transition-colors"
          > <StorefrontText id="copy_9f69a67b48048df8" fallback="Details →" /> </Link>
        </div>
      </div>
    </div>
  );
}
