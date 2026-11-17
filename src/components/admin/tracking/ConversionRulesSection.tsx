"use client";

import React from "react";
import { Plus, Trash2, AlertTriangle, Target } from "lucide-react";
import type {
  ConversionDelivery,
  ConversionPlatform,
  ConversionRule,
  ConversionTriggerEvent,
  ConversionValueMode,
} from "@/lib/trackingSettings";

const TRIGGER_EVENT_OPTIONS: Array<{ value: ConversionTriggerEvent; label: string }> = [
  { value: "purchase", label: "Purchase (Confirmed Order)" },
  { value: "generate_lead", label: "Lead Submitted (generate_lead)" },
  { value: "begin_checkout", label: "Begin Checkout (begin_checkout)" },
  { value: "add_shipping_info", label: "Add Shipping Info (add_shipping_info)" },
  { value: "add_payment_info", label: "Add Payment Info (add_payment_info)" },
  { value: "add_to_cart", label: "Add to Cart (add_to_cart)" },
  { value: "view_item", label: "View Product (view_item)" },
  { value: "search", label: "Store Search (search)" },
];

const LEAD_TYPE_OPTIONS = [
  { value: "", label: "All Lead Types" },
  { value: "wholesale_inquiry", label: "Wholesale Inquiry" },
  { value: "private_label_quote", label: "Private Label Quote" },
  { value: "private_label_consultation", label: "Private Label Consultation" },
  { value: "blend_lab_project", label: "Blend Lab Project" },
  { value: "contact_inquiry", label: "Contact Inquiry" },
  { value: "cart_recovery", label: "Cart Recovery" },
  { value: "newsletter", label: "Newsletter Signup" },
];

const META_EVENT_SUGGESTIONS = [
  "Purchase",
  "Lead",
  "InitiateCheckout",
  "AddPaymentInfo",
  "AddToCart",
  "ViewContent",
  "Search",
  "CompleteRegistration",
  "Subscribe",
  "Contact",
];

function newRuleId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export interface ConversionRulesSectionProps {
  rules: ConversionRule[];
  onChange: (next: ConversionRule[]) => void;
  gtmEnabled: boolean;
  googleAdsId: string;
  metaPixelId: string;
  errors: Record<string, string>;
}

