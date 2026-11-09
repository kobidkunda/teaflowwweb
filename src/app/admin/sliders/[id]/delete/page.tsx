"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { ArrowLeft, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import type { Slider } from "@/lib/sliders";

const isUploadedOrExternal = (url?: string | null) =>
  Boolean(url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/uploads/")));

export default function DeleteSliderPage() {
  return (
    <AdminAuthGate>
      <DeleteSliderContent />
    </AdminAuthGate>
  );
}

function DeleteSliderContent() {
  const params = useParams();
  const router = useRouter();
  const idStr = params?.id as string;
  const sliderId = Number(idStr);

  const [slider, setSlider] = useState<Slider | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchSlider() {
      try {
        const res = await fetch(`/api/admin/sliders/${sliderId}`, { credentials: "same-origin" });
        if (!res.ok) {
          if (mounted) setError("Hero slider not found or already deleted.");
          return;
        }
        const data = (await res.json()) as { slider: Slider };
        if (mounted) setSlider(data.slider);
      } catch {
        if (mounted) setError("Network error loading hero slider.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (sliderId) void fetchSlider();
    return () => {
      mounted = false;
    };
  }, [sliderId]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/sliders/${sliderId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to delete hero slider.");
        setDeleting(false);
        return;
      }

      router.push("/admin/sliders");
    } catch {
      setError("Network error occurred during deletion.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading slider details…</p>
      </div>
    );
  }

  if (error && !slider) {
    return (
      <div
        style={{
          padding: 32,
          background: "#fbf8f1",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          maxWidth: 600,
          margin: "40px auto",
          textAlign: "center",
        }}
      >
        <AlertCircle size={32} color="#a42a1b" style={{ margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: 20, color: "#1d2a24", margin: "0 0 8px 0" }}>Slider Not Found</h2>
        <p style={{ color: "#6a6e64", fontSize: 14, marginBottom: 20 }}>{error}</p>
        <Link
          href="/admin/sliders"
          className="button button-outline"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} />
          <span>Return to Sliders</span>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
        <Link
          href={`/admin/sliders/${sliderId}`}
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
          <span>Back to Slider #{sliderId}</span>
        </Link>
      </nav>

      {/* Confirmation Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 28,
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#fdf3f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a42a1b",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h1
              style={{
                margin: "0 0 4px 0",
                fontSize: 22,
                color: "#1d2a24",
                fontFamily: "Georgia, serif",
              }}
            >
              Delete Hero Slider #{sliderId}
            </h1>
            <p style={{ margin: 0, color: "#6a6e64", fontSize: 13 }}>
              Are you sure you want to remove this slider from the storefront rotation?
            </p>
          </div>
        </div>

        {error && (
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
            }}
          >
            {error}
          </div>
        )}

        {/* Slider Preview summary */}
        {slider && (
          <div
            style={{
              marginBottom: 24,
              background: "#faf7f2",
              border: "1px solid #ede8de",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                minHeight: 160,
                background: "#18241e",
                padding: "20px 24px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              {slider.image_url && (
                <Image
                  src={slider.image_url}
                  alt={slider.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  style={{ objectFit: "cover" }}
                  unoptimized={isUploadedOrExternal(slider.image_url)}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(13,21,17,0.88) 0%, rgba(13,21,17,0.3) 100%)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  color: "#ffffff",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 16, fontFamily: "Georgia, serif", fontWeight: 700 }}>
                  {slider.title}
                </div>
                {slider.subtitle && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                    {slider.subtitle}
                  </div>
                )}
              </div>

              {/* Floating FG Card Thumbnail */}
              {Boolean(slider.fg_image_url) && (
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: 90,
                    height: 56,
                    borderRadius: 4,
                    overflow: "hidden",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    flexShrink: 0,
                    background: "#23342b",
                  }}
                  title="Foreground Card (FG)"
                >
                  <Image
                    src={slider.fg_image_url!}
                    alt="FG Card"
                    fill
                    sizes="90px"
                    style={{ objectFit: "cover" }}
                    unoptimized={isUploadedOrExternal(slider.fg_image_url)}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 2,
                      background: "rgba(0,0,0,0.75)",
                      color: "#d9a566",
                      fontSize: 8,
                      fontWeight: 700,
                      padding: "1px 4px",
                      borderRadius: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    FG
                  </span>
                </div>
              )}
            </div>

            <div style={{ padding: 16, fontSize: 13, color: "#5d6056" }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Background Image (BG):</strong> <code>{slider.image_url}</code>
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>Foreground Image (FG):</strong>{" "}
                <code>{slider.fg_image_url || "None (no foreground image)"}</code>
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>Sort Order:</strong> #{slider.sort_order}
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>Target Page:</strong>{" "}
                <span>
                  {slider.page_target === "shop" ? "🛍️ Shop Catalog (/shop) Only" : slider.page_target === "all" ? "🌐 All Pages (Homepage + Shop)" : "🏠 Homepage (/) Only"}
                  {slider.category_slug ? ` (Category: ${slider.category_slug})` : ""}
                </span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>CTA Target:</strong> {slider.cta_label} → {slider.cta_href || "/"}
              </div>
              {Boolean(slider.card_title || slider.card_tag) && (
                <div style={{ marginBottom: 6 }}>
                  <strong>Featured Card Content:</strong> {slider.card_title || "Untitled"} {slider.card_tag ? `· ${slider.card_tag}` : ""}
                </div>
              )}
              <div>
                <strong>Current Status:</strong>{" "}
                <span style={{ color: slider.is_active === 1 ? "#2e7d32" : "#7e8278", fontWeight: 600 }}>
                  {slider.is_active === 1 ? "Active on Storefront" : "Hidden"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            padding: "12px 16px",
            background: "#fff9f0",
            border: "1px solid #ffe6b3",
            borderRadius: 6,
            fontSize: 12,
            color: "#8a6625",
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          <strong>Notice:</strong> This action permanently deletes the slider database record.
          The storefront hero carousel will immediately exclude this banner. If it is the only active slider, the hero banner will fall back to the default editorial terroirs view.
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Link
            href={`/admin/sliders/${sliderId}`}
            className="button button-outline"
            style={{ minHeight: 40, fontSize: 13, borderColor: "#c7c1b5", background: "#ffffff" }}
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              fontSize: 13,
              background: "#a42a1b",
              color: "#ffffff",
              border: 0,
              borderRadius: 6,
              padding: "0 18px",
              fontWeight: 600,
              cursor: deleting ? "not-allowed" : "pointer",
            }}
          >
            <Trash2 size={15} />
            <span>{deleting ? "Deleting…" : "Confirm Delete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
