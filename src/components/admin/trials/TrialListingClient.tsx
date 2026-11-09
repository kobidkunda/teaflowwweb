"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Boxes,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Archive,
  Layers,
  AlertTriangle,
} from "lucide-react";
import type { Trial, TrialStatus } from "@/lib/trials/types";

export interface TrialListingClientProps {
  initialTrials?: Trial[];
}

export function filterTrialsList(
  trials: Trial[],
  searchQuery: string,
  statusFilter: string
): Trial[] {
  const query = searchQuery.trim().toLowerCase();
  return trials.filter((t) => {
    const matchesStatus =
      statusFilter === "all" || !statusFilter ? true : t.status === statusFilter;
    if (!matchesStatus) return false;
    if (!query) return true;
    return (
      t.title.toLowerCase().includes(query) ||
      t.slug.toLowerCase().includes(query) ||
      t.sku.toLowerCase().includes(query)
    );
  });
}

export function formatPaise(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TrialListingClient({ initialTrials }: TrialListingClientProps) {
  const [trials, setTrials] = useState<Trial[]>(initialTrials || []);
  const [loading, setLoading] = useState(!initialTrials);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTrials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/trials?limit=100", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to load trials");
      }
      const data = await res.json();
      setTrials(data.trials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching trials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialTrials) {
      void fetchTrials();
    }
  }, [initialTrials, fetchTrials]);

  const filteredTrials = useMemo(
    () => filterTrialsList(trials, search, statusFilter),
    [trials, search, statusFilter]
  );

  const metrics = useMemo(() => {
    const total = trials.length;
    const published = trials.filter((t) => t.status === "published").length;
    const reviewOrDraft = trials.filter(
      (t) => t.status === "draft" || t.status === "in_review"
    ).length;
    const inStock = trials.reduce((acc, t) => acc + (t.inventory_quantity || 0), 0);
    return { total, published, reviewOrDraft, inStock };
  }, [trials]);

  async function handleDeleteDraft(id: string, title: string) {
    if (!window.confirm(`Are you sure you want to delete draft "${title}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/admin/trials/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to delete trial");
      }
      setTrials((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeletingId(null);
    }
  }

  const getStatusBadge = (status: TrialStatus) => {
    switch (status) {
      case "published":
        return (
          <span
            className="status-badge badge-published"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: "#e8f5e9",
              color: "#1b5e20",
              border: "1px solid #a5d6a7",
            }}
          >
            <CheckCircle size={12} />
            Published
          </span>
        );
      case "in_review":
        return (
          <span
            className="status-badge badge-in-review"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: "#fff8e1",
              color: "#b78103",
              border: "1px solid #ffe082",
            }}
          >
            <Clock size={12} />
            In Review
          </span>
        );
      case "archived":
        return (
          <span
            className="status-badge badge-archived"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: "#eceff1",
              color: "#455a64",
              border: "1px solid #b0bec5",
            }}
          >
            <Archive size={12} />
            Archived
          </span>
        );
      case "draft":
      default:
        return (
          <span
            className="status-badge badge-draft"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: "#f5f5f5",
              color: "#616161",
              border: "1px solid #e0e0e0",
            }}
          >
            <Layers size={12} />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="admin-trials-listing-root" style={{ padding: "24px 32px" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6a6e64",
              fontWeight: 600,
            }}
          >
            Storefront &amp; Catalog
          </span>
          <h1
            style={{
              margin: "4px 0",
              fontSize: 28,
              fontWeight: 700,
              color: "#1d2a24",
              fontFamily: "var(--font-serif, Georgia, serif)",
            }}
          >
            Trials Management
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555850" }}>
            Curate 4x50g tea discovery assortments, manage optical proofs, and configure bulk ladders.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void fetchTrials()}
            disabled={loading}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
            }}
            title="Refresh trial kits list"
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/trials/new"
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: "#23483a",
              color: "#ffffff",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            <Plus size={16} />
            <span>New Trial Kit</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 600 }}>Total Trials</span>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
            {metrics.total}
          </div>
        </div>
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <span style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>Published Active</span>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#2e7d32", marginTop: 4 }}>
            {metrics.published}
          </div>
        </div>
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <span style={{ fontSize: 12, color: "#b78103", fontWeight: 600 }}>Drafts &amp; In Review</span>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#b78103", marginTop: 4 }}>
            {metrics.reviewOrDraft}
          </div>
        </div>
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 600 }}>In-Stock Units</span>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
            {metrics.inStock}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "12px 16px",
          background: "#fbf8f1",
          borderRadius: 8,
          border: "1px solid #e0dbce",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative", minWidth: 280, flex: 1 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#7e786b",
            }}
          />
          <input
            type="search"
            data-testid="trial-search-input"
            name="search"
            placeholder="Search by title, slug, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #c9c2b6",
              background: "#ffffff",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Status filter tabs */}
        <div
          role="tablist"
          aria-label="Filter trials by status"
          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          {[
            { id: "all", label: "All" },
            { id: "draft", label: "Draft" },
            { id: "in_review", label: "In Review" },
            { id: "published", label: "Published" },
            { id: "archived", label: "Archived" },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  borderRadius: 6,
                  border: active ? "1px solid #23483a" : "1px solid #d9d4c8",
                  background: active ? "#23483a" : "#ffffff",
                  color: active ? "#ffffff" : "#444840",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            background: "#fdf2f2",
            border: "1px solid #f8b4b4",
            borderRadius: 6,
            color: "#9b1c1c",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          overflowX: "auto",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ width: 64, textAlign: "center" }}>Cover</th>
              <th style={{ textAlign: "left" }}>Title &amp; Slug</th>
              <th style={{ width: 120, textAlign: "center" }}>Status</th>
              <th style={{ width: 140, textAlign: "center" }}>Pack Format</th>
              <th style={{ width: 120, textAlign: "right" }}>Price (₹)</th>
              <th style={{ width: 90, textAlign: "center" }}>Revision</th>
              <th style={{ width: 100, textAlign: "center" }}>Stock</th>
              <th style={{ width: 160, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && trials.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px 16px", color: "#6a6e64" }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: "0 auto 8px" }} />
                  <div>Loading trials catalogue…</div>
                </td>
              </tr>
            ) : filteredTrials.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 16px" }}>
                  <div data-testid="empty-trials" style={{ color: "#6a6e64" }}>
                    <Boxes size={36} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "#1d2a24" }}>
                      No trials match your filter
                    </p>
                    <small>Create a new trial or adjust your search filter keyword.</small>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTrials.map((trial) => {
                const isDeleting = deletingId === trial.id;
                return (
                  <tr key={trial.id} style={{ opacity: isDeleting ? 0.5 : 1 }}>
                    {/* Cover thumbnail */}
                    <td style={{ textAlign: "center", verticalAlign: "middle", padding: "8px" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 6,
                          background: "#ede9df",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          border: "1px solid #d9d4c8",
                        }}
                      >
                        <Boxes size={22} color="#23483a" />
                      </div>
                    </td>

                    {/* Title & Slug */}
                    <td style={{ verticalAlign: "middle" }}>
                      <Link
                        href={`/admin/trials/${trial.id}`}
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#1d2a24",
                          textDecoration: "none",
                        }}
                      >
                        {trial.title}
                      </Link>
                      <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
                        <code>/{trial.slug}</code> · <span style={{ fontFamily: "monospace" }}>{trial.sku}</span>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      {getStatusBadge(trial.status)}
                    </td>

                    {/* Pack Format */}
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: "#f0f4f1",
                          color: "#23483a",
                          border: "1px solid #c8d8ce",
                        }}
                      >
                        4x50g (200g)
                      </span>
                    </td>

                    {/* Price */}
                    <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: 600 }}>
                      ₹{formatPaise(trial.price_paise)}
                    </td>

                    {/* Revision */}
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <span
                        className="revision-badge"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#f3ede2",
                          color: "#8a5828",
                          border: "1px solid #e3d2be",
                        }}
                      >
                        Rev #{trial.revision}
                      </span>
                    </td>

                    {/* Stock */}
                    <td style={{ textAlign: "center", verticalAlign: "middle", fontSize: 13 }}>
                      {trial.inventory_quantity}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Link
                          href={`/admin/trials/${trial.id}`}
                          className="button button-outline"
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            textDecoration: "none",
                          }}
                          title="Open 5-tab studio"
                        >
                          <Edit size={12} />
                          <span>Edit</span>
                        </Link>

                        <a
                          href={`/trials/${trial.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="button button-cream"
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            textDecoration: "none",
                          }}
                          title="Preview storefront PDP"
                        >
                          <ExternalLink size={12} />
                          <span>Preview</span>
                        </a>

                        {trial.status !== "published" && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteDraft(trial.id, trial.title)}
                            disabled={isDeleting}
                            style={{
                              padding: "4px 6px",
                              background: "transparent",
                              border: "none",
                              color: "#8f2f2a",
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                            title="Delete draft"
                            aria-label={`Delete ${trial.title}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
