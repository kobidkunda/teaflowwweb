"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  Upload,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

export default function AdminMediaNewPage() {
  return (
    <AdminAuthGate>
      <MediaNewContent />
    </AdminAuthGate>
  );
}

function MediaNewContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSelectFile = (selected: File) => {
    setError(null);
    if (!selected.type.startsWith("image/")) {
      setError("Selected file is not an image. Allowed formats: JPEG, PNG, WebP, AVIF.");
      return;
    }
    if (selected.type.includes("svg") || selected.name.toLowerCase().endsWith(".svg")) {
      setError("SVG files are not permitted for security reasons (XSS vector prevention).");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB size limit.");
      return;
    }

    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
    if (!altText) {
      const suggestedAlt = selected.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      setAltText(suggestedAlt);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (altText.trim()) formData.append("alt_text", altText.trim());
      if (caption.trim()) formData.append("caption", caption.trim());

      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload media asset.");
      }

      const data = await res.json();
      const asset = data.asset || data;
      setSuccess(true);
      setTimeout(() => {
        router.push(`/admin/media/${asset.id}`);
      }, 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Back button */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/media"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#23483a",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Media Library</span>
        </Link>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 10,
          padding: 32,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px 0", color: "#1d2a24" }}>
          Upload Media Asset
        </h1>
        <p style={{ margin: "0 0 24px 0", fontSize: 13, color: "#6a6e64" }}>
          Upload high-resolution photography for single estates, tea gardens, cupping notes, and hero sections.
          Magic bytes are strictly verified. Max size 5MB (JPEG, PNG, WebP, AVIF).
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: "12px 16px",
              background: "#fdf3f2",
              border: "1px solid #f2bcba",
              borderRadius: 6,
              color: "#8f2f2a",
              marginBottom: 20,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              padding: "12px 16px",
              background: "#f0f7f2",
              border: "1px solid #b7dcbf",
              borderRadius: 6,
              color: "#23483a",
              marginBottom: 20,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>Asset uploaded successfully! Redirecting to dossier…</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Dropzone Container */}
          <div
            className="dropzone"
            data-testid="upload-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragOver ? "2px dashed #23483a" : "2px dashed #c9c2b6",
              borderRadius: 8,
              background: isDragOver ? "#f0f6f2" : "#faf8f4",
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 24,
              transition: "all 150ms ease",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectFile(e.target.files[0]);
                }
              }}
              style={{ display: "none" }}
            />

            {previewUrl ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <Image
                  src={previewUrl}
                  alt="Upload preview"
                  width={300}
                  height={220}
                  unoptimized
                  style={{
                    maxHeight: 220,
                    maxWidth: "100%",
                    borderRadius: 6,
                    objectFit: "contain",
                    border: "1px solid #d9d4c8",
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1d2a24" }}>
                  {file?.name} ({(file ? file.size / 1024 : 0).toFixed(0)} KB)
                </span>
                <span style={{ fontSize: 11, color: "#6a6e64" }}>
                  Click or drag another image to replace
                </span>
              </div>
            ) : (
              <div>
                <ImageIcon size={44} style={{ color: "#7e786b", marginBottom: 12 }} />
                <p style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 600, color: "#1d2a24" }}>
                  Drag & drop your photographic file here, or click to browse
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#6a6e64" }}>
                  Supports WebP, AVIF, PNG, and JPEG up to 5MB. Vector SVGs are rejected.
                </p>
              </div>
            )}
          </div>

          {/* Metadata Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 28 }}>
            <div>
              <label
                htmlFor="alt-text-input"
                style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d2a24", marginBottom: 6 }}
              >
                Accessible Alt Text <span style={{ color: "#6a6e64", fontWeight: 400 }}>(Crucial for WCAG 2.2 AA)</span>
              </label>
              <input
                id="alt-text-input"
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="e.g., Whole tea leaf plucked at Risheehat estate during first flush"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  background: "#ffffff",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="caption-input"
                style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d2a24", marginBottom: 6 }}
              >
                Editorial Caption & Story Notes <span style={{ color: "#6a6e64", fontWeight: 400 }}>(Optional)</span>
              </label>
              <textarea
                id="caption-input"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Contextual garden provenance notes, elevation, harvest year, or photographer credit..."
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #c9c2b6",
                  background: "#ffffff",
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Link href="/admin/media" className="button button-outline" style={{ fontSize: 13 }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!file || uploading}
              className="button button-primary"
              style={{
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: !file || uploading ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying & Uploading…</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload & Save Asset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
