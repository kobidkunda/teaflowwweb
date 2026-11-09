"use client";

import { ImageFieldWithPicker } from "../content/homepage/ImageFieldWithPicker";
import { teaMomentsSchema, type TeaMomentsContent } from "@/lib/teaMoments";
import momentStyles from "./TeaMomentsEditor.module.css";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MultiImageUploader, type GalleryImage } from "./MultiImageUploader";
import { ProductPdfSection } from "./ProductPdfSection";
import { SeoControlsSection } from "./SeoControlsSection";
import {
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Eye,
  Sliders,
  Coffee,
  Package,
} from "lucide-react";

export interface VariantFormData {
  id?: number;
  sku: string;
  packaging_format: "loose_leaf_pouch" | "luxury_tin" | "pyramid_bags";
  grams: number;
  price_paise: number;
  compare_at_price_paise?: number | null;
  stock: number;
  servings?: number;
}

export interface ProductFormData {
  tea_moments?: TeaMomentsContent | null;
  id?: number;
  slug: string;
  name: string;
  price?: number;
  category_id: number | null;
  category?: string;
  origin: string;
  verified_origin: string;
  ingredients: string;
  status: "draft" | "published" | "archived";
  estate: string;
  flush: string;
  harvest_date: string;
  description: string;
  tasting_notes: string;
  // Cupping scores 0-5
  floral: number;
  fruity: number;
  malty: number;
  body: number;
  sweetness: number;
  earthy: number;
  aroma_tags: string[];
  // Sensory attributes
  dry_leaf_appearance: string;
  dry_leaf_grade: string;
  dry_leaf_aroma: string;
  liquor_hue_hex: string;
  liquor_hue_name: string;
  liquor_clarity: string;
  liquor_body: string;
  wet_leaf_aroma: string;
  wet_leaf_oxidation: string;
  // Brewing specs
  brew_temp: number;
  brew_seconds: number;
  leaf_dose_grams: number;
  water_ml: number;
  steep_count: number;
  steep_instructions: string;
  // Terroir
  elevation_feet: number;
  elevation_display: string;
  lot_number: string;
  cultivar: string;
  estate_story: string;
  featured: number;
  // SEO fields
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_override?: string | null;
  noindex?: number;
  // Attached PDF Dossier
  pdf_url?: string | null;
  pdf_title?: string | null;
  // Relational
  variants: VariantFormData[];
  images: GalleryImage[];
}

export interface ProductFormProps {
  initialData?: Partial<ProductFormData>;
  isEdit?: boolean;
  productId?: number;
}

const DEFAULT_FORM_DATA: ProductFormData = {
  slug: "",
  name: "",
  price: 199,
  category_id: null,
  category: "",
  origin: "",
  verified_origin: "",
  ingredients: "",
  status: "published",
  estate: "",
  flush: "",
  harvest_date: "",
  description: "",
  tasting_notes: "",
  floral: 0,
  fruity: 0,
  malty: 0,
  body: 0,
  sweetness: 0,
  earthy: 0,
  aroma_tags: [],
  dry_leaf_appearance: "",
  dry_leaf_grade: "",
  dry_leaf_aroma: "",
  liquor_hue_hex: "#b36b3d",
  liquor_hue_name: "",
  liquor_clarity: "",
  liquor_body: "",
  wet_leaf_aroma: "",
  wet_leaf_oxidation: "",
  brew_temp: 90,
  brew_seconds: 180,
  leaf_dose_grams: 2.5,
  water_ml: 200,
  steep_count: 3,
  steep_instructions: "",
  elevation_feet: 0,
  elevation_display: "",
  lot_number: "",
  cultivar: "",
  estate_story: "",
  featured: 0,
  seo_title: "",
  seo_description: "",
  canonical_override: "",
  noindex: 0,
  pdf_url: null,
  pdf_title: null,
  variants: [
    {
      sku: "TEA-100G",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      price_paise: 19900,
      stock: 50,
      servings: 50,
    },
  ],
  images: [],
};

