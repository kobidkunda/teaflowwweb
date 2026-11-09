"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { Compass, RotateCcw } from "lucide-react";

export interface ShopEmptyStateProps {
  onReset: () => void;
  onSelectSuggestion?: (query: string) => void;
}

export function ShopEmptyState({
  onReset,
  onSelectSuggestion,
}: ShopEmptyStateProps) {
  const suggestions = [
    { label: "Darjeeling First Flush", q: "Darjeeling" },
    { label: "High Altitude (>4,500 ft)", q: "High" },
    { label: "Floral & Muscatel", q: "Floral" },
    { label: "Assam Golden Tips", q: "Assam" },
  ];

  return (
    <div className="shop-empty-state" role="status" aria-live="polite">
      <div className="shop-empty-icon-wrap" aria-hidden="true">
        <Compass size={36} />
      </div>
      <h2 className="shop-empty-title"> <StorefrontText id="copy_1cc1646178319fde" fallback="No exact harvest match." /> </h2>
      <p className="shop-empty-text"> <StorefrontText id="copy_8fad2e57441ef51b" fallback="We could not find single-estate lots matching your exact combination of terroir, harvest flush, or sensory profile. Try clearing a filter or searching for another note." /> </p>

      <div className="shop-empty-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={onReset}
        >
          <RotateCcw size={14} aria-hidden="true" /> <StorefrontText id="copy_58cefb489b1af807" fallback="Reset all filters" /> </button>
      </div>

      {onSelectSuggestion && (
        <div className="shop-empty-suggestions">
          <span className="eyebrow"> <StorefrontText id="copy_6def7197e4e387e8" fallback="Explore popular Himalayan flushes:" /> </span>
          <div className="shop-empty-chips">
            {suggestions.map((item) => (
              <button
                key={item.label}
                type="button"
                className="shop-empty-chip-btn"
                onClick={() => onSelectSuggestion(item.q)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
