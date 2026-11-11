"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { PackagingDielineAction } from "../detail/PackagingDielineAction";
import React, { useRef } from "react";

export interface Step4ArtworkUploadProps {
  brandName: string;
  artworkUrl: string | null;
  artworkFilename: string | null;
  artworkDpi: number | null;
  artworkX?: number;
  artworkY?: number;
  artworkScale?: number;
  rightsAttested: boolean;
  onBrandNameChange: (name: string) => void;
  onUploadArtwork: (file: File) => void;
  onPlacementChange?: (placement: { xMm: number; yMm: number; scale: number; rotationDeg: number }) => void;
  onRightsAttestedChange: (attested: boolean) => void;
  onOpenProofModal: () => void;
  onNext: () => void;
  onPrev: () => void;
  packagingVariantId?: string | null;
  packagingTitle?: string;
  dielineUrl?: string | null;
  validationError?: string | null;
}

export function Step4ArtworkUpload({
  brandName,
  artworkUrl: _artworkUrl,
  artworkFilename,
  artworkDpi,
  artworkX = 0,
  artworkY = 0,
  artworkScale = 1.0,
  rightsAttested,
  onBrandNameChange,
  onUploadArtwork,
  onPlacementChange,
  onRightsAttestedChange,
  onOpenProofModal,
  onNext,
  onPrev,
  packagingVariantId: _packagingVariantId,
  packagingTitle = "Selected packaging",
  dielineUrl,
  validationError,
}: Step4ArtworkUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadArtwork(file);
    }
  };

  const isLowRes = typeof artworkDpi === "number" && artworkDpi > 0 && artworkDpi < 300;

  return (
    <section
      data-testid="step-artwork"
      data-step="4"
      aria-labelledby="step-4-title"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2
          id="step-4-title" tabIndex={-1}
          style={{
            margin: "0 0 6px 0",
            fontSize: "1.5rem",
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#143C31",
          }}
        >
          Step 4: Custom Artwork &amp; 2D Preflight Stage
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#65746D" }}><StorefrontText id="copy_8d856d57711d01e5" fallback="Add an image preview or type your brand name to visualize on the live 2D package silhouette. Verify mechanical safe zones and regulatory disclosures." />
        </p>
      </div>

      {/* Brand Name Input */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #DDE4DC",
          padding: "20px",
        }}
      >
        <label
          htmlFor="brand-name-input"
          style={{
            display: "block",
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "#143C31",
            marginBottom: "8px",
          }}
        ><StorefrontText id="copy_44a1a3a952318e63" fallback="Brand Name (Preview on Canvas):" />
        </label>
        <input
          id="brand-name-input"
          maxLength={100}
          type="text"
          value={brandName}
          onChange={(e) => onBrandNameChange(e.target.value)}
          placeholder="e.g. Nirva Himalayan Botanicals"
          style={{
            width: "100%",
            minHeight: "44px",
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #DDE4DC",
            fontSize: "1rem",
            boxSizing: "border-box",
          }}
        />
        <div style={{ fontSize: "0.75rem", color: "#8E9E96", marginTop: "4px" }}><StorefrontText id="copy_df3e5a75f0872cc4" fallback="Type your brand name to immediately preview on the 2D canvas in the sidebar." />
        </div>
      </div>

      {/* Preflight Artwork Upload Dropzone */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "10px",
          border: "1px dashed #B5C4BC",
          padding: "24px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <div style={{ fontSize: "2rem" }}>🎨</div>
        <div>
          <div style={{ fontWeight: 600, color: "#143C31", fontSize: "1rem" }}><StorefrontText id="copy_f7fd088de1a54a23" fallback="Add Artwork Preview" />
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#65746D", marginTop: "2px" }}><StorefrontText id="copy_8c456a11e39bd88c" fallback="Preview: PNG, JPEG or WebP, up to 512 KB. Saved with your draft. Production files and print quality are reviewed separately." />
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            minHeight: "44px",
            padding: "10px 20px",
            borderRadius: "6px",
            background: "#143C31",
            color: "#FFFCF7",
            border: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          {artworkFilename ? "Replace File" : "Choose Artwork File"}
        </button>

        {artworkFilename && (
          <div style={{ fontSize: "0.8125rem", color: "#143C31", fontWeight: 500 }}><StorefrontText id="copy_6701f7df4b9cac97" fallback="Uploaded:" /> <strong>{artworkFilename}</strong>{" "}
            {artworkDpi ? `(${artworkDpi} DPI)` : ""}
          </div>
        )}
      </div>

      {/* Low-Resolution DPI Warning Banner */}
      {isLowRes && (
        <div
          data-testid="dpi-warning"
          className="low-res-warning"
          role="alert"
          style={{
            background: "#FFF4E5",
            border: "1px solid #FFCC80",
            borderRadius: "6px",
            padding: "10px 14px",
            fontSize: "0.8125rem",
            color: "#B25E00",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong><StorefrontText id="copy_a7109a775d0ad5fe" fallback="Resolution Warning:" /></strong> <StorefrontText id="copy_187ab5b3e3107164" fallback="Your uploaded asset resolution (" />{artworkDpi} <StorefrontText id="copy_db1072eaa2c033be" fallback="DPI) is below the 300 DPI threshold required for production engraving. We recommend supplying high-resolution vector artwork." />
          </span>
        </div>
      )}

      {/* Accessible Artwork Placement Controls */}
      <div
        data-testid="artwork-placement-controls"
        style={{
          background: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #DDE4DC",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, color: "#143C31", fontSize: "0.9375rem" }}>
              Artwork Placement &amp; Scaling
            </div>
            <div style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_e06a7005e3c202f0" fallback="Nudge artwork coordinates or use keyboard controls on the 2D stage." />
            </div>
          </div>
          <button
            type="button"
            data-testid="reset-placement-button"
            onClick={() => onPlacementChange?.({ xMm: 0, yMm: 0, scale: 1.0, rotationDeg: 0 })}
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid #DDE4DC",
              background: "#F4F6F4",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          ><StorefrontText id="copy_69900693083a16b5" fallback="Reset (R)" />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <div>
            <label
              htmlFor="art-x-offset"
              style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#171713", marginBottom: "4px" }}
            ><StorefrontText id="copy_9948509f2fa5456a" fallback="X Offset (mm):" />
            </label>
            <input
              id="art-x-offset"
              type="number"
              value={artworkX}
              onChange={(e) =>
                onPlacementChange?.({
                  xMm: Number(e.target.value) || 0,
                  yMm: artworkY,
                  scale: artworkScale,
                  rotationDeg: 0,
                })
              }
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #DDE4DC",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="art-y-offset"
              style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#171713", marginBottom: "4px" }}
            ><StorefrontText id="copy_7f70ee041b1ef266" fallback="Y Offset (mm):" />
            </label>
            <input
              id="art-y-offset"
              type="number"
              value={artworkY}
              onChange={(e) =>
                onPlacementChange?.({
                  xMm: artworkX,
                  yMm: Number(e.target.value) || 0,
                  scale: artworkScale,
                  rotationDeg: 0,
                })
              }
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #DDE4DC",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="art-scale"
              style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#171713", marginBottom: "4px" }}
            ><StorefrontText id="copy_6ec13e7e08c4d888" fallback="Scale (%):" />
            </label>
            <input
              id="art-scale"
              type="number"
              min={20}
              max={250}
              step={5}
              value={Math.round(artworkScale * 100)}
              onChange={(e) =>
                onPlacementChange?.({
                  xMm: artworkX,
                  yMm: artworkY,
                  scale: Math.max(0.2, Math.min(2.5, (Number(e.target.value) || 100) / 100)),
                  rotationDeg: 0,
                })
              }
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #DDE4DC",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ fontSize: "0.6875rem", color: "#8E9E96", background: "#F8FAF7", padding: "6px 10px", borderRadius: "4px" }}>
          ⌨️ <strong><StorefrontText id="copy_029fe723f1e8af4f" fallback="Stage Keyboard Controls:" /></strong> Focus canvas stage &bull; <strong><StorefrontText id="copy_4ff61299f0afe77c" fallback="Arrow keys:" /></strong> 1mm nudge &bull; <strong><StorefrontText id="copy_9915e28f725c85f8" fallback="Shift+Arrow:" /></strong> 10mm jump &bull; <strong>+/-:</strong> zoom &bull; <strong>R:</strong><StorefrontText id="copy_2a3eb4e119ea9568" fallback="reset." />
        </div>
      </div>

      {/* Technical Dieline Action */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#F4F6F4",
          padding: "12px 16px",
          borderRadius: "8px",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: "#143C31", fontSize: "0.875rem" }}><StorefrontText id="copy_0e80d8517961d66c" fallback="Designer Technical Dieline" />
          </div>
          <div style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_5a438ab5e62409d9" fallback="Use the approved packaging template, or request one before preparing production artwork." />
          </div>
        </div>
        <PackagingDielineAction dielineUrl={dielineUrl} variantTitle={packagingTitle} />
      </div>

      {/* Digital Proof Sign-Off Modal Trigger */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #DDE4DC",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: "#143C31", fontSize: "0.9375rem" }}>
            Digital Proof Sign-Off &amp; Preflight Review
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#65746D" }}><StorefrontText id="copy_eee1e4471dd9209f" fallback="Verify mechanical alignment and approve legal disclaimer." />
          </div>
        </div>
        <button
          type="button"
          data-testid="open-proof-modal"
          onClick={onOpenProofModal}
          style={{
            minHeight: "44px",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #143C31",
            background: "#FFFFFF",
            color: "#143C31",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Review Studio Preview &rsaquo;
        </button>
      </div>

      {/* Rights Attestation Checkbox */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          cursor: "pointer",
          fontSize: "0.875rem",
          color: "#171713",
        }}
      >
        <input
          type="checkbox"
          checked={rightsAttested}
          onChange={(e) => onRightsAttestedChange(e.target.checked)}
          style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#143C31" }}
        />
        <span><StorefrontText id="copy_3d4525d4cf8bdad0" fallback="I attest that I own or hold valid commercial copyright/trademark license for this brand name and artwork, and authorize TeaFloww (Nirva) to reproduce it." />
        </span>
      </label>

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
          &lsaquo; Back to Print Method
        </button>

        <button
          type="button"
          data-testid="step-next-btn"
          onClick={onNext}
          style={{
            minHeight: "48px",
            padding: "12px 28px",
            background: "#143C31",
            color: "#FFFCF7",
            borderRadius: "6px",
            border: "none",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
        >
          Continue to Quantity &amp; Quote &rsaquo;
        </button>
      </div>
    </section>
  );
}
