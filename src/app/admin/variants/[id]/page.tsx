"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import type { Variant } from "@/lib/productModels";
import {
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  Package,
  Layers,
  IndianRupee,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

export default function VariantDossierPage() {
  const params = useParams();
  const id = params?.id ? Number(params.id) : null;

  return (
    <AdminAuthGate>
      <div className="variant-dossier-container" style={{ maxWidth: 840, margin: "0 auto" }}>
        {id ? <VariantDossierContent variantId={id} /> : <p>Invalid variant identifier.</p>}
      </div>
    </AdminAuthGate>
  );
}

function VariantDossierContent({ variantId }: { variantId: number }) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  function copySku() {
    if (!variant) return;
    navigator.clipboard?.writeText(variant.sku).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading variant dossier #{variantId}…</p>
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

  const isOutOfStock = variant.stock <= 0;
  const isLowStock = variant.stock > 0 && variant.stock <= 5;
  const priceRupees = (variant.price_paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

  return (
    <div>
      {/* Back Button */}
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
          <span>Back to Variants Catalogue</span>
        </Link>
      </div>

      {/* Dossier Header */}
      <div
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="eyebrow" style={{ margin: 0 }}>
              Variant Dossier
            </span>
            <span
              style={{
                background: isOutOfStock ? "#fdf3f2" : isLowStock ? "#fff8e1" : "rgba(35, 72, 58, 0.1)",
                color: isOutOfStock ? "#8f2f2a" : isLowStock ? "#9e6428" : "#23483a",
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {isOutOfStock ? "Sold Out" : isLowStock ? "Low Stock" : "In Stock"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
              {variant.sku}
            </h1>
            <button
              type="button"
              onClick={copySku}
              style={{
                background: "transparent",
                border: "1px solid #d9d4c8",
                borderRadius: 4,
                padding: "4px 8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: copied ? "#2e7d32" : "#555850",
              }}
              title="Copy SKU to clipboard"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy SKU"}</span>
            </button>
          </div>

          <p style={{ margin: "6px 0 0 0", color: "#555850", fontSize: 14 }}>
            Packaging lot attached to{" "}
            <Link
              href={`/admin/products/${variant.product_id}`}
              style={{ fontWeight: 600, color: "#23483a", textDecoration: "underline" }}
            >
              {variant.product_name || `Product #${variant.product_id}`}
            </Link>
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {variant.product_slug && (
            <Link
              href={`/tea/${variant.product_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}
            >
              <ExternalLink size={14} />
              <span>View on Store</span>
            </Link>
          )}
          <Link
            href={`/admin/variants/${variant.id}/edit`}
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}
          >
            <Edit size={14} />
            <span>Edit Variant</span>
          </Link>
          <Link
            href={`/admin/variants/${variant.id}/delete`}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, color: "#8f2f2a" }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </Link>
        </div>
      </div>

      {/* Grid of Attributes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Card: Packaging & Specs */}
        <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px 0", color: "#1d2a24", display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} color="#23483a" />
            <span>Packaging &amp; Weight</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6a6e64" }}>Packaging Format:</span>
              <strong style={{ color: "#1d2a24" }}>{variant.packaging_format.replace(/_/g, " ")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6a6e64" }}>Net Weight:</span>
              <strong style={{ color: "#1d2a24" }}>{variant.grams} grams</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6a6e64" }}>Cup Servings:</span>
              <strong style={{ color: "#1d2a24" }}>~{variant.servings} infusions</strong>
            </div>
          </div>
        </div>

        {/* Card: Pricing & Inventory */}
        <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px 0", color: "#1d2a24", display: "flex", alignItems: "center", gap: 8 }}>
            <IndianRupee size={18} color="#23483a" />
            <span>Commercial Pricing &amp; Stock</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6a6e64" }}>Retail Price:</span>
              <strong style={{ fontSize: 16, color: "#1d2a24" }}>{priceRupees}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6a6e64" }}>Server Paise:</span>
              <code style={{ fontSize: 12, background: "#ede9df", padding: "1px 6px", borderRadius: 4 }}>
                {variant.price_paise.toLocaleString()} paise
              </code>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6a6e64" }}>Live Warehouse Stock:</span>
              <strong style={{ color: isOutOfStock ? "#8f2f2a" : isLowStock ? "#9e6428" : "#2e7d32" }}>
                {variant.stock} units
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Associated Product Dossier Card */}
      <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px 0", color: "#1d2a24", display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={18} color="#23483a" />
          <span>Associated Harvest Product</span>
        </h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {variant.product_image_url && (
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 6,
                overflow: "hidden",
                background: "#ede9df",
                flexShrink: 0,
              }}
            >
              <Image
                src={variant.product_image_url}
                alt={variant.product_name || "Product"}
                width={60}
                height={60}
                sizes="60px"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2a24" }}>
              {variant.product_name || `Product #${variant.product_id}`}
            </div>
            <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
              {variant.product_estate ? `Estate: ${variant.product_estate} · ` : ""}
              Family: {variant.product_category || "Tea"}
            </div>
          </div>
          <div>
            <Link
              href={`/admin/products/${variant.product_id}`}
              className="button button-outline"
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              Open Product Dossier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
