"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Plus,
  GitFork,
  Layers,
  Search,
  Thermometer,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface AssignedProduct {
  id: number;
  slug: string;
  name: string;
  origin: string;
  estate: string;
  flush: string;
  harvest_date: string;
  brew_temp: number;
  brew_seconds: number;
}

interface ChildSubcategory {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_active: number;
  product_count?: number;
}

interface CategoryDossier {
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
  products?: AssignedProduct[];
  subcategories?: ChildSubcategory[];
  created_at?: string;
}

export default function CategoryDossierPage() {
  return (
    <AdminAuthGate>
      <CategoryDossierContent />
    </AdminAuthGate>
  );
}

function CategoryDossierContent() {
  const params = useParams();
  const idStr = params?.id as string;
  const categoryId = Number(idStr);

  const [category, setCategory] = useState<CategoryDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadCategory() {
      try {
        const res = await fetch(`/api/admin/categories/${categoryId}`, { credentials: "same-origin" });
        if (!res.ok) {
          if (mounted) setError("Category not found or unable to load.");
          return;
        }
        const data = (await res.json()) as { category: CategoryDossier };
        if (mounted) setCategory(data.category);
      } catch {
        if (mounted) setError("Network error loading category.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (categoryId) void loadCategory();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  async function handleCopySlug() {
    if (!category?.slug) return;
    try {
      await navigator.clipboard.writeText(category.slug);
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
    } catch {
      // Best-effort
    }
  }

  const assignedProducts = useMemo(() => category?.products || [], [category?.products]);
  const childSubcategories = useMemo(() => category?.subcategories || [], [category?.subcategories]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return assignedProducts;
    return assignedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.estate.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q)
    );
  }, [assignedProducts, productSearch]);

  const isSafeToDelete = assignedProducts.length === 0 && childSubcategories.length === 0;

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading category dossier…</p>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div
        style={{
          maxWidth: 640,
          margin: "40px auto",
          padding: 32,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#8f2f2a", fontSize: 20, margin: "0 0 10px 0" }}>Category Not Found</h2>
        <p style={{ color: "#5d6056", marginBottom: 20 }}>
          {error || "The requested category could not be located."}
        </p>
        <Link href="/admin/categories" className="button button-outline">
          Back to Categories List
        </Link>
      </div>
    );
  }

  return (
    <div className="category-dossier-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* Top Breadcrumb Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link
          href="/admin/categories"
          className="button button-outline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            minHeight: 38,
            background: "#ffffff",
            borderColor: "#c9c2b6",
          }}
        >
          <ArrowLeft size={14} />
          <span>All Categories</span>
        </Link>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a
            href={`/shop?category=${encodeURIComponent(category.slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              minHeight: 38,
              background: "#ffffff",
              borderColor: "#c9c2b6",
            }}
            title="Preview this category on public storefront"
          >
            <ExternalLink size={14} />
            <span>Storefront View</span>
          </a>

          <Link
            href={`/admin/categories/${category.id}/edit`}
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              minHeight: 38,
              background: "#1d2a24",
              color: "#ffffff",
            }}
          >
            <Edit size={14} />
            <span>Edit Category</span>
          </Link>

          <Link
            href={`/admin/categories/${category.id}/delete`}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              minHeight: 38,
              color: "#8f2f2a",
              borderColor: "#f2c7c5",
              background: "#ffffff",
            }}
            title="Safe deletion screen"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </Link>
        </div>
      </div>

      {/* Hero Header Card */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Banner Artwork Preview */}
        {category.cover_image_url ? (
          <div
            style={{
              width: "100%",
              height: 220,
              background: "#1d2a24",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Image
              src={category.cover_image_url}
              alt={category.name}
              fill
              sizes="(max-width: 1024px) 100vw, 800px"
              style={{ objectFit: "cover", opacity: 0.95 }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(29, 42, 36, 0.8) 0%, transparent 60%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 24,
                color: "#ffffff",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "#d9c8a6",
                }}
              >
                Tea Family Dossier
              </span>
              <h1
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 28,
                  fontFamily: "Georgia, serif",
                  color: "#ffffff",
                }}
              >
                {category.name}
              </h1>
            </div>
          </div>
        ) : null}

        <div style={{ padding: 24 }}>
          {!category.cover_image_url && (
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "#697a55",
                }}
              >
                Tea Family Dossier
              </span>
              <h1
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 28,
                  fontFamily: "Georgia, serif",
                  color: "#1d2a24",
                }}
              >
                {category.name}
              </h1>
            </div>
          )}

          {/* Status & Hierarchy Badges */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            {/* Storefront Active status */}
            {category.is_active === 1 ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(46, 125, 50, 0.1)",
                  color: "#2e7d32",
                }}
              >
                <CheckCircle2 size={13} />
                <span>Active on Storefront</span>
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(143, 47, 42, 0.1)",
                  color: "#8f2f2a",
                }}
              >
                <XCircle size={13} />
                <span>Hidden from Storefront</span>
              </span>
            )}

            {/* Hierarchy status */}
            {category.parent_name ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 500,
                  background: "#ede9df",
                  color: "#1d2a24",
                }}
              >
                <GitFork size={13} />
                <span>
                  Subcategory of: <strong>{category.parent_name}</strong>
                </span>
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 700,
                  background: "rgba(179, 145, 86, 0.15)",
                  color: "#7e5e1e",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <Layers size={13} />
                <span>Top-Level Parent Family</span>
              </span>
            )}

            {/* Dependency Guard State */}
            {isSafeToDelete ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(46, 125, 50, 0.08)",
                  color: "#2e7d32",
                }}
                title="This category has 0 assigned products and 0 subcategories, so it can be safely removed"
              >
                <ShieldCheck size={13} />
                <span>Safe to Delete (0 Dependencies)</span>
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(179, 107, 61, 0.1)",
                  color: "#b36b3d",
                }}
                title="Category deletion is blocked because active products or subcategories reference it"
              >
                <ShieldAlert size={13} />
                <span>Protected ({assignedProducts.length} Products, {childSubcategories.length} Subs)</span>
              </span>
            )}
          </div>

          {/* Description */}
          <div style={{ marginTop: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#6a6e64", textTransform: "uppercase", margin: "0 0 6px 0" }}>
              About this Category
            </h3>
            <p style={{ margin: 0, color: "#2d302a", fontSize: 15, lineHeight: 1.6 }}>
              {category.description || "No editorial description written yet for this category."}
            </p>
          </div>

          {/* Taxonomy Metadata Strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              padding: "14px 16px",
              background: "#faf7f2",
              borderRadius: 6,
              border: "1px solid #ede9df",
              fontSize: 13,
            }}
          >
            <div>
              <span style={{ color: "#7e8278", display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                URL Slug
              </span>
              <button
                type="button"
                onClick={handleCopySlug}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  color: "#1d2a24",
                  fontSize: 13,
                }}
                title="Copy slug to clipboard"
              >
                <span>/{category.slug}</span>
                {copiedSlug ? <Check size={13} color="#2e7d32" /> : <Copy size={13} color="#6a6e64" />}
              </button>
            </div>

            <div>
              <span style={{ color: "#7e8278", display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                Display Sort Order
              </span>
              <strong style={{ color: "#1d2a24" }}>#{category.sort_order}</strong>
            </div>

            <div>
              <span style={{ color: "#7e8278", display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                Internal Database ID
              </span>
              <strong style={{ color: "#1d2a24" }}>#{category.id}</strong>
            </div>

            <div>
              <span style={{ color: "#7e8278", display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                Assigned Products
              </span>
              <strong style={{ color: "#23483a" }}>{assignedProducts.length} teas</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Child Subcategories Section (if any or ability to add one) */}
      {!category.parent_id && (
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  color: "#1d2a24",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "Georgia, serif",
                }}
              >
                <GitFork size={18} color="#23483a" />
                <span>Child Subcategories ({childSubcategories.length})</span>
              </h2>
              <p style={{ margin: "2px 0 0 0", color: "#6a6e64", fontSize: 13 }}>
                Regional flushes or single-estate collections nested under this primary family.
              </p>
            </div>

            <Link
              href={`/admin/categories/new?parent_id=${category.id}`}
              className="button button-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                minHeight: 34,
                borderColor: "#c9c2b6",
                background: "#ffffff",
              }}
            >
              <Plus size={14} />
              <span>Add Subcategory</span>
            </Link>
          </div>

          {childSubcategories.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                background: "#faf7f2",
                borderRadius: 6,
                color: "#6a6e64",
                fontSize: 13,
              }}
            >
              No subcategories nested under this family yet. You can create specialized regional sub-collections anytime.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {childSubcategories.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    background: "#faf7f2",
                    border: "1px solid #ede9df",
                    borderRadius: 6,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <Link
                      href={`/admin/categories/${sub.id}`}
                      style={{ fontWeight: 600, color: "#1d2a24", textDecoration: "none", fontSize: 14 }}
                    >
                      {sub.name}
                    </Link>
                    <div style={{ fontSize: 11, color: "#6a6e64", fontFamily: "monospace", marginTop: 2 }}>
                      /{sub.slug}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: "rgba(35, 72, 58, 0.08)",
                        color: "#23483a",
                      }}
                    >
                      {sub.product_count ?? 0} teas
                    </span>
                    <Link
                      href={`/admin/categories/${sub.id}`}
                      className="button button-outline"
                      style={{ padding: "3px 8px", fontSize: 11, minHeight: 28 }}
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Assigned Products Section */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                color: "#1d2a24",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "Georgia, serif",
              }}
            >
              <Package size={18} color="#23483a" />
              <span>Assigned Products ({assignedProducts.length})</span>
            </h2>
            <p style={{ margin: "2px 0 0 0", color: "#6a6e64", fontSize: 13 }}>
              Teas linked to this category in the catalog database.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {assignedProducts.length > 3 && (
              <div style={{ position: "relative", minWidth: 200 }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#7e8278",
                  }}
                />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Filter products..."
                  style={{
                    padding: "6px 10px 6px 30px",
                    fontSize: 12,
                    border: "1px solid #c9c2b6",
                    borderRadius: 4,
                    minHeight: 34,
                    background: "#faf7f2",
                  }}
                />
              </div>
            )}

            <Link
              href={`/admin/products/new?categoryId=${category.id}`}
              className="button button-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                minHeight: 34,
                borderColor: "#c9c2b6",
                background: "#ffffff",
              }}
            >
              <Plus size={14} />
              <span>Add New Product</span>
            </Link>
          </div>
        </div>

        {assignedProducts.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              background: "#faf7f2",
              borderRadius: 6,
              border: "1px dashed #d9d4c8",
            }}
          >
            <Package size={32} color="#8c9b88" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1d2a24" }}>
              No products assigned to this category
            </div>
            <p style={{ margin: "4px auto 14px auto", color: "#6a6e64", fontSize: 13, maxWidth: 360 }}>
              This category currently has zero product dependencies, making it safe to delete or ready for catalog assignment.
            </p>
            <Link
              href={`/admin/products/new?categoryId=${category.id}`}
              className="button button-primary"
              style={{ fontSize: 12, minHeight: 34 }}
            >
              Assign Product
            </Link>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#6a6e64", fontSize: 13 }}>
            No products match filter &quot;{productSearch}&quot;.
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #ede9df", borderRadius: 6 }}>
            <table className="admin-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ede9df", borderBottom: "1px solid #d9d4c8" }}>
                  <th scope="col" style={{ padding: "9px 12px", textAlign: "left" }}>Product Name &amp; Slug</th>
                  <th scope="col" style={{ padding: "9px 12px", textAlign: "left" }}>Origin &amp; Estate</th>
                  <th scope="col" style={{ padding: "9px 12px", textAlign: "left" }}>Harvest Flush</th>
                  <th scope="col" style={{ padding: "9px 12px", textAlign: "left" }}>Brew Specs</th>
                  <th scope="col" style={{ textAlign: "right", padding: "9px 12px", width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #ede9df" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <Link
                        href={`/admin/products/${p.id}`}
                        style={{ fontWeight: 600, color: "#1d2a24", textDecoration: "none", fontSize: 14 }}
                      >
                        {p.name}
                      </Link>
                      <div style={{ fontSize: 11, color: "#6a6e64", fontFamily: "monospace", marginTop: 2 }}>
                        /{p.slug}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2d302a" }}>
                      {p.estate || "Single Estate"} · {p.origin}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2d302a" }}>
                      {p.flush} {p.harvest_date ? `(${p.harvest_date})` : ""}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#6a6e64" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10 }}>
                        <Thermometer size={12} />
                        <span>{p.brew_temp}°C</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} />
                        <span>{p.brew_seconds}s</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right", padding: "10px 12px" }}>
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="button button-outline"
                        style={{ padding: "3px 8px", fontSize: 11, minHeight: 28 }}
                      >
                        View Product
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
