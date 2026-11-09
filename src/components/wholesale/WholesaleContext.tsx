"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { WholesaleForm } from "./WholesaleForm";
import { X } from "lucide-react";

interface WholesaleContextType {
  isOpen: boolean;
  openWholesaleModal: (defaultCategory?: string) => void;
  closeWholesaleModal: () => void;
}

const WholesaleContext = createContext<WholesaleContextType | undefined>(undefined);

export function WholesaleProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>(undefined);

  const openWholesaleModal = useCallback((category?: string) => {
    setDefaultCategory(category);
    setIsOpen(true);
  }, []);

  const closeWholesaleModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeWholesaleModal();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeWholesaleModal]);

  return (
    <WholesaleContext.Provider value={{ isOpen, openWholesaleModal, closeWholesaleModal }}>
      {children}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wholesale-form-title"
          className="wholesale-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeWholesaleModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(16, 26, 20, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            overflowY: "auto",
          }}
        >
          <div
            className="wholesale-modal-container"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "92vh",
              overflowY: "auto",
              borderRadius: "20px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4)",
              background: "#ffffff",
              margin: "auto",
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closeWholesaleModal}
              aria-label="Close wholesale inquiry modal"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                zIndex: 10,
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(240, 237, 230, 0.8)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#18231c",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <X size={20} />
            </button>

            <WholesaleForm defaultCategory={defaultCategory} />
          </div>
        </div>
      )}
    </WholesaleContext.Provider>
  );
}

export function useWholesale(): WholesaleContextType {
  const context = useContext(WholesaleContext);
  if (!context) {
    throw new Error("useWholesale must be used within a WholesaleProvider");
  }
  return context;
}
