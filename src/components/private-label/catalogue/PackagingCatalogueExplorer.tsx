"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "../styles/PrivateLabel.module.css";
import { PackagingCard } from "./PackagingCard";
import { EmptyCatalogueState } from "./EmptyCatalogueState";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";

const CATEGORIES = [
  { code: "all", label: "All Formats" },
  { code: "pouch", label: "Pouches" },
  { code: "tin", label: "Tins" },
  { code: "jar", label: "Jars" },
  { code: "carton", label: "Cartons" },
  { code: "sachet", label: "Sachets" },
  { code: "bag", label: "Bulk Bags" },
];

export interface PackagingCatalogueExplorerProps {
  initialVariants: PublicPackagingVariantDto[];
}

export function PackagingCatalogueExplorer({
  initialVariants,
}: PackagingCatalogueExplorerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Read initial filter values from URL search params
  const initialFamily = searchParams.get("family") || searchParams.get("category") || "all";
  const initialCapacity = searchParams.get("capacity") || "all";
  const initialMaterial = searchParams.get("material") || "all";
  const initialMoq = searchParams.get("moq") || "all";
  const initialSearch = searchParams.get("q") || searchParams.get("search") || "";

  const [category, setCategory] = useState(initialFamily);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [material, setMaterial] = useState(initialMaterial);
  const [moq, setMoq] = useState(initialMoq);
  const [search, setSearch] = useState(initialSearch);

  // Sync state with URL params when searchParams change externally
  useEffect(() => {
    const f = searchParams.get("family") || searchParams.get("category") || "all";
    const c = searchParams.get("capacity") || "all";
    const m = searchParams.get("material") || "all";
    const q = searchParams.get("moq") || "all";
    const s = searchParams.get("q") || searchParams.get("search") || "";

    setCategory(f);
    setCapacity(c);
    setMaterial(m);
    setMoq(q);
    setSearch(s);
  }, [searchParams]);

  // Update URL search parameters when filters change
  const updateUrlParams = (updates: {
    category?: string;
    capacity?: string;
    material?: string;
    moq?: string;
    search?: string;
  }) => {
    const nextCategory = updates.category !== undefined ? updates.category : category;
    const nextCapacity = updates.capacity !== undefined ? updates.capacity : capacity;
    const nextMaterial = updates.material !== undefined ? updates.material : material;
    const nextMoq = updates.moq !== undefined ? updates.moq : moq;
    const nextSearch = updates.search !== undefined ? updates.search : search;

    const params = new URLSearchParams();
    if (nextCategory && nextCategory !== "all") params.set("family", nextCategory);
    if (nextCapacity && nextCapacity !== "all") params.set("capacity", nextCapacity);
    if (nextMaterial && nextMaterial !== "all") params.set("material", nextMaterial);
    if (nextMoq && nextMoq !== "all") params.set("moq", nextMoq);
    if (nextSearch.trim()) params.set("q", nextSearch.trim());

    const queryString = params.toString();
    const newPath = queryString ? `/private-label/packaging?${queryString}` : "/private-label/packaging";

    startTransition(() => {
      window.history.replaceState(null, "", newPath);
    });
  };

  // Safe client-side filtering
  const filteredVariants = useMemo(() => {
    return initialVariants.filter((variant) => {
      // 1. Category / Family filter
      if (category !== "all") {
        const itemCategory = (variant.category || variant.family || "").toLowerCase();
        if (itemCategory !== category.toLowerCase()) return false;
      }

      // 2. Capacity filter
      if (capacity !== "all") {
        const capNum = parseFloat(capacity.replace(/[^0-9.]/g, ""));
        if (!isNaN(capNum)) {
          const itemWeight = variant.net_capacity_grams || variant.net_weight_capacity_grams || 0;
          if (capNum >= 1000) {
            if (itemWeight < 1000) return false;
          } else if (Math.abs(itemWeight - capNum) > 20) {
            return false;
          }
        } else {
          // If a non-numeric capacity like "999kg" was passed in URL
          return false;
        }
      }

      // 3. Material filter
      if (material !== "all") {
        const itemMaterial = (variant.material || "").toLowerCase();
        if (!itemMaterial.includes(material.toLowerCase())) return false;
      }

      // 4. MOQ filter
      if (moq !== "all") {
        const itemMoq = variant.moq_units || 0;
        if (moq === "250" && itemMoq > 250) return false;
        if (moq === "500" && itemMoq > 500) return false;
        if (moq === "1000" && itemMoq < 1000) return false;
      }

      // 5. Search query (safe case-insensitive text match)
      if (search.trim()) {
        const cleanTerm = search.trim().toLowerCase();
        const titleMatch = (variant.title || variant.name || "").toLowerCase().includes(cleanTerm);
        const materialMatch = (variant.material || "").toLowerCase().includes(cleanTerm);
        const skuMatch = (variant.sku || "").toLowerCase().includes(cleanTerm);
        const descMatch = (variant.capacity_description || "").toLowerCase().includes(cleanTerm);
        if (!titleMatch && !materialMatch && !skuMatch && !descMatch) return false;
      }

      return true;
    });
  }, [initialVariants, category, capacity, material, moq, search]);

  const handleResetFilters = () => {
    setCategory("all");
    setCapacity("all");
    setMaterial("all");
    setMoq("all");
    setSearch("");
    startTransition(() => {
      window.history.replaceState(null, "", "/private-label/packaging");
    });
  };

  return (
    <div className={styles.pageContainer}>
      {/* Catalogue Filter Bar */}
      <section
        style={{
          backgroundColor: "#F6F1E7",
          padding: "24px 0",
          borderBottom: "1px solid #DDE4DC",
          marginBottom: "32px",
        }}
        aria-label="Catalogue Search and Filters"
      >
        <div className={styles.contentContainer}>
          {/* Category Filter Chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
            role="toolbar"
            aria-label="Category Filter Chips"
          >
            {CATEGORIES.map((cat) => {
              const active = category === cat.code;
              return (
                <button
                  key={cat.code}
                  type="button"
                  data-testid="filter-chip"
                  data-category={cat.code}
                  onClick={() => {
                    setCategory(cat.code);
                    updateUrlParams({ category: cat.code });
                  }}
                  style={{
                    minHeight: "44px",
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: active ? "1.5px solid #143C31" : "1px solid #DDE4DC",
                    backgroundColor: active ? "#143C31" : "#FFFCF7",
                    color: active ? "#FFFCF7" : "#171713",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Secondary Dropdown Filters & Search */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              gap: "12px",
              alignItems: "center",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: 0 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  updateUrlParams({ search: val });
                }}
                placeholder="Search packaging formats..."
                aria-label="Search packaging"
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "8px 14px",
                  fontSize: "0.875rem",
                  border: "1.5px solid #DDE4DC",
                  borderRadius: "6px",
                  backgroundColor: "#FFFCF7",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Capacity Select */}
            <div style={{ minWidth: 0 }}>
              <select
                name="capacity"
                data-testid="capacity-filter"
                value={capacity}
                onChange={(e) => {
                  const val = e.target.value;
                  setCapacity(val);
                  updateUrlParams({ capacity: val });
                }}
                aria-label="Filter by Capacity"
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "8px 12px",
                  fontSize: "0.875rem",
                  border: "1.5px solid #DDE4DC",
                  borderRadius: "6px",
                  backgroundColor: "#FFFCF7",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All Capacities</option>
                <option value="25">25g Tasting</option>
                <option value="50">50g Retail</option>
                <option value="100">100g Standard</option>
                <option value="250">250g Reserve</option>
                <option value="500">500g Commercial</option>
                <option value="1000">1kg Bulk</option>
              </select>
            </div>

            {/* Material Select */}
            <div style={{ minWidth: 0 }}>
              <select
                name="material"
                data-testid="material-filter"
                value={material}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaterial(val);
                  updateUrlParams({ material: val });
                }}
                aria-label="Filter by Material"
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "8px 12px",
                  fontSize: "0.875rem",
                  border: "1.5px solid #DDE4DC",
                  borderRadius: "6px",
                  backgroundColor: "#FFFCF7",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All Materials</option>
                <option value="kraft">Kraft Barrier</option>
                <option value="tinplate">Tinplate Metal</option>
                <option value="glass">Borosilicate Glass</option>
                <option value="folding">Boxboard Carton</option>
                <option value="pla">PLA Cornstarch</option>
              </select>
            </div>

            {/* MOQ Band Select */}
            <div style={{ minWidth: 0 }}>
              <select
                name="moq"
                data-testid="moq-filter"
                value={moq}
                onChange={(e) => {
                  const val = e.target.value;
                  setMoq(val);
                  updateUrlParams({ moq: val });
                }}
                aria-label="Filter by Minimum Order Quantity"
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "8px 12px",
                  fontSize: "0.875rem",
                  border: "1.5px solid #DDE4DC",
                  borderRadius: "6px",
                  backgroundColor: "#FFFCF7",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All MOQ Run Sizes</option>
                <option value="250">Trial Batch (&le; 250 units)</option>
                <option value="500">Standard Batch (&le; 500 units)</option>
                <option value="1000">Volume Run (1,000+ units)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Results Container */}
      <div className={styles.contentContainer} style={{ marginBottom: "64px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <span style={{ fontSize: "0.875rem", color: "#65746D", fontWeight: 500 }}><StorefrontText id="copy_d604310a789a1848" fallback="Showing" /> {filteredVariants.length}<StorefrontText id="copy_71669691cb0b0f1b" fallback="packaging" /> {filteredVariants.length === 1 ? "format" : "formats"}
          </span>
          {(category !== "all" || capacity !== "all" || material !== "all" || moq !== "all" || search.trim()) && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: "none",
                border: "none",
                color: "#B36B3D",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            ><StorefrontText id="copy_660f3d76f4f2802d" fallback="Reset Filters" />
            </button>
          )}
        </div>

        {filteredVariants.length > 0 ? (
          <div className={styles.catalogueGrid}>
            {filteredVariants.map((variant) => (
              <PackagingCard key={variant.id || variant.slug} variant={variant} />
            ))}
          </div>
        ) : (
          <EmptyCatalogueState onReset={handleResetFilters} />
        )}
      </div>
    </div>
  );
}
