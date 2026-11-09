"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  Plus,
  FolderTree,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  X,
  Layers,
  GitFork,
  Package,
  ExternalLink,
  Copy,
  Check,
  List,
  Network,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";

export interface CategoryItem {
  id: number;
  slug: string;
  name: string;
  description?: string;
  cover_image_url?: string | null;
  parent_id?: number | null;
  parent_name?: string | null;
  sort_order: number;
  is_active: number;
  product_count?: number;
  subcategory_count?: number;
  created_at?: string;
}

type ViewMode = "tree" | "table";
type StatusFilter = "all" | "active" | "hidden";
type HierarchyFilter = "all" | "top_level" | "subcategories";
type SortOption = "order_asc" | "name_asc" | "name_desc" | "products_desc";

export default function AdminCategoriesPage() {
  return (
    <AdminAuthGate>
      <CategoriesListContent />
    </AdminAuthGate>
  );
}

function CategoriesListContent() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & View State
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("order_asc");

  // Interactive UI states
  const [copiedSlugId, setCopiedSlugId] = useState<number | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const loadCategories = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/categories?limit=150", { credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { categories?: CategoryItem[] };
        setCategories(data.categories || []);
      } else {
        setErrorMessage("Failed to load categories. Please check connection and retry.");
      }
    } catch {
      setErrorMessage("Network error loading categories.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  // Keyboard shortcut: Press '/' to focus search, 'Escape' to clear
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Quick Inline Status Toggle with optimistic UI
  async function handleToggleStatus(category: CategoryItem) {
    const nextStatus = category.is_active === 1 ? 0 : 1;
    setTogglingStatusId(category.id);

    // Optimistic update
    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, is_active: nextStatus } : c))
    );

    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      if (!res.ok) {
        // Rollback
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, is_active: category.is_active } : c))
        );
        showToast(`Failed to update ${category.name} status.`);
      } else {
        showToast(`${category.name} is now ${nextStatus === 1 ? "Active on Storefront" : "Hidden"}.`);
      }
    } catch {
      // Rollback
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, is_active: category.is_active } : c))
      );
      showToast(`Network error updating ${category.name}.`);
    } finally {
      setTogglingStatusId(null);
    }
  }

  // Copy slug helper
  async function handleCopySlug(c: CategoryItem) {
    try {
      await navigator.clipboard.writeText(c.slug);
      setCopiedSlugId(c.id);
      showToast(`Copied slug "${c.slug}" to clipboard`);
      setTimeout(() => setCopiedSlugId(null), 2000);
    } catch {
      // Best-effort
    }
  }

  // Statistics calculation
  const stats = useMemo(() => {
    const total = categories.length;
    const topLevel = categories.filter((c) => !c.parent_id).length;
    const subcategories = categories.filter((c) => !!c.parent_id).length;
    const active = categories.filter((c) => c.is_active === 1).length;
    const totalProducts = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);
    return { total, topLevel, subcategories, active, totalProducts };
  }, [categories]);

  // Filtering & Sorting
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories.filter((c) => {
      // Text search
      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesSlug = c.slug.toLowerCase().includes(q);
        const matchesParent = c.parent_name?.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesParent && !matchesDesc) return false;
      }

      // Status filter
      if (statusFilter === "active" && c.is_active !== 1) return false;
      if (statusFilter === "hidden" && c.is_active === 1) return false;

      // Hierarchy filter
      if (hierarchyFilter === "top_level" && c.parent_id) return false;
      if (hierarchyFilter === "subcategories" && !c.parent_id) return false;

      return true;
    });
  }, [categories, searchQuery, statusFilter, hierarchyFilter]);

  const sortedCategories = useMemo(() => {
    const list = [...filteredCategories];
    switch (sortOption) {
      case "name_asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "name_desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "products_desc":
        return list.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
      case "order_asc":
      default:
        return list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }
  }, [filteredCategories, sortOption]);

  // Tree representation grouping: Top-level categories with nested children
  const treeGroups = useMemo(() => {
    const parentMap = new Map<number, CategoryItem[]>();
    const topLevel: CategoryItem[] = [];
    const orphanSubcategories: CategoryItem[] = [];

    // Map parent IDs
    for (const c of sortedCategories) {
      if (!c.parent_id) {
        topLevel.push(c);
      } else {
        const list = parentMap.get(c.parent_id) || [];
        list.push(c);
        parentMap.set(c.parent_id, list);
      }
    }

    // Check for subcategories whose parents might be filtered out or missing
    for (const c of sortedCategories) {
      if (c.parent_id && !categories.some((p) => p.id === c.parent_id)) {
        orphanSubcategories.push(c);
      }
    }

    return { topLevel, parentMap, orphanSubcategories };
  }, [sortedCategories, categories]);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || hierarchyFilter !== "all";

  function clearAllFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setHierarchyFilter("all");
    setSortOption("order_asc");
    searchInputRef.current?.focus();
  }

  return (
    <div className="admin-categories-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: "#1d2a24",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <CheckCircle2 size={16} color="#85e89d" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <nav aria-label="Breadcrumb" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#697a55" }}>
              Storefront &amp; Catalog
            </span>
          </nav>
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: "clamp(24px, 3vw, 32px)",
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              letterSpacing: "-0.02em",
            }}
          >
            Categories &amp; Taxonomy
          </h1>
          <p style={{ margin: 0, color: "#5d6056", fontSize: 14, maxWidth: 640 }}>
            Organize single-estate harvests into parent tea families, maintain storefront cover artwork, and customize display ordering.
          </p>
        </div>

        {/* Primary Header Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              borderColor: "#c7c1b5",
              background: "#ffffff",
            }}
            title="Preview storefront catalog in new tab"
          >
            <ExternalLink size={14} />
            <span>Store Preview</span>
          </a>

          <button
            type="button"
            onClick={() => void loadCategories(true)}
            disabled={isRefreshing}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              borderColor: "#c7c1b5",
              background: "#ffffff",
            }}
            aria-label="Refresh category list"
          >
            <RefreshCw size={14} className={isRefreshing ? "spin-animation" : ""} />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/categories/new"
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              fontSize: 13,
              background: "#1d2a24",
              color: "#ffffff",
              boxShadow: "0 2px 6px rgba(29, 42, 36, 0.2)",
            }}
          >
            <Plus size={16} />
            <span>New Category</span>
          </Link>
        </div>
      </header>

      {/* KPI Metric Summary Cards */}
      <section
        aria-label="Category Overview Statistics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(35, 72, 58, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#23483a",
            }}
          >
            <FolderTree size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Total Categories
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(179, 145, 86, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8a6625",
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Parent Families
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.topLevel}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(105, 122, 85, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a5938",
            }}
          >
            <GitFork size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Subcategories
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.subcategories}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(46, 125, 50, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2e7d32",
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Storefront Active
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.active} <span style={{ fontSize: 12, fontWeight: 400, color: "#6a6e64" }}>/ {stats.total}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(179, 107, 61, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b36b3d",
            }}
          >
            <Package size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Catalog Products
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.totalProducts}
            </div>
          </div>
        </div>
      </section>

      {/* Filter, Search & View Controls Toolbar */}
      <section
        aria-label="Filter and View Controls"
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: "16px",
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#7e8278",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category name, slug, parent... (Press '/' to focus)"
              aria-label="Search categories"
              style={{
                width: "100%",
                padding: "9px 36px 9px 36px",
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                fontSize: 13,
                background: "#faf7f2",
                minHeight: 40,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: 0,
                  padding: 4,
                  cursor: "pointer",
                  color: "#6a6e64",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Tree vs Table */}
          <div
            role="group"
            aria-label="Category Layout View"
            style={{
              display: "inline-flex",
              border: "1px solid #c9c2b6",
              borderRadius: 6,
              background: "#ede9df",
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              aria-pressed={viewMode === "tree"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: 0,
                borderRadius: 4,
                background: viewMode === "tree" ? "#ffffff" : "transparent",
                color: viewMode === "tree" ? "#1d2a24" : "#6a6e64",
                boxShadow: viewMode === "tree" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              <Network size={14} />
              <span>Tree View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: 0,
                borderRadius: 4,
                background: viewMode === "table" ? "#ffffff" : "transparent",
                color: viewMode === "table" ? "#1d2a24" : "#6a6e64",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              <List size={14} />
              <span>Table View</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Sorting Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Status Filter */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Filter by storefront status"
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  border: "1px solid #c9c2b6",
                  borderRadius: 4,
                  background: "#ffffff",
                  minHeight: 32,
                }}
              >
                <option value="all">All ({categories.length})</option>
                <option value="active">Active Only ({stats.active})</option>
                <option value="hidden">Hidden Only ({stats.total - stats.active})</option>
              </select>
            </div>

            {/* Hierarchy Filter */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Hierarchy:</span>
              <select
                value={hierarchyFilter}
                onChange={(e) => setHierarchyFilter(e.target.value as HierarchyFilter)}
                aria-label="Filter by hierarchy level"
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  border: "1px solid #c9c2b6",
                  borderRadius: 4,
                  background: "#ffffff",
                  minHeight: 32,
                }}
              >
                <option value="all">All Hierarchies</option>
                <option value="top_level">Top-Level Parents ({stats.topLevel})</option>
                <option value="subcategories">Subcategories ({stats.subcategories})</option>
              </select>
            </div>

            {/* Reset Filters button if active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="button button-outline"
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  minHeight: 32,
                  color: "#b36b3d",
                  borderColor: "#d9c3b0",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <X size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowUpDown size={14} color="#6a6e64" />
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Sort By:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort categories"
              style={{
                padding: "5px 10px",
                fontSize: 12,
                border: "1px solid #c9c2b6",
                borderRadius: 4,
                background: "#ffffff",
                minHeight: 32,
              }}
            >
              <option value="order_asc">Display Order (#Sort)</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="products_desc">Products Count (High → Low)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            background: "#fdf3f2",
            border: "1px solid #f2c7c5",
            borderRadius: 8,
            padding: "14px 18px",
            color: "#8f2f2a",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={20} />
          <div style={{ flex: 1, fontSize: 13 }}>{errorMessage}</div>
          <button
            type="button"
            onClick={() => void loadCategories()}
            className="button button-outline"
            style={{ fontSize: 12, padding: "4px 10px", minHeight: 32, color: "#8f2f2a" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        /* Skeleton Shimmer Loading State */
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
          }}
          aria-busy="true"
          aria-label="Loading categories"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: 54,
                  background: "#ede9df",
                  borderRadius: 6,
                  opacity: 0.6,
                  animation: "pulse 1.5s infinite ease-in-out",
                }}
              />
            ))}
          </div>
        </div>
      ) : categories.length === 0 ? (
        /* Zero Categories in Store */
        <div
          style={{
            padding: 56,
            textAlign: "center",
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#ede9df",
              color: "#697a55",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <FolderTree size={32} />
          </div>
          <h2 style={{ margin: "0 0 8px 0", color: "#1d2a24", fontSize: 20, fontFamily: "Georgia, serif" }}>
            No Categories Configured
          </h2>
          <p style={{ margin: "0 auto 20px auto", color: "#5d6056", fontSize: 14, maxWidth: 440 }}>
            Categories allow tea connoisseurs to filter single-estate flushes by variety (Black, Green, White, Oolong, Chai, Gifts).
          </p>
          <Link href="/admin/categories/new" className="button button-primary">
            <Plus size={16} />
            <span>Create First Category</span>
          </Link>
        </div>
      ) : sortedCategories.length === 0 ? (
        /* Zero matches after filtering */
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
          }}
        >
          <Search size={36} color="#7e8278" style={{ marginBottom: 12 }} />
          <h2 style={{ margin: "0 0 6px 0", color: "#1d2a24", fontSize: 18 }}>No Matching Categories Found</h2>
          <p style={{ margin: "0 0 16px 0", color: "#6a6e64", fontSize: 14 }}>
            No categories match your search &quot;{searchQuery}&quot; with current status filters.
          </p>
          <button type="button" onClick={clearAllFilters} className="button button-outline">
            Clear Search &amp; Filters
          </button>
        </div>
      ) : viewMode === "tree" ? (
        /* ---------------- TREE / HIERARCHY GROUPED VIEW ---------------- */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {treeGroups.topLevel.map((parent) => {
            const children = treeGroups.parentMap.get(parent.id) || [];
            return (
              <div
                key={parent.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #d9d4c8",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {/* Parent Category Header Card */}
                <div
                  style={{
                    padding: "16px 20px",
                    background: "#fbf8f1",
                    borderBottom: children.length > 0 ? "1px solid #ede9df" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260 }}>
                    {/* Cover Artwork Thumbnail */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "#ede9df",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: "1px solid #d9d4c8",
                      }}
                    >
                      {parent.cover_image_url ? (
                        <Image
                          src={parent.cover_image_url}
                          alt={parent.name}
                          width={48}
                          height={48}
                          sizes="48px"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Layers size={22} color="#8c9b88" />
                      )}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Link
                          href={`/admin/categories/${parent.id}`}
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#1d2a24",
                            textDecoration: "none",
                            fontFamily: "Georgia, serif",
                          }}
                        >
                          {parent.name}
                        </Link>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(179, 145, 86, 0.15)",
                            color: "#7e5e1e",
                          }}
                        >
                          Parent Family
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => void handleCopySlug(parent)}
                          title="Click to copy slug"
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "#6a6e64",
                            background: "transparent",
                            border: 0,
                            padding: 0,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>/{parent.slug}</span>
                          {copiedSlugId === parent.id ? <Check size={12} color="#2e7d32" /> : <Copy size={12} />}
                        </button>
                        <span style={{ color: "#d9d4c8" }}>•</span>
                        <span style={{ fontSize: 12, color: "#6a6e64" }}>Sort Order: #{parent.sort_order}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions for Parent */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Products assigned badge */}
                    <Link
                      href={`/admin/products?categoryId=${parent.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        background: "rgba(35, 72, 58, 0.08)",
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#23483a",
                        textDecoration: "none",
                      }}
                      title="View products assigned directly to this category"
                    >
                      <Package size={13} />
                      <span>{parent.product_count ?? 0} Products</span>
                    </Link>

                    {/* Subcategories count badge */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        background: "#ede9df",
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#4a5938",
                      }}
                    >
                      <GitFork size={13} />
                      <span>{children.length} Subcategories</span>
                    </span>

                    {/* Storefront Active Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={parent.is_active === 1}
                      disabled={togglingStatusId === parent.id}
                      onClick={() => void handleToggleStatus(parent)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: 0,
                        background: parent.is_active === 1 ? "rgba(46, 125, 50, 0.1)" : "rgba(143, 47, 42, 0.1)",
                        color: parent.is_active === 1 ? "#2e7d32" : "#8f2f2a",
                      }}
                      title="Toggle storefront visibility"
                    >
                      {parent.is_active === 1 ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      <span>{parent.is_active === 1 ? "Active" : "Hidden"}</span>
                    </button>

                    {/* Quick Add Subcategory */}
                    <Link
                      href={`/admin/categories/new?parent_id=${parent.id}`}
                      className="button button-outline"
                      style={{ padding: "4px 10px", fontSize: 12, minHeight: 32 }}
                      title="Add a subcategory nested under this family"
                    >
                      <Plus size={13} />
                      <span>Add Sub</span>
                    </Link>

                    {/* Actions Menu */}
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <Link
                        href={`/admin/categories/${parent.id}`}
                        className="button button-outline"
                        style={{ padding: "4px 8px", fontSize: 12, minHeight: 32 }}
                        title="View dossier"
                      >
                        <Eye size={13} />
                      </Link>
                      <Link
                        href={`/admin/categories/${parent.id}/edit`}
                        className="button button-outline"
                        style={{ padding: "4px 8px", fontSize: 12, minHeight: 32 }}
                        title="Edit category"
                      >
                        <Edit size={13} />
                      </Link>
                      <Link
                        href={`/admin/categories/${parent.id}/delete`}
                        className="button button-outline"
                        style={{ padding: "4px 8px", fontSize: 12, minHeight: 32, color: "#8f2f2a", borderColor: "#f2c7c5" }}
                        title="Delete category"
                      >
                        <Trash2 size={13} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Subcategories Nested List */}
                {children.length > 0 && (
                  <div style={{ padding: "10px 20px 14px 44px", background: "#ffffff" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {children.map((sub) => (
                        <div
                          key={sub.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: "#faf8f4",
                            border: "1px solid #ede9df",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ color: "#a4a89d", fontSize: 16 }}>↳</span>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 4,
                                overflow: "hidden",
                                background: "#ede9df",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {sub.cover_image_url ? (
                                <Image
                                  src={sub.cover_image_url}
                                  alt={sub.name}
                                  width={32}
                                  height={32}
                                  sizes="32px"
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <FolderTree size={16} color="#8c9b88" />
                              )}
                            </div>
                            <div>
                              <Link
                                href={`/admin/categories/${sub.id}`}
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: "#1d2a24",
                                  textDecoration: "none",
                                }}
                              >
                                {sub.name}
                              </Link>
                              <span style={{ fontSize: 11, color: "#6a6e64", marginLeft: 8, fontFamily: "monospace" }}>
                                /{sub.slug}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {/* Products count badge */}
                            <Link
                              href={`/admin/products?categoryId=${sub.id}`}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#23483a",
                                background: "rgba(35, 72, 58, 0.08)",
                                padding: "3px 8px",
                                borderRadius: 10,
                                textDecoration: "none",
                              }}
                            >
                              {sub.product_count ?? 0} Products
                            </Link>

                            {/* Status switch */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={sub.is_active === 1}
                              disabled={togglingStatusId === sub.id}
                              onClick={() => void handleToggleStatus(sub)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 600,
                                border: 0,
                                cursor: "pointer",
                                background: sub.is_active === 1 ? "rgba(46, 125, 50, 0.1)" : "rgba(143, 47, 42, 0.1)",
                                color: sub.is_active === 1 ? "#2e7d32" : "#8f2f2a",
                              }}
                            >
                              {sub.is_active === 1 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              <span>{sub.is_active === 1 ? "Active" : "Hidden"}</span>
                            </button>

                            {/* Action icons */}
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <Link
                                href={`/admin/categories/${sub.id}`}
                                className="button button-outline"
                                style={{ padding: "2px 6px", fontSize: 11, minHeight: 28 }}
                                title="View details"
                              >
                                <Eye size={12} />
                              </Link>
                              <Link
                                href={`/admin/categories/${sub.id}/edit`}
                                className="button button-outline"
                                style={{ padding: "2px 6px", fontSize: 11, minHeight: 28 }}
                                title="Edit subcategory"
                              >
                                <Edit size={12} />
                              </Link>
                              <Link
                                href={`/admin/categories/${sub.id}/delete`}
                                className="button button-outline"
                                style={{ padding: "2px 6px", fontSize: 11, minHeight: 28, color: "#8f2f2a", borderColor: "#f2c7c5" }}
                                title="Delete subcategory"
                              >
                                <Trash2 size={12} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Any Standalone / Orphan Subcategories */}
          {treeGroups.orphanSubcategories.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #d9d4c8",
                borderRadius: 8,
                padding: "16px 20px",
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1d2a24", margin: "0 0 12px 0" }}>
                Standalone Subcategories
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {treeGroups.orphanSubcategories.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "#faf8f4",
                      border: "1px solid #ede9df",
                    }}
                  >
                    <div>
                      <Link
                        href={`/admin/categories/${sub.id}`}
                        style={{ fontSize: 14, fontWeight: 600, color: "#1d2a24", textDecoration: "none" }}
                      >
                        {sub.name}
                      </Link>
                      <span style={{ fontSize: 12, color: "#6a6e64", marginLeft: 8 }}>
                        (Parent ID #{sub.parent_id})
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Link href={`/admin/categories/${sub.id}/edit`} className="button button-outline" style={{ padding: "3px 8px", fontSize: 11 }}>
                        Reassign Parent
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ---------------- COMPREHENSIVE TABULAR FLAT VIEW ---------------- */
        <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
              <caption style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#1d2a24", background: "#fbf8f1", borderBottom: "1px solid #d9d4c8" }}>
                Categories ({sortedCategories.length} items)
              </caption>
              <thead>
                <tr style={{ background: "#ede9df", borderBottom: "1px solid #d9d4c8" }}>
                  <th scope="col" style={{ width: 64, padding: "10px 12px", textAlign: "left" }}>Cover</th>
                  <th scope="col" style={{ padding: "10px 12px", textAlign: "left" }}>Category Name &amp; Slug</th>
                  <th scope="col" style={{ padding: "10px 12px", textAlign: "left" }}>Hierarchy</th>
                  <th scope="col" style={{ padding: "10px 12px", textAlign: "left" }}>Sort Order</th>
                  <th scope="col" style={{ padding: "10px 12px", textAlign: "left" }}>Products</th>
                  <th scope="col" style={{ padding: "10px 12px", textAlign: "left" }}>Storefront Status</th>
                  <th scope="col" style={{ textAlign: "right", padding: "10px 14px", width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: "1px solid #ede9df",
                      background: "#ffffff",
                    }}
                  >
                    {/* Cover Artwork */}
                    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 6,
                          overflow: "hidden",
                          background: "#ede9df",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #d9d4c8",
                        }}
                      >
                        {c.cover_image_url ? (
                          <Image
                            src={c.cover_image_url}
                            alt={c.name}
                            width={44}
                            height={44}
                            sizes="44px"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <FolderTree size={20} color="#8c9b88" />
                        )}
                      </div>
                    </td>

                    {/* Name & Slug */}
                    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      <Link
                        href={`/admin/categories/${c.id}`}
                        style={{ fontWeight: 600, color: "#1d2a24", textDecoration: "none", fontSize: 14 }}
                      >
                        {c.name}
                      </Link>
                      <div style={{ marginTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => void handleCopySlug(c)}
                          style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            color: "#6a6e64",
                            background: "transparent",
                            border: 0,
                            padding: 0,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Click to copy slug"
                        >
                          <span>/{c.slug}</span>
                          {copiedSlugId === c.id ? <Check size={11} color="#2e7d32" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>

                    {/* Hierarchy */}
                    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      {c.parent_name ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            background: "#ede9df",
                            borderRadius: 4,
                            fontSize: 12,
                            color: "#1d2a24",
                            fontWeight: 500,
                          }}
                        >
                          <span style={{ color: "#6a6e64" }}>Sub of:</span> {c.parent_name}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            background: "rgba(179, 145, 86, 0.12)",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "#7e5e1e",
                          }}
                        >
                          Top-Level
                        </span>
                      )}
                    </td>

                    {/* Sort Order */}
                    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#f4f1ea",
                          color: "#1d2a24",
                        }}
                      >
                        #{c.sort_order}
                      </span>
                    </td>

                    {/* Product count */}
                    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      <Link
                        href={`/admin/products?categoryId=${c.id}`}
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          background: "rgba(35, 72, 58, 0.08)",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#23483a",
                          textDecoration: "none",
                        }}
                        title="Filter products by this category"
                      >
                        {c.product_count ?? 0} assigned
                      </Link>
                    </td>

                    {/* Storefront status toggle */}
                    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={c.is_active === 1}
                        disabled={togglingStatusId === c.id}
                        onClick={() => void handleToggleStatus(c)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          border: 0,
                          cursor: "pointer",
                          background: c.is_active === 1 ? "rgba(46, 125, 50, 0.1)" : "rgba(143, 47, 42, 0.1)",
                          color: c.is_active === 1 ? "#2e7d32" : "#8f2f2a",
                        }}
                        title="Click to toggle status on storefront"
                      >
                        {c.is_active === 1 ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        <span>{c.is_active === 1 ? "Active" : "Hidden"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right", padding: "10px 14px", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <Link
                          href={`/admin/categories/${c.id}`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12, minHeight: 32 }}
                          title="View category details"
                        >
                          <Eye size={13} style={{ marginRight: 4 }} />
                          <span>View</span>
                        </Link>
                        <Link
                          href={`/admin/categories/${c.id}/edit`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12, minHeight: 32 }}
                          title="Edit category"
                        >
                          <Edit size={13} style={{ marginRight: 4 }} />
                          <span>Edit</span>
                        </Link>
                        <Link
                          href={`/admin/categories/${c.id}/delete`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12, minHeight: 32, color: "#8f2f2a", borderColor: "#f2c7c5" }}
                          title="Safe deletion guard screen"
                        >
                          <Trash2 size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Embedded Animation Styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
