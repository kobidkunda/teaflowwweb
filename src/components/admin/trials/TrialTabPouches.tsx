"use client";

import React, { useState } from "react";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  Layers,
} from "lucide-react";
import type { TrialComponent } from "@/lib/trials/types";

export interface TrialTabPouchesProps {
  components: TrialComponent[];
  onChange: (components: TrialComponent[]) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export function reorderSachets(
  items: TrialComponent[],
  fromIndex: number,
  toIndex: number
): TrialComponent[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy.map((comp, idx) => ({
    ...comp,
    slot_index: idx,
    sort_order: idx,
  }));
}

export function validateSachetTotalWeight(items: TrialComponent[]): {
  isValid: boolean;
  totalWeight: number;
  count: number;
  error: string | null;
} {
  const count = items.length;
  const totalWeight = items.reduce(
    (sum, c) => sum + (Number(c.weight_g) || 0) * (c.quantity || 1),
    0
  );

  if (count !== 4) {
    return {
      isValid: false,
      totalWeight,
      count,
      error: "Exactly 4 sachets required",
    };
  }

  const anyNon50 = items.some((c) => Number(c.weight_g) !== 50);
  if (anyNon50 || totalWeight !== 200) {
    return {
      isValid: false,
      totalWeight,
      count,
      error: "Total must equal 200g | Invariant error",
    };
  }

  return {
    isValid: true,
    totalWeight: 200,
    count: 4,
    error: null,
  };
}

export function TrialTabPouches({
  components,
  onChange,
  onSave,
  saving,
}: TrialTabPouchesProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeGrabbedIndex, setActiveGrabbedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const weightValidation = validateSachetTotalWeight(components);

  function handleFieldChange(idx: number, patch: Partial<TrialComponent>) {
    const updated = components.map((comp, i) =>
      i === idx ? { ...comp, ...patch } : comp
    );
    onChange(updated);
  }

  function handleMove(fromIdx: number, toIdx: number) {
    const updated = reorderSachets(components, fromIdx, toIdx);
    onChange(updated);
    const movedItem = components[fromIdx];
    const msg = `Moved ${movedItem?.name || `Sachet ${fromIdx + 1}`} to pouch slot ${toIdx + 1} of 4.`;
    setAnnouncement(msg);
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDraggedIndex(idx);
    e.dataTransfer.setData("text/plain", String(idx));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  }

  function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const sourceIdx = draggedIndex ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      handleMove(sourceIdx, targetIdx);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleKeyboardGrab(e: React.KeyboardEvent, idx: number) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (activeGrabbedIndex === idx) {
        setActiveGrabbedIndex(null);
        setAnnouncement(`Dropped ${components[idx]?.name || "sachet"} at slot ${idx + 1}.`);
      } else {
        setActiveGrabbedIndex(idx);
        setAnnouncement(
          `Grabbed ${components[idx]?.name || "sachet"}. Use Arrow Up and Arrow Down to reorder, Space to drop.`
        );
      }
    } else if (activeGrabbedIndex === idx) {
      if (e.key === "ArrowDown" && idx < components.length - 1) {
        e.preventDefault();
        handleMove(idx, idx + 1);
        setActiveGrabbedIndex(idx + 1);
      } else if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        handleMove(idx, idx - 1);
        setActiveGrabbedIndex(idx - 1);
      }
    }
  }

  return (
    <div className="trial-tab-pouches-root" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Screen Reader ARIA Live Region */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          border: 0,
        }}
      >
        {announcement}
      </div>

      {/* Top Controls & 4x50g Balance Counter Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
            4×50g Sachet Composer
          </h3>
          <span style={{ fontSize: 12, color: "#6a6e64" }}>
            Assemble and sequence the 4 distinct teas in the tasting flight. Drag or use keyboard handles to reorder.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Real-time Kit Weight Indicator */}
          <div
            className="kit-weight-indicator"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              border: weightValidation.isValid ? "1px solid #a5d6a7" : "1px solid #f8b4b4",
              background: weightValidation.isValid ? "#e8f5e9" : "#fdf2f2",
              color: weightValidation.isValid ? "#1b5e20" : "#9b1c1c",
            }}
          >
            <Scale size={16} />
            {weightValidation.isValid ? (
              <span>Balanced (200g)</span>
            ) : (
              <span>{weightValidation.error}</span>
            )}
          </div>

          {/* Atomic Save Button */}
          <button
            type="button"
            data-testid="save-components-btn"
            onClick={() => void onSave()}
            disabled={saving || !weightValidation.isValid}
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: weightValidation.isValid ? "#23483a" : "#8a948e",
              color: "#ffffff",
              borderRadius: 6,
              border: "none",
              cursor: saving || !weightValidation.isValid ? "not-allowed" : "pointer",
            }}
          >
            <Save size={15} />
            <span>{saving ? "Saving Components…" : "Save Pouches Order"}</span>
          </button>
        </div>
      </div>

      {/* Invariant Error Banner if invalid */}
      {!weightValidation.isValid && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            background: "#fdf2f2",
            border: "1px solid #f8b4b4",
            borderRadius: 6,
            color: "#9b1c1c",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
          }}
        >
          <AlertTriangle size={18} />
          <span>
            {weightValidation.error}: Each discovery kit must contain exactly 4 sachets of 50g each (total 200g).
          </span>
        </div>
      )}

      {/* 4 Pouch Slot Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {components.map((comp, idx) => {
          const isGrabbed = activeGrabbedIndex === idx;
          const isDragging = draggedIndex === idx;
          const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

          return (
            <div
              key={comp.id || `slot_${idx}`}
              data-testid="sachet-slot"
              className="sachet-slot-card"
              draggable={true}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              style={{
                background: "#ffffff",
                borderRadius: 8,
                border: isGrabbed
                  ? "2px solid #b8753d"
                  : isDragOver
                  ? "2px dashed #23483a"
                  : "1px solid #d9d4c8",
                boxShadow: isGrabbed
                  ? "0 4px 12px rgba(184, 117, 61, 0.2)"
                  : "0 1px 3px rgba(0,0,0,0.04)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: isDragging ? 0.4 : 1,
                transition: "border-color 150ms ease, box-shadow 150ms ease",
              }}
            >
              {/* Drag handle & Slot badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  data-testid="sachet-drag-handle"
                  tabIndex={0}
                  role="button"
                  aria-label={`Reorder sachet ${idx + 1}. Press Space to grab, Arrow Up or Down to move, Space to drop.`}
                  onKeyDown={(e) => handleKeyboardGrab(e, idx)}
                  style={{
                    background: isGrabbed ? "#b8753d" : "transparent",
                    color: isGrabbed ? "#ffffff" : "#6a6e64",
                    border: isGrabbed ? "1px solid #b8753d" : "1px solid #d9d4c8",
                    borderRadius: 4,
                    padding: "6px 4px",
                    cursor: "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Drag or press Space to reorder"
                >
                  <GripVertical size={18} />
                </button>

                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#23483a",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {idx + 1}
                </div>
              </div>

              {/* Editable Pouch Information Fields */}
              <div
                style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                {/* Tea Name */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64", marginBottom: 3 }}>
                    Tea Name
                  </label>
                  <input
                    type="text"
                    name="component_name"
                    value={comp.name || ""}
                    placeholder="e.g. Wonder Muscatel"
                    onChange={(e) => handleFieldChange(idx, { name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Estate */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64", marginBottom: 3 }}>
                    Estate
                  </label>
                  <input
                    type="text"
                    name="component_estate"
                    value={comp.estate || ""}
                    placeholder="e.g. Gopaldhara Estate"
                    onChange={(e) => handleFieldChange(idx, { estate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Grade */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64", marginBottom: 3 }}>
                    Grade
                  </label>
                  <input
                    type="text"
                    name="component_grade"
                    value={comp.grade || ""}
                    placeholder="FTGFOP1"
                    onChange={(e) => handleFieldChange(idx, { grade: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Flush */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64", marginBottom: 3 }}>
                    Flush
                  </label>
                  <input
                    type="text"
                    name="component_flush"
                    value={comp.flush || ""}
                    placeholder="Second Flush"
                    onChange={(e) => handleFieldChange(idx, { flush: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Weight (grams) */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64", marginBottom: 3 }}>
                    Weight (g)
                  </label>
                  <input
                    type="number"
                    name="component_weight"
                    value={comp.weight_g ?? 50}
                    onChange={(e) => handleFieldChange(idx, { weight_g: Number(e.target.value) || 0 })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: Number(comp.weight_g) !== 50 ? "#8f2f2a" : "#1d2a24",
                      borderRadius: 4,
                      border: Number(comp.weight_g) !== 50 ? "1px solid #8f2f2a" : "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Accessible Reorder Buttons */}
              <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                <button
                  type="button"
                  data-testid="sachet-move-up"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, idx - 1)}
                  title={`Move ${comp.name || `Sachet ${idx + 1}`} up`}
                  aria-label={`Move sachet ${idx + 1} up`}
                  style={{
                    padding: "6px 8px",
                    background: "#f6f1e7",
                    border: "1px solid #d9d4c8",
                    borderRadius: 4,
                    cursor: idx === 0 ? "not-allowed" : "pointer",
                    opacity: idx === 0 ? 0.4 : 1,
                    color: "#1d2a24",
                  }}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  data-testid="sachet-move-down"
                  disabled={idx === components.length - 1}
                  onClick={() => handleMove(idx, idx + 1)}
                  title={`Move ${comp.name || `Sachet ${idx + 1}`} down`}
                  aria-label={`Move sachet ${idx + 1} down`}
                  style={{
                    padding: "6px 8px",
                    background: "#f6f1e7",
                    border: "1px solid #d9d4c8",
                    borderRadius: 4,
                    cursor: idx === components.length - 1 ? "not-allowed" : "pointer",
                    opacity: idx === components.length - 1 ? 0.4 : 1,
                    color: "#1d2a24",
                  }}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
