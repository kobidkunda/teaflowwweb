"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { MediaAsset, MediaReferenceCheckResult } from "@/lib/media";
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface Props {
  asset: MediaAsset;
  refCheck: MediaReferenceCheckResult;
}

export function MediaDeleteConfirmationClient({ asset, refCheck }: Props) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (refCheck.inUse) {
      setError("Cannot delete media asset: It is currently referenced by other records.");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/media/${asset.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete media asset.");
      }

      router.push("/admin/media");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="delete-confirmation" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Back button */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/admin/media/${asset.id}`}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: refCheck.inUse ? "#fbf3ea" : "#fdf2f2",
              color: refCheck.inUse ? "#9e6428" : "#8f2f2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {refCheck.inUse ? <ShieldAlert size={22} /> : <Trash2 size={22} />}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1d2a24" }}>
              {refCheck.inUse ? "Deletion Blocked by Guardian" : "Confirm Permanent Deletion"}
            </h1>
            <span style={{ fontSize: 13, color: "#777c72" }}>Asset: {asset.filename}</span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "12px 16px",
              background: "#fdf3f2",
              border: "1px solid #f2bcba",
              borderRadius: 6,
              color: "#8f2f2a",
              margin: "16px 0",
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

        {/* Thumbnail banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "#faf8f4",
            border: "1px solid #ede9df",
            borderRadius: 8,
            padding: 12,
            margin: "20px 0",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 64,
              height: 64,
              borderRadius: 6,
              overflow: "hidden",
              flexShrink: 0,
              background: "#ede9df",
            }}
          >
            <Image
              src={asset.url}
              alt={asset.alt_text || asset.filename}
              fill
              sizes="64px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>{asset.filename}</div>
            <div style={{ fontSize: 11, color: "#777c72", marginTop: 2 }}>
              {(asset.file_size / 1024).toFixed(0)} KB • {asset.mime_type} • ID #{asset.id}
            </div>
          </div>
        </div>

        {/* In-Use Warning & References List */}
        {refCheck.inUse ? (
          <div
            style={{
              background: "#fbf6ed",
              border: "1px solid #eeddc5",
              borderRadius: 8,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9e6428", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              <AlertTriangle size={18} />
              <span>Asset cannot be deleted while referenced</span>
            </div>
            <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#544633", lineHeight: 1.5 }}>
              This image is currently attached to <strong>{refCheck.totalReferences} active entity record(s)</strong>.
              To maintain catalog and storefront integrity, delete operations are rejected with HTTP 409 Conflict until all references are unlinked.
            </p>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#544633", marginBottom: 6 }}>
              Active Referencing Entities:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#544633", display: "flex", flexDirection: "column", gap: 4 }}>
              {refCheck.breakdown.productImages > 0 && (
                <li><strong>{refCheck.breakdown.productImages}</strong> Product image gallery assignment(s)</li>
              )}
              {refCheck.breakdown.categories > 0 && (
                <li><strong>{refCheck.breakdown.categories}</strong> Category cover photography assignment(s)</li>
              )}
              {refCheck.breakdown.sliders > 0 && (
                <li><strong>{refCheck.breakdown.sliders}</strong> Homepage hero slider background(s)</li>
              )}
              {refCheck.breakdown.blogPosts > 0 && (
                <li><strong>{refCheck.breakdown.blogPosts}</strong> Journal article cover photography assignment(s)</li>
              )}
              {refCheck.breakdown.sitePlacements > 0 && (
                <li><strong>{refCheck.breakdown.sitePlacements}</strong> Storefront site placement section(s)</li>
              )}
            </ul>
          </div>
        ) : (
          <div
            style={{
              background: "#fdf8f8",
              border: "1px solid #f6dede",
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              color: "#8f2f2a",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>Warning:</strong> Deleting this asset will immediately remove its record from the database and permanently unlink the file from disk (<code>public/uploads/{asset.filename}</code>). This operation cannot be undone.
          </div>
        )}

        <form onSubmit={handleDelete}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Link
              href={`/admin/media/${asset.id}`}
              className="button button-outline"
              style={{ fontSize: 13 }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={refCheck.inUse || deleting}
              title={refCheck.inUse ? "Disabled: Asset is referenced by active records" : "Permanently delete asset"}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 18px",
                borderRadius: 6,
                border: "none",
                background: refCheck.inUse ? "#d9d4c8" : "#8f2f2a",
                color: refCheck.inUse ? "#888c83" : "#ffffff",
                cursor: refCheck.inUse || deleting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {deleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Deleting…</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>{refCheck.inUse ? "Deletion Disabled (In Use)" : "Confirm & Delete Asset"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
