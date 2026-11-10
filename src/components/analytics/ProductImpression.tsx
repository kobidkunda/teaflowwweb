"use client";
import React, { useEffect, useRef } from "react";
import { trackSelectItem, trackViewItemList, type TrackingItem } from "@/lib/seo/tracking";
import { CONSENT_EVENT } from "@/lib/seo/consent";

/** Observe the actual card, rather than counting every filtered product as viewed. */
export function ProductImpression({ item, list = "Catalog" }: { item: TrackingItem; list?: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const seen = useRef("");
  const signature = JSON.stringify(item);
  useEffect(() => {
    const card = anchor.current?.closest("article");
    if (!card) return;
    const current: TrackingItem = JSON.parse(signature);
    let visible = false;
    const record = () => {
      if (visible && seen.current !== signature && trackViewItemList([current], list)) seen.current = signature;
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; record(); }, { threshold: 0.5 });
    observer.observe(card);
    const select = (event: Event) => {
      const link = (event.target as Element).closest("a");
      if (link?.getAttribute("href")?.includes("/tea/")) trackSelectItem(current, list);
    };
    card.addEventListener("click", select);
    window.addEventListener(CONSENT_EVENT, record);
    return () => { observer.disconnect(); card.removeEventListener("click", select); window.removeEventListener(CONSENT_EVENT, record); };
  }, [signature, list]);
  return <span ref={anchor} hidden />;
}
