"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
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
        <h2 style={{ color: "#C53030" }}><StorefrontText id="copy_ef83ea322e7b4a96" fallback="Quotation Error" /></h2>
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
        ><StorefrontText id="copy_3aca6ba9cffef28a" fallback="← Return to Private Label Studio" />
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
        ><StorefrontText id="copy_ac91d57ff79d1a6f" fallback="← Return to Studio" />
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
          ><StorefrontText id="copy_8b90d4debbf54d3f" fallback="🖨️ Print / Save as PDF" />
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
          ><StorefrontText id="copy_0f7e6ab3fc8d8628" fallback="QUOTATION EXPIRED — Rates are subject to market review. Contact info@teafloww.com for re-issuance." />
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
            ><StorefrontText id="copy_783fb833f84ab51c" fallback="TEAFLOWW" />
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#4A5568", lineHeight: 1.5 }}>
              <strong>{TEAFLOWW_BRAND_CONSTANTS.entityName}</strong><StorefrontText id="copy_1a14858fc24977a9" fallback="| GSTIN:" />{" "}
              <strong>{TEAFLOWW_BRAND_CONSTANTS.gstin}</strong>
              <br /><StorefrontText id="copy_3fd1f825eaedf6be" fallback="Works:" /> {TEAFLOWW_BRAND_CONSTANTS.worksAddress}
              <br /><StorefrontText id="copy_17507dcf845793fa" fallback="Email:" /> {TEAFLOWW_BRAND_CONSTANTS.email}<StorefrontText id="copy_041b6e1d040c66f7" fallback="| Phone:" /> {TEAFLOWW_BRAND_CONSTANTS.phone}
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
            ><StorefrontText id="copy_0881e54746deac0d" fallback="14-Day Price Lock Guarantee" />
            </span>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#4A5568", lineHeight: 1.5 }}><StorefrontText id="copy_823960a09c435a3a" fallback="Ref:" /> <strong>{quote.quote_number || quote.id}</strong><StorefrontText id="copy_6dd971f579515534" fallback="(Rev" /> {quote.revision || 1})
              <br /><StorefrontText id="copy_755c8b2a9fb11446" fallback="Status:" /> <strong>{quote.status.toUpperCase()}</strong> ({isFirm ? "Firm Price" : "Commercial Estimate"})
              <br /><StorefrontText id="copy_2b7dcdb1716bb130" fallback="Issued:" /> <strong>{issuedDate}</strong><StorefrontText id="copy_606fbfc984b8e691" fallback="| Valid Until:" /> <strong>{validUntilDate}</strong>
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
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "left" }}><StorefrontText id="copy_c21b51c8a225c7cc" fallback="Configuration / Specification" />
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", width: "90px" }}><StorefrontText id="copy_822bab8d41bca8d7" fallback="Quantity" />
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", width: "120px" }}><StorefrontText id="copy_14f6248d714ca9c7" fallback="Unit Price" />
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", width: "130px" }}><StorefrontText id="copy_30952dac50bb9b6e" fallback="Line Total" />
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
                    <strong><StorefrontText id="copy_4014ae9c8afea10d" fallback="Private Label Custom Tea Project" /></strong>
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
              <span><StorefrontText id="copy_45f1f2009cf6f984" fallback="Base Tea Leaf Blend Cost:" /></span>
              <span>{formatPaiseToInr(quote.tea_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Primary Packaging & Closures:</span>
              <span>{formatPaiseToInr(quote.packaging_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span><StorefrontText id="copy_993bf08f5e444174" fallback="Surface Printing Run:" /></span>
              <span>{formatPaiseToInr(quote.printing_subtotal_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span>Prepress Tooling & Cylinders:</span>
              <span>{formatPaiseToInr(quote.tooling_setup_paise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px" }}>
              <span><StorefrontText id="copy_6bfa838d720204da" fallback="Cleanroom Nitrogen Filling:" /></span>
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
              <span><StorefrontText id="copy_327a0b0ff05ca817" fallback="Grand Total (INR):" /></span>
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
          ><StorefrontText id="copy_5640d0474ce58085" fallback="Milestone Payment Terms (50 / 50 Schedule)" />
          </h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#4A5568", lineHeight: 1.6 }}>
            <li>
              <strong><StorefrontText id="copy_6c1a6d444a44cb29" fallback="50% Advance Deposit (" />{formatPaiseToInr(depositPaise)})</strong><StorefrontText id="copy_6d58af540ab8be9a" fallback=": Due upon digital artwork proof sign-off to allocate inventory and initiate printing." />
            </li>
            <li>
              <strong><StorefrontText id="copy_1c848ef4b814726d" fallback="50% Final Balance (" />{formatPaiseToInr(balancePaise)})</strong>: Due upon sensory cupping &
              seal integrity sign-off prior to dispatch from Siliguri.
            </li>
          </ul>
        </div>

        {/* Statutory & Legal Disclaimers */}
        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", fontSize: "11px", color: "#718096" }}>
          <p style={{ margin: "0 0 4px" }}><StorefrontText id="copy_aa7348faebfb44d1" fallback="• Natural agricultural commodity declaration: Variations in leaf appearance and seasonal cup characteristics may occur." />
          </p>
          <p style={{ margin: "0 0 4px" }}><StorefrontText id="copy_7828c6c5d79e822a" fallback="• 14-day price lock guarantee from date of issue. Commercial disputes subject to Siliguri / Jalpaiguri jurisdiction." />
          </p>
          <p style={{ margin: 0 }}><StorefrontText id="copy_b42e68e086c10b33" fallback="• FSSAI Central License compliant food-grade facility. Retained cleanroom batch samples stored for 24 months." />
          </p>
        </div>
      </div>
    </div>
  );
}
