"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Search, X, Image as ImageIcon, Check, Upload, AlertCircle } from "lucide-react";
import type { MediaAsset } from "@/lib/media";

export interface MediaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  title?: string;
}

export function MediaPicker({
  isOpen,
  onClose,
  onSelect,
  title = "Select from Media Library",
}: MediaPickerProps) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mimeType, setMimeType] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 10);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = (document.activeElement as HTMLElement) || null;
      setSelectedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function fetchAssets() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (mimeType !== "all") params.set("mime_type", mimeType);
        params.set("limit", "60");

        const res = await fetch(`/api/admin/media?${params.toString()}`, {
          credentials: "same-origin",
        });
        if (res.ok && active) {
          const data = await res.json();
          const rawItems = Array.isArray(data.items) ? data.items : [];
          const validAssets = rawItems.filter(
            (item: unknown): item is MediaAsset =>
              Boolean(item && typeof item === "object" && typeof (item as MediaAsset).url === "string")
          );
          setItems(validAssets);
        }
      } catch {
        // Handle error silently in picker
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(fetchAssets, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, search, mimeType]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleClose]);

  const handlePickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alt_text", file.name.replace(/\.[^/.]+$/, ""));
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const newAsset = (data.asset || data) as MediaAsset;
        if (newAsset && typeof newAsset === "object" && typeof newAsset.url === "string") {
          setItems((prev) => [newAsset, ...prev]);
          setSelectedId(newAsset.id);
        }
      } else {
        const errData = await res.json().catch(() => null);
        setUploadError(errData?.error || "Upload failed. Please check file format and size.");
      }
    } catch {
      setUploadError("Network error while uploading image asset.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  if (!isOpen) return null;

  const selectedAsset = items.find((i) => i && i.id === selectedId);

  return (
    <div
      className="media-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(20, 30, 25, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        className="media-picker-drawer"
        style={{
          background: "#fbf8f1",
          borderRadius: 12,
          width: "100%",
          maxWidth: 920,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          border: "1px solid #d9d4c8",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2ddd2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f2ece1",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ImageIcon size={20} color="#23483a" />
            <h3 id="media-picker-title" style={{ margin: 0, fontSize: 17, color: "#1d2a24", fontWeight: 700 }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close media picker"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              color: "#555850",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Search & MIME Filters & Upload */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid #e2ddd2",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            background: "#faf6ed",
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#7e786b",
              }}
            />
            <input
              ref={searchInputRef}
              type="search"
              name="search"
              placeholder="Search by filename or alt text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px 8px 34px",
                fontSize: 13,
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                background: "#ffffff",
              }}
            />
          </div>

          {/* Quick upload direct to library */}
          <label
            className="picker-upload-zone"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px dashed #23483a",
              background: "#f0f6f2",
              color: "#23483a",
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            <Upload size={14} />
            <span>{uploading ? "Uploading…" : "Quick Upload"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handlePickerUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>

          {/* MIME Filter Tabs */}
          <div role="tablist" className="mime-filters" style={{ display: "flex", gap: 4 }}>
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
                onClick={() => setMimeType(tab.id)}
                style={{
                  padding: "6px 12px",
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

        {uploadError && (
          <div
            role="alert"
            style={{
              padding: "10px 20px",
              background: "#fdf2f2",
              borderBottom: "1px solid #f8b4b4",
              color: "#9b1c1c",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={15} />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Media Grid */}
        <div
          className="media-picker-grid"
          data-testid="media-picker"
          style={{
            padding: 20,
            overflowY: "auto",
            flex: 1,
            minHeight: 280,
          }}
        >
          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 14,
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="skeleton-card"
                  style={{
                    height: 140,
                    background: "#ede9df",
                    borderRadius: 8,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              className="empty-state"
              data-testid="empty-state"
              style={{ textAlign: "center", padding: "40px 20px", color: "#7e786b" }}
            >
              <ImageIcon size={40} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No media assets found</p>
              <small>Try a different search keyword or format filter.</small>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 14,
              }}
            >
              {items
                .filter((asset): asset is MediaAsset => Boolean(asset && typeof asset.url === "string"))
                .map((asset) => {
                  const isSelected = selectedId === asset.id;
                  const isUnoptimized = Boolean(
                    asset.url && (asset.url.startsWith("/uploads/") || asset.url.startsWith("http"))
                  );
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedId(asset.id)}
                      onDoubleClick={() => {
                        onSelect(asset);
                        handleClose();
                      }}
                      style={{
                        border: isSelected ? "2px solid #23483a" : "1px solid #d9d4c8",
                        borderRadius: 8,
                        background: "#ffffff",
                        padding: 6,
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        boxShadow: isSelected ? "0 0 0 2px rgba(35, 72, 58, 0.2)" : "none",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          aspectRatio: "1/1",
                          background: "#ede9df",
                          borderRadius: 4,
                          overflow: "hidden",
                          marginBottom: 6,
                        }}
                      >
                        <Image
                          src={asset.url}
                          alt={asset.alt_text || asset.filename || "Media asset"}
                          fill
                          sizes="140px"
                          style={{ objectFit: "cover" }}
                          unoptimized={isUnoptimized}
                        />
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "#23483a",
                            color: "#ffffff",
                            borderRadius: "50%",
                            width: 20,
                            height: 20,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#2a2d28",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={asset.filename}
                    >
                      {asset.filename}
                    </span>
                    <span style={{ fontSize: 10, color: "#777c72" }}>
                      {(asset.file_size / 1024).toFixed(0)} KB
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2ddd2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f7f3eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#666b60" }}>
            {selectedAsset ? (
              <div>
                <div>Selected: <strong>{selectedAsset.filename}</strong></div>
                <div
                  className="media-picker-alt"
                  data-testid="picker-alt-preview"
                  style={{ fontSize: 11, color: "#23483a", marginTop: 2 }}
                >
                  Alt: {selectedAsset.alt_text || "No alt text set"}
                </div>
              </div>
            ) : (
              <div
                className="media-picker-alt"
                data-testid="picker-alt-preview"
                style={{ fontSize: 11, color: "#8a8f85" }}
              >
                Select an asset to preview alt text and attach to form
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                border: "1px solid #c9c2b6",
                background: "#ffffff",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedAsset}
              onClick={() => {
                if (selectedAsset) {
                  onSelect(selectedAsset);
                  handleClose();
                }
              }}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                background: selectedAsset ? "#23483a" : "#a8b2ac",
                color: "#ffffff",
                borderRadius: 6,
                cursor: selectedAsset ? "pointer" : "not-allowed",
              }}
            >
              Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
