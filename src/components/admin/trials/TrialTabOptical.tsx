"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  Plus,
  Thermometer,
  Clock,
  Coffee,
  Check,
} from "lucide-react";
import type { TrialWithDetails, TrialAsset, AssetStage, OpticalStage } from "@/lib/trials/types";
import { MediaPicker } from "@/components/admin/catalog/MediaPicker";

export interface TrialTabOpticalProps {
  trial: TrialWithDetails;
  onAttachAsset: (asset: {
    stage: AssetStage;
    asset_url: string;
    alt_text: string;
    slot_index: number | null;
    component_id?: string | null;
    media_id?: number | null;
  }) => Promise<void>;
  onDetachAsset: (assetId: string) => Promise<void>;
  onUpdateComponentBrewing: (
    slotIndex: number,
    brewing: { brew_temp_c: number; brew_time_sec: number; leaf_dose_g: number; tasting_notes?: string }
  ) => void;
  saving: boolean;
}

const OPTICAL_STAGES: Array<{ id: OpticalStage; label: string; desc: string }> = [
  { id: "packaging", label: "Packaging Foil", desc: "Front pouch packaging artwork and seal" },
  { id: "dry_leaf", label: "Dry Orthodox Leaf", desc: "Whole-leaf dry appearance and silver tips" },
  { id: "infused_leaf", label: "Infused / Wet Leaf", desc: "Aroma-saturated liquor leaves post-brew" },
  { id: "liquor", label: "Pure Liquor Clarity", desc: "Extracted tea in white porcelain tasting cup" },
  { id: "milk_tea", label: "Milk Infusion", desc: "Colour and extraction under milk testing" },
];

