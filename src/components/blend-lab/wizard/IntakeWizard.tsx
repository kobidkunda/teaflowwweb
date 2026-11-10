"use client";
import { trackLead } from "@/lib/seo/tracking";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Package,
  Coffee,
  Target,
  Truck,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { ORDERED_PLANS, formatInr, splitTaxInclusive, type PlanCode } from "@/lib/blend-lab/plans-catalog";
import type { BlendLabProjectRecord } from "@/lib/blend-lab/projects";

interface IntakeFormState {
  planCode: PlanCode;
  // Step 2: Sample Info
  category: "CTC" | "orthodox" | "green" | "white" | "oolong" | "flavoured" | "other" | "unknown";
  leafGrade: string;
  currentPurchasePricePerKg: string;
  sampleWeightGrams: number;
  primaryUseCase: string;
  // Step 3: Goals
  goalType: "lower_cost" | "stronger_chai" | "consistent_cup" | "new_signature";
  targetPricePerKg: string;
  sensoryStrength: number;
  sensoryBriskness: number;
  sensoryAroma: number;
  sensorySweetness: number;
  notes: string;
  // Step 4: Pickup
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  // Step 5: Terms
  acceptedTerms: boolean;
}

export function IntakeWizard() {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") as PlanCode) || "QUALITY_AUDIT";

  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<IntakeFormState>({
    planCode: ORDERED_PLANS.some((p) => p.code === initialPlan) ? initialPlan : "QUALITY_AUDIT",
    category: "CTC",
    leafGrade: "BOP / BP Standard",
    currentPurchasePricePerKg: "",
    sampleWeightGrams: 100,
    primaryUseCase: "Commercial milk tea (chai) retail packaging",
    goalType: "lower_cost",
    targetPricePerKg: "",
    sensoryStrength: 4,
    sensoryBriskness: 4,
    sensoryAroma: 3,
    sensorySweetness: 3,
    notes: "",
    contactName: "",
    businessName: "",
    email: "",
    phone: "",
    gstin: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    acceptedTerms: false,
  });

  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [coverageChecking, setCoverageChecking] = useState<boolean>(false);
  const [coverageResult, setCoverageResult] = useState<{
    serviceable: boolean;
    carrier?: string;
    city?: string;
    state?: string;
    fallbackInstructions?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedProject, setSubmittedProject] = useState<BlendLabProjectRecord | null>(null);

  // Initialize in-memory idempotency key for this intake session
  useEffect(() => {
    setIdempotencyKey(`key_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  }, []);

  const updateField = <K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectedPlan = ORDERED_PLANS.find((p) => p.code === formData.planCode) || ORDERED_PLANS[0];
  const tax = splitTaxInclusive(selectedPlan.totalPaise, selectedPlan.taxRateBps);

  // Pincode coverage check
  const handlePincodeVerify = async (pin: string) => {
    if (!/^[1-9][0-9]{5}$/.test(pin)) return;
    setCoverageChecking(true);
    try {
      const res = await fetch("/api/blend-lab/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: pin }),
      });
      const data = await res.json();
      if (data.success) {
        setCoverageResult(data.coverage);
        if (data.coverage.city && !formData.city) {
          updateField("city", data.coverage.city);
        }
        if (data.coverage.state && !formData.state) {
          updateField("state", data.coverage.state);
        }
      }
    } catch {
      setCoverageResult({
        serviceable: true,
        carrier: "Express Courier Network",
      });
    } finally {
      setCoverageChecking(false);
    }
  };

  // Step 4 Validation
  const canProceedStep4 =
    formData.contactName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    /^[6-9][0-9]{9}$/.test(formData.phone) &&
    formData.addressLine1.trim().length >= 5 &&
    formData.city.trim().length >= 2 &&
    formData.state.trim().length >= 2 &&
    /^[1-9][0-9]{5}$/.test(formData.pincode);

  // Submit Draft to API
  const handleSubmitProject = async () => {
    if (!formData.acceptedTerms) {
      setSubmitError("Please accept the service terms to proceed.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        planCode: formData.planCode,
        idempotencyKey: idempotencyKey || `key_${Date.now()}`,
        sampleInfo: {
          category: formData.category,
          leafGrade: formData.leafGrade || "Standard Grade",
          currentPurchasePricePerKg: formData.currentPurchasePricePerKg
            ? parseFloat(formData.currentPurchasePricePerKg)
            : undefined,
          sampleWeightGrams: formData.sampleWeightGrams,
          primaryUseCase: formData.primaryUseCase,
        },
        commercialGoals: {
          goalType: formData.goalType,
          targetPricePerKg: formData.targetPricePerKg
            ? parseFloat(formData.targetPricePerKg)
            : undefined,
          sensorySliders: {
            strength: formData.sensoryStrength,
            astringency: formData.sensoryBriskness,
            aroma: formData.sensoryAroma,
            sweetness: formData.sensorySweetness,
          },
          notes: formData.notes,
        },
        pickupDetails: {
          contactName: formData.contactName,
          businessName: formData.businessName || undefined,
          email: formData.email,
          phone: formData.phone,
          gstin: formData.gstin || undefined,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2 || undefined,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        acceptedTermsVersion: "2026-v1",
      };

      const res = await fetch("/api/blend-lab/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit project draft");
      }

      trackLead("blend_lab_project");
      setSubmittedProject(data.project);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while creating project";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: "Plan Tier", icon: Package },
    { num: 2, label: "Tea Sample", icon: Coffee },
    { num: 3, label: "Cup Goals", icon: Target },
    { num: 4, label: "Pickup", icon: Truck },
    { num: 5, label: "Confirm", icon: CheckCircle2 },
  ];

  // If already submitted successfully, render confirmation screen:
  if (submittedProject) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl p-8 sm:p-12 border border-[#dde4dc] shadow-lg text-center space-y-6">
        <div className="w-16 h-16 bg-[#e5ece4] text-[#287455] rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-[#b8753d]">
            INTAKE SUBMITTED SUCCESSFULLY
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#092b23]">
            Your Blend Lab Project is Registered
          </h2>
          <p className="text-sm text-[#65746d]">
            A confirmation email has been dispatched to <strong>{submittedProject.contactEmail}</strong>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#f7f4ed] border border-[#dde4dc] text-left space-y-2 text-xs">
          <div className="flex justify-between border-b border-[#dde4dc] pb-2">
            <span className="text-[#65746d]">Project Reference ID:</span>
            <strong className="font-mono text-[#143c31]">{submittedProject.publicId}</strong>
          </div>
          <div className="flex justify-between border-b border-[#dde4dc] pb-2">
            <span className="text-[#65746d]">Selected Plan:</span>
            <strong className="text-[#143c31]">{selectedPlan.title}</strong>
          </div>
          <div className="flex justify-between border-b border-[#dde4dc] pb-2">
            <span className="text-[#65746d]">Total Price (incl. 18% GST):</span>
            <strong className="text-[#143c31]">{formatInr(submittedProject.totalPaise)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[#65746d]">Pickup Address:</span>
            <span className="text-[#143c31] text-right max-w-xs">{submittedProject.pickupAddress}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#e5ece4] text-xs text-[#143c31] text-left space-y-1">
          <strong className="block font-bold">What happens next:</strong>
          <p>
            1. Our dispatch team books your doorstep courier pickup within 24 hours.
          </p>
          <p>
            2. Prepare {selectedPlan.entitlements.sampleWeightGrams}g of your dry reference tea in an airtight pouch.
          </p>
          <p>
            3. Upon arrival at our Siliguri origin atelier, sensory cupping begins immediately.
          </p>
        </div>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <Link
            href="/blend-lab"
            className="px-6 py-3 rounded-full bg-[#143c31] text-white text-xs font-semibold hover:bg-[#092b23] transition-colors blend-lab-touch-target inline-flex items-center"
          >
            Return to Blend Lab Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* 5-Step Stepper Progress Bar */}
      <nav aria-label="Intake Steps" className="bg-white rounded-2xl p-4 sm:p-6 border border-[#dde4dc] shadow-sm">
        <ol className="grid grid-cols-5 gap-2 sm:gap-4">
          {stepsList.map((s) => {
            const isDone = s.num < step;
            const isCurrent = s.num === step;
            const Icon = s.icon;
            return (
              <li key={s.num} className="flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => s.num < step && setStep(s.num)}
                  disabled={s.num > step}
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-[#287455] text-white"
                      : isCurrent
                      ? "bg-[#143c31] text-[#d7b474] ring-2 ring-[#b8753d] ring-offset-2"
                      : "bg-[#f7f4ed] text-[#65746d] border border-[#dde4dc]"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </button>
                <span
                  className={`text-[10px] sm:text-xs font-semibold mt-2 ${
                    isCurrent ? "text-[#143c31]" : "text-[#65746d]"
                  }`}
                >
                  <span className="hidden sm:inline">Step {s.num}: </span>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Main Step Container */}
      <div className="bg-white rounded-2xl p-6 sm:p-10 border border-[#dde4dc] shadow-sm">
        {/* STEP 1: Plan Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b border-[#dde4dc] pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b8753d]">
                STEP 1 OF 5
              </span>
              <h2 className="text-2xl font-serif text-[#092b23] mt-1">
                Select Your Service Tier
              </h2>
              <p className="text-xs text-[#65746d]">
                Choose the service package that matches your operational needs. All plans include doorstep courier collection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ORDERED_PLANS.map((plan) => {
                const isSelected = formData.planCode === plan.code;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => updateField("planCode", plan.code)}
                    className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-[#143c31] bg-[#f7f4ed] ring-2 ring-[#143c31] shadow-md"
                        : "border-[#dde4dc] bg-white hover:border-[#143c31]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#b8753d]">
                          {plan.eyebrow}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#143c31] text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-[#092b23]">{plan.title}</h3>
                      <p className="text-xs text-[#65746d] leading-relaxed">{plan.tagline}</p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#dde4dc]/80">
                      <span className="text-2xl font-serif font-bold text-[#092b23]">
                        {formatInr(plan.totalPaise)}
                      </span>
                      <span className="block text-[11px] text-[#65746d]">
                        18% GST incl.
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-[#f7f4ed] border border-[#dde4dc] flex items-start gap-3 text-xs text-[#19332b]">
              <ShieldCheck className="w-5 h-5 text-[#287455] shrink-0 mt-0.5" />
              <div>
                <strong>Selected Tier Entitlement:</strong> {selectedPlan.title} includes {selectedPlan.entitlements.sampleWeightGrams}g sample pickup, {selectedPlan.entitlements.turnaroundDays}-day turnaround
                {selectedPlan.entitlements.detailedPdf ? ", full PDF cupping report" : ", sourcing quote & match notes (no PDF report)"}
                {selectedPlan.entitlements.developmentIncluded ? ", and 1 outbound physical trial shipment" : ""}.
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#143c31] text-white text-xs font-bold hover:bg-[#092b23] transition-colors blend-lab-touch-target"
              >
                <span>Continue to Tea Sample Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Tea Sample Information */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="border-b border-[#dde4dc] pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b8753d]">
                STEP 2 OF 5
              </span>
              <h2 className="text-2xl font-serif text-[#092b23] mt-1">
                Tell Us About Your Reference Tea
              </h2>
              <p className="text-xs text-[#65746d]">
                Provide background on the tea you are sending so the lab can configure appropriate water ratios and mesh sieves.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="tea-category" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Tea Category *
                </label>
                <select
                  id="tea-category"
                  value={formData.category}
                  onChange={(e) => updateField("category", e.target.value as IntakeFormState["category"])}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs bg-white text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                >
                  <option value="CTC">CTC (Crush, Tear, Curl) — Chai Grade</option>
                  <option value="orthodox">Orthodox Leaf (Darjeeling / Assam)</option>
                  <option value="green">Green Tea</option>
                  <option value="white">White Tea (Silver Needles / Bai Mu Dan)</option>
                  <option value="oolong">Oolong Tea</option>
                  <option value="flavoured">Flavoured / Herbal Blend</option>
                  <option value="other">Other / Custom Mixture</option>
                </select>
              </div>

              <div>
                <label htmlFor="leaf-grade" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Leaf Grade or Commercial Description
                </label>
                <input
                  id="leaf-grade"
                  type="text"
                  placeholder="e.g. BOP, BP, Dust, FTGFOP1"
                  value={formData.leafGrade}
                  onChange={(e) => updateField("leafGrade", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                />
              </div>

              <div>
                <label htmlFor="current-price" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Current Purchase Price per kg (Optional ₹ INR)
                </label>
                <input
                  id="current-price"
                  type="number"
                  placeholder="e.g. 320"
                  value={formData.currentPurchasePricePerKg}
                  onChange={(e) => updateField("currentPurchasePricePerKg", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                />
                <span className="text-[11px] text-[#65746d] mt-1 block">
                  Used by our tasters to calculate exact cost reduction opportunities.
                </span>
              </div>

              <div>
                <label htmlFor="sample-weight" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Sample Weight Confirmation *
                </label>
                <select
                  id="sample-weight"
                  value={formData.sampleWeightGrams}
                  onChange={(e) => updateField("sampleWeightGrams", parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs bg-white text-[#19332b] blend-lab-input blend-lab-touch-target"
                >
                  <option value={100}>100 Grams (Standard Reference Sample)</option>
                  <option value={200}>200 Grams (Recommended for Formulation Trials)</option>
                  <option value={500}>500 Grams (Extended Multi-Lot Evaluation)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="primary-use" className="block text-xs font-bold text-[#143c31] mb-1.5">
                Primary End-Use & Brewing Context *
              </label>
              <textarea
                id="primary-use"
                rows={3}
                placeholder="e.g. Boiled milk chai served in high-volume college cafes; requires quick color extraction and deep malty body."
                value={formData.primaryUseCase}
                onChange={(e) => updateField("primaryUseCase", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input"
                required
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#dde4dc] text-xs font-semibold text-[#143c31] hover:bg-[#f7f4ed] blend-lab-touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!formData.primaryUseCase.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#143c31] text-white text-xs font-bold hover:bg-[#092b23] disabled:opacity-50 transition-colors blend-lab-touch-target"
              >
                <span>Continue to Commercial Goals</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Commercial Goals & Sensory Sliders */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-b border-[#dde4dc] pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b8753d]">
                STEP 3 OF 5
              </span>
              <h2 className="text-2xl font-serif text-[#092b23] mt-1">
                Commercial Goals & Taste Targets
              </h2>
              <p className="text-xs text-[#65746d]">
                Define your ideal cup parameters. Our tasters will blend specifically toward these sensory benchmarks.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#143c31] mb-2">
                Primary Commercial Objective *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: "lower_cost" as const, label: "Reduce Cost (Protect Current Quality)" },
                  { id: "stronger_chai" as const, label: "Stronger Chai & Darker Color" },
                  { id: "consistent_cup" as const, label: "Seasonal Consistency & Stability" },
                  { id: "new_signature" as const, label: "New Signature Brand Blend" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateField("goalType", item.id)}
                    className={`p-3.5 rounded-lg border text-left text-xs font-semibold transition-all ${
                      formData.goalType === item.id
                        ? "border-[#143c31] bg-[#143c31] text-white"
                        : "border-[#dde4dc] bg-white text-[#19332b] hover:border-[#143c31]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div>
                <label htmlFor="target-price" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Target Price per kg (Optional ₹ INR)
                </label>
                <input
                  id="target-price"
                  type="number"
                  placeholder="e.g. 260"
                  value={formData.targetPricePerKg}
                  onChange={(e) => updateField("targetPricePerKg", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Strength & Extraction Target (1-5)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.sensoryStrength}
                    onChange={(e) => updateField("sensoryStrength", parseInt(e.target.value, 10))}
                    className="w-full accent-[#143c31]"
                  />
                  <span className="font-mono text-xs font-bold text-[#143c31] w-8">
                    {formData.sensoryStrength}/5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Briskness & Crisp Finish (1-5)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.sensoryBriskness}
                    onChange={(e) => updateField("sensoryBriskness", parseInt(e.target.value, 10))}
                    className="w-full accent-[#b8753d]"
                  />
                  <span className="font-mono text-xs font-bold text-[#143c31] w-8">
                    {formData.sensoryBriskness}/5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Leaf Fragrance & Nose Aroma (1-5)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.sensoryAroma}
                    onChange={(e) => updateField("sensoryAroma", parseInt(e.target.value, 10))}
                    className="w-full accent-[#d7b474]"
                  />
                  <span className="font-mono text-xs font-bold text-[#143c31] w-8">
                    {formData.sensoryAroma}/5
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-xs font-bold text-[#143c31] mb-1.5">
                Specific Tasting Instructions or Notes
              </label>
              <textarea
                id="notes"
                rows={2}
                placeholder="e.g. Avoid smoky taint; prefer golden liquoring winter flush Dooars leaf."
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#dde4dc] text-xs font-semibold text-[#143c31] hover:bg-[#f7f4ed] blend-lab-touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#143c31] text-white text-xs font-bold hover:bg-[#092b23] transition-colors blend-lab-touch-target"
              >
                <span>Continue to Pickup Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Pickup Pincode & Contact */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="border-b border-[#dde4dc] pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b8753d]">
                STEP 4 OF 5
              </span>
              <h2 className="text-2xl font-serif text-[#092b23] mt-1">
                Sample Pickup Address & Contact
              </h2>
              <p className="text-xs text-[#65746d]">
                Enter where our courier partner will collect your sample pouch. Verification happens automatically against serviceable PIN codes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Contact Person Name *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  placeholder="Your full name"
                  value={formData.contactName}
                  onChange={(e) => updateField("contactName", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                />
              </div>

              <div>
                <label htmlFor="business-name" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Business / Brand Name (Optional)
                </label>
                <input
                  id="business-name"
                  type="text"
                  placeholder="e.g. Royal Chai Co. or Tea Haven Cafe"
                  value={formData.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@business.com"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  10-Digit Mobile Number *
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="address1" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Street Address Line 1 *
                </label>
                <input
                  id="address1"
                  type="text"
                  placeholder="Shop / Unit No., Building Name, Street"
                  value={formData.addressLine1}
                  onChange={(e) => updateField("addressLine1", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                />
              </div>

              <div>
                <label htmlFor="address2" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  Address Line 2 (Optional)
                </label>
                <input
                  id="address2"
                  type="text"
                  placeholder="Landmark, Area"
                  value={formData.addressLine2}
                  onChange={(e) => updateField("addressLine2", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                />
              </div>

              <div>
                <label htmlFor="pincode" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  6-Digit Indian PIN Code *
                </label>
                <div className="relative">
                  <input
                    id="pincode"
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 700001 or 110001"
                    value={formData.pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      updateField("pincode", val);
                      if (val.length === 6) handlePincodeVerify(val);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                    required
                  />
                  {coverageChecking && (
                    <div className="absolute right-3 top-3 text-[#143c31] animate-spin">
                      <Loader2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {coverageResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs ${
                      coverageResult.serviceable
                        ? "bg-[#e5ece4] text-[#143c31]"
                        : "bg-[#fdf2f2] text-[#a43d38]"
                    }`}
                  >
                    {coverageResult.serviceable ? (
                      <span>
                        ✓ Serviceable for pickup via {coverageResult.carrier || "Courier Partner"}.
                      </span>
                    ) : (
                      <span>
                        ⚠️ {coverageResult.fallbackInstructions || "Courier pickup limited for this PIN code."}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="city" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  City *
                </label>
                <input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-xs font-bold text-[#143c31] mb-1.5">
                  State *
                </label>
                <input
                  id="state"
                  type="text"
                  value={formData.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#dde4dc] text-xs text-[#19332b] blend-lab-input blend-lab-touch-target"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#dde4dc] text-xs font-semibold text-[#143c31] hover:bg-[#f7f4ed] blend-lab-touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={!canProceedStep4}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#143c31] text-white text-xs font-bold hover:bg-[#092b23] disabled:opacity-50 transition-colors blend-lab-touch-target"
              >
                <span>Review & Confirm Order</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Confirm */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="border-b border-[#dde4dc] pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b8753d]">
                STEP 5 OF 5
              </span>
              <h2 className="text-2xl font-serif text-[#092b23] mt-1">
                Review & Register Intake Project
              </h2>
              <p className="text-xs text-[#65746d]">
                Verify your order details. Once submitted, your pickup request is scheduled with our origin laboratory in Siliguri.
              </p>
            </div>

            {/* Summary Review Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#f7f4ed] border border-[#dde4dc] space-y-2 text-xs">
                <span className="font-bold text-[#143c31] block uppercase tracking-wider">
                  Service & Pricing Breakdown
                </span>
                <div className="flex justify-between">
                  <span className="text-[#65746d]">Selected Plan:</span>
                  <strong className="text-[#092b23]">{selectedPlan.title}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#65746d]">Base Fee:</span>
                  <span>{formatInr(tax.basePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#65746d]">B2B GST (18%):</span>
                  <span>{formatInr(tax.taxPaise)}</span>
                </div>
                <div className="flex justify-between border-t border-[#dde4dc] pt-2 font-bold text-sm text-[#092b23]">
                  <span>Total Amount (Inclusive):</span>
                  <span>{formatInr(selectedPlan.totalPaise)}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f7f4ed] border border-[#dde4dc] space-y-2 text-xs">
                <span className="font-bold text-[#143c31] block uppercase tracking-wider">
                  Sample & Pickup Information
                </span>
                <div className="flex justify-between">
                  <span className="text-[#65746d]">Contact:</span>
                  <strong>{formData.contactName} ({formData.phone})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#65746d]">Sample:</span>
                  <span>{formData.category} ({formData.leafGrade}) · {formData.sampleWeightGrams}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#65746d]">Address:</span>
                  <span className="text-right max-w-xs">{formData.addressLine1}, {formData.city} ({formData.pincode})</span>
                </div>
              </div>
            </div>

            {/* Terms Acceptance */}
            <div className="p-4 rounded-xl border border-[#dde4dc] bg-white space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptedTerms}
                  onChange={(e) => updateField("acceptedTerms", e.target.checked)}
                  className="mt-1 accent-[#143c31] w-4 h-4 shrink-0"
                  required
                />
                <span className="text-xs text-[#19332b] leading-relaxed">
                  I confirm that I will provide a genuine tea reference sample of at least {selectedPlan.entitlements.sampleWeightGrams}g. I understand and accept the TeaFloww Blend Lab service terms, commercial confidentiality policies, and GST invoicing procedures.
                </span>
              </label>

              {submitError && (
                <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#f5c6cb] text-xs text-[#721c24] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#a43d38]" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#dde4dc] text-xs font-semibold text-[#143c31] hover:bg-[#f7f4ed] blend-lab-touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleSubmitProject}
                disabled={submitting || !formData.acceptedTerms}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#143c31] text-white text-xs font-bold hover:bg-[#092b23] disabled:opacity-50 transition-all shadow-md blend-lab-touch-target"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering Project...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Project Draft & Generate Slip</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
