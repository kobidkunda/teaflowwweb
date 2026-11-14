"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Mountain, Sprout, X, Leaf, Heart, ChevronLeft, ChevronRight, Pause, Play, Sparkles, ArrowRight } from "lucide-react";
import type { Slider } from "@/lib/storefront";
import type { SitePlacement } from "@/lib/media";

export interface HomeHeroProps {
  slider?: Slider | null;
  sliders?: Slider[];
  placement?: SitePlacement | null;
  category?: string;
  categoryCoverImage?: string | null;
  categoryTitle?: string | null;
  categoryDescription?: string | null;
}

export interface CategoryHeroInfo {
  overline: string;
  title: string;
  subtitle: string;
}

export interface HeroSlideData {
  id: number | string;
  overline: string;
  title: string;
  subtitle: string;
  bgImage: string;
  bgAlt: string;
  cardImage?: string;
  cardAlt: string;
  cardTitle: string;
  cardHref: string;
  cardBadge?: string;
  cardCtaLabel?: string;
  ctaLabel?: string;
  ctaHref?: string;
  chapterLabel?: string;
  chapterLabelShort?: string;
  harvestLot?: string;
  teaName?: string;
  elevationPrice?: string;
  tastingNotes?: string;
  pillars: {
    icon: "leaf" | "mountain" | "heart" | "sprout";
    text: string;
  }[];
}

export const CATEGORY_HERO_CONTENT: Record<string, CategoryHeroInfo> = {
  black: {
    overline: "THE TEAFLOWW COLLECTION · BLACK TEAS",
    title: "Single-Estate Black Flushes & Mountain Terroirs.",
    subtitle:
      "Bold, malty orthodox flushes from Upper Assam and fragrant muscatel single-gardens from Darjeeling, cupped and sealed at origin.",
  },
  green: {
    overline: "THE TEAFLOWW COLLECTION · GREEN TEAS",
    title: "Single-Estate Green Flushes & High Terroirs.",
    subtitle:
      "Delicately pan-fired and steamed high-mountain green flushes from Kangra Valley and Nilgiri, preserving raw vitality and sweet vegetative notes.",
  },
  oolong: {
    overline: "THE TEAFLOWW COLLECTION · OOLONG TEAS",
    title: "Single-Estate Oolong Flushes & Mountain Terroirs.",
    subtitle:
      "Complex, multi-layered oolongs with roasted walnut, dried apricot, and mountain orchid aromatics from high-elevation Darjeeling estates.",
  },
  white: {
    overline: "THE TEAFLOWW COLLECTION · WHITE TEAS",
    title: "Single-Estate White Flushes & Silver Needles.",
    subtitle:
      "Sun-dried tender downy buds and delicate white peony leaves harvested before spring dawn in the misty Himalayan foothills.",
  },
  chai: {
    overline: "THE TEAFLOWW COLLECTION · BOTANICALS & CHAI",
    title: "Single-Estate Spiced Flushes & Mountain Botanicals.",
    subtitle:
      "Whole Himalayan spices, freshly dried mountain ginger, and aromatic herbal tisanes crafted for restorative daily rituals.",
  },
  "everyday-milk-chai": {
    overline: "THE TEAFLOWW COLLECTION · EVERYDAY MILK CHAI",
    title: "Robust Mountain Kadak & Daily Morning Chai.",
    subtitle:
      "Strong orthodox CTC flushes from Dooars & Upper Assam, balanced for rich milk decoctions, spicy aromatic notes, and spirited daily mornings.",
  },
  "bengal-signature-blends": {
    overline: "THE TEAFLOWW COLLECTION · BENGAL SIGNATURE BLENDS",
    title: "Heritage Kolkata Kadak & Bengal High Terroirs.",
    subtitle:
      "Time-honoured regional blends combining bold malt vitality with fragrant high-mountain orthodox leaves.",
  },
  "regional-tea-origins": {
    overline: "THE TEAFLOWW COLLECTION · REGIONAL ORIGINS",
    title: "Single-Garden Terroirs Across the Himalayas.",
    subtitle:
      "Distinct terroir expressions comparing micro-climates, altitudes, and harvest seasons from historic tea-growing valleys.",
  },
  "iced-clear-teas": {
    overline: "THE TEAFLOWW COLLECTION · ICED & CLEAR TEAS",
    title: "Refreshing Cold Brews & Delicate High Flushes.",
    subtitle:
      "Crisp, crystal-clear cold infusions capturing vibrant vegetative notes, orchard fruits, and clean mountain sweetness.",
  },
  herbal: {
    overline: "THE TEAFLOWW COLLECTION · BOTANICALS & TISANES",
    title: "Single-Estate Mountain Botanicals & Herbal Tisanes.",
    subtitle:
      "Naturally caffeine-free whole flowers, forest herbs, and soothing Himalayan botanicals curated for quiet evening reflection.",
  },
  samplers: {
    overline: "THE TEAFLOWW COLLECTION · DISCOVERY FLIGHTS",
    title: "Single-Estate Tasting Flights & Samplers.",
    subtitle:
      "Carefully paired seasonal flushes and estate samplers comparing elevations, cultivars, and terroir expressions.",
  },
  gifts: {
    overline: "THE TEAFLOWW COLLECTION · GIFT COLLECTIONS",
    title: "Single-Estate Flushes & Connoisseur Gift Sets.",
    subtitle:
      "Artisanal heritage gift selections and whole-leaf tasting flights curated for discerning tea connoisseurs.",
  },
  rare: {
    overline: "THE TEAFLOWW COLLECTION · RESERVE LOTS",
    title: "Single-Estate Reserve Flushes & Limited Lots.",
    subtitle:
      "Exclusively numbered micro-lots, competition trophy flushes, and rare heritage cultivars graded and certified by master estate cuppers.",
  },
};

