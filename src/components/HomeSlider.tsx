"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import type { Slider } from "@/lib/storefront";

/**
 * Accessible homepage hero slider. Auto-advance pauses on hover/focus and is
 * fully disabled under prefers-reduced-motion. Arrow keys work only when
 * focus is inside the carousel so global typing is never hijacked.
 */
export function HomeSlider({ slides }: { slides: Slider[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const count = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count, paused, reduced]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || !root.current?.contains(target)) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  if (!count) return null;
  if (count === 1) {
    const s = slides[0];
    return (
      <section className="hero-slider" aria-label="Featured stories">
        <div className="container hero-slide-single">
          <p className="eyebrow light">{s.subtitle || "Teafloww"}</p>
          <h2>{s.title}</h2>
          {s.cta_label && s.cta_href ? (
            <Link href={s.cta_href} className="button button-cream">
              {s.cta_label}
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={root}
      className="hero-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured stories"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="container hero-slider-viewport">
        <div
          className="hero-slider-track"
          aria-live="polite"
          aria-atomic="true"
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={i === index ? "hero-slide active" : "hero-slide"}
              aria-hidden={i !== index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              <p className="eyebrow light">{s.subtitle || "Teafloww"}</p>
              <h2>{s.title}</h2>
              {s.cta_label && s.cta_href ? (
                <Link
                  href={s.cta_href}
                  className="button button-cream"
                  tabIndex={i === index ? 0 : -1}
                >
                  {s.cta_label}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
        <div className="hero-slider-controls">
          <button
            type="button"
            className="slider-arrow"
            aria-label="Previous story"
            onClick={() => go(index - 1)}
          >
            ←
          </button>
          <div className="slider-dots" role="group" aria-label="Choose story">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-current={i === index ? "true" : undefined}
                aria-label={`Story ${i + 1}: ${s.title}`}
                className={i === index ? "slider-dot active" : "slider-dot"}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="slider-arrow"
            aria-label="Next story"
            onClick={() => go(index + 1)}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
