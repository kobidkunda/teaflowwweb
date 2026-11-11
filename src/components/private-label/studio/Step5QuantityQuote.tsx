"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import type { QuoteEstimateResult } from "../hooks/useQuoteEstimate";

export interface Step5QuantityQuoteProps {
  quantityUnits: number;
  destinationZone: "local" | "metro" | "national" | "international";
  isNitrogenFlushEnabled: boolean;
  notes: string;
  estimate: QuoteEstimateResult;
  onChangeQuantity: (quantity: number) => void;
  onChangeDestinationZone: (zone: "local" | "metro" | "national" | "international") => void;
  onToggleNitrogenFlush: (enabled: boolean) => void;
  onChangeNotes: (notes: string) => void;
  onGenerateQuote: () => void;
  onSaveDraft: () => void;
  onPrev: () => void;
  isGeneratingQuote?: boolean;
  isSavingDraft?: boolean;
  quoteId?: string | null;
  validationError?: string | null;
  actionError?: string | null;
  needsLogin?: boolean;
  onOpenAuthModal?: () => void;
}

export function Step5QuantityQuote({
  quantityUnits,
  destinationZone,
  isNitrogenFlushEnabled,
  notes,
  estimate,
  onChangeQuantity,
  onChangeDestinationZone,
  onToggleNitrogenFlush,
  onChangeNotes,
  onGenerateQuote,
  onSaveDraft,
  onPrev,
  isGeneratingQuote = false,
  isSavingDraft = false,
  quoteId: _quoteId,
  validationError,
  actionError,
  needsLogin,
  onOpenAuthModal,
}: Step5QuantityQuoteProps) {
  const { isEligible } = estimate;

  const quickQuantities = [500, 1000, 2500, 5000, 10000];

  return (
    <section
      data-testid="step-quote"
      data-step="5"
      aria-labelledby="step-5-title"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2
          id="step-5-title" tabIndex={-1}
          style={{
            margin: "0 0 6px 0",
            fontSize: "1.5rem",
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#143C31",
          }}
        >
          Step 5: Order Volume &amp; Official Quotation
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#65746D" }}>
          Itemized transparent breakdown incorporating TeaFloww&apos;s tiered volume price book, master
          cartons, cleanroom filling labor, and dual-rate Indian GST.
        </p>
      </div>

      {/* Quantity Configuration Box */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #DDE4DC",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>
          <label
            htmlFor="quantity-input"
            style={{
              display: "block",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#143C31",
              marginBottom: "8px",
            }}
          ><StorefrontText id="copy_271aa39c92ba6d7f" fallback="Requested Production Run (Units):" />
          </label>

          {/* Quick Quantity Chips */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            {quickQuantities.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onChangeQuantity(q)}
                style={{
                  minHeight: "36px",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: quantityUnits === q ? "2px solid #143C31" : "1px solid #DDE4DC",
                  background: quantityUnits === q ? "#F2F8F4" : "#FFFFFF",
                  color: quantityUnits === q ? "#143C31" : "#171713",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                {q.toLocaleString("en-IN")}<StorefrontText id="copy_dbd1afe9efa12c30" fallback="packs" />
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              id="quantity-input"
              name="quantity"
              data-testid="input-quantity"
              type="number"
              min={1}
              max={10000000}
              step={1}
              value={quantityUnits || ""}
              aria-invalid={!Number.isSafeInteger(quantityUnits) || quantityUnits < 1 || quantityUnits > 10000000}
              onChange={(e) => onChangeQuantity(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
              style={{
                width: "160px",
                minHeight: "44px",
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #DDE4DC",
                fontSize: "1.125rem",
                fontWeight: "bold",
                color: "#143C31",
              }}
            />
            <span style={{ fontSize: "0.875rem", color: "#65746D" }}><StorefrontText id="copy_542e976cafeef6ec" fallback="finished tea units" /></span>
          </div>
        </div>

        {(!Number.isSafeInteger(quantityUnits) || quantityUnits < 1 || quantityUnits > 10000000) && <p role="alert"><StorefrontText id="copy_d661cad4ba791c06" fallback="Enter a whole number of units between 1 and 10,000,000." /></p>}

        {/* Destination Logistics Zone */}
        <div>
          <label
            htmlFor="destination-zone-select"
            style={{
              display: "block",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#143C31",
              marginBottom: "8px",
            }}
          ><StorefrontText id="copy_407619b1ce43cad8" fallback="Delivery Destination (Freight Zone):" />
          </label>
          <select
            id="destination-zone-select"
            value={destinationZone}
            onChange={(e) =>
              onChangeDestinationZone(
                e.target.value as "local" | "metro" | "national" | "international"
              )
            }
            style={{
              width: "100%",
              maxWidth: "360px",
              minHeight: "44px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #DDE4DC",
              fontSize: "0.9375rem",
              background: "#FFFFFF",
              color: "#171713",
            }}
          >
            <option value="local">Local Siliguri / North Bengal (₹200 + ₹25/kg)</option>
            <option value="metro">Major Indian Metro (Kolkata, Delhi, Mumbai, Bengaluru) (₹350 + ₹55/kg)</option>
            <option value="national">National All-India Logistics (₹450 + ₹75/kg)</option>
            <option value="international">International Air / Ocean Freight (Assisted Quote)</option>
          </select>
        </div>

        {/* Nitrogen Flush & MAP Sealing Toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            fontSize: "0.875rem",
            color: "#171713",
          }}
        >
          <input
            type="checkbox"
            checked={isNitrogenFlushEnabled}
            onChange={(e) => onToggleNitrogenFlush(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#143C31" }}
          />
          <span>
            <strong>Nitrogen Flush &amp; Modified Atmosphere Sealing</strong><StorefrontText id="copy_c0c888b2f77fae4e" fallback="(+₹0.75/unit): Displaces residual oxygen in headspace with pure food-grade nitrogen to preserve green tea catechins and Darjeeling floral aromatics." />
          </span>
        </label>
      </div>

      {/* Production & Commercial Guarantees */}
      <div
        style={{
          background: "#F4F8F5",
          borderRadius: "10px",
          border: "1px solid #C8DFD2",
          padding: "16px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "0.75rem", color: "#65746D", textTransform: "uppercase", fontWeight: 700 }}><StorefrontText id="copy_d818f5b278fdffed" fallback="Quotation Validity" />
          </div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#143C31", marginTop: "2px" }}><StorefrontText id="copy_ea365b17f475afc4" fallback="See Your Issued Quote" />
          </div>
          <div style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_e1bfdc1a30a3261e" fallback="Estimates are subject to review and current rates." />
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.75rem", color: "#65746D", textTransform: "uppercase", fontWeight: 700 }}><StorefrontText id="copy_10d080cab950ab7e" fallback="Estimated Lead Time" />
          </div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#143C31", marginTop: "2px" }}><StorefrontText id="copy_134a3b19314a1022" fallback="Confirmed Per Project" />
          </div>
          <div style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_cff0f5415cc5a0c0" fallback="Our team confirms timing after reviewing materials and artwork." />
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.75rem", color: "#65746D", textTransform: "uppercase", fontWeight: 700 }}><StorefrontText id="copy_f298346f06d21fa1" fallback="Payment Milestones" />
          </div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#143C31", marginTop: "2px" }}><StorefrontText id="copy_eed614e7b247c9f3" fallback="50% Advance / 50% Dispatch" />
          </div>
          <div style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_3d7f5056a475afb8" fallback="Prepress tooling on advance; balance on QC release." />
          </div>
        </div>
      </div>

      {/* Special Requirements / Notes */}
      <div>
        <label
          htmlFor="step5-notes"
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#143C31",
            marginBottom: "6px",
          }}
        ><StorefrontText id="copy_d62aa7b66d521c14" fallback="Special Order Instructions / Private Label Specifications (Optional):" />
        </label>
        <textarea
          id="step5-notes"
          rows={3}
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder="e.g. Include FSSAI certificate copy with carton pack slips; delivery dock appointment needed"
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #DDE4DC",
            fontSize: "0.875rem",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div
          role="alert"
          style={{
            background: "#FFEBEE",
            border: "1px solid #FFCDD2",
            borderRadius: "6px",
            padding: "10px 14px",
            color: "#C62828",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {validationError}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <button
          type="button"
          onClick={onPrev}
          style={{
            minHeight: "44px",
            padding: "10px 20px",
            background: "#FFFFFF",
            color: "#143C31",
            borderRadius: "6px",
            border: "1px solid #DDE4DC",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          &lsaquo; Back to Artwork
        </button>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            disabled={isSavingDraft}
            onClick={onSaveDraft}
            style={{
              minHeight: "48px",
              padding: "12px 20px",
              background: "#FFFFFF",
              border: "1px solid #143C31",
              color: "#143C31",
              borderRadius: "6px",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isSavingDraft ? "Saving Draft..." : "Save Draft"}
          </button>

          <button
            type="button"
            data-testid="step-next-btn"
            disabled={isGeneratingQuote || !isEligible}
            onClick={onGenerateQuote}
            aria-busy={isGeneratingQuote}
            style={{
              minHeight: "48px",
              padding: "12px 28px",
              background: isEligible ? "#143C31" : "#2E5C4F",
              color: "#FFFCF7",
              borderRadius: "6px",
              border: "none",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: isGeneratingQuote ? "wait" : "pointer",
              transition: "background 0.2s ease",
            }}
          >
            {isGeneratingQuote ? "Generating Official Quotation..." : "Generate Official Quotation"}
          </button>
        </div>

        {actionError && (
          <div
            role="alert"
            style={{
              padding: "14px 18px",
              background: "#FFF4E5",
              border: "1px solid #FED7AA",
              borderRadius: "8px",
              color: "#9A3412",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontWeight: 600 }}>{actionError}</div>
            {needsLogin && onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  fontWeight: 700,
                  color: "#143C31",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Sign in or create free account to generate quotation &rarr;
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
