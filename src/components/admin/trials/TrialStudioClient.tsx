"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  ArrowLeft,
  Layers,
  Sparkles,
  Camera,
  Tag,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type {
  TrialWithDetails,
  TrialComponent,
  TrialAsset,
  TrialBulkLink,
  TrialClaim,
  AssetStage,
} from "@/lib/trials/types";
import { TrialTabIdentity } from "./TrialTabIdentity";
import { TrialTabPouches } from "./TrialTabPouches";
import { TrialTabOptical } from "./TrialTabOptical";
import { TrialTabPromotions } from "./TrialTabPromotions";
import { TrialTabPublish } from "./TrialTabPublish";
import { ConflictDiffModal } from "./ConflictDiffModal";

export type StudioTabKey = "identity" | "pouches" | "optical" | "promotions" | "publish";

export interface TrialStudioClientProps {
  trialId: string;
  initialTrial?: TrialWithDetails;
}

export function TrialStudioClient({ trialId, initialTrial }: TrialStudioClientProps) {
  const [trial, setTrial] = useState<TrialWithDetails | null>(initialTrial || null);
  const [serverTrial, setServerTrial] = useState<TrialWithDetails | null>(initialTrial || null);
  const [activeTab, setActiveTab] = useState<StudioTabKey>("identity");
  const [loading, setLoading] = useState(!initialTrial);
  const [saving, setSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [tabErrors, setTabErrors] = useState<Record<string, Record<string, string>>>({});
  const [serverValidation, setServerValidation] = useState<{ can_publish: boolean; blockers: string[] } | null>(null);

  // 409 Conflict State
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictServerTrial, setConflictServerTrial] = useState<TrialWithDetails | null>(null);

  const fetchTrial = useCallback(async () => {
    setLoading(true);
    setErrorNotice(null);
    try {
      const res = await fetch(`/api/v1/admin/trials/${trialId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to load trial dossier");
      }
      const data = await res.json();
      const loaded: TrialWithDetails = data.trial || data;
      setTrial(loaded);
      setServerTrial(loaded);

      // Also fetch validation checklist
      void fetchValidation();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Error loading trial dossier");
    } finally {
      setLoading(false);
    }
  }, [trialId]);

  const fetchValidation = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/trials/${trialId}/validate`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const val = await res.json();
        setServerValidation(val);
      }
    } catch {
      // Ignore background validation error
    }
  }, [trialId]);

  useEffect(() => {
    if (!initialTrial) {
      void fetchTrial();
    } else {
      void fetchValidation();
    }
  }, [initialTrial, fetchTrial, fetchValidation]);

  // Patch local working trial in memory (preserves uncommitted state across tabs - F16.B1)
  const handlePatchWorkingDraft = useCallback((patch: Partial<TrialWithDetails>) => {
    setTrial((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Generic 409 Conflict Handler
  const handleConflictError = async () => {
    try {
      const freshRes = await fetch(`/api/v1/admin/trials/${trialId}`, {
        credentials: "same-origin",
      });
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        const serverData: TrialWithDetails = freshData.trial || freshData;
        setConflictServerTrial(serverData);
        setConflictOpen(true);
      }
    } catch {
      setErrorNotice("Revision conflict occurred (HTTP 409). Please refresh the page.");
    }
  };

  // Mutating Action 1: Save Identity Metadata (Tab 1)
  const handleSaveIdentity = async () => {
    if (!trial || !serverTrial) return;
    setSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);
    setTabErrors({});

    try {
      const payload = {
        expected_revision: serverTrial.revision,
        title: trial.title,
        slug: trial.slug,
        tagline: trial.tagline,
        description: trial.description,
        price_paise: trial.price_paise,
        compare_at_price_paise: trial.compare_at_price_paise,
        cost_paise: trial.cost_paise,
        sku: trial.sku,
        inventory_quantity: trial.inventory_quantity,
        inventory_policy: trial.inventory_policy,
        meta_title: trial.meta_title,
        meta_description: trial.meta_description,
      };

      const res = await fetch(`/api/v1/admin/trials/${trial.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        await handleConflictError();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 400 && errData?.detail?.fieldErrors) {
          setTabErrors({ identity: errData.detail.fieldErrors });
        }
        throw new Error(errData?.error || "Failed to update trial identity");
      }

      const updated = await res.json();
      const updatedTrial: TrialWithDetails = {
        ...trial,
        ...(updated.trial || updated),
      };
      setTrial(updatedTrial);
      setServerTrial(updatedTrial);
      setSuccessNotice(`Saved changes to "${updatedTrial.title}" (Revision #${updatedTrial.revision}).`);
      void fetchValidation();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Mutating Action 2: Atomic Replace Components (Tab 2)
  const handleSaveComponents = async () => {
    if (!trial || !serverTrial) return;
    setSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const payload = {
        expected_revision: serverTrial.revision,
        components: trial.components.map((c, idx) => ({
          slot_index: idx,
          name: c.name,
          estate: c.estate,
          grade: c.grade,
          flush: c.flush,
          elevation: c.elevation,
          weight_g: c.weight_g,
          quantity: c.quantity || 1,
          tasting_notes: c.tasting_notes,
          brew_temp_c: c.brew_temp_c,
          brew_time_sec: c.brew_time_sec,
          leaf_dose_g: c.leaf_dose_g,
          regular_product_id: c.regular_product_id,
          regular_variant_id: c.regular_variant_id,
        })),
      };

      const res = await fetch(`/api/v1/admin/trials/${trial.id}/components`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        await handleConflictError();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to save components sequence");
      }

      const updated = await res.json();
      const updatedTrial: TrialWithDetails = {
        ...trial,
        ...(updated.trial || updated),
        components: updated.components || trial.components,
      };
      setTrial(updatedTrial);
      setServerTrial(updatedTrial);
      setSuccessNotice(`Components order saved atomically (Revision #${updatedTrial.revision}).`);
      void fetchValidation();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Components update failed");
    } finally {
      setSaving(false);
    }
  };

  // Mutating Action 3: Attach Asset (Tab 3)
  const handleAttachAsset = async (assetInput: {
    stage: AssetStage;
    asset_url: string;
    alt_text: string;
    slot_index: number | null;
    component_id?: string | null;
    media_id?: number | null;
  }) => {
    if (!trial || !serverTrial) return;
    setSaving(true);
    setErrorNotice(null);

    try {
      const payload = {
        expected_revision: serverTrial.revision,
        ...assetInput,
      };

      const res = await fetch(`/api/v1/admin/trials/${trial.id}/assets`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        await handleConflictError();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to attach asset");
      }

      const updated = await res.json();
      const rawAssets = updated.assets || (updated.trial && updated.trial.assets);
      const updatedTrial: TrialWithDetails = {
        ...trial,
        ...(updated.trial || updated),
        assets: rawAssets || [
          ...(trial.assets || []).filter(
            (a) =>
              !(
                ((a.slot_index !== null && a.slot_index !== undefined && Number(a.slot_index) === Number(assetInput.slot_index)) ||
                  Boolean(a.component_id && assetInput.component_id && a.component_id === assetInput.component_id)) &&
                a.stage === assetInput.stage
              )
          ),
          {
            id: (updated.asset && updated.asset.id) || `asset-${Date.now()}`,
            trial_id: trial.id,
            slot_index: assetInput.slot_index,
            component_id: assetInput.component_id || null,
            media_id: assetInput.media_id || null,
            asset_url: assetInput.asset_url,
            stage: assetInput.stage,
            alt_text: assetInput.alt_text,
            rights_status: "approved",
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
      setTrial(updatedTrial);
      setServerTrial(updatedTrial);
      setSuccessNotice("Asset attached successfully.");
      void fetchValidation();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Asset attach failed");
    } finally {
      setSaving(false);
    }
  };

  // Mutating Action 4: Detach Asset (Tab 3)
  const handleDetachAsset = async (assetId: string) => {
    if (!trial || !serverTrial) return;
    setSaving(true);
    setErrorNotice(null);

    try {
      const res = await fetch(`/api/v1/admin/trials/${trial.id}/assets?asset_id=${assetId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: serverTrial.revision }),
      });

      if (res.status === 409) {
        await handleConflictError();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to detach asset");
      }

      const updated = await res.json();
      const rawAssets = updated.assets || (updated.trial && updated.trial.assets) || (trial.assets || []).filter((a) => a.id !== assetId);
      const updatedTrial: TrialWithDetails = {
        ...trial,
        ...(updated.trial || updated),
        assets: rawAssets,
      };
      setTrial(updatedTrial);
      setServerTrial(updatedTrial);
      setSuccessNotice("Asset detached.");
      void fetchValidation();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Asset detach failed");
    } finally {
      setSaving(false);
    }
  };

  // Lifecycle Transitions (Tab 5)
  const handleLifecycleTransition = async (endpoint: string, successMsg: string) => {
    if (!trial || !serverTrial) return;
    setSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const res = await fetch(`/api/v1/admin/trials/${trial.id}/${endpoint}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: serverTrial.revision }),
      });

      if (res.status === 409) {
        await handleConflictError();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Action failed (${endpoint})`);
      }

      const updated = await res.json();
      const updatedTrial: TrialWithDetails = {
        ...trial,
        ...(updated.trial || updated),
      };
      setTrial(updatedTrial);
      setServerTrial(updatedTrial);
      setSuccessNotice(successMsg);
      void fetchValidation();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  // Conflict Resolution Action 1: Keep Local (Overwrite)
  const handleConflictKeepLocal = async () => {
    if (!trial || !conflictServerTrial) return;
    setConflictOpen(false);
    // Align revision baseline with fresh server revision and re-dispatch save
    setServerTrial(conflictServerTrial);
    setTimeout(() => {
      void handleSaveIdentity();
    }, 50);
  };

  // Conflict Resolution Action 2: Discard & Accept Server
  const handleConflictAcceptServer = () => {
    if (!conflictServerTrial) return;
    setTrial(conflictServerTrial);
    setServerTrial(conflictServerTrial);
    setConflictOpen(false);
    setSuccessNotice("Discarded local changes; aligned with latest server version.");
  };

  if (loading && !trial) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6a6e64" }}>
        <RefreshCw size={28} className="spin-icon" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600 }}>Loading Trial Studio…</p>
      </div>
    );
  }

  if (!trial) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ color: "#9b1c1c", fontWeight: 700 }}>Trial kit not found.</p>
        <Link href="/admin/trials" className="button button-outline" style={{ marginTop: 12 }}>
          Return to Trials Listing
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-trial-studio-root" style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Top Breadcrumb & Status Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <Link
            href="/admin/trials"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#23483a",
              textDecoration: "none",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to Trials Listing</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                color: "#1d2a24",
                fontFamily: "var(--font-serif, Georgia, serif)",
              }}
            >
              {trial.title || "Untitled Trial Kit"}
            </h1>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                background: "#f3ede2",
                color: "#8a5828",
                border: "1px solid #e3d2be",
              }}
            >
              Rev #{trial.revision}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6a6e64", marginTop: 4 }}>
            <code>/{trial.slug}</code> · SKU: <strong>{trial.sku}</strong> · 4×50g (200g) Assortment
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href={`/trials/${trial.slug}`}
            target="_blank"
            rel="noreferrer"
            className="button button-cream"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            <ExternalLink size={14} />
            <span>Storefront PDP</span>
          </a>
        </div>
      </div>

      {/* Notice Banners */}
      {errorNotice && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            background: "#fdf2f2",
            border: "1px solid #f8b4b4",
            borderRadius: 6,
            color: "#9b1c1c",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorNotice}</span>
        </div>
      )}

      {successNotice && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            background: "#f1f8e9",
            border: "1px solid #c8e6c9",
            borderRadius: 6,
            color: "#2e7d32",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
          }}
        >
          <CheckCircle size={18} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 5-Tab Navigation Bar */}
      <div
        role="tablist"
        aria-label="Admin Trial Studio Sections"
        style={{
          display: "flex",
          gap: 6,
          borderBottom: "2px solid #ede9df",
          marginBottom: 24,
          overflowX: "auto",
        }}
      >
        {[
          { key: "identity", label: "1. Identity & Pricing", icon: Boxes },
          { key: "pouches", label: "2. Pouches Composer", icon: Layers },
          { key: "optical", label: "3. Optical & Brewing", icon: Camera },
          { key: "promotions", label: "4. Promotions & Bulk", icon: Tag },
          { key: "publish", label: "5. Preview & Publish", icon: CheckCircle },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const hasError = tabErrors[tab.key] && Object.keys(tabErrors[tab.key]).length > 0;
          const IconComponent = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key as StudioTabKey)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: hasError ? "#9b1c1c" : isActive ? "#143c31" : "#555850",
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "3px solid #143c31"
                  : hasError
                  ? "3px solid #9b1c1c"
                  : "3px solid transparent",
                marginBottom: -2,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 150ms ease, border-color 150ms ease",
              }}
            >
              <IconComponent size={16} />
              <span>{tab.label}</span>
              {hasError && (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9b1c1c" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel Content */}
      <div id={`panel-${activeTab}`} role="tabpanel">
        {activeTab === "identity" && (
          <TrialTabIdentity
            trial={trial}
            onChange={handlePatchWorkingDraft}
            onSave={handleSaveIdentity}
            saving={saving}
            errors={tabErrors.identity}
          />
        )}

        {activeTab === "pouches" && (
          <TrialTabPouches
            components={trial.components || []}
            onChange={(components) => handlePatchWorkingDraft({ components })}
            onSave={handleSaveComponents}
            saving={saving}
          />
        )}

        {activeTab === "optical" && (
          <TrialTabOptical
            trial={trial}
            onAttachAsset={handleAttachAsset}
            onDetachAsset={handleDetachAsset}
            onUpdateComponentBrewing={(slotIdx, brewing) => {
              const updated = (trial.components || []).map((c, i) =>
                i === slotIdx ? { ...c, ...brewing } : c
              );
              handlePatchWorkingDraft({ components: updated });
            }}
            saving={saving}
          />
        )}

        {activeTab === "promotions" && (
          <TrialTabPromotions
            trial={trial}
            onChangeBulkLinks={(bulk_links) => handlePatchWorkingDraft({ bulk_links })}
            onChangeClaims={(claims) => handlePatchWorkingDraft({ claims })}
            saving={saving}
          />
        )}

        {activeTab === "publish" && (
          <TrialTabPublish
            trial={trial}
            serverValidation={serverValidation}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onSubmitReview={() => handleLifecycleTransition("submit-review", "Trial submitted for cupping review.")}
            onPublish={() => handleLifecycleTransition("publish", "Trial published successfully to storefront!")}
            onUnpublish={() => handleLifecycleTransition("unpublish", "Trial returned to draft status.")}
            onArchive={() => handleLifecycleTransition("archive", "Trial kit moved to archive.")}
            saving={saving}
          />
        )}
      </div>

      {/* HTTP 409 Conflict Resolution Diff Modal */}
      {serverTrial && conflictServerTrial && (
        <ConflictDiffModal
          isOpen={conflictOpen}
          localTrial={trial}
          serverTrial={conflictServerTrial}
          onKeepLocal={handleConflictKeepLocal}
          onAcceptServer={handleConflictAcceptServer}
          onClose={() => setConflictOpen(false)}
        />
      )}
    </div>
  );
}
