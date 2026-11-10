"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { TEAFLOWW_BRAND_CONSTANTS, formatPaiseToInr } from "@/lib/private-label/pdf";
import type { PublicQuoteWithItemsDto } from "@/lib/private-label/types";

export default function PrintableQuotePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const quoteId = params?.id as string;
  const autoPrint = searchParams.get("autoprint") === "1";

  const [quote, setQuote] = useState<PublicQuoteWithItemsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId) return;
    let isMounted = true;

    async function loadQuote() {
      try {
        const res = await fetch(`/api/v1/private-label/quotes/${quoteId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Quote not found or you do not have permission to view this quotation.");
          }
          throw new Error(`Failed to load quotation (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          setQuote(data.quote || data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error loading quotation");
          setLoading(false);
        }
      }
    }

    loadQuote();

    return () => {
      isMounted = false;
    };
  }, [quoteId]);

  useEffect(() => {
    if (quote && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [quote, autoPrint]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Loading Commercial Specification & Quotation...</h2>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ padding: "40px", maxWidth: "600px", margin: "auto", fontFamily: "sans-serif" }}>
        <h2 style={{ color: "#C53030" }}>Quotation Error</h2>
        <p>{error || "Unable to retrieve quotation details."}</p>
        <Link
          href="/private-label/studio"
          style={{
            display: "inline-block",
            marginTop: "16px",
            color: "#143C31",
            textDecoration: "underline",
            fontWeight: "bold",
          }}
        >
          ← Return to Private Label Studio
        </Link>
      </div>
    );
  }

  const isFirm = quote.status === "firm_issued" || quote.status === "customer_accepted";
  const isExpired = quote.valid_until ? new Date(quote.valid_until) < new Date() : false;
  const issuedDate = quote.issued_at ? new Date(quote.issued_at).toLocaleDateString("en-IN") : "Today";
  const validUntilDate = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-IN")
    : "14 Days from Issue";

  const depositPaise = Math.round(quote.grand_total_paise * 0.5);
  const balancePaise = quote.grand_total_paise - depositPaise;

  return (
    <div style={{ backgroundColor: "#F7FAFC", minHeight: "100vh", padding: "24px 16px" }}>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .print-card {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Floating Toolbar (hidden in print) */}
      <div
        className="no-print"
        style={{
          maxWidth: "850px",
          margin: "0 auto 20px auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#FFFFFF",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <Link
          href="/private-label/studio"
          style={{
            color: "#143C31",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ← Return to Studio
        </Link>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: isExpired ? "#FFF5F5" : "#E8F5E9",
              color: isExpired ? "#C53030" : "#143C31",
              fontWeight: "600",
            }}
          >
            {isExpired ? "Quotation Expired" : "14-Day Price Lock Guarantee"}
          </span>
          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: "#143C31",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        className="print-card"
        style={{
          maxWidth: "850px",
          margin: "0 auto",
          backgroundColor: "#FFFFFF",
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: "#1A202C",
        }}
      >
        {isExpired && (
          <div
            style={{
              backgroundColor: "#FFF5F5",
              color: "#C53030",
              border: "1px solid #FEB2B2",
              padding: "10px 16px",
              borderRadius: "6px",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            QUOTATION EXPIRED — Rates are subject to market review. Contact info@teafloww.com for re-issuance.
          </div>
        )}

        {/* Corporate Letterhead */}
        <div
          style={{
            borderBottom: "3px solid #143C31",
            paddingBottom: "16px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "26px",
                color: "#143C31",
                letterSpacing: "-0.5px",
                fontWeight: "800",
              }}
            >
              TEAFLOWW
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#4A5568", lineHeight: 1.5 }}>
              <strong>{TEAFLOWW_BRAND_CONSTANTS.entityName}</strong> | GSTIN:{" "}
              <strong>{TEAFLOWW_BRAND_CONSTANTS.gstin}</strong>
              <br />
              Works: {TEAFLOWW_BRAND_CONSTANTS.worksAddress}
              <br />
              Email: {TEAFLOWW_BRAND_CONSTANTS.email} | Phone: {TEAFLOWW_BRAND_CONSTANTS.phone}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <span
              style={{
                display: "inline-block",
                backgroundColor: "#E8F5E9",
                color: "#143C31",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              14-Day Price Lock Guarantee
            </span>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#4A5568", lineHeight: 1.5 }}>
              Ref: <strong>{quote.quote_number || quote.id}</strong> (Rev {quote.revision || 1})
              <br />
              Status: <strong>{quote.status.toUpperCase()}</strong> ({isFirm ? "Firm Price" : "Commercial Estimate"})
              <br />
              Issued: <strong>{issuedDate}</strong> | Valid Until: <strong>{validUntilDate}</strong>
            </div>
          </div>
        </div>

        {/* Commercial Specifications */}
        <div style={{ marginBottom: "24px" }}>
          <h2
            style={{
              fontSize: "15px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#143C31",
              borderBottom: "1px solid #E2E8F0",
              paddingBottom: "6px",
              margin: "0 0 16px 0",
            }}
          >
            Commercial Quotation & Specification Summary
          </h2>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#F7FAFC", borderBottom: "2px solid #CBD5E0" }}>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "left", width: "40px" }}>
                  #
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "left" }}>
                  Configuration / Specification
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", width: "90px" }}>
                  Quantity
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", width: "120px" }}>
                  Unit Price
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", width: "130px" }}>
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.items && quote.items.length > 0 ? (
                quote.items.map((it, idx) => (
                  <tr key={it.id || idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "10px 12px", fontSize: "13px" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontSize: "13px" }}>
                      <strong>{it.description}</strong>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>
                      {it.quantity.toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>
                      {formatPaiseToInr(it.unit_price_paise)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: "13px",
                        textAlign: "right",
                        fontWeight: "600",
                      }}
                    >
                      {formatPaiseToInr(it.line_total_paise)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "10px 12px", fontSize: "13px" }}>1</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px" }}>
                    <strong>Private Label Custom Tea Project</strong>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>1</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>
                    {formatPaiseToInr(quote.grand_total_paise)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", fontWeight: "600" }}>
                    {formatPaiseToInr(quote.grand_total_paise)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 12-Component Itemized Summary Table */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
          <div style={{ width: "360px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Base Tea Leaf Blend Cost:</span>
              <span>{formatPaiseToInr(quote.tea_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Primary Packaging & Closures:</span>
              <span>{formatPaiseToInr(quote.packaging_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Surface Printing Run:</span>
              <span>{formatPaiseToInr(quote.printing_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Prepress Tooling & Cylinders:</span>
              <span>{formatPaiseToInr(quote.tooling_setup_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Cleanroom Nitrogen Filling:</span>
              <span>{formatPaiseToInr(quote.labor_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Quality Assurance Cupping & Lab:</span>
              <span>{formatPaiseToInr(quote.qc_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Corrugated Cartons & Freight:</span>
              <span>{formatPaiseToInr(quote.freight_paise)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontSize: "13px",
                borderTop: "1px solid #CBD5E0",
              }}
            >
              <span>Dual-Rate Indian GST (5% & 18%):</span>
              <span>{formatPaiseToInr(quote.tax_paise)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                fontSize: "16px",
                fontWeight: "bold",
                borderTop: "2px solid #143C31",
                color: "#143C31",
              }}
            >
              <span>Grand Total (INR):</span>
              <span>{formatPaiseToInr(quote.grand_total_paise)}</span>
            </div>
          </div>
        </div>

        {/* Milestone Payment Terms (50/50 Schedule) */}
        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "16px", marginBottom: "20px" }}>
          <h3
            style={{
              fontSize: "13px",
              textTransform: "uppercase",
              margin: "0 0 8px",
              color: "#143C31",
              fontWeight: "700",
            }}
          >
            Milestone Payment Terms (50 / 50 Schedule)
          </h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#4A5568", lineHeight: 1.6 }}>
            <li>
              <strong>50% Advance Deposit ({formatPaiseToInr(depositPaise)})</strong>: Due upon digital artwork
              proof sign-off to allocate inventory and initiate printing.
            </li>
            <li>
              <strong>50% Final Balance ({formatPaiseToInr(balancePaise)})</strong>: Due upon sensory cupping &
              seal integrity sign-off prior to dispatch from Siliguri.
            </li>
          </ul>
        </div>

        {/* Statutory & Legal Disclaimers */}
        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", fontSize: "11px", color: "#718096" }}>
          <p style={{ margin: "0 0 4px" }}>
            • Natural agricultural commodity declaration: Variations in leaf appearance and seasonal cup characteristics
            may occur.
          </p>
          <p style={{ margin: "0 0 4px" }}>
            • 14-day price lock guarantee from date of issue. Commercial disputes subject to Siliguri / Jalpaiguri
            jurisdiction.
          </p>
          <p style={{ margin: 0 }}>
            • FSSAI Central License compliant food-grade facility. Retained cleanroom batch samples stored for 24
            months.
          </p>
        </div>
      </div>
    </div>
  );
}