export function ProductForm({ initialData, isEdit = false, productId }: ProductFormProps) {
  const router = useRouter();
  const initialPrice =
    typeof initialData?.price === "number"
      ? initialData.price
      : Array.isArray(initialData?.variants) && initialData.variants.length > 0
      ? Math.round((initialData.variants[0]?.price_paise || 19900) / 100)
      : 199;

  const [formData, setFormData] = useState<ProductFormData>({
    ...DEFAULT_FORM_DATA,
    ...initialData,
    price: initialPrice,
    variants: Array.isArray(initialData?.variants) ? initialData.variants : DEFAULT_FORM_DATA.variants,
    images: Array.isArray(initialData?.images) ? initialData.images : DEFAULT_FORM_DATA.images,
    aroma_tags: Array.isArray(initialData?.aroma_tags) ? initialData.aroma_tags : DEFAULT_FORM_DATA.aroma_tags,
  });

  const [categories, setCategories] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [aromaTagsInput, setAromaTagsInput] = useState(
    Array.isArray(formData.aroma_tags) ? formData.aroma_tags.join(", ") : ""
  );
  const [descPreviewMode, setDescPreviewMode] = useState(false);

  // Load categories on mount
  useEffect(() => {
    let mounted = true;
    async function fetchCats() {
      try {
        const res = await fetch("/api/admin/categories", { credentials: "same-origin" });
        if (mounted && res.ok) {
          const data = await res.json();
          const list = data.categories || [];
          setCategories(list);
          setFormData((prev) => (!prev.category_id && list.length > 0 ? { ...prev, category_id: list[0].id } : prev));
        }
      } catch {
        // Fallback categories list
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }
    void fetchCats();
    return () => {
      mounted = false;
    };
  }, []);

  // Unsaved changes beforeunload handler
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function handleChange<K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleMomentChange(key: keyof TeaMomentsContent, value: string) {
    setIsDirty(true);
    setFormData((previous) => ({ ...previous, tea_moments: {
      headline: "Make it your moment.", introduction: "", occasion: "", serving_suggestion: "", food_pairing: "", image_url: "", image_alt: "",
      ...previous.tea_moments, [key]: value,
    } }));
  }

  function handleNameChange(name: string) {
    setIsDirty(true);
    setFormData((prev) => {
      const updates: Partial<ProductFormData> = { name };
      // Auto-generate slug if not editing or slug was empty/auto
      if (!isEdit || !prev.slug) {
        updates.slug = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      return { ...prev, ...updates };
    });
  }

  function handleAromaTagsChange(value: string) {
    setIsDirty(true);
    setAromaTagsInput(value);
    const tags = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setFormData((prev) => ({ ...prev, aroma_tags: tags }));
  }

  function handleAddVariant() {
    setIsDirty(true);
    const newSku = `${formData.slug.toUpperCase().slice(0, 6) || "TEA"}-${Date.now().toString().slice(-4)}`;
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          sku: newSku,
          packaging_format: "loose_leaf_pouch",
          grams: 250,
          price_paise: 180000,
          stock: 25,
          servings: 100,
        },
      ],
    }));
  }

  function handleUpdateVariant(index: number, patch: Partial<VariantFormData>) {
    setIsDirty(true);
    setFormData((prev) => {
      const nextVars = [...prev.variants];
      nextVars[index] = { ...nextVars[index], ...patch };
      const nextPrice = index === 0 && patch.price_paise !== undefined
        ? Math.round(patch.price_paise / 100)
        : prev.price;
      const oldSku = prev.variants[index]?.sku;
      const images = patch.sku !== undefined && oldSku && patch.sku !== oldSku
        ? prev.images.map((image) => ({ ...image, variant_skus: image.variant_skus?.map((sku) => sku === oldSku ? patch.sku! : sku).filter(Boolean) }))
        : prev.images;
      return { ...prev, price: nextPrice, variants: nextVars, images };
    });
  }

  function handleRemoveVariant(index: number) {
    setIsDirty(true);
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index),
      images: prev.images.map((image) => ({ ...image, variant_skus: image.variant_skus?.filter((sku) => sku !== prev.variants[index]?.sku) })),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // Validation checks
    if (!formData.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!formData.slug.trim()) {
      setFormError("Product slug is required.");
      return;
    }
    if (formData.variants.length === 0) {
      setFormError("At least one packaging variant is required.");
      return;
    }

    if (formData.tea_moments) {
      const checked = teaMomentsSchema.safeParse(formData.tea_moments);
      if (!checked.success) { setFormError(checked.error.issues[0].message); return; }
    }
    setIsSubmitting(true);

    try {
      const targetUrl = isEdit && productId ? `/api/admin/products/${productId}` : "/api/admin/products";
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        ...formData,
        price: Number(formData.price),
        price_paise: Number(formData.price) * 100,
        category_id: formData.category_id || undefined,
        brew_temp: Number(formData.brew_temp),
        brew_seconds: Number(formData.brew_seconds),
        floral: Number(formData.floral),
        fruity: Number(formData.fruity),
        malty: Number(formData.malty),
        body: Number(formData.body),
        sweetness: Number(formData.sweetness),
        earthy: Number(formData.earthy),
        featured: formData.featured ? 1 : 0,
      };

      const res = await fetch(targetUrl, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as { error?: string; fieldErrors?: Record<string, string[]> } | null;
        let msg = errorData?.error || "Save failed. Please review the highlighted fields.";
        if (errorData?.fieldErrors) {
          const firstErr = Object.values(errorData.fieldErrors)[0]?.[0];
          if (firstErr) msg += ` (${firstErr})`;
        }
        setFormError(msg);
        setIsSubmitting(false);
        return;
      }

      const resData = (await res.json()) as { id?: number; product?: { id: number } };
      const savedId = resData.id || resData.product?.id || productId;

      setIsDirty(false);
      setSuccessMessage(isEdit ? "Product updated successfully!" : "Product created successfully!");

      setTimeout(() => {
        if (savedId) {
          router.push(`/admin/products/${savedId}`);
        } else {
          router.push("/admin/products");
        }
      }, 500);
    } catch {
      setFormError("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-product-form" onSubmit={handleSubmit} style={{ maxWidth: 1100 }}>
      {/* Top Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid #d9d4c8",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href={isEdit && productId ? `/admin/products/${productId}` : "/admin/products"}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <ArrowLeft size={15} />
            <span>Cancel</span>
          </Link>
          <h2 style={{ margin: 0, fontSize: 20, color: "#1d2a24", fontFamily: "Georgia, serif" }}>
            {isEdit ? `Edit: ${formData.name || "Product"}` : "Create New Product"}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isDirty && (
            <span style={{ fontSize: 12, color: "#b36b3d", fontWeight: 600 }}>Unsaved changes</span>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40 }}
          >
            <Save size={16} />
            <span>{isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {formError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "#fdf3f2",
            border: "1px solid #f2c7c5",
            borderRadius: 6,
            color: "#8f2f2a",
            marginBottom: 20,
          }}
        >
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "#edf7ed",
            border: "1px solid #c8e6c9",
            borderRadius: 6,
            color: "#2e7d32",
            marginBottom: 20,
          }}
        >
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
        {/* Section 1: Basic Information */}
        <section
          style={{
            background: "#fbf8f1",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1d2a24",
              marginTop: 0,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Package size={18} color="#23483a" />
            <span>Basic Product Details</span>
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Product Title *</span>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Risheehat Golden Summer FTGFOP1"
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>URL Slug *</span>
              <input
                type="text"
                required
                pattern="^[a-z0-9\-]+$"
                value={formData.slug}
                onChange={(e) => handleChange("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="e.g. risheehat-golden-summer"
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Price (₹) *</span>
              <input
                type="number"
                min={0}
                step="1"
                required
                value={formData.price}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setIsDirty(true);
                  setFormData((prev) => {
                    const nextVars = prev.variants.length > 0
                      ? prev.variants.map((v, idx) => idx === 0 ? { ...v, price_paise: val * 100 } : v)
                      : [{
                          sku: `${prev.slug.toUpperCase().slice(0, 8) || "TEA"}-100G`,
                          packaging_format: "loose_leaf_pouch" as const,
                          grams: 100,
                          price_paise: val * 100,
                          stock: 50,
                          servings: 50,
                        }];
                    return {
                      ...prev,
                      price: val,
                      variants: nextVars,
                    };
                  });
                }}
                placeholder="199"
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Category</span>
              <select
                value={formData.category_id || ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  handleChange("category_id", val);
                  const selectedCat = categories.find((c) => c.id === val);
                  if (selectedCat) handleChange("category", selectedCat.name);
                }}
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14, background: "#ffffff" }}
              >
                {loadingCategories && <option value="">Loading categories…</option>}
                {!loadingCategories && categories.length === 0 && <option value="">No categories created yet</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Publication Status</span>
              <select
                value={formData.status || "published"}
                onChange={(e) => handleChange("status", e.target.value as "draft" | "published" | "archived")}
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14, background: "#ffffff" }}
              >
                <option value="published">Published (Live on Storefront)</option>
                <option value="draft">Draft (Hidden from Storefront)</option>
                <option value="archived">Archived (Catalog Inactive)</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Ingredients</span>
              <input
                type="text"
                value={formData.ingredients || ""}
                onChange={(e) => handleChange("ingredients", e.target.value)}
                placeholder="e.g. 100% Pure Whole-Leaf Black Tea (Camellia Sinensis)"
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14 }}
              />
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
              <input
                type="checkbox"
                id="featured-toggle"
                checked={formData.featured === 1}
                onChange={(e) => handleChange("featured", e.target.checked ? 1 : 0)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label htmlFor="featured-toggle" style={{ fontSize: 14, fontWeight: 600, color: "#1d2a24", cursor: "pointer" }}>
                Feature on Storefront Homepage
              </label>
            </div>
          </div>

          {/* Editorial Description */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                <span>Editorial Description & Storytelling (Markdown/HTML)</span>
              </label>
              <button
                type="button"
                onClick={() => setDescPreviewMode(!descPreviewMode)}
                className="button button-outline"
                style={{ padding: "2px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Eye size={12} />
                <span>{descPreviewMode ? "Edit Raw" : "Preview"}</span>
              </button>
            </div>

            {descPreviewMode ? (
              <div
                style={{
                  border: "1px solid #c9c2b6",
                  borderRadius: 4,
                  padding: 16,
                  minHeight: 120,
                  background: "#ffffff",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {formData.description ? (
                  <div dangerouslySetInnerHTML={{ __html: formData.description.replace(/\n/g, "<br/>") }} />
                ) : (
                  <em style={{ color: "#9ea399" }}>No description provided.</em>
                )}
              </div>
            ) : (
              <textarea
                rows={5}
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe this tea and its character..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14, boxSizing: "border-box" }}
              />
            )}
          </div>
        </section>

        {/* Section 2: Media & Gallery */}
        <section
          style={{
            background: "#fbf8f1",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1d2a24",
              marginTop: 0,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>Product Imagery & Gallery (Zero Modals)</span>
          </h3>
          <MultiImageUploader
            images={formData.images}
            variants={formData.variants}
            onChange={(imgs) => handleChange("images", imgs)}
          />
        </section>

        {/* Section: Estate Batch Dossier & Certification (PDF) */}
        <ProductPdfSection
          pdfUrl={formData.pdf_url}
          pdfTitle={formData.pdf_title}
          onPdfChange={(url, title) => {
            setIsDirty(true);
            setFormData((prev) => ({
              ...prev,
              pdf_url: url,
              pdf_title: title,
            }));
          }}
        />

        {/* Section 3: Professional Cupping & Sensory Profile */}
        <section
          style={{
            background: "#fbf8f1",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1d2a24",
              marginTop: 0,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Sliders size={18} color="#23483a" />
            <span>Professional Sensory Cupping & Tasting Profile</span>
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16, marginBottom: 20 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Tasting Notes Summary</span>
              <input
                type="text"
                value={formData.tasting_notes}
                onChange={(e) => handleChange("tasting_notes", e.target.value)}
                placeholder="e.g. Muscatel grape, wild honey, cedarwood"
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Aroma Tags (comma-separated)</span>
              <input
                type="text"
                value={aromaTagsInput}
                onChange={(e) => handleAromaTagsChange(e.target.value)}
                placeholder="Muscatel, Lilac, Apricot"
                style={{ padding: "8px 12px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 14 }}
              />
            </label>
          </div>

          {/* Cupping 0-5 Integer Ratings */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24", marginBottom: 12 }}>
              Sensory Ratings (0 to 5)
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                gap: 16,
                background: "#f6f1e7",
                padding: 16,
                borderRadius: 6,
              }}
            >
              {[
                { key: "floral", label: "Floral" },
                { key: "fruity", label: "Fruity" },
                { key: "malty", label: "Malty" },
                { key: "body", label: "Body" },
                { key: "sweetness", label: "Sweetness" },
                { key: "earthy", label: "Earthy" },
              ].map(({ key, label }) => {
                const val = formData[key as keyof ProductFormData] as number;
                return (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                      <span>{label}</span>
                      <span style={{ color: "#23483a", fontWeight: 700 }}>{val} / 5</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={1}
                      value={val}
                      onChange={(e) => handleChange(key as keyof ProductFormData, Number(e.target.value) as never)}
                      style={{ cursor: "pointer" }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3-Stage Cupping Evaluation */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
            {/* Dry Leaf */}
            <div style={{ background: "#ffffff", padding: 16, borderRadius: 6, border: "1px solid #d9d4c8" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#23483a", fontWeight: 700 }}>
                1. Dry Leaf Profile
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Grade
                  <input
                    type="text"
                    value={formData.dry_leaf_grade}
                    onChange={(e) => handleChange("dry_leaf_grade", e.target.value)}
                    placeholder="e.g. FTGFOP1"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Visual Appearance
                  <input
                    type="text"
                    value={formData.dry_leaf_appearance}
                    onChange={(e) => handleChange("dry_leaf_appearance", e.target.value)}
                    placeholder="e.g. Silvery tippy whole leaves"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Dry Aroma
                  <input
                    type="text"
                    value={formData.dry_leaf_aroma}
                    onChange={(e) => handleChange("dry_leaf_aroma", e.target.value)}
                    placeholder="e.g. Delicate orchid and honey"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                  />
                </label>
              </div>
            </div>

            {/* Liquor */}
            <div style={{ background: "#ffffff", padding: 16, borderRadius: 6, border: "1px solid #d9d4c8" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#23483a", fontWeight: 700 }}>
                2. Liquor Hue & Character
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <label style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
                    Hue Color (Hex)
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <input
                        type="color"
                        value={formData.liquor_hue_hex}
                        onChange={(e) => handleChange("liquor_hue_hex", e.target.value)}
                        style={{ width: 36, height: 32, padding: 0, border: "1px solid #c9c2b6", borderRadius: 4, cursor: "pointer" }}
                      />
                      <input
                        type="text"
                        value={formData.liquor_hue_hex}
                        onChange={(e) => handleChange("liquor_hue_hex", e.target.value)}
                        style={{ width: 90, padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                      />
                    </div>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, flex: 2 }}>
                    Hue Name
                    <input
                      type="text"
                      value={formData.liquor_hue_name}
                      onChange={(e) => handleChange("liquor_hue_name", e.target.value)}
                      placeholder="e.g. Golden Amber"
                      style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4, marginTop: 4 }}
                    />
                  </label>
                </div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Clarity & Body
                  <input
                    type="text"
                    value={formData.liquor_clarity}
                    onChange={(e) => handleChange("liquor_clarity", e.target.value)}
                    placeholder="e.g. Brilliant, medium body"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                  />
                </label>
              </div>
            </div>

            {/* Wet Leaf */}
            <div style={{ background: "#ffffff", padding: 16, borderRadius: 6, border: "1px solid #d9d4c8" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#23483a", fontWeight: 700 }}>
                3. Wet Leaf (Infusion)
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Infusion Aroma
                  <input
                    type="text"
                    value={formData.wet_leaf_aroma}
                    onChange={(e) => handleChange("wet_leaf_aroma", e.target.value)}
                    placeholder="e.g. Sweet mountain meadow"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Oxidation Character
                  <input
                    type="text"
                    value={formData.wet_leaf_oxidation}
                    onChange={(e) => handleChange("wet_leaf_oxidation", e.target.value)}
                    placeholder="e.g. 20% oxidised"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #c9c2b6", borderRadius: 4 }}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Steeping & Terroir Dossier */}
        <section
          style={{
            background: "#fbf8f1",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1d2a24",
              marginTop: 0,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Coffee size={18} color="#23483a" />
            <span>Interactive Steeping Guide</span>
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 16, marginBottom: 20 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Brew Temp (°C) *</span>
              <input
                type="number"
                min={50}
                max={100}
                required
                value={formData.brew_temp}
                onChange={(e) => handleChange("brew_temp", Number(e.target.value))}
                style={{ padding: "6px 10px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 13 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Steep Time (Seconds) *</span>
              <input
                type="number"
                min={30}
                max={600}
                required
                value={formData.brew_seconds}
                onChange={(e) => handleChange("brew_seconds", Number(e.target.value))}
                style={{ padding: "6px 10px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 13 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Leaf Dose (Grams)</span>
              <input
                type="number"
                step="0.5"
                min={0.5}
                max={20}
                value={formData.leaf_dose_grams}
                onChange={(e) => handleChange("leaf_dose_grams", Number(e.target.value))}
                style={{ padding: "6px 10px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 13 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Water (ml)</span>
              <input
                type="number"
                min={50}
                max={2000}
                value={formData.water_ml}
                onChange={(e) => handleChange("water_ml", Number(e.target.value))}
                style={{ padding: "6px 10px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 13 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Re-steep Count</span>
              <input
                type="number"
                min={1}
                max={10}
                value={formData.steep_count}
                onChange={(e) => handleChange("steep_count", Number(e.target.value))}
                style={{ padding: "6px 10px", border: "1px solid #c9c2b6", borderRadius: 4, fontSize: 13 }}
              />
            </label>
          </div>


        </section>

        <section className={momentStyles.editor} aria-labelledby="tea-moments-editor-title" style={{ background: "#fbf8f1", padding: 24, border: "1px solid #d9d4c8", borderRadius: 8 }}>
          <h3 id="tea-moments-editor-title">Tea Moments</h3>
          <p>Curate a moment for this tea. The storefront section appears only after you save an introduction. Leave optional recommendations empty when unavailable.</p>
          <div style={{ display: "grid", gap: 16 }}>
            {([
              ["headline", "Headline", 120], ["introduction", "Introduction", 1200],
              ["occasion", "The moment", 300], ["serving_suggestion", "Serve it your way", 300], ["food_pairing", "Pair it with", 300],
            ] as const).map(([key, label, limit]) => (
              <div key={key} style={{ display: "grid", gap: 6 }}>
                <label htmlFor={`moments-${key}`}>{label}</label>
                <textarea id={`moments-${key}`} rows={key === "introduction" ? 4 : 2} maxLength={limit}
                  value={formData.tea_moments?.[key] ?? (key === "headline" ? "Make it your moment." : "")}
                  onChange={(event) => handleMomentChange(key, event.target.value)} />
              </div>
            ))}
            <ImageFieldWithPicker id="tea-moments-image" label="Tea Moments image" imageUrl={formData.tea_moments?.image_url || ""}
              imageAlt={formData.tea_moments?.image_alt || ""} onImageUrlChange={(url) => handleMomentChange("image_url", url)}
              onImageAltChange={(alt) => handleMomentChange("image_alt", alt)} aspectRatioHint="4:5 portrait" previewAspectRatio="4 / 5"
              recommendation="1200 × 1500 px · WebP or JPEG, preferably under 400 KB" disabled={isSubmitting} />
            <button type="button" className="button button-outline" onClick={() => handleChange("tea_moments", null)}>Clear Tea Moments</button>
          </div>
        </section>

        {/* Section 5: Packaging & Variants */}
        <section
          style={{
            background: "#fbf8f1",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24", margin: 0 }}>
              Packaging Formats & Variants ({formData.variants.length})
            </h3>
            <button
              type="button"
              onClick={handleAddVariant}
              className="button button-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <Plus size={14} />
              <span>Add Variant</span>
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Format</th>
                  <th>Weight (g)</th>
                  <th>Price (₹)</th>
                  <th>Original MRP (₹)</th>
                  <th>Stock</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.variants.map((v, idx) => (
                  <tr key={v.sku + idx}>
                    <td>
                      <input
                        type="text"
                        required
                        value={v.sku}
                        onChange={(e) => handleUpdateVariant(idx, { sku: e.target.value.toUpperCase() })}
                        style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #c9c2b6", borderRadius: 4 }}
                      />
                    </td>
                    <td>
                      <select
                        value={v.packaging_format}
                        onChange={(e) => handleUpdateVariant(idx, { packaging_format: e.target.value as VariantFormData["packaging_format"] })}
                        style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #c9c2b6", borderRadius: 4, background: "#ffffff" }}
                      >
                        <option value="loose_leaf_pouch">Loose Leaf Pouch</option>
                        <option value="luxury_tin">Luxury Caddy Tin</option>
                        <option value="pyramid_bags">Pyramid Bags</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={v.grams}
                        onChange={(e) => handleUpdateVariant(idx, { grams: Number(e.target.value) })}
                        style={{ width: 80, padding: "4px 8px", fontSize: 12, border: "1px solid #c9c2b6", borderRadius: 4 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={Math.round(v.price_paise / 100)}
                        onChange={(e) => handleUpdateVariant(idx, { price_paise: Number(e.target.value) * 100 })}
                        style={{ width: 80, padding: "4px 8px", fontSize: 12, border: "1px solid #c9c2b6", borderRadius: 4 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Optional"
                        value={v.compare_at_price_paise ? Math.round(v.compare_at_price_paise / 100) : ""}
                        onChange={(e) => handleUpdateVariant(idx, { compare_at_price_paise: e.target.value ? Number(e.target.value) * 100 : null })}
                        style={{ width: 80, padding: "4px 8px", fontSize: 12, border: "1px solid #c9c2b6", borderRadius: 4 }}
                        title="Optional strike-through original price for discount display"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={v.stock}
                        onChange={(e) => handleUpdateVariant(idx, { stock: Number(e.target.value) })}
                        style={{ width: 70, padding: "4px 8px", fontSize: 12, border: "1px solid #c9c2b6", borderRadius: 4 }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={formData.variants.length <= 1}
                        onClick={() => handleRemoveVariant(idx)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#8f2f2a",
                          cursor: formData.variants.length <= 1 ? "not-allowed" : "pointer",
                          opacity: formData.variants.length <= 1 ? 0.3 : 1,
                        }}
                        title="Delete variant"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6: Dedicated SEO Controls & Live SERP Preview */}
        <section>
          <SeoControlsSection
            seoTitle={formData.seo_title}
            onSeoTitleChange={(val) => handleChange("seo_title", val)}
            seoDescription={formData.seo_description}
            onSeoDescriptionChange={(val) => handleChange("seo_description", val)}
            canonicalOverride={formData.canonical_override}
            onCanonicalOverrideChange={(val) => handleChange("canonical_override", val)}
            noindex={formData.noindex}
            onNoindexChange={(val) => handleChange("noindex", val ? 1 : 0)}
            defaultTitle={formData.name || "Product Name"}
            defaultDescription={formData.description || formData.tasting_notes}
            defaultPath={`/tea/${formData.slug || "product-slug"}`}
          />
        </section>

        {/* Bottom Save Action */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
          <Link
            href={isEdit && productId ? `/admin/products/${productId}` : "/admin/products"}
            className="button button-outline"
            style={{ minHeight: 44, padding: "0 20px" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="button button-primary"
            style={{ minHeight: 44, padding: "0 24px", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Save size={16} />
            <span>{isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
