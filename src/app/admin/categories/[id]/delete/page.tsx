"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { ArrowLeft, Trash2, AlertTriangle, ShieldAlert, GitFork, Package } from "lucide-react";

interface AssignedProduct {
  id: number;
  name: string;
  slug: string;
}

interface AssignedSubcategory {
  id: number;
  name: string;
  slug: string;
}

interface CategoryToDelete {
  id: number;
  name: string;
  slug: string;
  product_count?: number;
  products?: AssignedProduct[];
  subcategories?: AssignedSubcategory[];
}

export default function DeleteCategoryPage() {
  return (
    <AdminAuthGate>
      <DeleteCategoryContent />
    </AdminAuthGate>
  );
}

function DeleteCategoryContent() {
  const params = useParams();
  const router = useRouter();
  const idStr = params?.id as string;
  const categoryId = Number(idStr);

  const [category, setCategory] = useState<CategoryToDelete | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadCategory() {
      try {
        const res = await fetch(`/api/admin/categories/${categoryId}`, { credentials: "same-origin" });
        if (!res.ok) {
          if (mounted) setGeneralError("Category not found or already deleted.");
          return;
        }
        const data = (await res.json()) as { category: CategoryToDelete };
        if (mounted) {
          setCategory(data.category);
          const pCount = data.category.products?.length || data.category.product_count || 0;
          const sCount = data.category.subcategories?.length || 0;

          if (pCount > 0) {
            setBlockingError(
              `Category cannot be deleted because ${pCount} product(s) are assigned to it. Reassign or delete products first.`
            );
          } else if (sCount > 0) {
            setBlockingError(
              `Category cannot be deleted because ${sCount} subcategory(s) reference it as their parent family. Reassign subcategories first.`
            );
          }
        }
      } catch {
        if (mounted) setGeneralError("Network error checking category details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (categoryId) void loadCategory();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  async function handleConfirmDelete() {
    setDeleting(true);
    setGeneralError(null);
    setBlockingError(null);

    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setBlockingError(
          data?.error || "Category cannot be deleted because dependent products or subcategories exist."
        );
        setDeleting(false);
        return;
      }

      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setGeneralError(data?.error || "Failed to delete category.");
        setDeleting(false);
        return;
      }

      // Successful deletion
      router.push("/admin/categories");
    } catch {
      setGeneralError("Network error while attempting deletion.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Checking category dependencies and guard rules…</p>
      </div>
    );
  }

  if (generalError && !category) {
    return (
      <div style={{ padding: 32, background: "#ffffff", borderRadius: 8, border: "1px solid #d9d4c8", maxWidth: 600, margin: "20px auto" }}>
        <h2 style={{ color: "#8f2f2a", margin: "0 0 10px 0" }}>Category Not Found</h2>
        <p style={{ color: "#5d6056", marginBottom: 20 }}>{generalError}</p>
        <Link href="/admin/categories" className="button button-outline">
          Back to Categories List
        </Link>
      </div>
    );
  }

  const assignedProducts = category?.products || [];
  const assignedSubcategories = category?.subcategories || [];

  return (
    <div className="delete-category-page-container" style={{ maxWidth: 680, margin: "20px auto" }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/admin/categories/${categoryId}`}
          className="button button-outline"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, background: "#ffffff" }}
        >
          <ArrowLeft size={15} />
          <span>Cancel and return to category</span>
        </Link>
      </div>

      {/* Category Deletion Dependency Guard (HTTP 409 Conflict) */}
      {blockingError ? (
        <div
          role="alert"
          style={{
            background: "#fdf3f2",
            border: "2px solid #8f2f2a",
            borderRadius: 8,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8f2f2a", marginBottom: 12 }}>
            <ShieldAlert size={28} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Category Deletion Blocked (HTTP 409 Conflict)
            </h2>
          </div>
          <p style={{ margin: "0 0 16px 0", color: "#171713", lineHeight: 1.6, fontSize: 14 }}>
            {blockingError}
          </p>

          {/* Assigned Products Dependency List */}
          {assignedProducts.length > 0 && (
            <div style={{ background: "#ffffff", padding: 14, borderRadius: 6, border: "1px solid #f2c7c5", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Package size={15} color="#23483a" />
                <span>Assigned Products ({assignedProducts.length}):</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                {assignedProducts.slice(0, 5).map((p) => (
                  <li key={p.id} style={{ marginBottom: 4 }}>
                    <Link href={`/admin/products/${p.id}/edit`} style={{ color: "#23483a", fontWeight: 600 }}>
                      {p.name}
                    </Link>{" "}
                    (reassign or delete first)
                  </li>
                ))}
                {assignedProducts.length > 5 && (
                  <li style={{ color: "#6a6e64" }}>…and {assignedProducts.length - 5} more products</li>
                )}
              </ul>
            </div>
          )}

          {/* Assigned Subcategories Dependency List */}
          {assignedSubcategories.length > 0 && (
            <div style={{ background: "#ffffff", padding: 14, borderRadius: 6, border: "1px solid #f2c7c5", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <GitFork size={15} color="#4a5938" />
                <span>Child Subcategories ({assignedSubcategories.length}):</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                {assignedSubcategories.map((sub) => (
                  <li key={sub.id} style={{ marginBottom: 4 }}>
                    <Link href={`/admin/categories/${sub.id}/edit`} style={{ color: "#23483a", fontWeight: 600 }}>
                      {sub.name}
                    </Link>{" "}
                    (reassign parent or delete first)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/admin/categories/${categoryId}`} className="button button-primary">
              Return to Category Dossier
            </Link>
            <Link href="/admin/categories" className="button button-outline" style={{ background: "#ffffff" }}>
              Back to Categories List
            </Link>
          </div>
        </div>
      ) : (
        /* Safe Confirmation Card when 0 dependencies exist */
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 28,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(143, 47, 42, 0.12)",
                color: "#8f2f2a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
                Confirm Category Deletion
              </h1>
              <p style={{ margin: "2px 0 0 0", color: "#6a6e64", fontSize: 13 }}>
                Zero Modals Dedicated Deletion Route
              </p>
            </div>
          </div>

          <div
            style={{
              background: "#faf7f2",
              padding: 16,
              borderRadius: 6,
              border: "1px solid #ede9df",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>{category?.name}</div>
            <div style={{ fontSize: 13, color: "#6a6e64", marginTop: 4 }}>
              Slug: <code>{category?.slug}</code> · ID: #{category?.id}
            </div>
            <div style={{ fontSize: 13, color: "#2e7d32", marginTop: 6, fontWeight: 600 }}>
              ✓ Dependency Guard Passed: 0 products and 0 subcategories currently assigned.
            </div>
          </div>

          <p style={{ color: "#494a44", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Are you sure you want to permanently delete this category? This action cannot be undone.
          </p>

          {generalError && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                background: "#fdf3f2",
                border: "1px solid #f2c7c5",
                borderRadius: 6,
                color: "#8f2f2a",
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {generalError}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Link
              href={`/admin/categories/${categoryId}`}
              className="button button-outline"
              style={{ minHeight: 40, padding: "0 18px", background: "#ffffff" }}
              autoFocus
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="button button-primary"
              style={{
                minHeight: 40,
                padding: "0 20px",
                background: "#8f2f2a",
                borderColor: "#8f2f2a",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Trash2 size={16} />
              <span>{deleting ? "Deleting…" : "Confirm Delete"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
