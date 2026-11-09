"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProductPublicationControl } from "@/components/admin/catalog/ProductPublicationControl";
import { ProductAvailabilitySwitch } from "@/components/admin/catalog/ProductAvailabilitySwitch";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  Plus,
  Search,
  Package,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Languages,
} from "lucide-react";

interface Variant {
  id: number;
  sku: string;
  price_paise: number;
  stock: number;
  grams: number;
}

interface ProductImage {
  id: number;
  url: string;
  alt_text: string;
  is_primary: number;
}

interface ProductItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  category_id?: number | null;
  origin: string;
  verified_origin?: string;
  ingredients?: string;
  status?: string;
  estate: string;
  flush: string;
  floral: number;
  fruity: number;
  malty: number;
  body: number;
  featured: number;
  is_enabled?: number;
  variants: Variant[];
  images?: ProductImage[];
}

export default function AdminProductsPage() {
  return (
    <AdminAuthGate>
      <ProductsListContent />
    </AdminAuthGate>
  );
}

function ProductsListContent() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [stockStatus, setStockStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [disabledOnly, setDisabledOnly] = useState(false);
  const disabledFilterRef = useRef<HTMLButtonElement>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/admin/products?limit=100&status=all", { credentials: "same-origin" }),
        fetch("/api/admin/categories", { credentials: "same-origin" }),
      ]);

      if (!prodRes.ok) throw new Error("Unable to load products.");
      const prodData = (await prodRes.json()) as { products?: ProductItem[]; totalPages?: number };
      const allProducts = [...(prodData.products || [])];
      for (let page = 2; page <= (prodData.totalPages || 1); page++) {
        const res = await fetch(`/api/admin/products?limit=100&status=all&page=${page}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Unable to load products.");
        const data = (await res.json()) as { products?: ProductItem[] };
        allProducts.push(...(data.products || []));
      }
      setProducts(allProducts);
      if (catRes.ok) {
        const catData = (await catRes.json()) as { categories?: Array<{ id: number; name: string }> };
        setCategories(catData.categories || []);
      }
    } catch {
      setError("Unable to load products. Please refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function setAvailability(product: ProductItem) {
    if (savingId !== null) return;
    setSavingId(product.id);
    setError("");
    setNotice("");
    const enabled = product.is_enabled === 0;
    try {
      const res = await fetch(`/api/admin/products/${product.id}/availability`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Save failed");
      const result = (await res.json()) as { is_enabled: number };
      setProducts((current) => current.map((p) => p.id === product.id ? { ...p, is_enabled: result.is_enabled } : p));
      setNotice(`${product.name} ${enabled ? "enabled" : "disabled"}.`);
      disabledFilterRef.current?.focus();
    } catch {
      setError(`Unable to ${enabled ? "enable" : "disable"} ${product.name}. Please try again.`);
    } finally {
      setSavingId(null);
    }
  }

  // Client-side filtering & sorting
  const filteredProducts = products.filter((p) => {
    if ((p.is_enabled === 0) !== disabledOnly) return false;
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matches =
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q) ||
        p.estate.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Status filter
    if (selectedStatus !== "all") {
      const pStatus = p.status || "published";
      if (pStatus !== selectedStatus) return false;
    }

    // Category filter
    if (selectedCategory !== "all") {
      const catId = Number(selectedCategory);
      if (p.category_id !== catId && p.category !== selectedCategory) {
        return false;
      }
    }

    // Stock filter
    const totalStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    if (stockStatus === "in_stock" && totalStock <= 0) return false;
    if (stockStatus === "out_of_stock" && totalStock > 0) return false;
    if (stockStatus === "low_stock" && (totalStock <= 0 || totalStock > 10)) return false;

    return true;
  });

  // Sort
  filteredProducts.sort((a, b) => {
    if (sortBy === "name_asc") return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "stock_asc") {
      const stockA = a.variants.reduce((acc, v) => acc + v.stock, 0);
      const stockB = b.variants.reduce((acc, v) => acc + v.stock, 0);
      return stockA - stockB;
    }
    if (sortBy === "stock_desc") {
      const stockA = a.variants.reduce((acc, v) => acc + v.stock, 0);
      const stockB = b.variants.reduce((acc, v) => acc + v.stock, 0);
      return stockB - stockA;
    }
    return b.id - a.id; // newest first
  });

  // Pagination
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const startIndex = (visiblePage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  return (
    <div className="admin-products-container">
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
            Storefront & Catalog
          </p>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 28, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
            Products
          </h1>
          <p style={{ margin: 0, color: "#555850", fontSize: 14 }}>
            Manage teas, Tea Moments, tasting profiles, packaging variants, and imagery.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/admin/translations?locale=hi"
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}
            title="Manage translations in Translation Studio"
          >
            <Languages size={15} />
            <span>Translations</span>
          </Link>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading || savingId !== null}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}
            title="Refresh product list"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/products/new"
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40 }}
          >
            <Plus size={16} />
            <span>New Product</span>
          </Link>
        </div>
      </div>

      {error && <p role="alert" className="error-message">{error}</p>}
      <p role="status" aria-live="polite" style={{ margin: notice ? "0 0 16px" : 0 }}>{notice}</p>
      <button
        type="button"
        role="switch"
        aria-checked={disabledOnly}
        aria-label="Disabled products only"
        ref={disabledFilterRef}
        onClick={() => { setDisabledOnly((value) => !value); setCurrentPage(1); }}
        className={`button ${disabledOnly ? "button-primary" : "button-outline"}`}
        style={{ marginBottom: 16, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", width: 34, height: 20, borderRadius: 20, padding: 3, background: disabledOnly ? "#ffffff" : "#6a6e64" }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: disabledOnly ? "#23483a" : "#ffffff", marginLeft: disabledOnly ? 14 : 0 }} />
        </span>
        Disabled products only
      </button>
      {/* Filter & Search Bar */}
      <div
        style={{
          background: "#fbf8f1",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 2, minWidth: 260 }}>
          <Search size={18} color="#6a6e64" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search by name or slug…"
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
            }}
          />
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Category Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Category:</span>
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
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
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Status:</span>
            <select
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
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
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Stock Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Stock:</span>
            <select
              aria-label="Filter by stock status"
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value);
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
              <option value="in_stock">In Stock (&gt;0)</option>
              <option value="low_stock">Low Stock (1–10)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64" }}>Sort:</span>
            <select
              aria-label="Sort products"
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
              <option value="newest">Newest First</option>
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="stock_desc">Highest Stock</option>
              <option value="stock_asc">Lowest Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6a6e64" }}>
          <p role="status">Loading products catalogue…</p>
        </div>
      ) : paginatedProducts.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#fbf8f1",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
          }}
        >
          <Package size={36} color="#6a6e64" style={{ marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#1d2a24", fontSize: 18 }}>No products found</h3>
          <p style={{ margin: "0 0 16px 0", color: "#6a6e64", fontSize: 14 }}>
            {searchQuery || selectedCategory !== "all" || stockStatus !== "all" || selectedStatus !== "all"
              ? "Try adjusting your search query or filters to find products."
              : disabledOnly ? "No disabled products. Disable a product from the normal list to see it here." : "Get started by adding your first tea product."}
          </p>
          <Link href="/admin/products/new" className="button button-primary">
            New Product
          </Link>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #d9d4c8", borderRadius: 8 }}>
          <table className="admin-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Cover</th>
                <th>Name &amp; Slug</th>
                <th>Availability</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Cupping Scores</th>
                <th style={{ textAlign: "right", width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((p) => {
                const totalStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
                const isOutOfStock = totalStock <= 0;
                const isLowStock = totalStock > 0 && totalStock <= 10;
                const primaryImg = p.images?.find((img) => img.is_primary === 1) || p.images?.[0];

                return (
                  <tr key={p.id}>
                    <td>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 4,
                          overflow: "hidden",
                          background: "#ede9df",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {primaryImg?.url ? (
                          <Image
                            src={primaryImg.url}
                            alt={primaryImg.alt_text || p.name}
                            width={44}
                            height={44}
                            sizes="44px"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Package size={20} color="#8c9b88" />
                        )}
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/admin/products/${p.id}`}
                        style={{ fontWeight: 600, color: "#1d2a24", textDecoration: "none" }}
                      >
                        {p.name}
                      </Link>
                      <div style={{ fontSize: 11, color: "#6a6e64", marginTop: 2 }}>/{p.slug}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        {p.status === "draft" && (
                          <span
                            style={{
                              display: "inline-block",
                              background: "#fef3c7",
                              color: "#92400e",
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 10,
                              fontWeight: 700,
                            }}
                          >
                            Draft
                          </span>
                        )}
                        {p.status === "archived" && (
                          <span
                            style={{
                              display: "inline-block",
                              background: "#f3f4f6",
                              color: "#4b5563",
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 10,
                              fontWeight: 700,
                            }}
                          >
                            Archived
                          </span>
                        )}
                        {p.featured === 1 && (
                          <span
                            style={{
                              display: "inline-block",
                              background: "rgba(179, 145, 86, 0.2)",
                              color: "#6d531d",
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 10,
                              fontWeight: 700,
                            }}
                          >
                            Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <ProductAvailabilitySwitch
                        enabled={p.is_enabled !== 0}
                        pending={savingId === p.id}
                        disabled={savingId !== null}
                        name={p.name}
                        onChange={() => void setAvailability(p)}
                      />
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          background: "#ede9df",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#1d2a24",
                        }}
                      >
                        {p.category || "Uncategorised"}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
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
                        {totalStock} in stock ({p.variants.length} SKU{p.variants.length !== 1 ? "s" : ""})
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#494a44" }}>
                        <span title="Floral rating">🌸 {p.floral}/5</span>
                        <span title="Fruity rating">🍇 {p.fruity}/5</span>
                        <span title="Malty rating">🌾 {p.malty}/5</span>
                        <span title="Body rating">☕ {p.body}/5</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <ProductPublicationControl id={p.id} name={p.name} status={p.status} enabled={p.is_enabled} onChange={(value) => {
                          setProducts((current) => current.map((product) => product.id === p.id ? { ...product, ...value } : product));
                          if (disabledOnly) disabledFilterRef.current?.focus();
                        }} />
                        <Link
                          href={`/admin/translations?locale=hi&search=product:${p.id}`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          title="Translate in Translation Studio"
                        >
                          <Languages size={13} style={{ marginRight: 4 }} />
                          <span>Translate</span>
                        </Link>
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          title="View product dossier"
                        >
                          <Eye size={13} style={{ marginRight: 4 }} />
                          <span>View</span>
                        </Link>
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          title="Edit product"
                        >
                          <Edit size={13} style={{ marginRight: 4 }} />
                          <span>Edit</span>
                        </Link>
                        <Link
                          href={`/admin/products/${p.id}/delete`}
                          className="button button-outline"
                          style={{ padding: "4px 8px", fontSize: 12, color: "#8f2f2a" }}
                          title="Safe deletion screen"
                        >
                          <Trash2 size={13} />
                        </Link>
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
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} products
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              disabled={visiblePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
              className="button button-outline"
              style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Page {visiblePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={visiblePage >= totalPages}
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
    </div>
  );
}
