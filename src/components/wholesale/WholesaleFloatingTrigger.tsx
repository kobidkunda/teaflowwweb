"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useWholesale } from "./WholesaleContext";
import { WhatsAppIcon } from "./WholesaleForm";
import { X } from "lucide-react";

export function WholesaleFloatingTrigger() {
  const pathname = usePathname();
  const { openWholesaleModal } = useWholesale();
  const [minimized, setMinimized] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return true;
    return pathname === "/leaf-to-cup";
  });

  // Suppress floating button on cart, checkout, order confirmation, tea PDPs, trials routes, and wholesale portal to avoid obscuring primary CTAs (especially sticky purchase bar on mobile)
  if (
    /(?:^|\/)(tea|cart|checkout|order|trials|wholesale)(?:\/|$)/.test(pathname || "")
  ) {
    return null;
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Expand Wholesale & Bulk Assistant"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 40,
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1b3826 0%, #264e35 100%)",
          border: "2px solid #25D366",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
          cursor: "pointer",
        }}
      >
        <WhatsAppIcon size={24} color="#25D366" />
      </button>
    );
  }

  return (
    <div
      className="wholesale-floating-widget"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <button
        type="button"
        onClick={() => openWholesaleModal()}
        aria-haspopup="dialog"
        className="wholesale-floating-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          background: "linear-gradient(135deg, #18281e 0%, #23483a 100%)",
          color: "#ffffff",
          border: "1.5px solid rgba(214, 184, 126, 0.6)",
          padding: "12px 20px",
          borderRadius: "999px",
          boxShadow: "0 10px 30px rgba(16, 26, 20, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s",
        }}
      >
        {/* Pulsing indicator */}
        <span
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "10px",
            height: "10px",
          }}
        >
          <span
            className="wholesale-pulse-dot"
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              backgroundColor: "#25D366",
              opacity: 0.75,
            }}
          />
          <span
            style={{
              position: "relative",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#25D366",
            }}
          />
        </span>

        <WhatsAppIcon size={20} color="#25D366" />

        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em" }}>
            Wholesale &amp; Bulk Orders
          </div>
          <div style={{ fontSize: "10px", color: "#d6c8a7", letterSpacing: "0.04em" }}> <StorefrontText id="copy_9ef117e544d8b23f" fallback="Direct Garden Rates · WhatsApp" /> </div>
        </div>
      </button>

      {/* Minimize button */}
      <button
        type="button"
        onClick={() => setMinimized(true)}
        aria-label="Minimize wholesale widget"
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: "rgba(24, 40, 30, 0.85)",
          border: "1px solid rgba(214, 184, 126, 0.3)",
          color: "#d6c8a7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
