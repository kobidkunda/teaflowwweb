"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  X,
  Check,
  Building,
} from "lucide-react";

interface AdminQuote {
  id: string;
  quote_number: string;
  project_id: string;
  project_title?: string;
  client_name?: string;
  company_name?: string;
  status: string;
  currency: string;
  tea_subtotal_paise: number;
  packaging_subtotal_paise: number;
  printing_subtotal_paise: number;
  tooling_setup_paise: number;
  labor_subtotal_paise: number;
  qc_subtotal_paise: number;
  freight_paise: number;
  margin_paise: number;
  tax_paise: number;
  grand_total_paise: number;
  issued_at: string | null;
  valid_until: string | null;
  revision: number;
  created_at: string;
}

export function PrivateLabelQuotesClient() {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Adjustment Modal State
  const [adjustingQuote, setAdjustingQuote] = useState<AdminQuote | null>(null);
  const [overrideTea, setOverrideTea] = useState<number>(0);
  const [overridePack, setOverridePack] = useState<number>(0);
  const [overrideFreight, setOverrideFreight] = useState<number>(0);
  const [overrideMargin, setOverrideMargin] = useState<number>(0);
  const [operatorNotes, setOperatorNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/private-label/quotes?status=${statusFilter}&search=${encodeURIComponent(search)}&limit=100`
      );
      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching quotes");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  const openAdjustmentModal = (q: AdminQuote) => {
    setAdjustingQuote(q);
    setOverrideTea(q.tea_subtotal_paise);
    setOverridePack(q.packaging_subtotal_paise);
    setOverrideFreight(q.freight_paise);
    setOverrideMargin(q.margin_paise);
    setOperatorNotes("");
  };

  const handleSaveOverrides = async (issueFirm = false) => {
    if (!adjustingQuote) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        expected_revision: adjustingQuote.revision,
        tea_subtotal_paise: overrideTea,
        packaging_subtotal_paise: overridePack,
        freight_paise: overrideFreight,
        margin_paise: overrideMargin,
        operator_notes: operatorNotes,
      };
      if (issueFirm) {
        payload.status = "firm_issued";
        payload.extend_validity_days = 14;
      }

      const res = await fetch(`/api/v1/admin/private-label/quotes/${adjustingQuote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update quote.");
      }

      setAdjustingQuote(null);
      void fetchQuotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6a6e64", fontWeight: 600 }}>
            Private Label Studio
          </span>
          <h1 style={{ margin: "4px 0", fontSize: 28, fontWeight: 700, color: "var(--forest, #1d2a24)", fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Quote Review Queue
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555850" }}>
            Review custom B2B quotation requests, apply manual price overrides, and issue firm binding quotes.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void fetchQuotes()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d9d4c8",
              background: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#888" }} />
          <input
            type="text"
            placeholder="Search by quote #, client, project title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d9d4c8",
              background: "#ffffff",
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            borderRadius: 6,
            border: "1px solid #d9d4c8",
            background: "#ffffff",
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pricing_pending">Pending Review (Urgent)</option>
          <option value="estimated">Estimated</option>
          <option value="firm_issued">Firm Issued</option>
          <option value="customer_accepted">Customer Accepted</option>
          <option value="converted">Converted to Order</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Quotes Table */}
      <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#ede9df", textAlign: "left" }}>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Quote # &amp; Date</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Client &amp; Project</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Tea Subtotal</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Packaging &amp; Print</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Grand Total (₹)</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Review Status</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Revision</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} style={{ borderBottom: "1px solid #f0ece1" }}>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600, fontFamily: "monospace", color: "#1d2a24" }}>{q.quote_number}</div>
                  <div style={{ fontSize: 11, color: "#6a6e64" }}>{new Date(q.created_at).toLocaleDateString()}</div>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600 }}>{q.project_title || "Custom Private Label"}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{q.company_name || q.client_name || "Direct Client"}</div>
                </td>
                <td style={{ padding: "10px 14px", color: "#444" }}>
                  ₹{(q.tea_subtotal_paise / 100).toFixed(2)}
                </td>
                <td style={{ padding: "10px 14px", color: "#444" }}>
                  ₹{((q.packaging_subtotal_paise + q.printing_subtotal_paise) / 100).toFixed(2)}
                </td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1d2a24" }}>
                  ₹{(q.grand_total_paise / 100).toFixed(2)}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "capitalize",
                      background:
                        q.status === "pricing_pending"
                          ? "#fff8e1"
                          : q.status === "firm_issued"
                          ? "#e8f5e9"
                          : q.status === "customer_accepted"
                          ? "#e0f2fe"
                          : "#f1f5f9",
                      color:
                        q.status === "pricing_pending"
                          ? "#8d6000"
                          : q.status === "firm_issued"
                          ? "#1b5e20"
                          : q.status === "customer_accepted"
                          ? "#0369a1"
                          : "#334155",
                    }}
                  >
                    {q.status.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
                  v{q.revision}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <button
                    type="button"
                    onClick={() => openAdjustmentModal(q)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #d9d4c8",
                      background: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <Edit size={12} />
                    <span>Review &amp; Adjust</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
            No quotation requests found matching filters.
          </div>
        )}
      </div>

      {/* Quote Adjustment Modal */}
      {adjustingQuote && (
        <dialog
          open
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            maxWidth: 640,
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 1000,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
              Review Quote: {adjustingQuote.quote_number} (v{adjustingQuote.revision})
            </h3>
            <button
              type="button"
              onClick={() => setAdjustingQuote(null)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                Tea Subtotal (paise):
              </label>
              <input
                type="number"
                value={overrideTea}
                onChange={(e) => setOverrideTea(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #d9d4c8" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                Packaging Subtotal (paise):
              </label>
              <input
                type="number"
                value={overridePack}
                onChange={(e) => setOverridePack(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #d9d4c8" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                Freight &amp; Transport (paise):
              </label>
              <input
                type="number"
                value={overrideFreight}
                onChange={(e) => setOverrideFreight(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #d9d4c8" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                Commercial Margin (paise):
              </label>
              <input
                type="number"
                value={overrideMargin}
                onChange={(e) => setOverrideMargin(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #d9d4c8" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
              Internal Operator Notes:
            </label>
            <textarea
              rows={3}
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="Private audit justification for cost overrides..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={() => void handleSaveOverrides(false)}
              disabled={submitting}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #d9d4c8",
                background: "#ffffff",
                fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Save Draft Override
            </button>
            <button
              type="button"
              onClick={() => void handleSaveOverrides(true)}
              disabled={submitting}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "#23483a",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Issue Firm Quote (14 Days)
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
