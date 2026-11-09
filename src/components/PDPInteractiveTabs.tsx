"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useRef, useCallback } from "react";
import type { ProductImage } from "@/lib/storefront";
import type { Product } from "@/lib/products";
import { CuppingProfile } from "@/components/CuppingProfile";
import { SteepingGuide } from "@/components/SteepingGuide";
import { TeaMoments } from "@/components/TeaMoments";
import { parseTeaMoments } from "@/lib/teaMoments";

export interface PDPInteractiveTabsProps {
  product: Product;
  images?: ProductImage[];
  initialTab?: string;
  className?: string;
}

interface TabDef {
  id: string;
  label: string;
  panelId: string;
}

const ALL_TABS: TabDef[] = [
  {
    id: "all",
    label: "All Overview",
    panelId: "panel-all",
  },
  {
    id: "cupping",
    label: "Sensory Cupping",
    panelId: "panel-cupping",
  },
  {
    id: "steeping",
    label: "Steeping Guide",
    panelId: "panel-steeping",
  },
  {
    id: "moments",
    label: "Tea Moments",
    panelId: "panel-moments",
  },
];

export function PDPInteractiveTabs({
  product,
  images = [],
  initialTab = "all",
  className = "",
}: PDPInteractiveTabsProps) {
  const hasMoments = !!parseTeaMoments(product.tea_moments)?.introduction;
  const TABS = ALL_TABS.filter((tab) => tab.id !== "moments" || hasMoments);
  const [selectedTab, setActiveTab] = useState<string>(initialTab);
  const activeTab = TABS.some((tab) => tab.id === selectedTab) ? selectedTab : "all";
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cupping: true,
    steeping: true,
    moments: true,
  });

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let targetIndex = -1;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          targetIndex = (index + 1) % TABS.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          targetIndex = (index - 1 + TABS.length) % TABS.length;
          break;
        case "Home":
          e.preventDefault();
          targetIndex = 0;
          break;
        case "End":
          e.preventDefault();
          targetIndex = TABS.length - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          setActiveTab(TABS[index].id);
          return;
        default:
          return;
      }

      if (targetIndex >= 0) {
        setActiveTab(TABS[targetIndex].id);
        tabRefs.current[targetIndex]?.focus();
      }
    },
    [TABS]
  );

  return (
    <section
      aria-label="Comprehensive tea profile, sensory cupping, and brewing guide"
      className={`pdp-interactive-experience my-12 ${className}`}
    >
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP VIEWPORT (>= 768px): Accessible ARIA Tablist & Panels */}
      {/* ------------------------------------------------------------- */}
      <div className="desktop-tabs hidden md:block">
        {/* Horizontal ARIA Tablist */}
        <div
          role="tablist"
          aria-label="Connoisseur tea dossier navigation tabs"
          className="pdp-tabs tabs flex items-center border-b border-[#d6cfc2] mb-8 gap-1"
        >
          {TABS.map((tab, idx) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={tab.panelId}
                tabIndex={isSelected ? 0 : -1}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`px-6 py-4 text-sm font-semibold tracking-wide transition-all border-b-2 -mb-[2px] outline-none ${
                  isSelected
                    ? "border-[#1d2a24] text-[#1d2a24] bg-[#e8ece4]/50"
                    : "border-transparent text-[#697a55] hover:text-[#1d2a24] hover:border-[#b8b6ac]"
                }`}
                style={{
                  minHeight: "44px",
                  cursor: "pointer",
                  outlineColor: "#a66a43",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        {/* Panel 0: All Overview (Active when activeTab === "all") */}
        <div
          role="tabpanel"
          id="panel-all"
          aria-labelledby="tab-all"
          hidden={activeTab !== "all"}
          className={`tabpanel space-y-12 ${activeTab === "all" ? "block" : "hidden"}`}
        >
          {activeTab === "all" && (
            <>
              <CuppingProfile product={product} images={images} />
              <SteepingGuide product={product} images={images} />
              <TeaMoments product={product} />
            </>
          )}
        </div>

        {/* Panel 1: Sensory Cupping */}
        <div
          role="tabpanel"
          id="panel-cupping"
          aria-labelledby="tab-cupping"
          hidden={activeTab !== "cupping"}
          className={`tabpanel ${activeTab === "cupping" ? "block" : "hidden"}`}
        >
          {activeTab === "cupping" && <CuppingProfile product={product} images={images} />}
        </div>

        {/* Panel 2: Steeping Guide */}
        <div
          role="tabpanel"
          id="panel-steeping"
          aria-labelledby="tab-steeping"
          hidden={activeTab !== "steeping"}
          className={`tabpanel ${activeTab === "steeping" ? "block" : "hidden"}`}
        >
          {activeTab === "steeping" && <SteepingGuide product={product} images={images} />}
        </div>

        {hasMoments && <>
        {/* Panel 3: Tea Moments */}
        <div
          role="tabpanel"
          id="panel-moments"
          aria-labelledby="tab-moments"
          hidden={activeTab !== "moments"}
          className={`tabpanel ${activeTab === "moments" ? "block" : "hidden"}`}
        >
          {activeTab === "moments" && (
            <TeaMoments product={product} />
          )}
        </div>
        </>}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE VIEWPORT (< 768px): Collapsible Accordion Navigation   */}
      {/* ------------------------------------------------------------- */}
      <div className="mobile-accordion block md:hidden space-y-4">
        {/* Accordion Item 1: Sensory & Cupping Profile */}
        <div className="accordion-item border border-[#d6cfc2] rounded-lg overflow-hidden bg-[#fbf8f1]">
          <button
            type="button"
            className="accordion-trigger w-full flex items-center justify-between p-4 text-left font-serif text-lg font-semibold text-[#171713] bg-[#ede9df]"
            aria-expanded={openSections.cupping}
            aria-controls="accordion-panel-cupping"
            onClick={() => toggleSection("cupping")}
            style={{ minHeight: "44px", outlineColor: "#a66a43" }}
          >
            <span>Sensory & Cupping Profile</span>
            <span
              className="text-xl transform transition-transform duration-200 select-none"
              aria-hidden="true"
            >
              {openSections.cupping ? "−" : "+"}
            </span>
          </button>
          <div
            id="accordion-panel-cupping"
            className={`accordion-panel p-4 ${openSections.cupping ? "block" : "hidden"}`}
            hidden={!openSections.cupping}
          >
            <CuppingProfile product={product} images={images} />
          </div>
        </div>

        {/* Accordion Item 2: Steeping Guide */}
        <div className="accordion-item border border-[#d6cfc2] rounded-lg overflow-hidden bg-[#fbf8f1]">
          <button
            type="button"
            className="accordion-trigger w-full flex items-center justify-between p-4 text-left font-serif text-lg font-semibold text-[#171713] bg-[#ede9df]"
            aria-expanded={openSections.steeping}
            aria-controls="accordion-panel-steeping"
            onClick={() => toggleSection("steeping")}
            style={{ minHeight: "44px", outlineColor: "#a66a43" }}
          >
            <span> <StorefrontText id="copy_8f5d09c0dc00f44d" fallback="Interactive Steeping Guide" /> </span>
            <span
              className="text-xl transform transition-transform duration-200 select-none"
              aria-hidden="true"
            >
              {openSections.steeping ? "−" : "+"}
            </span>
          </button>
          <div
            id="accordion-panel-steeping"
            className={`accordion-panel p-4 ${openSections.steeping ? "block" : "hidden"}`}
            hidden={!openSections.steeping}
          >
            <SteepingGuide product={product} images={images} />
          </div>
        </div>

        {hasMoments && <>
        {/* Accordion Item 3: Tea Moments */}
        <div className="accordion-item border border-[#d6cfc2] rounded-lg overflow-hidden bg-[#fbf8f1]">
          <button
            type="button"
            className="accordion-trigger w-full flex items-center justify-between p-4 text-left font-serif text-lg font-semibold text-[#171713] bg-[#ede9df]"
            aria-expanded={openSections.moments}
            aria-controls="accordion-panel-moments"
            onClick={() => toggleSection("moments")}
            style={{ minHeight: "44px", outlineColor: "#a66a43" }}
          >
            <span> <StorefrontText id="copy_3108636f932ea355" fallback="Tea Moments" /> </span>
            <span
              className="text-xl transform transition-transform duration-200 select-none"
              aria-hidden="true"
            >
              {openSections.moments ? "−" : "+"}
            </span>
          </button>
          <div
            id="accordion-panel-moments"
            className={`accordion-panel p-4 ${openSections.moments ? "block" : "hidden"}`}
            hidden={!openSections.moments}
          >
            <TeaMoments product={product} />
          </div>
        </div>
        </>}
      </div>
    </section>
  );
}
