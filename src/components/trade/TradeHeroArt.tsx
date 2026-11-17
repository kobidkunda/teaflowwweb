"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { canAnimateTradeHero, type AnimationDevice } from "@/lib/trade/heroAnimation";
import ui from "./ritual.module.css";

const animation = "/images/tea-shops/masala-chai-pour-loop.gif";

export function TradeHeroArt({ src, alt, hindi }: { src: string; alt: string; hindi: boolean }) {
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const device = navigator as Navigator & AnimationDevice;
    const connection = device.connection as (AnimationDevice["connection"] & EventTarget) | undefined;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let preload: HTMLImageElement | undefined;
    let loaded = false;
    let started = false;
    const eligible = () => canAnimateTradeHero(device, motion.matches);
    const update = () => {
      if (!eligible()) {
        setReady(false);
        return;
      }
      if (loaded) setReady(true);
      else if (document.readyState === "complete") load();
    };
    const load = () => {
      // Yield beyond the load event so the initial page keeps priority.
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (disposed || started || document.visibilityState !== "visible" || !eligible()) return;
        started = true;
        preload = new window.Image();
        preload.onload = async () => {
          try {
            await preload?.decode();
            loaded = true;
            if (!disposed) update();
          } catch { /* Keep the still if decoding fails. */ }
        };
        preload.src = animation;
      }, 500);
    };
    if (document.readyState === "complete") load();
    else window.addEventListener("load", load, { once: true });
    motion.addEventListener("change", update);
    connection?.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("load", load);
      motion.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
      if (preload) preload.onload = null;
    };
  }, [src]);

  return <>
    <Image className={ui.heroArt} src={src} alt={alt} width={1920} height={1080} priority sizes="100vw" />
    {ready && !paused && <Image className={ui.heroArt} src={animation} alt="" aria-hidden="true" fill unoptimized sizes="100vw" onError={() => setReady(false)} />}
    {ready && <button type="button" className={ui.heroMotion} onClick={() => setPaused(!paused)} aria-pressed={paused}>
      {hindi ? (paused ? "एनीमेशन चलाएँ" : "एनीमेशन रोकें") : (paused ? "Play animation" : "Pause animation")}
    </button>}
  </>;
}
