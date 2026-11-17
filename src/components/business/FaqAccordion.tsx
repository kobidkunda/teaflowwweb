"use client";

import { useRef, useState } from "react";
import type { B2BFaqItem } from "@/lib/business/repository";
import type { BusinessLocale } from "@/lib/business/schema";

export function FaqAccordion({
  items,
  locale = "en",
}: {
  items: B2BFaqItem[];
  locale?: BusinessLocale;
}) {
  const isHi = locale === "hi";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);

  function toggleAll() {
    const root = containerRef.current;
    if (!root) return;
    const next = !allExpanded;
    root.querySelectorAll<HTMLDetailsElement>(":scope > details").forEach((el) => {
      el.open = next;
    });
    setAllExpanded(next);
  }

  function syncExpandedState() {
    const root = containerRef.current;
    if (!root) return;
    const details = Array.from(root.querySelectorAll<HTMLDetailsElement>(":scope > details"));
    setAllExpanded(details.length > 0 && details.every((el) => el.open));
  }

  return (
    <div ref={containerRef} className="tf-faq">
      {items.length > 1 ? (
        <div className="tf-faq-controls">
          <button
            type="button"
            className="tf-faq-toggle-all"
            aria-expanded={allExpanded}
            onClick={toggleAll}
          >
            {allExpanded
              ? isHi
                ? "सभी उत्तर बंद करें"
                : "Collapse all"
              : isHi
                ? "सभी उत्तर खोलें"
                : "Expand all"}
          </button>
        </div>
      ) : null}
      {items.map((item) => (
        <details key={item.q} onToggle={syncExpandedState}>
          <summary>{item.q}</summary>
          <div className="tf-faq-body">
            <p>{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
