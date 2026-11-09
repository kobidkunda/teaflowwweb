"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FlaskConical,
  DollarSign,
  Package,
  MapPin,
  FileText,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit,
  ExternalLink,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Clock,
  ShieldCheck,
  Truck,
  Sparkles,
} from "lucide-react";
import type { ServicePlan } from "@/lib/blend-lab/plans";
import type { BlendLabProjectRecord } from "@/lib/blend-lab/projects";
import type { PincodeCoverageResult } from "@/lib/blend-lab/coverage";
import type { BlendLabContentData, BlendLabFaqItem } from "@/lib/blend-lab/content";

type TabKey = "plans" | "projects" | "coverage" | "content";

export function BlendLabAdminClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("plans");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
            toastMessage.type === "success"
              ? "bg-[#eef5f1] border-[#3d6e5a] text-[#143c31]"
              : "bg-[#fdf2f2] border-[#b03a2e] text-[#78281f]"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-[#2b7a4b] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#b03a2e] shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-75"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#dde4dc] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b8753d]">
            <FlaskConical className="w-4 h-4" />
            <span>Storefront & Catalog / Blend Lab</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#092b23] mt-1">
            TeaFloww Blend Lab Atelier
          </h1>
          <p className="text-xs sm:text-sm text-[#65746d] mt-0.5">
            Manage custom tea formulation tiers, customer intake submissions, pickup coverage, and marketing content.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/blend-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#143c31] bg-white border border-[#dde4dc] rounded-lg hover:border-[#143c31] transition-colors"
          >
            <span>Preview Storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#dde4dc] gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "plans"
              ? "border-[#143c31] text-[#143c31]"
              : "border-transparent text-[#65746d] hover:text-[#143c31]"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Service Plans & Pricing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "projects"
              ? "border-[#143c31] text-[#143c31]"
              : "border-transparent text-[#65746d] hover:text-[#143c31]"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Intake Projects & Leads</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("coverage")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "coverage"
              ? "border-[#143c31] text-[#143c31]"
              : "border-transparent text-[#65746d] hover:text-[#143c31]"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>PIN Code Coverage</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "content"
              ? "border-[#143c31] text-[#143c31]"
              : "border-transparent text-[#65746d] hover:text-[#143c31]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Content & Media Placements</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "plans" && <PlansTab onToast={showToast} />}
      {activeTab === "projects" && <ProjectsTab onToast={showToast} />}
      {activeTab === "coverage" && <CoverageTab onToast={showToast} />}
      {activeTab === "content" && <ContentTab onToast={showToast} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 1: SERVICE PLANS                                                       */
/* -------------------------------------------------------------------------- */

function PlansTab({ onToast }: { onToast: (type: "success" | "error", text: string) => void }) {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blend-lab/plans");
      const data = await res.json();
      if (res.ok && data.plans) {
        setPlans(data.plans);
      } else {
        onToast("error", data.error || "Failed to load plans.");
      }
    } catch {
      onToast("error", "Network error loading plans.");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm text-[#65746d]">
          Authoritative pricing and service entitlements. Prices are stored in integer INR paise and inclusive of 18% GST.
        </p>
        <button
          type="button"
          onClick={fetchPlans}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#143c31] bg-white border border-[#dde4dc] rounded hover:border-[#143c31]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[#65746d]">Loading service plans...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className={`rounded-xl border p-6 flex flex-col justify-between transition-all ${
                plan.highlighted
                  ? "border-[#143c31] bg-white shadow-sm ring-1 ring-[#143c31]/20"
                  : "border-[#dde4dc] bg-white"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#b8753d]">
                    {plan.eyebrow || plan.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {plan.badge && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#eef5f1] text-[#143c31]">
                        {plan.badge}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        plan.active !== false
                          ? "bg-[#eef5f1] text-[#2b7a4b]"
                          : "bg-[#fdf2f2] text-[#b03a2e]"
                      }`}
                    >
                      {plan.active !== false ? "Active" : "Disabled"}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-serif text-[#092b23]">{plan.title}</h3>
                <p className="text-xs text-[#65746d] line-clamp-2">{plan.tagline || plan.description}</p>

                <div className="pt-2 border-t border-[#dde4dc]/70">
                  <div className="text-2xl font-serif text-[#143c31]">
                    ₹{(plan.totalPaise / 100).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-[#65746d]">
                    {plan.totalPaise} paise • Inclusive of 18% GST ({(plan.taxRateBps ?? 1800) / 100}%)
                  </div>
                </div>

                <div className="pt-2 text-xs space-y-1 text-[#43534b]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#b8753d]" />
                    <span>Turnaround: {plan.entitlements?.turnaroundDays ?? 7} business days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-[#b8753d]" />
                    <span>Inbound pickups: {plan.entitlements?.inboundShipments ?? 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#b8753d]" />
                    <span>Outbound trials: {plan.entitlements?.outboundShipments ?? 0}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#dde4dc]/70">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#65746d] mb-1.5">
                    Features ({plan.features?.length || 0})
                  </div>
                  <ul className="text-xs space-y-1 text-[#65746d]">
                    {plan.features?.slice(0, 3).map((f, i) => (
                      <li key={i} className="line-clamp-1">• {f}</li>
                    ))}
                    {(plan.features?.length || 0) > 3 && (
                      <li className="text-[11px] text-[#b8753d]">
                        +{(plan.features?.length || 0) - 3} more features
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-[#dde4dc]">
                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-[#143c31] bg-[#f7f4ed] hover:bg-[#dde4dc] rounded-lg transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Plan & Pricing</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Edit Modal */}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => {
            setEditingPlan(null);
            fetchPlans();
            onToast("success", "Service plan updated successfully.");
          }}
          onError={(msg) => onToast("error", msg)}
        />
      )}
    </div>
  );
}

function PlanEditModal({
  plan,
  onClose,
  onSaved,
  onError,
}: {
  plan: ServicePlan;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(plan.title);
  const [priceInr, setPriceInr] = useState(String(plan.totalPaise / 100));
  const [taxRatePercent, setTaxRatePercent] = useState(String((plan.taxRateBps ?? 1800) / 100));
  const [active, setActive] = useState(plan.active !== false);
  const [highlighted, setHighlighted] = useState(Boolean(plan.highlighted));
  const [badge, setBadge] = useState(plan.badge || "");
  const [eyebrow, setEyebrow] = useState(plan.eyebrow || "");
  const [tagline, setTagline] = useState(plan.tagline || "");
  const [description, setDescription] = useState(plan.description || "");
  const [turnaroundDays, setTurnaroundDays] = useState(String(plan.entitlements?.turnaroundDays ?? 7));
  const [featuresText, setFeaturesText] = useState((plan.features || []).join("\n"));
  const [exclusionsText, setExclusionsText] = useState((plan.exclusions || []).join("\n"));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inr = Number.parseFloat(priceInr);
    if (Number.isNaN(inr) || inr < 0) {
      onError("Please provide a valid price in INR.");
      return;
    }
    const totalPaise = Math.round(inr * 100);
    const taxRateBps = Math.round((Number.parseFloat(taxRatePercent) || 18) * 100);

    const features = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const exclusions = exclusionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/blend-lab/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: plan.code,
          title: title.trim(),
          eyebrow: eyebrow.trim() || undefined,
          tagline: tagline.trim() || undefined,
          description: description.trim() || undefined,
          totalPaise,
          taxRateBps,
          active,
          highlighted,
          badge: badge.trim() || null,
          features,
          exclusions,
          entitlements: {
            turnaroundDays: Number.parseInt(turnaroundDays, 10) || 7,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.plan) {
        onSaved();
      } else {
        onError(data.error || "Failed to save plan.");
      }
    } catch {
      onError("Network error saving plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#dde4dc] flex items-center justify-between bg-[#f7f4ed]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#b8753d]">
              {plan.code}
            </span>
            <h2 className="text-lg font-serif text-[#092b23]">Edit Service Plan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#65746d] hover:text-[#092b23] rounded"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan-title" className="block text-xs font-bold text-[#143c31] mb-1">
                Plan Title
              </label>
              <input
                id="plan-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>

            <div>
              <label htmlFor="plan-eyebrow" className="block text-xs font-bold text-[#143c31] mb-1">
                Eyebrow Label
              </label>
              <input
                id="plan-eyebrow"
                type="text"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan-price" className="block text-xs font-bold text-[#143c31] mb-1">
                Price (INR ₹)
              </label>
              <input
                id="plan-price"
                type="number"
                step="1"
                min="0"
                value={priceInr}
                onChange={(e) => setPriceInr(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
              <span className="text-[11px] text-[#65746d]">
                Auto-converts to {Math.round((Number.parseFloat(priceInr) || 0) * 100)} integer paise
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="plan-tax" className="block text-xs font-bold text-[#143c31] mb-1">
                GST Rate (%)
              </label>
              <input
                id="plan-tax"
                type="number"
                step="0.5"
                min="0"
                max="28"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>

            <div>
              <label htmlFor="plan-days" className="block text-xs font-bold text-[#143c31] mb-1">
                Turnaround (Days)
              </label>
              <input
                id="plan-days"
                type="number"
                min="1"
                max="60"
                value={turnaroundDays}
                onChange={(e) => setTurnaroundDays(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>

            <div>
              <label htmlFor="plan-badge" className="block text-xs font-bold text-[#143c31] mb-1">
                Badge (Optional)
              </label>
              <input
                id="plan-badge"
                type="text"
                placeholder="e.g. Most Complete"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-[#143c31] rounded"
              />
              <span className="text-xs font-bold text-[#143c31]">Active on Storefront</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={highlighted}
                onChange={(e) => setHighlighted(e.target.checked)}
                className="w-4 h-4 text-[#143c31] rounded"
              />
              <span className="text-xs font-bold text-[#143c31]">Highlighted Tier</span>
            </label>
          </div>

          <div>
            <label htmlFor="plan-tagline" className="block text-xs font-bold text-[#143c31] mb-1">
              Tagline
            </label>
            <input
              id="plan-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
            />
          </div>

          <div>
            <label htmlFor="plan-desc" className="block text-xs font-bold text-[#143c31] mb-1">
              Description
            </label>
            <textarea
              id="plan-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
            />
          </div>

          <div>
            <label htmlFor="plan-features" className="block text-xs font-bold text-[#143c31] mb-1">
              Features (one per line)
            </label>
            <textarea
              id="plan-features"
              rows={4}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none font-mono text-xs"
            />
          </div>

          <div>
            <label htmlFor="plan-exclusions" className="block text-xs font-bold text-[#143c31] mb-1">
              Exclusions (one per line)
            </label>
            <textarea
              id="plan-exclusions"
              rows={3}
              value={exclusionsText}
              onChange={(e) => setExclusionsText(e.target.value)}
              className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none font-mono text-xs"
            />
          </div>

          <div className="pt-4 border-t border-[#dde4dc] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#65746d] hover:text-[#092b23]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#143c31] hover:bg-[#092b23] rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving Plan..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 2: INTAKE PROJECTS & LEADS                                             */
/* -------------------------------------------------------------------------- */

function ProjectsTab({ onToast }: { onToast: (type: "success" | "error", text: string) => void }) {
  const [projects, setProjects] = useState<BlendLabProjectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<BlendLabProjectRecord | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") q.set("status", statusFilter);
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/admin/blend-lab/projects?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.projects) {
        setProjects(data.projects);
        setTotal(data.total);
      } else {
        onToast("error", data.error || "Failed to load projects.");
      }
    } catch {
      onToast("error", "Network error loading projects.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, onToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#65746d] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by ID, client, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-[#dde4dc] rounded-lg bg-white focus:border-[#143c31] outline-none"
          >
            <option value="all">All Workflow States</option>
            <option value="draft_submitted">Draft Submitted</option>
            <option value="sample_received">Sample Received</option>
            <option value="cupping_in_progress">Cupping In Progress</option>
            <option value="report_ready">Report Ready</option>
            <option value="trial_dispatched">Trial Dispatched</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={fetchProjects}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#143c31] bg-white border border-[#dde4dc] rounded-lg hover:border-[#143c31]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Projects Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[#65746d]">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="py-12 text-center border rounded-xl bg-white border-[#dde4dc] text-sm text-[#65746d]">
          No intake projects found matching the criteria.
        </div>
      ) : (
        <div className="rounded-xl border border-[#dde4dc] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f4ed] border-b border-[#dde4dc] text-[#143c31] font-bold">
                <tr>
                  <th className="px-4 py-3">Public Ref</th>
                  <th className="px-4 py-3">Customer / Brand</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Tea Category</th>
                  <th className="px-4 py-3">Workflow State</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dde4dc]">
                {projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-[#f7f4ed]/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-[#143c31]">
                      {proj.publicId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#092b23]">
                        {proj.businessName || proj.contactName}
                      </div>
                      <div className="text-[11px] text-[#65746d]">{proj.contactEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#143c31]">
                        {proj.planCode === "MATCH_QUOTE"
                          ? "Match & Quote"
                          : proj.planCode === "QUALITY_AUDIT"
                          ? "Quality Audit"
                          : "Signature Blend"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#43534b]">
                      {proj.sampleInfo?.category || "Standard"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#eef5f1] text-[#143c31]">
                        {proj.workflowState.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          proj.paymentState === "paid"
                            ? "bg-[#eef5f1] text-[#2b7a4b]"
                            : "bg-[#fdf2f2] text-[#b03a2e]"
                        }`}
                      >
                        {proj.paymentState}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#65746d]">
                      {new Date(proj.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedProject(proj)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#143c31] bg-[#f7f4ed] hover:bg-[#dde4dc] rounded transition-colors"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#dde4dc] bg-[#f7f4ed] text-[11px] text-[#65746d] flex justify-between items-center">
            <span>Showing {projects.length} of {total} records</span>
          </div>
        </div>
      )}

      {/* Project Details Drawer */}
      {selectedProject && (
        <ProjectDrawer
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdated={(updated) => {
            setSelectedProject(updated);
            fetchProjects();
            onToast("success", `Project ${updated.publicId} updated.`);
          }}
          onError={(msg) => onToast("error", msg)}
        />
      )}
    </div>
  );
}

function ProjectDrawer({
  project,
  onClose,
  onUpdated,
  onError,
}: {
  project: BlendLabProjectRecord;
  onClose: () => void;
  onUpdated: (p: BlendLabProjectRecord) => void;
  onError: (msg: string) => void;
}) {
  const [workflowState, setWorkflowState] = useState(project.workflowState);
  const [paymentState, setPaymentState] = useState(project.paymentState);
  const [notes, setNotes] = useState(project.commercialGoals?.notes || "");
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/blend-lab/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowState,
          paymentState,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        onUpdated(data.project);
      } else {
        onError(data.error || "Failed to update project.");
      }
    } catch {
      onError("Network error updating project.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#dde4dc] flex items-center justify-between bg-[#f7f4ed]">
          <div>
            <div className="text-[10px] font-mono text-[#b8753d] font-bold">
              {project.publicId}
            </div>
            <h2 className="text-lg font-serif text-[#092b23]">
              {project.businessName || project.contactName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#65746d] hover:text-[#092b23] rounded"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Status Controls */}
          <div className="bg-[#f7f4ed] p-4 rounded-xl border border-[#dde4dc] space-y-3">
            <div className="font-bold text-[#143c31] text-xs">Workflow & Payment Transition</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="workflow-state" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                  Workflow State
                </label>
                <select
                  id="workflow-state"
                  value={workflowState}
                  onChange={(e) => setWorkflowState(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-[#dde4dc] rounded bg-white"
                >
                  <option value="draft_submitted">draft_submitted</option>
                  <option value="awaiting_payment">awaiting_payment</option>
                  <option value="paid">paid</option>
                  <option value="pickup_requested">pickup_requested</option>
                  <option value="awaiting_sample">awaiting_sample</option>
                  <option value="sample_received">sample_received</option>
                  <option value="tasting_in_progress">tasting_in_progress</option>
                  <option value="report_ready">report_ready</option>
                  <option value="quote_ready">quote_ready</option>
                  <option value="trial_dispatch_pending">trial_dispatch_pending</option>
                  <option value="trial_in_transit">trial_in_transit</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>

              <div>
                <label htmlFor="payment-state" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                  Payment State
                </label>
                <select
                  id="payment-state"
                  value={paymentState}
                  onChange={(e) => setPaymentState(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-[#dde4dc] rounded bg-white"
                >
                  <option value="draft">draft</option>
                  <option value="pending">pending</option>
                  <option value="paid">paid</option>
                  <option value="refund_pending">refund_pending</option>
                  <option value="refunded">refunded</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="project-notes" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                Cupping & Sourcing Notes
              </label>
              <textarea
                id="project-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal tasting notes, garden lots evaluated..."
                className="w-full px-3 py-1.5 text-xs border border-[#dde4dc] rounded bg-white"
              />
            </div>

            <button
              type="button"
              disabled={updating}
              onClick={handleUpdate}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#143c31] hover:bg-[#092b23] rounded transition-colors disabled:opacity-50"
            >
              {updating ? "Updating..." : "Save State Update"}
            </button>
          </div>

          {/* Contact & Logistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-[#dde4dc] p-3.5 rounded-lg space-y-1.5">
              <div className="font-bold text-[#143c31]">Contact Details</div>
              <div><span className="text-[#65746d]">Name:</span> {project.contactName}</div>
              <div><span className="text-[#65746d]">Email:</span> {project.contactEmail}</div>
              <div><span className="text-[#65746d]">Phone:</span> {project.contactPhone}</div>
              {project.businessName && (
                <div><span className="text-[#65746d]">Business:</span> {project.businessName}</div>
              )}
            </div>

            <div className="border border-[#dde4dc] p-3.5 rounded-lg space-y-1.5">
              <div className="font-bold text-[#143c31]">Pickup Address</div>
              <div><span className="text-[#65746d]">Address:</span> {project.pickupAddress}</div>
              <div><span className="text-[#65746d]">PIN Code:</span> {project.pickupPincode}</div>
              <div>
                <span className="text-[#65746d]">Serviceable:</span>{" "}
                <span className={project.pickupServiceable ? "text-[#2b7a4b] font-bold" : "text-[#b03a2e] font-bold"}>
                  {project.pickupServiceable ? "Yes (Courier Enabled)" : "No (Manual Dispatch)"}
                </span>
              </div>
            </div>
          </div>

          {/* Sample Brief */}
          {project.sampleInfo && (
            <div className="border border-[#dde4dc] p-3.5 rounded-lg space-y-1.5">
              <div className="font-bold text-[#143c31]">Supplied Reference Sample</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-[#65746d] block">Category</span>
                  <span className="font-semibold">{project.sampleInfo.category}</span>
                </div>
                <div>
                  <span className="text-[#65746d] block">Leaf Grade</span>
                  <span className="font-semibold">{project.sampleInfo.leafGrade || "Unspecified"}</span>
                </div>
                <div>
                  <span className="text-[#65746d] block">Current Cost</span>
                  <span className="font-semibold">
                    {project.sampleInfo.currentPricePerKg ? `₹${project.sampleInfo.currentPricePerKg}/kg` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#65746d] block">Sample Size</span>
                  <span className="font-semibold">{project.sampleInfo.sampleWeightGrams}g</span>
                </div>
              </div>
            </div>
          )}

          {/* Commercial Goals */}
          {project.commercialGoals && (
            <div className="border border-[#dde4dc] p-3.5 rounded-lg space-y-2">
              <div className="font-bold text-[#143c31]">Commercial Formulation Goals</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#65746d] block">Goal Type</span>
                  <span className="font-semibold uppercase">{project.commercialGoals.goalType}</span>
                </div>
                <div>
                  <span className="text-[#65746d] block">Target Cost per Kg</span>
                  <span className="font-semibold">
                    {project.commercialGoals.targetPricePerKg ? `₹${project.commercialGoals.targetPricePerKg}/kg` : "—"}
                  </span>
                </div>
              </div>

              {project.commercialGoals.sensoryTargets && (
                <div className="pt-2 border-t border-[#dde4dc]/60">
                  <span className="text-[#65746d] block mb-1 font-semibold">Sensory Targets (1-5 scale)</span>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(project.commercialGoals.sensoryTargets).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-[#f7f4ed] border border-[#dde4dc] text-[10px] font-bold">
                        {k}: {v}/5
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 3: PIN CODE COVERAGE                                                   */
/* -------------------------------------------------------------------------- */

function CoverageTab({ onToast }: { onToast: (type: "success" | "error", text: string) => void }) {
  const [coverageList, setCoverageList] = useState<PincodeCoverageResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingEntry, setEditingEntry] = useState<PincodeCoverageResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/admin/blend-lab/coverage?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.coverage) {
        setCoverageList(data.coverage);
        setTotal(data.total);
      } else {
        onToast("error", data.error || "Failed to load coverage.");
      }
    } catch {
      onToast("error", "Network error loading coverage.");
    } finally {
      setLoading(false);
    }
  }, [search, onToast]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const handleDelete = async (pincode: string) => {
    if (!confirm(`Are you sure you want to remove coverage override for PIN ${pincode}?`)) return;
    try {
      const res = await fetch(`/api/admin/blend-lab/coverage?pincode=${pincode}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast("success", `Coverage for PIN ${pincode} removed.`);
        fetchCoverage();
      } else {
        onToast("error", "Failed to delete coverage entry.");
      }
    } catch {
      onToast("error", "Network error deleting coverage.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#65746d] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by PIN, City, State, or Carrier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCoverage}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#143c31] bg-white border border-[#dde4dc] rounded-lg hover:border-[#143c31]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#143c31] hover:bg-[#092b23] rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add PIN Override</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[#65746d]">Loading coverage database...</div>
      ) : coverageList.length === 0 ? (
        <div className="py-12 text-center border rounded-xl bg-white border-[#dde4dc] text-sm text-[#65746d]">
          No explicit PIN code rules configured. Pan-India general fallback applies.
        </div>
      ) : (
        <div className="rounded-xl border border-[#dde4dc] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f4ed] border-b border-[#dde4dc] text-[#143c31] font-bold">
                <tr>
                  <th className="px-4 py-3">PIN Code</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Serviceable</th>
                  <th className="px-4 py-3">Carrier Partner</th>
                  <th className="px-4 py-3">Transit Est.</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dde4dc]">
                {coverageList.map((cov) => (
                  <tr key={cov.pincode} className="hover:bg-[#f7f4ed]/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#143c31]">
                      {cov.pincode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#092b23]">{cov.city || "—"}</td>
                    <td className="px-4 py-3 text-[#43534b]">{cov.state || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          cov.serviceable
                            ? "bg-[#eef5f1] text-[#2b7a4b]"
                            : "bg-[#fdf2f2] text-[#b03a2e]"
                        }`}
                      >
                        {cov.serviceable ? "Serviceable" : "Self-Dispatch Only"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#65746d]">{cov.carrier || "Express Cargo"}</td>
                    <td className="px-4 py-3 text-[#65746d]">{cov.estimatedPickupDays ?? 3} days</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingEntry(cov)}
                        className="p-1 hover:text-[#143c31] text-[#65746d]"
                        title="Edit PIN Coverage"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cov.pincode)}
                        className="p-1 hover:text-[#b03a2e] text-[#65746d]"
                        title="Delete PIN Coverage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#dde4dc] bg-[#f7f4ed] text-[11px] text-[#65746d]">
            Total {total} specific PIN overrides configured.
          </div>
        </div>
      )}

      {/* Coverage Upsert Modal */}
      {(isCreating || editingEntry) && (
        <CoverageModal
          initialData={editingEntry}
          onClose={() => {
            setIsCreating(false);
            setEditingEntry(null);
          }}
          onSaved={() => {
            setIsCreating(false);
            setEditingEntry(null);
            fetchCoverage();
            onToast("success", "PIN coverage saved.");
          }}
          onError={(msg) => onToast("error", msg)}
        />
      )}
    </div>
  );
}

function CoverageModal({
  initialData,
  onClose,
  onSaved,
  onError,
}: {
  initialData: PincodeCoverageResult | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [pincode, setPincode] = useState(initialData?.pincode || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [state, setState] = useState(initialData?.state || "");
  const [carrier, setCarrier] = useState(initialData?.carrier || "Blue Dart Express");
  const [estimatedDays, setEstimatedDays] = useState(String(initialData?.estimatedPickupDays ?? 3));
  const [serviceable, setServiceable] = useState(initialData?.serviceable ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/blend-lab/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pincode: pincode.trim(),
          city: city.trim(),
          state: state.trim(),
          carrier: carrier.trim(),
          estimatedDays: Number.parseInt(estimatedDays, 10) || 3,
          serviceable,
        }),
      });
      const data = await res.json();
      if (res.ok && data.coverage) {
        onSaved();
      } else {
        onError(data.error || "Failed to save coverage.");
      }
    } catch {
      onError("Network error saving coverage.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-[#dde4dc] flex items-center justify-between bg-[#f7f4ed]">
          <h2 className="text-base font-serif text-[#092b23]">
            {initialData ? `Edit PIN ${initialData.pincode}` : "Add Postal PIN Code"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-[#65746d] hover:text-[#092b23]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label htmlFor="cov-pin" className="block text-xs font-bold text-[#143c31] mb-1">
              6-Digit Indian PIN Code
            </label>
            <input
              id="cov-pin"
              type="text"
              pattern="^[1-9][0-9]{5}$"
              maxLength={6}
              required
              disabled={Boolean(initialData)}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 734001"
              className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cov-city" className="block text-xs font-bold text-[#143c31] mb-1">
                City / Hub
              </label>
              <input
                id="cov-city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Siliguri"
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
            <div>
              <label htmlFor="cov-state" className="block text-xs font-bold text-[#143c31] mb-1">
                State
              </label>
              <input
                id="cov-state"
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. West Bengal"
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cov-carrier" className="block text-xs font-bold text-[#143c31] mb-1">
                Carrier Partner
              </label>
              <input
                id="cov-carrier"
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. Blue Dart"
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
            <div>
              <label htmlFor="cov-days" className="block text-xs font-bold text-[#143c31] mb-1">
                Transit Days
              </label>
              <input
                id="cov-days"
                type="number"
                min="1"
                max="30"
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={serviceable}
              onChange={(e) => setServiceable(e.target.checked)}
              className="w-4 h-4 text-[#143c31] rounded"
            />
            <span className="text-xs font-bold text-[#143c31]">Doorstep Courier Serviceable</span>
          </label>

          <div className="pt-4 border-t border-[#dde4dc] flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-[#65746d]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#143c31] hover:bg-[#092b23] rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save PIN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 4: CONTENT & MEDIA PLACEMENTS                                          */
/* -------------------------------------------------------------------------- */

function ContentTab({ onToast }: { onToast: (type: "success" | "error", text: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [homeEyebrow, setHomeEyebrow] = useState("");
  const [homeTitle, setHomeTitle] = useState("");
  const [homeDescription, setHomeDescription] = useState("");
  const [homeImageUrl, setHomeImageUrl] = useState("");
  const [homeImageAlt, setHomeImageAlt] = useState("");

  const [heroEyebrow, setHeroEyebrow] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImageAlt, setHeroImageAlt] = useState("");

  const [faqs, setFaqs] = useState<BlendLabFaqItem[]>([]);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blend-lab/content");
      const data: BlendLabContentData = await res.json();
      if (res.ok) {
        setHomeEyebrow(data.texts.homeEyebrow);
        setHomeTitle(data.texts.homeTitle);
        setHomeDescription(data.texts.homeDescription);
        setHomeImageUrl(data.homePlacement?.image_url || "/images/blend-lab/sensory-table.jpg");
        setHomeImageAlt(data.homePlacement?.alt_text || "Blend Lab sensory cupping discovery");

        setHeroEyebrow(data.texts.heroEyebrow);
        setHeroTitle(data.texts.heroTitle);
        setHeroDescription(data.texts.heroDescription);
        setHeroImageUrl(data.heroPlacement?.image_url || "/images/blend-lab/hero-cupping.jpg");
        setHeroImageAlt(data.heroPlacement?.alt_text || "TeaFloww Blend Lab Atelier cupping table");

        setFaqs(data.faqs || []);
      } else {
        onToast("error", "Failed to load content.");
      }
    } catch {
      onToast("error", "Network error loading content.");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/blend-lab/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeEyebrow,
          homeTitle,
          homeDescription,
          heroEyebrow,
          heroTitle,
          heroDescription,
          heroImage: {
            imageUrl: heroImageUrl,
            altText: heroImageAlt,
          },
          homeImage: {
            imageUrl: homeImageUrl,
            altText: homeImageAlt,
          },
          faqs,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast("success", "Blend Lab content & media placements saved!");
      } else {
        onToast("error", data.error || "Failed to update content.");
      }
    } catch {
      onToast("error", "Network error updating content.");
    } finally {
      setSaving(false);
    }
  };

  const handleFaqChange = (index: number, field: "question" | "answer", val: string) => {
    setFaqs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const addFaq = () => {
    setFaqs((prev) => [...prev, { question: "New Question", answer: "Answer here." }]);
  };

  const removeFaq = (index: number) => {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-[#65746d]">Loading content blocks...</div>;
  }

  return (
    <form onSubmit={handleSaveAll} className="space-y-8 text-xs sm:text-sm">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#dde4dc]">
        <p className="text-xs text-[#65746d]">
          Update copy, hero imagery, homepage discovery card, and FAQs dynamically across the storefront.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 text-xs font-bold text-white bg-[#143c31] hover:bg-[#092b23] rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? "Saving All..." : "Publish Content Changes"}
        </button>
      </div>

      {/* 1. Blend Lab Landing Page Hero Banner */}
      <div className="bg-white rounded-xl border border-[#dde4dc] p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#143c31] uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-[#b8753d]" />
          <span>Landing Page Hero Banner (/blend-lab)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label htmlFor="hero-eyebrow" className="block text-xs font-bold text-[#143c31] mb-1">
                Hero Eyebrow
              </label>
              <input
                id="hero-eyebrow"
                type="text"
                value={heroEyebrow}
                onChange={(e) => setHeroEyebrow(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>

            <div>
              <label htmlFor="hero-title" className="block text-xs font-bold text-[#143c31] mb-1">
                Hero Heading
              </label>
              <input
                id="hero-title"
                type="text"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none font-serif text-base text-[#092b23]"
              />
            </div>

            <div>
              <label htmlFor="hero-desc" className="block text-xs font-bold text-[#143c31] mb-1">
                Hero Subheading / Description
              </label>
              <textarea
                id="hero-desc"
                rows={3}
                value={heroDescription}
                onChange={(e) => setHeroDescription(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 bg-[#f7f4ed] p-4 rounded-xl border border-[#dde4dc]">
            <span className="text-xs font-bold text-[#143c31] block">Hero Image Placement (`blend_lab_hero`)</span>
            <div>
              <label htmlFor="hero-img-url" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                Image URL (from /admin/media or /uploads)
              </label>
              <input
                id="hero-img-url"
                type="text"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg bg-white focus:border-[#143c31] outline-none font-mono text-xs"
              />
            </div>
            <div>
              <label htmlFor="hero-img-alt" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                Image Alt Text
              </label>
              <input
                id="hero-img-alt"
                type="text"
                value={heroImageAlt}
                onChange={(e) => setHeroImageAlt(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg bg-white focus:border-[#143c31] outline-none"
              />
            </div>
            {heroImageUrl && (
              <div className="relative h-28 w-full rounded-lg overflow-hidden border border-[#dde4dc] bg-white">
                <Image
                  src={heroImageUrl}
                  alt={heroImageAlt || "Hero preview"}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Homepage Discovery Card */}
      <div className="bg-white rounded-xl border border-[#dde4dc] p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#143c31] uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-[#b8753d]" />
          <span>Homepage Discovery Banner (/)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label htmlFor="home-eyebrow" className="block text-xs font-bold text-[#143c31] mb-1">
                Discovery Eyebrow
              </label>
              <input
                id="home-eyebrow"
                type="text"
                value={homeEyebrow}
                onChange={(e) => setHomeEyebrow(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>

            <div>
              <label htmlFor="home-title" className="block text-xs font-bold text-[#143c31] mb-1">
                Discovery Heading
              </label>
              <input
                id="home-title"
                type="text"
                value={homeTitle}
                onChange={(e) => setHomeTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none font-serif text-base text-[#092b23]"
              />
            </div>

            <div>
              <label htmlFor="home-desc" className="block text-xs font-bold text-[#143c31] mb-1">
                Discovery Description
              </label>
              <textarea
                id="home-desc"
                rows={3}
                value={homeDescription}
                onChange={(e) => setHomeDescription(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg focus:border-[#143c31] outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 bg-[#f7f4ed] p-4 rounded-xl border border-[#dde4dc]">
            <span className="text-xs font-bold text-[#143c31] block">Discovery Image Placement (`home_blend_lab`)</span>
            <div>
              <label htmlFor="home-img-url" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                Image URL
              </label>
              <input
                id="home-img-url"
                type="text"
                value={homeImageUrl}
                onChange={(e) => setHomeImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg bg-white focus:border-[#143c31] outline-none font-mono text-xs"
              />
            </div>
            <div>
              <label htmlFor="home-img-alt" className="block text-[11px] font-semibold text-[#65746d] mb-1">
                Image Alt Text
              </label>
              <input
                id="home-img-alt"
                type="text"
                value={homeImageAlt}
                onChange={(e) => setHomeImageAlt(e.target.value)}
                className="w-full px-3 py-2 border border-[#dde4dc] rounded-lg bg-white focus:border-[#143c31] outline-none"
              />
            </div>
            {homeImageUrl && (
              <div className="relative h-28 w-full rounded-lg overflow-hidden border border-[#dde4dc] bg-white">
                <Image
                  src={homeImageUrl}
                  alt={homeImageAlt || "Home discovery preview"}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. FAQ Editor */}
      <div className="bg-white rounded-xl border border-[#dde4dc] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[#143c31] uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#b8753d]" />
            <span>Frequently Asked Questions ({faqs.length})</span>
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#143c31] bg-[#f7f4ed] hover:bg-[#dde4dc] rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add FAQ</span>
          </button>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-[#dde4dc] bg-[#f7f4ed] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => handleFaqChange(idx, "question", e.target.value)}
                  placeholder="Question..."
                  className="flex-1 px-3 py-1.5 text-xs font-bold text-[#143c31] border border-[#dde4dc] rounded bg-white"
                />
                <button
                  type="button"
                  onClick={() => removeFaq(idx)}
                  className="p-1 text-[#65746d] hover:text-[#b03a2e]"
                  title="Remove FAQ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={2}
                value={faq.answer}
                onChange={(e) => handleFaqChange(idx, "answer", e.target.value)}
                placeholder="Detailed answer..."
                className="w-full px-3 py-1.5 text-xs border border-[#dde4dc] rounded bg-white text-[#43534b]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 text-xs font-bold text-white bg-[#143c31] hover:bg-[#092b23] rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? "Saving All Changes..." : "Publish Content Changes"}
        </button>
      </div>
    </form>
  );
}
