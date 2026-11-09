"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import type { Product } from "@/lib/products";
import { useDisplayMoney } from "@/components/international/InternationalProvider";
import { AddToCart } from "@/components/AddToCart";
import { ArrowRight, Flame } from "lucide-react";

interface CtcShowcaseProps {
  products: Product[];
}

export function CtcShowcase({ products }: CtcShowcaseProps) {
  const formatPrice = useDisplayMoney();
  if (!products || products.length === 0) return null;

  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-[#ded9cb]"
      aria-labelledby="ctc-showcase-heading"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#2c4e38] mb-3">
            <Flame size={14} className="text-[#c1a376]" />
            <span> <StorefrontText id="copy_398e171b71e988f0" fallback="Curated For Full-Bodied Boiling" /> </span>
          </div>
          <h2
            id="ctc-showcase-heading"
            className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] tracking-tight mb-4"
          > <StorefrontText id="copy_c0888de1e412186d" fallback="Teas Crafted for These Methods" /> </h2>
          <p className="text-base text-[#52594e] leading-relaxed"> <StorefrontText id="copy_001eff45a79d5336" fallback="From single-estate malty Brahmaputra Valley lots to our artisan whole-spice reserve blends — these teas possess the depth, body, and briskness needed to stand up to whole milk and boiling heat." /> </p>
        </div>

        <Link
          href="/collections/black-tea"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#18231c] hover:text-[#b36b3d] border-b border-current pb-1 transition-colors self-start md:self-end"
        >
          <span>Explore All Black &amp; Chai Blends</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {products.slice(0, 3).map((product) => {
          const primaryVariant = product.variants?.[0];
          const aromaTags = Array.isArray(product.aroma_tags)
            ? product.aroma_tags
            : typeof product.aroma_tags === "string"
              ? JSON.parse(product.aroma_tags)
              : [];

          return (
            <article
              key={product.id}
              className="bg-white rounded-2xl border border-[#ded9cb] p-6 flex flex-col justify-between hover:shadow-xl hover:border-[#2c4e38] transition-all"
            >
              <div>
                {/* Image Thumbnail */}
                <Link
                  href={`/tea/${product.slug}`}
                  className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#ede9df] block mb-5"
                >
                  <Image
                    src={product.primary_image_url || "/images/ctc-brew/method-01-kadak-chai.jpg"}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover hover:scale-105 transition-transform duration-500"
                  />
                  {product.dry_leaf_grade && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#10261f]/85 backdrop-blur-sm text-[10px] font-mono font-bold tracking-wider text-[#e6d0a7] uppercase">
                      {product.dry_leaf_grade}
                    </span>
                  )}
                </Link>

                {/* Subtitle / Terroir */}
                <div className="flex items-center justify-between text-xs text-[#717a6f] mb-2 font-medium">
                  <span>{product.flush}</span>
                  <span>{product.origin.split(",")[0]}</span>
                </div>

                {/* Title */}
                <h3 className="font-serif text-xl sm:text-2xl text-[#18231c] mb-2 leading-tight line-clamp-2 min-h-[2.4em] h-[2.4em] overflow-hidden">
                  <Link
                    href={`/tea/${product.slug}`}
                    className="hover:text-[#2c4e38] transition-colors block line-clamp-2"
                  >
                    {product.name}
                  </Link>
                </h3>

                {/* Notes */}
                <p className="text-xs text-[#636b60] italic mb-4 line-clamp-2 min-h-[2.8em] h-[2.8em] overflow-hidden">
                  &ldquo;{product.tasting_notes}&rdquo;
                </p>

                {/* Aroma Tags */}
                {aromaTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {aromaTags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-[#f3efe6] text-[10px] text-[#4d564a] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Add to Cart */}
              <div className="pt-4 border-t border-[#f0ebe0] flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] text-[#717a6f] block"> <StorefrontText id="copy_8f51d73d59f406d5" fallback="Starting from" /> </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-lg font-bold text-[#18231c]">
                      {primaryVariant ? formatPrice(primaryVariant.price_paise) : formatPrice(54900)}
                    </span>
                    {primaryVariant?.compare_at_price_paise &&
                    primaryVariant.compare_at_price_paise > primaryVariant.price_paise ? (
                      <>
                        <del
                          className="text-xs text-[#8b9285] line-through font-medium"
                          aria-label={`Original price ${formatPrice(primaryVariant.compare_at_price_paise)}`}
                        >
                          {formatPrice(primaryVariant.compare_at_price_paise)}
                        </del>
                        <span
                          className="text-[10px] font-bold text-[#1d5f38] bg-[#e8f5ec] border border-[#c3e5cd] px-1.5 py-0.5 rounded-xs"
                          aria-label={`${Math.round(
                            ((primaryVariant.compare_at_price_paise - primaryVariant.price_paise) /
                              primaryVariant.compare_at_price_paise) *
                              100
                          )} percent off`}
                        >
                          {Math.round(
                            ((primaryVariant.compare_at_price_paise - primaryVariant.price_paise) /
                              primaryVariant.compare_at_price_paise) *
                              100
                          )} <StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" /> </span>
                      </>
                    ) : null}
                  </div>
                </div>

                {primaryVariant && <AddToCart product={product} variant={primaryVariant} />}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