const DEFAULT_HERO_SLIDES: HeroSlideData[] = [
  {
    id: 1,
    overline: "THE TEAFLOWW COLLECTION",
    title: "Single-Estate Flushes & Mountain Terroirs.",
    subtitle:
      "Single-garden harvests, seasonal flushes, and micro-lots curated for those who seek purity, provenance and a deeper connection to tea.",
    bgImage: "/uploads/upload_1791894845311_49cf0062f51c_teafloww_homepage_hero_1920x800.webp",
    bgAlt: "Himalayan mountain tea estate at sunrise with terraced gardens and misty peaks",
    cardImage: "/uploads/darjeeling-spring-hero-v2.webp",
    cardAlt: "TeaFloww Darjeeling First Flush Luxury Green Caddy",
    cardTitle: "From\nOur Gardens\nto Your Cup",
    cardHref: "/shop",
    chapterLabel: "01. Darjeeling First Flush",
    chapterLabelShort: "01. First Flush",
    harvestLot: "2026 First Flush · Margaret's Hope",
    teaName: "Darjeeling First Flush",
    elevationPrice: "₹850 · Single Estate · 6,800 ft",
    tastingNotes: "Muscatel • Wild Orchid • Crisp Finish",
    pillars: [
      { icon: "leaf", text: "Authentic Single Estates" },
      { icon: "mountain", text: "High-Altitude Gardens" },
      { icon: "heart", text: "Small Batch & Fresh" },
      { icon: "sprout", text: "No Artificial Flavours" },
    ],
  },
  {
    id: 2,
    overline: "SPRING 2026 HARVEST",
    title: "Fresh Harvest, Rich Flavour — Tea Inspiration",
    subtitle:
      "Tender downy buds plucked at dawn in misty Himalayan heights above 6,500 ft. Crisp muscatel notes with vibrant golden amber liquor.",
    bgImage: "/uploads/upload_1791839388474_c26b4f4ddb2d_teafloww-fresh-harvest-1920x800.webp",
    bgAlt: "Sunrise panoramic view of Himalayan tea slopes bathed in golden dawn light",
    cardImage: "/uploads/product-darjeeling-tin.jpg",
    cardAlt: "Himalayan High-Altitude Reserve Oolong Tea Caddy",
    cardTitle: "Origin Cupping\n& Ceremony",
    cardHref: "/shop?category=Black%20Tea",
    chapterLabel: "02. High-Altitude Oolong",
    chapterLabelShort: "02. Oolong",
    harvestLot: "Reserve Lot 04 · Giddapahar Estate",
    teaName: "High-Altitude Oolong",
    elevationPrice: "₹920 · 7,200 ft Elevation",
    tastingNotes: "Roasted Walnut • Peach Blossom • Honeyed",
    pillars: [
      { icon: "leaf", text: "Authentic Single Estates" },
      { icon: "mountain", text: "High-Altitude Gardens" },
      { icon: "heart", text: "Small Batch & Fresh" },
      { icon: "sprout", text: "No Artificial Flavours" },
    ],
  },
  {
    id: 3,
    overline: "EXCLUSIVE HARVEST LOTS",
    title: "From Leaf to Cup — Discover the Tea Journey",
    subtitle:
      "Century-old clonal gardens along mist-shrouded mountain valleys. Deep honeyed malt, rich cocoa, and sweet vegetative vitality.",
    bgImage: "/uploads/upload_1791839391093_8156e48d5836_teafloww-leaf-to-cup-1920x800.webp",
    bgAlt: "Rolling terraced green tea hills under morning fog in the Himalayan foothills",
    cardImage: "/uploads/product-assam-tin.jpg",
    cardAlt: "TeaFloww Artisanal Assam Orthodox Whole Leaf Caddy",
    cardTitle: "Crafted by\nMaster Planters",
    cardHref: "/shop?category=Green%20Tea",
    chapterLabel: "03. Himalayan Gold Black",
    chapterLabelShort: "03. Gold Black",
    harvestLot: "Heritage Clonal · Upper Assam",
    teaName: "Himalayan Gold Black",
    elevationPrice: "₹780 · Heritage Garden Orthodox",
    tastingNotes: "Malty Cocoa • Sweet Raisin • Deep Amber",
    pillars: [
      { icon: "leaf", text: "Authentic Single Estates" },
      { icon: "mountain", text: "High-Altitude Gardens" },
      { icon: "heart", text: "Small Batch & Fresh" },
      { icon: "sprout", text: "No Artificial Flavours" },
    ],
  },
];

