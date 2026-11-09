"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";

export interface TeaCraftStage {
  step: string;
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  insight: string;
  topBadge: string;
  caption: string;
  image: string;
  alt: string;
  accentBg: string;
}

export const CRAFT_STAGES: TeaCraftStage[] = [
  {
    step: "01",
    name: "Plucking",
    eyebrow: "01 — Plucking",
    title: "It all begins with a leaf.",
    description:
      "In the cool morning mist of the Himalayan ridges, tender shoots are selectively harvested by hand — two leaves and a downy unopened bud. This delicate harvest sets the aromatic potential of the entire batch.",
    insight:
      "Pluck quality determines cellular sugar and polyphenol ratios. Coarser harvests produce rough astringency; terminal clonal buds yield unmatched Muscatel sweetness.",
    topBadge: "The beginning",
    caption: "Misty Himalayan garden · Hand-harvested",
    image: "/images/craft/stage-01-plucking.jpg",
    alt: "Artisan hands carefully hand-plucking two tender leaves and a silver bud amidst mist-shrouded Himalayan tea slopes",
    accentBg: "#63825c",
  },
  {
    step: "02",
    name: "Withering",
    eyebrow: "02 — Withering",
    title: "A little time. A softer leaf.",
    description:
      "Freshly harvested leaves are thinly spread across traditional raised wooden withering troughs. Cool mountain airflow gently evaporates 60% of moisture over 14 to 18 hours, transforming crisp leaves into supple, pliable ribbons.",
    insight:
      "Withering initiates biochemical breakdown of proteins into aromatic amino acids while softening cell walls so leaves twist without tearing.",
    topBadge: "The first transformation",
    caption: "Heritage estate troughs · Ambient airflow",
    image: "/images/craft/stage-02-withering.jpg",
    alt: "Fresh green tea leaves spread out over wooden withering troughs in a historic Himalayan estate factory bathed in window light",
    accentBg: "#7a8258",
  },
  {
    step: "03",
    name: "Rolling",
    eyebrow: "03 — Rolling",
    title: "The art of the twist.",
    description:
      "The pliable leaves are gently gathered into traditional circular brass rolling tables. Under calibrated orbital pressure, the leaves twist into wiry curls, gently rupturing cellular matrices to release essential botanical oils.",
    insight:
      "Orthodox rolling preserves whole leaf integrity while exposing natural polyphenol oxidase enzymes to atmospheric oxygen.",
    topBadge: "Shaping the leaf",
    caption: "Circular brass rolling tables · Cell rupture",
    image: "/images/craft/stage-03-rolling.jpg",
    alt: "Historic brass orthodox tea rolling machine curling withered leaves and releasing fragrant botanical juices",
    accentBg: "#6f6c49",
  },
  {
    step: "04",
    name: "Oxidation",
    eyebrow: "04 — Oxidation",
    title: "Where colour finds character.",
    description:
      "Spread evenly across cool tiled tables in temperature-monitored rooms, rolled leaves breathe. In a natural enzymatic dance, emerald green gives way to radiant copper and warm bronze as deep muscatel, stone fruit, and malt aromas develop.",
    insight:
      "Often misnamed 'fermentation', this is a pure enzymatic reaction creating theaflavins (for golden liquor brightness) and thearubigins (for rich velvety depth).",
    topBadge: "A new character emerges",
    caption: "Enzymatic amber-copper transformation",
    image: "/images/craft/stage-04-oxidation.jpg",
    alt: "Twisted tea leaves displaying vivid coppery bronze and amber color transition on clean tiled fermentation tables",
    accentBg: "#925e44",
  },
  {
    step: "05",
    name: "Drying",
    eyebrow: "05 — Drying",
    title: "A moment preserved.",
    description:
      "To capture the leaf at its exact peak of character, it enters an artisan hot-air drying chamber. Controlled heat halts further oxidation, reducing residual moisture to under 3% and sealing in the crisp, dark whole-leaf finish.",
    insight:
      "Precise firing prevents 'stewing' or scorching. It caramelises natural plant sugars, locking in complex floral volatiles for year-long freshness.",
    topBadge: "Sealing in the craft",
    caption: "Arresting oxidation · Crisp dark finish",
    image: "/images/craft/stage-05-drying.jpg",
    alt: "Crisp black orthodox tea leaves tumbling from hot-air firing conveyor into wooden inspection tray with rising aroma steam",
    accentBg: "#81573e",
  },
  {
    step: "06",
    name: "Sorting",
    eyebrow: "06 — Sorting",
    title: "Every leaf finds its place.",
    description:
      "Once cooled, the dried tea is sifted through vibrating mesh screens and inspected by experienced tea masters on wooden tables. Whole unbroken leaves with prominent golden tips are graded into the highest orthodox tiers.",
    insight:
      "Orthodox grading (such as FTGFOP1 — Finest Tippy Golden Flowery Orange Pekoe) classifies physical particle size and golden tip density, ensuring uniform extraction during steeping.",
    topBadge: "The finishing touch",
    caption: "Hand-sorting whole leaf FTGFOP1 grades",
    image: "/images/craft/stage-06-sorting.jpg",
    alt: "Tea masters hand-sorting premium whole leaf black tea with golden tips on woven bamboo trays in estate packing room",
    accentBg: "#5c5043",
  },
  {
    step: "07",
    name: "Brewing",
    eyebrow: "07 — Brewing",
    title: "And then, the first sip.",
    description:
      "The long mountain journey culminates in your teaware. Steeping in 90°C spring water, the wiry leaves gracefully unfurl back to whole shoots, yielding a shimmering golden-amber liquor alive with wildflowers, muscatel grape, and mountain sweetness.",
    insight:
      "Unblended orthodox whole leaves can be steeped 3 to 4 times, with each infusion peeling back a new sensory layer of the Himalayan terroir.",
    topBadge: "The beautiful finale",
    caption: "Pure mountain liquor · Slow mindful tea",
    image: "/images/craft/stage-07-brewing.jpg",
    alt: "Luminous amber orthodox tea liquor pouring gracefully into an artisan teacup with unfurled whole leaves in porcelain gaiwan",
    accentBg: "#8a6b46",
  },
];

