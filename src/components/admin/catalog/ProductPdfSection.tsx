"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  UploadCloud,
  ExternalLink,
  Trash2,
  CheckCircle,
  AlertCircle,
  Download,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";

export interface ProductPdfSectionProps {
  pdfUrl?: string | null;
  pdfTitle?: string | null;
  onPdfChange: (pdfUrl: string | null, pdfTitle: string | null) => void;
}

export function ProductPdfSection({
  pdfUrl,
  pdfTitle,
  onPdfChange,
}: ProductPdfSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState(pdfUrl || "");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTitle = pdfTitle || "";
  const hasPdf = Boolean(pdfUrl && pdfUrl.trim().length > 0);

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setUploadSuccess(null);

    // Client-side quick checks
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Invalid file type. Please select a valid PDF file (.pdf).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError("File size exceeds 15MB limit. Please compress the PDF before uploading.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alt_text", file.name);

      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to upload PDF. Please try again.");
      }

      const data = (await res.json()) as { url?: string; upload?: { url: string } };
      const uploadedUrl = data.url || data.upload?.url;

      if (!uploadedUrl) {
        throw new Error("Upload succeeded but no file URL was returned.");
      }

      // Default the title to clean filename if not set
      const defaultTitle = currentTitle || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      onPdfChange(uploadedUrl, defaultTitle);
      setManualUrl(uploadedUrl);
      setUploadSuccess("PDF document uploaded and attached successfully!");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error uploading PDF.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void handleFileUpload(e.target.files[0]);
    }
  }

  function handleRemove() {
    if (confirm("Are you sure you want to remove the attached PDF dossier?")) {
      onPdfChange(null, null);
      setManualUrl("");
      setUploadSuccess("PDF document detached from product.");
    }
  }

  function handleManualUrlApply() {
    const trimmed = manualUrl.trim();
    if (!trimmed) {
      onPdfChange(null, null);
      setShowManualUrlInput(false);
      return;
    }
    if (!trimmed.toLowerCase().endsWith(".pdf") && !trimmed.toLowerCase().includes(".pdf?")) {
      setUploadError("Notice: URL does not end with .pdf. Ensure the link points to a valid PDF file.");
    } else {
      setUploadError(null);
    }
    const defaultTitle = currentTitle || "Estate Harvest & Tasting Dossier";
    onPdfChange(trimmed, defaultTitle);
    setShowManualUrlInput(false);
    setUploadSuccess("PDF URL updated successfully!");
  }

  return (
    <section
      style={{
        background: "#fbf8f1",
        border: "1px solid #d9d4c8",
        borderRadius: 8,
        padding: 24,
      }}
      aria-labelledby="product-pdf-section-title"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3
            id="product-pdf-section-title"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1d2a24",
              marginTop: 0,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileText size={18} color="#b36b3d" />
            <span>Estate Batch Dossier &amp; Certification (PDF)</span>
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7266", lineHeight: 1.5, maxWidth: 680 }}>
            Attach an official tea estate harvest certificate, cupping sheet, origin authenticity lab analysis, or connoisseur brewing booklet. Storefront visitors will be able to preview it directly in an accessible interactive modal or download it.
          </p>
        </div>

        {hasPdf && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: "#2c4e38",
              background: "#e4efe8",
              padding: "4px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <CheckCircle size={13} />
            Attached
          </span>
        )}
      </div>

      {/* Messages */}
      {uploadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "#fdf3f2",
            border: "1px solid #f2c7c5",
            borderRadius: 6,
            color: "#8f2f2a",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <AlertCircle size={16} />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "#edf7ed",
            border: "1px solid #c8e6c9",
            borderRadius: 6,
            color: "#2e7d32",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <CheckCircle size={16} />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-label="Upload PDF dossier file"
      />

      {hasPdf ? (
        /* Attached PDF Card */
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #cfc7b6",
            borderRadius: 8,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            {/* PDF Emblem */}
            <div
              style={{
                width: 48,
                height: 56,
                background: "linear-gradient(135deg, #b91c1c, #991b1b)",
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(185, 28, 28, 0.25)",
                flexShrink: 0,
              }}
            >
              <FileText size={20} strokeWidth={2.2} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", marginTop: 2 }}>PDF</span>
            </div>

            {/* Title & URL Inputs */}
            <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label
                  htmlFor="pdf-document-title"
                  style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1d2a24", marginBottom: 4 }}
                >
                  Document Display Title (shown on storefront)
                </label>
                <input
                  id="pdf-document-title"
                  type="text"
                  value={currentTitle}
                  onChange={(e) => onPdfChange(pdfUrl || null, e.target.value)}
                  placeholder="e.g. 2026 First Flush Estate Tasting Dossier &amp; Authenticity Certificate"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #c9c3b4",
                    borderRadius: 6,
                    fontSize: 14,
                    color: "#1d2a24",
                    background: "#fcfbf9",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#63685e" }}>
                <span style={{ fontWeight: 600 }}>File URL:</span>
                <code
                  style={{
                    background: "#f0ece1",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#2c4e38",
                    maxWidth: 380,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={pdfUrl || ""}
                >
                  {pdfUrl}
                </code>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 12,
              borderTop: "1px solid #ebe5d8",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <a
                href={pdfUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "6px 12px",
                  background: "#ffffff",
                }}
              >
                <ExternalLink size={14} />
                <span>Preview PDF in New Tab</span>
              </a>

              <a
                href={`${pdfUrl}?download=1`}
                download
                className="button button-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "6px 12px",
                  background: "#ffffff",
                }}
              >
                <Download size={14} />
                <span>Test Download</span>
              </a>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="button button-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "6px 12px",
                  background: "#ffffff",
                }}
              >
                <RefreshCw size={13} className={isUploading ? "animate-spin" : ""} />
                <span>{isUploading ? "Uploading…" : "Replace PDF"}</span>
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={handleRemove}
                className="button button-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "6px 12px",
                  color: "#8f2f2a",
                  borderColor: "#f2c7c5",
                  background: "#ffffff",
                }}
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Dropzone State */
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            style={{
              border: `2px dashed ${isDragging ? "#2c4e38" : "#cfc7b6"}`,
              borderRadius: 8,
              padding: "32px 20px",
              textAlign: "center",
              cursor: isUploading ? "wait" : "pointer",
              background: isDragging ? "#eef6f0" : "#ffffff",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#f4eee1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2c4e38",
              }}
            >
              <UploadCloud size={24} />
            </div>

            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 600, color: "#1d2a24" }}>
                {isUploading ? "Uploading & Validating PDF…" : "Click to browse or drag & drop PDF file here"}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#74786d" }}>
                Single-estate cupping sheets, batch certifications, or tasting booklets (PDF up to 15MB)
              </p>
            </div>

            <button
              type="button"
              disabled={isUploading}
              style={{
                marginTop: 4,
                padding: "6px 14px",
                background: "#2c4e38",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isUploading ? "Uploading…" : "Select PDF Document"}
            </button>
          </div>

          {/* Alternative: Manual URL link */}
          <div style={{ marginTop: 12, textAlign: "right" }}>
            {!showManualUrlInput ? (
              <button
                type="button"
                onClick={() => setShowManualUrlInput(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#b36b3d",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "underline",
                }}
              >
                <LinkIcon size={12} />
                <span>Or provide an external PDF link directly</span>
              </button>
            ) : (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #cfc7b6",
                  borderRadius: 6,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://example.com/estate-dossier.pdf"
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    border: "1px solid #c9c3b4",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                />
                <button
                  type="button"
                  onClick={handleManualUrlApply}
                  style={{
                    padding: "6px 12px",
                    background: "#2c4e38",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Apply Link
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualUrlInput(false)}
                  style={{
                    padding: "6px 10px",
                    background: "#f0ece1",
                    color: "#1d2a24",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
