"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { trackLead } from "@/lib/seo/tracking";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useStudioDraft } from "./hooks/useStudioDraft";
import { useQuoteEstimate } from "./hooks/useQuoteEstimate";
import { StudioStepNavigation } from "./studio/StudioStepNavigation";
import { Step1TeaSelection } from "./studio/Step1TeaSelection";
import { Step2PackagingSelection } from "./studio/Step2PackagingSelection";
import { Step3PrintMethod } from "./studio/Step3PrintMethod";
import { Step4ArtworkUpload } from "./studio/Step4ArtworkUpload";
import { Step5QuantityQuote } from "./studio/Step5QuantityQuote";
import { StudioMobileBottomBar } from "./studio/StudioMobileBottomBar";
import { StudioCanvas2D } from "./StudioCanvas2D";
import { QuoteSummaryPanel } from "./QuoteSummaryPanel";
import { ProofApprovalModal } from "./ProofApprovalModal";
import { StudioAuthModal } from "./StudioAuthModal";
import Link from "next/link";
import { earliestIncompleteStep, validateStudioStep, studioProjectPayload } from "./studio/flow";
import { validateCompatibility } from "@/lib/private-label/compatibility";
import type {
  PublicTeaOptionDto,
  PublicPackagingVariantDto,
  PublicPrintMethodDto,
} from "@/lib/private-label/public-dto";
import type { PackagingFamilyCode } from "@/lib/private-label/types";

export interface StudioConfiguratorProps {
  teas: PublicTeaOptionDto[];
  packagingVariants: PublicPackagingVariantDto[];
  printMethods: PublicPrintMethodDto[];
  initialPackageSlug?: string | null;
  initialStep?: number;
}

