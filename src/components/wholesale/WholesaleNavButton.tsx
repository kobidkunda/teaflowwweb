"use client";

import React from "react";
import { useWholesale } from "./WholesaleContext";
import { WhatsAppIcon } from "./WholesaleForm";

export interface WholesaleNavButtonProps {
  className?: string;
  variant?: "header" | "pill" | "banner";
}

export function WholesaleNavButton({ className = "", variant = "header" }: WholesaleNavButtonProps) {
  const { openWholesaleModal } = useWholesale();

  if (variant === "banner") {
    return (
      <button
        type="button"
        onClick={() => openWholesaleModal()}
        className={`wholesale-banner-trigger ${className}`}
        aria-label="Bulk & Wholesale Rates — Open purchase inquiry form"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "linear-gradient(135deg, #1d3323 0%, #294c34 100%)",
          color: "#ffffff",
          border: "1px solid rgba(214, 184, 126, 0.4)",
          padding: "7px 16px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#25D366",
            boxShadow: "0 0 8px #25D366",
            display: "inline-block",
          }}
        />
        <WhatsAppIcon size={15} color="#25D366" />
        <span>Bulk &amp; Wholesale Rates</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openWholesaleModal()}
      className={`wholesale-header-btn ${className}`}
      aria-label="Wholesale & Bulk — Open purchase inquiry"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "linear-gradient(135deg, #173322 0%, #234932 100%)",
        color: "#ffffff",
        border: "1px solid rgba(214, 184, 126, 0.45)",
        padding: "6px 13px",
        borderRadius: "999px",
        fontSize: "11.5px",
        fontWeight: 600,
        letterSpacing: "0.025em",
        whiteSpace: "nowrap",
        cursor: "pointer",
        position: "relative",
        boxShadow: "0 2px 8px rgba(23, 51, 34, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: "#25D366",
          boxShadow: "0 0 6px #25D366",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <WhatsAppIcon size={14} color="#25D366" />
      <span className="wholesale-btn-text">Wholesale &amp; Bulk</span>
    </button>
  );
}
