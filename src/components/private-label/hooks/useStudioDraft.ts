"use client";

import { z } from "zod";
import { consumeStudioPreview } from "../studio/previewHandoff";
import { useState, useEffect, useCallback, useRef } from "react";
import type { PackagingFamilyCode, PrintMethodCode } from "@/lib/private-label/types";

export interface StudioConfigData {
  teaOptionId: string | null;
  fillWeightGrams: number;
  packagingVariantId: string | null;
  packagingSlug: string | null;
  packagingFamily: PackagingFamilyCode | null;
  printMethodId: string | null;
  printMethodCode: PrintMethodCode | null;
  colorCount: number;
  finishEmbellishment: string;
  brandName: string;
  artworkAssetId: string | null;
  artworkUrl: string | null;
  artworkFilename: string | null;
  artworkDpi: number | null;
  artworkX: number;
  artworkY: number;
  artworkScale: number;
  artworkRotation: number;
  rightsAttested: boolean;
  activeView: "front" | "back" | "top" | "dieline";
  guidesVisible: boolean;
  quantityUnits: number;
  destinationZone: "local" | "metro" | "national" | "international";
  isNitrogenFlushEnabled: boolean;
  notes: string;
}

export interface LocalDraftEnvelope {
  projectId: string | null;
  revision: number;
  step: 1 | 2 | 3 | 4 | 5;
  updatedAt: string;
  config: StudioConfigData;
}

export const DEFAULT_STUDIO_CONFIG: StudioConfigData = {
  teaOptionId: null,
  fillWeightGrams: 100,
  packagingVariantId: null,
  packagingSlug: null,
  packagingFamily: null,
  printMethodId: null,
  printMethodCode: null,
  colorCount: 4,
  finishEmbellishment: "matte",
  brandName: "",
  artworkAssetId: null,
  artworkUrl: null,
  artworkFilename: null,
  artworkDpi: null,
  artworkX: 0,
  artworkY: 0,
  artworkScale: 1.0,
  artworkRotation: 0,
  rightsAttested: false,
  activeView: "front",
  guidesVisible: true,
  quantityUnits: 1000,
  destinationZone: "metro",
  isNitrogenFlushEnabled: false,
  notes: "",
};

const id = z.string().min(1).max(200).nullable().catch(null);
const restoredConfigSchema = z.object({
  teaOptionId: id, fillWeightGrams: z.number().finite().positive().max(50000).catch(100),
  packagingVariantId: id, packagingSlug: id,
  packagingFamily: z.enum(["pouch", "tin", "jar", "carton", "sachet", "bag"]).nullable().catch(null),
  printMethodId: id,
  printMethodCode: z.enum(["paper_label", "bopp_label", "direct_digital", "gravure", "screen_print", "sleeve"]).nullable().catch(null),
  colorCount: z.number().int().min(1).max(12).catch(4),
  finishEmbellishment: z.string().max(50).catch("matte"), brandName: z.string().max(100).catch(""),
  artworkAssetId: id,
  artworkUrl: z.string().max(750000).refine(url => /^data:image\/(png|jpeg|webp);base64,/.test(url) || /^\/(?!\/)/.test(url)).nullable().catch(null),
  artworkFilename: z.string().max(255).nullable().catch(null), artworkDpi: z.number().finite().positive().nullable().catch(null),
  artworkX: z.number().finite().min(-1000).max(1000).catch(0), artworkY: z.number().finite().min(-1000).max(1000).catch(0),
  artworkScale: z.number().finite().min(0.2).max(2.5).catch(1), artworkRotation: z.number().finite().min(-360).max(360).catch(0),
  rightsAttested: z.boolean().catch(false), activeView: z.enum(["front", "back", "top", "dieline"]).catch("front"),
  guidesVisible: z.boolean().catch(true), quantityUnits: z.number().int().min(1).max(10000000).catch(1000),
  destinationZone: z.enum(["local", "metro", "national", "international"]).catch("metro"),
  isNitrogenFlushEnabled: z.boolean().catch(false), notes: z.string().max(2000).catch(""),
});

export function restoreStudioConfig(value: unknown): StudioConfigData {
  const config = restoredConfigSchema.parse(value && typeof value === "object" ? value : {});
  if (!config.artworkUrl) { config.artworkFilename = null; config.artworkDpi = null; config.rightsAttested = false; }
  return config;
}