export function ConversionRulesSection({
  rules,
  onChange,
  gtmEnabled,
  googleAdsId,
  metaPixelId,
  errors,
}: ConversionRulesSectionProps) {
  const addPreset = (preset: "gads_purchase" | "gads_lead" | "meta_purchase" | "meta_lead" | "blank") => {
    const map: Record<typeof preset, ConversionRule> = {
      gads_purchase: {
        id: newRuleId("gads_purchase"),
        name: "Google Ads — Purchase",
        enabled: true,
        platform: "google_ads",
        delivery: "admin_direct",
        trigger_event: "purchase",
        ads_conversion_id: googleAdsId || "AW-18566488412",
        ads_conversion_label: "",
        value_mode: "order_total",
        currency: "EVENT",
        paid_only: true,
      },
      gads_lead: {
        id: newRuleId("gads_lead"),
        name: "Google Ads — Wholesale Lead",
        enabled: true,
        platform: "google_ads",
        delivery: "admin_direct",
        trigger_event: "generate_lead",
        lead_type_filter: "wholesale_inquiry",
        ads_conversion_id: googleAdsId || "AW-18566488412",
        ads_conversion_label: "",
        value_mode: "fixed",
        fixed_value: 100,
        currency: "INR",
      },
      meta_purchase: {
        id: newRuleId("meta_purchase"),
        name: "Meta — Purchase (Direct trackSingle)",
        enabled: true,
        platform: "meta",
        delivery: "admin_direct",
        trigger_event: "purchase",
        meta_pixel_id: metaPixelId || "",
        meta_event_name: "Purchase",
        meta_is_custom_event: false,
        value_mode: "order_total",
        currency: "EVENT",
        paid_only: false,
      },
      meta_lead: {
        id: newRuleId("meta_lead"),
        name: "Meta — Wholesale / Private Label Lead",
        enabled: true,
        platform: "meta",
        delivery: "admin_direct",
        trigger_event: "generate_lead",
        lead_type_filter: "wholesale_inquiry",
        meta_pixel_id: metaPixelId || "",
        meta_event_name: "Lead",
        meta_is_custom_event: false,
        value_mode: "none",
        currency: "INR",
      },
      blank: {
        id: newRuleId("conv"),
        name: "Custom Conversion",
        enabled: true,
        platform: "google_ads",
        delivery: "both",
        trigger_event: "purchase",
        ads_conversion_id: googleAdsId || "",
        ads_conversion_label: "",
        value_mode: "order_total",
        currency: "EVENT",
      },
    };
    onChange([...rules, map[preset]]);
  };

  const updateRule = (index: number, patch: Partial<ConversionRule>) => {
    const next = [...rules];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#f0ece1] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#f2f6ee] flex items-center justify-center text-[#2c4e38]">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#18231c]">
              Conversions Manager (Google Ads, Meta &amp; GA4 — Admin + GTM)
            </h2>
            <p className="text-xs text-[#555f50]">
              Add multiple conversion actions for Purchase, Wholesale Leads, Private Label Quotes, or Checkout steps.
              Route each rule via <strong>Admin Direct</strong>, <strong>GTM DataLayer</strong>, or <strong>Both</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addPreset("gads_purchase")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#f0f4ef] text-[#1b3022] hover:bg-[#e2eade] rounded border border-[#cde0cb]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Google Ads Purchase</span>
          </button>
          <button
            type="button"
            onClick={() => addPreset("gads_lead")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#f0f4ef] text-[#1b3022] hover:bg-[#e2eade] rounded border border-[#cde0cb]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Google Ads Lead</span>
          </button>
          <button
            type="button"
            onClick={() => addPreset("meta_purchase")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#eef4ff] text-[#184c8f] hover:bg-[#dfeaff] rounded border border-[#c6dbfc]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Meta Purchase</span>
          </button>
          <button
            type="button"
            onClick={() => addPreset("meta_lead")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#eef4ff] text-[#184c8f] hover:bg-[#dfeaff] rounded border border-[#c6dbfc]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Meta Lead</span>
          </button>
          <button
            type="button"
            onClick={() => addPreset("blank")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#f7f5ef] text-[#18231c] hover:bg-[#ede9df] rounded border border-[#ded8cb]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom</span>
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#ded8cb] bg-[#fbfaf8] p-6 text-center text-xs text-[#555f50]">
          No custom conversion rules configured in Admin yet. Standard funnel events still push to{" "}
          <code className="bg-[#ede9df] px-1 py-0.5 rounded">window.dataLayer</code> for GTM. Click a preset button above
          to add a Google Ads, Meta, or GA4 conversion rule directly here.
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => {
            const ruleError = errors[`rule_${index}`];
            const showHybridWarn = gtmEnabled && rule.enabled && rule.delivery !== "gtm_datalayer";
            return (
              <div
                key={rule.id}
                className={`rounded-lg border p-4 space-y-4 ${
                  rule.enabled ? "border-[#ded8cb] bg-[#fdfcfa]" : "border-[#ece8df] bg-[#f7f6f2] opacity-75"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f0ece1]">
                  <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                      aria-label={`Enable ${rule.name}`}
                      className="w-4 h-4 text-[#2c4e38] rounded border-gray-300"
                    />
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => updateRule(index, { name: e.target.value })}
                      placeholder="Conversion Name"
                      className="flex-1 px-2.5 py-1.5 text-sm font-semibold border border-[#ded8cb] rounded bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {showHybridWarn && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#fff8e1] text-[#8d6e1f] border border-[#f0dfa8]">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Direct alongside GTM: avoid firing same label/pixel inside GTM</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      aria-label={`Remove ${rule.name}`}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[#9c2b2b] hover:bg-[#fdeaea] rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                      Platform
                    </label>
                    <select
                      value={rule.platform}
                      onChange={(e) => updateRule(index, { platform: e.target.value as ConversionPlatform })}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#ded8cb] rounded bg-white"
                    >
                      <option value="google_ads">Google Ads (AW-...)</option>
                      <option value="meta">Meta / Facebook Pixel</option>
                      <option value="ga4">GA4 Custom Event</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                      Delivery Mode
                    </label>
                    <select
                      value={rule.delivery}
                      onChange={(e) => updateRule(index, { delivery: e.target.value as ConversionDelivery })}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#ded8cb] rounded bg-white"
                    >
                      <option value="admin_direct">Admin Direct (Instant)</option>
                      <option value="gtm_datalayer">GTM DataLayer Only</option>
                      <option value="both">Both (Admin + GTM DataLayer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                      Trigger Event
                    </label>
                    <select
                      value={rule.trigger_event}
                      onChange={(e) => updateRule(index, { trigger_event: e.target.value as ConversionTriggerEvent })}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#ded8cb] rounded bg-white"
                    >
                      {TRIGGER_EVENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {rule.trigger_event === "generate_lead" && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                        Lead Type Filter
                      </label>
                      <select
                        value={rule.lead_type_filter || ""}
                        onChange={(e) => updateRule(index, { lead_type_filter: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-[#ded8cb] rounded bg-white"
                      >
                        {LEAD_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {rule.platform === "google_ads" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                          Google Ads ID (AW-...)
                        </label>
                        <input
                          type="text"
                          value={rule.ads_conversion_id || ""}
                          onChange={(e) => updateRule(index, { ads_conversion_id: e.target.value })}
                          placeholder={googleAdsId || "AW-18566488412"}
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                          Conversion Label
                        </label>
                        <input
                          type="text"
                          value={rule.ads_conversion_label || ""}
                          onChange={(e) => updateRule(index, { ads_conversion_label: e.target.value })}
                          placeholder="e.g. spfzCJDFu7UdENzCmJVF"
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                        />
                      </div>
                    </>
                  )}

                  {rule.platform === "meta" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                          Meta Pixel ID
                        </label>
                        <input
                          type="text"
                          value={rule.meta_pixel_id || ""}
                          onChange={(e) => updateRule(index, { meta_pixel_id: e.target.value })}
                          placeholder={metaPixelId || "29619022431117471"}
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                          Meta Event Name
                        </label>
                        <input
                          type="text"
                          list={`meta-events-${rule.id}`}
                          value={rule.meta_event_name || ""}
                          onChange={(e) => updateRule(index, { meta_event_name: e.target.value })}
                          placeholder="Purchase / Lead / Custom"
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                        />
                        <datalist id={`meta-events-${rule.id}`}>
                          {META_EVENT_SUGGESTIONS.map((ev) => (
                            <option key={ev} value={ev} />
                          ))}
                        </datalist>
                      </div>
                    </>
                  )}

                  {(rule.platform === "ga4" || rule.delivery !== "admin_direct") && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                        {rule.platform === "ga4" ? "GA4 / DataLayer Event" : "GTM DataLayer Event"}
                      </label>
                      <input
                        type="text"
                        value={rule.custom_event_name || ""}
                        onChange={(e) => updateRule(index, { custom_event_name: e.target.value })}
                        placeholder={rule.delivery !== "admin_direct" ? "tf_conversion" : rule.trigger_event}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                      Value Mode
                    </label>
                    <select
                      value={rule.value_mode}
                      onChange={(e) => updateRule(index, { value_mode: e.target.value as ConversionValueMode })}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#ded8cb] rounded bg-white"
                    >
                      <option value="order_total">Order Total (incl. GST &amp; Shipping)</option>
                      <option value="merchandise_subtotal">Merchandise Subtotal (excl. GST &amp; Shipping)</option>
                      <option value="fixed">Fixed Value</option>
                      <option value="none">No Value</option>
                    </select>
                  </div>

                  {rule.value_mode === "fixed" && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                        Fixed Value
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={rule.fixed_value ?? 0}
                        onChange={(e) => updateRule(index, { fixed_value: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#555f50] mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      value={rule.currency || "EVENT"}
                      onChange={(e) => updateRule(index, { currency: e.target.value.toUpperCase() })}
                      placeholder="EVENT (auto) or INR"
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#ded8cb] rounded bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-[#555f50]">
                  {rule.trigger_event === "purchase" && (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(rule.paid_only)}
                        onChange={(e) => updateRule(index, { paid_only: e.target.checked })}
                        className="w-3.5 h-3.5 text-[#2c4e38] rounded border-gray-300"
                      />
                      <span>Paid orders only (exclude unpaid COD &amp; pending bank transfer)</span>
                    </label>
                  )}
                  {rule.platform === "meta" && (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(rule.meta_is_custom_event)}
                        onChange={(e) => updateRule(index, { meta_is_custom_event: e.target.checked })}
                        className="w-3.5 h-3.5 text-[#2c4e38] rounded border-gray-300"
                      />
                      <span>Custom Meta Event (use trackSingleCustom instead of standard trackSingle)</span>
                    </label>
                  )}
                </div>

                {ruleError && <p className="text-xs text-red-600 font-medium">{ruleError}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