export function StudioConfigurator({
  teas = [],
  packagingVariants = [],
  printMethods = [],
  initialPackageSlug,
  initialStep: _initialStep = 1,
}: StudioConfiguratorProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlPackage = searchParams.get("package") || searchParams.get("pack") || initialPackageSlug;
  const urlStepParam = searchParams.get("step");

  // Draft persistence hook
  const {
    config,
    updateConfig,
    currentStep,
    setCurrentStep,
    projectId,
    setProjectId,
    revision,
    setRevision,
    initialized,
    storageError,
    isOffline,
    isStale,
    setIsStale,
    conflictOpen,
    setConflictOpen,
    discardDraft: _discardDraft,
  } = useStudioDraft(urlPackage, searchParams.get("project"));

  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  const completedSteps = [1, 2, 3, 4].filter(step => step < earliestIncompleteStep(config));
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const appliedUrl = useRef<string | null>(null);
  const appliedPackage = useRef<string | null>(null);
  const actionBusy = useRef(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const [isProofModalOpen, setIsProofModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalAction, setAuthModalAction] = useState<"quote" | "draft">("quote");
  const [isGeneratingQuote, setIsGeneratingQuote] = useState<boolean>(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (initialized) document.getElementById(`step-${currentStep}-title`)?.focus({ preventScroll: true });
  }, [currentStep, initialized]);

  // Selected entities lookup
  const selectedTea = useMemo(
    () => teas.find((t) => t.id === config.teaOptionId) || null,
    [teas, config.teaOptionId]
  );

  const selectedPackaging = useMemo(
    () => packagingVariants.find((p) => p.id === config.packagingVariantId) || null,
    [packagingVariants, config.packagingVariantId]
  );

  const selectedPrintMethod = useMemo(
    () => printMethods.find((m) => m.id === config.printMethodId) || null,
    [printMethods, config.printMethodId]
  );

  // Live Quote Estimate Hook
  const estimate = useQuoteEstimate({
    teaOption: selectedTea,
    packagingVariant: selectedPackaging,
    printMethod: selectedPrintMethod,
    fillWeightGrams: config.fillWeightGrams,
    quantityUnits: config.quantityUnits,
    colorCount: config.colorCount,
    destinationZone: config.destinationZone,
    isNitrogenFlushEnabled: config.isNitrogenFlushEnabled,
  });

  // Apply a deep link once; subsequent edits must not reset the user's progress.
  useEffect(() => {
    if (!initialized || appliedUrl.current === urlStepParam) return;
    appliedUrl.current = urlStepParam;
    if (urlStepParam) {
      const target = Number(urlStepParam);
      if (Number.isInteger(target) && target >= 1 && target <= 5)
        setCurrentStep(Math.min(target, earliestIncompleteStep(config)) as 1 | 2 | 3 | 4 | 5);
    }
  }, [initialized, urlStepParam, config, setCurrentStep]);

  useEffect(() => {
    if (!initialized || !urlPackage || appliedPackage.current === urlPackage) return;
    appliedPackage.current = urlPackage;
    const match = packagingVariants.find(v => v.slug === urlPackage || v.id === urlPackage);
    if (match && match.id !== config.packagingVariantId) updateConfig({ packagingVariantId: match.id, packagingSlug: match.slug,
      packagingFamily: match.family as PackagingFamilyCode, printMethodId: null, printMethodCode: null });
    else if (!match) setActionError("This packaging is unavailable. Please choose another option.");
  }, [initialized, urlPackage, packagingVariants, updateConfig, config.packagingVariantId]);

  useEffect(() => { setQuoteId(null); }, [config]);

  // Handle Packaging Selection & Invalidation Rule (F17.B2):
  // Changing packaging in Step 2 checks compatibility with Step 3 print method.
  // If incompatible, resets print method.
  const handleSelectPackaging = useCallback(
    (variantId: string, slug?: string, family?: PackagingFamilyCode) => {
      const newVariant = packagingVariants.find((v) => v.id === variantId);
      const newFamily = (family || newVariant?.category || newVariant?.family || "pouch") as PackagingFamilyCode;

      let nextPrintMethodId = config.printMethodId;
      let nextPrintCode = config.printMethodCode;

      if (config.printMethodId && selectedPrintMethod) {
        const comp = validateCompatibility({
          familyCode: newFamily,
          printMethodCode: selectedPrintMethod.code,
          colorCount: config.colorCount,
        });

        if (!comp.compatible) {
          // Invalidate incompatible print method!
          nextPrintMethodId = null;
          nextPrintCode = null;
          setLiveAnnouncement(
            `Print method was reset because ${selectedPrintMethod.name} is not compatible with ${newFamily} packaging.`
          );
        }
      }

      updateConfig({
        packagingVariantId: variantId,
        packagingSlug: slug || null,
        packagingFamily: newFamily,
        printMethodId: nextPrintMethodId,
        printMethodCode: nextPrintCode,
      });

      // Clear step 2 errors
      setStepErrors((prev) => ({ ...prev, 2: [] }));
    },
    [packagingVariants, config.printMethodId, config.printMethodCode, config.colorCount, selectedPrintMethod, updateConfig]
  );

  const validateCurrentStep = useCallback((step: number) => {
    const error = validateStudioStep(config, step);
    if (error) return error;
    if (step === 1 && !selectedTea) return "This tea is no longer available. Please choose another.";
    if (step === 3 && (!selectedPrintMethod || config.colorCount > selectedPrintMethod.max_colors)) return "Choose an available print method and its supported color count.";
    if (step === 3 && selectedPackaging?.supported_print_methods.length && !selectedPackaging.supported_print_methods.includes(selectedPrintMethod?.code || "")) return "This print method is not available for the selected packaging.";
    if (step === 2 && !selectedPackaging) return "This packaging is no longer available.";
    if (step === 2 && selectedPackaging && config.fillWeightGrams > selectedPackaging.net_weight_capacity_grams)
      return "The fill weight exceeds this pack's capacity. Choose a larger pack or lower the fill weight.";
    return null;
  }, [config, selectedTea, selectedPackaging, selectedPrintMethod]);

  // Stepping forward
  const handleNextStep = useCallback(() => {
    const error = validateCurrentStep(currentStep);
    if (error) {
      setStepErrors((prev) => ({ ...prev, [currentStep]: [error] }));
      setLiveAnnouncement(`Step ${currentStep} validation error: ${error}`);
      return;
    }

    setStepErrors((prev) => ({ ...prev, [currentStep]: [] }));

    if (currentStep < 5) {
      const next = (currentStep + 1) as 1 | 2 | 3 | 4 | 5;
      setCurrentStep(next);
      setLiveAnnouncement(`Navigated to Step ${next} of 5.`);
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [currentStep, validateCurrentStep, setCurrentStep]);

  // Stepping backward freely (F17.B3)
  const handleJumpToStep = useCallback(
    (targetStep: 1 | 2 | 3 | 4 | 5) => {
      let safe = targetStep;
      for (let step = 1; step < targetStep; step++) {
        if (validateCurrentStep(step)) { safe = step as 1 | 2 | 3 | 4 | 5; break; }
      }
      setCurrentStep(safe);
      setLiveAnnouncement(`Jumped to Step ${targetStep} of 5.`);
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    },
    [setCurrentStep, validateCurrentStep]
  );

  // Artwork Upload Handler (computes DPI)
  const handleArtworkUpload = useCallback(
    (file: File) => {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 512 * 1024) {
        setStepErrors(prev => ({ ...prev, 4: ["Choose a PNG, JPEG or WebP preview smaller than 512 KB. Production artwork is reviewed separately."] }));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => setStepErrors(prev => ({ ...prev, 4: ["Unable to read this file. Please try another image."] }));
      reader.onload = () => {
        const url = String(reader.result);
        const img = new Image();
        img.onerror = () => setStepErrors(prev => ({ ...prev, 4: ["This image could not be decoded. Choose another file."] }));
        img.onload = () => {
          const widthMm = selectedPackaging?.label_safe_area_mm.width || 160;
          const dpi = Math.round(img.width / (widthMm / 25.4));
          updateConfig({ artworkUrl: url, artworkFilename: file.name, artworkDpi: dpi, rightsAttested: false });
          setStepErrors(prev => ({ ...prev, 4: [] }));
          setLiveAnnouncement(`Preview loaded at approximately ${dpi} DPI. Production artwork requires separate review.`);
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    },
    [selectedPackaging, updateConfig]
  );

  async function persistProject(action: "quote" | "draft" = "quote") {
    const payload = { ...studioProjectPayload(config), draft_configuration: { ...config, studioStep: currentStep } };
    const response = await fetch(projectId ? `/api/v1/private-label/projects/${projectId}` : "/api/v1/private-label/projects", {
      method: projectId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...(projectId ? { expected_revision: revision } : {}) }),
    });
    if (response.status === 401) {
      setNeedsLogin(true);
      setAuthModalAction(action);
      setIsAuthModalOpen(true);
      throw new Error("Sign in or create a free account to generate your official quotation.");
    }
    if (response.status === 409) {
      setConflictOpen(true);
      throw new Error("This project changed elsewhere. Reload the project before saving again.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.id) throw new Error(data?.error || "Unable to save this project. Check your selections and try again.");
    setProjectId(data.id);
    setRevision(data.project?.revision ?? data.revision ?? 1);
    return data.id as string;
  }

  async function handleSaveDraft() {
    if (actionBusy.current) return;
    actionBusy.current = true; setIsSaving(true); setActionError(null);
    try {
      await persistProject("draft");
      setLiveAnnouncement("Project saved successfully.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to save. Please retry.";
      setActionError(msg);
      setLiveAnnouncement(msg);
    } finally {
      setIsSaving(false);
      actionBusy.current = false;
    }
  }

  async function handleGenerateQuote() {
    if (actionBusy.current) return;
    for (const step of [1, 2, 3, 4, 5] as const) {
      const error = validateCurrentStep(step);
      if (error) {
        setStepErrors(prev => ({ ...prev, [step]: [error] }));
        setCurrentStep(step);
        setActionError(`Step ${step}: ${error}`);
        setLiveAnnouncement(`Step ${step} requires attention: ${error}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (!estimate.isEligible) {
      const reason = estimate.moq?.reasons?.[0]
        || estimate.serverQuoteError
        || (estimate.isLoadingServerQuote ? "Calculating real-time quotation estimate. Please wait a moment..." : "Resolve the minimum quantity requirements and wait for a current estimate before requesting a quote.");
      setActionError(reason);
      setLiveAnnouncement(reason);
      return;
    }
    actionBusy.current = true; setIsGeneratingQuote(true); setActionError(null);
    try {
      // Always save current items before quoting, including edits to an existing draft.
      const activeProjectId = await persistProject("quote");
      const response = await fetch("/api/v1/private-label/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: activeProjectId, destinationZone: config.destinationZone }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        throw new Error(
          response.status === 422
            ? "This configuration needs review. Check the minimum quantity and packaging compatibility."
            : data?.error || "Unable to generate this quote. Please retry."
        );
      }
      trackLead("private_label_quote");
      setQuoteId(data.id);
      router.push(`/private-label/quotes/${data.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to generate the quote.";
      setActionError(msg);
      setLiveAnnouncement(msg);
    } finally {
      setIsGeneratingQuote(false);
      actionBusy.current = false;
    }
  }

  if (!initialized && searchParams.get("project")) return <div style={{ padding: 32 }}><p role={storageError ? "alert" : "status"}>{storageError || "Loading your studio draft…"}</p>{storageError && <Link href="/account/private-label"><StorefrontText id="copy_47d32925dd1fc80f" fallback="Return to your workspace" /></Link>}</div>;

  return (
    <div
      className="studioContainer"
      style={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "clip",
        boxSizing: "border-box",
        padding: "clamp(24px, 4vw, 48px) 0",
        backgroundColor: "#FFFCF7",
        minHeight: "100vh",
      }}
    >
      {/* Screen Reader ARIA Live Region (F23.3) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {liveAnnouncement}
      </div>

      <div
        className="contentContainer"
        style={{
          width: "min(100% - 32px, 1320px)",
          marginInline: "auto",
          boxSizing: "border-box",
        }}
      >
        {(actionError || storageError) && <div role="alert" style={{ padding: 16, marginBottom: 16, background: "#FFF4E5", color: "#713F12" }}>
          {actionError || storageError}
          {needsLogin && <p><Link href="/login?redirect=%2Fprivate-label%2Fstudio"><StorefrontText id="copy_3d8b2d9d56294f76" fallback="Sign in and return to your project" /></Link></p>}
        </div>}
        {(!teas.length || !packagingVariants.length || !printMethods.length) && <div role="status" style={{ padding: 20, marginBottom: 24, border: "1px solid #DDE4DC" }}>
          <h2><StorefrontText id="copy_6efa1162f4b325f8" fallback="Studio catalogue is being prepared" /></h2>
          <p><StorefrontText id="copy_53b66f15063eabb1" fallback="Some tea, packaging or print options are not currently available. Our team can help you plan your project." /></p>
          <Link href="/private-label#sample-kit"><StorefrontText id="copy_a2e571a10d9171fa" fallback="Request a consultation" /></Link>
        </div>}
        {/* Header Badges: Offline & Stale Status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <span
              style={{
                display: "inline-block",
                color: "#D7B474",
                fontSize: "0.8125rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            ><StorefrontText id="copy_e36edc955cf4fbd3" fallback="TeaFloww Private Label Atelier" />
            </span>
            <h1
              style={{
                margin: "4px 0 0 0",
                fontSize: "clamp(24px, 3.6vw, 36px)",
                fontFamily: 'Georgia, "Times New Roman", serif',
                color: "#143C31",
                fontWeight: "normal",
              }}
            >
              Bespoke Tea &amp; Packaging Configurator
            </h1>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isOffline && (
              <span
                style={{
                  background: "#FFF4E5",
                  border: "1px solid #FFCC80",
                  borderRadius: "20px",
                  padding: "4px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#B25E00",
                }}
              >
                Offline &bull; Saved Locally
              </span>
            )}
            {isSaving && (
              <span style={{ fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_a3364c2d8ebdea13" fallback="Auto-saving..." />
              </span>
            )}
          </div>
        </div>

        {/* Stale Draft Notice (F18.B4) */}
        {isStale && (
          <div
            style={{
              background: "#FFF8E7",
              border: "1px solid #FFE4A3",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "0.875rem",
              color: "#B45309",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              <strong><StorefrontText id="copy_c77db0ab2c5d60f6" fallback="Notice:" /></strong><StorefrontText id="copy_a5d5bcd3bfe089dd" fallback="Your draft is older than 30 days. Current commodity tea rates and packaging price book tiers have been refreshed." />
            </span>
            <button
              type="button"
              onClick={() => setIsStale(false)}
              style={{
                background: "none",
                border: "none",
                color: "#143C31",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            ><StorefrontText id="copy_48845bff334a50a5" fallback="Dismiss" />
            </button>
          </div>
        )}

        {/* Concurrency Conflict Toast (F18.B2) */}
        {conflictOpen && (
          <div
            style={{
              background: "#FFEBEE",
              border: "1px solid #FFCDD2",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "0.875rem",
              color: "#C62828",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              <strong><StorefrontText id="copy_e7d0323dea041f67" fallback="Draft Conflict:" /></strong><StorefrontText id="copy_ebeb8f0015550bea" fallback="This project draft was modified in another tab or device. Reload the saved version to continue. This replaces unsaved edits on this device." />
              {projectId && <p><Link href={`/private-label/studio?project=${encodeURIComponent(projectId)}`}><StorefrontText id="copy_3c845b4917765b94" fallback="Reload saved version" /></Link></p>}
            </span>
            <button
              type="button"
              onClick={() => setConflictOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "#C62828",
                fontWeight: 600,
                cursor: "pointer",
              }}
            ><StorefrontText id="copy_48845bff334a50a5" fallback="Dismiss" />
            </button>
          </div>
        )}

        {/* Stepper Navigation Header */}
        <StudioStepNavigation
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepSelect={handleJumpToStep}
          stepErrors={stepErrors}
        />

        {/* Responsive Grid Layout (F16.5: 3-column / split desktop, single-column mobile) */}
        <div
          className="studioGrid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "32px",
            alignItems: "start",
          }}
        >
          <style jsx>{`
            @media (min-width: 1024px) {
              .studioGrid {
                grid-template-columns: 6.2fr 3.8fr !important;
              }
            }
          `}</style>

          {/* Left Column: Configurator Steps */}
          <div style={{ width: "100%", minWidth: 0 }}>
            {currentStep === 1 && (
              <Step1TeaSelection
                teas={teas}
                selectedTeaId={config.teaOptionId}
                fillWeightGrams={config.fillWeightGrams}
                onSelectTea={(id) => {
                  updateConfig({ teaOptionId: id });
                  setStepErrors((prev) => ({ ...prev, 1: [] }));
                }}
                onChangeFillWeight={(wt) => updateConfig({ fillWeightGrams: wt })}
                onNext={handleNextStep}
                validationError={stepErrors[1]?.[0]}
              />
            )}

            {currentStep === 2 && (
              <Step2PackagingSelection
                packagingVariants={packagingVariants}
                selectedVariantId={config.packagingVariantId}
                onSelectVariant={handleSelectPackaging}
                onNext={handleNextStep}
                onPrev={() => handleJumpToStep(1)}
                deepLinkSlug={urlPackage}
                validationError={stepErrors[2]?.[0]}
              />
            )}

            {currentStep === 3 && (
              <Step3PrintMethod
                printMethods={printMethods}
                packagingFamily={config.packagingFamily}
                supportedPrintMethodCodes={selectedPackaging?.supported_print_methods}
                selectedPrintMethodId={config.printMethodId}
                colorCount={config.colorCount}
                finishEmbellishment={config.finishEmbellishment}
                onSelectPrintMethod={(id, code) => {
                  updateConfig({ printMethodId: id, printMethodCode: code });
                  setStepErrors((prev) => ({ ...prev, 3: [] }));
                }}
                onChangeColorCount={(cnt) => updateConfig({ colorCount: cnt })}
                onChangeFinish={(f) => updateConfig({ finishEmbellishment: f })}
                onNext={handleNextStep}
                onPrev={() => handleJumpToStep(2)}
                validationError={stepErrors[3]?.[0]}
              />
            )}

            {currentStep === 4 && (
              <Step4ArtworkUpload
                brandName={config.brandName}
                artworkUrl={config.artworkUrl}
                artworkFilename={config.artworkFilename}
                artworkDpi={config.artworkDpi}
                artworkX={config.artworkX}
                artworkY={config.artworkY}
                artworkScale={config.artworkScale}
                rightsAttested={config.rightsAttested}
                onBrandNameChange={(name) => updateConfig({ brandName: name })}
                onUploadArtwork={handleArtworkUpload}
                onPlacementChange={(placement) =>
                  updateConfig({
                    artworkX: placement.xMm,
                    artworkY: placement.yMm,
                    artworkScale: placement.scale,
                    artworkRotation: placement.rotationDeg,
                  })
                }
                onRightsAttestedChange={(attested) =>
                  updateConfig({ rightsAttested: attested })
                }
                onOpenProofModal={() => setIsProofModalOpen(true)}
                onNext={handleNextStep}
                onPrev={() => handleJumpToStep(3)}
                packagingVariantId={config.packagingVariantId}
                packagingTitle={selectedPackaging?.title}
                dielineUrl={selectedPackaging?.dieline_url}
                validationError={stepErrors[4]?.[0]}
              />
            )}

            {currentStep === 5 && (
              <Step5QuantityQuote
                quantityUnits={config.quantityUnits}
                destinationZone={config.destinationZone}
                isNitrogenFlushEnabled={config.isNitrogenFlushEnabled}
                notes={config.notes}
                estimate={estimate}
                onChangeQuantity={(q) => updateConfig({ quantityUnits: q })}
                onChangeDestinationZone={(z) => updateConfig({ destinationZone: z })}
                onToggleNitrogenFlush={(en) =>
                  updateConfig({ isNitrogenFlushEnabled: en })
                }
                onChangeNotes={(n) => updateConfig({ notes: n })}
                onGenerateQuote={handleGenerateQuote}
                onSaveDraft={handleSaveDraft}
                onPrev={() => handleJumpToStep(4)}
                isGeneratingQuote={isGeneratingQuote}
                isSavingDraft={isSaving}
                quoteId={quoteId}
                validationError={stepErrors[5]?.[0]}
                actionError={actionError}
                needsLogin={needsLogin}
                onOpenAuthModal={() => {
                  setAuthModalAction("quote");
                  setIsAuthModalOpen(true);
                }}
              />
            )}
          </div>

          {/* Right Column: Sticky 2D Canvas & 12-Component Quote Summary */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "sticky",
              top: "88px",
              width: "100%",
              minWidth: 0,
            }}
          >
            {/* 2D Canvas Mockup Preview */}
            <StudioCanvas2D
              packagingVariant={selectedPackaging}
              brandName={config.brandName}
              fillWeightGrams={config.fillWeightGrams}
              artworkUrl={config.artworkUrl}
              artworkDpi={config.artworkDpi}
              artworkFilename={config.artworkFilename}
              activeView={config.activeView}
              onViewChange={(view) => updateConfig({ activeView: view })}
              guidesVisible={config.guidesVisible}
              onToggleGuides={() =>
                updateConfig((prev) => ({ ...prev, guidesVisible: !prev.guidesVisible }))
              }
              placement={{
                xMm: config.artworkX ?? 0,
                yMm: config.artworkY ?? 0,
                scale: config.artworkScale ?? 1.0,
                rotationDeg: config.artworkRotation ?? 0,
              }}
              onPlacementChange={(placement) =>
                updateConfig({
                  artworkX: placement.xMm,
                  artworkY: placement.yMm,
                  artworkScale: placement.scale,
                  artworkRotation: placement.rotationDeg,
                })
              }
            />

            {/* Sticky 12-Component Quote Summary Panel */}
            <QuoteSummaryPanel
              estimate={estimate}
              quantityUnits={config.quantityUnits}
              onAdjustQuantity={(q) => updateConfig({ quantityUnits: q })}
              onSaveDraft={handleSaveDraft}
              onGenerateQuote={handleGenerateQuote}
              isSavingDraft={isSaving}
              isGeneratingQuote={isGeneratingQuote}
              quoteId={quoteId}
              actionError={actionError}
              needsLogin={needsLogin}
              onOpenAuthModal={() => {
                setAuthModalAction("quote");
                setIsAuthModalOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Proof Approval Modal Dialog */}
      <ProofApprovalModal
        previewOnly
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        onApprove={() => {
          setIsProofModalOpen(false);
          setLiveAnnouncement("Preview reviewed. Production proof approval is available on your quotation after the team prepares a proof.");
        }}
        brandName={config.brandName || "Custom Brand"}
        packagingName={selectedPackaging?.name || "Selected Packaging"}
      />

      {/* Guest Sign-In / Account Creation Dialog for Official Quote */}
      <StudioAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        intendedAction={authModalAction}
        onSuccess={async () => {
          setIsAuthModalOpen(false);
          setNeedsLogin(false);
          setActionError(null);
          setLiveAnnouncement("Signed in successfully. Proceeding with your request...");
          if (authModalAction === "draft") {
            await handleSaveDraft();
          } else {
            await handleGenerateQuote();
          }
        }}
      />

      {/* Mobile Sticky Bottom Bar (Visible on mobile screens) */}
      <div className="mobile-only-bar">
        <style jsx>{`
          .mobile-only-bar {
            display: block;
          }
          @media (min-width: 768px) {
            .mobile-only-bar {
              display: none;
            }
          }
        `}</style>
        <StudioMobileBottomBar
          currentStep={currentStep}
          formattedUnitPrice={estimate.formattedUnitPrice}
          isEligible={estimate.isEligible}
          onNext={currentStep === 5 ? handleGenerateQuote : handleNextStep}
          isLastStep={currentStep === 5}
          isGeneratingQuote={isGeneratingQuote}
        />
      </div>
    </div>
  );
}
