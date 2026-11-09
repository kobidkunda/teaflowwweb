"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  Upload,
  Search,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { MediaAsset } from "@/lib/media";
import { BrandLogoGallery } from "@/components/admin/media/BrandLogoGallery";

export default function AdminMediaPage() {
  return (
    <AdminAuthGate>
      <MediaManagerContent />
    </AdminAuthGate>
  );
}

function MediaManagerContent() {
  const [activeTab, setActiveTab] = useState<"uploads" | "brand-logos">("uploads");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mimeType, setMimeType] = useState<string>("all");

  const fetchAssets = useCallback(async (querySearch: string, queryMime: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (querySearch.trim()) params.set("search", querySearch.trim());
      if (queryMime !== "all") params.set("mime_type", queryMime);
      params.set("limit", "48");

      const res = await fetch(`/api/admin/media?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialSearch = urlParams.get("search") || "";
    if (initialSearch) {
      setSearch(initialSearch);
    }
    void fetchAssets(initialSearch, "all");
  }, [fetchAssets]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    void fetchAssets(val, mimeType);
  };

  const handleMimeChange = (mime: string) => {
    setMimeType(mime);
    void fetchAssets(search, mime);
  };

  return (
    <div className="admin-media-manager-page" style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0", color: "#1d2a24" }}>
            Media Manager
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6a6e64" }}>
            Organize, upload, and inspect verified photographic assets across all storefront pages.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => fetchAssets(search, mimeType)}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/media/new"
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <Plus size={16} />
            <span>Upload New Media</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid #d9d4c8" }}>
        <button
          type="button"
          onClick={() => setActiveTab("uploads")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "uploads" ? "2px solid #063B2F" : "2px solid transparent",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: activeTab === "uploads" ? 700 : 500,
            color: activeTab === "uploads" ? "#063B2F" : "#6a6e64",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          Storefront Media &amp; Uploads ({total})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("brand-logos")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "brand-logos" ? "2px solid #063B2F" : "2px solid transparent",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: activeTab === "brand-logos" ? 700 : 500,
            color: activeTab === "brand-logos" ? "#063B2F" : "#6a6e64",
            cursor: "pointer",
            marginBottom: -1,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Sparkles size={14} color="#b39156" />
          <span>Brand Vector Master Kit (40 Variations)</span>
        </button>
      </div>

      {activeTab === "brand-logos" ? (
        <BrandLogoGallery />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 420 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#7e786b",
            }}
          />
          <input
            type="search"
            name="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by filename or alt text…"
            style={{
              width: "100%",
              padding: "9px 12px 9px 38px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #c9c2b6",
              background: "#faf8f4",
            }}
          />
        </div>

        {/* MIME Tabs */}
        <div role="tablist" className="mime-filters" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Formats" },
            { id: "image/jpeg", label: "JPEG" },
            { id: "image/png", label: "PNG" },
            { id: "image/webp", label: "WebP" },
            { id: "image/avif", label: "AVIF" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mimeType === tab.id}
              onClick={() => handleMimeChange(tab.id)}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: mimeType === tab.id ? "1px solid #23483a" : "1px solid #d9d4c8",
                background: mimeType === tab.id ? "#23483a" : "#ffffff",
                color: mimeType === tab.id ? "#ffffff" : "#444840",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid or Empty State */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 20px",
            color: "#6a6e64",
            gap: 12,
          }}
        >
          <Loader2 size={24} className="animate-spin" />
          <span>Loading media assets…</span>
        </div>
      ) : items.length === 0 ? (
        <div
          className="empty-state"
          data-testid="empty-state"
          style={{
            background: "#ffffff",
            border: "1px dashed #c9c2b6",
            borderRadius: 8,
            padding: "60px 20px",
            textAlign: "center",
            color: "#6a6e64",
          }}
        >
          <ImageIcon size={48} style={{ opacity: 0.35, marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, color: "#1d2a24", margin: "0 0 6px 0" }}>No media assets found</h2>
          <p style={{ margin: "0 0 20px 0", fontSize: 13 }}>
            {search
              ? `No photographic assets match "${search}". Try adjusting your search query.`
              : "Your media library is empty. Upload your first high-resolution estate image."}
          </p>
          <Link href="/admin/media/new" className="button button-primary" style={{ fontSize: 13 }}>
            <Upload size={14} />
            <span>Upload New Photo</span>
          </Link>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 12, color: "#6a6e64" }}>
            Showing <strong>{items.length}</strong> of <strong>{total}</strong> media asset{total === 1 ? "" : "s"}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {items.map((asset) => (
              <div
                key={asset.id}
                data-filename={asset.filename}
                style={{
                  background: "#ffffff",
                  border: "1px solid #d9d4c8",
                  borderRadius: 8,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "box-shadow 150ms ease, border-color 150ms ease",
                }}
              >
                {/* Thumbnail */}
                <Link
                  href={`/admin/media/${asset.id}`}
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "4/3",
                    background: "#ede9df",
                    display: "block",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    src={asset.url}
                    alt={asset.alt_text || asset.filename}
                    fill
                    sizes="(max-width: 768px) 100vw, 240px"
                    style={{ objectFit: "cover" }}
                  />
                </Link>

                {/* Details */}
                <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1d2a24",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: 4,
                    }}
                    title={asset.filename}
                  >
                    {asset.filename}
                  </div>

                  <div style={{ fontSize: 11, color: "#777c72", marginBottom: 8 }}>
                    <span>{(asset.file_size / 1024).toFixed(0)} KB</span>
                    {asset.width && asset.height ? (
                      <span> • {asset.width}×{asset.height}</span>
                    ) : null}
                    <span style={{ marginLeft: 6, textTransform: "uppercase", fontSize: 10, background: "#ede9df", padding: "1px 5px", borderRadius: 4 }}>
                      {asset.mime_type.replace("image/", "")}
                    </span>
                  </div>

                  {asset.alt_text && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#4a4e45",
                        fontStyle: "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 12,
                      }}
                      title={asset.alt_text}
                    >
                      &ldquo;{asset.alt_text}&rdquo;
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop: "auto", display: "flex", gap: 6, borderTop: "1px solid #f0ede6", paddingTop: 10 }}>
                    <Link
                      href={`/admin/media/${asset.id}`}
                      className="button button-outline"
                      style={{ flex: 1, fontSize: 11, padding: "5px 6px", textAlign: "center", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 4 }}
                      title="Inspect asset details and references"
                    >
                      <Eye size={12} />
                      <span>Inspect</span>
                    </Link>
                    <Link
                      href={`/admin/media/${asset.id}/edit`}
                      className="button button-outline"
                      style={{ flex: 1, fontSize: 11, padding: "5px 6px", textAlign: "center", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 4 }}
                      title="Edit metadata"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </Link>
                    <Link
                      href={`/admin/media/${asset.id}/delete`}
                      className="button button-outline"
                      style={{ fontSize: 11, padding: "5px 8px", color: "#8f2f2a", borderColor: "#e8c9c7" }}
                      title="Safe delete"
                    >
                      <Trash2 size={12} />
                      <span className="sr-only">Delete</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </>
    )}
    </div>
  );
}
