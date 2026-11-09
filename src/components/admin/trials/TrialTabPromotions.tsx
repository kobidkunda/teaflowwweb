"use client";

import React from "react";
import {
  Tag,
  Percent,
  FileCheck2,
  AlertCircle,
  TrendingUp,
  Link as LinkIcon,
  Plus,
  Trash2,
} from "lucide-react";
import type { TrialWithDetails, TrialBulkLink, TrialClaim } from "@/lib/trials/types";

export interface TrialTabPromotionsProps {
  trial: TrialWithDetails;
  onChangeBulkLinks: (links: TrialBulkLink[]) => void;
  onChangeClaims: (claims: TrialClaim[]) => void;
  saving: boolean;
}

export function TrialTabPromotions({
  trial,
  onChangeBulkLinks,
  onChangeClaims,
  saving,
}: TrialTabPromotionsProps) {
  const bulkLinks = trial.bulk_links || [];
  const claims = trial.claims || [];

  function handleAddBulkLink() {
    const newLink: TrialBulkLink = {
      id: `bl_temp_${Date.now()}`,
      trial_id: trial.id,
      component_id: trial.components?.[0]?.id || null,
      product_id: null,
      variant_id: null,
      pack_size_grams: 250,
      display_label: "250g Full Estate Pack",
      discount_percent: 15,
      subscriber_eligible: 1,
      sort_order: bulkLinks.length,
      product_slug: null,
      variant_title: null,
    };
    onChangeBulkLinks([...bulkLinks, newLink]);
  }

  function handleUpdateBulkLink(idx: number, patch: Partial<TrialBulkLink>) {
    const updated = bulkLinks.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChangeBulkLinks(updated);
  }

  function handleRemoveBulkLink(idx: number) {
    onChangeBulkLinks(bulkLinks.filter((_, i) => i !== idx));
  }

  function handleAddClaim() {
    const newClaim: TrialClaim = {
      id: `claim_temp_${Date.now()}`,
      trial_id: trial.id,
      claim_type: "origin",
      label: "Single Estate Provenance",
      claim_text: "100% Darjeeling orthodox loose leaf from verified garden invoice",
      basis: "Invoice & Tea Board of India Registration",
      evidence_ref: "REF-TB-DARJ-2026-01",
      verified: 1,
      approved_by: "Lead Cupper",
      approved_at: new Date().toISOString(),
      expires_at: null,
      sort_order: claims.length,
    };
    onChangeClaims([...claims, newClaim]);
  }

  function handleUpdateClaim(idx: number, patch: Partial<TrialClaim>) {
    const updated = claims.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChangeClaims(updated);
  }

  function handleRemoveClaim(idx: number) {
    onChangeClaims(claims.filter((_, i) => i !== idx));
  }

  return (
    <div
      className="trial-tab-promotions-root bulk-editor"
      data-testid="bulk-ladder-editor"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* Bulk Conversion Ladder Editor */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
              Bulk Conversion Ladder &amp; Voucher Incentives
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
              Connect trial sachets to regular catalogue 250g / 500g pouches with progressive conversion discounts.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddBulkLink}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              fontSize: 13,
            }}
          >
            <Plus size={14} />
            <span>Add Conversion Tier</span>
          </button>
        </div>

        {bulkLinks.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              background: "#fbf8f1",
              borderRadius: 6,
              border: "1px dashed #c9c2b6",
              color: "#6a6e64",
            }}
          >
            <Tag size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No bulk conversion tiers configured</p>
            <small>Customers will not see direct upsell incentives after sampling.</small>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bulkLinks.map((link, idx) => (
              <div
                key={link.id || idx}
                style={{
                  padding: 14,
                  background: "#fbf8f1",
                  borderRadius: 6,
                  border: "1px solid #d9d4c8",
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Display Label
                  </label>
                  <input
                    type="text"
                    value={link.display_label}
                    onChange={(e) => handleUpdateBulkLink(idx, { display_label: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Pack Size (grams)
                  </label>
                  <input
                    type="number"
                    value={link.pack_size_grams}
                    onChange={(e) =>
                      handleUpdateBulkLink(idx, { pack_size_grams: Number(e.target.value) || 250 })
                    }
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Discount %
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={link.discount_percent}
                      onChange={(e) =>
                        handleUpdateBulkLink(idx, { discount_percent: Number(e.target.value) || 0 })
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #c9c2b6",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Linked Pouch
                  </label>
                  <select
                    value={link.component_id || ""}
                    onChange={(e) => handleUpdateBulkLink(idx, { component_id: e.target.value || null })}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Whole Kit / All Teas</option>
                    {(trial.components || []).map((comp, cIdx) => (
                      <option key={comp.id || cIdx} value={comp.id}>
                        #{cIdx + 1}: {comp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveBulkLink(idx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8f2f2a",
                    cursor: "pointer",
                    padding: 6,
                  }}
                  title="Remove tier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Regulatory & Provenance Claims Editor */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>
              Regulatory &amp; Provenance Claims
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#555850" }}>
              All marketing or terroir claims require an authentic documentary evidence reference to clear the launch gate.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddClaim}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              fontSize: 13,
            }}
          >
            <Plus size={14} />
            <span>Add Verified Claim</span>
          </button>
        </div>

        {claims.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "#fbf8f1",
              borderRadius: 6,
              border: "1px dashed #c9c2b6",
              color: "#6a6e64",
            }}
          >
            <FileCheck2 size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No claims registered</p>
            <small>At least one verified provenance or FSSAI registration claim is recommended.</small>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {claims.map((claim, idx) => (
              <div
                key={claim.id || idx}
                style={{
                  padding: 14,
                  background: "#fbf8f1",
                  borderRadius: 6,
                  border: "1px solid #d9d4c8",
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr 1.5fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Claim Label
                  </label>
                  <input
                    type="text"
                    value={claim.label}
                    onChange={(e) => handleUpdateClaim(idx, { label: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Claim Copy
                  </label>
                  <input
                    type="text"
                    value={claim.claim_text}
                    onChange={(e) => handleUpdateClaim(idx, { claim_text: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #c9c2b6",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a6e64" }}>
                    Evidence Reference (Mandatory)
                  </label>
                  <input
                    type="text"
                    value={claim.evidence_ref || ""}
                    placeholder="e.g. LAB-REPORT-2026-04"
                    onChange={(e) => handleUpdateClaim(idx, { evidence_ref: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: claim.evidence_ref ? "1px solid #c9c2b6" : "1px solid #8f2f2a",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveClaim(idx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8f2f2a",
                    cursor: "pointer",
                    padding: 6,
                  }}
                  title="Remove claim"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
