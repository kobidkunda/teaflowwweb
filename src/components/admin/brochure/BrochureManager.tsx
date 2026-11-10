"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Eye,
} from "lucide-react";
import type { BrochureSettings } from "@/lib/brochure";

interface RecentPdf {
  id: number;
  filename: string;
  original_name?: string;
  url: string;
  file_size: number;
  created_at?: string;
}

export function BrochureManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Download Brochure");
  const [enabled, setEnabled] = useState(true);
  const [brochureUrl, setBrochureUrl] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [formattedSize, setFormattedSize] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [fileExists, setFileExists] = useState(false);

  const [recentPdfs, setRecentPdfs] = useState<RecentPdf[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBrochure = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/brochure", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load brochure settings.");
      const data = (await res.json()) as {
        settings: BrochureSettings;
        recentPdfs?: RecentPdf[];
      };
      if (data.settings) {
        setTitle(data.settings.title || "");
        setDescription(data.settings.description || "");
        setButtonLabel(data.settings.button_label || "Download Brochure");
        setEnabled(data.settings.enabled);
        setBrochureUrl(data.settings.url);
        setFileSize(data.settings.file_size);
        setFormattedSize(data.settings.formatted_size);
        setUpdatedAt(data.settings.updated_at);
        setFileExists(data.settings.file_exists);
      }
      if (data.recentPdfs) {
        setRecentPdfs(data.recentPdfs);
      }
    } catch (e) {
      setStatusMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Unable to retrieve brochure settings.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBrochure();
  }, []);

  const handleFileUpload = async (file: File) => {
    setStatusMessage(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setStatusMessage({
        type: "error",
        text: "Invalid file format. Please upload a valid PDF document (.pdf).",
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatusMessage({
        type: "error",
        text: `File exceeds 15MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please compress the PDF before uploading.`,
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " "));
      formData.append("description", description.trim());
      formData.append("button_label", buttonLabel.trim());
      formData.append("enabled", enabled ? "1" : "0");

      const res = await fetch("/api/admin/brochure", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Upload failed. Please check the file and try again.");
      }

      const data = (await res.json()) as { settings: BrochureSettings };
      if (data.settings) {
        setTitle(data.settings.title);
        setDescription(data.settings.description);
        setButtonLabel(data.settings.button_label);
        setEnabled(data.settings.enabled);
        setBrochureUrl(data.settings.url);
        setFileSize(data.settings.file_size);
        setFormattedSize(data.settings.formatted_size);
        setUpdatedAt(data.settings.updated_at);
        setFileExists(data.settings.file_exists);
      }

      setStatusMessage({
        type: "success",
        text: `Brochure catalogue "${file.name}" uploaded and published successfully!`,
      });

      // Refresh recent list
      void fetchBrochure();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error uploading brochure.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!title.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a document title." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/brochure", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brochure_title: title.trim(),
          brochure_description: description.trim(),
          brochure_button_label: buttonLabel.trim() || "Download Brochure",
          brochure_enabled: enabled,
          brochure_url: brochureUrl,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to update brochure settings.");
      }

      const data = (await res.json()) as { settings: BrochureSettings };
      if (data.settings) {
        setTitle(data.settings.title);
        setDescription(data.settings.description);
        setButtonLabel(data.settings.button_label);
        setEnabled(data.settings.enabled);
        setBrochureUrl(data.settings.url);
        setFileSize(data.settings.file_size);
        setFormattedSize(data.settings.formatted_size);
        setUpdatedAt(data.settings.updated_at);
        setFileExists(data.settings.file_exists);
      }

      setStatusMessage({
        type: "success",
        text: "Brochure settings and storefront download configuration saved!",
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving brochure settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExistingPdf = async (pdfUrl: string, pdfName: string) => {
    setBrochureUrl(pdfUrl);
    setStatusMessage({
      type: "success",
      text: `Selected "${pdfName}" as the active brochure. Remember to save changes!`,
    });
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/api/brochure/download`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="brochure-manager" style={{ maxWidth: "860px" }}>
      {/* Header section */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: 700, color: "#1d2a24" }}>
              Brochure &amp; Catalogue Management
            </h1>
            <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
              Upload your official tea brochure/catalog PDF and configure download options across the website.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href="/brochure"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #d9d4c8",
                background: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                color: "#23483a",
                textDecoration: "none",
              }}
            >
              <Eye size={15} /> Preview Storefront Page
            </a>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: 500,
            background:
              statusMessage.type === "success"
                ? "rgba(35, 72, 58, 0.08)"
                : "rgba(143, 47, 42, 0.08)",
            border: `1px solid ${
              statusMessage.type === "success" ? "#23483a" : "#8f2f2a"
            }`,
            color: statusMessage.type === "success" ? "#23483a" : "#8f2f2a",
          }}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          Loading brochure configuration...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Active Brochure Status Card */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #d9d4c8",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "10px",
                    background: brochureUrl && fileExists ? "rgba(35, 72, 58, 0.1)" : "rgba(143, 47, 42, 0.1)",
                    color: brochureUrl && fileExists ? "#23483a" : "#8f2f2a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileText size={24} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "16px", color: "#1d2a24" }}>
                      {title || "No Brochure Title Set"}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        background:
                          enabled && brochureUrl && fileExists
                            ? "rgba(35, 72, 58, 0.12)"
                            : "rgba(143, 47, 42, 0.12)",
                        color:
                          enabled && brochureUrl && fileExists ? "#23483a" : "#8f2f2a",
                      }}
                    >
                      {enabled && brochureUrl && fileExists
                        ? "Active & Published"
                        : !brochureUrl
                        ? "No File Uploaded"
                        : !fileExists
                        ? "File Missing on Disk"
                        : "Download Disabled"}
                    </span>
                  </div>

                  <p style={{ margin: "4px 0 8px 0", fontSize: "13px", color: "#63665e" }}>
                    {description || "No public description specified yet."}
                  </p>

                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#8a8d83", flexWrap: "wrap" }}>
                    {brochureUrl && <span>URL: <code>{brochureUrl}</code></span>}
                    {formattedSize && <span>Size: <strong>{formattedSize}</strong></span>}
                    {updatedAt && (
                      <span>Last Updated: {new Date(updatedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {brochureUrl && (
                  <>
                    <a
                      href="/api/brochure/download"
                      download
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        background: "#23483a",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                      title="Download active brochure as PDF to test"
                    >
                      <Download size={14} /> Download Test
                    </a>

                    <a
                      href="/api/brochure/download?view=1"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d9d4c8",
                        background: "#ffffff",
                        color: "#1d2a24",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                      title="Open PDF in new browser tab"
                    >
                      <ExternalLink size={14} /> View PDF
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d9d4c8",
                        background: "#ffffff",
                        color: "#1d2a24",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Copy public download endpoint"
                    >
                      {copiedLink ? <Check size={14} color="#23483a" /> : <Copy size={14} />}
                      {copiedLink ? "Copied!" : "Copy Link"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Upload New Brochure Section */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #d9d4c8",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px 0", color: "#1d2a24" }}>
              Upload New Brochure Catalog (PDF)
            </h2>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#63665e" }}>
              Upload a revised brochure document. Standard PDF format up to 15MB is supported.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? "#23483a" : "#d9d4c8"}`,
                borderRadius: "8px",
                padding: "36px 20px",
                textAlign: "center",
                background: isDragging ? "rgba(35, 72, 58, 0.03)" : "#faf8f5",
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    void handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "rgba(35, 72, 58, 0.08)",
                  color: "#23483a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                {uploading ? (
                  <RefreshCw size={24} className="animate-spin" />
                ) : (
                  <UploadCloud size={24} />
                )}
              </div>

              <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginBottom: "4px" }}>
                {uploading ? "Uploading brochure..." : "Click to browse or drop PDF here"}
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#8a8d83" }}>
                Accepted: <code>.pdf</code> document up to 15 MB
              </p>
            </div>
          </div>

          {/* Form Configuration Section */}
          <form
            onSubmit={handleSaveSettings}
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #d9d4c8",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px 0", color: "#1d2a24" }}>
              Storefront Display &amp; Download Settings
            </h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#63665e" }}>
              Customize titles, descriptions, and visibility for visitors on the website.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Document Title */}
              <div>
                <label
                  htmlFor="brochure_title"
                  style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}
                >
                  Catalogue Document Title *
                </label>
                <input
                  id="brochure_title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. TeaFloww Sourcing & Product Brochure Catalogue 2026"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d9d4c8",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              {/* Subtitle / Description */}
              <div>
                <label
                  htmlFor="brochure_desc"
                  style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}
                >
                  Document Description &amp; Summary
                </label>
                <textarea
                  id="brochure_desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what customers and wholesale partners will discover inside..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d9d4c8",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Button Label on Website & Visibility Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <label
                    htmlFor="brochure_btn"
                    style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}
                  >
                    Storefront Button Label
                  </label>
                  <input
                    id="brochure_btn"
                    type="text"
                    value={buttonLabel}
                    onChange={(e) => setButtonLabel(e.target.value)}
                    placeholder="Download Brochure"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d9d4c8",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#8a8d83", display: "block", marginTop: "4px" }}>
                    Shown on download buttons across header, footer and wholesale pages.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="brochure_url_input"
                    style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}
                  >
                    Active File URL / Path
                  </label>
                  <input
                    id="brochure_url_input"
                    type="text"
                    value={brochureUrl || ""}
                    onChange={(e) => setBrochureUrl(e.target.value)}
                    placeholder="/uploads/teafloww-tea-catalog-brochure-2026.pdf"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d9d4c8",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#8a8d83", display: "block", marginTop: "4px" }}>
                    Auto-populated upon file upload, or enter a custom path.
                  </span>
                </div>
              </div>

              {/* Visibility Switch */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "#faf8f5",
                  border: "1px solid #e8e3d8",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#1d2a24" }}>
                    Enable Brochure Download on Website
                  </div>
                  <div style={{ fontSize: "12px", color: "#63665e" }}>
                    When enabled, download options are accessible via the header, footer, /brochure page, and wholesale section.
                  </div>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      cursor: "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: enabled ? "#23483a" : "#ccc",
                      transition: ".3s",
                      borderRadius: "24px",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        content: '""',
                        height: "18px",
                        width: "18px",
                        left: enabled ? "25px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: ".3s",
                        borderRadius: "50%",
                      }}
                    />
                  </span>
                </label>
              </div>

              {/* Submit button */}
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    borderRadius: "6px",
                    background: "#23483a",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: "none",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? "Saving settings..." : "Save Settings"}
                </button>
              </div>
            </div>
          </form>

          {/* Select from existing library PDFs */}
          {recentPdfs.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #d9d4c8",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0", color: "#1d2a24" }}>
                Select From Uploaded Documents
              </h2>
              <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#63665e" }}>
                Previously uploaded PDF documents available in the media library:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {recentPdfs.map((pdf) => {
                  const isCurrent = brochureUrl === pdf.url;
                  return (
                    <div
                      key={pdf.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: isCurrent ? "rgba(35, 72, 58, 0.05)" : "#faf8f5",
                        border: `1px solid ${isCurrent ? "#23483a" : "#e8e3d8"}`,
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FileText size={18} color="#23483a" />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1d2a24" }}>
                            {pdf.original_name || pdf.filename}
                          </div>
                          <div style={{ fontSize: "11px", color: "#8a8d83" }}>
                            <code>{pdf.url}</code> &bull; {(pdf.file_size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {isCurrent ? (
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#23483a" }}>
                            &bull; Active Brochure
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectExistingPdf(
                                pdf.url,
                                pdf.original_name || pdf.filename
                              )
                            }
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "#ffffff",
                              border: "1px solid #d9d4c8",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Set as Active
                          </button>
                        )}
                        <a
                          href={pdf.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#63665e",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                          title="Open PDF"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
