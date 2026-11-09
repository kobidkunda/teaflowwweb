"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { ArrowLeft, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";

export default function DeleteProductPage() {
  return (
    <AdminAuthGate>
      <DeleteProductContent />
    </AdminAuthGate>
  );
}

function DeleteProductContent() {
  const params = useParams();
  const router = useRouter();
  const idStr = params?.id as string;
  const productId = Number(idStr);

  const [product, setProduct] = useState<{ id: number; name: string; slug: string; variants?: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProduct() {
      try {
        const res = await fetch(`/api/admin/products/${productId}`, { credentials: "same-origin" });
        if (!res.ok) {
          if (mounted) setGeneralError("Product not found or already deleted.");
          return;
        }
        const data = (await res.json()) as { product: { id: number; name: string; slug: string; variants?: unknown[] } };
        if (mounted) setProduct(data.product);
      } catch {
        if (mounted) setGeneralError("Network error checking product details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (productId) void loadProduct();
    return () => {
      mounted = false;
    };
  }, [productId]);

  async function handleConfirmDelete() {
    setDeleting(true);
    setGeneralError(null);
    setBlockingError(null);

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setBlockingError(
          data?.error || "This product cannot be deleted because it is referenced by existing orders or dependencies."
        );
        setDeleting(false);
        return;
      }

      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setGeneralError(data?.error || "Failed to delete product.");
        setDeleting(false);
        return;
      }

      // Successful deletion
      router.push("/admin/products");
    } catch {
      setGeneralError("Network error while attempting deletion.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Checking product and dependency status…</p>
      </div>
    );
  }

  if (generalError && !product) {
    return (
      <div style={{ padding: 32, background: "#fbf8f1", borderRadius: 8, border: "1px solid #d9d4c8", maxWidth: 600 }}>
        <h2 style={{ color: "#8f2f2a" }}>Product Not Found</h2>
        <p>{generalError}</p>
        <Link href="/admin/products" className="button button-outline">
          Back to Products List
        </Link>
      </div>
    );
  }

  return (
    <div className="delete-product-page-container" style={{ maxWidth: 680, margin: "20px auto" }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/admin/products/${productId}`}
          className="button button-outline"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          <span>Cancel and return to product</span>
        </Link>
      </div>

      {/* Dependency Block Card (409 Conflict) */}
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
              Deletion Blocked: Commercial Dependency Conflict
            </h2>
          </div>
          <p style={{ margin: "0 0 16px 0", color: "#171713", lineHeight: 1.6, fontSize: 14 }}>
            {blockingError}
          </p>
          <div style={{ background: "#ffffff", padding: 14, borderRadius: 6, border: "1px solid #f2c7c5", fontSize: 13 }}>
            <strong>Integrity Mandate:</strong> Products referenced by existing customer order records cannot be deleted
            to preserve accounting and customer receipt history.
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <Link href={`/admin/products/${productId}`} className="button button-primary">
              Return to Product Dossier
            </Link>
            <Link href="/admin/products" className="button button-outline">
              Back to Products List
            </Link>
          </div>
        </div>
      ) : (
        /* Confirmation Card */
        <div
          style={{
            background: "#fbf8f1",
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
              <h2 style={{ margin: 0, fontSize: 20, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
                Confirm Product Deletion
              </h2>
              <p style={{ margin: "2px 0 0 0", color: "#6a6e64", fontSize: 13 }}>
                Dedicated full-page deletion confirmation (Zero Modals)
              </p>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: 16,
              borderRadius: 6,
              border: "1px solid #ede9df",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2a24" }}>{product?.name}</div>
            <div style={{ fontSize: 13, color: "#6a6e64", marginTop: 4 }}>
              Slug: <code>{product?.slug}</code> · ID: #{product?.id}
            </div>
            <div style={{ fontSize: 13, color: "#6a6e64", marginTop: 4 }}>
              Variants attached: {product?.variants?.length || 0} packaging format(s)
            </div>
          </div>

          <p style={{ color: "#494a44", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Are you sure you want to permanently delete this product? All packaging variants, pricing records,
            and associated image metadata will be removed. This action cannot be undone.
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
              href={`/admin/products/${productId}`}
              className="button button-outline"
              style={{ minHeight: 40, padding: "0 18px" }}
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
              <span>{deleting ? "Deleting…" : "Confirm Permanent Delete"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
