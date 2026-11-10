"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ProofApprovalModalProps {
  isOpen: boolean;
  previewOnly?: boolean;
  onClose: () => void;
  onApprove: (data: { disclaimerAccepted: boolean; comments?: string; signerName?: string }) => void;
  brandName?: string;
  packagingName?: string;
  proofPreviewUrl?: string | null;
}

export function ProofApprovalModal({
  isOpen,
  previewOnly = false,
  onClose,
  onApprove,
  brandName = "Custom Brand",
  packagingName = "Selected Packaging",
  proofPreviewUrl,
}: ProofApprovalModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [comments, setComments] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccepted(false);
      setComments("");
      setSignerName("");
      previousActiveElement.current = document.activeElement as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }

        // Focus trap
        if (e.key === "Tab" && dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      // Focus first interactive element in modal
      setTimeout(() => {
        if (dialogRef.current) {
          const first = dialogRef.current.querySelector<HTMLElement>("input, button");
          first?.focus();
        }
      }, 50);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const canApprove = accepted && (previewOnly || signerName.trim().length >= 2);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(9, 43, 35, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-modal-title"
        data-testid="proof-approval-modal"
        style={{
          background: "#FFFCF7",
          borderRadius: "12px",
          border: "1px solid #DDE4DC",
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.2)",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90dvh",
          overflowY: "auto",
          padding: "28px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3
            id="proof-modal-title"
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: "#143C31",
            }}
          >
            {previewOnly ? "Review Your Studio Preview" : "Digital Proof Sign-Off & Preflight Attestation"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close proof approval dialog"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              color: "#65746D",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            &times;
          </button>
        </div>

        <p style={{ fontSize: "0.875rem", color: "#65746D", lineHeight: 1.5, marginBottom: "20px" }}>
          Please review and sign off on the mechanical safe zones, color registration, and mandatory
          FSSAI regulations and Siliguri manufacturing standards for <strong>{brandName}</strong> on{" "}
          <strong>{packagingName}</strong>.
        </p>

        <div
          style={{
            background: "#F4F6F4",
            borderRadius: "8px",
            padding: "16px",
            fontSize: "0.8125rem",
            color: "#171713",
            lineHeight: 1.5,
            marginBottom: "20px",
          }}
        >
          <div style={{ fontWeight: 600, color: "#143C31", marginBottom: "6px" }}>
            Production Terms &amp; Conditions:
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            <li>Colors rendered on RGB screens are simulations; physical print will align to CMYK / Pantone spot ink specifications.</li>
            <li>Rotogravure cylinder engraving and plate tooling charges are non-refundable once preflight proofs are locked.</li>
            <li>Production release requires operator review of applicable labeling requirements and the approved artwork.</li>
          </ul>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            cursor: "pointer",
            marginBottom: "20px",
            fontSize: "0.875rem",
            color: "#171713",
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#143C31" }}
          />
          <span>
            {previewOnly ? "I understand this preview is illustrative. A separate production proof must be reviewed and approved before manufacturing." : "I attest that I hold commercial intellectual property rights for the uploaded artwork and approve this preflight proof for production tooling."}
          </span>
        </label>

        {!previewOnly && <div style={{ marginBottom: 16 }}>
          {proofPreviewUrl && (/^\/(?!\/)/.test(proofPreviewUrl) || /^https:\/\//.test(proofPreviewUrl)) && <p><a href={proofPreviewUrl} target="_blank" rel="noopener noreferrer">Open the proof document for review</a></p>}
          <label htmlFor="proof-signer">Authorized signer&apos;s full name</label>
          <input id="proof-signer" autoComplete="name" value={signerName} onChange={event => setSignerName(event.target.value)} minLength={2} maxLength={100} style={{ width: "100%", minHeight: 44, marginTop: 6, border: "1px solid #DDE4DC", padding: 10 }} />
        </div>}
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="proof-comments"
            style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#171713", marginBottom: "6px" }}
          >
            Special Production Notes / Batch Instructions (Optional):
          </label>
          <textarea
            id="proof-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Align spot UV gloss with brand emblem; delivery dock hours"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #DDE4DC",
              boxSizing: "border-box",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            data-testid="cancel-proof-button"
            onClick={onClose}
            style={{
              minHeight: "44px",
              padding: "10px 18px",
              borderRadius: "6px",
              border: "1px solid #DDE4DC",
              background: "#FFFFFF",
              color: "#171713",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="approve-proof-button"
            disabled={!canApprove}
            onClick={() => onApprove({ disclaimerAccepted: accepted, comments, signerName: signerName.trim() })}
            style={{
              minHeight: "44px",
              padding: "10px 22px",
              borderRadius: "6px",
              border: "none",
              background: accepted ? "#143C31" : "#DDE4DC",
              color: accepted ? "#FFFCF7" : "#8E9E96",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: accepted ? "pointer" : "not-allowed",
            }}
          >
            {previewOnly ? "Finish Preview Review" : "Approve Proof & Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}
