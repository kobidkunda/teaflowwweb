"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { MediaAsset } from "@/lib/media";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface Props {
  initialAsset: MediaAsset;
}

export function MediaEditFormClient({ initialAsset }: Props) {
  const router = useRouter();

  const [altText, setAltText] = useState(initialAsset.alt_text || "");
  const [caption, setCaption] = useState(initialAsset.caption || "");
  const [sortOrder, setSortOrder] = useState<number>(initialAsset.sort_order || 0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/media/${initialAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          alt_text: altText,
          caption: caption,
          sort_order: Number(sortOrder),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update media asset metadata.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/admin/media/${initialAsset.id}`);
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Back button */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/admin/media/${initialAsset.id}`}
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
          <span>Back to Asset Dossier</span>
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
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0", color: "#1d2a24" }}>
          Edit Media Metadata
        </h1>
        <p style={{ margin: "0 0 24px 0", fontSize: 13, color: "#6a6e64" }}>
          Update accessible alternative text, editorial story captions, and catalog priority order for {initialAsset.filename}.
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
            <span>Metadata updated successfully! Redirecting…</span>
          </div>
        )}

        {/* Thumbnail Preview Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "#faf8f4",
            border: "1px solid #ede9df",
            borderRadius: 8,
            padding: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 72,
              height: 72,
              borderRadius: 6,
              overflow: "hidden",
              flexShrink: 0,
              background: "#ede9df",
            }}
          >
            <Image
              src={initialAsset.url}
              alt={initialAsset.alt_text || initialAsset.filename}
              fill
              sizes="72px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>{initialAsset.filename}</div>
            <div style={{ fontSize: 11, color: "#777c72", marginTop: 2 }}>
              {(initialAsset.file_size / 1024).toFixed(0)} KB • {initialAsset.mime_type}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 28 }}>
            <div>
              <label
                htmlFor="alt-text-field"
                style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d2a24", marginBottom: 6 }}
              >
                Accessible Alt Text (WCAG 2.2 AA)
              </label>
              <input
                id="alt-text-field"
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Descriptive text conveying meaning to screen reader users"
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
                htmlFor="caption-field"
                style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d2a24", marginBottom: 6 }}
              >
                Editorial Caption
              </label>
              <textarea
                id="caption-field"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Contextual harvest narrative or garden details..."
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

            <div style={{ maxWidth: 200 }}>
              <label
                htmlFor="sort-order-field"
                style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d2a24", marginBottom: 6 }}
              >
                Display Sort Order
              </label>
              <input
                id="sort-order-field"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Link
              href={`/admin/media/${initialAsset.id}`}
              className="button button-outline"
              style={{ fontSize: 13 }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="button button-primary"
              style={{
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
