"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect } from "react";
import type { ShopFilterState, SortOption } from "./types";
import { X, Check } from "lucide-react";

export interface ShopMobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ShopFilterState;
  onFilterChange: <K extends keyof ShopFilterState>(
    key: K,
    value: ShopFilterState[K]
  ) => void;
  onResetFilters: () => void;
  matchingCount: number;
  categories: { id: number; slug: string; name: string }[];
  regions: string[];
  flushes: string[];
  flavors: string[];
  elevations: { id: string; label: string }[];
}

export function ShopMobileFilterDrawer({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onResetFilters,
  matchingCount,
  categories,
  regions,
  flushes,
  flavors,
  elevations,
}: ShopMobileFilterDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="shop-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-filter-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="shop-drawer-panel">
        {/* Header */}
        <div className="shop-drawer-header">
          <div>
            <h2 id="mobile-filter-title" className="shop-drawer-title"> <StorefrontText id="copy_94e03a9bf4bd905e" fallback="Filter Fine Teas" /> </h2>
            <p className="shop-drawer-subtitle"> <StorefrontText id="copy_59640a8917246d6b" fallback="Refine by garden, harvest flush, and taste" /> </p>
          </div>
          <button
            type="button"
            className="shop-drawer-close-btn"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Filters Body */}
        <div className="shop-drawer-body">
          {/* Sort By */}
          <div className="drawer-filter-group">
            <label htmlFor="drawer-sort" className="drawer-group-label"> <StorefrontText id="copy_e604fe949140a813" fallback="Sort Order" /> </label>
            <select
              id="drawer-sort"
              className="drawer-select"
              value={filters.sortBy}
              onChange={(e) =>
                onFilterChange("sortBy", e.target.value as SortOption)
              }
            >
              <option value="featured">Curator&apos;s Choice (Featured First)</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="elevation_desc">Elevation: Alpine First</option>
              <option value="temp_asc">Brew Temp: Gentle First</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>

          {/* Tea Family / Category */}
          <div className="drawer-filter-group">
            <span className="drawer-group-label"> <StorefrontText id="copy_c0f1484a476c745a" fallback="Tea Family" /> </span>
            <div className="drawer-chip-grid">
              <button
                type="button"
                className={`drawer-chip ${!filters.category ? "active" : ""}`}
                onClick={() => onFilterChange("category", "")}
              > <StorefrontText id="copy_2e60bf2e330f523b" fallback="All Teas" /> </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`drawer-chip ${
                    filters.category.toLowerCase() === c.slug.toLowerCase() ||
                    filters.category.toLowerCase() === c.name.toLowerCase()
                      ? "active"
                      : ""
                  }`}
                  onClick={() => onFilterChange("category", c.slug)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Terroir / Region */}
          <div className="drawer-filter-group">
            <span className="drawer-group-label"> <StorefrontText id="copy_742e6b838d7652a6" fallback="Origin Terroir" /> </span>
            <div className="drawer-chip-grid">
              <button
                type="button"
                className={`drawer-chip ${!filters.region ? "active" : ""}`}
                onClick={() => onFilterChange("region", "")}
              > <StorefrontText id="copy_831cf1963321a831" fallback="All Terroirs" /> </button>
              {regions.map((reg) => (
                <button
                  key={reg}
                  type="button"
                  className={`drawer-chip ${
                    filters.region === reg ? "active" : ""
                  }`}
                  onClick={() => onFilterChange("region", reg)}
                >
                  {reg}
                </button>
              ))}
            </div>
          </div>

          {/* Harvest Flush */}
          <div className="drawer-filter-group">
            <span className="drawer-group-label"> <StorefrontText id="copy_dce0a113d263ab56" fallback="Harvest Flush" /> </span>
            <div className="drawer-chip-grid">
              <button
                type="button"
                className={`drawer-chip ${!filters.flush ? "active" : ""}`}
                onClick={() => onFilterChange("flush", "")}
              > <StorefrontText id="copy_9c027efba75c81dc" fallback="All Flushes" /> </button>
              {flushes.map((fl) => (
                <button
                  key={fl}
                  type="button"
                  className={`drawer-chip ${
                    filters.flush === fl ? "active" : ""
                  }`}
                  onClick={() => onFilterChange("flush", fl)}
                >
                  {fl}
                </button>
              ))}
            </div>
          </div>

          {/* Sensory / Flavor Profile */}
          <div className="drawer-filter-group">
            <span className="drawer-group-label"> <StorefrontText id="copy_e7b9db0c14bc8f8a" fallback="Sensory Note" /> </span>
            <div className="drawer-chip-grid">
              <button
                type="button"
                className={`drawer-chip ${!filters.flavor ? "active" : ""}`}
                onClick={() => onFilterChange("flavor", "")}
              > <StorefrontText id="copy_b96aa013abc65dee" fallback="All Flavors" /> </button>
              {flavors.map((flv) => (
                <button
                  key={flv}
                  type="button"
                  className={`drawer-chip ${
                    filters.flavor === flv ? "active" : ""
                  }`}
                  onClick={() => onFilterChange("flavor", flv)}
                >
                  {flv}
                </button>
              ))}
            </div>
          </div>

          {/* Garden Elevation */}
          <div className="drawer-filter-group">
            <span className="drawer-group-label"> <StorefrontText id="copy_e6025ed561872d9c" fallback="Garden Elevation" /> </span>
            <div className="drawer-chip-grid">
              <button
                type="button"
                className={`drawer-chip ${!filters.elevation ? "active" : ""}`}
                onClick={() => onFilterChange("elevation", "")}
              > <StorefrontText id="copy_f6da256df5b828ea" fallback="All Altitudes" /> </button>
              {elevations.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  className={`drawer-chip ${
                    filters.elevation === el.id ? "active" : ""
                  }`}
                  onClick={() => onFilterChange("elevation", el.id)}
                >
                  {el.label}
                </button>
              ))}
            </div>
          </div>

          {/* Boolean Toggles */}
          <div className="drawer-filter-group drawer-toggle-group">
            <label className="drawer-checkbox-label">
              <input
                type="checkbox"
                checked={filters.featuredOnly}
                onChange={(e) =>
                  onFilterChange("featuredOnly", e.target.checked)
                }
              />
              <span>Curator&apos;s Reserve Lots Only</span>
            </label>

            <label className="drawer-checkbox-label">
              <input
                type="checkbox"
                checked={filters.inStockOnly}
                onChange={(e) =>
                  onFilterChange("inStockOnly", e.target.checked)
                }
              />
              <span> <StorefrontText id="copy_c704581ffc418b9c" fallback="In Stock Only" /> </span>
            </label>
          </div>
        </div>

        {/* Drawer Sticky Footer */}
        <div className="shop-drawer-footer">
          <button
            type="button"
            className="drawer-reset-btn"
            onClick={onResetFilters}
          > <StorefrontText id="copy_ddceb7adfdb8816e" fallback="Clear All" /> </button>
          <button
            type="button"
            className="button button-primary drawer-apply-btn"
            onClick={onClose}
          >
            <Check size={16} aria-hidden="true" /> <StorefrontText id="copy_0df6f1cad36c49da" fallback="Show" /> {matchingCount} {matchingCount === 1 ? "Tea" : "Teas"}
          </button>
        </div>
      </div>
    </div>
  );
}
