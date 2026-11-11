"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import type { QuoteEstimateResult } from "./hooks/useQuoteEstimate";

export interface QuoteSummaryPanelProps {
  estimate: QuoteEstimateResult;
  quantityUnits: number;
  onAdjustQuantity?: (units: number) => void;
  onSaveDraft?: () => void;
  onGenerateQuote?: () => void;
  onDownloadPdf?: () => void;
  isSavingDraft?: boolean;
  isGeneratingQuote?: boolean;
  quoteId?: string | null;
  className?: string;
  actionError?: string | null;
  needsLogin?: boolean;
  onOpenAuthModal?: () => void;
}

export function QuoteSummaryPanel({
  estimate,
  quantityUnits,
  onAdjustQuantity,
  onSaveDraft,
  onGenerateQuote,
  onDownloadPdf,
  isSavingDraft = false,
  isGeneratingQuote = false,
  quoteId,
  className = "",
  actionError,
  needsLogin,
  onOpenAuthModal,
}: QuoteSummaryPanelProps) {
  const [showItemizedDetails, setShowItemizedDetails] = useState<boolean>(true);

  const {
    moq,
    breakdown,
    isEligible,
    formattedUnitPrice,
    formattedGrandTotal,
  } = estimate;

  const formatPaise = (paise?: number): string => {
    if (typeof paise !== "number") return "—";
    return `₹${(paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div
      className={`quote-summary-panel ${className}`}
      style={{
        background: "#FFFFFF",
        borderRadius: "12px",
        border: "1px solid #DDE4DC",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #ECEEEA",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: "#143C31",
            }}
          ><StorefrontText id="copy_01aa561679452cf4" fallback="Live Quotation Estimate" />
          </h3>
          <span style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_155c87fef40f3aae" fallback="Server-calculated estimate · Subject to review" />
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#143C31" }}>
            {formattedUnitPrice}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#8E9E96" }}><StorefrontText id="copy_21bdf68ff5bc65dd" fallback="per pack" /></div>
        </div>
      </div>

      {estimate.isLoadingServerQuote && <p role="status"><StorefrontText id="copy_f445cdf5f3dacce2" fallback="Updating estimate…" /></p>}
      {estimate.serverQuoteError && <p role="alert">{estimate.serverQuoteError}</p>}
      {/* Grand Total Highlight */}
      <div
        style={{
          background: "#F4F6F4",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "0.75rem", color: "#65746D", fontWeight: 600 }}><StorefrontText id="copy_e5ea4408f403c576" fallback="ESTIMATED BATCH TOTAL (" />{quantityUnits.toLocaleString("en-IN")} <StorefrontText id="copy_cb20a4486a64f501" fallback="units)" />
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#8E9E96" }}>
            Inclusive of 5% Tea + 18% GST &bull; Ex-works Siliguri
          </div>
        </div>
        <div
          style={{
            fontSize: "1.375rem",
            fontWeight: "bold",
            color: "#143C31",
          }}
        >
          {formattedGrandTotal}
        </div>
      </div>

      {/* MOQ Evaluation Status Card */}
      {moq && (
        <div
          style={{
            borderRadius: "8px",
            border: `1px solid ${isEligible ? "#C8DFD2" : "#FFCDD2"}`,
            background: isEligible ? "#F2F8F4" : "#FFEBEE",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: moq.eligible ? "#143C31" : "#C62828",
            }}
          >
            <span aria-hidden="true">{moq.eligible ? "✓" : "⚠"}</span>
            <span>{moq.eligible ? "Minimum quantity met · Production subject to review" : "MOQ Requirements Not Met"}</span>
          </div>

          {!isEligible && moq.reasons.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <ul
                style={{
                  margin: "0 0 10px 0",
                  paddingLeft: "18px",
                  fontSize: "0.8125rem",
                  color: "#B71C1C",
                  lineHeight: "1.4",
                }}
              >
                {moq.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              {onAdjustQuantity && moq.nextValidUnits > quantityUnits && (
                <button
                  type="button"
                  onClick={() => onAdjustQuantity(moq.nextValidUnits)}
                  style={{
                    minHeight: "36px",
                    padding: "6px 12px",
                    background: "#143C31",
                    color: "#FFFCF7",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                ><StorefrontText id="copy_b4c1b5d1662fa18d" fallback="Adjust to Next Valid Quantity (" />{moq.nextValidUnits.toLocaleString("en-IN")} <StorefrontText id="copy_cb20a4486a64f501" fallback="units)" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Itemized 12-Component Breakdown Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowItemizedDetails((prev) => !prev)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#143C31",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>{showItemizedDetails ? "▲ Hide 12-Component Breakdown" : "▼ Show 12-Component Breakdown"}</span>
        </button>

        {showItemizedDetails && breakdown && (
          <div
            style={{
              marginTop: "10px",
              borderTop: "1px solid #ECEEEA",
              paddingTop: "10px",
              fontSize: "0.8125rem",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_8797749eb94b92ff" fallback="1. Base Tea Leaf (3% allowance)" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.teaCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_8039cae2275debe4" fallback="2. Primary Packaging Structure" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.packagingCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_b6d971631d992085" fallback="3. Printing Run Cost" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.printingCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_64a995378ccd6f43" fallback="4. Tooling / Cylinders Setup" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.toolingSetupPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}>5. Closures &amp; Label Finishing</span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.closureFinishingCostPaise)}</span>
            </div>
            {breakdown.nitrogenFlushingCostPaise > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#65746D" }}>6. Nitrogen Flush &amp; MAP</span>
                <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.nitrogenFlushingCostPaise)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_7138081bb6e5ead2" fallback="7. Cleanroom Filling Labor" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.laborCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}>8. QC Cupping &amp; Retention Tasting</span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.qcCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_88882436f6c269b7" fallback="9. 5-Ply Corrugated Cartons" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.cartonCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}>10. Palletizing &amp; Shrink Hood</span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.palletizingCostPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_18f87f10ed033fb8" fallback="11. Domestic Zoned Freight" /></span>
              <span style={{ fontWeight: 600 }}>{formatPaise(breakdown.freightCostPaise)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px dashed #DDE4DC",
                paddingTop: "6px",
                marginTop: "4px",
              }}
            >
              <span style={{ color: "#65746D" }}><StorefrontText id="copy_a833dbbbf0ecb01d" fallback="12. Dual Indian GST (5% Tea + 18% Non-Tea)" /></span>
              <span style={{ fontWeight: 600, color: "#143C31" }}>
                {formatPaise(breakdown.taxPaise)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
        {onGenerateQuote && (
          <button
            type="button"
            disabled={isGeneratingQuote || !isEligible}
            onClick={onGenerateQuote}
            aria-busy={isGeneratingQuote}
            style={{
              minHeight: "44px",
              padding: "10px 18px",
              background: isEligible ? "#143C31" : "#2E5C4F",
              color: "#FFFCF7",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: isGeneratingQuote ? "wait" : "pointer",
              transition: "background 0.2s ease",
            }}
          >
            {isGeneratingQuote ? "Generating Official Quote..." : "Generate Official Quotation"}
          </button>
        )}

        {actionError && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              background: "#FFF4E5",
              border: "1px solid #FED7AA",
              borderRadius: "6px",
              color: "#9A3412",
              fontSize: "0.8125rem",
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 600 }}>{actionError}</div>
            {needsLogin && onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                style={{
                  display: "inline-block",
                  marginTop: "6px",
                  fontWeight: 700,
                  color: "#143C31",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                }}
              >
                Sign in or register to generate quote &rarr;
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {onSaveDraft && (
            <button
              type="button"
              disabled={isSavingDraft}
              onClick={onSaveDraft}
              style={{
                minHeight: "40px",
                padding: "8px 12px",
                background: "#FFFFFF",
                border: "1px solid #DDE4DC",
                borderRadius: "6px",
                color: "#143C31",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </button>
          )}

          {quoteId ? (
            <a
              href={`/private-label/quotes/${quoteId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                minHeight: "40px",
                padding: "8px 12px",
                background: "#FFFFFF",
                border: "1px solid #DDE4DC",
                borderRadius: "6px",
                color: "#143C31",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            ><StorefrontText id="copy_ee2a0ef44ac8cc26" fallback="Printable Quote" />
            </a>
          ) : (
            <button
              type="button"
              disabled={!onDownloadPdf}
              onClick={onDownloadPdf}
              style={{
                minHeight: "40px",
                padding: "8px 12px",
                background: "#FFFFFF",
                border: "1px solid #DDE4DC",
                borderRadius: "6px",
                color: "#143C31",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            ><StorefrontText id="copy_6183be0883d2a89c" fallback="Download PDF" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