const DRAFT_STORAGE_KEY = "teafloww-pl-draft";
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function useStudioDraft(_initialPackageSlug?: string | null, requestedProjectId?: string | null) {
  const [config, setConfig] = useState<StudioConfigData>(DEFAULT_STUDIO_CONFIG);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [revision, setRevision] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const previewRef = useRef<ReturnType<typeof consumeStudioPreview>>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    const online = () => setIsOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    if (!requestedProjectId) try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved.config === "object" && saved.config) {
          const restored = restoreStudioConfig(saved.config);
          // Object URLs expire on reload. Never restore a broken upload as saved artwork.
          if (restored.artworkUrl?.startsWith("blob:")) {
            restored.artworkUrl = null;
            restored.artworkFilename = null;
            restored.artworkDpi = null;
            restored.rightsAttested = false;
          }
          setConfig(restored);
          setCurrentStep([1, 2, 3, 4, 5].includes(saved.step) ? saved.step : 1);
          setProjectId(typeof saved.projectId === "string" ? saved.projectId : null);
          setRevision(Number.isSafeInteger(saved.revision) && saved.revision > 0 ? saved.revision : 1);
          setIsStale(Date.now() - new Date(saved.updatedAt).getTime() > STALE_THRESHOLD_MS);
        }
      }
    } catch { setStorageError("Local draft storage is unavailable. Keep this page open until you save your project."); }
    if (!requestedProjectId) {
      try {
        previewRef.current ??= consumeStudioPreview();
        const preview = previewRef.current;
        if (preview) {
          setConfig({ ...DEFAULT_STUDIO_CONFIG, brandName: typeof preview.brandName === "string" ? preview.brandName.slice(0,100) : "", quantityUnits: Number.isSafeInteger(preview.quantityUnits) && preview.quantityUnits > 0 ? preview.quantityUnits : 1000 });
          setProjectId(null); setRevision(1); setCurrentStep(1);
        }
      } catch { /* Optional preview handoff; local draft remains available. */ }
      setInitialized(true);
    }
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", online); };
  }, [requestedProjectId]);

  useEffect(() => {
    if (!requestedProjectId) return;
    const controller = new AbortController();
    setInitialized(false);
    setStorageError(null);
    fetch(`/api/v1/private-label/projects/${encodeURIComponent(requestedProjectId)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to open this saved project." : "This saved project could not be loaded. Return to your workspace and try again.");
        const data = await response.json();
        if (controller.signal.aborted) return;
        setConfig(restoreStudioConfig(data.project.draft_configuration));
        setProjectId(data.project.id);
        setRevision(data.project.revision);
        const step = data.project.draft_configuration.studioStep;
        setCurrentStep([1,2,3,4,5].includes(step) ? step : 1);
        setInitialized(true);
      }).catch(error => {
        if (!controller.signal.aborted) setStorageError(error instanceof Error ? error.message : "Unable to load your project.");
      });
    return () => controller.abort();
  }, [requestedProjectId]);

  useEffect(() => {
    if (!initialized) return;
    const now = new Date().toISOString();
    try {
      const localConfig = { ...config };
      if (localConfig.artworkUrl?.startsWith("blob:")) {
        localConfig.artworkUrl = null;
        localConfig.artworkFilename = null;
        localConfig.artworkDpi = null;
        localConfig.rightsAttested = false;
      }
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ projectId, revision, step: currentStep, updatedAt: now, config: localConfig }));
      setLastSavedAt(now);
    } catch { setStorageError("Your browser could not save this draft locally. Save your project before leaving."); }
  }, [config, currentStep, projectId, revision, initialized]);

  const updateConfig = useCallback((updater: Partial<StudioConfigData> | ((prev: StudioConfigData) => StudioConfigData)) => {
    setConfig(prev => typeof updater === "function" ? updater(prev) : { ...prev, ...updater });
  }, []);
  const discardDraft = useCallback(() => {
    setConfig(DEFAULT_STUDIO_CONFIG); setCurrentStep(1); setProjectId(null); setRevision(1); setIsStale(false); setConflictOpen(false);
  }, []);

  return { config, updateConfig, currentStep, setCurrentStep, projectId, setProjectId, revision, setRevision,
    isSaving: false, isOffline, isStale, setIsStale, conflictOpen, setConflictOpen, lastSavedAt,
    discardDraft, initialized, storageError };
}
