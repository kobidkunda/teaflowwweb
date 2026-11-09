"use client";

import React, { useState, useEffect, useMemo, useId } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Calendar,
  ExternalLink,
  Monitor,
  Smartphone,
  Eye,
  Sparkles,
  Globe,
} from "lucide-react";
import { MediaPicker } from "@/components/admin/catalog/MediaPicker";
import type { MediaAsset } from "@/lib/media";

export interface SliderFormData {
  id?: number;
  title: string;
  subtitle: string;
  image_url: string;
  fg_image_url?: string;
  cta_label: string;
  cta_href: string;
  sort_order: number;
  is_active: number;
  starts_at: string | null;
  ends_at: string | null;
  media_id?: number | null;
  fg_media_id?: number | null;
  card_tag?: string;
  card_title?: string;
  card_subtitle?: string;
  card_tasting_notes?: string;
  card_quote?: string;
  card_badge?: string;
  card_cta_label?: string;
  card_cta_href?: string;
  card_enabled?: number;
  chapter_label?: string;
  page_target?: "home" | "shop" | "all";
  category_slug?: string;
}

export interface SliderFormProps {
  initialData?: Partial<SliderFormData>;
  isEdit?: boolean;
  sliderId?: number;
}

const DEFAULT_SLIDER_DATA: SliderFormData = {
  title: "",
  subtitle: "",
  image_url: "",
  fg_image_url: "",
  cta_label: "",
  cta_href: "",
  sort_order: 1,
  is_active: 1,
  starts_at: null,
  ends_at: null,
  media_id: null,
  fg_media_id: null,
  card_tag: "",
  card_title: "",
  card_subtitle: "",
  card_tasting_notes: "",
  card_quote: "",
  card_badge: "ESTATE HARVEST",
  card_cta_label: "View Harvest",
  card_cta_href: "",
  card_enabled: 1,
  chapter_label: "",
  page_target: "home",
  category_slug: "",
};

