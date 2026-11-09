"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Upload, Star, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon, AlertCircle } from "lucide-react";
import { MediaPicker } from "./MediaPicker";

export interface GalleryImage {
  id?: number;
  url: string;
  alt_text: string;
  sort_order: number;
  is_primary: number;
  variant_skus?: string[];
}

export interface MultiImageUploaderProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  maxFiles?: number;
  variants?: { sku: string; grams: number; packaging_format: string }[];
}

export function MultiImageUploader({
  images,
  onChange,
  maxFiles = 10,
  variants = [],
}: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [manualAlt, setManualAlt] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    setUploading(true);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const newItems: GalleryImage[] = [...images];

    for (let i = 0; i < fileList.length; i++) {
      if (newItems.length >= maxFiles) break;
      const file = fileList[i];

      if (!allowedTypes.includes(file.type)) {
        setUploadError(`File "${file.name}" has unsupported type. Use JPEG, PNG, WebP, or AVIF.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("alt_text", file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));

        const res = await fetch("/api/admin/uploads", {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          setUploadError(errData?.error || `Upload failed for ${file.name}`);
          continue;
        }

        const data = (await res.json()) as { url?: string; upload?: { url: string; alt_text?: string }; asset?: { url: string } };
        const url = data.url || data.upload?.url || data.asset?.url;
        if (url) {
          const isFirst = newItems.length === 0;
          newItems.push({
            url,
            alt_text: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
            sort_order: newItems.length,
            is_primary: isFirst ? 1 : 0,
            variant_skus: [],
          });
        }
      } catch {
        setUploadError(`Network error while uploading ${file.name}.`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange(newItems);
  }

  function handleAddManual() {
    if (!manualUrl.trim()) return;
    const isFirst = images.length === 0;
    const updated = [
      ...images,
      {
        url: manualUrl.trim(),
        alt_text: manualAlt.trim() || "Tea product image",
        sort_order: images.length,
        is_primary: isFirst ? 1 : 0,
            variant_skus: [],
      },
    ];
    setManualUrl("");
    setManualAlt("");
    onChange(updated);
  }

  function handleRemove(index: number) {
    const updated = images.filter((_, idx) => idx !== index);
    // If the removed image was primary and there are remaining images, set first as primary
    const hadPrimary = images[index]?.is_primary === 1;
    if (hadPrimary && updated.length > 0) {
      updated[0].is_primary = 1;
    }
    // Re-index sort order
    const reindexed = updated.map((img, idx) => ({ ...img, sort_order: idx }));
    onChange(reindexed);
  }

  function handleSetPrimary(index: number) {
    const updated = images.map((img, idx) => ({
      ...img,
      is_primary: idx === index ? 1 : 0,
    }));
    onChange(updated);
  }

  function handleMove(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= images.length) return;
    const updated = [...images];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    const reindexed = updated.map((img, idx) => ({ ...img, sort_order: idx }));
    onChange(reindexed);
  }

  function handleAltChange(index: number, newAlt: string) {
    const updated = images.map((img, idx) =>
      idx === index ? { ...img, alt_text: newAlt.slice(0, 200) } : img
    );
    onChange(updated);
  }

  return (
    <div className="multi-image-uploader-root" style={{ marginTop: 8 }}>
      {/* Upload Zone */}
      <div
        className="upload-dropzone"
        style={{
          border: "2px dashed #c9c2b6",
          borderRadius: 8,
          padding: 24,
          textAlign: "center",
          background: "#fbf8f1",
          cursor: "pointer",
          transition: "border-color 150ms ease",
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleFilesSelected(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => void handleFilesSelected(e.target.files)}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Upload size={28} color="#23483a" aria-hidden="true" />
          <p style={{ margin: 0, fontWeight: 600, color: "#1d2a24", fontSize: 14 }}>
            Click to upload images, or drag and drop files here
          </p>
          <span style={{ fontSize: 12, color: "#6a6e64" }}>
            JPEG, PNG, WebP, or AVIF (up to 5MB each). Maximum {maxFiles} images.
          </span>
          {uploading && (
            <p role="status" style={{ fontSize: 13, color: "#b36b3d", margin: 0 }}>
              Uploading images…
            </p>
          )}
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "#fdf3f2",
            border: "1px solid #f2c7c5",
            borderRadius: 6,
            color: "#8f2f2a",
            fontSize: 13,
            marginTop: 10,
          }}
        >
          <AlertCircle size={16} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Manual URL input fallback */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginTop: 12,
          padding: "10px 14px",
          background: "#f6f1e7",
          flexWrap: "wrap",
          borderRadius: 6,
          border: "1px solid #d9d4c8",
        }}
      >
        <ImageIcon size={18} color="#6a6e64" aria-hidden="true" />
        <input
          type="text"
          placeholder="Or paste image URL (/uploads/... or https://...)"
          aria-label="Image URL"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          style={{ flex: 2, padding: "6px 10px", fontSize: 13, borderRadius: 4, border: "1px solid #c9c2b6" }}
        />
        <input
          type="text"
          placeholder="Alt text (mandatory for a11y)"
          aria-label="Image description"
          value={manualAlt}
          onChange={(e) => setManualAlt(e.target.value)}
          style={{ flex: 1, padding: "6px 10px", fontSize: 13, borderRadius: 4, border: "1px solid #c9c2b6" }}
        />
        <button
          type="button"
          onClick={handleAddManual}
          disabled={!manualUrl.trim()}
          className="button button-outline"
          style={{ padding: "6px 14px", fontSize: 12, whiteSpace: "nowrap" }}
        >
          Add URL
        </button>
      </div>

      {/* Media Library Integration */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div data-testid="media-picker-btn" style={{ display: "inline-flex" }}>
          <button
            type="button"
            data-testid="media-picker-trigger"
            onClick={() => setPickerOpen(true)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              background: "#23483a",
              color: "#ffffff",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <ImageIcon size={16} />
            <span>Select from Media Library</span>
          </button>
        </div>
        <span style={{ fontSize: 12, color: "#6a6e64" }}>
          Browse existing photography or upload new assets to reuse
        </span>
        <input type="hidden" name="images" value={JSON.stringify(images)} />
      </div>

      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          if (!asset || !asset.url) return;
          const isFirst = images.length === 0;
          const newImg: GalleryImage = {
            url: asset.url,
            alt_text: asset.alt_text || asset.filename || "Tea product image",
            sort_order: images.length,
            is_primary: isFirst ? 1 : 0,
            variant_skus: [],
          };
          onChange([...images, newImg]);
        }}
      />

      {/* Thumbnails Gallery & Reordering Grid */}
      {images.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px 0", color: "#1d2a24" }}>
            Gallery Images ({images.length} of {maxFiles})
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {images.map((img, idx) => {
              const isPrimary = img.is_primary === 1;
              const hasNoAlt = !img.alt_text || img.alt_text.trim() === "";

              return (
                <div
                  key={img.url + idx}
                  style={{
                    background: "#ffffff",
                    border: isPrimary ? "2px solid #23483a" : "1px solid #d9d4c8",
                    borderRadius: 8,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    position: "relative",
                  }}
                >
                  {/* Primary Badge */}
                  {isPrimary && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        background: "#23483a",
                        color: "#ffffff",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        zIndex: 2,
                      }}
                    >
                      <Star size={11} fill="#ffffff" />
                      <span>Primary Cover</span>
                    </div>
                  )}

                  {/* Thumbnail Image */}
                  <div
                    style={{
                      height: 140,
                      background: "#ede9df",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt_text || `Image ${idx + 1}`}
                      width={200}
                      height={140}
                      sizes="200px"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      unoptimized={Boolean(img.url && (img.url.startsWith("/uploads/") || img.url.startsWith("http")))}
                    />
                  </div>

                  {/* Image Details & Alt text input */}
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: hasNoAlt ? "#8f2f2a" : "#494a44" }}>
                      Alt text (Mandatory):
                      {hasNoAlt && <span style={{ color: "#8f2f2a" }}> * required</span>}
                      <input
                        type="text"
                        value={img.alt_text}
                        placeholder="Describe image for screen readers"
                        maxLength={200}
                        onChange={(e) => handleAltChange(idx, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          fontSize: 12,
                          marginTop: 4,
                          borderRadius: 4,
                          border: hasNoAlt ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                          boxSizing: "border-box",
                        }}
                      />
                    </label>

                    {variants.length > 0 && (
                      <fieldset style={{ border: "1px solid #d9d4c8", padding: 8, margin: "10px 0", minWidth: 0, borderRadius: 4 }}>
                        <legend style={{ fontSize: 12, fontWeight: 600 }}>Show image {idx + 1} for variants</legend>
                        <p style={{ fontSize: 11, color: "#63685e", margin: "0 0 8px" }}>
                          No selection shares this image across all variants. Use quick selectors to tag an entire base format.
                        </p>

                        {/* Quick format selectors */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                          {Array.from(new Set(variants.map((v) => v.packaging_format).filter(Boolean))).map((fmt) => {
                            const fmtSkus = variants.filter((v) => v.packaging_format === fmt && v.sku).map((v) => v.sku);
                            const allSelected = fmtSkus.length > 0 && fmtSkus.every((s) => img.variant_skus?.includes(s));
                            const label =
                              fmt === "loose_leaf_pouch"
                                ? "All Pouches"
                                : fmt === "luxury_tin"
                                ? "All Tins"
                                : fmt === "pyramid_bags"
                                ? "All Bags"
                                : fmt;
                            return (
                              <button
                                key={fmt}
                                type="button"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 3,
                                  border: "1px solid #c8c2b5",
                                  background: allSelected ? "#23483a" : "#ede8de",
                                  color: allSelected ? "#ffffff" : "#2c3329",
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  const selected = img.variant_skus ?? [];
                                  const next = allSelected
                                    ? selected.filter((s) => !fmtSkus.includes(s))
                                    : Array.from(new Set([...selected, ...fmtSkus]));
                                  onChange(images.map((image, imageIndex) => imageIndex === idx ? { ...image, variant_skus: next } : image));
                                }}
                              >
                                {allSelected ? `✓ ${label}` : `+ ${label}`}
                              </button>
                            );
                          })}
                          {(img.variant_skus?.length ?? 0) > 0 && (
                            <button
                              type="button"
                              style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 3,
                                border: "1px dashed #a8a092",
                                background: "transparent",
                                color: "#63685e",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                onChange(images.map((image, imageIndex) => imageIndex === idx ? { ...image, variant_skus: [] } : image));
                              }}
                            >
                              Clear (Shared)
                            </button>
                          )}
                        </div>

                        {/* Individual variant checkboxes */}
                        <div style={{ maxHeight: 150, overflowY: "auto", borderTop: "1px solid #f0ebe0", paddingTop: 4 }}>
                          {variants.filter((variant) => variant.sku).map((variant) => (
                            <label key={variant.sku} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, fontSize: 11, cursor: "pointer" }}>
                              <input type="checkbox" checked={img.variant_skus?.includes(variant.sku) ?? false}
                                aria-label={`Image ${idx + 1}: ${variant.sku}`}
                                onChange={(event) => {
                                  const selected = img.variant_skus ?? [];
                                  const skus = event.target.checked ? [...selected, variant.sku] : selected.filter((sku) => sku !== variant.sku);
                                  onChange(images.map((image, imageIndex) => imageIndex === idx ? { ...image, variant_skus: skus } : image));
                                }} />
                              <span>{variant.grams}g · {variant.packaging_format.replace(/_/g, " ")} · <code style={{ fontSize: 10 }}>{variant.sku}</code></span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    {/* Controls row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: "auto",
                        paddingTop: 8,
                        borderTop: "1px solid #f0ebe0",
                      }}
                    >
                      {/* Reorder Buttons */}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, idx - 1)}
                          title="Move Left"
                          aria-label={`Move image ${idx + 1} left`}
                          style={{
                            padding: 4,
                            background: "#f6f1e7",
                            border: "1px solid #d9d4c8",
                            borderRadius: 4,
                            cursor: idx === 0 ? "not-allowed" : "pointer",
                            opacity: idx === 0 ? 0.4 : 1,
                          }}
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={() => handleMove(idx, idx + 1)}
                          title="Move Right"
                          aria-label={`Move image ${idx + 1} right`}
                          style={{
                            padding: 4,
                            background: "#f6f1e7",
                            border: "1px solid #d9d4c8",
                            borderRadius: 4,
                            cursor: idx === images.length - 1 ? "not-allowed" : "pointer",
                            opacity: idx === images.length - 1 ? 0.4 : 1,
                          }}
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>

                      {/* Primary Toggle & Remove */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(idx)}
                            className="button button-outline"
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            title="Make this the primary cover image"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          title="Remove image"
                          aria-label={`Remove image ${idx + 1}`}
                          style={{
                            padding: 4,
                            background: "transparent",
                            border: "none",
                            color: "#8f2f2a",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