export function LeafToCupStory() {
  const [currentStage, setCurrentStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingByCodeRef = useRef<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const stopAutoPlay = useCallback(() => {
    setIsPlaying(false);
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  const goToStage = useCallback(
    (index: number, scrollIntoPosition = false) => {
      const target = Math.max(0, Math.min(CRAFT_STAGES.length - 1, index));
      setCurrentStage(target);

      if (scrollIntoPosition && containerRef.current && typeof window !== "undefined") {
        isScrollingByCodeRef.current = true;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        if (scrollable > 0) {
          const progressFraction = (target + 0.5) / CRAFT_STAGES.length;
          const targetY = window.scrollY + rect.top + progressFraction * scrollable;
          window.scrollTo({
            top: targetY,
            behavior: isReducedMotion ? "auto" : "smooth",
          });
        }

        if ("onscrollend" in window) {
          const handleScrollEnd = () => {
            isScrollingByCodeRef.current = false;
            window.removeEventListener("scrollend", handleScrollEnd);
          };
          window.addEventListener("scrollend", handleScrollEnd, { once: true });
        }
        setTimeout(() => {
          isScrollingByCodeRef.current = false;
        }, 800);
      }
    },
    [isReducedMotion]
  );

  const startAutoPlay = useCallback(() => {
    if (isReducedMotion) return;
    setIsPlaying(true);
    if (currentStage >= CRAFT_STAGES.length - 1) {
      goToStage(0, true);
    }
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev >= CRAFT_STAGES.length - 1) {
          stopAutoPlay();
          return prev;
        }
        const next = prev + 1;
        goToStage(next, true);
        return next;
      });
    }, 4200);
  }, [currentStage, goToStage, isReducedMotion, stopAutoPlay]);

  // Natural scroll handling
  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingByCodeRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      const targetIndex = Math.min(
        CRAFT_STAGES.length - 1,
        Math.floor(progress * CRAFT_STAGES.length)
      );

      if (targetIndex !== currentStage) {
        setCurrentStage(targetIndex);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [currentStage]);

  // Pause autoplay on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isPlaying) {
        stopAutoPlay();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isPlaying, stopAutoPlay]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stopAutoPlay();
      goToStage(currentStage + 1, true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stopAutoPlay();
      goToStage(currentStage - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      stopAutoPlay();
      goToStage(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      stopAutoPlay();
      goToStage(CRAFT_STAGES.length - 1, true);
    }
  };

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].screenX;
    touchStartYRef.current = e.touches[0].screenY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.changedTouches[0].screenX - touchStartXRef.current;
    const dy = e.changedTouches[0].screenY - touchStartYRef.current;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      stopAutoPlay();
      if (dx < 0 && currentStage < CRAFT_STAGES.length - 1) {
        goToStage(currentStage + 1, true);
      } else if (dx > 0 && currentStage > 0) {
        goToStage(currentStage - 1, true);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const stage = CRAFT_STAGES[currentStage];
  const progressPercent = (currentStage / (CRAFT_STAGES.length - 1)) * 100;

  return (
    <div
      ref={containerRef}
      className="relative min-h-[460vh] w-full"
      id="scrolly-container"
      aria-label="Interactive Leaf to Cup Scrollytelling"
    >
      {/* Sticky Split-Screen Stage Section: sticks below site header */}
      <div className="sticky top-[72px] sm:top-[76px] lg:top-[80px] z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div
          className="relative bg-[#10261f] text-[#f6f2e8] rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-[#274336] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c9a971] flex flex-col justify-between h-[min(600px,calc(100dvh-98px))] min-h-[470px]"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Tea crafting journey interactive card. Use left and right arrow keys to navigate stages."
        >
          {/* Split Container: Left Story, Right Visual */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
            {/* Story Panel (Left 5 Cols on desktop, order-2 on mobile) */}
            <div className="order-2 lg:order-1 lg:col-span-5 p-4 sm:p-5 lg:p-6 flex flex-col justify-between overflow-y-auto bg-gradient-to-br from-[#10261f] via-[#142e25] to-[#10261f]">
              {/* Head Meta */}
              <div className="flex items-center justify-between border-b border-[#244234] pb-2.5 mb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#d4c5a6]">
                  <span
                    className="inline-block w-2 h-2 rounded-full transition-colors duration-500"
                    style={{ backgroundColor: stage.accentBg }}
                  />
                  <span> <StorefrontText id="copy_402b946d95ba8149" fallback="The Leaf-to-Cup Story" /> </span>
                </div>
                <div
                  className="font-mono text-xs sm:text-sm tracking-widest text-[#b9c5b7]"
                  aria-live="polite"
                >
                  <strong className="text-white text-base">{stage.step}</strong> / 07
                </div>
              </div>

              {/* Dynamic Stage Copy */}
              <div
                className="my-auto py-1.5 flex flex-col justify-center"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#c2d4b8] mb-1.5">
                  <span className="w-5 h-[1px] bg-[#c1a376]" />
                  <span>{stage.eyebrow}</span>
                </div>

                <h2 className="font-serif text-2xl sm:text-[26px] lg:text-[28px] xl:text-[32px] leading-[1.12] text-white tracking-tight mb-2 text-balance">
                  {stage.title}
                </h2>

                <p className="text-xs sm:text-[13px] text-[#c8d1c5] leading-relaxed mb-3">
                  {stage.description}
                </p>

                <div className="p-2.5 sm:p-3 rounded-xl bg-[#142d24]/90 border-l-2 border-[#c1a376] text-xs text-[#e0e4da] leading-relaxed">
                  <strong className="block text-[10px] uppercase tracking-[0.18em] text-[#d9c08f] font-bold mb-0.5"> <StorefrontText id="copy_907cb233cae6f6b8" fallback="Why It Matters" /> </strong>
                  {stage.insight}
                </div>
              </div>

              {/* Story Footer Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-[#244234] mt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopAutoPlay();
                      goToStage(currentStage - 1, true);
                    }}
                    disabled={currentStage === 0}
                    aria-label="Previous tea crafting stage"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#f2efe1]/25 flex items-center justify-center text-[#f6f2e8] transition-all hover:bg-white/10 hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAutoPlay();
                      goToStage(currentStage + 1, true);
                    }}
                    disabled={currentStage === CRAFT_STAGES.length - 1}
                    aria-label="Next tea crafting stage"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ead8b6] text-[#1c2d25] font-bold flex items-center justify-center transition-all hover:bg-[#fae8c8] hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <span className="text-xs text-[#aab8ae] tracking-wider font-medium truncate ml-2">
                  {currentStage === CRAFT_STAGES.length - 1 ? (
                    <span className="text-[#e2caa0] font-semibold"> <StorefrontText id="copy_fbefe7aad4fba0ff" fallback="The journey is complete ✦" /> </span>
                  ) : (
                    <span> <StorefrontText id="copy_5693e770dd678bff" fallback="Next:" /> {CRAFT_STAGES[currentStage + 1].name} →</span>
                  )}
                </span>
              </div>
            </div>

            {/* Visual Panel (Right 7 Cols on desktop, order-1 on mobile) */}
            <div
              className="order-1 lg:order-2 lg:col-span-7 relative h-[210px] sm:h-[260px] lg:h-full lg:min-h-0 overflow-hidden bg-[#16271e]"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              role="img"
              aria-label={stage.alt}
            >
              {/* Stack of Realistic Stage Photographs with Smooth Crossfade */}
              {CRAFT_STAGES.map((s, idx) => {
                const isActive = idx === currentStage;
                return (
                  <div
                    key={s.step}
                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                      isActive
                        ? "opacity-100 scale-100 z-10"
                        : "opacity-0 scale-105 pointer-events-none z-0"
                    }`}
                  >
                    <Image
                      src={s.image}
                      alt={s.alt}
                      fill
                      priority={idx <= 1}
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover"
                    />
                    {/* Vignette & Ambient Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />
                  </div>
                );
              })}

              {/* Floating Top Badge */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[#f7f5eb] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#c9a971]" />
                <span>{stage.topBadge}</span>
              </div>

              {/* Authentic Himalayan Seal Stamp (top right so it never collides with floating actions or bottom captions) */}
              <div
                className="absolute right-4 top-4 sm:right-6 sm:top-6 z-20 w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/40 backdrop-blur-sm flex flex-col items-center justify-center font-serif italic text-[11px] sm:text-xs text-[#f9f7eb] text-center leading-tight -rotate-12 pointer-events-none shadow-lg"
                aria-hidden="true"
              >
                <span> <StorefrontText id="copy_61b1716556bbcf1f" fallback="orthodox" /> </span>
                <span className="text-[9px] sm:text-[10px] tracking-widest uppercase font-sans not-italic text-[#d9c08f]"> <StorefrontText id="copy_355543f790a3b210" fallback="craft" /> </span>
              </div>

              {/* Floating Bottom Caption */}
              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-20 text-xs sm:text-sm text-[#f6f2e8]/90 font-medium tracking-wide drop-shadow-md">
                <span>{stage.caption}</span>
              </div>
            </div>
          </div>

          {/* Integrated Docked Timeline Bar across the bottom of the card */}
          <div className="shrink-0 border-t border-[#244234] bg-[#0c1f19]/95 backdrop-blur-md px-4 sm:px-6 py-2.5 sm:py-3 z-30">
            {/* Interactive Progress Line */}
            <div className="relative h-1.5 w-full bg-[#1b3629] rounded-full overflow-hidden mb-2 cursor-pointer">
              <div
                className="h-full bg-gradient-to-r from-[#708e66] via-[#c1a376] to-[#ead8b6] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={CRAFT_STAGES.length - 1}
                step={1}
                value={currentStage}
                onChange={(e) => {
                  stopAutoPlay();
                  goToStage(Number(e.target.value), true);
                }}
                aria-label="Choose tea processing stage"
                aria-valuetext={`${stage.step} ${stage.name}`}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>

            {/* Controls Row: AutoPlay, 7 Stage Pills, Hint */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 pr-14 sm:pr-16 lg:pr-2">
              <button
                type="button"
                onClick={() => (isPlaying ? stopAutoPlay() : startAutoPlay())}
                disabled={isReducedMotion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18382b] hover:bg-[#234d3c] border border-[#2e5241] text-xs font-semibold text-[#f0ebd9] transition-all disabled:opacity-40 shrink-0"
                aria-pressed={isPlaying}
                aria-label={isPlaying ? "Pause automatic journey" : "Play the journey automatically"}
              >
                {isPlaying ? (
                  <>
                    <Pause size={13} fill="currentColor" />
                    <span> <StorefrontText id="copy_858e4ba7a29fd38b" fallback="Pause" /> </span>
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    <span> <StorefrontText id="copy_dc14b009d1879eb7" fallback="Auto Play" /> </span>
                  </>
                )}
              </button>

              {/* 7 Stage Pills */}
              <div
                className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar"
                role="group"
                aria-label="Tea processing stage steps"
              >
                {CRAFT_STAGES.map((s, idx) => {
                  const isActive = idx === currentStage;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => {
                        stopAutoPlay();
                        goToStage(idx, true);
                      }}
                      aria-current={isActive ? "step" : undefined}
                      aria-label={`Jump to stage ${s.step}: ${s.name}`}
                      className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all shrink-0 whitespace-nowrap ${
                        isActive
                          ? "bg-[#c1a376] text-[#0f2119] font-bold shadow-sm"
                          : "text-[#93a290] hover:text-[#f4f1e8] hover:bg-white/10"
                      }`}
                    >
                      <span className="font-mono text-[10px] sm:text-xs">{s.step}</span>
                      <span className="hidden md:inline font-medium whitespace-nowrap">{s.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Keyboard / Navigation Indicator on large screens */}
              <span className="hidden xl:inline-block text-[11px] text-[#788875] tracking-widest uppercase font-mono shrink-0"> <StorefrontText id="copy_f07cf5d820a68a3d" fallback="SCROLL · ← →" /> </span>
              <span className="lg:hidden text-xs font-mono text-[#a5b2a2] shrink-0 font-semibold">
                {stage.step}/07
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Editorial Disclaimer Note placed below the scrollytelling journey */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#737e71]">
        <p className="m-0 leading-relaxed max-w-3xl"> <StorefrontText id="copy_6e9f8a6ca2ecdeff" fallback="This illustrated journey follows a traditional" /> <strong> <StorefrontText id="copy_6257d7287483ff60" fallback="orthodox whole-leaf black tea" /> </strong> <StorefrontText id="copy_0895abb1875b20e1" fallback="process. Oxidation begins during orbital rolling; stages are demonstrated sequentially for clarity." /> </p>
        <span className="font-serif italic text-base text-[#617e5a] shrink-0"> <StorefrontText id="copy_98f725483c6d2320" fallback="Made of moments." /> </span>
      </div>
    </div>
  );
}
