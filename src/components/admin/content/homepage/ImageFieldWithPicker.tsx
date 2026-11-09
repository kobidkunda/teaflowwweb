"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Upload, Image as ImageIcon, X, FolderOpen, AlertCircle } from "lucide-react";
import { MediaPicker } from "../../catalog/MediaPicker";
import type { MediaAsset } from "@/lib/media";

export interface ImageFieldWithPickerProps {
  id: string;
  label: string;
  description?: string;
  imageUrl: string;
  imageAlt: string;
  onImageUrlChange: (url: string) => void;
  onImageAltChange: (alt: string) => void;
  aspectRatioHint?: string;
  recommendation?: string;
  disabled?: boolean;
  previewAspectRatio?: string;
}

export function ImageFieldWithPicker({
  id,
  label,
  description,
  imageUrl,
  imageAlt,
  onImageUrlChange,
  onImageAltChange,
  aspectRatioHint = "16:9 Landscape",
  recommendation = "WebP or JPEG under 5 MB",
  disabled = false,
  previewAspectRatio,
}: ImageFieldWithPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidLocalPath =
    !imageUrl || (/^\/(?!\/)/.test(imageUrl) && !/[\\\s\u0000-\u001f]/.test(imageUrl));

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image file size exceeds 5 MB limit.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("alt_text", imageAlt.trim() || file.name.replace(/\.[^/.]+$/, ""));

    try {
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const uploadedUrl = data.url || data.upload?.url || data.asset?.url;
      if (!res.ok || !uploadedUrl) {
        throw new Error(data.error || "Failed to upload image.");
      }
      onImageUrlChange(uploadedUrl);
      if (!imageAlt.trim()) {
        onImageAltChange(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleAssetSelected(asset: MediaAsset) {
    if (!asset || !asset.url) return;
    onImageUrlChange(asset.url);
    if (asset.alt_text && !imageAlt.trim()) {
      onImageAltChange(asset.alt_text);
    }
    setPickerOpen(false);
  }

  return (
    <div className="hp-img-field">
      <div className="hp-img-header">
        <label htmlFor={`${id}-alt`} className="hp-img-label">
          {label}
        </label>
        <span className="hp-img-badge">{aspectRatioHint}</span>
      </div>

      {description && <p className="hp-img-desc">{description}</p>}

      <div className="hp-img-main">
        {/* Preview Frame */}
        <div className="hp-img-preview-box" style={previewAspectRatio ? { aspectRatio: previewAspectRatio, height: "auto" } : undefined}>
          {imageUrl && isValidLocalPath ? (
            <div className="hp-img-preview-inner" style={previewAspectRatio ? { position: "relative", aspectRatio: previewAspectRatio, width: "100%", height: "auto" } : undefined}>
              <Image
                src={imageUrl}
                alt={imageAlt || "Asset preview"}
                width={380}
                height={200}
                className="hp-img-preview-img"
                style={previewAspectRatio ? { width: "100%", height: "100%", position: "absolute", inset: 0, objectFit: "cover", objectPosition: "center" } : undefined}
                unoptimized
              />
              <div className="hp-img-overlay-actions">
                <button
                  type="button"
                  className="hp-img-icon-btn remove"
                  title="Clear image"
                  onClick={() => onImageUrlChange("")}
                  disabled={disabled}
                >
                  <X size={15} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="hp-img-empty-box">
              <ImageIcon size={32} className="hp-img-empty-icon" />
              <p className="hp-img-empty-text">No image selected</p>
              <span className="hp-img-empty-sub">{recommendation}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="hp-img-controls">
          <div className="hp-img-btn-row">
            <button
              type="button"
              className="hp-action-btn media-lib-btn"
              onClick={() => setPickerOpen(true)}
              disabled={disabled || uploading}
            >
              <FolderOpen size={16} />
              <span>Media Library</span>
            </button>

            <button
              type="button"
              className="hp-action-btn upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
            >
              <Upload size={16} />
              <span>{uploading ? "Uploading…" : "Upload New"}</span>
            </button>

            <button
              type="button"
              className="hp-action-btn toggle-input-btn"
              onClick={() => setShowManualInput(!showManualInput)}
              title="Edit URL directly"
            >
              <span>{showManualInput ? "Hide Path" : "Edit Path"}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileUpload}
              disabled={disabled || uploading}
            />
          </div>

          {/* Direct Path Input (Optional / Expandable) */}
          {showManualInput && (
            <div className="hp-img-path-input-group">
              <label htmlFor={`${id}-url`} className="hp-sublabel">
                Image Path (e.g. /images/home/ritual-hero.webp)
              </label>
              <input
                id={`${id}-url`}
                type="text"
                value={imageUrl}
                onChange={(e) => onImageUrlChange(e.target.value)}
                placeholder="/images/home/..."
                className={`hp-input ${!isValidLocalPath ? "input-error" : ""}`}
                disabled={disabled}
              />
              {!isValidLocalPath && (
                <p className="hp-error-hint">
                  <AlertCircle size={13} /> Must be a local path starting with / (e.g. /images/...)
                </p>
              )}
            </div>
          )}

          {/* Alt Text Input */}
          <div className="hp-img-alt-group">
            <label htmlFor={`${id}-alt`} className="hp-sublabel">
              Descriptive Alt Text <span className="req-star">*</span>
            </label>
            <input
              id={`${id}-alt`}
              type="text"
              value={imageAlt}
              onChange={(e) => onImageAltChange(e.target.value)}
              placeholder="e.g. Loose tea leaves steeping in an artisan porcelain gaiwan"
              className="hp-input"
              maxLength={300}
              disabled={disabled}
            />
            <p className="hp-hint">
              Used by screen readers and search engines. Accurately describe the visual content.
            </p>
          </div>

          {uploadError && (
            <div className="hp-upload-error-banner" role="alert">
              <AlertCircle size={14} />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAssetSelected}
        title={`Select Asset for ${label}`}
      />
    </div>
  );
}