export function TrialTabOptical({
  trial,
  onAttachAsset,
  onDetachAsset,
  onUpdateComponentBrewing,
  saving,
}: TrialTabOpticalProps) {
  const [selectedPouchIdx, setSelectedPouchIdx] = useState<number>(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeStageForPicker, setActiveStageForPicker] = useState<AssetStage>("packaging");
  const [manualAltText, setManualAltText] = useState<string>("");
  const [altError, setAltError] = useState<string | null>(null);

  const selectedComponent = trial.components?.[selectedPouchIdx];

  // Filter assets for this selected pouch
  const pouchAssets = (trial.assets || []).filter(
    (a) =>
      (a.slot_index !== null && a.slot_index !== undefined && Number(a.slot_index) === selectedPouchIdx) ||
      Boolean(a.component_id && selectedComponent?.id && a.component_id === selectedComponent.id)
  );

  function openMediaPickerForStage(stage: AssetStage) {
    setActiveStageForPicker(stage);
    setManualAltText("");
    setAltError(null);
    setPickerOpen(true);
  }

  async function handleMediaSelected(mediaAsset: { url: string; alt_text?: string; filename?: string; id?: number }) {
    const stageInfo = OPTICAL_STAGES.find((s) => s.id === activeStageForPicker);
    const compName = selectedComponent?.name || `Pouch ${selectedPouchIdx + 1}`;
    const autoFallbackAlt = `${trial.title || "Tea"} — ${compName} (${stageInfo?.label || activeStageForPicker})`;

    const candidateAlt = manualAltText.trim() || mediaAsset.alt_text?.trim() || mediaAsset.filename?.trim() || autoFallbackAlt;
    const finalAlt = candidateAlt.length >= 2 ? candidateAlt : autoFallbackAlt;

    try {
      await onAttachAsset({
        stage: activeStageForPicker,
        asset_url: mediaAsset.url,
        alt_text: finalAlt,
        slot_index: selectedPouchIdx,
        component_id: selectedComponent?.id ?? null,
        media_id: mediaAsset.id ?? null,
      });
      setPickerOpen(false);
      setAltError(null);
    } catch (err) {
      setAltError(err instanceof Error ? err.message : "Failed to attach photography asset.");
    }
  }

  return (
    <div
      className="trial-tab-optical-root stage-uploader"
      data-testid="media-stage-uploader"
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Top Header */}
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
            Optical Proofs &amp; Brewing Parameters
          </h3>
          <span style={{ fontSize: 12, color: "#6a6e64" }}>
            5 standard photography stages per sachet and verified kettle brewing guidance.
          </span>
        </div>

        {/* 4 Pouch Selection Tabs */}
        <div role="tablist" style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3].map((slotIdx) => {
            const comp = trial.components?.[slotIdx];
            const active = selectedPouchIdx === slotIdx;
            return (
              <button
                key={slotIdx}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedPouchIdx(slotIdx)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  borderRadius: 6,
                  border: active ? "1px solid #23483a" : "1px solid #d9d4c8",
                  background: active ? "#23483a" : "#ffffff",
                  color: active ? "#ffffff" : "#444840",
                  cursor: "pointer",
                }}
              >
                Pouch #{slotIdx + 1}
                {comp?.name ? `: ${comp.name.slice(0, 14)}` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {altError && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            background: "#fdf2f2",
            border: "1px solid #f8b4b4",
            borderRadius: 8,
            color: "#9b1c1c",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{altError}</span>
        </div>
      )}

      {/* Brewing Parameters Card */}
      {selectedComponent && (
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid #d9d4c8",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#1d2a24", marginBottom: 4 }}>
              <Coffee size={14} color="#b8753d" />
              <span>Leaf Dose (grams)</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={selectedComponent.leaf_dose_g ?? 2.5}
              onChange={(e) =>
                onUpdateComponentBrewing(selectedPouchIdx, {
                  brew_temp_c: selectedComponent.brew_temp_c,
                  brew_time_sec: selectedComponent.brew_time_sec,
                  leaf_dose_g: Number(e.target.value) || 2.5,
                })
              }
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

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#1d2a24", marginBottom: 4 }}>
              <Thermometer size={14} color="#b8753d" />
              <span>Water Temp (°C)</span>
            </label>
            <input
              type="number"
              value={selectedComponent.brew_temp_c ?? 90}
              onChange={(e) =>
                onUpdateComponentBrewing(selectedPouchIdx, {
                  brew_temp_c: Number(e.target.value) || 90,
                  brew_time_sec: selectedComponent.brew_time_sec,
                  leaf_dose_g: selectedComponent.leaf_dose_g,
                })
              }
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

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#1d2a24", marginBottom: 4 }}>
              <Clock size={14} color="#b8753d" />
              <span>Infusion Time (seconds)</span>
            </label>
            <input
              type="number"
              value={selectedComponent.brew_time_sec ?? 180}
              onChange={(e) =>
                onUpdateComponentBrewing(selectedPouchIdx, {
                  brew_temp_c: selectedComponent.brew_temp_c,
                  brew_time_sec: Number(e.target.value) || 180,
                  leaf_dose_g: selectedComponent.leaf_dose_g,
                })
              }
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
        </div>
      )}

      {/* 5 Optical Photography Stages Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {OPTICAL_STAGES.map((stage) => {
          const attachedAsset = pouchAssets.find((a) => a.stage === stage.id);

          return (
            <div
              key={stage.id}
              style={{
                background: "#ffffff",
                borderRadius: 8,
                border: attachedAsset ? "1px solid #a5d6a7" : "1px solid #d9d4c8",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "10px 14px",
                  background: attachedAsset ? "#e8f5e9" : "#fbf8f1",
                  borderBottom: "1px solid #ede9df",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>
                    {stage.label}
                  </h4>
                  <span style={{ fontSize: 11, color: "#6a6e64" }}>{stage.desc}</span>
                </div>
                {attachedAsset && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#1b5e20",
                    }}
                  >
                    <Check size={12} />
                    Attached
                  </span>
                )}
              </div>

              {/* Image Preview / Empty Box */}
              <div
                style={{
                  height: 180,
                  background: "#ede9df",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {attachedAsset ? (
                  <Image
                    src={attachedAsset.asset_url}
                    alt={attachedAsset.alt_text}
                    fill
                    sizes="280px"
                    style={{ objectFit: "cover" }}
                    unoptimized
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#7e786b", padding: 12 }}>
                    <Camera size={32} style={{ opacity: 0.4, marginBottom: 4 }} />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>No Photo Attached</div>
                    <small style={{ fontSize: 11 }}>Required for publication verification</small>
                  </div>
                )}
              </div>

              {/* Alt Text & Controls */}
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {attachedAsset ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6a6e64" }}>Alt Text:</div>
                    <div style={{ fontSize: 12, color: "#1d2a24", fontStyle: "italic", marginTop: 2 }}>
                      &ldquo;{attachedAsset.alt_text}&rdquo;
                    </div>
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => void onDetachAsset(attachedAsset.id)}
                        disabled={saving}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#8f2f2a",
                          fontSize: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Detach Asset</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      type="button"
                      data-testid="media-picker-trigger"
                      onClick={() => openMediaPickerForStage(stage.id)}
                      className="button button-outline"
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                      }}
                    >
                      <ImageIcon size={14} />
                      <span>Select from Media Library</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Media Picker Dialog Modal */}
      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Select Photography Asset for Pouch #${selectedPouchIdx + 1} (${activeStageForPicker})`}
        onSelect={(asset) => void handleMediaSelected(asset)}
      />
    </div>
  );
}
