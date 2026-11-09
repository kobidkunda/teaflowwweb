"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  Lock,
  Unlock,
  Image as ImageIcon,
  Layers,
  Globe,
  FileText,
} from "lucide-react";
import { MediaPicker } from "./MediaPicker";

export interface CategoryFormData {
  id?: number;
  slug: string;
  name: string;
  description: string;
  cover_image_url: string;
  parent_id: number | null;
  sort_order: number;
  is_active: number;
}

export interface CategoryFormProps {
  initialData?: Partial<CategoryFormData>;
  isEdit?: boolean;
  categoryId?: number;
  defaultParentId?: number | null;
}

const DEFAULT_CATEGORY_DATA: CategoryFormData = {
  slug: "",
  name: "",
  description: "",
  cover_image_url: "",
  parent_id: null,
  sort_order: 0,
  is_active: 1,
};

export function CategoryForm({
  initialData,
  isEdit = false,
  categoryId,
  defaultParentId = null,
}: CategoryFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<CategoryFormData>(() => ({
    ...DEFAULT_CATEGORY_DATA,
    parent_id: defaultParentId ?? null,
    ...initialData,
  }));

  const [parentCategories, setParentCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingParents, setLoadingParents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Slug generator lock state: locked by default on create (syncs with name), unlocked on edit
  const [isSlugLocked, setIsSlugLocked] = useState<boolean>(!isEdit);

  // Media upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchCategories() {
      try {
        const res = await fetch("/api/admin/categories", { credentials: "same-origin" });
        if (mounted && res.ok) {
          const data = (await res.json()) as { categories?: Array<{ id: number; name: string }> };
          const list = (data.categories || []).filter((c) => !categoryId || c.id !== categoryId);
          setParentCategories(list);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoadingParents(false);
      }
    }
    void fetchCategories();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  // Prevent accidental navigation when form has unsaved modifications
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

  function handleNameChange(name: string) {
    setIsDirty(true);
    setFormData((prev) => {
      const updates: Partial<CategoryFormData> = { name };
      if (isSlugLocked) {
        updates.slug = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      return { ...prev, ...updates };
    });
  }

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image file (WebP, AVIF, JPEG, PNG).");
      return;
    }

    setUploadingImage(true);
    setFormError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("alt_text", `${formData.name || "Category"} banner artwork`);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string; upload?: { url: string }; asset?: { url: string } };
        const url = data.url || data.upload?.url || data.asset?.url;
        if (url) {
          setIsDirty(true);
          setFormData((prev) => ({ ...prev, cover_image_url: url }));
        }
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(err?.error || "Image upload failed. SVG files are restricted for security.");
      }
    } catch {
      setFormError("Network error while uploading cover image.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const trimmedName = formData.name.trim();
    const trimmedSlug = formData.slug.trim();

    if (!trimmedName) {
      setFormError("Category name is required.");
      return;
    }
    if (!trimmedSlug) {
      setFormError("Category slug is required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setFormError("URL Slug can only contain lowercase letters, numbers, and hyphens.");
      return;
    }

    setIsSubmitting(true);

    try {
      const targetUrl = isEdit && categoryId ? `/api/admin/categories/${categoryId}` : "/api/admin/categories";
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        name: trimmedName,
        slug: trimmedSlug,
        description: formData.description.trim(),
        cover_image_url: formData.cover_image_url.trim() || null,
        parent_id: formData.parent_id || null,
        sort_order: Number(formData.sort_order),
        is_active: formData.is_active ? 1 : 0,
      };

      const res = await fetch(targetUrl, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(errData?.error || "Unable to save category. Please check your fields.");
        setIsSubmitting(false);
        return;
      }

      const resData = (await res.json()) as { id?: number; category?: { id: number } };
      const savedId = resData.id || resData.category?.id || categoryId;

      setIsDirty(false);
      setSuccessMessage(isEdit ? "Category updated successfully!" : "Category created successfully!");

      setTimeout(() => {
        if (savedId) {
          router.push(`/admin/categories/${savedId}`);
        } else {
          router.push("/admin/categories");
        }
      }, 400);
    } catch {
      setFormError("Network error. Please verify your connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="admin-category-form"
      onSubmit={handleSubmit}
      style={{ maxWidth: 880, margin: "0 auto" }}
      aria-label={isEdit ? `Edit category ${formData.name}` : "Create new category"}
    >
      {/* Top Header Navigation */}
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
            href={isEdit && categoryId ? `/admin/categories/${categoryId}` : "/admin/categories"}
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
            <span>Cancel</span>
          </Link>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                color: "#1d2a24",
                fontFamily: "Georgia, serif",
                letterSpacing: "-0.01em",
              }}
            >
              {isEdit ? `Edit Category: ${formData.name || "Untitled"}` : "Create New Category"}
            </h1>
            <p style={{ margin: "2px 0 0 0", color: "#6a6e64", fontSize: 13 }}>
              {isEdit ? "Update taxonomy settings, cover artwork, and hierarchy" : "Add a new tea variety or regional sub-collection"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isDirty && (
            <span
              style={{
                fontSize: 12,
                color: "#b36b3d",
                fontWeight: 600,
                background: "rgba(179, 107, 61, 0.1)",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              Unsaved changes
            </span>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              padding: "0 20px",
              background: "#1d2a24",
              color: "#ffffff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            }}
          >
            <Save size={16} />
            <span>{isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Category"}</span>
          </button>
        </div>
      </div>

      {/* Error & Success Feedback Banners */}
      {formError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            background: "#fdf3f2",
            border: "1px solid #f2c7c5",
            borderRadius: 8,
            color: "#8f2f2a",
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{formError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            background: "#edf7ed",
            border: "1px solid #c8e6c9",
            borderRadius: 8,
            color: "#2e7d32",
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Form Fields Container */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* FIELDSET 1: Basic Information */}
        <fieldset
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            margin: 0,
          }}
        >
          <legend
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileText size={16} color="#697a55" />
            <span>1. Basic Information</span>
          </legend>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Category Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="category-name-input"
                  style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}
                >
                  Category Name <span style={{ color: "#8f2f2a" }}>*</span>
                </label>
                <input
                  id="category-name-input"
                  type="text"
                  required
                  autoCapitalize="words"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Single-Estate Black Tea"
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #c9c2b6",
                    borderRadius: 6,
                    fontSize: 14,
                    background: "#faf7f2",
                  }}
                  aria-describedby="category-name-help"
                />
                <span id="category-name-help" style={{ fontSize: 12, color: "#6a6e64" }}>
                  Customer-facing family name displayed on storefront navigation.
                </span>
              </div>

              {/* URL Slug with Lock / Unlock */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label
                    htmlFor="category-slug-input"
                    style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}
                  >
                    URL Slug <span style={{ color: "#8f2f2a" }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSlugLocked(!isSlugLocked)}
                    style={{
                      fontSize: 11,
                      color: isSlugLocked ? "#23483a" : "#b36b3d",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 600,
                    }}
                    title={isSlugLocked ? "Slug automatically syncs with Name" : "Slug is custom unlocked"}
                  >
                    {isSlugLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    <span>{isSlugLocked ? "Auto-synced" : "Custom Slug"}</span>
                  </button>
                </div>

                <input
                  id="category-slug-input"
                  type="text"
                  required
                  pattern="^[a-z0-9\-]+$"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  value={formData.slug}
                  onChange={(e) => {
                    setIsDirty(true);
                    setIsSlugLocked(false);
                    setFormData((prev) => ({
                      ...prev,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }));
                  }}
                  placeholder="e.g. black-tea"
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #c9c2b6",
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: "monospace",
                    background: "#faf7f2",
                  }}
                  aria-describedby="category-slug-help"
                />
                <span id="category-slug-help" style={{ fontSize: 12, color: "#6a6e64" }}>
                  Storefront URL: <code>/shop?category={formData.slug || "slug"}</code>
                </span>
              </div>
            </div>

            {/* Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label
                  htmlFor="category-description-input"
                  style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}
                >
                  Description
                </label>
                <span style={{ fontSize: 11, color: "#7e8278" }}>
                  {formData.description.length} / 2000 chars
                </span>
              </div>
              <textarea
                id="category-description-input"
                rows={4}
                maxLength={2000}
                value={formData.description}
                onChange={(e) => {
                  setIsDirty(true);
                  setFormData((prev) => ({ ...prev, description: e.target.value }));
                }}
                placeholder="High mountain leaves hand-plucked during seasonal flushes from Darjeeling and Assam estates..."
                style={{
                  padding: "10px 14px",
                  border: "1px solid #c9c2b6",
                  borderRadius: 6,
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: "#faf7f2",
                }}
              />
            </div>
          </div>
        </fieldset>

        {/* FIELDSET 2: Cover Artwork & Visuals */}
        <fieldset
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            margin: 0,
          }}
        >
          <legend
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ImageIcon size={16} color="#697a55" />
            <span>2. Cover Banner Artwork</span>
          </legend>

          <div style={{ marginTop: 12 }} data-testid="cover-image">
            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDraggingOver ? "2px dashed #23483a" : "2px dashed #c9c2b6",
                background: isDraggingOver ? "rgba(35, 72, 58, 0.04)" : "#faf7f2",
                borderRadius: 8,
                padding: "20px",
                textAlign: "center",
                transition: "all 150ms ease",
                marginBottom: 16,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileUpload(f);
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "#ede9df",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#23483a",
                  }}
                >
                  <Upload size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1d2a24" }}>
                    Drag and drop cover artwork, or browse
                  </div>
                  <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
                    Supports WebP, AVIF, PNG, JPG (Recommended 1200×400 or 16:9 banner)
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="button button-outline"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      minHeight: 36,
                      background: "#ffffff",
                      borderColor: "#c9c2b6",
                    }}
                  >
                    <span>{uploadingImage ? "Uploading file…" : "Choose Local File"}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="media-picker-btn"
                    onClick={() => setPickerOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      minHeight: 36,
                      background: "#23483a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "0 14px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    <ImageIcon size={15} />
                    <span>Choose from Media Library</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Paste direct URL alternative */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label
                htmlFor="cover-url-input"
                style={{ fontSize: 12, fontWeight: 600, color: "#6a6e64", whiteSpace: "nowrap" }}
              >
                Cover Image URL:
              </label>
              <input
                id="cover-url-input"
                name="cover_image_url"
                type="text"
                value={formData.cover_image_url}
                onChange={(e) => {
                  setIsDirty(true);
                  setFormData((prev) => ({ ...prev, cover_image_url: e.target.value }));
                }}
                placeholder="/uploads/tea_family_banner.webp or https://..."
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: "8px 12px",
                  border: "1px solid #c9c2b6",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#faf7f2",
                }}
              />
            </div>

            <MediaPicker
              isOpen={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(asset) => {
                if (!asset || !asset.url) return;
                setIsDirty(true);
                setFormData((prev) => ({ ...prev, cover_image_url: asset.url }));
              }}
            />

            {/* Live Preview Card */}
            {formData.cover_image_url && (
              <div
                style={{
                  marginTop: 16,
                  position: "relative",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #d9d4c8",
                  background: "#1d2a24",
                  maxHeight: 200,
                }}
              >
                <Image
                  src={formData.cover_image_url}
                  alt={`${formData.name || "Category"} preview banner`}
                  width={600}
                  height={180}
                  sizes="(max-width: 768px) 100vw, 600px"
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit: "cover",
                    display: "block",
                  }}
                  unoptimized={Boolean(formData.cover_image_url && (formData.cover_image_url.startsWith("/uploads/") || formData.cover_image_url.startsWith("http")))}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsDirty(true);
                    setFormData((prev) => ({ ...prev, cover_image_url: "" }));
                  }}
                  aria-label="Remove cover artwork"
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(23, 23, 19, 0.75)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "50%",
                    color: "#ffffff",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  title="Remove artwork"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </fieldset>

        {/* FIELDSET 3: Hierarchy & Catalog Placement */}
        <fieldset
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            margin: 0,
          }}
        >
          <legend
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Layers size={16} color="#697a55" />
            <span>3. Hierarchy &amp; Placement</span>
          </legend>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginTop: 12,
            }}
          >
            {/* Parent Category Selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="parent-category-select"
                style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}
              >
                Parent Category (Hierarchy)
              </label>
              <select
                id="parent-category-select"
                value={formData.parent_id || ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setFormData((prev) => ({
                    ...prev,
                    parent_id: e.target.value ? Number(e.target.value) : null,
                  }));
                }}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #c9c2b6",
                  borderRadius: 6,
                  fontSize: 14,
                  background: "#faf7f2",
                }}
                aria-describedby="parent-category-help"
              >
                <option value="">None (Top-Level Category Family)</option>
                {!loadingParents &&
                  parentCategories.map((p) => (
                    <option key={p.id} value={p.id}>
                      Subcategory of: {p.name}
                    </option>
                  ))}
              </select>
              <span id="parent-category-help" style={{ fontSize: 12, color: "#6a6e64" }}>
                Leave empty to create a primary family (e.g. Black Tea). Choose a parent to nest as a subcategory.
              </span>
            </div>

            {/* Display Sort Order */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="sort-order-input"
                style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}
              >
                Display Sort Order
              </label>
              <input
                id="sort-order-input"
                type="number"
                min={0}
                value={formData.sort_order}
                onChange={(e) => {
                  setIsDirty(true);
                  setFormData((prev) => ({ ...prev, sort_order: Number(e.target.value) }));
                }}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #c9c2b6",
                  borderRadius: 6,
                  fontSize: 14,
                  background: "#faf7f2",
                }}
                aria-describedby="sort-order-help"
              >
              </input>
              <span id="sort-order-help" style={{ fontSize: 12, color: "#6a6e64" }}>
                Lower numbers appear first on storefront menus (e.g., 0, 1, 2).
              </span>
            </div>
          </div>
        </fieldset>

        {/* FIELDSET 4: Storefront Visibility */}
        <fieldset
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            margin: 0,
          }}
        >
          <legend
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Globe size={16} color="#697a55" />
            <span>4. Storefront Visibility &amp; Publishing</span>
          </legend>

          <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <input
              type="checkbox"
              id="active-storefront-checkbox"
              checked={formData.is_active === 1}
              onChange={(e) => {
                setIsDirty(true);
                setFormData((prev) => ({ ...prev, is_active: e.target.checked ? 1 : 0 }));
              }}
              style={{
                width: 20,
                height: 20,
                marginTop: 2,
                cursor: "pointer",
                accentColor: "#23483a",
              }}
            />
            <div>
              <label
                htmlFor="active-storefront-checkbox"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1d2a24",
                  cursor: "pointer",
                  display: "block",
                }}
              >
                Publish and Show Active on Storefront
              </label>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#6a6e64" }}>
                When checked, customers can browse and filter products under this category on the public website. Uncheck to hide seasonal varieties without deleting their data.
              </p>
            </div>
          </div>
        </fieldset>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          paddingTop: 16,
          borderTop: "1px solid #d9d4c8",
        }}
      >
        <Link
          href={isEdit && categoryId ? `/admin/categories/${categoryId}` : "/admin/categories"}
          className="button button-outline"
          style={{ minHeight: 42, padding: "0 20px", fontSize: 13 }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="button button-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 42,
            padding: "0 24px",
            fontSize: 13,
            background: "#1d2a24",
            color: "#ffffff",
          }}
        >
          <Save size={16} />
          <span>{isSubmitting ? "Saving…" : isEdit ? "Save Category Changes" : "Create Category"}</span>
        </button>
      </div>
    </form>
  );
}
