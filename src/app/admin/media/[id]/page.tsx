import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getMediaById, checkMediaReferences } from "@/lib/media";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MediaDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    notFound();
  }

  const asset = getMediaById(numId);
  if (!asset) {
    notFound();
  }

  const refCheck = checkMediaReferences(numId, asset.url);

  return (
    <div className="media-dossier admin-media-detail" style={{ maxWidth: 1040, margin: "0 auto" }}>
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

      {/* Header with Title and Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0", color: "#1d2a24" }}>
            {asset.filename}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6a6e64" }}>
            Asset Dossier • Upload ID #{asset.id} • Registered {new Date(asset.created_at).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/admin/media/${asset.id}/edit`}
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <Edit2 size={14} />
            <span>Edit Metadata</span>
          </Link>
          <Link
            href={`/admin/media/${asset.id}/delete`}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#8f2f2a",
              borderColor: "#e8c9c7",
            }}
          >
            <Trash2 size={14} />
            <span>Delete Asset</span>
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        {/* Left Column: Visual Preview */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 10,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4/3",
              background: "#ede9df",
              borderRadius: 8,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <Image
              src={asset.url}
              alt={asset.alt_text || asset.filename}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>

          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "#23483a",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 600,
            }}
          >
            <span>View Full Resolution Asset</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Right Column: Technical & Narrative Dossier */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Metadata Card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #d9d4c8",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1d2a24" }}>
              Technical Properties
            </h2>

            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "130px 1fr", gap: "10px 16px", fontSize: 13 }}>
              <dt style={{ color: "#777c72", fontWeight: 600 }}>File Path / URL:</dt>
              <dd style={{ margin: 0, wordBreak: "break-all", fontFamily: "monospace", fontSize: 12 }}>
                {asset.url}
              </dd>

              <dt style={{ color: "#777c72", fontWeight: 600 }}>File Size:</dt>
              <dd style={{ margin: 0 }}>
                {(asset.file_size / 1024).toFixed(1)} KB ({asset.file_size.toLocaleString()} bytes)
              </dd>

              <dt style={{ color: "#777c72", fontWeight: 600 }}>MIME Type:</dt>
              <dd style={{ margin: 0, textTransform: "uppercase", fontWeight: 600 }}>
                {asset.mime_type}
              </dd>

              <dt style={{ color: "#777c72", fontWeight: 600 }}>Dimensions:</dt>
              <dd style={{ margin: 0 }}>
                {asset.width && asset.height ? `${asset.width} × ${asset.height} px` : "Recorded upon inspection"}
              </dd>

              <dt style={{ color: "#777c72", fontWeight: 600 }}>Uploaded:</dt>
              <dd style={{ margin: 0 }}>{new Date(asset.created_at).toLocaleString()}</dd>

              <dt style={{ color: "#777c72", fontWeight: 600 }}>Last Updated:</dt>
              <dd style={{ margin: 0 }}>
                {asset.updated_at ? new Date(asset.updated_at).toLocaleString() : "Never modified"}
              </dd>
            </dl>
          </div>

          {/* Narrative & Accessibility */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #d9d4c8",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1d2a24" }}>
              Accessibility & Provenance
            </h2>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#777c72", marginBottom: 4 }}>
                Accessible Alt Text (WCAG 2.2 AA):
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  background: "#faf8f4",
                  borderRadius: 6,
                  border: "1px solid #e8e4da",
                  fontSize: 13,
                  color: asset.alt_text ? "#1d2a24" : "#999e94",
                  fontStyle: asset.alt_text ? "normal" : "italic",
                }}
              >
                {asset.alt_text || "No alternative text specified."}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#777c72", marginBottom: 4 }}>
                Editorial Story Caption:
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  background: "#faf8f4",
                  borderRadius: 6,
                  border: "1px solid #e8e4da",
                  fontSize: 13,
                  color: asset.caption ? "#1d2a24" : "#999e94",
                  fontStyle: asset.caption ? "normal" : "italic",
                }}
              >
                {asset.caption || "No editorial caption provided."}
              </div>
            </div>
          </div>

          {/* Reference Integrity Card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #d9d4c8",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1d2a24" }}>
                Reference Guardian Status
              </h2>
              {refCheck.inUse ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#9e6428",
                    background: "#fbf3ea",
                    padding: "3px 8px",
                    borderRadius: 12,
                    border: "1px solid #f2dfcc",
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>In Use ({refCheck.totalReferences} ref)</span>
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#23483a",
                    background: "#edf4f0",
                    padding: "3px 8px",
                    borderRadius: 12,
                    border: "1px solid #c9e0d3",
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Unreferenced (Safe to Delete)</span>
                </span>
              )}
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <li style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4f0e6", paddingBottom: 6 }}>
                <span>Product Image Galleries:</span>
                <strong>{refCheck.breakdown.productImages}</strong>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4f0e6", paddingBottom: 6 }}>
                <span>Category Covers:</span>
                <strong>{refCheck.breakdown.categories}</strong>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4f0e6", paddingBottom: 6 }}>
                <span>Hero Sliders:</span>
                <strong>{refCheck.breakdown.sliders}</strong>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4f0e6", paddingBottom: 6 }}>
                <span>Journal & Blog Articles:</span>
                <strong>{refCheck.breakdown.blogPosts}</strong>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Storefront Site Placements:</span>
                <strong>{refCheck.breakdown.sitePlacements}</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
