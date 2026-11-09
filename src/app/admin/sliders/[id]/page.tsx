"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import type { Slider } from "@/lib/sliders";

const isUploadedOrExternal = (url?: string | null) =>
  Boolean(url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/uploads/")));

export default function SliderDetailPage() {
  return (
    <AdminAuthGate>
      <SliderDetailContent />
    </AdminAuthGate>
  );
}

function SliderDetailContent() {
  const params = useParams();
  const idStr = params?.id as string;
  const sliderId = Number(idStr);

  const [slider, setSlider] = useState<Slider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const fetchSlider = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sliders/${sliderId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("Hero slider not found or unable to load.");
        return;
      }
      const data = (await res.json()) as { slider: Slider };
      setSlider(data.slider);
    } catch {
      setError("Network error loading slider details.");
    } finally {
      setLoading(false);
    }
  }, [sliderId]);

  useEffect(() => {
    if (sliderId) void fetchSlider();
  }, [sliderId, fetchSlider]);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      showToast(`Copied ${fieldName} to clipboard`);
    } catch {
      // Best-effort
    }
  };

  const handleToggleStatus = async () => {
    if (!slider) return;
    const nextStatus = slider.is_active === 1 ? 0 : 1;
    setTogglingStatus(true);

    try {
      const res = await fetch(`/api/admin/sliders/${slider.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      if (res.ok) {
        setSlider((prev) => (prev ? { ...prev, is_active: nextStatus } : null));
        showToast(
          `Slider is now ${nextStatus === 1 ? "Active on Storefront" : "Hidden"}.`
        );
      } else {
        showToast("Failed to update status.");
      }
    } catch {
      showToast("Network error updating status.");
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading slider dossier…</p>
      </div>
    );
  }

  if (error || !slider) {
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
        <h2 style={{ fontSize: 20, color: "#1d2a24", margin: "0 0 8px 0" }}>
          Slider Not Found
        </h2>
        <p style={{ color: "#6a6e64", fontSize: 14, marginBottom: 20 }}>
          {error || `Slider #${sliderId} could not be found.`}
        </p>
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

  const now = Date.now();
  const startsAt = slider.starts_at ? new Date(slider.starts_at).getTime() : null;
  const endsAt = slider.ends_at ? new Date(slider.ends_at).getTime() : null;

  let timingStatus = "live";
  if (slider.is_active === 0) timingStatus = "hidden";
  else if (startsAt && startsAt > now) timingStatus = "scheduled";
  else if (endsAt && endsAt < now) timingStatus = "expired";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Toast */}
      {toastMessage && (
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
            padding: "10px 18px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <CheckCircle2 size={16} color="#85e89d" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
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

      {/* Header */}
      <header
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(24px, 3vw, 30px)",
                color: "#1d2a24",
                fontFamily: "Georgia, serif",
                letterSpacing: "-0.02em",
              }}
            >
              Slider #{slider.id}
            </h1>

            {/* Timing Status Pill */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background:
                  slider.is_active === 1
                    ? timingStatus === "live"
                      ? "rgba(46, 125, 50, 0.1)"
                      : "rgba(184, 134, 11, 0.12)"
                    : "#ede8de",
                color:
                  slider.is_active === 1
                    ? timingStatus === "live"
                      ? "#2e7d32"
                      : "#8a6625"
                    : "#7e8278",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    slider.is_active === 1
                      ? timingStatus === "live"
                        ? "#2e7d32"
                        : "#8a6625"
                      : "#7e8278",
                }}
              />
              <span>
                {slider.is_active === 1
                  ? timingStatus === "live"
                    ? "Live on Storefront"
                    : timingStatus === "scheduled"
                    ? "Scheduled"
                    : "Expired"
                  : "Hidden / Draft"}
              </span>
            </span>
          </div>

          <p style={{ margin: 0, color: "#5d6056", fontSize: 14 }}>
            Sort Sequence #{slider.sort_order} · Created on{" "}
            {new Date(slider.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void handleToggleStatus()}
            disabled={togglingStatus}
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
            {slider.is_active === 1 ? "Deactivate (Hide)" : "Activate (Publish)"}
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
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
            <ExternalLink size={14} />
            <span>Store Preview</span>
          </a>

          <Link
            href={`/admin/sliders/${slider.id}/edit`}
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              background: "#1d2a24",
              color: "#ffffff",
            }}
          >
            <Edit size={14} />
            <span>Edit Slider</span>
          </Link>

          <Link
            href={`/admin/sliders/${slider.id}/delete`}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              color: "#a42a1b",
              borderColor: "#f0b2aa",
              background: "#ffffff",
            }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </Link>
        </div>
      </header>

      {/* Simulated Live Hero Banner */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "2.4 / 1",
            minHeight: 320,
            borderRadius: 10,
            overflow: "hidden",
            background: "#18241e",
            border: "1px solid #23342b",
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "36px 44px",
          }}
        >
          {slider.image_url && (
            <Image
              src={slider.image_url}
              alt={slider.title}
              fill
              sizes="(max-width: 1200px) 100vw, 1100px"
              style={{ objectFit: "cover" }}
              priority
              unoptimized={isUploadedOrExternal(slider.image_url)}
            />
          )}
          {/* Gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(13,21,17,0.92) 0%, rgba(13,21,17,0.5) 50%, rgba(13,21,17,0.2) 100%)",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
              alignItems: "end",
              width: "100%",
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#d9a566",
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                THE TEAFLOWW COLLECTION · HERO BANNER
              </div>
              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "clamp(22px, 3.5vw, 32px)",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 10px 0",
                  lineHeight: 1.25,
                  textShadow: "0 2px 6px rgba(0,0,0,0.6)",
                }}
              >
                {slider.title}
              </h2>
              {slider.subtitle && (
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "rgba(255, 255, 255, 0.88)",
                    margin: "0 0 16px 0",
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  }}
                >
                  {slider.subtitle}
                </p>
              )}
              {slider.cta_label && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 18px",
                    background: "#ffffff",
                    color: "#1d2a24",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  <span>{slider.cta_label}</span>
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </div>

            {/* Right: Foreground Glass Card Preview */}
            {Boolean(slider.fg_image_url || slider.card_title || slider.card_tag) && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    position: "relative",
                    width: 280,
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
                      {slider.card_badge || "ESTATE HARVEST"}
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
                      {slider.fg_image_url ? (
                        <Image
                          src={slider.fg_image_url}
                          alt="Foreground card"
                          fill
                          sizes="75px"
                          style={{ objectFit: "cover" }}
                          unoptimized={isUploadedOrExternal(slider.fg_image_url)}
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
                          }}
                        >
                          🍵 Tin Photo
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
                        {slider.card_tag || "2026 First Flush · Margaret's Hope"}
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
                        {slider.card_title || slider.title.split("—")[0].trim() || "Darjeeling First Flush"}
                      </div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>
                        {slider.card_subtitle || "Single Estate · 6,800 ft"}
                      </div>
                      {(slider.card_quote || slider.cta_label) && (
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
                          &ldquo;{slider.card_quote || slider.cta_label}&rdquo;
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
                        {slider.card_tasting_notes || "Muscatel • Wild Orchid"}
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
                        <span>{slider.card_cta_label || "View Harvest"}</span>
                        <span>→</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Properties Dossier Table */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #ede8de",
            background: "#faf7f2",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Sparkles size={16} color="#8a6625" />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1d2a24" }}>
            Hero Slider Technical Specifications
          </h2>
        </div>

        <table className="admin-table" style={{ width: "100%", margin: 0 }}>
          <tbody>
            <tr>
              <th style={{ width: 220 }}>ID</th>
              <td>#{slider.id}</td>
            </tr>
            <tr>
              <th>Headline Title</th>
              <td style={{ fontWeight: 600, color: "#1d2a24" }}>{slider.title}</td>
            </tr>
            <tr>
              <th>Editorial Subtitle</th>
              <td>{slider.subtitle || <span style={{ color: "#7e8278" }}>None</span>}</td>
            </tr>
            <tr>
              <th>Background Image URL (BG)</th>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code
                    style={{
                      background: "#ede8de",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 12,
                      wordBreak: "break-all",
                    }}
                  >
                    {slider.image_url}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(slider.image_url, "background image URL")}
                    style={{ border: 0, background: "none", cursor: "pointer", color: "#697a55" }}
                    title="Copy Background Image URL"
                  >
                    {copiedField === "background image URL" ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <th>Background Media ID</th>
              <td>
                {slider.media_id ? (
                  <Link
                    href={`/admin/media/${slider.media_id}`}
                    style={{ color: "#23483a", fontWeight: 600 }}
                  >
                    Media Asset #{slider.media_id} ↗
                  </Link>
                ) : (
                  <span style={{ color: "#7e8278" }}>Unlinked (Direct URL)</span>
                )}
              </td>
            </tr>
            <tr>
              <th>Foreground Card Image (FG)</th>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code
                    style={{
                      background: "#ede8de",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 12,
                      wordBreak: "break-all",
                    }}
                  >
                    {slider.fg_image_url || "None (no foreground image)"}
                  </code>
                  {slider.fg_image_url ? (
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(slider.fg_image_url!, "foreground image URL")}
                      style={{ border: 0, background: "none", cursor: "pointer", color: "#697a55" }}
                      title="Copy Foreground Image URL"
                    >
                      {copiedField === "foreground image URL" ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
            <tr>
              <th>Foreground Media ID</th>
              <td>
                {slider.fg_media_id ? (
                  <Link
                    href={`/admin/media/${slider.fg_media_id}`}
                    style={{ color: "#23483a", fontWeight: 600 }}
                  >
                    Media Asset #{slider.fg_media_id} ↗
                  </Link>
                ) : (
                  <span style={{ color: "#7e8278" }}>Unlinked (Direct URL)</span>
                )}
              </td>
            </tr>
            <tr>
              <th>Hero Button CTA</th>
              <td>
                <span style={{ fontWeight: 600 }}>{slider.cta_label || "Explore Single Estates"}</span>
                {" → "}
                <Link href={slider.cta_href || "/"} target="_blank" style={{ color: "#697a55" }}>
                  {slider.cta_href || "/"}
                </Link>
              </td>
            </tr>
            <tr>
              <th>Card Badge</th>
              <td>{slider.card_badge || <span style={{ color: "#7e8278" }}>Default (ESTATE HARVEST)</span>}</td>
            </tr>
            <tr>
              <th>Card Harvest Lot Tag</th>
              <td>{slider.card_tag || <span style={{ color: "#7e8278" }}>None</span>}</td>
            </tr>
            <tr>
              <th>Card Tea Name</th>
              <td>{slider.card_title || <span style={{ color: "#7e8278" }}>Inherits headline</span>}</td>
            </tr>
            <tr>
              <th>Card Terroir &amp; Elevation</th>
              <td>{slider.card_subtitle || <span style={{ color: "#7e8278" }}>None</span>}</td>
            </tr>
            <tr>
              <th>Card Tasting Notes</th>
              <td>{slider.card_tasting_notes || <span style={{ color: "#7e8278" }}>None</span>}</td>
            </tr>
            <tr>
              <th>Card Provenance Quote</th>
              <td>{slider.card_quote || <span style={{ color: "#7e8278" }}>None</span>}</td>
            </tr>
            <tr>
              <th>Card Button &amp; Link</th>
              <td>
                <span style={{ fontWeight: 600 }}>{slider.card_cta_label || "View Harvest"}</span>
                {" → "}
                <Link href={slider.card_cta_href || slider.cta_href || "/shop"} target="_blank" style={{ color: "#697a55" }}>
                  {slider.card_cta_href || slider.cta_href || "/shop"}
                </Link>
              </td>
            </tr>
            <tr>
              <th>Bottom Chapter / Tab Label</th>
              <td>{slider.chapter_label || <span style={{ color: "#7e8278" }}>Auto-derived from tea title</span>}</td>
            </tr>
            <tr>
              <th>Rotation Sort Order</th>
              <td>Sequence position #{slider.sort_order}</td>
            </tr>
            <tr>
              <th>Page Display Target</th>
              <td>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    background: slider.page_target === "shop" ? "#e8effc" : slider.page_target === "all" ? "#f3e8ff" : "#f0fdf4",
                    color: slider.page_target === "shop" ? "#1e40af" : slider.page_target === "all" ? "#6b21a8" : "#166534",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {slider.page_target === "shop" ? "🛍️ Shop Catalog (/shop) Only" : slider.page_target === "all" ? "🌐 All Pages (Homepage + Shop)" : "🏠 Homepage (/) Only"}
                </span>
              </td>
            </tr>
            <tr>
              <th>Category Filter Scope</th>
              <td>
                {slider.category_slug ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    🏷️ {slider.category_slug}
                  </span>
                ) : (
                  <span style={{ color: "#7e8278" }}>All Categories (General / Default)</span>
                )}
              </td>
            </tr>
            <tr>
              <th>Storefront Active State</th>
              <td>
                <span
                  style={{
                    color: slider.is_active === 1 ? "#2e7d32" : "#7e8278",
                    fontWeight: 600,
                  }}
                >
                  {slider.is_active === 1 ? "Active (1)" : "Inactive / Hidden (0)"}
                </span>
              </td>
            </tr>
            <tr>
              <th>Campaign Timing Window</th>
              <td>
                {slider.starts_at || slider.ends_at ? (
                  <div>
                    <div>
                      <strong>Starts:</strong>{" "}
                      {slider.starts_at ? new Date(slider.starts_at).toLocaleString() : "Immediate"}
                    </div>
                    <div>
                      <strong>Ends:</strong>{" "}
                      {slider.ends_at ? new Date(slider.ends_at).toLocaleString() : "Permanent"}
                    </div>
                  </div>
                ) : (
                  <span style={{ color: "#5d6056" }}>No time restrictions (Always Active)</span>
                )}
              </td>
            </tr>
            <tr>
              <th>Created At</th>
              <td>{new Date(slider.created_at).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
