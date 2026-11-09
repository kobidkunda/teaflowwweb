"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { VariantForm } from "@/components/admin/catalog/VariantForm";
import type { Variant } from "@/lib/productModels";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function EditVariantPage() {
  const params = useParams();
  const id = params?.id ? Number(params.id) : null;

  return (
    <AdminAuthGate>
      <div className="edit-variant-page-container" style={{ maxWidth: 840, margin: "0 auto" }}>
        {id ? <EditVariantContent variantId={id} /> : <p>Invalid variant identifier.</p>}
      </div>
    </AdminAuthGate>
  );
}

function EditVariantContent({ variantId }: { variantId: number }) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading variant #{variantId}…</p>
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

  return (
    <VariantForm
      isEdit
      variantId={variant.id}
      initialData={{
        id: variant.id,
        product_id: variant.product_id,
        sku: variant.sku,
        packaging_format: variant.packaging_format,
        grams: variant.grams,
        servings: variant.servings,
        price_paise: variant.price_paise,
        stock: variant.stock,
      }}
    />
  );
}
