"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { BRAND_LOGOS } from "@/lib/brandLogos";
import { Search, Download, Copy, Check, ExternalLink, Sparkles } from "lucide-react";

export function BrandLogoGallery() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewBg, setPreviewBg] = useState<"light" | "dark" | "checkered">("light");

  const categories = useMemo(() => {
    const set = new Set(BRAND_LOGOS.map((l) => l.category));
    return ["all", ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    return BRAND_LOGOS.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        search.trim() === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.filename.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="brand-logo-gallery" style={{ marginTop: 16 }}>
      {/* Overview Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #063B2F 0%, #0A4D3D 100%)",
          color: "#FFFBF3",
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={16} color="#D8B36C" />
            <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#D8B36C", fontWeight: 700 }}>
              Master Brand Identity Kit
            </span>
          </div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "0 0 6px 0", color: "#FFFBF3" }}>
            Teafloww #9 — 40 True Vector Logo Variations
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#E0E8E3", maxWidth: 700, lineHeight: 1.5 }}>
            Hand-authored smooth Bezier paths, outlined typography with zero font dependencies, and production-ready SVG &amp; PNG formats for web, packaging, stamping, and digital apps.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#D8B36C", fontWeight: 600 }}>Preview Backdrop:</span>
          <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)" }}>
            <button
              type="button"
              onClick={() => setPreviewBg("light")}
              style={{
                background: previewBg === "light" ? "#D8B36C" : "rgba(255,255,255,0.1)",
                color: previewBg === "light" ? "#063B2F" : "#FFFBF3",
                border: "none",
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setPreviewBg("dark")}
              style={{
                background: previewBg === "dark" ? "#D8B36C" : "rgba(255,255,255,0.1)",
                color: previewBg === "dark" ? "#063B2F" : "#FFFBF3",
                border: "none",
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setPreviewBg("checkered")}
              style={{
                background: previewBg === "checkered" ? "#D8B36C" : "rgba(255,255,255,0.1)",
                color: previewBg === "checkered" ? "#063B2F" : "#FFFBF3",
                border: "none",
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "#8a9084" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 40 logos (name, format, tag)..."
            style={{
              paddingLeft: 34,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              border: "1px solid #d2cbbe",
              fontSize: 13,
              width: "100%",
              outline: "none",
              background: "#fff",
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? "#063B2F" : "#f1ede4",
                color: selectedCategory === cat ? "#FFFBF3" : "#3e443c",
                border: "1px solid",
                borderColor: selectedCategory === cat ? "#063B2F" : "#e0dacd",
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: selectedCategory === cat ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cat === "all" ? `All Variations (${BRAND_LOGOS.length})` : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Logos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {filtered.map((item) => {
          const bgStyle =
            previewBg === "dark"
              ? { backgroundColor: "#17221c" }
              : previewBg === "checkered"
              ? {
                  backgroundColor: "#ffffff",
                  backgroundImage: "radial-gradient(#d5d0c3 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }
              : { backgroundColor: "#faf8f4" };

          return (
            <div
              key={item.id}
              style={{
                borderRadius: 10,
                border: "1px solid #e3ded2",
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Preview Area */}
              <div
                style={{
                  height: 180,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  position: "relative",
                  ...bgStyle,
                }}
              >
                {/* Number Badge */}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}
                >
                  #{item.id.toString().padStart(2, "0")}
                </span>

                <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Image
                    src={item.svgUrl}
                    alt={item.name}
                    width={220}
                    height={140}
                    unoptimized
                    style={{
                      maxWidth: "85%",
                      maxHeight: "85%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              </div>

              {/* Card Meta & Controls */}
              <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1d2a24" }}>
                    {item.name}
                  </h3>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#063B2F",
                      background: "#e8efe9",
                      padding: "2px 6px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    SVG + PNG
                  </span>
                </div>

                <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#63685e", lineHeight: 1.4, flex: 1 }}>
                  {item.description}
                </p>

                {/* Actions */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    paddingTop: 10,
                    borderTop: "1px solid #f0ece3",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.svgUrl, `svg-${item.id}`)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "6px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: copiedId === `svg-${item.id}` ? "#e6f4ea" : "#f6f3ed",
                      color: copiedId === `svg-${item.id}` ? "#137333" : "#303932",
                      border: "1px solid #ded9cd",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {copiedId === `svg-${item.id}` ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedId === `svg-${item.id}` ? "Copied SVG" : "Copy SVG Path"}</span>
                  </button>

                  <a
                    href={item.svgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "6px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#f6f3ed",
                      color: "#303932",
                      border: "1px solid #ded9cd",
                      borderRadius: 4,
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>View Vector</span>
                  </a>

                  <a
                    href={item.pngUrl}
                    download={`${item.filename}.png`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "6px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#f6f3ed",
                      color: "#303932",
                      border: "1px solid #ded9cd",
                      borderRadius: 4,
                      textDecoration: "none",
                      gridColumn: "span 2",
                    }}
                  >
                    <Download size={12} />
                    <span>Download PNG Preview</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
