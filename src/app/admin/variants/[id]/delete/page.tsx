"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import type { Variant } from "@/lib/productModels";
import { ArrowLeft, AlertTriangle, AlertCircle, Trash2 } from "lucide-react";

export default function DeleteVariantPage() {
  const params = useParams();
  const id = params?.id ? Number(params.id) : null;

  return (
    <AdminAuthGate>
      <div className="delete-variant-page-container" style={{ maxWidth: 640, margin: "0 auto" }}>
        {id ? <DeleteVariantContent variantId={id} /> : <p>Invalid variant identifier.</p>}
      </div>
    </AdminAuthGate>
  );
}

function DeleteVariantContent({ variantId }: { variantId: number }) {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadVariant() {
      try {
        const res = await fetch(`/api/admin/variants/${variantId}`, { credentials: "same-origin" });
        if (mounted && res.ok) {
          const data = (await res.json()) as { variant?: Variant };
          setVariant(data.variant || null);
        } else {
          setError("Variant not found or could not be loaded.");
        }
      } catch {
        setError("Network error loading variant.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadVariant();
    return () => {
      mounted = false;
    };
  }, [variantId]);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/variants/${variantId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (res.status === 204 || res.ok) {
        router.push("/admin/variants");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error || "Cannot delete variant. It may be referenced by existing customer orders.");
      }
    } catch {
      setDeleteError("Network error while attempting deletion.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading variant deletion details…</p>
      </div>
    );
  }

  if (error || !variant) {
    return (
      <div
        style={{
          background: "#fdf3f2",
          border: "1px solid #f1c1bd",
          borderRadius: 8,
          padding: 24,
          color: "#8f2f2a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <AlertCircle size={20} />
          <h3 style={{ margin: 0, fontSize: 18 }}>Variant Not Found</h3>
        </div>
        <p style={{ margin: "0 0 16px 0", fontSize: 14 }}>{error || "The requested variant could not be found."}</p>
        <Link href="/admin/variants" className="button button-outline" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <ArrowLeft size={14} />
          <span>Back to Variants</span>
        </Link>
      </div>
    );
  }

  const priceRupees = (variant.price_paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/variants"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#555850",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Variants</span>
        </Link>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 28,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#8f2f2a", marginBottom: 16 }}>
          <AlertTriangle size={26} />
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif" }}>
            Safe Deletion Confirmation
          </h2>
        </div>

        <p style={{ fontSize: 14, color: "#494a44", lineHeight: 1.6, marginBottom: 20 }}>
          You are preparing to delete the following packaging variant. Please verify that this SKU is no longer active in stock or needed for fulfillment.
        </p>

        {/* Variant Summary Card */}
        <div
          style={{
            background: "#fbf8f1",
            border: "1px solid #ede9df",
            borderRadius: 6,
            padding: 18,
            marginBottom: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6a6e64" }}>SKU Code:</span>
            <code style={{ fontSize: 14, fontWeight: 700, background: "#ede9df", padding: "2px 8px", borderRadius: 4 }}>
              {variant.sku}
            </code>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6a6e64" }}>Tea Product:</span>
            <strong style={{ fontSize: 14, color: "#1d2a24" }}>{variant.product_name || `#${variant.product_id}`}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6a6e64" }}>Weight &amp; Packaging:</span>
            <span style={{ fontSize: 13, color: "#1d2a24" }}>
              {variant.grams}g · {variant.packaging_format.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6a6e64" }}>Retail Price:</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1d2a24" }}>{priceRupees}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6a6e64" }}>Current Stock:</span>
            <strong style={{ fontSize: 14, color: variant.stock > 0 ? "#9e6428" : "#8f2f2a" }}>
              {variant.stock} units
            </strong>
          </div>
        </div>

        {variant.stock > 0 && (
          <div
            style={{
              background: "#fff8e1",
              border: "1px solid #ffe082",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 13,
              color: "#9e6428",
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            <strong>Warning:</strong> This variant holds <strong>{variant.stock} live units</strong> in inventory. Deleting it will permanently remove this SKU from customer checkout and inventory balance.
          </div>
        )}

        {deleteError && (
          <div
            role="alert"
            style={{
              background: "#fdf3f2",
              border: "1px solid #f1c1bd",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 13,
              color: "#8f2f2a",
              marginBottom: 20,
            }}
          >
            {deleteError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 16, borderTop: "1px solid #ede9df" }}>
          <Link href="/admin/variants" className="button button-outline" style={{ minHeight: 42, padding: "8px 20px" }}>
            Cancel &amp; Return
          </Link>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="button"
            style={{
              minHeight: 42,
              padding: "8px 24px",
              background: "#8f2f2a",
              color: "#ffffff",
              borderColor: "#8f2f2a",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Trash2 size={16} />
            <span>{isDeleting ? "Deleting…" : "Confirm Deletion"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
