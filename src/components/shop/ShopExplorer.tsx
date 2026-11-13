"use client";

import { useDisplayMoney } from "@/components/international/InternationalProvider";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { trackSearch } from "@/lib/seo/tracking";
import type { Product } from "@/lib/products";
import type { Slider } from "@/lib/storefront";
import type { ShopFilterState, SortOption, ViewMode, ActiveFilterChip } from "./types";
import { ShopProductCard } from "./ShopProductCard";
import { ShopDossierView } from "./ShopDossierView";
import { ShopQuickViewModal } from "./ShopQuickViewModal";
import { ShopMobileFilterDrawer } from "./ShopMobileFilterDrawer";
import { ShopEmptyState } from "./ShopEmptyState";
import { HomeHero } from "@/components/home/HomeHero";
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  TableProperties,
  ChevronDown,
} from "lucide-react";

export interface ShopExplorerProps {
  initialProducts: Product[];
  categories: { id: number; slug: string; name: string; cover_image_url?: string | null; description?: string | null }[];
  shopSliders?: Slider[];
  initialParams?: {
    q?: string;
    category?: string;
    categoryId?: string;
    region?: string;
    flush?: string;
    flavor?: string;
    elevation?: string;
    featured?: string;
    sort?: string;
    view?: string;
  };
}

