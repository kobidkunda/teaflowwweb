"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";

export interface StudioMobileBottomBarProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  formattedUnitPrice: string;
  isEligible: boolean;
  onNext: () => void;
  isLastStep?: boolean;
  isGeneratingQuote?: boolean;
}

export function StudioMobileBottomBar({
  currentStep,
  formattedUnitPrice,
  isEligible,
  onNext,
  isLastStep = false,
  isGeneratingQuote = false,
}: StudioMobileBottomBarProps) {
  return (
    <div
      className="studio-mobile-bottom-bar"
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#FFFCF7",
        borderTop: "1px solid #DDE4DC",
        padding: "12px 16px",
        boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.08)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <div>
        <div style={{ fontSize: "0.75rem", color: "#65746D", fontWeight: 600 }}><StorefrontText id="copy_78e75a25d80993a5" fallback="STEP" /> {currentStep} <StorefrontText id="copy_fc074db975e783bc" fallback="OF 5" />
        </div>
        <div style={{ fontSize: "1.125rem", fontWeight: "bold", color: "#143C31" }}>
          {formattedUnitPrice !== "—" ? `${formattedUnitPrice} / pack` : "Custom Estimate"}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isGeneratingQuote || (isLastStep && !isEligible)}
        style={{
          minHeight: "48px",
          minWidth: "130px",
          padding: "10px 20px",
          borderRadius: "6px",
          border: "none",
          background: isLastStep && !isEligible ? "#2E5C4F" : "#143C31",
          color: "#FFFCF7",
          fontWeight: 600,
          fontSize: "0.9375rem",
          cursor: isGeneratingQuote ? "wait" : "pointer",
        }}
      >
        {isGeneratingQuote ? "Generating..." : isLastStep ? "Get Quotation" : "Next Step &rsaquo;"}
      </button>
    </div>
  );
}
