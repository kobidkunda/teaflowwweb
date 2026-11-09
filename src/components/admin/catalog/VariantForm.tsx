"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Package,
  IndianRupee,
  Boxes,
  Scale,
  Coffee,
} from "lucide-react";
import type { PackagingFormat } from "@/lib/productModels";
import { generateUUID } from "@/lib/uuid";

export interface VariantFormData {
  id?: number;
  product_id: number;
  sku: string;
  packaging_format: PackagingFormat;
  grams: number;
  servings: number;
  price_paise: number;
  compare_at_price_paise?: number | null;
  stock: number;
}

export interface VariantFormProps {
  initialData?: Partial<VariantFormData>;
  isEdit?: boolean;
  variantId?: number;
  defaultProductId?: number;
  onSuccess?: (variant: VariantFormData) => void;
  onCancel?: () => void;
}

interface ProductOption {
  id: number;
  name: string;
  slug: string;
  category: string;
  estate?: string;
  origin?: string;
}

const DEFAULT_VARIANT_DATA: VariantFormData = {
  product_id: 0,
  sku: "",
  packaging_format: "loose_leaf_pouch",
  grams: 100,
  servings: 50,
  price_paise: 99900, // ₹999.00
  stock: 25,
};

const PACKAGING_OPTIONS: Array<{
  id: PackagingFormat;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: "loose_leaf_pouch",
    label: "Loose Leaf Pouch",
    icon: "🍃",
    description: "Multilayer resealable kraft pouch with aroma barrier foil lining",
  },
  {
    id: "luxury_tin",
    label: "Luxury Brass Tin",
    icon: "🥫",
    description: "Double-lidded airtight collector caddy with brushed brass finish",
  },
  {
    id: "pyramid_bags",
    label: "Pyramid Tea Bags",
    icon: "🏷️",
    description: "Biodegradable cornstarch silken pyramid bags with whole leaf tea",
  },
];

const WEIGHT_PRESETS = [50, 100, 250, 500, 1000];
const STOCK_PRESETS = [0, 10, 25, 50, 100];

