"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
  Scale,
  Sparkles,
  Utensils,
} from "lucide-react";
import { CTC_BREW_METHODS } from "./data";

export function CtcBrewStory() {
  const [currentStage, setCurrentStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [activeTab, setActiveTab] = useState<"recipe" | "steps" | "sommelier">("recipe");
  const [servingsMultiplier, setServingsMultiplier] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingByCodeRef = useRef<boolean>(false);

  // Prefers reduced motion detection
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
      const target = Math.max(0, Math.min(CTC_BREW_METHODS.length - 1, index));
      setCurrentStage(target);

      if (scrollIntoPosition && containerRef.current && typeof window !== "undefined") {
        isScrollingByCodeRef.current = true;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        if (scrollable > 0) {
          const progressFraction = (target + 0.5) / CTC_BREW_METHODS.length;
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
    if (currentStage >= CTC_BREW_METHODS.length - 1) {
      goToStage(0, true);
    }
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev >= CTC_BREW_METHODS.length - 1) {
          stopAutoPlay();
          return prev;
        }
        const next = prev + 1;
        goToStage(next, true);
        return next;
      });
    }, 4600);
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
        CTC_BREW_METHODS.length - 1,
        Math.floor(progress * CTC_BREW_METHODS.length)
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
      goToStage(CTC_BREW_METHODS.length - 1, true);
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
      if (dx < 0 && currentStage < CTC_BREW_METHODS.length - 1) {
        goToStage(currentStage + 1, true);
      } else if (dx > 0 && currentStage > 0) {
        goToStage(currentStage - 1, true);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const stage = CTC_BREW_METHODS[currentStage];
  const progressPercent = (currentStage / (CTC_BREW_METHODS.length - 1)) * 100;

  // Scaled calculations based on user multiplier
  const scaledWaterMl = Math.round(stage.ratios.waterMl * servingsMultiplier);
  const scaledMilkMl = Math.round(stage.ratios.milkMl * servingsMultiplier);
  const scaledCtcGrams = (stage.ratios.ctcGrams * servingsMultiplier).toFixed(1);

  return (
    <div
      ref={containerRef}
      className="relative min-h-[460vh] w-full"
      id="ctc-scrolly-container"
      aria-label="Interactive Ways to Make CTC Tea Scrollytelling"
    >
      {/* Sticky Split-Screen Stage Section */}
      <div className="sticky top-[72px] sm:top-[76px] lg:top-[80px] z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div
          className="relative bg-[#11241c] text-[#f7f5ee] rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-[#234233] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#cfa46b] flex flex-col justify-between h-[min(650px,calc(100dvh-94px))] min-h-[500px]"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Ways to make CTC tea interactive guide. Use left and right arrow keys to change brewing styles."
        >
          {/* Split Container: Left Story, Right Visual */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
            {/* Story Panel (Left 6 Cols on desktop, order-2 on mobile) */}
            <div className="order-2 lg:order-1 lg:col-span-6 p-4 sm:p-5 lg:p-6 flex flex-col justify-between overflow-y-auto bg-gradient-to-br from-[#11241c] via-[#162f25] to-[#10231b] border-r border-[#203c2e]/60">
              {/* Header Meta Line */}
              <div className="flex items-center justify-between border-b border-[#213e30] pb-2.5 mb-2 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#d6c7a9]">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full transition-colors duration-500 shadow-sm"
                    style={{ backgroundColor: stage.accentBg }}
                  />
                  <span> <StorefrontText id="copy_56fdde50a406a868" fallback="CTC Master Technique" /> </span>
                </div>
                <div
                  className="font-mono text-xs sm:text-sm tracking-widest text-[#a8b8a6]"
                  aria-live="polite"
                >
                  <strong className="text-white text-base">{stage.step}</strong> / 07
                </div>
              </div>

              {/* Main Content Area */}
              <div className="my-auto py-1 flex flex-col justify-center min-h-0" aria-live="polite" aria-atomic="true">
                {/* Method Eyebrow & Badges */}
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c7d8be]">
                    <span className="w-4 h-[1px] bg-[#d3b482]" />
                    <span>{stage.eyebrow}</span>
                  </div>

                  {/* Flame / Temp Badge */}
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#e8dfcf]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#254636] border border-[#3b6751]/80 text-[#e9dcbe]">
                      <Clock size={12} className="text-[#d8bb88]" />
                      <span>{stage.brewTimeMinutes}m</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#254636] border border-[#3b6751]/80 text-[#e9dcbe]">
                      <Flame size={12} className="text-[#e29362]" />
                      <span>{stage.flameLevel}</span>
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h2 className="font-serif text-2xl sm:text-[26px] lg:text-[28px] leading-[1.12] text-white tracking-tight mb-1 text-balance">
                  {stage.name}
                </h2>
                <p className="text-[11px] sm:text-xs text-[#d3be94] font-medium italic mb-2">
                  &ldquo;{stage.title}&rdquo;
                </p>

                {/* Dynamic Tab Switcher for Quick In-Card Details */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d1d17] border border-[#234233] mb-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab("recipe")}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-lg transition-all ${
                      activeTab === "recipe"
                        ? "bg-[#254636] text-[#faedd4] shadow-sm"
                        : "text-[#a4b5a3] hover:text-white"
                    }`}
                  >
                    Ratios &amp; Scale
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("steps")}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-lg transition-all ${
                      activeTab === "steps"
                        ? "bg-[#254636] text-[#faedd4] shadow-sm"
                        : "text-[#a4b5a3] hover:text-white"
                    }`}
                  > <StorefrontText id="copy_731ddb8fbabc1d0d" fallback="Brew Steps" /> </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("sommelier")}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-lg transition-all ${
                      activeTab === "sommelier"
                        ? "bg-[#254636] text-[#faedd4] shadow-sm"
                        : "text-[#a4b5a3] hover:text-white"
                    }`}
                  > <StorefrontText id="copy_1814eaf4caaa696c" fallback="Sommelier Note" /> </button>
                </div>

                {/* Tab 1: Recipe Ratios with Interactive Scale */}
                {activeTab === "recipe" && (
                  <div className="space-y-2.5">
                    {/* Serving Scaler */}
                    <div className="flex items-center justify-between bg-[#152e23] px-3 py-1.5 rounded-lg border border-[#264837]">
                      <span className="text-[11px] uppercase tracking-wider text-[#b8c7b6] font-semibold flex items-center gap-1.5">
                        <Scale size={13} className="text-[#d8bb88]" /> <StorefrontText id="copy_5561b1cf333f8ffe" fallback="Serving Scale:" /> </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setServingsMultiplier(n)}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                              servingsMultiplier === n
                                ? "bg-[#d8bb88] text-[#14261e]"
                                : "text-[#d6dec7] hover:bg-white/10"
                            }`}
                            aria-label={`Scale recipe to ${n} ${n === 1 ? "cup" : "cups"}`}
                          >
                            {n} {n === 1 ? "Cup" : "Cups"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metric Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#12291f]/90 p-2 rounded-lg border border-[#244534] text-center">
                        <span className="block text-[9px] uppercase tracking-wider text-[#9cb09b] font-medium"> <StorefrontText id="copy_7ca7dea906800f87" fallback="Water" /> </span>
                        <strong className="text-xs sm:text-sm font-mono text-[#f3eedd]">
                          {scaledWaterMl} ml
                        </strong>
                      </div>
                      <div className="bg-[#12291f]/90 p-2 rounded-lg border border-[#244534] text-center">
                        <span className="block text-[9px] uppercase tracking-wider text-[#9cb09b] font-medium"> <StorefrontText id="copy_8189b8409b18b1ef" fallback="Milk" /> </span>
                        <strong className="text-xs sm:text-sm font-mono text-[#f3eedd]">
                          {scaledMilkMl > 0 ? `${scaledMilkMl} ml` : "0 ml (Black)"}
                        </strong>
                      </div>
                      <div className="bg-[#12291f]/90 p-2 rounded-lg border border-[#244534] text-center">
                        <span className="block text-[9px] uppercase tracking-wider text-[#9cb09b] font-medium"> <StorefrontText id="copy_14c9a1770f334997" fallback="CTC Tea" /> </span>
                        <strong className="text-xs sm:text-sm font-mono text-[#ecd8b5]">
                          {scaledCtcGrams} g
                        </strong>
                      </div>
                    </div>

                    {/* Spices & Sweetener Info */}
                    <div className="p-2 sm:p-2.5 rounded-lg bg-[#142d22] border-l-2 border-[#d1aa74] text-[11px] text-[#e0e8db] leading-relaxed">
                      <div className="flex items-start gap-1.5 mb-1">
                        <Sparkles size={13} className="text-[#d8bb88] shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-[#edd6af]"> <StorefrontText id="copy_7d677d4054b0054b" fallback="Spice / Botanicals:" /> </strong>{" "}
                          {stage.ratios.spiceNotes}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#b8c4b4] pl-4"> <StorefrontText id="copy_76a1f05a24881468" fallback="Sweetener:" /> {stage.ratios.sweetenerDefault}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Brew Steps */}
                {activeTab === "steps" && (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {stage.steps.map((st, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-start gap-2 text-xs text-[#dce4d9] leading-snug p-1.5 rounded-md bg-[#12291f]/60"
                      >
                        <span className="w-4 h-4 rounded-full bg-[#254636] border border-[#3b6751] text-[10px] font-mono text-[#edd6af] flex items-center justify-center shrink-0 mt-0.5">
                          {sIdx + 1}
                        </span>
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Sommelier Insight & Pairing */}
                {activeTab === "sommelier" && (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-[#142d24] border-l-2 border-[#c1a376] text-xs text-[#e0e4da] leading-relaxed">
                      <strong className="block text-[10px] uppercase tracking-[0.18em] text-[#d9c08f] font-bold mb-0.5"> <StorefrontText id="copy_6acc6ed86ebed00b" fallback="Why CTC Granules Are Essential Here" /> </strong>
                      {stage.insight}
                    </div>

                    <div className="p-2 rounded-lg bg-[#10261f] border border-[#234233] text-xs text-[#c6d4c4] flex items-start gap-2">
                      <Utensils size={14} className="text-[#d8bb88] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white text-[11px]"> <StorefrontText id="copy_95080ab2e446aab7" fallback="Recommended Pairing:" /> </strong>{" "}
                        {stage.pairing}
                      </div>
                    </div>
                  </div>
                )}

                {/* Flavor Notes tags */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {stage.flavorNotes.map((f, fIdx) => (
                    <span
                      key={fIdx}
                      className="px-2 py-0.5 rounded-full bg-[#1b382c] border border-[#2b5440] text-[10px] text-[#e0e8db] font-medium"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Story Footer Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-[#213e30] mt-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopAutoPlay();
                      goToStage(currentStage - 1, true);
                    }}
                    disabled={currentStage === 0}
                    aria-label="Previous CTC brewing method"
                    className="w-9 h-9 rounded-full border border-[#f2efe1]/25 flex items-center justify-center text-[#f6f2e8] transition-all hover:bg-white/10 hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAutoPlay();
                      goToStage(currentStage + 1, true);
                    }}
                    disabled={currentStage === CTC_BREW_METHODS.length - 1}
                    aria-label="Next CTC brewing method"
                    className="w-9 h-9 rounded-full bg-[#edd8b4] text-[#182820] font-bold flex items-center justify-center transition-all hover:bg-[#fae8c8] hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <ChevronRight size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        stopAutoPlay();
                      } else {
                        startAutoPlay();
                      }
                    }}
                    aria-label={isPlaying ? "Pause auto tour" : "Play auto tour"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#f2efe1]/20 text-[11px] font-semibold text-[#f0ead8] hover:bg-white/10 transition-colors ml-1"
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    <span>{isPlaying ? "Pause" : "Auto Tour"}</span>
                  </button>
                </div>

                <span className="text-[11px] sm:text-xs text-[#aab8ae] tracking-wider font-medium truncate ml-2">
                  {currentStage === CTC_BREW_METHODS.length - 1 ? (
                    <span className="text-[#e2caa0] font-semibold"> <StorefrontText id="copy_dd2a312edae5e7b4" fallback="Mastered all 7 methods ✦" /> </span>
                  ) : (
                    <span> <StorefrontText id="copy_5693e770dd678bff" fallback="Next:" /> {CTC_BREW_METHODS[currentStage + 1].name} →</span>
                  )}
                </span>
              </div>
            </div>

            {/* Visual Panel (Right 6 Cols on desktop, order-1 on mobile) */}
            <div
              className="order-1 lg:order-2 lg:col-span-6 relative h-[210px] sm:h-[260px] lg:h-full lg:min-h-0 overflow-hidden bg-[#16271e]"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              role="img"
              aria-label={stage.alt}
            >
              {/* Stack of Realistic Method Photographs with Smooth Crossfade */}
              {CTC_BREW_METHODS.map((m, idx) => {
                const isActive = idx === currentStage;
                return (
                  <div
                    key={m.id}
                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                      isActive
                        ? "opacity-100 scale-100 z-10"
                        : "opacity-0 scale-105 pointer-events-none z-0"
                    }`}
                  >
                    <Image
                      src={m.image}
                      alt={m.alt}
                      fill
                      priority={idx <= 1}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                    {/* Ambient vignette gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30 pointer-events-none" />
                  </div>
                );
              })}

              {/* Floating Top Badge */}
              <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[#f7f5eb] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#d8bb88]" />
                <span>{stage.topBadge}</span>
              </div>

              {/* Authentic Himalayan Stamp Seal */}
              <div
                className="absolute right-4 top-4 sm:right-5 sm:top-5 z-20 w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/40 backdrop-blur-sm flex flex-col items-center justify-center font-serif italic text-[11px] sm:text-xs text-[#f9f7eb] text-center leading-tight -rotate-12 pointer-events-none shadow-lg"
                aria-hidden="true"
              >
                <span> <StorefrontText id="copy_012797cf8414c1b3" fallback="ctc craft" /> </span>
                <span className="text-[9px] sm:text-[10px] tracking-widest uppercase font-sans not-italic text-[#d9c08f]"> <StorefrontText id="copy_181fdd46fc4a7246" fallback="origin" /> </span>
              </div>

              {/* Floating Bottom Caption */}
              <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 z-20 text-xs sm:text-sm text-[#f6f2e8]/95 font-medium tracking-wide drop-shadow-md">
                <span>{stage.caption}</span>
              </div>
            </div>
          </div>

          {/* Integrated Docked Timeline Bar across the bottom of the card */}
          <div className="shrink-0 border-t border-[#234233] bg-[#0c1c16]/95 backdrop-blur-md px-3 sm:px-6 py-2 sm:py-2.5 z-30">
            {/* Interactive Progress Line */}
            <div
              className="relative h-1.5 w-full bg-[#1b382c] rounded-full overflow-hidden mb-2 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickPos = (e.clientX - rect.left) / rect.width;
                const targetIdx = Math.min(
                  CTC_BREW_METHODS.length - 1,
                  Math.max(0, Math.floor(clickPos * CTC_BREW_METHODS.length))
                );
                stopAutoPlay();
                goToStage(targetIdx, true);
              }}
              title="Click to jump along the timeline"
            >
              <div
                className="h-full bg-gradient-to-r from-[#d8bb88] via-[#e29362] to-[#edd8b4] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stage Quick Switch Buttons */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5">
              {CTC_BREW_METHODS.map((m, idx) => {
                const isSelected = idx === currentStage;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      stopAutoPlay();
                      goToStage(idx, true);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? "bg-[#edd8b4] text-[#14261e] shadow-md scale-105"
                        : "text-[#a4b5a3] hover:text-white hover:bg-white/10"
                    }`}
                    aria-label={`Jump to method ${m.step}: ${m.name}`}
                  >
                    <span className="font-mono text-[10px] opacity-80">{m.step}</span>
                    <span className="hidden sm:inline">{m.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
