"use client";

import React from "react";
import type { PublicPrintMethodDto } from "@/lib/private-label/public-dto";
import { validateCompatibility } from "@/lib/private-label/compatibility";

import type { PrintMethodCode } from "@/lib/private-label/types";

export interface Step3PrintMethodProps {
  printMethods: PublicPrintMethodDto[];
  packagingFamily: string | null;
  supportedPrintMethodCodes?: string[];
  selectedPrintMethodId: string | null;
  colorCount: number;
  finishEmbellishment: string;
  onSelectPrintMethod: (methodId: string, code?: PrintMethodCode) => void;
  onChangeColorCount: (count: number) => void;
  onChangeFinish: (finish: string) => void;
  onNext: () => void;
  onPrev: () => void;
  validationError?: string | null;
}

const EMBELLISHMENTS = [
  { id: "matte", label: "Soft-Touch Matte Varnish", desc: "Silky tactile feel, non-reflective" },
  { id: "gloss", label: "Spot UV Gloss", desc: "High-contrast gloss highlights on brand logos" },
  { id: "gold_foil", label: "Gold Hot Foil Stamping", desc: "Metallic reflective gold embellishment" },
  { id: "silver_foil", label: "Silver Hot Foil Stamping", desc: "Metallic reflective silver accents" },
  { id: "emboss", label: "Embossed / Debossed Relief", desc: "Dimensional tactile relief on surface" },
];

export function Step3PrintMethod({
  printMethods = [],
  packagingFamily,
  supportedPrintMethodCodes = [],
  selectedPrintMethodId,
  colorCount,
  onChangeColorCount,
  onChangeFinish,
  finishEmbellishment,
  onSelectPrintMethod,
  onNext,
  onPrev,
  validationError,
}: Step3PrintMethodProps) {
  const familyCode = packagingFamily || "pouch";

  // Filter print methods strictly by compatibility with selected packaging family
  const compatibleMethods = printMethods.filter((method) => {
    const res = validateCompatibility({
      familyCode,
      printMethodCode: method.code,
      colorCount: 1,
    });
    return res.compatible && (!supportedPrintMethodCodes.length || supportedPrintMethodCodes.includes(method.code));
  });

  const selectedMethod = printMethods.find((m) => m.id === selectedPrintMethodId);
  const physicalMax = selectedMethod ? validateCompatibility({ familyCode, printMethodCode: selectedMethod.code, colorCount: 1 }).maxColors : undefined;
  const maxColors = Math.min(selectedMethod?.max_colors || 4, physicalMax || 12);
  const chooseMethod = (method: PublicPrintMethodDto) => {
    const physical = validateCompatibility({ familyCode, printMethodCode: method.code, colorCount: 1 });
    onChangeColorCount(Math.min(colorCount, method.max_colors, physical.maxColors || 12));
    onSelectPrintMethod(method.id, method.code as PrintMethodCode);
  };

  return (
    <section
      data-testid="step-print"
      data-step="3"
      aria-labelledby="step-3-title"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2
          id="step-3-title" tabIndex={-1}
          style={{
            margin: "0 0 6px 0",
            fontSize: "1.5rem",
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#143C31",
          }}
        >
          Step 3: Print Method &amp; Surface Embellishments
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#65746D" }}>
          Compatible print processes for your selected {familyCode} structure. Choose between short-run
          digital customization or high-speed industrial rotogravure.
        </p>
      </div>

      {/* Compatible Print Methods Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
          gap: "16px",
        }}
      >
        {compatibleMethods.map((method) => {
          const isSelected = method.id === selectedPrintMethodId;
          const setupFee = (method.setup_fee_paise || 0) / 100;
          const cylinderFee = (method.cylinder_fee_per_color_paise || 0) / 100;

          return (
            <div
              key={method.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => chooseMethod(method)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  chooseMethod(method);
                }
              }}
              style={{
                borderRadius: "10px",
                border: isSelected ? "2px solid #143C31" : "1px solid #DDE4DC",
                background: isSelected ? "#F2F8F4" : "#FFFFFF",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#143C31",
                    }}
                  >
                    Up to {method.max_colors} Colors
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        background: "#143C31",
                        color: "#FFFCF7",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.625rem",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>

                <h3
                  style={{
                    margin: "8px 0 4px 0",
                    fontSize: "1rem",
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: "#143C31",
                  }}
                >
                  {method.name}
                </h3>

                <p style={{ margin: "0 0 8px 0", fontSize: "0.8125rem", color: "#65746D", lineHeight: 1.4 }}>
                  {method.description || "High-precision print technology engineered for food contact."}
                </p>

                <div style={{ fontSize: "0.75rem", color: "#65746D" }}>
                  MOQ: <strong>{method.min_order_units}</strong> units
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #ECEEEA",
                  paddingTop: "8px",
                  fontSize: "0.75rem",
                  color: "#65746D",
                }}
              >
                <div>Setup Fee: {setupFee > 0 ? `₹${setupFee.toFixed(2)}` : "Free"}</div>
                {cylinderFee > 0 && (
                  <div style={{ color: "#B45309", marginTop: "2px" }}>
                    Cylinder: ₹{cylinderFee.toFixed(2)} / color
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Colors & Embellishments Configuration */}
      {selectedMethod && (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "10px",
            border: "1px solid #DDE4DC",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Color Count Selector */}
          <div>
            <label
              id="color-count-select"
              style={{
                display: "block",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#143C31",
                marginBottom: "8px",
              }}
            >
              Number of Spot / Process Colors (1 to {maxColors}):
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Array.from({ length: maxColors }, (_, i) => i + 1).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onChangeColorCount(cnt)}
                  style={{
                    minWidth: "44px",
                    minHeight: "44px",
                    borderRadius: "6px",
                    border: colorCount === cnt ? "2px solid #143C31" : "1px solid #DDE4DC",
                    background: colorCount === cnt ? "#F2F8F4" : "#FFFFFF",
                    color: colorCount === cnt ? "#143C31" : "#171713",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    cursor: "pointer",
                  }}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Surface Embellishments */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#143C31",
                marginBottom: "8px",
              }}
            >
              Surface Finish &amp; Tactile Embellishment:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: "10px" }}>
              {EMBELLISHMENTS.map((emb) => {
                const isSelected = finishEmbellishment === emb.id;
                return (
                  <div
                    key={emb.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => onChangeFinish(emb.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onChangeFinish(emb.id);
                      }
                    }}
                    style={{
                      borderRadius: "6px",
                      border: isSelected ? "2px solid #143C31" : "1px solid #DDE4DC",
                      background: isSelected ? "#F2F8F4" : "#FFFFFF",
                      padding: "10px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#143C31" }}>
                      {emb.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#65746D", marginTop: "2px" }}>
                      {emb.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
          &lsaquo; Back to Packaging
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
          Continue to Artwork Studio &rsaquo;
        </button>
      </div>
    </section>
  );
}