export function VariantForm({
  initialData,
  isEdit = false,
  variantId,
  defaultProductId,
  onSuccess,
  onCancel,
}: VariantFormProps) {
  const router = useRouter();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [formData, setFormData] = useState<VariantFormData>(() => ({
    ...DEFAULT_VARIANT_DATA,
    product_id: defaultProductId ?? 0,
    ...initialData,
  }));

  // Local state for Price in Rupees (for human-friendly editing)
  const [priceRupees, setPriceRupees] = useState<string>(() => {
    const paise = initialData?.price_paise ?? DEFAULT_VARIANT_DATA.price_paise;
    return (paise / 100).toFixed(2);
  });

  const [comparePriceRupees, setComparePriceRupees] = useState<string>(() => {
    const paise = initialData?.compare_at_price_paise;
    return paise ? (paise / 100).toFixed(2) : "";
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch available products for dropdown selection
  useEffect(() => {
    let mounted = true;
    async function fetchProducts() {
      try {
        const res = await fetch("/api/admin/products?limit=100", { credentials: "same-origin" });
        if (mounted && res.ok) {
          const data = (await res.json()) as { products?: ProductOption[] };
          const loaded = data.products || [];
          setProducts(loaded);
          if (!formData.product_id && loaded.length > 0 && !defaultProductId) {
            setFormData((prev) => ({ ...prev, product_id: loaded[0].id }));
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }
    void fetchProducts();
    return () => {
      mounted = false;
    };
  }, [defaultProductId, formData.product_id]);

  // Sync rupees input when initialData arrives or changes
  useEffect(() => {
    if (initialData?.price_paise !== undefined) {
      setPriceRupees((initialData.price_paise / 100).toFixed(2));
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
    if (initialData?.compare_at_price_paise !== undefined) {
      setComparePriceRupees(initialData.compare_at_price_paise ? (initialData.compare_at_price_paise / 100).toFixed(2) : "");
    }
  }, [initialData]);

  // Smart SKU generator from chosen product, format, and grams
  function generateSmartSku() {
    const prod = products.find((p) => p.id === formData.product_id);
    const prodPrefix = prod
      ? prod.slug
          .split("-")
          .map((s) => s.slice(0, 3).toUpperCase())
          .slice(0, 2)
          .join("-")
      : "TEA";

    const formatCode =
      formData.packaging_format === "luxury_tin"
        ? "TIN"
        : formData.packaging_format === "pyramid_bags"
        ? "BAGS"
        : "POUCH";

    const weightCode = `${formData.grams}G`;
    const suggested = `${prodPrefix}-${formatCode}-${weightCode}`;
    setFormData((prev) => ({ ...prev, sku: suggested }));
    setFieldErrors((prev) => ({ ...prev, sku: "" }));
  }

  // Handle price in Rupees change with immediate conversion to paise
  function handleRupeesChange(val: string) {
    setPriceRupees(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      const paise = Math.round(parsed * 100);
      setFormData((prev) => ({ ...prev, price_paise: paise }));
      setFieldErrors((prev) => ({ ...prev, price: "" }));
    } else {
      setFieldErrors((prev) => ({ ...prev, price: "Enter a valid non-negative price in Rupees" }));
    }
  }

  // Handle compare-at price in Rupees change (optional promotional MRP)
  function handleComparePriceChange(val: string) {
    setComparePriceRupees(val);
    if (!val.trim()) {
      setFormData((prev) => ({ ...prev, compare_at_price_paise: null }));
      return;
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      const paise = Math.round(parsed * 100);
      setFormData((prev) => ({ ...prev, compare_at_price_paise: paise }));
    }
  }

  // Handle grams change with smart serving auto-calculation
  function handleGramsChange(grams: number) {
    const suggestedServings = Math.max(1, Math.round(grams / 2));
    setFormData((prev) => ({
      ...prev,
      grams,
      servings: suggestedServings,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client validation
    const errors: Record<string, string> = {};
    if (!formData.product_id || formData.product_id <= 0) {
      errors.product = "Please select a product from the list";
    }

    const cleanSku = formData.sku.trim().toUpperCase();
    if (!cleanSku) {
      errors.sku = "SKU is required";
    } else if (!/^[A-Z0-9-]+$/.test(cleanSku)) {
      errors.sku = "SKU must contain only uppercase letters, numbers, and hyphens";
    } else if (cleanSku.length < 3 || cleanSku.length > 24) {
      errors.sku = "SKU must be between 3 and 24 characters";
    }

    if (formData.grams <= 0) {
      errors.grams = "Net weight must be greater than 0 grams";
    }

    if (formData.servings <= 0) {
      errors.servings = "Servings must be at least 1 cup";
    }

    if (formData.price_paise < 0) {
      errors.price = "Price cannot be negative";
    }

    if (formData.stock < 0) {
      errors.stock = "Stock cannot be negative";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please fix the highlighted errors before saving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        product_id: formData.product_id,
        sku: cleanSku,
        packaging_format: formData.packaging_format,
        grams: formData.grams,
        servings: formData.servings,
        price_paise: formData.price_paise,
        compare_at_price_paise: formData.compare_at_price_paise ?? null,
        stock: formData.stock,
        idempotencyKey: generateUUID(),
      };

      const url = isEdit && variantId ? `/api/admin/variants/${variantId}` : "/api/admin/variants";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMessage(isEdit ? "Variant updated successfully." : "Variant created successfully.");
        if (onSuccess) {
          onSuccess({ ...formData, sku: cleanSku });
        } else {
          setTimeout(() => {
            router.push("/admin/variants");
            router.refresh();
          }, 600);
        }
      } else {
        const errorData = (await res.json().catch(() => null)) as {
          error?: string;
          details?: Record<string, string[]>;
        } | null;

        if (errorData?.details) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(errorData.details)) {
            mapped[k] = Array.isArray(v) ? v[0] : String(v);
          }
          setFieldErrors(mapped);
        }
        setFormError(errorData?.error || "Save failed. Check the fields and try again.");
      }
    } catch {
      setFormError("Network error. Please check your connection and retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === formData.product_id);

  return (
    <form onSubmit={handleSubmit} className="variant-form-root" aria-label={isEdit ? "Edit Variant" : "Create Variant"} noValidate>
      {/* Top Banner Navigation (when rendered as standalone page) */}
      {!onCancel && (
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
      )}

      {/* Form Title & Subtitle */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 24, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
          {isEdit ? `Edit Variant: ${formData.sku || `#${variantId}`}` : "Create New Packaging Variant"}
        </h2>
        <p style={{ margin: 0, color: "#555850", fontSize: 13 }}>
          Configure net weight, retail pricing, packaging presentation, and warehouse stock units.
        </p>
      </div>

      {/* Global Alerts */}
      {formError && (
        <div
          role="alert"
          style={{
            background: "#fdf3f2",
            border: "1px solid #f1c1bd",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#8f2f2a",
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} flex-shrink={0} />
          <span>{formError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            background: "#f2f7f3",
            border: "1px solid #c2dec5",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#23483a",
            fontSize: 13,
          }}
        >
          <CheckCircle size={18} flex-shrink={0} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Section 1: Associated Tea Product */}
      <fieldset
        style={{
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          background: "#ffffff",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <legend style={{ fontWeight: 700, fontSize: 14, color: "#1d2a24", padding: "0 6px" }}>
          Tea Lot &amp; Product Assignment
        </legend>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="variant-product-select" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d" }}>
            Select Tea Product *
          </label>
          <select
            id="variant-product-select"
            value={formData.product_id}
            disabled={loadingProducts || (isEdit && Boolean(variantId))}
            onChange={(e) => setFormData((prev) => ({ ...prev, product_id: Number(e.target.value) }))}
            aria-invalid={Boolean(fieldErrors.product)}
            aria-describedby={fieldErrors.product ? "variant-product-error" : "variant-product-hint"}
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              border: `1px solid ${fieldErrors.product ? "#8f2f2a" : "#c9c2b6"}`,
              fontSize: 14,
              background: isEdit ? "#f6f1e7" : "#ffffff",
            }}
          >
            {loadingProducts ? (
              <option value="0">Loading products catalog…</option>
            ) : products.length === 0 ? (
              <option value="0">No products found. Please create a product first.</option>
            ) : (
              products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.estate ? `(${p.estate})` : ""} · {p.category} [ID: #{p.id}]
                </option>
              ))
            )}
          </select>
          {fieldErrors.product ? (
            <span id="variant-product-error" role="alert" style={{ fontSize: 12, color: "#8f2f2a" }}>
              {fieldErrors.product}
            </span>
          ) : (
            <small id="variant-product-hint" style={{ fontSize: 11, color: "#6a6e64" }}>
              Assigning this variant attaches pricing, stock, and weights to the tea dossier.
            </small>
          )}

          {selectedProduct && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                background: "#fbf8f1",
                border: "1px solid #ede9df",
                borderRadius: 6,
                display: "flex",
                gap: 16,
                alignItems: "center",
                fontSize: 12,
                color: "#494a44",
              }}
            >
              <Package size={18} color="#23483a" />
              <div>
                <strong>{selectedProduct.name}</strong> · Category: <em>{selectedProduct.category}</em>
                {selectedProduct.estate ? ` · Estate: ${selectedProduct.estate}` : ""}
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {/* Section 2: SKU & Packaging Presentation */}
      <fieldset
        style={{
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          background: "#ffffff",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <legend style={{ fontWeight: 700, fontSize: 14, color: "#1d2a24", padding: "0 6px" }}>
          SKU Code &amp; Packaging Format
        </legend>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 18 }}>
          {/* SKU Code Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="variant-sku-input" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d" }}>
                Stock Keeping Unit (SKU) *
              </label>
              <button
                type="button"
                onClick={generateSmartSku}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#b36b3d",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                  cursor: "pointer",
                }}
                title="Auto-generate SKU based on product, format and grams"
              >
                <Sparkles size={13} />
                <span>Suggest SKU</span>
              </button>
            </div>
            <input
              id="variant-sku-input"
              type="text"
              required
              value={formData.sku}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setFormData((prev) => ({ ...prev, sku: val }));
                setFieldErrors((prev) => ({ ...prev, sku: "" }));
              }}
              placeholder="e.g. DARJ-POUCH-100G"
              aria-invalid={Boolean(fieldErrors.sku)}
              aria-describedby={fieldErrors.sku ? "variant-sku-error" : "variant-sku-hint"}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${fieldErrors.sku ? "#8f2f2a" : "#c9c2b6"}`,
                fontSize: 14,
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            />
            {fieldErrors.sku ? (
              <span id="variant-sku-error" role="alert" style={{ fontSize: 12, color: "#8f2f2a" }}>
                {fieldErrors.sku}
              </span>
            ) : (
              <small id="variant-sku-hint" style={{ fontSize: 11, color: "#6a6e64" }}>
                Must be uppercase letters, numbers, and hyphens (3–24 chars).
              </small>
            )}
          </div>
        </div>

        {/* Packaging Format Selection Cards */}
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#2d332d", display: "block", marginBottom: 8 }}>
            Packaging Format *
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {PACKAGING_OPTIONS.map((opt) => {
              const isSelected = formData.packaging_format === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setFormData((prev) => ({ ...prev, packaging_format: opt.id }))}
                  aria-pressed={isSelected}
                  style={{
                    padding: 14,
                    borderRadius: 6,
                    border: isSelected ? "2px solid #23483a" : "1px solid #d9d4c8",
                    background: isSelected ? "rgba(35, 72, 58, 0.05)" : "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    transition: "all 150ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <strong style={{ fontSize: 13, color: isSelected ? "#23483a" : "#1d2a24" }}>
                      {opt.label}
                    </strong>
                  </div>
                  <span style={{ fontSize: 11, color: "#6a6e64", lineHeight: 1.4 }}>
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* Section 3: Weight, Cupping Servings, Price & Stock */}
      <fieldset
        style={{
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          background: "#ffffff",
          padding: 20,
          marginBottom: 24,
        }}
      >
        <legend style={{ fontWeight: 700, fontSize: 14, color: "#1d2a24", padding: "0 6px" }}>
          Specifications, Pricing &amp; Inventory
        </legend>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {/* Net Weight (Grams) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="variant-grams-input" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d", display: "flex", alignItems: "center", gap: 6 }}>
              <Scale size={15} color="#6a6e64" />
              <span>Net Weight (Grams) *</span>
            </label>
            <input
              id="variant-grams-input"
              type="number"
              min="1"
              required
              value={formData.grams || ""}
              onChange={(e) => handleGramsChange(Number(e.target.value))}
              aria-invalid={Boolean(fieldErrors.grams)}
              aria-describedby={fieldErrors.grams ? "variant-grams-error" : undefined}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${fieldErrors.grams ? "#8f2f2a" : "#c9c2b6"}`,
                fontSize: 14,
              }}
            />
            {fieldErrors.grams && (
              <span id="variant-grams-error" role="alert" style={{ fontSize: 12, color: "#8f2f2a" }}>
                {fieldErrors.grams}
              </span>
            )}
            {/* Quick Weight Chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {WEIGHT_PRESETS.map((w) => (
                <button
                  type="button"
                  key={w}
                  onClick={() => handleGramsChange(w)}
                  style={{
                    background: formData.grams === w ? "#23483a" : "#ede9df",
                    color: formData.grams === w ? "#ffffff" : "#1d2a24",
                    border: "none",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {w}g
                </button>
              ))}
            </div>
          </div>

          {/* Cup Servings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="variant-servings-input" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d", display: "flex", alignItems: "center", gap: 6 }}>
              <Coffee size={15} color="#6a6e64" />
              <span>Cup Servings *</span>
            </label>
            <input
              id="variant-servings-input"
              type="number"
              min="1"
              max="1000"
              required
              value={formData.servings || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, servings: Number(e.target.value) }))}
              aria-invalid={Boolean(fieldErrors.servings)}
              aria-describedby={fieldErrors.servings ? "variant-servings-error" : "variant-servings-hint"}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${fieldErrors.servings ? "#8f2f2a" : "#c9c2b6"}`,
                fontSize: 14,
              }}
            />
            {fieldErrors.servings ? (
              <span id="variant-servings-error" role="alert" style={{ fontSize: 12, color: "#8f2f2a" }}>
                {fieldErrors.servings}
              </span>
            ) : (
              <small id="variant-servings-hint" style={{ fontSize: 11, color: "#6a6e64" }}>
                Approximate brew cups (standard 2g per infusion).
              </small>
            )}
          </div>

          {/* Retail Price in Rupees (₹) with Paise preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="variant-price-input" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d", display: "flex", alignItems: "center", gap: 6 }}>
              <IndianRupee size={15} color="#6a6e64" />
              <span>Retail Price (₹ Rupees) *</span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#6a6e64",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ₹
              </span>
              <input
                id="variant-price-input"
                type="number"
                step="0.01"
                min="0"
                required
                value={priceRupees}
                onChange={(e) => handleRupeesChange(e.target.value)}
                aria-invalid={Boolean(fieldErrors.price)}
                aria-describedby={fieldErrors.price ? "variant-price-error" : "variant-price-hint"}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 28px",
                  borderRadius: 6,
                  border: `1px solid ${fieldErrors.price ? "#8f2f2a" : "#c9c2b6"}`,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
            </div>
            {fieldErrors.price ? (
              <span id="variant-price-error" role="alert" style={{ fontSize: 12, color: "#8f2f2a" }}>
                {fieldErrors.price}
              </span>
            ) : (
              <small id="variant-price-hint" style={{ fontSize: 11, color: "#23483a", fontWeight: 500 }}>
                Stored as <strong>{formData.price_paise.toLocaleString()} paise</strong> on server.
              </small>
            )}
          </div>

          {/* Original / Strike-through Price for Promotional Discount */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="variant-compare-price-input" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d", display: "flex", alignItems: "center", gap: 6 }}>
              <IndianRupee size={15} color="#6a6e64" />
              <span>Original / MRP (₹ Rupees) <span style={{ fontWeight: 400, color: "#6a7366" }}>(Optional Discount Option)</span></span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#6a6e64",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ₹
              </span>
              <input
                id="variant-compare-price-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Leave blank for regular price"
                value={comparePriceRupees}
                onChange={(e) => handleComparePriceChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 28px",
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              />
            </div>
            {formData.compare_at_price_paise && formData.compare_at_price_paise > formData.price_paise ? (
              <small style={{ fontSize: 11, color: "#1d5f38", fontWeight: 600 }}>
                {Math.round(((formData.compare_at_price_paise - formData.price_paise) / formData.compare_at_price_paise) * 100)}% discount badge and strike-through price will display on product cards.
              </small>
            ) : (
              <small style={{ fontSize: 11, color: "#6a7366" }}>
                Setting a higher original price enables the strike-through discount option on all product shelf cards.
              </small>
            )}
          </div>

          {/* Warehouse Stock Units */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="variant-stock-input" style={{ fontSize: 13, fontWeight: 600, color: "#2d332d", display: "flex", alignItems: "center", gap: 6 }}>
              <Boxes size={15} color="#6a6e64" />
              <span>Warehouse Stock (Units) *</span>
            </label>
            <input
              id="variant-stock-input"
              type="number"
              min="0"
              required
              value={formData.stock !== undefined ? formData.stock : ""}
              onChange={(e) => {
                const stock = Math.max(0, parseInt(e.target.value || "0", 10));
                setFormData((prev) => ({ ...prev, stock }));
                setFieldErrors((prev) => ({ ...prev, stock: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.stock)}
              aria-describedby={fieldErrors.stock ? "variant-stock-error" : undefined}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${fieldErrors.stock ? "#8f2f2a" : "#c9c2b6"}`,
                fontSize: 14,
                fontWeight: 600,
              }}
            />
            {fieldErrors.stock && (
              <span id="variant-stock-error" role="alert" style={{ fontSize: 12, color: "#8f2f2a" }}>
                {fieldErrors.stock}
              </span>
            )}
            {/* Quick Stock Chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {STOCK_PRESETS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setFormData((prev) => ({ ...prev, stock: s }))}
                  style={{
                    background: formData.stock === s ? "#23483a" : "#ede9df",
                    color: formData.stock === s ? "#ffffff" : "#1d2a24",
                    border: "none",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s === 0 ? "0 (Sold out)" : s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {/* Action Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          paddingTop: 16,
          borderTop: "1px solid #d9d4c8",
        }}
      >
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="button button-outline"
            style={{ minHeight: 42, padding: "8px 18px" }}
          >
            Cancel
          </button>
        ) : (
          <Link
            href="/admin/variants"
            className="button button-outline"
            style={{ minHeight: 42, padding: "8px 18px", textDecoration: "none" }}
          >
            Cancel
          </Link>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="button button-primary"
          style={{ minHeight: 42, padding: "8px 24px", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          {isSubmitting ? (
            <>
              <progress
                aria-label="Saving variant"
                className="loading-spinner"
                style={{ width: 16, height: 16 }}
              />
              <span>Saving Variant…</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{isEdit ? "Update Variant" : "Create Variant"}</span>
            </>
          )}
        </button>
      </div>

      <style>{`
        progress.loading-spinner:indeterminate {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
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
    </form>
  );
}