function PillarIcon({ icon }: { icon: "leaf" | "mountain" | "heart" | "sprout" }) {
  switch (icon) {
    case "mountain":
      return <Mountain size={17} />;
    case "heart":
      return <Heart size={17} />;
    case "sprout":
      return <Sprout size={17} />;
    case "leaf":
    default:
      return <Leaf size={17} />;
  }
}

export function HomeHero({
  slider,
  sliders,
  placement,
  category,
  categoryCoverImage,
  categoryTitle,
  categoryDescription,
}: HomeHeroProps) {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [isInView, setIsInView] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const cleanCat = category?.toLowerCase().replace(/\+/g, " ").replace(/-tea$/, "").trim() || "";
  const catSlug = cleanCat.replace(/\s+/g, "-");
  const matchedKey = cleanCat
    ? Object.keys(CATEGORY_HERO_CONTENT).find(
        (key) => key === catSlug || key === cleanCat || cleanCat.includes(key) || catSlug.includes(key)
      ) || null
    : null;
  const categoryData = matchedKey ? CATEGORY_HERO_CONTENT[matchedKey] : null;

  // Build the effective slides array
  const effectiveSlides: HeroSlideData[] = useMemo(() => {
    if (sliders && sliders.length > 0) {
      return sliders.map((s, idx) => {
        const def = DEFAULT_HERO_SLIDES[idx % DEFAULT_HERO_SLIDES.length];
        const isCardEnabled = s.card_enabled !== undefined ? s.card_enabled === 1 : Boolean(s.fg_image_url && s.fg_image_url.trim() !== "");
        const hasFg = Boolean(s.fg_image_url && s.fg_image_url.trim() !== "");
        // If card is disabled, cardImage is undefined (banner switches to full-width editorial layout)
        const cardImg = isCardEnabled ? (hasFg ? s.fg_image_url : (idx === 0 ? def.cardImage : undefined)) : undefined;
        const cardTitle = s.card_quote || (s.cta_label && s.cta_label !== s.title ? s.cta_label.replace(" / ", "\n") : def.cardTitle);
        const cardHref = s.card_cta_href || s.cta_href || def.cardHref;
        const catKey = s.category_slug ? s.category_slug.toLowerCase().replace(/-tea$/, "") : "";
        const catOverline = catKey && CATEGORY_HERO_CONTENT[catKey] ? CATEGORY_HERO_CONTENT[catKey].overline : null;

        return {
          id: s.id,
          overline: catOverline || (categoryData ? categoryData.overline : def.overline),
          title: s.title || def.title,
          subtitle: s.subtitle || def.subtitle,
          bgImage:
            s.image_url && s.image_url !== ""
              ? s.image_url
              : (categoryCoverImage || def.bgImage),
          bgAlt: def.bgAlt,
          cardImage: cardImg,
          cardAlt: def.cardAlt,
          cardTitle,
          cardHref,
          cardBadge: s.card_badge || "ESTATE HARVEST",
          cardCtaLabel: s.card_cta_label || "View Harvest",
          ctaLabel: s.cta_label || "",
          ctaHref: s.cta_href || "/shop",
          chapterLabel:
            s.chapter_label ||
            (s.card_title ? `0${idx + 1}. ${s.card_title}` : (s.title ? `0${idx + 1}. ${s.title.split("—")[0].split("&")[0].trim()}` : def.chapterLabel)),
          chapterLabelShort:
            s.chapter_label
              ? s.chapter_label.replace(/^\d+\.\s*/, "").split(" ")[0]
              : (s.card_title ? s.card_title.split(" ")[0] : (s.title ? s.title.split("—")[0].split("&")[0].trim().split(" ")[0] : def.chapterLabelShort)),
          harvestLot: s.card_tag || def.harvestLot,
          teaName: s.card_title || def.teaName || s.title.split("—")[0].split("&")[0].trim(),
          elevationPrice: s.card_subtitle || def.elevationPrice,
          tastingNotes: s.card_tasting_notes || def.tastingNotes,
          pillars: def.pillars,
        };
      });
    }

    if (slider) {
      const def = DEFAULT_HERO_SLIDES[0];
      const isCardEnabled = slider.card_enabled !== undefined ? slider.card_enabled === 1 : Boolean(slider.fg_image_url && slider.fg_image_url.trim() !== "");
      const hasFg = Boolean(slider.fg_image_url && slider.fg_image_url.trim() !== "");
      const cardImg = isCardEnabled ? (hasFg ? slider.fg_image_url : def.cardImage) : undefined;
      const cardTitle = slider.card_quote || (slider.cta_label && slider.cta_label !== slider.title ? slider.cta_label.replace(" / ", "\n") : def.cardTitle);
      const cardHref = slider.card_cta_href || slider.cta_href || def.cardHref;
      const catKey = slider.category_slug ? slider.category_slug.toLowerCase().replace(/-tea$/, "") : "";
      const catOverline = catKey && CATEGORY_HERO_CONTENT[catKey] ? CATEGORY_HERO_CONTENT[catKey].overline : null;

      return [
        {
          id: slider.id,
          overline: catOverline || (categoryData ? categoryData.overline : def.overline),
          title: slider.title || def.title,
          subtitle: slider.subtitle || def.subtitle,
          bgImage:
            slider.image_url && slider.image_url !== ""
              ? slider.image_url
              : (categoryCoverImage || def.bgImage),
          bgAlt: def.bgAlt,
          cardImage: cardImg,
          cardAlt: def.cardAlt,
          cardTitle,
          cardHref,
          cardBadge: slider.card_badge || "ESTATE HARVEST",
          cardCtaLabel: slider.card_cta_label || "View Harvest",
          ctaLabel: slider.cta_label || "",
          ctaHref: slider.cta_href || "/shop",
          chapterLabel:
            slider.chapter_label ||
            (slider.card_title ? `01. ${slider.card_title}` : (slider.title ? `01. ${slider.title.split("—")[0].split("&")[0].trim()}` : def.chapterLabel)),
          chapterLabelShort:
            slider.chapter_label
              ? slider.chapter_label.replace(/^\d+\.\s*/, "").split(" ")[0]
              : (slider.card_title ? slider.card_title.split(" ")[0] : def.chapterLabelShort),
          harvestLot: slider.card_tag || def.harvestLot,
          teaName: slider.card_title || def.teaName || slider.title.split("—")[0].split("&")[0].trim(),
          elevationPrice: slider.card_subtitle || def.elevationPrice,
          tastingNotes: slider.card_tasting_notes || def.tastingNotes,
          pillars: def.pillars,
        },
      ];
    }

    if (categoryData || categoryCoverImage || categoryTitle) {
      const displayTitle =
        categoryTitle ||
        categoryData?.title ||
        `Single-Estate ${cleanCat ? cleanCat.toUpperCase() : "Curated"} Flushes & Mountain Terroirs.`;
      const displaySubtitle =
        categoryDescription ||
        categoryData?.subtitle ||
        "Single-garden harvests, seasonal flushes, and micro-lots curated for purity, provenance and a deeper connection to tea.";
      const displayOverline =
        (categoryData && categoryData.overline) ||
        `THE TEAFLOWW COLLECTION · ${(category || "COLLECTION").replace(/\+/g, " ").toUpperCase()}`;
      const displayBg =
        categoryCoverImage ||
        (placement?.image_url && placement.image_url !== "" ? placement.image_url : null) ||
        "/uploads/upload_1791894845311_49cf0062f51c_teafloww_homepage_hero_1920x800.webp";
      const displayCardImg =
        categoryCoverImage || "/uploads/darjeeling-spring-hero-v2.webp";

      return [
        {
          id: `category-${catSlug || "curated"}`,
          overline: displayOverline,
          title: displayTitle,
          subtitle: displaySubtitle,
          bgImage: displayBg,
          bgAlt: `${displayTitle} hero banner`,
          cardImage: displayCardImg,
          cardAlt: displayTitle,
          cardTitle: "From\nOur Gardens\nto Your Cup",
          cardHref: `/shop?category=${encodeURIComponent(category || "")}`,
          chapterLabel: "01. Curated Collection",
          harvestLot: "Curated Single Harvest",
          teaName: displayTitle.split("&")[0].split("·")[0].split("—")[0].trim(),
          elevationPrice: "Single Estate · Himalayan Terroirs",
          tastingNotes: "Single-Garden Orthodoxy • Mountain Terroir",
          pillars: DEFAULT_HERO_SLIDES[0].pillars,
        },
      ];
    }

    return DEFAULT_HERO_SLIDES;
  }, [categoryData, cleanCat, catSlug, placement, sliders, slider, categoryCoverImage, categoryTitle, categoryDescription, category]);

  const slideCount = effectiveSlides.length;
  const isMultiSlide = slideCount > 1;
  const safeIdx = Math.min(activeSlideIdx, slideCount - 1);
  const currentSlide = effectiveSlides[safeIdx] || DEFAULT_HERO_SLIDES[0];

  const handlePrevSlide = useCallback(() => {
    setActiveSlideIdx((prev) => (prev === 0 ? slideCount - 1 : prev - 1));
  }, [slideCount]);

  const handleNextSlide = useCallback(() => {
    setActiveSlideIdx((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  // Modern Web Guidance: Only auto-advance when hero is visible in the viewport
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return;

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

  // Modern Web Guidance: Auto-advance with pause on hover/focus & prefers-reduced-motion check
  useEffect(() => {
    if (!isMultiSlide || !isInView || isHoverPaused || isUserPaused) return;
    const isReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    const timer = setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % slideCount);
    }, 6500);

    return () => clearInterval(timer);
  }, [isMultiSlide, isInView, isHoverPaused, isUserPaused, slideCount]);

  // Keyboard navigation when focus is inside hero
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrevSlide();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNextSlide();
    }
  };

  // Touch swipe support for mobile with horizontal intent detection
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    // Only advance when horizontal swipe dominates vertical scroll
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        handleNextSlide();
      } else {
        handlePrevSlide();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // Dynamic override from site placement for E2E tests
  const isCustomPlacement = Boolean(
    placement?.image_url &&
    placement.image_url !== "" &&
    placement.image_url !== "/uploads/ritual-hero.webp" &&
    placement.image_url.includes("t3-hero")
  );
  const effectiveBgImage = isCustomPlacement
    ? placement!.image_url
    : (currentSlide?.bgImage ?? placement?.image_url ?? "");
  const effectiveBgAlt = isCustomPlacement
    ? (placement?.alt_text || currentSlide?.bgAlt || "Himalayan tea estate")
    : (currentSlide?.bgAlt || placement?.alt_text || "Himalayan tea estate");

  // Editorial Title Parsing: Handle Em-Dash accents gracefully
  const [mainHeading, accentSubheading] = currentSlide.title.includes("—")
    ? currentSlide.title.split("—")
    : currentSlide.title.includes(" - ")
    ? currentSlide.title.split(" - ")
    : [currentSlide.title, null];

  return (
    <>
      <section
        ref={sectionRef}
        className="tf-hero-wrapper tf-hero-mockup-layout"
        aria-label="Hero showcase"
        role="region"
        aria-roledescription="carousel"
        onMouseEnter={() => setIsHoverPaused(true)}
        onMouseLeave={() => setIsHoverPaused(false)}
        onFocusCapture={() => setIsHoverPaused(true)}
        onBlurCapture={() => setIsHoverPaused(false)}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* DESKTOP VIEWPORT: Panoramic Split Grid Layout */}
        <div className="tf-hero-desktop-layout">
          {/* Background Visual Container with Cinematic Dark Overlay */}
          <div className="tf-hero-bg hero-visual" data-testid="hero-visual">
            {effectiveBgImage && effectiveBgImage !== "" ? (
              <Image
                src={effectiveBgImage}
                alt={effectiveBgAlt}
                fill
                priority
                fetchPriority="high"
                sizes="100vw"
                quality={75}
                className="tf-hero-bg-img"
              />
            ) : (
              <svg
                role="img"
                aria-label={effectiveBgAlt}
                viewBox="0 0 1440 600"
                className="tf-hero-bg-img"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              >
                <title>Himalayan Mountain Tea Estate</title>
                <desc>Artisanal terraced high-altitude gardens at sunrise</desc>
                <rect width="1440" height="600" fill="#23483a" />
                <path d="M0 450 Q360 350 720 420 T1440 380 L1440 600 L0 600 Z" fill="#1b362c" />
                <path d="M0 490 Q400 420 800 470 T1440 430 L1440 600 L0 600 Z" fill="#132720" />
              </svg>
            )}
            {/* Full-Bleed Cinematic Dark Overlay: rich forest green & charcoal gradient */}
            <div className="tf-hero-light-mist-overlay" />
          </div>

          {/* Main Grid: Left copy & actions, Right compact "Featured Harvest" Glass Card */}
          <div
            className={`container tf-hero-content ${currentSlide.cardImage ? "tf-hero-split-grid" : ""}`}
            style={!currentSlide.cardImage ? { maxWidth: 880 } : undefined}
          >
            {/* Left Column: Overline, Headline, Description, and Primary CTA Button Group */}
            <div key={`copy-${safeIdx}`} className="tf-hero-left-col tf-slide-content-fade">
              <div className="tf-hero-badge-tag">
                <span className="tf-hero-overline">{currentSlide.overline}</span>
              </div>

              <h1 className="tf-hero-title tf-hero-title-mockup">
                <span>{mainHeading.trim()}</span>
                {accentSubheading && (
                  <span className="tf-hero-title-accent">
                    {" "}— <em>{accentSubheading.trim()}</em>
                  </span>
                )}
              </h1>

              <p className="tf-hero-desc tf-hero-desc-mockup">{currentSlide.subtitle}</p>

              {/* Primary Action Button Group */}
              <div className="tf-hero-cta-group">
                <Link
                  href={currentSlide.ctaHref || currentSlide.cardHref || "/shop"}
                  className="tf-hero-btn-primary group"
                >
                  <span className="tf-btn-text-desktop">
                    {currentSlide.ctaLabel ? (
                      currentSlide.ctaLabel
                    ) : (
                      <StorefrontText id="copy_3810246566dc61fb" fallback="Explore Single Estates" />
                    )}
                  </span>
                  <span className="tf-btn-text-mobile">
                    {currentSlide.ctaLabel ? (
                      currentSlide.ctaLabel
                    ) : (
                      <StorefrontText id="copy_7301ed57698677ba" fallback="Explore Estates" />
                    )}
                  </span>
                  <ArrowRight size={16} className="tf-hero-btn-arrow" aria-hidden="true" />
                </Link>

                <Link
                  href="/tea-finder"
                  className="tf-hero-btn-ghost group"
                >
                  <Sparkles size={15} className="tf-hero-quiz-sparkle" aria-hidden="true" />
                  <span className="tf-btn-text-desktop"> <StorefrontText id="copy_ee662f5d5fc8c94d" fallback="Take the Tea Finder Quiz" /> </span>
                  <span className="tf-btn-text-mobile"> <StorefrontText id="copy_f5a5c3a7073c540a" fallback="Tea Quiz" /> </span>
                </Link>
              </div>
            </div>

            {/* Right Column: Compact "Featured Harvest" Glass Card docked lower on the right */}
            {currentSlide.cardImage ? (
              <div key={`card-${safeIdx}`} className="tf-hero-right-col tf-slide-card-fade">
                <Link
                  href={currentSlide.cardHref || "/shop"}
                  className="tf-harvest-card-link group"
                >
                  <div className="tf-harvest-glass-card">
                    {/* Visual side: Uncut Tea Tin with soft shadow and NO overlapping text */}
                    <div className="tf-harvest-tin-side">
                      <div className="tf-harvest-tin-badge">
                        <span>{currentSlide.cardBadge || <StorefrontText id="copy_78194de246aece11" fallback="ESTATE HARVEST" />}</span>
                      </div>
                      <div className="tf-harvest-tin-visual">
                        <Image
                          src={currentSlide.cardImage}
                          alt={currentSlide.cardAlt}
                          width={160}
                          height={190}
                          sizes="(max-width: 768px) 120px, 160px"
                          quality={70}
                          className="tf-harvest-tin-img"
                        />
                      </div>
                    </div>

                    {/* Details side: Featured Micro-Lot stack, notes, price, and CTA */}
                    <div className="tf-harvest-info-side">
                      <span className="tf-harvest-tag">
                        {currentSlide.harvestLot || "2026 First Flush · Margaret's Hope"}
                      </span>

                      <p className="tf-harvest-name">
                        {currentSlide.teaName || currentSlide.title.split("—")[0].split("&")[0].trim()}
                      </p>

                      <div className="tf-harvest-meta">
                        <span className="tf-harvest-elevation">
                          {currentSlide.elevationPrice?.replace(/^₹[\d,]+\s*·\s*/, "") || "Explore the collection"}
                        </span>
                      </div>

                      {/* Provenance quote with line breaks preserved for backward compatibility & aesthetic */}
                      <span className="tf-gardens-card-title tf-harvest-provenance-tag">
                        {currentSlide.cardTitle.split("\n").map((line, i, arr) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < arr.length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </span>

                      {/* Tasting Notes Pill (revealed / highlighted on hover) */}
                      <div className="tf-harvest-notes-chip">
                        <span className="tf-notes-label"> <StorefrontText id="copy_da4f7ea58d963b1a" fallback="Notes:" /> </span>
                        <span className="tf-notes-text">
                          {currentSlide.tastingNotes || "Muscatel • Wild Orchid • Crisp Finish"}
                        </span>
                      </div>

                      {/* Interactive Button that expands on hover */}
                      <div className="tf-harvest-action-row">
                        <span className="tf-harvest-view-btn">
                          <span>{currentSlide.cardCtaLabel || <StorefrontText id="copy_5d426dac59352f6f" fallback="View Harvest" />}</span>
                          <span className="tf-harvest-arrow" aria-hidden="true">→</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ) : null}
          </div>

          {/* Minimal Editorial Harvest Story Slider Controls */}
          {isMultiSlide && (
            <div
              className="container tf-hero-editorial-controls-wrap"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="tf-hero-editorial-controls" role="region" aria-label="Harvest chapters slider">
                {/* Clickable Chapter Tabs with Progress Lines */}
                <div className="tf-hero-chapter-tabs" role="group" aria-label="Harvest chapters">
                  {effectiveSlides.map((s, idx) => {
                    const isActive = idx === safeIdx;
                    const chapterTitle =
                      s.chapterLabel ||
                      (s.teaName
                        ? `0${idx + 1}. ${s.teaName}`
                        : `0${idx + 1}. ${s.title.split("—")[0].split("&")[0].trim()}`);

                    const shortTitle =
                      s.chapterLabelShort ||
                      chapterTitle.replace(/^\d+\.\s*/, "").split(" ")[0];

                    const targetLink = s.ctaHref || s.cardHref || "/shop";

                    return (
                      <button
                        key={s.id || idx}
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        className={`tf-hero-chapter-tab ${isActive ? "is-active" : ""}`}
                        onClick={() => {
                          if (isActive && targetLink) {
                            window.location.href = targetLink;
                          } else {
                            setActiveSlideIdx(idx);
                          }
                        }}
                        title={isActive ? `Visit ${chapterTitle} (${targetLink})` : `Go to slide 0${idx + 1}`}
                      >
                        <div className="tf-hero-progress-track">
                          <div
                            className={`tf-hero-progress-bar ${
                              isActive && !isHoverPaused && !isUserPaused ? "is-filling" : ""
                            }`}
                          />
                        </div>
                        <span className="tf-hero-chapter-label tf-chapter-desktop">{chapterTitle}</span>
                        <span className="tf-hero-chapter-label tf-chapter-mobile">{shortTitle}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Subtle Editorial Arrow Controls & Accessible Pause */}
                <div className="tf-hero-controls-suite">
                  <span className="tf-hero-slide-counter-editorial" aria-hidden="true">
                    0{safeIdx + 1} / 0{slideCount}
                  </span>

                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="tf-hero-editorial-btn"
                    aria-label="Previous harvest slide"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="tf-hero-editorial-btn"
                    aria-label="Next harvest slide"
                  >
                    <ChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUserPaused((prev) => !prev)}
                    className="tf-hero-editorial-btn tf-hero-pause-btn"
                    aria-label={isUserPaused ? "Play slideshow" : "Pause slideshow"}
                    title={isUserPaused ? "Play slideshow" : "Pause slideshow"}
                  >
                    {isUserPaused ? <Play size={12} /> : <Pause size={12} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE VIEWPORT: High-Impact Stacked Sensory Hero (Zero Dark Mud, 100% Crisp Visuals + Luxury Action Card) */}
        <div className="tf-hero-mobile-layout" aria-live="polite">
          {/* 1. Sensory Gourmet Visual Stage */}
          <div key={`mobile-stage-${safeIdx}`} className="tf-hero-mobile-stage tf-slide-content-fade">
            {effectiveBgImage && effectiveBgImage !== "" ? (
              <Image
                src={effectiveBgImage}
                alt={effectiveBgAlt}
                fill
                priority={safeIdx === 0}
                fetchPriority={safeIdx === 0 ? "high" : "low"}
                sizes="(max-width: 768px) 100vw, 400px"
                quality={85}
                className="tf-mobile-stage-img"
              />
            ) : (
              <div className="tf-mobile-stage-fallback" />
            )}

            {/* Delicate atmospheric bottom vignette transition */}
            <div className="tf-mobile-stage-vignette" />

            {/* Pinned Origin / Harvest Gold Pill */}
            <div className="tf-mobile-stage-badge">
              <span className="tf-mobile-badge-dot">✦</span>
              <span className="tf-mobile-badge-text">
                {currentSlide.harvestLot || currentSlide.cardBadge || "Direct Single Estate"}
              </span>
            </div>

            {/* Floating Tea Caddy Medallion if available and distinct from background */}
            {currentSlide.cardImage && currentSlide.cardImage !== effectiveBgImage ? (
              <div className="tf-mobile-tin-medallion">
                <Image
                  src={currentSlide.cardImage}
                  alt={currentSlide.cardAlt}
                  width={68}
                  height={68}
                  sizes="68px"
                  quality={80}
                  className="tf-mobile-medallion-img"
                />
              </div>
            ) : null}
          </div>

          {/* 2. Deep Forest Luxury Content & Action Card */}
          <div key={`mobile-card-${safeIdx}`} className="tf-hero-mobile-card tf-slide-content-fade">
            <span className="tf-mobile-overline">{currentSlide.overline}</span>

            <div className="tf-mobile-title" aria-hidden="true">
              <span>{mainHeading.trim()}</span>
              {accentSubheading && (
                <span className="tf-mobile-title-accent">
                  {" "}— <em>{accentSubheading.trim()}</em>
                </span>
              )}
            </div>

            <p className="tf-mobile-desc">{currentSlide.subtitle}</p>

            {/* Tasting Notes / Terroir Pill */}
            {(currentSlide.tastingNotes || currentSlide.elevationPrice) && (
              <div className="tf-mobile-tasting-pill">
                <span className="tf-tasting-label">
                  <StorefrontText id="copy_da4f7ea58d963b1a" fallback="Notes:" />
                </span>
                <span className="tf-tasting-text">
                  {currentSlide.tastingNotes || currentSlide.elevationPrice?.replace(/^₹[\d,]+\s*·\s*/, "")}
                </span>
              </div>
            )}

            {/* High-Converting CTA Action Group */}
            <div className="tf-mobile-cta-group">
              <Link
                href={currentSlide.ctaHref || currentSlide.cardHref || "/shop"}
                className="tf-mobile-btn-primary group"
              >
                <span>
                  {currentSlide.ctaLabel ? (
                    currentSlide.ctaLabel
                  ) : (
                    <StorefrontText id="copy_7301ed57698677ba" fallback="Explore Estates" />
                  )}
                </span>
                <ArrowRight size={16} className="tf-mobile-btn-arrow" aria-hidden="true" />
              </Link>

              <Link
                href="/tea-finder"
                className="tf-mobile-quiz-link group"
              >
                <Sparkles size={13} className="tf-hero-quiz-sparkle" aria-hidden="true" />
                <span>
                  <StorefrontText id="copy_ee662f5d5fc8c94d" fallback="Not sure? Take the Tea Quiz" />
                </span>
              </Link>
            </div>

            {/* 3. Modern Touch Controls & Animated Progress Pills */}
            {isMultiSlide && (
              <div className="tf-mobile-controls-bar" role="region" aria-label="Slide controls">
                <div className="tf-mobile-pill-track" role="group" aria-label="Harvest chapters">
                  {effectiveSlides.map((s, idx) => {
                    const isActive = idx === safeIdx;
                    return (
                      <button
                        key={s.id || idx}
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        aria-label={`Story ${idx + 1}: ${s.teaName || s.title}`}
                        className={`tf-mobile-pill-btn ${isActive ? "is-active" : ""}`}
                        onClick={() => setActiveSlideIdx(idx)}
                      >
                        <div className="tf-mobile-pill-track-indicator">
                          <span
                            className={`tf-mobile-pill-progress ${
                              isActive && !isHoverPaused && !isUserPaused ? "is-filling" : ""
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="tf-mobile-nav-suite">
                  <span className="tf-mobile-counter" aria-hidden="true">
                    0{safeIdx + 1} / 0{slideCount}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="tf-mobile-nav-btn"
                    aria-label="Previous harvest slide"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="tf-mobile-nav-btn"
                    aria-label="Next harvest slide"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUserPaused((p) => !p)}
                    className="tf-mobile-nav-btn"
                    aria-label={isUserPaused ? "Play slideshow" : "Pause slideshow"}
                    title={isUserPaused ? "Play slideshow" : "Pause slideshow"}
                  >
                    {isUserPaused ? <Play size={12} /> : <Pause size={12} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Accessible video story modal dialog */}
        {videoModalOpen && (
          <div
            className="tf-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Himalayan Story Video"
            onClick={() => setVideoModalOpen(false)}
          >
            <div className="tf-modal-box" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="tf-modal-close"
                aria-label="Close story video modal"
                onClick={() => setVideoModalOpen(false)}
              >
                <X size={20} />
              </button>
              <div className="tf-modal-video-placeholder">
                <h3> <StorefrontText id="copy_1f32d0a70975f26f" fallback="The Teafloww Heritage" /> </h3>
                <p> <StorefrontText id="copy_ae4e3ba40678e294" fallback="From elevation 6,800 ft down into the misted valleys of Darjeeling and Assam, each harvest is hand-plucked by multi-generational tea masters." /> </p>
                <div className="tf-modal-video-art">
                  <Image
                    src="/uploads/bento-plantation.jpg"
                    alt="High mountain tea estate"
                    width={640}
                    height={360}
                    sizes="(max-width: 768px) 100vw, 640px"
                    className="rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setVideoModalOpen(false)}
                  style={{ marginTop: "1rem" }}
                > <StorefrontText id="copy_1553626121b9ba34" fallback="Close Video Preview" /> </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Dedicated Luxury Trust Ribbon directly below the Hero Section */}
      <div className="tf-hero-trust-ribbon" role="region" aria-label="Our provenance promises">
        <div className="container">
          <div className="tf-hero-trust-grid">
            {currentSlide.pillars.map((pillar, idx) => (
              <div key={idx} className="tf-hero-trust-item">
                <span className="tf-hero-trust-icon" aria-hidden="true">
                  <PillarIcon icon={pillar.icon} />
                </span>
                <span className="tf-hero-trust-text">{pillar.text}</span>
                {idx < currentSlide.pillars.length - 1 && (
                  <span className="tf-hero-trust-bullet" aria-hidden="true" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>•</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
