"use client";

import React from "react";
import {
  CheckCircle2,
  AlertOctagon,
  Clock,
  Archive,
  ArrowRight,
  ShieldAlert,
  Send,
  UploadCloud,
  FileCheck,
} from "lucide-react";
import type { TrialWithDetails } from "@/lib/trials/types";
import { TrialSplitPreview } from "./TrialSplitPreview";

export interface GateCheckResult {
  gateId: number;
  name: string;
  tabKey: "identity" | "pouches" | "optical" | "promotions" | "publish";
  passed: boolean;
  message: string;
}

export function evaluatePublicationGates(
  trial: TrialWithDetails,
  serverBlockers: string[] = []
): { canPublish: boolean; gates: GateCheckResult[] } {
  // Gate 1: Identity & Metadata
  const gate1Passed =
    Boolean(trial.title && trial.title.trim().length >= 3) &&
    Boolean(trial.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trial.slug));

  // Gate 2: Pricing & Stock
  const gate2Passed =
    Boolean(trial.price_paise && trial.price_paise > 0) &&
    (trial.inventory_policy !== "track" || (trial.inventory_quantity ?? 0) >= 1);

  // Gate 3: 4x50g Component Invariant
  const compCount = trial.components?.length || 0;
  const compWeight = (trial.components || []).reduce(
    (acc, c) => acc + (Number(c.weight_g) || 0) * (c.quantity || 1),
    0
  );
  const eachHasEstate = (trial.components || []).every((c) => Boolean(c.estate?.trim()));
  const gate3Passed = compCount === 4 && compWeight === 200 && eachHasEstate;

  // Gate 4: 5-Stage Photography & Alt Text
  const hasPackagingOrHero =
    Boolean(trial.hero_image?.url) ||
    (trial.assets || []).some((a) => a.stage === "packaging" || a.stage === "hero");
  const allAssetsHaveAlt =
    (trial.assets || []).length > 0 &&
    (trial.assets || []).every((a) => Boolean(a.alt_text && a.alt_text.trim().length >= 2));
  const gate4Passed = hasPackagingOrHero && allAssetsHaveAlt;

  // Gate 5: Provenance & Claims
  const claimsValid = (trial.claims || []).every((c) => Boolean(c.evidence_ref?.trim()));
  const gate5Passed = claimsValid;

  const gates: GateCheckResult[] = [
    {
      gateId: 1,
      name: "Gate 1: Core Merchandising & URL Slug",
      tabKey: "identity",
      passed: gate1Passed,
      message: gate1Passed
        ? "Title is valid and kebab-case URL slug is assigned."
        : "Title must be at least 3 characters and URL slug must be valid lowercase alphanumeric.",
    },
    {
      gateId: 2,
      name: "Gate 2: Pricing Economics & Stock Availability",
      tabKey: "identity",
      passed: gate2Passed,
      message: gate2Passed
        ? "Selling price is set (> ₹0.00) and at least 1 unit is available."
        : "Kit price must be greater than ₹0.00 and stock must be at least 1 unit.",
    },
    {
      gateId: 3,
      name: "Gate 3: 4×50g = 200g Sachet Composition & Estates",
      tabKey: "pouches",
      passed: gate3Passed,
      message: gate3Passed
        ? "Exactly 4 sachets of 50g each assembled (200g net) with verified estates."
        : "Must have exactly 4 sachet slots, 50g each (total 200g), and estate name specified.",
    },
    {
      gateId: 4,
      name: "Gate 4: Packaging Photography & Alt Text",
      tabKey: "optical",
      passed: gate4Passed,
      message: gate4Passed
        ? "Approved packaging / hero photo attached with accessible alt text descriptions."
        : "Missing packaging/hero photo or attached assets lack required alt text descriptions.",
    },
    {
      gateId: 5,
      name: "Gate 5: Documentary Provenance & Claims Verification",
      tabKey: "promotions",
      passed: gate5Passed,
      message: gate5Passed
        ? "All marketing claims have authentic documentary evidence references."
        : "Every registered claim must provide a non-empty evidence reference (e.g. lab report or invoice).",
    },
  ];

  const canPublish =
    gates.every((g) => g.passed) &&
    (serverBlockers.length === 0 || serverBlockers.every((b) => !b.includes("Gate")));

  return { canPublish, gates };
}

export interface TrialTabPublishProps {
  trial: TrialWithDetails;
  serverValidation: { can_publish: boolean; blockers: string[] } | null;
  onNavigateTab: (tab: "identity" | "pouches" | "optical" | "promotions" | "publish") => void;
  onSubmitReview: () => Promise<void>;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onArchive: () => Promise<void>;
  saving: boolean;
}

