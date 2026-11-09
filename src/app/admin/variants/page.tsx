"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { VariantForm } from "@/components/admin/catalog/VariantForm";
import type { PackagingFormat, Variant } from "@/lib/productModels";
import {
  Plus,
  Search,
  Layers,
  Edit,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  X,
} from "lucide-react";

interface ProductInfo {
  id: number;
  name: string;
  slug: string;
  category: string;
  estate?: string;
}

export default function AdminVariantsPage() {
  return (
    <AdminAuthGate>
      <VariantsManagementContent />
    </AdminAuthGate>
  );
}

function VariantsManagementContent() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("sku_asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<Variant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Inline stock adjustment states (optimistic map tracking variantId => loading)
  const [stockUpdatingId, setStockUpdatingId] = useState<number | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ id: string; type: "success" | "error"; message: string } | null>(null);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, type, message });
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load variants and products
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [varRes, prodRes] = await Promise.all([
        fetch("/api/admin/variants", { credentials: "same-origin" }),
        fetch("/api/admin/products?limit=100", { credentials: "same-origin" }),
      ]);

      if (varRes.ok) {
        const varData = (await varRes.json()) as { variants?: Variant[] };
        setVariants(varData.variants || []);
      }
      if (prodRes.ok) {
        const prodData = (await prodRes.json()) as { products?: ProductInfo[] };
        setProducts(prodData.products || []);
      }
    } catch {
      showToast("Could not load variants catalogue. Check your connection.", "error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Copy SKU to clipboard
  const copySkuToClipboard = useCallback((sku: string) => {
    navigator.clipboard?.writeText(sku).then(() => {
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku(null), 1800);
    }).catch(() => {
      // fallback
    });
  }, []);

  // Quick inline stock adjustment
  const handleQuickStockAdjust = useCallback(async (variant: Variant, delta: number) => {
    const newStock = Math.max(0, variant.stock + delta);
    if (newStock === variant.stock) return;

    setStockUpdatingId(variant.id);
    // Optimistic update
    setVariants((prev) =>
      prev.map((v) => (v.id === variant.id ? { ...v, stock: newStock } : v))
    );

    try {
      const res = await fetch(`/api/admin/variants/${variant.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock }),
      });

      if (res.ok) {
        showToast(`Stock updated for ${variant.sku}: ${newStock} units`);
      } else {
        // Rollback
        setVariants((prev) =>
          prev.map((v) => (v.id === variant.id ? { ...v, stock: variant.stock } : v))
        );
        showToast(`Failed to update stock for ${variant.sku}`, "error");
      }
    } catch {
      // Rollback
      setVariants((prev) =>
        prev.map((v) => (v.id === variant.id ? { ...v, stock: variant.stock } : v))
      );
      showToast("Network error while adjusting stock", "error");
    } finally {
      setStockUpdatingId(null);
    }
  }, [showToast]);

  // Execute deletion
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingVariant) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/variants/${deletingVariant.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (res.status === 204 || res.ok) {
        setVariants((prev) => prev.filter((v) => v.id !== deletingVariant.id));
        showToast(`Variant ${deletingVariant.sku} deleted.`);
        setDeletingVariant(null);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error || "Cannot delete variant. It may be referenced by customer orders.");
      }
    } catch {
      setDeleteError("Failed to delete variant due to connection error.");
    } finally {
      setIsDeleting(false);
    }
  }, [deletingVariant, showToast]);

  // Format label & icon helper
  function getFormatBadge(format: PackagingFormat) {
    switch (format) {
      case "luxury_tin":
        return { label: "Luxury Tin", icon: "🥫", bg: "rgba(179, 145, 86, 0.15)", text: "#6d531d" };
      case "pyramid_bags":
        return { label: "Pyramid Bags", icon: "🏷️", bg: "rgba(105, 122, 85, 0.15)", text: "#3d4a2f" };
      case "loose_leaf_pouch":
      default:
        return { label: "Loose Leaf Pouch", icon: "🍃", bg: "rgba(35, 72, 58, 0.1)", text: "#23483a" };
    }
  }

  // Filter & sort logic
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSku = v.sku.toLowerCase().includes(q);
        const matchesName = v.product_name?.toLowerCase().includes(q);
        const matchesEstate = v.product_estate?.toLowerCase().includes(q);
        const matchesWeight = `${v.grams}g`.includes(q);
        if (!matchesSku && !matchesName && !matchesEstate && !matchesWeight) return false;
      }

      // Product filter
      if (selectedProductId !== "all") {
        if (v.product_id !== Number(selectedProductId)) return false;
      }

      // Packaging format filter
      if (selectedFormat !== "all") {
        if (v.packaging_format !== selectedFormat) return false;
      }

      // Stock status filter
      if (selectedStockStatus === "in_stock" && v.stock <= 5) return false;
      if (selectedStockStatus === "low_stock" && (v.stock <= 0 || v.stock > 5)) return false;
      if (selectedStockStatus === "out_of_stock" && v.stock > 0) return false;

      return true;
    });
  }, [variants, searchQuery, selectedProductId, selectedFormat, selectedStockStatus]);

  // Sorting
  const sortedVariants = useMemo(() => {
    const list = [...filteredVariants];
    list.sort((a, b) => {
      if (sortBy === "sku_asc") return a.sku.localeCompare(b.sku);
      if (sortBy === "sku_desc") return b.sku.localeCompare(a.sku);
      if (sortBy === "product_asc") return (a.product_name || "").localeCompare(b.product_name || "");
      if (sortBy === "stock_asc") return a.stock - b.stock;
      if (sortBy === "stock_desc") return b.stock - a.stock;
      if (sortBy === "price_asc") return a.price_paise - b.price_paise;
      if (sortBy === "price_desc") return b.price_paise - a.price_paise;
      if (sortBy === "weight_asc") return a.grams - b.grams;
      return a.id - b.id;
    });
    return list;
  }, [filteredVariants, sortBy]);

  // Statistics KPIs
  const stats = useMemo(() => {
    const total = variants.length;
    const inStock = variants.filter((v) => v.stock > 5).length;
    const lowStock = variants.filter((v) => v.stock > 0 && v.stock <= 5).length;
    const outOfStock = variants.filter((v) => v.stock === 0).length;
    const totalUnits = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    const totalValuePaise = variants.reduce((acc, v) => acc + (v.stock || 0) * v.price_paise, 0);
    const totalValueRupees = totalValuePaise / 100;

    return { total, inStock, lowStock, outOfStock, totalUnits, totalValueRupees };
  }, [variants]);

  // Pagination
  const totalItems = sortedVariants.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedVariants = sortedVariants.slice(startIndex, startIndex + pageSize);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedProductId !== "all" ||
    selectedFormat !== "all" ||
    selectedStockStatus !== "all";

  function resetFilters() {
    setSearchQuery("");
    setSelectedProductId("all");
    setSelectedFormat("all");
    setSelectedStockStatus("all");
    setCurrentPage(1);
  }

  return (
    <div className="admin-variants-container">
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px 0" }}>
            Storefront &amp; Catalog
          </p>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 28, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
            Variants &amp; Inventory
          </h1>
          <p style={{ margin: 0, color: "#555850", fontSize: 14 }}>
            Manage packaging formats, net weights, live warehouse inventory units, and retail pricing across single-estate lots.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}
            title="Refresh variants catalogue"
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? "spin 1s linear infinite" : undefined }} />
            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40 }}
          >
            <Plus size={16} />
            <span>New Variant</span>
          </button>
        </div>
      </div>

      {/* KPI Inventory Metrics Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Metric 1: Total SKUs */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6a6e64", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Total SKUs
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
            Across {products.length} harvest lots
          </div>
        </div>

        {/* Metric 2: In Stock */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#23483a", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={13} color="#2e7d32" />
            <span>In Stock</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#2e7d32", marginTop: 4 }}>
            {stats.inStock}
          </div>
          <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
            Healthy stock (&gt; 5 units)
          </div>
        </div>

        {/* Metric 3: Low Stock */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9e6428", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={13} color="#9e6428" />
            <span>Low Stock</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#9e6428", marginTop: 4 }}>
            {stats.lowStock}
          </div>
          <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
            Requires restocking (1–5)
          </div>
        </div>

        {/* Metric 4: Sold Out */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8f2f2a", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
            <XCircle size={13} color="#8f2f2a" />
            <span>Sold Out</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#8f2f2a", marginTop: 4 }}>
            {stats.outOfStock}
          </div>
          <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
            0 warehouse units
          </div>
        </div>

        {/* Metric 5: Warehouse Value */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6a6e64", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Warehouse Inventory
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
            {stats.totalUnits.toLocaleString()} units
          </div>
          <div style={{ fontSize: 12, color: "#23483a", fontWeight: 600, marginTop: 2 }}>
            ₹{Math.round(stats.totalValueRupees).toLocaleString()} catalog retail
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          background: "#fbf8f1",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Search Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 2, minWidth: 260 }}>
          <Search size={18} color="#6a6e64" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search variants by SKU, product name, estate, or weight"
            placeholder="Search by SKU, tea name, estate, or weight (e.g. 100g)…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #c9c2b6",
              borderRadius: 6,
              fontSize: 13,
              background: "#ffffff",
            }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Product Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Tea Lot:</span>
            <select
              aria-label="Filter variants by tea product"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "7px 10px",
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
                maxWidth: 190,
              }}
            >
              <option value="all">All Tea Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Packaging Format Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Format:</span>
            <select
              aria-label="Filter variants by packaging format"
              value={selectedFormat}
              onChange={(e) => {
                setSelectedFormat(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "7px 10px",
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
              }}
            >
              <option value="all">All Formats</option>
              <option value="loose_leaf_pouch">🍃 Loose Leaf Pouch</option>
              <option value="luxury_tin">🥫 Luxury Tin</option>
              <option value="pyramid_bags">🏷️ Pyramid Bags</option>
            </select>
          </div>

          {/* Stock Level Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Stock:</span>
            <select
              aria-label="Filter variants by stock level"
              value={selectedStockStatus}
              onChange={(e) => {
                setSelectedStockStatus(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "7px 10px",
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
              }}
            >
              <option value="all">All Stock Levels</option>
              <option value="in_stock">In Stock (&gt;5)</option>
              <option value="low_stock">Low Stock (1–5)</option>
              <option value="out_of_stock">Sold Out (0)</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Sort:</span>
            <select
              aria-label="Sort variants catalogue"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
              }}
            >
              <option value="sku_asc">SKU (A–Z)</option>
              <option value="sku_desc">SKU (Z–A)</option>
              <option value="product_asc">Product Name (A–Z)</option>
              <option value="stock_asc">Stock: Low to High (Restock priority)</option>
              <option value="stock_desc">Stock: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="weight_asc">Weight (Low to High)</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                background: "transparent",
                border: "1px dashed #c9c2b6",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                color: "#8f2f2a",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table or Empty State */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#6a6e64" }}>
          <progress aria-label="Loading variants catalogue" className="loading-spinner" />
          <p role="status" style={{ marginTop: 14 }}>Loading variants &amp; live inventory…</p>
        </div>
      ) : paginatedVariants.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#fbf8f1",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
          }}
        >
          <Layers size={40} color="#8c9b88" style={{ marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#1d2a24", fontSize: 18 }}>No packaging variants found</h3>
          <p style={{ margin: "0 0 16px 0", color: "#6a6e64", fontSize: 14 }}>
            {hasActiveFilters
              ? "No variants match your current filter and search query."
              : "Get started by configuring packaging sizes, prices, and stock for your teas."}
          </p>
          {hasActiveFilters ? (
            <button type="button" onClick={resetFilters} className="button button-outline">
              Clear All Filters
            </button>
          ) : (
            <button type="button" onClick={() => setIsCreateModalOpen(true)} className="button button-primary">
              Create First Variant
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #d9d4c8", borderRadius: 8, background: "#ffffff" }}>
          <table className="admin-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>Cover</th>
                <th>Tea Product</th>
                <th>SKU &amp; Format</th>
                <th>Net Weight &amp; Cups</th>
                <th>Retail Price</th>
                <th>Stock &amp; Quick Adjust</th>
                <th style={{ textAlign: "right", width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVariants.map((v) => {
                const isOutOfStock = v.stock <= 0;
                const isLowStock = v.stock > 0 && v.stock <= 5;
                const formatBadge = getFormatBadge(v.packaging_format);
                const priceRupeesFormatted = (v.price_paise / 100).toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                });
                const isUpdatingThisStock = stockUpdatingId === v.id;

                return (
                  <tr key={v.id}>
                    {/* Cover Thumbnail */}
                    <td>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 4,
                          overflow: "hidden",
                          background: "#ede9df",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {v.product_image_url ? (
                          <Image
                            src={v.product_image_url}
                            alt={v.product_name || v.sku}
                            width={40}
                            height={40}
                            sizes="40px"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Package size={18} color="#8c9b88" />
                        )}
                      </div>
                    </td>

                    {/* Associated Tea Product */}
                    <td>
                      <Link
                        href={`/admin/products/${v.product_id}`}
                        style={{ fontWeight: 600, color: "#1d2a24", textDecoration: "none" }}
                      >
                        {v.product_name || `Product #${v.product_id}`}
                      </Link>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                        {v.product_category && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              background: "#ede9df",
                              borderRadius: 4,
                              fontSize: 11,
                              color: "#2d332d",
                            }}
                          >
                            {v.product_category}
                          </span>
                        )}
                        {v.product_estate && (
                          <span style={{ fontSize: 11, color: "#6a6e64" }}>
                            {v.product_estate}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SKU & Format */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <code
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 12,
                            background: "#ede9df",
                            padding: "2px 6px",
                            borderRadius: 4,
                            color: "#1d2a24",
                          }}
                        >
                          {v.sku}
                        </code>
                        <button
                          type="button"
                          onClick={() => copySkuToClipboard(v.sku)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 2,
                            cursor: "pointer",
                            color: copiedSku === v.sku ? "#2e7d32" : "#8c9b88",
                          }}
                          title="Copy SKU code"
                          aria-label={`Copy SKU ${v.sku}`}
                        >
                          {copiedSku === v.sku ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 7px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: formatBadge.bg,
                            color: formatBadge.text,
                          }}
                        >
                          <span>{formatBadge.icon}</span>
                          <span>{formatBadge.label}</span>
                        </span>
                      </div>
                    </td>

                    {/* Weight & Servings */}
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}>
                        {v.grams >= 1000 ? `${v.grams / 1000} kg` : `${v.grams} g`}
                      </div>
                      <div style={{ fontSize: 11, color: "#6a6e64", marginTop: 2 }}>
                        ~{v.servings} cup{v.servings !== 1 ? "s" : ""}
                      </div>
                    </td>

                    {/* Price */}
                    <td>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2a24" }}>
                        {priceRupeesFormatted}
                      </div>
                      <div style={{ fontSize: 10, color: "#8c9b88", marginTop: 2 }}>
                        {v.price_paise.toLocaleString()} paise
                      </div>
                    </td>

                    {/* Stock & Quick Adjust Controls */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isOutOfStock
                              ? "#fdf3f2"
                              : isLowStock
                              ? "#fff8e1"
                              : "rgba(35, 72, 58, 0.1)",
                            color: isOutOfStock
                              ? "#8f2f2a"
                              : isLowStock
                              ? "#9e6428"
                              : "#23483a",
                          }}
                        >
                          {isOutOfStock ? "Sold Out (0)" : isLowStock ? `Low Stock (${v.stock})` : `In Stock (${v.stock})`}
                        </span>
                      </div>

                      {/* Quick Adjust Buttons */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <button
                          type="button"
                          disabled={v.stock <= 0 || isUpdatingThisStock}
                          onClick={() => void handleQuickStockAdjust(v, -1)}
                          style={{
                            background: "#ede9df",
                            border: "1px solid #d9d4c8",
                            borderRadius: 3,
                            padding: "2px 6px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: v.stock <= 0 ? "not-allowed" : "pointer",
                            color: "#1d2a24",
                          }}
                          title="Decrement stock by 1"
                          aria-label={`Decrease stock by 1 for ${v.sku}`}
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingThisStock}
                          onClick={() => void handleQuickStockAdjust(v, 1)}
                          style={{
                            background: "#ede9df",
                            border: "1px solid #d9d4c8",
                            borderRadius: 3,
                            padding: "2px 6px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: "#1d2a24",
                          }}
                          title="Increment stock by 1"
                          aria-label={`Increase stock by 1 for ${v.sku}`}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingThisStock}
                          onClick={() => void handleQuickStockAdjust(v, 5)}
                          style={{
                            background: "#ede9df",
                            border: "1px solid #d9d4c8",
                            borderRadius: 3,
                            padding: "2px 6px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: "#1d2a24",
                          }}
                          title="Increment stock by 5"
                          aria-label={`Increase stock by 5 for ${v.sku}`}
                        >
                          +5
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {v.product_slug && (
                          <Link
                            href={`/tea/${v.product_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="button button-outline"
                            style={{ padding: "4px 7px", fontSize: 11 }}
                            title="Preview on storefront PDP"
                            aria-label={`View ${v.sku} on storefront`}
                          >
                            <ExternalLink size={12} />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingVariant(v)}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                          title="Edit variant packaging, price, and stock"
                          aria-label={`Edit variant ${v.sku}`}
                        >
                          <Edit size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingVariant(v);
                          }}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12, color: "#8f2f2a" }}
                          title="Delete variant"
                          aria-label={`Delete variant ${v.sku}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
            paddingTop: 12,
            borderTop: "1px solid #d9d4c8",
          }}
        >
          <div style={{ fontSize: 13, color: "#6a6e64" }}>
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} variants
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="button button-outline"
              style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="button button-outline"
              style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Create Variant Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-variant-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23, 23, 19, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <div
            style={{
              background: "#fbf8f1",
              border: "1px solid #d9d4c8",
              borderRadius: 8,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 28,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              aria-label="Close dialog"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "#6a6e64",
              }}
            >
              <X size={20} />
            </button>

            <VariantForm
              onSuccess={(created) => {
                showToast(`Variant ${created.sku} created successfully.`);
                setIsCreateModalOpen(false);
                void loadData(true);
              }}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Variant Modal */}
      {editingVariant && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-variant-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23, 23, 19, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingVariant(null);
          }}
        >
          <div
            style={{
              background: "#fbf8f1",
              border: "1px solid #d9d4c8",
              borderRadius: 8,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 28,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setEditingVariant(null)}
              aria-label="Close dialog"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "#6a6e64",
              }}
            >
              <X size={20} />
            </button>

            <VariantForm
              isEdit
              variantId={editingVariant.id}
              initialData={{
                id: editingVariant.id,
                product_id: editingVariant.product_id,
                sku: editingVariant.sku,
                packaging_format: editingVariant.packaging_format,
                grams: editingVariant.grams,
                servings: editingVariant.servings,
                price_paise: editingVariant.price_paise,
                stock: editingVariant.stock,
              }}
              onSuccess={(updated) => {
                showToast(`Variant ${updated.sku} updated successfully.`);
                setEditingVariant(null);
                void loadData(true);
              }}
              onCancel={() => setEditingVariant(null)}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVariant && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-variant-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23, 23, 19, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingVariant(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #d9d4c8",
              borderRadius: 8,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8f2f2a", marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 id="delete-variant-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Delete Packaging Variant?
              </h3>
            </div>

            <p style={{ margin: "0 0 16px 0", color: "#494a44", fontSize: 14, lineHeight: 1.5 }}>
              Are you sure you want to delete SKU <strong>{deletingVariant.sku}</strong> for{" "}
              <strong>{deletingVariant.product_name || `Product #${deletingVariant.product_id}`}</strong>?
            </p>

            {deletingVariant.stock > 0 && (
              <div
                style={{
                  background: "#fff8e1",
                  border: "1px solid #ffe082",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#9e6428",
                  marginBottom: 16,
                }}
              >
                <strong>Warning:</strong> This variant currently holds{" "}
                <strong>{deletingVariant.stock} units</strong> in live inventory.
              </div>
            )}

            {deleteError && (
              <div
                role="alert"
                style={{
                  background: "#fdf3f2",
                  border: "1px solid #f1c1bd",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#8f2f2a",
                  marginBottom: 16,
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingVariant(null)}
                className="button button-outline"
                style={{ minHeight: 38, padding: "6px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="button"
                style={{
                  minHeight: 38,
                  padding: "6px 18px",
                  background: "#8f2f2a",
                  color: "#ffffff",
                  borderColor: "#8f2f2a",
                }}
              >
                {isDeleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 150,
            background: toast.type === "error" ? "#8f2f2a" : "#23483a",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: 6,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 13,
            maxWidth: 380,
          }}
        >
          {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Close notification"
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              padding: 0,
              display: "flex",
            }}
          >
            <X size={15} />
          </button>
        </aside>
      )}

      {/* Scoped CSS for Modern Guidance Spinner and Reduced Motion */}
      <style>{`
        progress.loading-spinner:indeterminate {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid rgba(35, 72, 58, 0.2);
          border-top-color: #23483a;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          progress.loading-spinner:indeterminate {
            animation-duration: 3s;
          }
        }
      `}</style>
    </div>
  );
}