function formatIsoToLocalInput(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function formatLocalInputToIso(localString: string): string | null {
  if (!localString.trim()) return null;
  try {
    const d = new Date(localString);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export function SliderForm({ initialData, isEdit = false, sliderId }: SliderFormProps) {
  const router = useRouter();
  const formIdPrefix = useId();

  const [formData, setFormData] = useState<SliderFormData>(() => ({
    ...DEFAULT_SLIDER_DATA,
    ...initialData,
    title: initialData?.title ?? "",
    subtitle: initialData?.subtitle ?? "",
    image_url: initialData?.image_url ?? "",
    fg_image_url: initialData?.fg_image_url ?? "",
    cta_label: initialData?.cta_label ?? "",
    cta_href: initialData?.cta_href ?? "",
    card_tag: initialData?.card_tag ?? "",
    card_title: initialData?.card_title ?? "",
    card_subtitle: initialData?.card_subtitle ?? "",
    card_tasting_notes: initialData?.card_tasting_notes ?? "",
    card_quote: initialData?.card_quote ?? "",
    card_badge: initialData?.card_badge ?? "ESTATE HARVEST",
    card_cta_label: initialData?.card_cta_label ?? "View Harvest",
    card_cta_href: initialData?.card_cta_href ?? "",
    card_enabled: initialData?.card_enabled ?? 1,
    chapter_label: initialData?.chapter_label ?? "",
    page_target: initialData?.page_target ?? "home",
    category_slug: initialData?.category_slug ?? "",
  }));

  const [startsAtInput, setStartsAtInput] = useState<string>(() =>
    formatIsoToLocalInput(initialData?.starts_at)
  );
  const [endsAtInput, setEndsAtInput] = useState<string>(() =>
    formatIsoToLocalInput(initialData?.ends_at)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Preview options
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"bg" | "fg" | null>(null);
  const [bgLoadError, setBgLoadError] = useState(false);
  const [fgLoadError, setFgLoadError] = useState(false);

  const [categoriesList, setCategoriesList] = useState<{ id: number; slug: string; name: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/categories?limit=100", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        const list = Array.isArray(data) ? data : data.categories || [];
        setCategoriesList(list.map((c: { id: number | string; slug: string; name: string }) => ({ id: c.id, slug: c.slug, name: c.name })));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    map.set("", "All Categories (General Default)");
    // Pre-populate core known tea families
    map.set("everyday-milk-chai", "Everyday Milk Chai");
    map.set("bengal-signature-blends", "Bengal Signature Blends");
    map.set("regional-tea-origins", "Regional Tea Origins");
    map.set("iced-clear-teas", "Iced & Clear Teas");
    map.set("black", "Black Tea");
    map.set("green", "Green Tea");
    map.set("oolong", "Oolong Tea");
    map.set("white", "White Tea");
    map.set("chai", "Botanicals & Chai");
    map.set("herbal", "Botanicals & Tisanes");
    map.set("samplers", "Discovery Flights & Samplers");
    map.set("gifts", "Connoisseur Gift Sets");
    map.set("rare", "Reserve Lots & Limited Flushes");

    // Add any categories from database
    for (const cat of categoriesList) {
      if (cat.slug && !map.has(cat.slug)) {
        map.set(cat.slug, cat.name);
      }
    }
    // Ensure current custom category_slug is preserved in options if set
    if (formData.category_slug && !map.has(formData.category_slug)) {
      map.set(formData.category_slug, `Custom (${formData.category_slug})`);
    }

    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [categoriesList, formData.category_slug]);

  const isUploadedOrExternal = (url?: string | null) =>
    Boolean(url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/uploads/")));

  function validate(): boolean {
    const errors: Record<string, string> = {};

    const cleanTitle = formData.title.trim();
    if (!cleanTitle) {
      errors.title = "Slider headline title is required.";
    } else if (cleanTitle.length < 2) {
      errors.title = "Title must be at least 2 characters.";
    } else if (cleanTitle.length > 80) {
      errors.title = "Title cannot exceed 80 characters.";
    }

    if (formData.subtitle && formData.subtitle.length > 200) {
      errors.subtitle = "Subtitle cannot exceed 200 characters.";
    }

    const cleanImg = formData.image_url.trim();
    if (!cleanImg) {
      errors.image_url = "Hero background image URL is required.";
    } else if (!cleanImg.startsWith("/") && !/^https?:\/\/.+/i.test(cleanImg)) {
      errors.image_url = "Image URL must be a site-relative path (e.g. /images/...) or http(s) URL.";
    }

    if (formData.fg_image_url) {
      const cleanFg = formData.fg_image_url.trim();
      if (cleanFg && !cleanFg.startsWith("/") && !/^https?:\/\/.+/i.test(cleanFg)) {
        errors.fg_image_url = "Foreground card image URL must be a site-relative path (e.g. /images/...) or http(s) URL.";
      }
    }

    if (formData.cta_label && formData.cta_label.length > 40) {
      errors.cta_label = "CTA label cannot exceed 40 characters.";
    }

    if (formData.cta_href) {
      const cleanHref = formData.cta_href.trim();
      if (cleanHref && !cleanHref.startsWith("/") && !/^https?:\/\/.+/i.test(cleanHref)) {
        errors.cta_href = "CTA link must be a site-relative path (e.g. /shop) or valid http(s) URL.";
      }
    }

    if (formData.card_cta_href) {
      const cleanCardHref = formData.card_cta_href.trim();
      if (cleanCardHref && !cleanCardHref.startsWith("/") && !/^https?:\/\/.+/i.test(cleanCardHref)) {
        errors.card_cta_href = "Card link must be a site-relative path (e.g. /shop) or valid http(s) URL.";
      }
    }

    if (startsAtInput && endsAtInput) {
      const startDate = new Date(startsAtInput);
      const endDate = new Date(endsAtInput);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate > endDate) {
        errors.ends_at = "Scheduled end time must be after start time.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleMediaSelect = (asset: MediaAsset) => {
    if (!asset || !asset.url) {
      setMediaPickerTarget(null);
      return;
    }
    if (mediaPickerTarget === "fg") {
      setFormData((prev) => ({
        ...prev,
        fg_image_url: asset.url,
        fg_media_id: asset.id,
      }));
      setFgLoadError(false);
    } else {
      setFormData((prev) => ({
        ...prev,
        image_url: asset.url,
        media_id: asset.id,
      }));
      setBgLoadError(false);
    }
    setMediaPickerTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      setFormError("Please fix the validation errors before saving.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        image_url: formData.image_url.trim(),
        fg_image_url: (formData.fg_image_url || "").trim(),
        cta_label: formData.cta_label.trim(),
        cta_href: formData.cta_href.trim(),
        sort_order: Number(formData.sort_order) || 0,
        is_active: formData.is_active === 1 ? 1 : 0,
        starts_at: formatLocalInputToIso(startsAtInput),
        ends_at: formatLocalInputToIso(endsAtInput),
        media_id: formData.media_id ?? null,
        fg_media_id: formData.fg_media_id ?? null,
        card_tag: (formData.card_tag || "").trim(),
        card_title: (formData.card_title || "").trim(),
        card_subtitle: (formData.card_subtitle || "").trim(),
        card_tasting_notes: (formData.card_tasting_notes || "").trim(),
        card_quote: (formData.card_quote || "").trim(),
        card_badge: (formData.card_badge || "").trim(),
        card_cta_label: (formData.card_cta_label || "").trim(),
        card_cta_href: (formData.card_cta_href || "").trim(),
        card_enabled: formData.card_enabled === 0 ? 0 : 1,
        chapter_label: (formData.chapter_label || "").trim(),
        page_target: formData.page_target || "home",
        category_slug: (formData.category_slug || "").trim(),
      };

      const url = isEdit ? `/api/admin/sliders/${sliderId}` : "/api/admin/sliders";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => null);

      if (!res.ok) {
        let msg = "Failed to save hero slider.";
        if (responseData?.error) {
          msg = typeof responseData.error === "string" ? responseData.error : JSON.stringify(responseData.error);
        } else if (responseData?.fieldErrors) {
          msg = "Please verify the highlighted fields.";
          setFieldErrors(responseData.fieldErrors);
        }
        setFormError(msg);
        return;
      }

      setSuccessToast(isEdit ? "Hero slider updated successfully!" : "Hero slider created successfully!");
      setTimeout(() => {
        router.push("/admin/sliders");
      }, 700);
    } catch {
      setFormError("Network error occurred while saving. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Schedule status evaluation for preview banner
  const isCurrentlyScheduled = Boolean(
    startsAtInput && new Date(startsAtInput).getTime() > Date.now()
  );
  const isCurrentlyExpired = Boolean(
    endsAtInput && new Date(endsAtInput).getTime() < Date.now()
  );

  return (
    <div className="admin-slider-form" style={{ maxWidth: 1240, margin: "0 auto" }}>
      {/* Toast */}
      {successToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: "#1d2a24",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <CheckCircle2 size={18} color="#85e89d" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
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
          <nav aria-label="Breadcrumb" style={{ marginBottom: 6 }}>
            <Link
              href="/admin/sliders"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#697a55",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <ArrowLeft size={13} />
              <span>Back to Hero Sliders</span>
            </Link>
          </nav>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(24px, 2.5vw, 30px)",
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              letterSpacing: "-0.02em",
            }}
          >
            {isEdit ? `Edit Hero Slider #${sliderId}` : "Create New Hero Slider"}
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#5d6056", fontSize: 14 }}>
            Configure storefront hero headline, background photography, call-to-action button, and scheduling.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/admin/sliders"
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              borderColor: "#c7c1b5",
              background: "#ffffff",
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            form={`${formIdPrefix}-form`}
            disabled={isSubmitting}
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              fontSize: 13,
              background: "#1d2a24",
              color: "#ffffff",
              boxShadow: "0 2px 6px rgba(29, 42, 36, 0.2)",
            }}
          >
            <Save size={15} />
            <span>{isSubmitting ? "Saving…" : isEdit ? "Update Slider" : "Save Slider"}</span>
          </button>
        </div>
      </div>

      {/* Global Form Error Alert */}
      {formError && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            background: "#fdf3f2",
            border: "1px solid #f0b2aa",
            borderRadius: 6,
            color: "#a42a1b",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Grid: Left Form Controls, Right Live Banner Preview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Form Controls Card */}
        <form
          id={`${formIdPrefix}-form`}
          onSubmit={handleSubmit}
          noValidate
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Section: Editorial Content */}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1d2a24",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #ede8de",
              }}
            >
              <Sparkles size={16} color="#8a6625" />
              <span>Editorial Copy &amp; Headlines</span>
            </h2>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label
                  htmlFor={`${formIdPrefix}-title`}
                  style={{ fontSize: 13, fontWeight: 600, color: "#2d3129" }}
                >
                  Headline Title <span style={{ color: "#a42a1b" }}>*</span>
                </label>
                <span style={{ fontSize: 11, color: formData.title.length > 80 ? "#a42a1b" : "#7e8278" }}>
                  {formData.title.length} / 80
                </span>
              </div>
              <input
                id={`${formIdPrefix}-title`}
                type="text"
                value={formData.title}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, title: e.target.value }));
                  if (fieldErrors.title) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.title;
                      return next;
                    });
                  }
                }}
                placeholder="e.g. Single-Estate Flushes & Mountain Terroirs"
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? `${formIdPrefix}-title-err` : undefined}
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 14,
                  border: `1px solid ${fieldErrors.title ? "#a42a1b" : "#c9c2b6"}`,
                  borderRadius: 6,
                  background: "#faf7f2",
                  fontFamily: "inherit",
                }}
              />
              {fieldErrors.title && (
                <div
                  id={`${formIdPrefix}-title-err`}
                  style={{ fontSize: 12, color: "#a42a1b", marginTop: 4 }}
                >
                  {fieldErrors.title}
                </div>
              )}
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6a6e64" }}>
                Primary headline displayed in large serif font on the hero banner.
              </p>
            </div>

            {/* Subtitle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label
                  htmlFor={`${formIdPrefix}-subtitle`}
                  style={{ fontSize: 13, fontWeight: 600, color: "#2d3129" }}
                >
                  Editorial Subtitle
                </label>
                <span style={{ fontSize: 11, color: formData.subtitle.length > 200 ? "#a42a1b" : "#7e8278" }}>
                  {formData.subtitle.length} / 200
                </span>
              </div>
              <textarea
                id={`${formIdPrefix}-subtitle`}
                rows={3}
                value={formData.subtitle}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, subtitle: e.target.value }));
                  if (fieldErrors.subtitle) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.subtitle;
                      return next;
                    });
                  }
                }}
                placeholder="Single-garden harvests, seasonal flushes, and micro-lots curated for those who seek purity and provenance."
                aria-invalid={Boolean(fieldErrors.subtitle)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  border: `1px solid ${fieldErrors.subtitle ? "#a42a1b" : "#c9c2b6"}`,
                  borderRadius: 6,
                  background: "#faf7f2",
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              {fieldErrors.subtitle && (
                <div style={{ fontSize: 12, color: "#a42a1b", marginTop: 4 }}>
                  {fieldErrors.subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Section: Imagery & Media (BG & FG) */}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1d2a24",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #ede8de",
              }}
            >
              <ImageIcon size={16} color="#23483a" />
              <span>Hero Slider Imagery (Background &amp; Foreground Card)</span>
            </h2>

            {/* 1. Background Image (BG) */}
            <div style={{ marginBottom: 20, padding: 14, background: "#faf7f2", borderRadius: 8, border: "1px solid #e2ddd3" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label
                  htmlFor={`${formIdPrefix}-image`}
                  style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}
                >
                  1. Hero Background Photography (BG) <span style={{ color: "#a42a1b" }}>*</span>
                </label>
                <span style={{ fontSize: 11, background: "#23483a", color: "#ffffff", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                  Panoramic BG
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  id={`${formIdPrefix}-image`}
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, image_url: e.target.value, media_id: null }));
                    setBgLoadError(false);
                    if (fieldErrors.image_url) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.image_url;
                        return next;
                      });
                    }
                  }}
                  placeholder="e.g. /uploads/hero-banner.webp or select from Media"
                  aria-invalid={Boolean(fieldErrors.image_url)}
                  required
                  style={{
                    flex: 1,
                    minWidth: 240,
                    padding: "9px 12px",
                    fontSize: 13,
                    border: `1px solid ${fieldErrors.image_url ? "#a42a1b" : "#c9c2b6"}`,
                    borderRadius: 6,
                    background: "#ffffff",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setMediaPickerTarget("bg")}
                  className="button button-outline"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    minHeight: 38,
                    fontSize: 12,
                    fontWeight: 600,
                    borderColor: "#23483a",
                    color: "#23483a",
                    background: "#ffffff",
                  }}
                >
                  <ImageIcon size={14} />
                  <span>Choose BG Media</span>
                </button>
              </div>
              {fieldErrors.image_url && (
                <div style={{ fontSize: 12, color: "#a42a1b", marginTop: 4 }}>
                  {fieldErrors.image_url}
                </div>
              )}
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: "#f0ece3",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#5d6056",
                  lineHeight: 1.4,
                }}
              >
                <strong>Background Spec:</strong> 1920×800 (ratio 2.4:1 / 16:9), min width 1280px. High-resolution panoramic mountain landscape.
              </div>
            </div>

            {/* 2. Hero Foreground Card & Featured Harvest Content (FG) */}
            <fieldset
              style={{
                marginBottom: 16,
                padding: 16,
                background: "#faf7f2",
                borderRadius: 8,
                border: "1px solid #e2ddd3",
              }}
            >
              <legend
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1d2a24",
                  padding: "0 6px",
                }}
              >
                <span>Hero Foreground Card &amp; Featured Harvest Content (FG)</span>
                <span
                  style={{
                    fontSize: 11,
                    background: formData.card_enabled !== 0 ? "#8a6625" : "#7e8278",
                    color: "#ffffff",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  {formData.card_enabled !== 0 ? "Featured Card Active" : "Card Disabled"}
                </span>
              </legend>

              {/* Card Enable / Disable Toggle Switch */}
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 14,
                  padding: "10px 14px",
                  background: formData.card_enabled !== 0 ? "#edf4ef" : "#f0ece3",
                  borderRadius: 6,
                  border: `1px solid ${formData.card_enabled !== 0 ? "#b2d1be" : "#d9d4c8"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    htmlFor={`${formIdPrefix}-card-enabled`}
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      color: formData.card_enabled !== 0 ? "#1b4332" : "#5d6056",
                      cursor: "pointer",
                    }}
                  >
                    Display Featured Harvest Front Card
                  </label>
                  <span style={{ fontSize: 11, color: "#6a6e64" }}>
                    {formData.card_enabled !== 0
                      ? "Card is enabled. Shows glass harvest card docked on the right side."
                      : "Card is disabled. Slide renders in wide, centered editorial layout without the card."}
                  </span>
                </div>
                <input
                  id={`${formIdPrefix}-card-enabled`}
                  type="checkbox"
                  role="switch"
                  checked={formData.card_enabled !== 0}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, card_enabled: e.target.checked ? 1 : 0 }))
                  }
                  style={{
                    width: 44,
                    height: 24,
                    cursor: "pointer",
                    accentColor: "#23483a",
                  }}
                />
              </div>

              {/* FG Image URL & Media Picker */}
              <div style={{ marginTop: 8, marginBottom: 12 }}>
                <label
                  htmlFor={`${formIdPrefix}-fg-image`}
                  style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2d3129", marginBottom: 4 }}
                >
                  Card Photography (Uncut Tin / Harvest Photo)
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    id={`${formIdPrefix}-fg-image`}
                    type="text"
                    value={formData.fg_image_url || ""}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, fg_image_url: e.target.value, fg_media_id: null }));
                      setFgLoadError(false);
                      if (fieldErrors.fg_image_url) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.fg_image_url;
                          return next;
                        });
                      }
                    }}
                    placeholder="e.g. /uploads/darjeeling-spring-hero-v2.webp (optional)"
                    aria-invalid={Boolean(fieldErrors.fg_image_url)}
                    style={{
                      flex: 1,
                      minWidth: 240,
                      padding: "9px 12px",
                      fontSize: 13,
                      border: `1px solid ${fieldErrors.fg_image_url ? "#a42a1b" : "#c9c2b6"}`,
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget("fg")}
                    className="button button-outline"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 38,
                      fontSize: 12,
                      fontWeight: 600,
                      borderColor: "#8a6625",
                      color: "#8a6625",
                      background: "#ffffff",
                    }}
                  >
                    <ImageIcon size={14} />
                    <span>Choose FG Media</span>
                  </button>
                </div>
                {fieldErrors.fg_image_url && (
                  <div style={{ fontSize: 12, color: "#a42a1b", marginTop: 4 }}>
                    {fieldErrors.fg_image_url}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    background: "#f0ece3",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#5d6056",
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Foreground Card Spec:</strong> 800×500 / 400×250 (ratio 16:10 / 8:5). Clean tea tin, single-garden gaiwan, or leaf macro photography.
                </div>
              </div>

              {/* Card Badge & Harvest Lot Tag */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-badge`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Card Badge (over visual)
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_badge || "").length} / 50
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-badge`}
                    type="text"
                    value={formData.card_badge ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_badge: e.target.value }))}
                    placeholder="e.g. ESTATE HARVEST"
                    maxLength={50}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-tag`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Harvest Lot / Micro-Lot Tag
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_tag || "").length} / 100
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-tag`}
                    type="text"
                    value={formData.card_tag ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_tag: e.target.value }))}
                    placeholder="e.g. 2026 First Flush · Margaret's Hope"
                    maxLength={100}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Card Tea Name & Elevation/Terroir */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-title`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Featured Tea Name (Heading)
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_title || "").length} / 100
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-title`}
                    type="text"
                    value={formData.card_title ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_title: e.target.value }))}
                    placeholder="e.g. Darjeeling First Flush"
                    maxLength={100}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-subtitle`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Elevation / Terroir Line
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_subtitle || "").length} / 150
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-subtitle`}
                    type="text"
                    value={formData.card_subtitle ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_subtitle: e.target.value }))}
                    placeholder="e.g. Single Estate · 6,800 ft"
                    maxLength={150}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Card Tasting Notes & Provenance Quote */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-notes`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Tasting Notes Pill
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_tasting_notes || "").length} / 150
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-notes`}
                    type="text"
                    value={formData.card_tasting_notes ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_tasting_notes: e.target.value }))}
                    placeholder="e.g. Muscatel • Wild Orchid • Crisp Finish"
                    maxLength={150}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-quote`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Provenance Tagline / Quote
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_quote || "").length} / 200
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-quote`}
                    type="text"
                    value={formData.card_quote ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_quote: e.target.value }))}
                    placeholder="e.g. From Our Gardens to Your Cup"
                    maxLength={200}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Card Action Button Label & Link */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label
                      htmlFor={`${formIdPrefix}-card-cta-label`}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2d3129" }}
                    >
                      Card Action Button Text
                    </label>
                    <span style={{ fontSize: 11, color: "#7e8278" }}>
                      {(formData.card_cta_label || "").length} / 50
                    </span>
                  </div>
                  <input
                    id={`${formIdPrefix}-card-cta-label`}
                    type="text"
                    value={formData.card_cta_label ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_cta_label: e.target.value }))}
                    placeholder="e.g. View Harvest"
                    maxLength={50}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid #c9c2b6",
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${formIdPrefix}-card-cta-href`}
                    style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#2d3129", marginBottom: 4 }}
                  >
                    Card Target Link URL
                  </label>
                  <input
                    id={`${formIdPrefix}-card-cta-href`}
                    type="text"
                    value={formData.card_cta_href ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, card_cta_href: e.target.value }))}
                    placeholder="e.g. /shop or /collections/darjeeling (inherits main CTA if empty)"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: `1px solid ${fieldErrors.card_cta_href ? "#a42a1b" : "#c9c2b6"}`,
                      borderRadius: 6,
                      background: "#ffffff",
                    }}
                  />
                  {fieldErrors.card_cta_href && (
                    <div style={{ fontSize: 12, color: "#a42a1b", marginTop: 4 }}>
                      {fieldErrors.card_cta_href}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
          </div>

          {/* Section: Call-To-Action (CTA) */}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1d2a24",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #ede8de",
              }}
            >
              <ExternalLink size={16} color="#b36b3d" />
              <span>Call To Action &amp; Bottom Slider Navigation</span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label
                  htmlFor={`${formIdPrefix}-cta-label`}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2d3129", marginBottom: 6 }}
                >
                  Hero Main Button Label
                </label>
                <input
                  id={`${formIdPrefix}-cta-label`}
                  type="text"
                  value={formData.cta_label}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cta_label: e.target.value }))}
                  placeholder="e.g. Shop Darjeeling First Flush"
                  maxLength={40}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #c9c2b6",
                    borderRadius: 6,
                    background: "#faf7f2",
                  }}
                />
                <span style={{ fontSize: 11, color: "#7e8278", marginTop: 4, display: "block" }}>
                  Primary button text on the hero banner (defaults to &ldquo;Explore Single Estates&rdquo;)
                </span>
              </div>

              <div>
                <label
                  htmlFor={`${formIdPrefix}-cta-href`}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2d3129", marginBottom: 6 }}
                >
                  Hero Main Button Link URL
                </label>
                <input
                  id={`${formIdPrefix}-cta-href`}
                  type="text"
                  value={formData.cta_href}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cta_href: e.target.value }))}
                  placeholder="/collections/darjeeling or /shop"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: `1px solid ${fieldErrors.cta_href ? "#a42a1b" : "#c9c2b6"}`,
                    borderRadius: 6,
                    background: "#faf7f2",
                  }}
                />
                {fieldErrors.cta_href && (
                  <div style={{ fontSize: 12, color: "#a42a1b", marginTop: 4 }}>
                    {fieldErrors.cta_href}
                  </div>
                )}
                <span style={{ fontSize: 11, color: "#7e8278", marginTop: 4, display: "block" }}>
                  Destination URL for the primary hero button
                </span>
              </div>
            </div>

            {/* Bottom Slider Chapter / Tab Label */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <label
                  htmlFor={`${formIdPrefix}-chapter-label`}
                  style={{ fontSize: 13, fontWeight: 600, color: "#2d3129" }}
                >
                  Bottom Slider Tab / Chapter Label
                </label>
                <span style={{ fontSize: 11, color: "#7e8278" }}>
                  {(formData.chapter_label || "").length} / 80
                </span>
              </div>
              <input
                id={`${formIdPrefix}-chapter-label`}
                type="text"
                value={formData.chapter_label ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, chapter_label: e.target.value }))}
                placeholder="e.g. 01. Darjeeling First Flush (optional)"
                maxLength={80}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  border: "1px solid #c9c2b6",
                  borderRadius: 6,
                  background: "#faf7f2",
                }}
              />
              <span style={{ fontSize: 11, color: "#7e8278", marginTop: 4, display: "block" }}>
                Text shown in the bottom chapter navigation progress bar. If left blank, automatically derived from the featured tea title.
              </span>
            </div>
          </div>

          {/* Section: Target Page & Category Scope */}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1d2a24",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #ede8de",
              }}
            >
              <Globe size={16} color="#2d5a43" />
              <span>Target Page &amp; Category Scope</span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label
                  htmlFor={`${formIdPrefix}-page-target`}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2d3129", marginBottom: 6 }}
                >
                  Display Page Target
                </label>
                <select
                  id={`${formIdPrefix}-page-target`}
                  value={formData.page_target || "home"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      page_target: e.target.value as "home" | "shop" | "all",
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #c9c2b6",
                    borderRadius: 6,
                    background: "#faf7f2",
                  }}
                >
                  <option value="home">Homepage (/) Only</option>
                  <option value="shop">Shop Catalog (/shop) Only</option>
                  <option value="all">All Pages (Homepage + Shop)</option>
                </select>
                <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6a6e64" }}>
                  Choose which page displays this hero slider carousel.
                </p>
              </div>

              <div>
                <label
                  htmlFor={`${formIdPrefix}-category-slug`}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2d3129", marginBottom: 6 }}
                >
                  Category Filter Scope
                </label>
                <select
                  id={`${formIdPrefix}-category-slug`}
                  value={formData.category_slug || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      category_slug: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #c9c2b6",
                    borderRadius: 6,
                    background: "#faf7f2",
                  }}
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="text"
                    value={formData.category_slug || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        category_slug: e.target.value.toLowerCase().trim(),
                      }))
                    }
                    placeholder="or type custom slug (e.g. everyday-milk-chai)"
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      fontSize: 11,
                      border: "1px solid #d9d4c8",
                      borderRadius: 4,
                      background: "#ffffff",
                    }}
                  />
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6a6e64" }}>
                  Filter activation: Displays when this category is selected in /shop.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Display Sequencing & Scheduling */}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1d2a24",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #ede8de",
              }}
            >
              <Calendar size={16} color="#4a5938" />
              <span>Sequencing &amp; Time Window</span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label
                  htmlFor={`${formIdPrefix}-order`}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2d3129", marginBottom: 6 }}
                >
                  Sort Order Sequence
                </label>
                <input
                  id={`${formIdPrefix}-order`}
                  type="number"
                  min={0}
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sort_order: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #c9c2b6",
                    borderRadius: 6,
                    background: "#faf7f2",
                  }}
                />
                <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6a6e64" }}>
                  Lower numbers appear earlier in the rotation (e.g. 1, 2, 3).
                </p>
              </div>

              {/* Status Active Switch */}
              <div>
                <label
                  htmlFor={`${formIdPrefix}-is-active`}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2d3129", marginBottom: 8 }}
                >
                  Storefront Visibility
                </label>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    padding: "8px 12px",
                    background: formData.is_active === 1 ? "rgba(46, 125, 50, 0.08)" : "#f4f1ea",
                    border: `1px solid ${formData.is_active === 1 ? "#85e89d" : "#d9d4c8"}`,
                    borderRadius: 6,
                    width: "100%",
                  }}
                >
                  <input
                    id={`${formIdPrefix}-is-active`}
                    type="checkbox"
                    checked={formData.is_active === 1}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, is_active: e.target.checked ? 1 : 0 }))
                    }
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#23483a" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: formData.is_active === 1 ? "#2e7d32" : "#6a6e64" }}>
                      {formData.is_active === 1 ? "Active on Storefront" : "Hidden / Inactive"}
                    </div>
                    <div style={{ fontSize: 11, color: "#7e8278" }}>
                      {formData.is_active === 1 ? "Eligible for hero rotation" : "Will not be served to visitors"}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Campaign Scheduling Dates */}
            <div
              style={{
                padding: 14,
                background: "#faf7f2",
                border: "1px solid #e0dbce",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#4a5938", marginBottom: 10 }}>
                Optional Campaign Scheduling (UTC / Local)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label
                    htmlFor={`${formIdPrefix}-starts-at`}
                    style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5d6056", marginBottom: 4 }}
                  >
                    Starts At (Leave blank for immediate)
                  </label>
                  <input
                    id={`${formIdPrefix}-starts-at`}
                    type="datetime-local"
                    value={startsAtInput}
                    onChange={(e) => setStartsAtInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      border: "1px solid #c9c2b6",
                      borderRadius: 4,
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${formIdPrefix}-ends-at`}
                    style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5d6056", marginBottom: 4 }}
                  >
                    Ends At (Leave blank for no expiration)
                  </label>
                  <input
                    id={`${formIdPrefix}-ends-at`}
                    type="datetime-local"
                    value={endsAtInput}
                    onChange={(e) => setEndsAtInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      border: `1px solid ${fieldErrors.ends_at ? "#a42a1b" : "#c9c2b6"}`,
                      borderRadius: 4,
                      background: "#ffffff",
                    }}
                  />
                  {fieldErrors.ends_at && (
                    <div style={{ fontSize: 11, color: "#a42a1b", marginTop: 4 }}>
                      {fieldErrors.ends_at}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 16,
              borderTop: "1px solid #ede8de",
            }}
          >
            <Link
              href="/admin/sliders"
              className="button button-outline"
              style={{
                minHeight: 40,
                fontSize: 13,
                borderColor: "#c7c1b5",
                background: "#ffffff",
              }}
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
                minHeight: 40,
                fontSize: 13,
                background: "#1d2a24",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(29, 42, 36, 0.2)",
              }}
            >
              <Save size={15} />
              <span>{isSubmitting ? "Saving…" : isEdit ? "Update Slider" : "Save Slider"}</span>
            </button>
          </div>
        </form>

        {/* Right Column: Real-Time Interactive Live Mockup Preview */}
        <div style={{ position: "sticky", top: 20 }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #d9d4c8",
              borderRadius: 8,
              padding: 20,
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
            }}
          >
            {/* Preview Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid #ede8de",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Eye size={16} color="#23483a" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1d2a24" }}>
                  Live Storefront Preview
                </span>
              </div>

              {/* Device Selector */}
              <div
                style={{
                  display: "inline-flex",
                  border: "1px solid #d9d4c8",
                  borderRadius: 6,
                  background: "#f4f1ea",
                  padding: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  aria-pressed={previewDevice === "desktop"}
                  title="Desktop 16:9 View"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: 0,
                    borderRadius: 4,
                    background: previewDevice === "desktop" ? "#ffffff" : "transparent",
                    color: previewDevice === "desktop" ? "#1d2a24" : "#6a6e64",
                    cursor: "pointer",
                  }}
                >
                  <Monitor size={12} />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  aria-pressed={previewDevice === "mobile"}
                  title="Mobile View"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: 0,
                    borderRadius: 4,
                    background: previewDevice === "mobile" ? "#ffffff" : "transparent",
                    color: previewDevice === "mobile" ? "#1d2a24" : "#6a6e64",
                    cursor: "pointer",
                  }}
                >
                  <Smartphone size={12} />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {formData.is_active === 1 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    background: "rgba(46, 125, 50, 0.1)",
                    color: "#2e7d32",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={12} /> Active
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    background: "#ede8de",
                    color: "#7e8278",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Hidden
                </span>
              )}

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  background: "#edf4ef",
                  color: "#1b4332",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  border: "1px solid #b2d1be",
                }}
              >
                {formData.page_target === "shop" ? "🛍️ Shop Target" : formData.page_target === "all" ? "🌐 All Pages" : "🏠 Homepage"}
              </span>

              {formData.category_slug && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    border: "1px solid #fde68a",
                  }}
                >
                  🏷️ {formData.category_slug}
                </span>
              )}

              {isCurrentlyScheduled && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    background: "rgba(184, 134, 11, 0.12)",
                    color: "#8a6625",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <Calendar size={12} /> Scheduled (Pending)
                </span>
              )}

              {isCurrentlyExpired && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    background: "rgba(164, 42, 27, 0.1)",
                    color: "#a42a1b",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Expired
                </span>
              )}
            </div>

            {/* The Live Render Mockup Box */}
            <div
              style={{
                width: "100%",
                maxWidth: previewDevice === "mobile" ? 340 : "100%",
                margin: "0 auto",
                aspectRatio: previewDevice === "mobile" ? "9 / 16" : "16 / 9",
                position: "relative",
                borderRadius: 8,
                overflow: "hidden",
                background: "#18241e",
                border: "1px solid #23342b",
                boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: previewDevice === "mobile" ? 16 : 22,
                color: "#ffffff",
                transition: "all 250ms ease",
              }}
            >
              {/* Background Image (BG) */}
              {formData.image_url && !bgLoadError ? (
                <Image
                  src={formData.image_url}
                  alt={formData.title || "Slider Background"}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{
                    objectFit: "cover",
                    zIndex: 0,
                  }}
                  priority
                  unoptimized={isUploadedOrExternal(formData.image_url)}
                  onError={() => setBgLoadError(true)}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(135deg, #18241e 0%, #23342b 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    zIndex: 0,
                  }}
                >
                  {bgLoadError ? "⚠️ Image preview unavailable" : "No Background Image"}
                </div>
              )}

              {/* Dark Gradient / Mist Overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(13, 21, 17, 0.94) 0%, rgba(13, 21, 17, 0.65) 45%, rgba(13, 21, 17, 0.2) 100%)",
                  zIndex: 1,
                }}
              />

              {/* Foreground Split Grid Content */}
              {(() => {
                const isCardVisible = formData.card_enabled !== 0 && Boolean(formData.fg_image_url || formData.card_title || formData.card_tag);
                return (
                  <div
                    style={{
                      position: "relative",
                      zIndex: 2,
                      display: "grid",
                      gridTemplateColumns: isCardVisible ? (previewDevice === "mobile" ? "1fr" : "1.2fr 0.8fr") : "1fr",
                      gap: previewDevice === "mobile" ? 14 : 16,
                      alignItems: "end",
                      width: "100%",
                    }}
                  >
                    {/* Left Column: Overline, Title & Subtitle */}
                    <div>
                      <div
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "#d9a566",
                          marginBottom: 4,
                        }}
                      >
                        THE TEAFLOWW COLLECTION
                      </div>

                      <div
                        style={{
                          fontFamily: "Georgia, serif",
                          fontSize: previewDevice === "mobile" ? 15 : 18,
                          lineHeight: 1.25,
                          fontWeight: 600,
                          color: "#ffffff",
                          marginBottom: 6,
                          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                        }}
                      >
                        {formData.title || "Headline Goes Here"}
                      </div>

                      {formData.subtitle && (
                        <p
                          style={{
                            fontSize: 10,
                            lineHeight: 1.35,
                            color: "rgba(255, 255, 255, 0.85)",
                            margin: 0,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {formData.subtitle}
                        </p>
                      )}

                      {Boolean(formData.cta_label) && (
                        <div style={{ marginTop: 8 }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              background: "#23483a",
                              color: "#ffffff",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {formData.cta_label} →
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Floating Featured Harvest Glass Card (FG) */}
                    {isCardVisible && (
                      <div style={{ display: "flex", justifyContent: previewDevice === "mobile" ? "flex-start" : "flex-end" }}>
                    <div
                      style={{
                        position: "relative",
                        width: previewDevice === "mobile" ? "100%" : 280,
                        maxWidth: 300,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid rgba(212, 175, 55, 0.35)",
                        boxShadow: "0 12px 28px rgba(0,0,0,0.55)",
                        background: "rgba(14, 28, 20, 0.82)",
                        backdropFilter: "blur(16px)",
                        padding: "10px 12px",
                        display: "grid",
                        gridTemplateColumns: "75px 1fr",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {/* Left: Tin Visual & Badge */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div
                          style={{
                            fontSize: 7,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 5px",
                            background: "rgba(217, 165, 102, 0.25)",
                            color: "#d9a566",
                            border: "1px solid rgba(217, 165, 102, 0.4)",
                            borderRadius: 4,
                            marginBottom: 4,
                            textAlign: "center",
                            width: "100%",
                          }}
                        >
                          {formData.card_badge || "ESTATE HARVEST"}
                        </div>
                        <div
                          style={{
                            position: "relative",
                            width: 70,
                            height: 85,
                            borderRadius: 6,
                            overflow: "hidden",
                            background: "#192821",
                          }}
                        >
                          {formData.fg_image_url && !fgLoadError ? (
                            <Image
                              src={formData.fg_image_url}
                              alt="Foreground card"
                              fill
                              sizes="75px"
                              style={{ objectFit: "cover" }}
                              unoptimized={isUploadedOrExternal(formData.fg_image_url)}
                              onError={() => {
                                if (formData.fg_image_url) setFgLoadError(true);
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                fontSize: 9,
                                color: "rgba(255,255,255,0.7)",
                                textAlign: "center",
                                padding: 4,
                              }}
                            >
                              {formData.fg_image_url ? "⚠️ Image Error" : "🍵 Tin Photo"}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Card Details Stack */}
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
                        <div>
                          <div
                            style={{
                              fontSize: 7.5,
                              color: "#d9a566",
                              fontWeight: 600,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              marginBottom: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formData.card_tag || "2026 First Flush · Margaret's Hope"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#ffffff",
                              lineHeight: 1.2,
                              marginBottom: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formData.card_title || formData.title.split("—")[0].trim() || "Darjeeling First Flush"}
                          </div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>
                            {formData.card_subtitle || "Single Estate · 6,800 ft"}
                          </div>
                          {(formData.card_quote || formData.cta_label) && (
                            <div
                              style={{
                                fontSize: 8,
                                fontStyle: "italic",
                                color: "rgba(255,255,255,0.88)",
                                lineHeight: 1.25,
                                marginBottom: 4,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              &ldquo;{formData.card_quote || formData.cta_label}&rdquo;
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 7.5,
                              color: "#b9dec6",
                              background: "rgba(35, 72, 58, 0.7)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              display: "inline-block",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: 4,
                            }}
                          >
                            {formData.card_tasting_notes || "Muscatel • Wild Orchid"}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 8,
                              fontWeight: 700,
                              color: "#1d2a24",
                              background: "#d9a566",
                              padding: "3px 8px",
                              borderRadius: 4,
                            }}
                          >
                            <span>{formData.card_cta_label || "View Harvest"}</span>
                            <span>→</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
                );
              })()}

              {/* Bottom Chapter Progress Bar Indicator in Preview */}
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  marginTop: 14,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      height: 2,
                      width: 22,
                      background: "#d9a566",
                      borderRadius: 1,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 600,
                      color: "#ffffff",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {formData.chapter_label || (formData.card_title ? `01. ${formData.card_title}` : "01. First Flush")}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 7.5,
                    color: "rgba(255, 255, 255, 0.65)",
                    fontFamily: "monospace",
                  }}
                >
                  Link: {formData.cta_href || formData.card_cta_href || "/shop"}
                </span>
              </div>
            </div>

            <p
              style={{
                margin: "12px 0 0 0",
                fontSize: 11,
                color: "#7e8278",
                textAlign: "center",
              }}
            >
              Interactive real-time preview reflects both your background (BG) and foreground card (FG) photography.
            </p>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={mediaPickerTarget !== null}
        onClose={() => setMediaPickerTarget(null)}
        onSelect={handleMediaSelect}
        title={
          mediaPickerTarget === "fg"
            ? "Select Foreground Card Photography (FG)"
            : "Select Hero Background Photography (BG)"
        }
      />
    </div>
  );
}
