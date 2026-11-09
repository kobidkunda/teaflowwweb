"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Smartphone,
  Monitor,
  Columns,
  Boxes,
  Sparkles,
  Flame,
  CheckCircle,
  Eye,
} from "lucide-react";
import type { TrialWithDetails } from "@/lib/trials/types";
import { formatPaise } from "./TrialListingClient";

export interface TrialSplitPreviewProps {
  trial: TrialWithDetails;
}

export type PreviewViewport = "mobile" | "desktop" | "split";

export function TrialSplitPreview({ trial }: TrialSplitPreviewProps) {
  const [viewport, setViewport] = useState<PreviewViewport>("split");

  const renderSimulatedPdp = (mode: "mobile" | "desktop") => {
    const isMobile = mode === "mobile";
    const heroAsset =
      trial.hero_image?.url ||
      trial.assets.find((a) => a.stage === "hero" || a.stage === "packaging")?.asset_url;

    return (
      <div
        className={`simulated-pdp pdp-${mode}`}
        style={{
          background: "#fbf8f1",
          color: "#1d2a24",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          padding: isMobile ? 16 : 24,
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          position: "relative",
          overflow: "hidden",
          minHeight: 520,
        }}
      >
        {/* PREVIEW Watermark Overlay */}
        <div
          className="preview-watermark"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(184, 117, 61, 0.9)",
            color: "#ffffff",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            zIndex: 10,
            pointerEvents: "none",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          }}
        >
          PREVIEW
        </div>

        {/* Hero Visual & Headline */}
        <div
          style={{
            display: isMobile ? "block" : "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 16 : 24,
            marginBottom: 24,
          }}
        >
          {/* Hero Image Box */}
          <div
            style={{
              aspectRatio: "4/3",
              background: "#ede9df",
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #d9d4c8",
            }}
          >
            {heroAsset ? (
              <Image
                src={heroAsset}
                alt={trial.title}
                fill
                sizes={isMobile ? "375px" : "600px"}
                style={{ objectFit: "cover" }}
                unoptimized
              />
            ) : (
              <div style={{ textAlign: "center", color: "#6a6e64" }}>
                <Boxes size={48} color="#23483a" style={{ opacity: 0.5, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>TeaFloww 4x50g Kit</div>
              </div>
            )}
          </div>

          {/* Core Info */}
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#b8753d",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Curated Discovery Flight · 200g
            </div>
            <h2
              style={{
                margin: "0 0 8px 0",
                fontSize: isMobile ? 20 : 26,
                fontWeight: 700,
                lineHeight: 1.25,
                fontFamily: "var(--font-serif, Georgia, serif)",
              }}
            >
              {trial.title || "Untitled Trial Kit"}
            </h2>

            {trial.tagline && (
              <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#555850", fontStyle: "italic" }}>
                {trial.tagline}
              </p>
            )}

            {/* Price Box */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "16px 0" }}>
              <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "#143c31" }}>
                ₹{formatPaise(trial.price_paise)}
              </span>
              {trial.compare_at_price_paise && trial.compare_at_price_paise > trial.price_paise && (
                <span
                  style={{
                    fontSize: 15,
                    color: "#8a8f85",
                    textDecoration: "line-through",
                  }}
                >
                  ₹{formatPaise(trial.compare_at_price_paise)}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "#e8f5e9",
                  color: "#2e7d32",
                  fontWeight: 600,
                }}
              >
                Taxes Included
              </span>
            </div>

            {/* Mock Add to Cart Button */}
            <button
              type="button"
              disabled
              style={{
                width: "100%",
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                background: "#143c31",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                cursor: "not-allowed",
                opacity: 0.9,
              }}
            >
              Order Discovery Kit (200g)
            </button>
          </div>
        </div>

        {/* 4 Sachets Breakdown */}
        <div>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 12px 0",
              color: "#1d2a24",
              borderBottom: "1px solid #e2ddd2",
              paddingBottom: 6,
            }}
          >
            Included Single-Estate Sachets (4 × 50g)
          </h4>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {(trial.components || []).map((comp, idx) => {
              let notes: string[] = [];
              try {
                notes = JSON.parse(comp.tasting_notes || "[]");
              } catch {
                notes = [];
              }

              return (
                <div
                  key={comp.id || idx}
                  style={{
                    padding: 10,
                    background: "#ffffff",
                    borderRadius: 6,
                    border: "1px solid #e0dbce",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>
                      #{idx + 1} {comp.name}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#b8753d" }}>
                      {comp.weight_g}g
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6a6e64" }}>
                    {comp.estate || "Estate TBD"} · {comp.grade || "Grade"} · {comp.flush || "Flush"}
                  </div>
                  {notes.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                      {notes.slice(0, 3).map((note, nIdx) => (
                        <span
                          key={nIdx}
                          style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: "#f0f4f1",
                            color: "#23483a",
                          }}
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="trial-split-preview-root">
      {/* Viewport Toolbar */}
      <div
        className="split-preview-toggle"
        data-testid="preview-viewport-toggle"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "10px 16px",
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={18} color="#23483a" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>
            Live Storefront PDP Simulation
          </span>
          <span style={{ fontSize: 12, color: "#6a6e64" }}>
            (Rendered from in-memory draft; analytics/tracking decoupled)
          </span>
        </div>

        <div role="tablist" style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            role="tab"
            aria-selected={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
            className="button"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 6,
              border: viewport === "mobile" ? "1px solid #23483a" : "1px solid #d9d4c8",
              background: viewport === "mobile" ? "#23483a" : "#ffffff",
              color: viewport === "mobile" ? "#ffffff" : "#444840",
              cursor: "pointer",
            }}
          >
            <Smartphone size={14} />
            <span>Mobile (375px)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
            className="button"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 6,
              border: viewport === "desktop" ? "1px solid #23483a" : "1px solid #d9d4c8",
              background: viewport === "desktop" ? "#23483a" : "#ffffff",
              color: viewport === "desktop" ? "#ffffff" : "#444840",
              cursor: "pointer",
            }}
          >
            <Monitor size={14} />
            <span>Desktop (1440px)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewport === "split"}
            onClick={() => setViewport("split")}
            className="button"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 6,
              border: viewport === "split" ? "1px solid #23483a" : "1px solid #d9d4c8",
              background: viewport === "split" ? "#23483a" : "#ffffff",
              color: viewport === "split" ? "#ffffff" : "#444840",
              cursor: "pointer",
            }}
          >
            <Columns size={14} />
            <span>Split View</span>
          </button>
        </div>
      </div>

      {/* Preview Viewport Canvas */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          background: "#ede9df",
          padding: 24,
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          overflowX: "auto",
        }}
      >
        {/* Mobile Viewport */}
        {(viewport === "mobile" || viewport === "split") && (
          <div
            style={{
              width: 375,
              minWidth: 375,
              maxWidth: 375,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              borderRadius: 12,
              overflow: "hidden",
              border: "8px solid #2a2d28",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                background: "#2a2d28",
                color: "#ffffff",
                padding: "4px 12px",
                fontSize: 11,
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              iPhone 13 / 14 Viewport (375px)
            </div>
            {renderSimulatedPdp("mobile")}
          </div>
        )}

        {/* Desktop Viewport */}
        {(viewport === "desktop" || viewport === "split") && (
          <div
            style={{
              flex: 1,
              minWidth: 480,
              maxWidth: 960,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #c9c2b6",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                background: "#f0ece1",
                padding: "6px 16px",
                borderBottom: "1px solid #d9d4c8",
                fontSize: 12,
                fontWeight: 600,
                color: "#555850",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e57373" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffb74d" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#81c784" }} />
              </div>
              <span>https://teafloww.com/trials/{trial.slug}</span>
            </div>
            {renderSimulatedPdp("desktop")}
          </div>
        )}
      </div>
    </div>
  );
}
