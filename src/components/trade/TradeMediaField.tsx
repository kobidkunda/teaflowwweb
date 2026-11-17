"use client";

import Image from "next/image";
import React, { useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  ImageIcon,
  Link2,
  Trash2,
  Upload,
} from "lucide-react";
import { MediaPicker } from "@/components/admin/catalog/MediaPicker";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export interface TradeMediaFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  recommendation: string;
  aspectRatio?: string;
  allowClear?: boolean;
  optional?: boolean;
}

export function TradeMediaField({
  label,
  value,
  onChange,
  recommendation,
  aspectRatio = "16 / 9",
  allowClear = false,
  optional = false,
}: TradeMediaFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgDimensions, setImgDimensions] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const id = useId();
  const titleId = `${id}-title`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedValue = value.trim();
  const isRenderableSrc =
    Boolean(trimmedValue) &&
    (/^\/(?!\/)/.test(trimmedValue) || /^https?:\/\//i.test(trimmedValue));

  async function uploadFile(file: File) {
    setError("");
    setUploadSuccess("");

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a JPEG, PNG, WebP, or AVIF image file.");
      return;
    }
    if (file.size === 0) {
      setError("Selected file is empty.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Choose an image under 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alt_text", label);

      const response = await fetch("/api/admin/media", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const result = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        asset?: { url?: string };
        upload?: { url?: string };
      };
      const uploadedUrl =
        result.url || result.asset?.url || result.upload?.url;

      if (!response.ok || !uploadedUrl) {
        throw new Error(result.error || "Upload failed. Please retry.");
      }

      setImgError(false);
      setImgDimensions(null);
      onChange(uploadedUrl);
      setUploadSuccess(`Uploaded ${file.name}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please retry."
      );
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  }

  return (
    <div className="tf-trade-media-card" role="group" aria-labelledby={titleId}>
      <div className="tf-trade-media-header">
        <div>
          <div id={titleId} className="tf-trade-label" style={{ marginBottom: 2 }}>
            {label}
            {optional ? (
              <span className="tf-trade-optional-tag">Optional</span>
            ) : null}
          </div>
          <p id={helpId} className="tf-trade-help" style={{ margin: 0 }}>
            {recommendation}
          </p>
        </div>
        {imgDimensions && !imgError ? (
          <span className="tf-badge tf-badge--ok">
            {imgDimensions.w} × {imgDimensions.h} px
          </span>
        ) : null}
      </div>

      {/* Drag-and-drop Preview Frame */}
      <div
        className={`tf-trade-dropzone ${dragActive ? "is-drag-over" : ""} ${
          isRenderableSrc && !imgError ? "has-image" : ""
        }`}
        style={{ aspectRatio }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        {isRenderableSrc && !imgError ? (
          <>
            <Image
              src={trimmedValue}
              alt={`${label} preview`}
              fill
              sizes="(max-width: 768px) 100vw, 520px"
              unoptimized
              style={{ objectFit: "cover" }}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setImgDimensions({
                    w: img.naturalWidth,
                    h: img.naturalHeight,
                  });
                }
              }}
              onError={() => {
                setImgError(true);
                setImgDimensions(null);
              }}
            />
            <div className="tf-trade-dropzone-overlay">
              <button
                type="button"
                className="tf-trade-btn tf-trade-btn--sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                <span>Replace image</span>
              </button>
              <button
                type="button"
                className="tf-trade-btn tf-trade-btn--sm"
                disabled={busy}
                onClick={() => setPickerOpen(true)}
              >
                <FolderOpen size={14} aria-hidden="true" />
                <span>Media library</span>
              </button>
              {allowClear ? (
                <button
                  type="button"
                  className="tf-trade-btn tf-trade-btn--sm tf-trade-btn--danger"
                  disabled={busy}
                  onClick={() => {
                    onChange("");
                    setImgError(false);
                    setImgDimensions(null);
                    setUploadSuccess("");
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="tf-trade-dropzone-empty">
            <div className="tf-trade-dropzone-icon" aria-hidden="true">
              <ImageIcon size={24} />
            </div>
            <p className="tf-trade-dropzone-title">
              {imgError
                ? "Image preview could not be loaded"
                : "Drag and drop an image here"}
            </p>
            <p className="tf-trade-dropzone-sub">
              JPEG, PNG, WebP, or AVIF up to 5 MB
            </p>
            <div className="tf-trade-dropzone-actions">
              <button
                type="button"
                className="tf-trade-btn tf-trade-btn--primary tf-trade-btn--sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                <span>{busy ? "Uploading…" : "Upload image"}</span>
              </button>
              <button
                type="button"
                className="tf-trade-btn tf-trade-btn--sm"
                disabled={busy}
                onClick={() => setPickerOpen(true)}
              >
                <FolderOpen size={14} aria-hidden="true" />
                <span>Choose from media</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress Indicator */}
      {busy ? (
        <div className="tf-trade-upload-status" aria-live="polite">
          <progress className="tf-trade-progress" aria-label={`Uploading ${label}`} />
          <span>Uploading and optimizing asset…</span>
        </div>
      ) : null}

      {/* Action Bar + Single-line Truncated Path + Path Toggle */}
      <div className="tf-trade-media-footer">
        <div className="tf-trade-media-actions">
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            <span>{busy ? "Uploading…" : "Upload image"}</span>
          </button>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            disabled={busy}
            onClick={() => setPickerOpen(true)}
          >
            <FolderOpen size={14} aria-hidden="true" />
            <span>Choose from media</span>
          </button>
          <button
            type="button"
            className="tf-trade-btn tf-trade-btn--sm"
            aria-expanded={showUrlEditor}
            onClick={() => setShowUrlEditor((prev) => !prev)}
          >
            <Link2 size={14} aria-hidden="true" />
            <span>{showUrlEditor ? "Hide path" : "Edit path"}</span>
          </button>
        </div>

        {trimmedValue ? (
          <div className="tf-trade-path-pill" title={trimmedValue}>
            <span className="tf-trade-single-line">{trimmedValue}</span>
          </div>
        ) : (
          <span className="tf-trade-help">No file selected</span>
        )}
      </div>

      {/* Direct Path / URL Input */}
      {showUrlEditor ? (
        <div className="tf-trade-field" style={{ marginTop: 10 }}>
          <label htmlFor={id} className="tf-trade-sublabel">
            Asset path or URL
          </label>
          <input
            id={id}
            type="text"
            className="tf-trade-input"
            value={value}
            onChange={(e) => {
              setImgError(false);
              setImgDimensions(null);
              setUploadSuccess("");
              onChange(e.target.value);
            }}
            placeholder="/uploads/trade-hero.webp"
            aria-describedby={error ? `${helpId} ${errorId}` : helpId}
            aria-invalid={error ? "true" : undefined}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      ) : null}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={`Upload file for ${label}`}
        onChange={handleFileChange}
      />

      {uploadSuccess && !error ? (
        <p className="tf-trade-inline-ok" role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{uploadSuccess} — remember to save settings to publish.</span>
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="tf-trade-inline-err" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <p className="tf-trade-help" style={{ marginTop: 8, marginBottom: 0 }}>
        Image alt text and disclosures are managed in{" "}
        <a
          href="/admin/translations?search=trade"
          className="tf-trade-text-link"
        >
          Translation Studio
        </a>
        . Use approved TeaFloww-branded packaging imagery.
      </p>

      <MediaPicker
        isOpen={pickerOpen}
        title={`Select ${label}`}
        onSelect={(asset) => {
          setImgError(false);
          setImgDimensions(null);
          setError("");
          setUploadSuccess("");
          onChange(asset.url);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
