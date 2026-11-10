"use client";

import React from "react";

export interface StudioStepNavigationProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  completedSteps: number[];
  onStepSelect: (step: 1 | 2 | 3 | 4 | 5) => void;
  stepErrors?: Record<number, string[]>;
}

const STEPS = [
  { step: 1, title: "Tea Selection", subtitle: "Estate & Grade" },
  { step: 2, title: "Packaging", subtitle: "Structure & Barrier" },
  { step: 3, title: "Print Method", subtitle: "Colors & Finish" },
  { step: 4, title: "2D Studio", subtitle: "Artwork & Preflight" },
  { step: 5, title: "Quantity & Quote", subtitle: "Live 12-Component" },
] as const;

export function StudioStepNavigation({
  currentStep,
  completedSteps,
  onStepSelect,
  stepErrors = {},
}: StudioStepNavigationProps) {
  return (
    <nav aria-label="Configurator steps" style={{ width: "100%", marginBottom: "24px" }}>
      <ol
        role="list"
        style={{
          display: "flex",
          gap: "8px",
          listStyle: "none",
          padding: 0,
          margin: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "4px",
        }}
      >
        {STEPS.map((s) => {
          const isCurrent = currentStep === s.step;
          const isCompleted = completedSteps.includes(s.step);
          const hasError = stepErrors[s.step] && stepErrors[s.step].length > 0;
          const isClickable = isCompleted || s.step <= currentStep;

          return (
            <li key={s.step} style={{ flex: "1 1 0", minWidth: "120px" }}>
              <button
                type="button"
                data-testid={`step-tab-${s.step}`}
                data-step={s.step}
                aria-current={isCurrent ? "step" : undefined}
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable) onStepSelect(s.step);
                }}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: hasError
                    ? "2px solid #C62828"
                    : isCurrent
                    ? "2px solid #143C31"
                    : isCompleted
                    ? "1px solid #C8DFD2"
                    : "1px solid #DDE4DC",
                  background: isCurrent ? "#FFFFFF" : isCompleted ? "#F4F8F5" : "#FAFBF9",
                  color: isCurrent ? "#143C31" : isCompleted ? "#143C31" : "#8E9E96",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  cursor: isClickable ? "pointer" : "default",
                  outline: isCurrent ? "2px solid #143C31" : "none",
                  outlineOffset: "2px",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                  <span
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: isCurrent ? "#143C31" : isCompleted ? "#2A7E68" : "#DDE4DC",
                      color: isCurrent || isCompleted ? "#FFFCF7" : "#65746D",
                      fontSize: "0.6875rem",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted && !isCurrent ? "✓" : s.step}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: isCurrent ? 700 : 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: isCurrent ? "#65746D" : "#8E9E96",
                    paddingLeft: "26px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.subtitle}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
