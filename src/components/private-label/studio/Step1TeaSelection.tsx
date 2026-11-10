"use client";

import React, { useState } from "react";
import type { PublicTeaOptionDto } from "@/lib/private-label/public-dto";

export interface StudioTeaOption extends PublicTeaOptionDto {
  base_cost_per_kg_paise?: number;
  estate?: string;
  category?: string;
  formatted_price_per_kg?: string;
}

export interface Step1TeaSelectionProps {
  teas: StudioTeaOption[];
  selectedTeaId: string | null;
  fillWeightGrams: number;
  onSelectTea: (teaId: string) => void;
  onChangeFillWeight: (grams: number) => void;
  onNext: () => void;
  validationError?: string | null;
}

const COMMON_WEIGHTS = [50, 100, 250, 500, 1000];

export function Step1TeaSelection({
  teas = [],
  selectedTeaId,
  fillWeightGrams,
  onSelectTea,
  onChangeFillWeight,
  onNext,
  validationError,
}: Step1TeaSelectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = ["all", "black", "green", "white", "oolong", "chai"];

  const filteredTeas = teas.filter((tea) => {
    if (selectedCategory === "all") return true;
    const cat = (tea.category || tea.tea_category || "").toLowerCase();
    return cat === selectedCategory;
  });

  const selectedTea = teas.find((t) => t.id === selectedTeaId);
  const minBatchKg = Number(selectedTea?.min_batch_kg ?? 5.0);
  const minPacksNeeded = fillWeightGrams > 0 ? Math.ceil((minBatchKg * 1000) / fillWeightGrams) : 0;

  return (
    <section
      data-testid="step-tea"
      data-step="1"
      className="tea-selection"
      aria-labelledby="step-1-title"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2
          id="step-1-title" tabIndex={-1}
          style={{
            margin: "0 0 6px 0",
            fontSize: "1.5rem",
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#143C31",
          }}
        >
          Step 1: Select Your Tea
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#65746D" }}>
          Choose from verified high-altitude Himalayan estates in Darjeeling, Assam, and Kangra.
          All teas are fresh harvest with direct origin provenance.
        </p>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }} role="group" aria-label="Tea categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            style={{
              minHeight: "36px",
              padding: "6px 14px",
              borderRadius: "20px",
              border: selectedCategory === cat ? "1px solid #143C31" : "1px solid #DDE4DC",
              background: selectedCategory === cat ? "#143C31" : "#FFFFFF",
              color: selectedCategory === cat ? "#FFFCF7" : "#171713",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tea Options Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
          gap: "16px",
        }}
      >
        {filteredTeas.map((tea) => {
          const isSelected = tea.id === selectedTeaId;
          const priceFormatted = tea.formatted_price_per_kg || `₹${((tea.base_cost_per_kg_paise || 120000) / 100).toFixed(2)}/kg`;

          return (
            <div
              key={tea.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => onSelectTea(tea.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectTea(tea.id);
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
                      color: "#B45309",
                    }}
                  >
                    {tea.region || "Himalayan"} &bull; {tea.grade || "Grade A"}
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
                    margin: "6px 0 4px 0",
                    fontSize: "1rem",
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: "#143C31",
                  }}
                >
                  {tea.name}
                </h3>

                {tea.estate && (
                  <div style={{ fontSize: "0.8125rem", color: "#65746D" }}>
                    Estate: <strong>{tea.estate}</strong>
                  </div>
                )}

                {tea.tasting_notes && Array.isArray(tea.tasting_notes) && tea.tasting_notes.length > 0 && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>
                    {tea.tasting_notes.map((note, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "0.6875rem",
                          background: "#EAF2EE",
                          color: "#143C31",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid #ECEEEA",
                  paddingTop: "8px",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ color: "#65746D" }}>Base Rate:</span>
                <span style={{ fontWeight: 700, color: "#143C31" }}>{priceFormatted}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Net Fill Weight Selection */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #DDE4DC",
          padding: "20px",
        }}
      >
        <label
          htmlFor="fill-weight-input"
          style={{
            display: "block",
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "#143C31",
            marginBottom: "8px",
          }}
        >
          Pack Net Fill Weight (grams per pouch/tin):
        </label>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          {COMMON_WEIGHTS.map((wt) => (
            <button
              key={wt}
              type="button"
              onClick={() => onChangeFillWeight(wt)}
              style={{
                minHeight: "40px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: fillWeightGrams === wt ? "2px solid #143C31" : "1px solid #DDE4DC",
                background: fillWeightGrams === wt ? "#F2F8F4" : "#FFFFFF",
                color: fillWeightGrams === wt ? "#143C31" : "#171713",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              {wt}g
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            id="fill-weight-input"
            type="number"
            min={10}
            max={5000}
            value={fillWeightGrams}
            onChange={(e) => onChangeFillWeight(Number(e.target.value))}
            style={{
              width: "120px",
              minHeight: "44px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #DDE4DC",
              fontSize: "0.9375rem",
            }}
          />
          <span style={{ fontSize: "0.875rem", color: "#65746D" }}>grams per unit</span>
        </div>

        {selectedTea && minPacksNeeded > 0 && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "0.8125rem",
              color: "#65746D",
              background: "#F4F6F4",
              padding: "8px 12px",
              borderRadius: "6px",
            }}
          >
            Tea blend minimum batch: <strong>{minBatchKg} kg</strong> &bull; Requires at least{" "}
            <strong>{minPacksNeeded.toLocaleString("en-IN")} packs</strong> at {fillWeightGrams}g/pack.
          </div>
        )}
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

      {/* Step Next Action */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
          Continue to Packaging &rsaquo;
        </button>
      </div>
    </section>
  );
}