export function ShopExplorer({
  initialProducts,
  categories,
  shopSliders = [],
  initialParams = {},
}: ShopExplorerProps) {
  const formatMoney = useDisplayMoney();

  // Normalize initial category
  let initCat = initialParams.category || "";
  if (!initCat && initialParams.categoryId) {
    const found = categories.find((c) => String(c.id) === initialParams.categoryId);
    if (found) initCat = found.slug;
  }

  const [filters, setFilters] = useState<ShopFilterState>({
    q: initialParams.q || "",
    category: initCat,
    region: initialParams.region || "",
    flush: initialParams.flush || "",
    flavor: initialParams.flavor || "",
    elevation: initialParams.elevation || "",
    featuredOnly:
      initialParams.featured === "1" ||
      initialParams.featured === "true" ||
      initialParams.featured === "yes",
    inStockOnly: false,
    priceRange: "",
    sortBy: (initialParams.sort as SortOption) || "featured",
    viewMode: (initialParams.view as ViewMode) || "grid",
  });

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Available facet options derived from products
  const regionOptions = useMemo(() => [
    "Darjeeling",
    "Assam",
    "Kangra Valley",
    "Nilgiri",
    "Kurseong & Mirik",
  ], []);

  const flushOptions = useMemo(() => [
    "First Flush / Spring",
    "Second Flush / Summer",
    "Autumnal",
    "Seasonal & Specialty",
  ], []);

  const flavorOptions = useMemo(() => [
    "Floral",
    "Fruity",
    "Malty",
    "Full-Bodied",
    "Sweet",
    "Earthy & Woody",
  ], []);

  const elevationOptions = useMemo(() => [
    { id: "high", label: "High Alpine (>4,500 ft)" },
    { id: "mid", label: "Mid Mountain (1,000 – 4,500 ft)" },
    { id: "valley", label: "Valley Terroir (<1,000 ft)" },
  ], []);

  useEffect(() => {
    const timer = setTimeout(() => { trackSearch(filters.q); }, 800);
    return () => clearTimeout(timer);
  }, [filters.q]);

  // Update a single filter field
  const handleFilterChange = useCallback(
    <K extends keyof ShopFilterState>(key: K, value: ShopFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setFilters({
      q: "",
      category: "",
      region: "",
      flush: "",
      flavor: "",
      elevation: "",
      featuredOnly: false,
      inStockOnly: false,
      sortBy: "featured",
      viewMode: filters.viewMode,
    });
  }, [filters.viewMode]);

  // Synchronize filters with URL history (replaceState) for bookmarking without reloads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.region) params.set("region", filters.region);
    if (filters.flush) params.set("flush", filters.flush);
    if (filters.flavor) params.set("flavor", filters.flavor);
    if (filters.elevation) params.set("elevation", filters.elevation);
    if (filters.featuredOnly) params.set("featured", "1");
    if (filters.sortBy !== "featured") params.set("sort", filters.sortBy);
    if (filters.viewMode !== "grid") params.set("view", filters.viewMode);

    const queryString = params.toString();
    const newUrl = queryString ? `/shop?${queryString}` : "/shop";
    window.history.replaceState(null, "", newUrl);
  }, [filters]);

  // Execute multifaceted filtering & sorting
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      // 1. Text Search (Name, Origin, Estate, Tasting Notes, Cultivar, Aroma Tags)
      if (filters.q.trim()) {
        const query = filters.q.toLowerCase().trim();
        const tags = (product.aroma_tags || []).join(" ").toLowerCase();
        const matches =
          (product.name ?? "").toLowerCase().includes(query) ||
          (product.origin ?? "").toLowerCase().includes(query) ||
          (product.estate ?? "").toLowerCase().includes(query) ||
          (product.tasting_notes ?? "").toLowerCase().includes(query) ||
          (product.cultivar ?? "").toLowerCase().includes(query) ||
          tags.includes(query);
        if (!matches) return false;
      }

      // 2. Category
      if (filters.category) {
        const target = filters.category.toLowerCase().replace(/-tea$/, "").replace(/[^a-z]/g, "");
        const prodCat = (product.category ?? "").toLowerCase().replace(/-tea$/, "").replace(/[^a-z]/g, "");
        const matchesCategory =
          prodCat === target ||
          prodCat.includes(target) ||
          target.includes(prodCat) ||
          categories.some(
            (c) =>
              c.id === product.category_id &&
              (c.slug ?? "").toLowerCase().replace(/-tea$/, "").replace(/[^a-z]/g, "") === target
          );
        if (!matchesCategory) return false;
      }

      // 3. Region / Terroir
      if (filters.region) {
        const reg = filters.region.toLowerCase();
        const orig = (product.origin ?? "").toLowerCase();
        const est = (product.estate ?? "").toLowerCase();
        if (reg === "darjeeling") {
          if (!orig.includes("darjeeling") && !est.includes("darjeeling"))
            return false;
        } else if (reg === "assam") {
          if (!orig.includes("assam")) return false;
        } else if (reg === "kangra valley") {
          if (!orig.includes("kangra")) return false;
        } else if (reg === "nilgiri") {
          if (!orig.includes("nilgiri")) return false;
        } else if (reg === "kurseong & mirik") {
          if (!orig.includes("kurseong") && !orig.includes("mirik")) return false;
        }
      }

      // 4. Harvest Flush
      if (filters.flush) {
        const fl = filters.flush.toLowerCase();
        const pFlush = (product.flush ?? "").toLowerCase();
        if (fl.includes("first") || fl.includes("spring")) {
          if (!pFlush.includes("first") && !pFlush.includes("spring")) return false;
        } else if (fl.includes("second") || fl.includes("summer")) {
          if (!pFlush.includes("second") && !pFlush.includes("summer")) return false;
        } else if (fl.includes("autumn")) {
          if (!pFlush.includes("autumn")) return false;
        } else if (fl.includes("seasonal")) {
          if (
            !pFlush.includes("seasonal") &&
            !pFlush.includes("assorted") &&
            !pFlush.includes("applicable")
          ) {
            return false;
          }
        }
      }

      // 5. Sensory / Flavor Profile
      if (filters.flavor) {
        const flv = filters.flavor.toLowerCase();
        if (flv === "floral" && (product.floral ?? 0) < 3) return false;
        if (flv === "fruity" && (product.fruity ?? 0) < 3) return false;
        if (flv === "malty" && (product.malty ?? 0) < 3) return false;
        if (flv === "full-bodied" && (product.body ?? 0) < 3) return false;
        if (flv === "sweet" && (product.sweetness ?? 0) < 3) return false;
        if (flv.includes("earthy") && (product.earthy ?? 0) < 3) return false;
      }

      // 6. Elevation Tier
      if (filters.elevation) {
        const alt = product.elevation_feet ?? 0;
        if (filters.elevation === "high" && alt < 4500) return false;
        if (filters.elevation === "mid" && (alt < 1000 || alt >= 4500)) return false;
        if (filters.elevation === "valley" && alt >= 1000) return false;
      }

      // 7. Featured / Reserve
      if (filters.featuredOnly && product.featured !== 1) return false;

      // 8. In Stock Only
      if (
        filters.inStockOnly &&
        !product.variants.some((v) => v.stock > 0)
      ) {
        return false;
      }

      // 9. Price Range filter
      if (filters.priceRange) {
        const minPrice = product.variants[0]?.price_paise ?? 0;
        if (filters.priceRange === "under700" && minPrice >= 70000) return false;
        if (filters.priceRange === "700to1000" && (minPrice < 70000 || minPrice > 100000)) return false;
        if (filters.priceRange === "above1000" && minPrice <= 100000) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sorting
      switch (filters.sortBy) {
        case "price_asc": {
          const priceA = a.variants[0]?.price_paise ?? 0;
          const priceB = b.variants[0]?.price_paise ?? 0;
          return priceA - priceB;
        }
        case "price_desc": {
          const priceA = a.variants[0]?.price_paise ?? 0;
          const priceB = b.variants[0]?.price_paise ?? 0;
          return priceB - priceA;
        }
        case "elevation_desc":
          return (b.elevation_feet ?? 0) - (a.elevation_feet ?? 0);
        case "temp_asc":
          return a.brew_temp - b.brew_temp;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "featured":
        default: {
          return (b.featured ?? 0) - (a.featured ?? 0) || a.id - b.id;
        }
      }
    });
  }, [initialProducts, filters, categories]);


  // Build active filter chips list
  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (filters.q) {
      chips.push({
        id: "q",
        label: "Search",
        value: `"${filters.q}"`,
        onRemove: () => handleFilterChange("q", ""),
      });
    }
    if (filters.category) {
      const catFilter = filters.category.toLowerCase();
      const catObj = categories.find(
        (c) =>
          (c.slug ?? "").toLowerCase() === catFilter ||
          (c.name ?? "").toLowerCase() === catFilter
      );
      chips.push({
        id: "category",
        label: "Family",
        value: catObj ? catObj.name : filters.category,
        onRemove: () => handleFilterChange("category", ""),
      });
    }
    if (filters.region) {
      chips.push({
        id: "region",
        label: "Terroir",
        value: filters.region,
        onRemove: () => handleFilterChange("region", ""),
      });
    }
    if (filters.flush) {
      chips.push({
        id: "flush",
        label: "Flush",
        value: filters.flush,
        onRemove: () => handleFilterChange("flush", ""),
      });
    }
    if (filters.flavor) {
      chips.push({
        id: "flavor",
        label: "Sensory",
        value: filters.flavor,
        onRemove: () => handleFilterChange("flavor", ""),
      });
    }
    if (filters.elevation) {
      const found = elevationOptions.find((e) => e.id === filters.elevation);
      chips.push({
        id: "elevation",
        label: "Altitude",
        value: found ? found.label.split("(")[0].trim() : filters.elevation,
        onRemove: () => handleFilterChange("elevation", ""),
      });
    }
    if (filters.featuredOnly) {
      chips.push({
        id: "featured",
        label: "Reserve",
        value: "Featured Lots",
        onRemove: () => handleFilterChange("featuredOnly", false),
      });
    }
    if (filters.inStockOnly) {
      chips.push({
        id: "stock",
        label: "Availability",
        value: "In Stock Only",
        onRemove: () => handleFilterChange("inStockOnly", false),
      });
    }
    return chips;
  }, [filters, categories, elevationOptions, handleFilterChange]);

  const hasActiveFilters = activeChips.length > 0;

  const categoryCapsules = useMemo(() => {
    const items: Array<{
      id: string | number;
      name: string;
      slug: string;
      count: number;
      thumb: string;
      isAll?: boolean;
      isRare?: boolean;
    }> = [
      {
        id: "all",
        name: "All Teas",
        slug: "",
        count: initialProducts.length,
        thumb: "/uploads/cat-black-tea.jpg",
        isAll: true,
      },
    ];

    const seenRoots = new Set<string>();
    for (const cat of categories) {
      const catSlug = cat.slug ?? "";
      const catName = cat.name ?? "";
      const root = catSlug.toLowerCase().replace(/-tea$/, "");
      if (seenRoots.has(root)) continue;
      seenRoots.add(root);

      const count = initialProducts.filter((p) => {
        const prodCat = (p.category ?? "").toLowerCase();
        const prodRoot = prodCat.replace(/-tea$/, "");
        return (
          p.category_id === cat.id ||
          prodRoot === root ||
          prodCat === catName.toLowerCase()
        );
      }).length;

      if (count > 0) {
        items.push({
          id: cat.id,
          name: catName.toLowerCase().endsWith("tea") ? catName : `${catName} Tea`,
          slug: catSlug,
          count,
          thumb: cat.cover_image_url || "/uploads/cat-green-tea.jpg",
        });
      }
    }

    const featuredCount = initialProducts.filter((p) => p.featured === 1).length;
    if (featuredCount > 0) {
      items.push({
        id: "rare",
        name: "Rare & Limited",
        slug: "rare",
        count: featuredCount,
        thumb: "/uploads/cat-oolong-tea.jpg",
        isRare: true,
      });
    }

    return items;
  }, [categories, initialProducts]);

  // Helper: Normalize slug or name for comparison (strips spaces, hyphens, pluses, "tea" suffix)
  const normalizeSlugOrName = (val?: string | null): string => {
    if (!val) return "";
    return val
      .toLowerCase()
      .replace(/\+/g, " ")
      .replace(/-tea$/, "")
      .replace(/\s+tea$/, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const currentCategoryObj = useMemo(() => {
    if (filters.featuredOnly) {
      return {
        id: -1,
        slug: "rare",
        name: "Reserve Lots & Limited Flushes",
        cover_image_url: "/uploads/cat-oolong-tea.jpg",
        description:
          "Exclusively numbered micro-lots, competition trophy flushes, and rare heritage cultivars graded and certified by master estate cuppers.",
      };
    }
    const cat = filters.category?.trim();
    if (!cat) return null;
    const norm = normalizeSlugOrName(cat);
    return (
      categories.find(
        (c) =>
          normalizeSlugOrName(c.slug) === norm ||
          normalizeSlugOrName(c.name) === norm
      ) || null
    );
  }, [categories, filters.category, filters.featuredOnly]);

  // Dynamically resolve sliders targeting this shop view or active category filter
  const activeHeroSliders = useMemo(() => {
    if (!shopSliders || shopSliders.length === 0) return undefined;
    const rawCat = filters.featuredOnly ? "rare" : filters.category;
    const activeNorm = normalizeSlugOrName(rawCat);

    if (activeNorm) {
      // 1. Check if there are sliders specifically targeted to this category
      const catSpecific = shopSliders.filter(
        (s) => s.category_slug && normalizeSlugOrName(s.category_slug) === activeNorm
      );
      if (catSpecific.length > 0) return catSpecific;

      // 2. If the category has a cover_image_url set (via Admin > Categories or MCP),
      // return undefined so HomeHero renders the Category Hero with that cover image!
      if (currentCategoryObj?.cover_image_url) {
        return undefined;
      }
    }

    // 3. Fall back to general shop sliders (category_slug is empty or 'all')
    const general = shopSliders.filter(
      (s) => !s.category_slug || s.category_slug === "" || s.category_slug === "all"
    );
    return general.length > 0 ? general : shopSliders;
  }, [shopSliders, filters.category, filters.featuredOnly, currentCategoryObj]);

  return (
    <div className="shop-explorer">
      {/* Dynamic Hero Showcase matching admin sliders or fallback category state */}
      <HomeHero
        sliders={activeHeroSliders}
        slider={activeHeroSliders?.[0] || null}
        category={filters.featuredOnly ? "rare" : (currentCategoryObj?.slug || filters.category)}
        categoryCoverImage={currentCategoryObj?.cover_image_url || null}
        categoryTitle={
          currentCategoryObj
            ? `Single-Estate ${currentCategoryObj.name} Flushes & Mountain Terroirs.`
            : null
        }
        categoryDescription={currentCategoryObj?.description || null}
      />

      <div className="container tf-shop-catalog-container">
        {/* 1. Category Quick-Select Strip / Ribbon */}
        <section
          className="shop-category-ribbon tf-categories-capsule-strip"
          aria-label="Tea families collection filter"
        >
          <div className="tf-category-capsules-scroll">
            {categoryCapsules.map((cat) => {
              const isSelected = cat.isAll
                ? !filters.category && !filters.featuredOnly
                : cat.isRare
                ? filters.featuredOnly
                : (filters.category ?? "").toLowerCase().replace(/-tea$/, "") ===
                  (cat.slug ?? "").toLowerCase().replace(/-tea$/, "");

              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`tf-category-capsule-pill ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    if (cat.isAll) {
                      handleFilterChange("category", "");
                      handleFilterChange("featuredOnly", false);
                    } else if (cat.isRare) {
                      handleFilterChange("featuredOnly", !filters.featuredOnly);
                      handleFilterChange("category", "");
                    } else {
                      handleFilterChange("featuredOnly", false);
                      handleFilterChange("category", isSelected ? "" : cat.slug);
                    }
                  }}
                >
                  <div className="tf-capsule-thumb-wrap">
                    <Image
                      src={cat.thumb}
                      alt=""
                      aria-hidden="true"
                      width={32}
                      height={32}
                      sizes="32px"
                      loading="lazy"
                      className="tf-capsule-thumb-img"
                    />
                  </div>
                  <span className="tf-capsule-label">
                    {cat.name}
                    {cat.count ? <small className="tf-capsule-count">({cat.count})</small> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

      {/* 2. Main Controls Bar: Search, Facets, Sort, View Toggle */}
      <div className="shop-control-bar tf-shop-toolbar">
        {/* Search Field */}
        <div className="shop-search-field tf-toolbar-search">
          <label htmlFor="shop-search-input" className="sr-only"> <StorefrontText id="copy_2fcd3b400e4fce99" fallback="Search single-estate teas, gardens, or aromas" /> </label>
          <div className="shop-search-input-wrap">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              id="shop-search-input"
              type="search"
              value={filters.q}
              onChange={(e) => handleFilterChange("q", e.target.value)}
              placeholder="Search by garden, region or flavour…"
              maxLength={100}
              autoComplete="off"
              className="shop-search-input"
            />
            {filters.q && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => handleFilterChange("q", "")}
                aria-label="Clear search input"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Quick Dropdowns matching mockup */}
        <div className="shop-desktop-facets tf-toolbar-dropdowns">
          {/* Garden / Estate */}
          <div className="facet-select-wrap">
            <label htmlFor="facet-region" className="sr-only"> <StorefrontText id="copy_501e3a339233e3b4" fallback="Filter by Garden or Estate" /> </label>
            <select
              id="facet-region"
              value={filters.region}
              onChange={(e) => handleFilterChange("region", e.target.value)}
              className="facet-select"
            >
              <option value="">Garden / Estate</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>

          {/* Flush Season */}
          <div className="facet-select-wrap">
            <label htmlFor="facet-flush" className="sr-only"> <StorefrontText id="copy_77f298d91ee996b5" fallback="Filter by Flush Season" /> </label>
            <select
              id="facet-flush"
              value={filters.flush}
              onChange={(e) => handleFilterChange("flush", e.target.value)}
              className="facet-select"
            >
              <option value="">Flush Season</option>
              {flushOptions.map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>

          {/* Tea Type */}
          <div className="facet-select-wrap">
            <label htmlFor="facet-tea-type" className="sr-only"> <StorefrontText id="copy_1ce7d0b0ac268663" fallback="Filter by Tea Type" /> </label>
            <select
              id="facet-tea-type"
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="facet-select"
            >
              <option value="">Tea Type</option>
              <option value="black">Black Tea</option>
              <option value="green">Green Tea</option>
              <option value="oolong">Oolong Tea</option>
              <option value="white">White Tea</option>
              <option value="chai">Herbal / Chai</option>
              <option value="gifts">Tea Samplers</option>
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>

          {/* Price Range */}
          <div className="facet-select-wrap">
            <label htmlFor="facet-price-range" className="sr-only"> <StorefrontText id="copy_2f100e29c643ec2a" fallback="Filter by Price Range" /> </label>
            <select
              id="facet-price-range"
              value={filters.priceRange || ""}
              onChange={(e) => handleFilterChange("priceRange", e.target.value)}
              className="facet-select"
            >
              <option value="">Price Range</option>
              <option value="under700">Under {formatMoney(70000)}</option>
              <option value="700to1000">{formatMoney(70000)} – {formatMoney(100000)}</option>
              <option value="above1000">Above {formatMoney(100000)}</option>
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>
        </div>

        {/* Right Section: Mobile Trigger, Sort Dropdown & View Mode Switcher */}
        <div className="shop-view-sort-group tf-toolbar-right">
          {/* Mobile Filter Trigger Button */}
          <button
            type="button"
            className="shop-mobile-drawer-btn"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label={`Open filter drawer. ${activeChips.length} filters active.`}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span> <StorefrontText id="copy_546ebb8eb993ea56" fallback="Filters" /> </span>
            {activeChips.length > 0 && (
              <span className="drawer-count-badge">{activeChips.length}</span>
            )}
          </button>

          {/* Sort Selector */}
          <div className="facet-select-wrap sort-select-wrap">
            <label htmlFor="shop-sort-select" className="sr-only"> <StorefrontText id="copy_75807641cf071a6c" fallback="Sort catalogue" /> </label>
            <select
              id="shop-sort-select"
              value={filters.sortBy}
              onChange={(e) =>
                handleFilterChange("sortBy", e.target.value as SortOption)
              }
              className="facet-select"
            >
              <option value="featured">Sort by</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="elevation_desc">Elevation: Alpine First</option>
              <option value="temp_asc">Brew Temp: Gentle First</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>

          {/* Dual View Mode Buttons */}
          <div
            className="shop-view-toggle tf-toolbar-view-toggle"
            role="group"
            aria-label="Catalogue view options"
          >
            <button
              type="button"
              className={`view-btn ${filters.viewMode === "grid" ? "active" : ""}`}
              onClick={() => handleFilterChange("viewMode", "grid")}
              aria-label="Grid view with tasting notes and cards"
              aria-pressed={filters.viewMode === "grid"}
              title="Grid card view"
            >
              <LayoutGrid size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`view-btn ${filters.viewMode === "dossier" ? "active" : ""}`}
              onClick={() => handleFilterChange("viewMode", "dossier")}
              aria-label="Connoisseur tasting table and comparative dossier"
              aria-pressed={filters.viewMode === "dossier"}
              title="Tasting table dossier view"
            >
              <TableProperties size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Status Bar: Showing X of Y Teas & Clear All */}
      <div className="shop-status-row tf-toolbar-status-row">
        <p
          className="results-count tf-mockup-results-count"
          role="status"
          aria-live="polite"
        > <StorefrontText id="copy_d604310a789a1848" fallback="Showing" /> {filteredProducts.length > 0 ? "1–" + Math.min(filteredProducts.length, 12) : "0"} of{" "}
          {initialProducts.length} <StorefrontText id="copy_ddb7a7558a670fb0" fallback="teas" /> </p>

        <div className="tf-status-right-wrap">
          {hasActiveFilters && (
            <div className="shop-active-chips" aria-label="Currently active filters">
              {activeChips.map((chip) => (
                <span key={chip.id} className="active-chip">
                  <span className="chip-label">{chip.label}:</span>
                  <strong className="chip-value">{chip.value}</strong>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="chip-remove"
                    aria-label={`Remove filter for ${chip.label} ${chip.value}`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className={`clear-all-chips-btn tf-clear-all-link ${hasActiveFilters ? "active" : ""}`}
          > <StorefrontText id="copy_ddceb7adfdb8816e" fallback="Clear All" /> </button>

          <a
            href="/brochure"
            className="tf-brochure-link text-xs font-semibold text-[#23483a] hover:underline inline-flex items-center gap-1 ml-2"
            title="Download complete harvest & sourcing brochure catalogue (PDF)"
          >
            <span>📄</span>
            <span><StorefrontText id="copy_shop_download_brochure" fallback="Download Catalogue (PDF)" /></span>
          </a>
        </div>
      </div>

      {/* 4. Catalogue Display: Grid or Comparative Dossier Table */}
      {filteredProducts.length > 0 ? (
        filters.viewMode === "grid" ? (
          <div className="product-grid shop-product-grid">
            {filteredProducts.map((product, index) => (
              <ShopProductCard
                key={product.id}
                product={product}
                index={index}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            ))}
          </div>
        ) : (
          <ShopDossierView
            products={filteredProducts}
            onQuickView={(p) => setQuickViewProduct(p)}
          />
        )
      ) : (
        <ShopEmptyState
          onReset={handleResetFilters}
          onSelectSuggestion={(q) => handleFilterChange("q", q)}
        />
      )}
      </div>

      {/* 5. Mobile Filter Drawer (Slide-Over Sheet) */}
      <ShopMobileFilterDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        matchingCount={filteredProducts.length}
        categories={categories}
        regions={regionOptions}
        flushes={flushOptions}
        flavors={flavorOptions}
        elevations={elevationOptions}
      />

      {/* 6. Quick View Cupping Sheet Modal */}
      <ShopQuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
}