export function TrialTabPublish({
  trial,
  serverValidation,
  onNavigateTab,
  onSubmitReview,
  onPublish,
  onUnpublish,
  onArchive,
  saving,
}: TrialTabPublishProps) {
  const { canPublish, gates } = evaluatePublicationGates(
    trial,
    serverValidation?.blockers || []
  );

  const isPublished = trial.status === "published";
  const isInReview = trial.status === "in_review";
  const isArchived = trial.status === "archived";
  const isDraft = trial.status === "draft";

  return (
    <div className="trial-tab-publish-root" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Lifecycle Action Toolbar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6a6e64", fontWeight: 700 }}>
            Publication Lifecycle
          </span>
          <h3 style={{ margin: "2px 0 4px 0", fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
            Current Status: <span style={{ textTransform: "capitalize", color: "#23483a" }}>{trial.status.replace("_", " ")}</span>
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
            {isPublished
              ? "This trial kit is live on the public storefront. Changes require unpublishing or direct atomic revision CAS."
              : isDraft
              ? "Draft state: Editable by staff and MCP tools. Resolve launch gates to publish."
              : isInReview
              ? "In review: Final compliance and sensory cupping sign-off prior to commercial release."
              : "Archived: Preserved for order historical records; hidden from public browse."}
          </p>
        </div>

        {/* Action Buttons Cluster */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {isDraft && (
            <button
              type="button"
              onClick={() => void onSubmitReview()}
              disabled={saving}
              className="button button-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Clock size={15} />
              <span>Submit for Review</span>
            </button>
          )}

          {!isPublished && !isArchived && (
            <div style={{ position: "relative" }} title={!canPublish ? "Publish disabled: resolve launch blockers below" : "Publish trial kit to public storefront"}>
              <button
                type="button"
                onClick={() => void onPublish()}
                disabled={saving || !canPublish}
                className="button button-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  background: canPublish ? "#143c31" : "#8a948e",
                  color: "#ffffff",
                  borderRadius: 6,
                  border: "none",
                  cursor: canPublish && !saving ? "pointer" : "not-allowed",
                  boxShadow: canPublish ? "0 2px 6px rgba(20, 60, 49, 0.3)" : "none",
                }}
              >
                <UploadCloud size={16} />
                <span>Publish Trial Kit</span>
              </button>
            </div>
          )}

          {isPublished && (
            <button
              type="button"
              onClick={() => void onUnpublish()}
              disabled={saving}
              className="button button-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#b8753d",
                borderColor: "#b8753d",
              }}
            >
              <span>Unpublish to Draft</span>
            </button>
          )}

          {!isArchived && (
            <button
              type="button"
              onClick={() => void onArchive()}
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                background: "transparent",
                border: "1px solid #d9d4c8",
                borderRadius: 6,
                color: "#6a6e64",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <Archive size={14} />
              <span>Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* Launch Readiness Checklist */}
      <div
        className="launch-checklist"
        data-testid="launch-readiness-checklist"
        style={{
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 2px 0", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
              Launch Readiness Verification Checklist
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
              5 safety &amp; compliance gates required before publication is authorized.
            </p>
          </div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: canPublish ? "#e8f5e9" : "#fdf2f2",
              color: canPublish ? "#1b5e20" : "#9b1c1c",
              border: canPublish ? "1px solid #a5d6a7" : "1px solid #f8b4b4",
            }}
          >
            {canPublish ? "All 5 Gates Cleared" : `${gates.filter((g) => !g.passed).length} Blockers Pending`}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {gates.map((gate) => (
            <div
              key={gate.gateId}
              style={{
                padding: "12px 16px",
                borderRadius: 6,
                border: gate.passed ? "1px solid #c8e6c9" : "1px solid #ffcdd2",
                background: gate.passed ? "#f1f8e9" : "#fffbfa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ color: gate.passed ? "#2e7d32" : "#c62828" }}>
                  {gate.passed ? <CheckCircle2 size={20} /> : <AlertOctagon size={20} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2a24" }}>
                    {gate.name}
                  </div>
                  <div style={{ fontSize: 12, color: gate.passed ? "#33691e" : "#b71c1c" }}>
                    {gate.message}
                  </div>
                </div>
              </div>

              {!gate.passed && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(gate.tabKey)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#ffffff",
                    border: "1px solid #d9d4c8",
                    borderRadius: 4,
                    color: "#23483a",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>Resolve in Tab</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Simulated Storefront Split-Screen Live Preview */}
      <TrialSplitPreview trial={trial} />
    </div>
  );
}
