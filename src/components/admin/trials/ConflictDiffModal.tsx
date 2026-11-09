"use client";

import React from "react";
import { AlertTriangle, RefreshCw, CheckCircle2, X } from "lucide-react";
import type { TrialWithDetails } from "@/lib/trials/types";

export interface ConflictingField {
  key: string;
  label: string;
  localVal: string | number | null | undefined;
  serverVal: string | number | null | undefined;
}

export function computeFieldDiffs(
  local: Partial<TrialWithDetails>,
  server: Partial<TrialWithDetails>
): ConflictingField[] {
  const fieldsToCheck: Array<{ key: keyof TrialWithDetails; label: string }> = [
    { key: "title", label: "Title" },
    { key: "slug", label: "Slug" },
    { key: "price_paise", label: "Price (Paise)" },
    { key: "compare_at_price_paise", label: "Compare-at Price (Paise)" },
    { key: "cost_paise", label: "Cost (Paise)" },
    { key: "sku", label: "SKU" },
    { key: "status", label: "Status" },
    { key: "inventory_quantity", label: "Inventory Quantity" },
    { key: "inventory_policy", label: "Inventory Policy" },
    { key: "tagline", label: "Tagline" },
    { key: "description", label: "Description" },
    { key: "meta_title", label: "SEO Meta Title" },
    { key: "meta_description", label: "SEO Meta Description" },
  ];

  const diffs: ConflictingField[] = [];

  for (const { key, label } of fieldsToCheck) {
    const lVal = local[key];
    const sVal = server[key];
    // Compare primitive or null equality
    if (String(lVal ?? "") !== String(sVal ?? "")) {
      diffs.push({
        key: String(key),
        label,
        localVal: (typeof lVal === "string" || typeof lVal === "number" || lVal === null || lVal === undefined) ? lVal : String(lVal),
        serverVal: (typeof sVal === "string" || typeof sVal === "number" || sVal === null || sVal === undefined) ? sVal : String(sVal),
      });
    }
  }

  return diffs;
}

export interface ConflictDiffModalProps {
  isOpen: boolean;
  localTrial: TrialWithDetails;
  serverTrial: TrialWithDetails;
  onKeepLocal: () => void;
  onAcceptServer: () => void;
  onClose: () => void;
}

export function ConflictDiffModal({
  isOpen,
  localTrial,
  serverTrial,
  onKeepLocal,
  onAcceptServer,
  onClose,
}: ConflictDiffModalProps) {
  if (!isOpen) return null;

  const diffs = computeFieldDiffs(localTrial, serverTrial);

  return (
    <div
      className="conflict-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        data-testid="conflict-diff-modal"
        className="conflict-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
        style={{
          background: "#ffffff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f2c7c5",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            background: "#fdf2f2",
            borderBottom: "1px solid #f8b4b4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#fde8e8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9b1c1c",
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3
                id="conflict-dialog-title"
                style={{ margin: 0, fontSize: 18, color: "#9b1c1c", fontWeight: 700 }}
              >
                Revision Conflict Detected (HTTP 409)
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#771d1d" }}>
                Another team member or automated MCP session modified this trial while you were editing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conflict modal"
            style={{
              background: "transparent",
              border: "none",
              color: "#771d1d",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "#fbf8f1",
              borderRadius: 6,
              border: "1px solid #e0dbce",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <div>
              <strong>Your Working Draft:</strong> Rev #{localTrial.revision} (Unsaved edits)
            </div>
            <div>
              <strong>Current Server State:</strong> Rev #{serverTrial.revision} (Authoritative)
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#444840", margin: "0 0 12px 0" }}>
            Review the differences between your local changes and the latest server version below:
          </p>

          {diffs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#6a6e64" }}>
              <p>No direct top-level field differences found. Component or asset lists may have been updated.</p>
            </div>
          ) : (
            <table
              className="admin-table conflict-diff-table"
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: "25%" }}>Field</th>
                  <th style={{ textAlign: "left", width: "37.5%", background: "#eff6ff", color: "#1e40af" }}>
                    Your Local Changes
                  </th>
                  <th style={{ textAlign: "left", width: "37.5%", background: "#fffbeb", color: "#92400e" }}>
                    Current Server Version (Rev #{serverTrial.revision})
                  </th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((diff) => (
                  <tr key={diff.key}>
                    <td style={{ fontWeight: 600, color: "#1d2a24" }}>{diff.label}</td>
                    <td
                      style={{
                        background: "#f8fafc",
                        color: "#1e3a8a",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {String(diff.localVal ?? "—")}
                    </td>
                    <td
                      style={{
                        background: "#fffdf5",
                        color: "#78350f",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {String(diff.serverVal ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Action Footer */}
        <div
          style={{
            padding: "16px 24px",
            background: "#f7f5ed",
            borderTop: "1px solid #e2ddd2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#6a6e64" }}>
            Choose whether to overwrite the server version with your changes or discard local edits.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={onAcceptServer}
              className="button button-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#92400e",
                borderColor: "#f59e0b",
              }}
            >
              <RefreshCw size={14} />
              <span>Discard &amp; Accept Server</span>
            </button>

            <button
              type="button"
              onClick={onKeepLocal}
              className="button button-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                background: "#23483a",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
              }}
            >
              <CheckCircle2 size={14} />
              <span>Keep Local (Overwrite)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
