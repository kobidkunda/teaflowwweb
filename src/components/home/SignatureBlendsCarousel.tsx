"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Heart, Pause, Play, ArrowRight } from "lucide-react";
import type { Product, Variant } from "@/lib/products";

import { AddToCart } from "@/components/AddToCart";
import { ProductImpression } from "@/components/analytics/ProductImpression";
import { catalogItem } from "@/lib/seo/tracking";
import styles from "./SignatureBlendsShelf.module.css";

interface SignatureBlendsCarouselProps {
  products: Product[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

export function SignatureBlendsCarousel({
  products,
  eyebrow = "OUR SIGNATURE BLENDS",
  title = "Leaves worth lingering over.",
  subtitle = "Carefully crafted blends that bring out the extraordinary in every cup.",
}: SignatureBlendsCarouselProps) {
  const formatINR = useDisplayMoney();

  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [wishlist, setWishlist] = useState<Record<number, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(products.length > 1);
  const [activeIndex, setActiveIndex] = useState(0);

  // Modern Web Guidance & WCAG 2.2.2 Pause/Stop/Hide compliance
  const [isInView, setIsInView] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [isTouchInteracting, setIsTouchInteracting] = useState(false);

  // Modern Web Guidance: Only auto-advance when the carousel section is visible in the viewport
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry) {
          setIsInView(entry.isIntersecting);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Modern Web Guidance: Update scroll boundaries & active card index on scroll/resize
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const left = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 8);
    setCanScrollRight(left < max - 8);

    const firstCard = el.children[0] as HTMLElement | null;
    const secondCard = el.children[1] as HTMLElement | null;
    if (firstCard) {
      const step =
        secondCard && firstCard
          ? secondCard.offsetLeft - firstCard.offsetLeft
          : firstCard.offsetWidth + 22;
      const idx = Math.round(left / (step || 1));
      setActiveIndex(Math.max(0, Math.min(products.length - 1, idx)));
    }
  }, [products.length]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  // Smooth scroll handler with prefers-reduced-motion fallback
  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const firstCard = el.children[0] as HTMLElement | null;
    const secondCard = el.children[1] as HTMLElement | null;
    const step =
      secondCard && firstCard
        ? secondCard.offsetLeft - firstCard.offsetLeft
        : firstCard
        ? firstCard.offsetWidth + 22
        : 320;
    const amount = typeof window !== "undefined" && window.innerWidth < 768 ? step : step * 2;
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: isReduced ? "auto" : "smooth",
    });
  };

  const scrollToIndex = useCallback((idx: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const clampedIdx = Math.max(0, Math.min(products.length - 1, idx));
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (clampedIdx === 0) {
      el.scrollTo({
        left: 0,
        behavior: isReduced ? "auto" : "smooth",
      });
      setActiveIndex(0);
      return;
    }

    const targetCard = el.children[clampedIdx] as HTMLElement | null;
    if (targetCard) {
      // Calculate target horizontal offset within the container.
      // Never use scrollIntoView here because scrollIntoView causes ancestor containers
      // and the browser window to scroll vertically, creating unexpected jumps when scrolling down.
      const targetLeft =
        targetCard.offsetParent === el
          ? targetCard.offsetLeft
          : targetCard.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;

      el.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: isReduced ? "auto" : "smooth",
      });
      setActiveIndex(clampedIdx);
    }
  }, [products.length]);

  // Modern Web Guidance: Auto-swipe interval with pause controls, viewport visibility check, and prefers-reduced-motion
  useEffect(() => {
    if (products.length <= 1) return;
    if (!isInView || isUserPaused || isHoverPaused || isFocusPaused || isTouchInteracting) return;

    const isReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const nextIdx = (activeIndex + 1) % products.length;
      scrollToIndex(nextIdx);
    }, 4500);

    return () => clearInterval(timer);
  }, [products.length, activeIndex, isInView, isUserPaused, isHoverPaused, isFocusPaused, isTouchInteracting, scrollToIndex]);

  // Handle touch interactions to pause auto-swipe temporarily while the user is actively swiping
  const handleTouchStart = () => {
    setIsTouchInteracting(true);
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
  };

  const handleTouchEnd = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
    // Resume auto-swipe after 5 seconds of touch inactivity
    touchTimeoutRef.current = setTimeout(() => {
      setIsTouchInteracting(false);
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard navigation when focus is in carousel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll("right");
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollToIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      scrollToIndex(products.length - 1);
    }
  };

  const toggleWishlist = (id: number) => {
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!products || products.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      id="tf-signature-section"
      className={`tf-signature-section ${styles.shelf}`}
      aria-label="Our signature blends"
    >
      <div className="container">
        {/* Header row */}
        <div className="tf-signature-header">
          <div className="tf-signature-titles">
            <span className="eyebrow">{eyebrow}</span>
            <h2 className="tf-signature-h2">{title}</h2>
          </div>
          <div className="tf-signature-controls-wrap">
            <p className="tf-signature-sub">{subtitle}</p>
            <div className="tf-signature-arrows" role="group" aria-label="Carousel navigation">
              <button
                type="button"
                onClick={() => setIsUserPaused((prev) => !prev)}
                className={`tf-carousel-btn tf-carousel-pause-btn ${isUserPaused ? "is-paused" : ""}`}
                aria-label={isUserPaused ? "Play auto-swipe" : "Pause auto-swipe"}
                title={isUserPaused ? "Play auto-swipe" : "Pause auto-swipe"}
                aria-pressed={!isUserPaused}
              >
                {isUserPaused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Previous tea blend"
                className={`tf-carousel-btn ${!canScrollLeft ? "disabled" : ""}`}
                disabled={!canScrollLeft}
                aria-disabled={!canScrollLeft}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Next tea blend"
                className={`tf-carousel-btn ${!canScrollRight ? "disabled" : ""}`}
                disabled={!canScrollRight}
                aria-disabled={!canScrollRight}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel / Product cards row */}
        <div
          ref={scrollContainerRef}
          id="signature-blends-track"
          className="tf-signature-track curated-shelf shelf-grid"
          data-testid="curated-shelf"
          tabIndex={0}
          role="region"
          aria-label="Signature blends product showcase"
          aria-roledescription="carousel"
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHoverPaused(true)}
          onMouseLeave={() => setIsHoverPaused(false)}
          onFocus={() => setIsFocusPaused(true)}
          onBlur={() => setIsFocusPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {products.map((product, index) => {
            const variant: Variant | undefined = product.variants[0];
            if (!variant) return null;

            const isWished = !!wishlist[product.id];
            const imageUrl =
              product.primary_image?.url ||
              product.primary_image_url ||
              variant.product_image_url;
            const imageAlt =
              product.primary_image?.alt_text ||
              `Artisan tea canister for ${product.name}`;

            return (
              <article
                key={product.id}
                className="tf-product-card"
                data-testid={`signature-card-${product.slug}`}
                aria-label={`${index + 1} of ${products.length}: ${product.name}`}
              >
                <ProductImpression item={catalogItem(product, variant)} list="Signature Blends" />
                {/* Visual Tin Container */}
                <div className="tf-product-card-visual">
                  <div className="tf-card-top-row">
                    <button
                      type="button"
                      className={`tf-wishlist-toggle ${isWished ? "wished" : ""}`}
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={isWished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                      aria-pressed={isWished}
                    >
                      <Heart size={18} fill={isWished ? "#b34033" : "none"} stroke={isWished ? "#b34033" : "currentColor"} />
                    </button>
                  </div>

                  <Link href={`/tea/${product.slug}`} className="tf-product-img-link" tabIndex={-1} aria-label={`View ${product.name}`}>
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={imageAlt}
                        width={320}
                        height={320}
                        loading="lazy"
                        quality={70}
                        sizes="(max-width: 1023px) 46vw, 320px"
                        className="tf-product-tin-img"
                      />
                    ) : (
                      <span className={styles.missingImage}><StorefrontText id="copy_7817cd06563196ee" fallback="Image unavailable" /></span>
                    )}
                  </Link>
                </div>

                {/* Details Container */}
                <div className="tf-product-card-body">
                  <h3 className="tf-card-title">
                    <Link href={`/tea/${product.slug}`}>{product.name}</Link>
                  </h3>
                  <p className={styles.category}>{product.category.replace(/[-_]/g, " ")}</p>
                  <p className="tf-card-tasting-notes">{product.tasting_notes}</p>

                  <div className="tf-card-stars-row" aria-label={`Terroir: ${[product.estate, product.elevation_display].filter(Boolean).join(", ")}`}>
                    <span className="tf-rating-count">
                      {[product.estate, product.flush, product.elevation_display].filter(Boolean).join(" • ")}
                    </span>
                  </div>

                  <div className="tf-card-price-row">
                    <span className="tf-card-price">{formatINR(variant.price_paise)}</span>
                    {variant.compare_at_price_paise && variant.compare_at_price_paise > variant.price_paise ? (
                      <>
                        <del
                          className="tf-card-original-price"
                          aria-label={`Original price ${formatINR(variant.compare_at_price_paise)}`}
                        >
                          {formatINR(variant.compare_at_price_paise)}
                        </del>
                      </>
                    ) : null}
                  </div>

                  <div className="tf-card-actions">
                    <AddToCart product={product} variant={variant} accessibleLabel={`Add ${product.name} to bag`} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Carousel pagination indicators */}
        {products.length > 1 && (
          <div className="tf-carousel-dots-wrap" role="group" aria-label="Carousel pagination">
            {products.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`tf-carousel-dot ${i === activeIndex ? "active" : ""}`}
                onClick={() => scrollToIndex(i)}
                aria-label={`Jump to slide ${i + 1}: ${p.name}`}
                aria-current={i === activeIndex ? "true" : undefined}
              />
            ))}
          </div>
        )}

        {/* Bottom Section Action: View all products */}
        <div className={`tf-signature-bottom-cta ${styles.bottomCta}`}>
          <Link
            href="/shop"
            className={`tf-signature-view-all-btn ${styles.viewAllBtn}`}
            aria-label="View all products in shop"
          >
            <span>
              <StorefrontText id="home.view_all_products" fallback="View all products" />
            </span>
            <ArrowRight size={18} aria-hidden="true" className={`tf-signature-btn-arrow ${styles.btnArrow}`} />
          </Link>
        </div>
      </div>
    </section>
  );
}
