"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { MarkdownEditor } from "./MarkdownEditor";
import { MediaPicker } from "../catalog/MediaPicker";
import type { BlogSummary } from "./BlogListTable";

export type BlogArticleFormProps = {
  initialData?: BlogSummary;
  isEditing?: boolean;
  blogId?: string;
};

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BlogArticleForm({ initialData, isEditing = false, blogId }: BlogArticleFormProps) {
  const router = useRouter();

  // Form Fields
  const [currentId, setCurrentId] = useState<number | undefined>(initialData?.id);
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [manualSlug, setManualSlug] = useState(Boolean(initialData?.slug));
  const [authorName, setAuthorName] = useState(initialData?.author_name || "Himalayan Tea House");
  const [summary, setSummary] = useState(initialData?.summary || initialData?.excerpt || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.cover_image_url || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    initialData?.status || "draft"
  );
  const [publishedAt, setPublishedAt] = useState(
    initialData?.published_at ? initialData.published_at.slice(0, 16) : ""
  );

  // Load data if blogId is passed and initialData not provided
  useEffect(() => {
    if (blogId && !initialData) {
      async function loadPost() {
        try {
          const res = await fetch(`/api/admin/blogs/${encodeURIComponent(blogId!)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.post) {
              const p = data.post as BlogSummary;
              setCurrentId(p.id);
              setTitle(p.title);
              setSlug(p.slug);
              setManualSlug(true);
              setAuthorName(p.author_name || "Himalayan Tea House");
              setSummary(p.summary || p.excerpt || "");
              setContent(p.content || "");
              setCoverImageUrl(p.cover_image_url || "");
              setStatus(p.status || "draft");
              setPublishedAt(p.published_at ? p.published_at.slice(0, 16) : "");
            }
          }
        } catch {
          // ignore error
        }
      }
      void loadPost();
    }
  }, [blogId, initialData]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"binary" | "base64">("binary");
  const [base64Input, setBase64Input] = useState("");
  const [imageMetrics, setImageMetrics] = useState<{
    width: number;
    height: number;
    ratio: string;
    is16by9: boolean;
  } | null>(null);

  // Detect image dimensions and aspect ratio when coverImageUrl updates
  useEffect(() => {
    if (!coverImageUrl || typeof window === "undefined") {
      setImageMetrics(null);
      return;
    }
    const img = new window.Image();
    img.src = coverImageUrl;
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const r = h > 0 ? w / h : 1;
      setImageMetrics({
        width: w,
        height: h,
        ratio: `${r.toFixed(2)}:1`,
        is16by9: Math.abs(r - 16 / 9) < 0.08,
      });
    };
    img.onerror = () => {
      setImageMetrics(null);
    };
  }, [coverImageUrl]);

  // Handle Cover Image Binary File Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image exceeds 5MB size limit.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("alt_text", title || "Article cover thumbnail");

    try {
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload cover photo");
      }

      const url = data.url || data.upload?.url || data.asset?.url;
      if (url) {
        setCoverImageUrl(url);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
    }
  }

  // Handle Cover Image Base64 Upload
  async function handleBase64Upload() {
    if (!base64Input.trim()) {
      setUploadError("Please paste a base64 encoded image string or data URI.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64_data: base64Input.trim(),
          filename: `${slug || "article"}-cover.jpg`,
          alt_text: title || "Article cover thumbnail",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload base64 image");
      }

      const url = data.url || data.upload?.url || data.asset?.url;
      if (url) {
        setCoverImageUrl(url);
        setBase64Input("");
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Base64 upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Form Submission State
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Auto-slug generator on title change
  function handleTitleChange(val: string) {
    setTitle(val);
    if (!manualSlug) {
      setSlug(toSlug(val));
    }
  }

  // Form submit handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Article title is required.");
      return;
    }
    if (!content.trim()) {
      setFormError("Article content is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || toSlug(title),
      author_name: authorName.trim(),
      summary: summary.trim(),
      excerpt: summary.trim(),
      content: content.trim(),
      cover_image_url: coverImageUrl.trim(),
      status,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
    };

    try {
      let res: Response;
      const targetEditId = currentId || initialData?.id || blogId;
      if (isEditing && targetEditId) {
        res = await fetch(`/api/admin/blogs/${encodeURIComponent(String(targetEditId))}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/blogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save article");
      }

      setFormSuccess(true);
      const targetId = data.post?.id || initialData?.id;
      setTimeout(() => {
        router.push(targetId ? `/admin/blogs/${targetId}` : "/admin/blogs");
      }, 800);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error saving article");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="blog-form-root">
      <div className="form-header">
        <div>
          <Link href="/admin/blogs" className="back-link">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Journal Articles</span>
          </Link>
          <h1 className="form-title">
            {isEditing ? `Edit Article — ${initialData?.title || ""}` : "Create New Journal Article"}
          </h1>
          <p className="form-subtitle">
            Share single-estate terroir stories, harvest chronicles, and tea master brewing guides.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="article-form">
        <div className="form-layout-grid">
          {/* Main Column: Content, Title, Excerpt */}
          <div className="main-form-col">
            {/* Title & Slug */}
            <div className="field-group">
              <label htmlFor="blog-title-input" className="field-label required">
                Article Title
              </label>
              <input
                id="blog-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Risheehat Summer Chinary: The Muscatel Elevation Story"
                className="text-input font-lg"
              />
            </div>

            <div className="field-group">
              <div className="label-flex">
                <label htmlFor="blog-slug-input" className="field-label">
                  URL Slug
                </label>
                <button
                  type="button"
                  className="slug-regenerate-btn"
                  onClick={() => {
                    setSlug(toSlug(title));
                    setManualSlug(false);
                  }}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  Auto-sync with title
                </button>
              </div>
              <div className="slug-input-wrap">
                <span className="slug-prefix font-mono">/journal/</span>
                <input
                  id="blog-slug-input"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setManualSlug(true);
                  }}
                  placeholder="article-slug-identifier"
                  className="text-input slug-input font-mono"
                />
              </div>
            </div>

            {/* Excerpt / Summary */}
            <div className="field-group">
              <label htmlFor="blog-summary-input" className="field-label">
                Editorial Excerpt & Summary
              </label>
              <textarea
                id="blog-summary-input"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary appearing on storefront journal cards and meta tags..."
                className="text-input"
              />
            </div>

            {/* Markdown Body Editor with live preview */}
            <div className="field-group">
              <MarkdownEditor
                id="blog-content-editor"
                value={content}
                onChange={setContent}
                label="Article Body (Markdown Supported)"
                placeholder="Compose your article using markdown: ## Headings, **bold**, *italic*, > quotes, lists..."
              />
            </div>
          </div>

          {/* Sidebar Column: Publication, Author, Media */}
          <div className="side-form-col">
            {/* Publication Settings Card */}
            <div className="side-card">
              <h2 className="side-card-title">Publication Status</h2>

              <div className="field-group">
                <label htmlFor="blog-status-select" className="field-label">
                  Status
                </label>
                <select
                  id="blog-status-select"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "draft" | "published" | "archived")
                  }
                  className="select-input"
                >
                  <option value="draft">Draft (Private preview)</option>
                  <option value="published">Published (Live on storefront)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="blog-author-input" className="field-label">
                  Author Name
                </label>
                <input
                  id="blog-author-input"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="field-group">
                <label htmlFor="blog-published-at-input" className="field-label">
                  Publish Date / Schedule
                </label>
                <input
                  id="blog-published-at-input"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="text-input"
                />
                <span className="field-hint">
                  Leave empty to set current time when published.
                </span>
              </div>
            </div>

            {/* Cover Image Card */}
            <div className="side-card" data-testid="blog-cover">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 className="side-card-title" style={{ margin: 0 }}>Cover Imagery</h2>
                <div style={{ display: "inline-flex", background: "#e8e2d4", borderRadius: 6, padding: 2, gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => setUploadMode("binary")}
                    style={{
                      border: "none",
                      background: uploadMode === "binary" ? "#ffffff" : "transparent",
                      color: uploadMode === "binary" ? "#1d2a24" : "#555850",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Binary File
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode("base64")}
                    style={{
                      border: "none",
                      background: uploadMode === "base64" ? "#ffffff" : "transparent",
                      color: uploadMode === "base64" ? "#1d2a24" : "#555850",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Base64
                  </button>
                </div>
              </div>

              {coverImageUrl ? (
                <div className="cover-preview-box">
                  <Image
                    src={coverImageUrl}
                    alt="Cover preview"
                    width={360}
                    height={180}
                    sizes="(max-width: 768px) 100vw, 360px"
                    unoptimized={Boolean(coverImageUrl && (coverImageUrl.startsWith("data:") || coverImageUrl.startsWith("blob:") || coverImageUrl.startsWith("/uploads/") || coverImageUrl.startsWith("http")))}
                    className="cover-img-preview"
                  />
                  {imageMetrics && (
                    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 11, background: imageMetrics.is16by9 ? "#eef5f0" : "#fdf6f0", color: imageMetrics.is16by9 ? "#2c4e38" : "#975429", fontWeight: 600 }}>
                      {imageMetrics.is16by9 ? "✓ " : "⚠ "}
                      {imageMetrics.width} × {imageMetrics.height} ({imageMetrics.ratio}) — {imageMetrics.is16by9 ? "16:9 Landscape (Optimal)" : "Recommended 1200×675 (16:9)"}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl("")}
                    className="remove-cover-btn"
                    style={{ marginTop: 8 }}
                  >
                    Remove Cover
                  </button>
                </div>
              ) : uploadMode === "binary" ? (
                <div className="cover-upload-dropzone">
                  <ImageIcon size={32} className="dropzone-icon" aria-hidden="true" />
                  <span>Upload Article Cover (Binary File: JPEG, PNG, WebP &lt; 5MB)</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <label htmlFor="cover-file-input" className="button button-outline upload-trigger-btn">
                      <Upload size={14} aria-hidden="true" />
                      <span>{uploading ? "Uploading..." : "Browse Photo"}</span>
                    </label>
                    <button
                      type="button"
                      data-testid="media-picker-btn"
                      onClick={() => setPickerOpen(true)}
                      className="button button-outline"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <ImageIcon size={14} aria-hidden="true" />
                      <span>Media Library</span>
                    </button>
                  </div>
                  <input
                    id="cover-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleFileUpload}
                    className="sr-only"
                    disabled={uploading}
                  />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "#faf8f4", border: "1px dashed #d9d4c8", borderRadius: 8 }}>
                  <label htmlFor="base64-paste-input" style={{ fontSize: 12, fontWeight: 600, color: "#1d2a24" }}>
                    Paste Base64 Image String or Data URI:
                  </label>
                  <textarea
                    id="base64-paste-input"
                    value={base64Input}
                    onChange={(e) => setBase64Input(e.target.value)}
                    placeholder="data:image/jpeg;base64,/9j/4AAQSkZJRg... or raw base64"
                    rows={4}
                    style={{ fontSize: 11, fontFamily: "monospace", padding: 8, border: "1px solid #d9d4c8", borderRadius: 4 }}
                  />
                  <button
                    type="button"
                    onClick={handleBase64Upload}
                    disabled={uploading || !base64Input.trim()}
                    className="button button-primary"
                    style={{ fontSize: 12, alignSelf: "flex-end", padding: "6px 12px" }}
                  >
                    {uploading ? "Saving Base64..." : "Upload Base64 Cover"}
                  </button>
                </div>
              )}

              {coverImageUrl && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    data-testid="media-picker-btn"
                    onClick={() => setPickerOpen(true)}
                    className="button button-outline"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px" }}
                  >
                    <ImageIcon size={14} aria-hidden="true" />
                    <span>Change from Media Library</span>
                  </button>
                </div>
              )}

              <MediaPicker
                isOpen={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={(asset) => {
                  if (asset?.url) {
                    setCoverImageUrl(asset.url);
                  }
                }}
              />

              {uploadError && (
                <div className="upload-error" role="alert" style={{ marginTop: 8 }}>
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="field-group" style={{ marginTop: 12 }}>
                <label htmlFor="cover-url-manual" className="field-label font-xs">
                  Or Direct Image URL:
                </label>
                <input
                  id="cover-url-manual"
                  type="text"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="/uploads/tea.webp or https://..."
                  className="text-input font-xs"
                />
              </div>
            </div>

            {/* Editorial Specs & Analytics Inspector Card */}
            <div className="side-card" style={{ background: "#fcfbf9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Sparkles size={16} color="#2c4e38" />
                <h2 className="side-card-title" style={{ margin: 0, fontSize: 14 }}>Editorial Specs &amp; Widgets</h2>
              </div>

              {(() => {
                const wordsCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
                const readingTime = Math.max(1, Math.ceil(wordsCount / 200));
                const chartsCount = (content.match(/```chart/g) || []).length;
                const radarsCount = (content.match(/```(tasting-radar|radar)/g) || []).length;
                const productsCount = (content.match(/```product/g) || []).length;
                const timersCount = (content.match(/```(steep-guide|steep-timer)/g) || []).length;
                const figuresCount = (content.match(/```figure/g) || []).length;
                const calloutsCount = (content.match(/```callout/g) || []).length;
                const totalWidgets = chartsCount + radarsCount + productsCount + timersCount + figuresCount + calloutsCount;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#52594e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee8dc" }}>
                      <span>Word Count:</span>
                      <strong style={{ color: "#18231c" }}>{wordsCount} words</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee8dc" }}>
                      <span>Est. Reading Time:</span>
                      <strong style={{ color: "#18231c" }}>~{readingTime} min</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee8dc" }}>
                      <span>Interactive Widgets:</span>
                      <strong style={{ color: totalWidgets > 0 ? "#2c4e38" : "#8a9184" }}>{totalWidgets} active</strong>
                    </div>

                    {totalWidgets > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {chartsCount > 0 && <span style={{ padding: "2px 6px", background: "#eef5f0", color: "#2c4e38", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{chartsCount} Chart</span>}
                        {radarsCount > 0 && <span style={{ padding: "2px 6px", background: "#eef5f0", color: "#2c4e38", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{radarsCount} Radar</span>}
                        {productsCount > 0 && <span style={{ padding: "2px 6px", background: "#eef5f0", color: "#2c4e38", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{productsCount} Product</span>}
                        {timersCount > 0 && <span style={{ padding: "2px 6px", background: "#eef5f0", color: "#2c4e38", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{timersCount} Timer</span>}
                        {figuresCount > 0 && <span style={{ padding: "2px 6px", background: "#eef5f0", color: "#2c4e38", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{figuresCount} Figure</span>}
                        {calloutsCount > 0 && <span style={{ padding: "2px 6px", background: "#eef5f0", color: "#2c4e38", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{calloutsCount} Callout</span>}
                      </div>
                    )}

                    <div style={{ marginTop: 8, padding: 8, background: "#f5f1e8", borderRadius: 6 }}>
                      <div style={{ fontWeight: 600, color: "#18231c", marginBottom: 4, fontSize: 11 }}>Editorial Publishing Standards:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
                        <span>{coverImageUrl ? "✓ Cover imagery set" : "○ Missing cover image"}</span>
                        <span>{wordsCount >= 300 ? "✓ In-depth content length" : "○ Under 300 words recommendation"}</span>
                        <span>{summary.length >= 80 ? "✓ Detailed article summary" : "○ Brief summary (add 80+ chars)"}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Save Actions Card */}
            <div className="side-card">
              <div className="save-actions-col">
                <button
                  type="submit"
                  disabled={saving}
                  className="button button-primary submit-btn"
                >
                  <Save size={16} aria-hidden="true" />
                  <span>{saving ? "Saving Article..." : isEditing ? "Save Changes" : "Create Article"}</span>
                </button>

                <Link href={isEditing && initialData ? `/admin/blogs/${initialData.id}` : "/admin/blogs"} className="button button-outline cancel-btn">
                  Cancel
                </Link>
              </div>

              {formSuccess && (
                <div className="form-feedback success" role="status">
                  <CheckCircle size={16} aria-hidden="true" />
                  <span>Article saved successfully! Redirecting...</span>
                </div>
              )}

              {formError && (
                <div className="form-feedback error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      <style jsx>{`
        .blog-form-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--pine, #23483a);
          margin-bottom: 8px;
          text-decoration: none;
        }

        .form-title {
          font-size: clamp(24px, 3.2vw, 32px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0 0 4px;
        }

        .form-subtitle {
          font-size: 14px;
          color: #555850;
          margin: 0;
        }

        .form-layout-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          align-items: start;
        }

        .main-form-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .side-form-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .side-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 20px;
        }

        .side-card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin: 0 0 16px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
        }

        .field-label.required::after {
          content: " *";
          color: #8f2f2a;
        }

        .label-flex {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .slug-regenerate-btn {
          background: transparent;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: var(--pine, #23483a);
          cursor: pointer;
        }

        .slug-input-wrap {
          display: flex;
          align-items: center;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
          overflow: hidden;
        }

        .slug-prefix {
          padding: 9px 12px;
          font-size: 13px;
          background: #ede9df;
          color: #6a6e64;
          border-right: 1px solid var(--admin-border, #d9d4c8);
        }

        .slug-input {
          border: none !important;
          flex: 1;
        }

        .text-input,
        .select-input {
          width: 100%;
          padding: 9px 12px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
          box-sizing: border-box;
          font-family: inherit;
        }

        .font-lg {
          font-size: 16px;
          font-weight: 600;
        }

        .font-xs {
          font-size: 11px;
        }

        .field-hint {
          font-size: 11px;
          color: #7b8075;
        }

        .cover-preview-box {
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--admin-border, #d9d4c8);
        }

        .cover-img-preview {
          width: 100%;
          height: 180px;
          object-fit: cover;
          display: block;
        }

        .remove-cover-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(23, 23, 19, 0.75);
          color: #ffffff;
          border: none;
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 4px;
          cursor: pointer;
        }

        .cover-upload-dropzone {
          border: 2px dashed var(--admin-border, #d9d4c8);
          border-radius: 6px;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
          background: #faf8f5;
          font-size: 12px;
          color: #6a6e64;
        }

        .dropzone-icon {
          color: #9ea399;
        }

        .upload-trigger-btn {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .upload-error {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #8f2f2a;
          margin-top: 8px;
        }

        .save-actions-col {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .submit-btn {
          width: 100%;
          justify-content: center;
        }

        .cancel-btn {
          width: 100%;
          justify-content: center;
        }

        .form-feedback {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 12px;
          margin-top: 12px;
        }

        .form-feedback.success {
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
        }

        .form-feedback.error {
          background: rgba(143, 47, 42, 0.12);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.3);
        }

        @media (max-width: 900px) {
          .form-layout-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
