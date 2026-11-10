"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Activity,
  Tag,
  Eye,
  ShoppingCart,
  CreditCard,
  CheckCheck,
  Send,
  Sliders,
  Code,
} from "lucide-react";
import type { TrackingSettings } from "@/lib/trackingSettings";
import {
  pushDataLayerEvent,
  pushEcommerceEvent,
  type TrackingItem,
} from "@/lib/seo/tracking";

export function TrackingSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form fields
  const [gtmContainerId, setGtmContainerId] = useState("GTM-M5G27HSQ");
  const [gtmEnabled, setGtmEnabled] = useState(true);

  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [ga4Enabled, setGa4Enabled] = useState(false);

  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaPixelEnabled, setMetaPixelEnabled] = useState(false);

  const [customHeadScript, setCustomHeadScript] = useState("");
  const [customBodyScript, setCustomBodyScript] = useState("");
  const [showAdvancedScripts, setShowAdvancedScripts] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live test event logs
  const [testLogs, setTestLogs] = useState<
    Array<{ id: string; time: string; event: string; payload: unknown }>
  >([]);

  const fetchSettings = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/tracking", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load tracking settings.");
      const data = (await res.json()) as { ok: boolean; settings: TrackingSettings };
      if (data.settings) {
        setGtmContainerId(data.settings.gtm_container_id || "GTM-M5G27HSQ");
        setGtmEnabled(data.settings.gtm_enabled ?? true);
        setGa4MeasurementId(data.settings.ga4_measurement_id || "");
        setGa4Enabled(data.settings.ga4_enabled ?? false);
        setMetaPixelId(data.settings.meta_pixel_id || "");
        setMetaPixelEnabled(data.settings.meta_pixel_enabled ?? false);
        setCustomHeadScript(data.settings.custom_head_script || "");
        setCustomBodyScript(data.settings.custom_body_script || "");
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Unable to load tracking settings from database.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const cleanGtm = gtmContainerId.trim();
    if (gtmEnabled && !cleanGtm) {
      errs.gtmContainerId = "Google Tag Manager container ID is required when enabled.";
    } else if (cleanGtm && !/^GTM-[A-Z0-9]+$/i.test(cleanGtm)) {
      errs.gtmContainerId = "Container ID must follow format GTM-XXXXXXX.";
    }

    const cleanGa4 = ga4MeasurementId.trim();
    if (ga4Enabled && !cleanGa4) {
      errs.ga4MeasurementId = "GA4 Measurement ID is required when enabled.";
    } else if (cleanGa4 && !/^G-[A-Z0-9]+$/i.test(cleanGa4)) {
      errs.ga4MeasurementId = "Measurement ID must follow format G-XXXXXXXXXX.";
    }

    const cleanMeta = metaPixelId.trim();
    if (metaPixelEnabled && !cleanMeta) {
      errs.metaPixelId = "Meta Pixel ID is required when enabled.";
    } else if (cleanMeta && !/^\d+$/.test(cleanMeta)) {
      errs.metaPixelId = "Meta Pixel ID must contain digits only.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validate()) {
      setStatusMessage({
        type: "error",
        text: "Please correct the highlighted form errors before saving.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        gtm_container_id: gtmContainerId.trim(),
        gtm_enabled: gtmEnabled,
        ga4_measurement_id: ga4MeasurementId.trim(),
        ga4_enabled: ga4Enabled,
        meta_pixel_id: metaPixelId.trim(),
        meta_pixel_enabled: metaPixelEnabled,
        custom_head_script: customHeadScript,
        custom_body_script: customBodyScript,
      };

      const res = await fetch("/api/admin/tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update tracking settings.");
      }

      setStatusMessage({
        type: "success",
        text: "Marketing tags, Google Tag Manager & pixel settings successfully saved.",
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const logTestEvent = (eventName: string, payload: unknown) => {
    const time = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    setTestLogs((prev) => [{ id, time, event: eventName, payload }, ...prev.slice(0, 9)]);
  };

  const handleTestViewItem = () => {
    const sampleItem: TrackingItem = {
      item_id: "DJ-SP-100G",
      item_name: "Darjeeling Spring Clonal First Flush (100g)",
      item_category: "Black Tea",
      price: 950.0,
      quantity: 1,
    };
    pushEcommerceEvent("view_item", {
      currency: "INR",
      value: 950.0,
      items: [sampleItem],
    });
    logTestEvent("view_item", { currency: "INR", value: 950.0, items: [sampleItem] });
  };

  const handleTestAddToCart = () => {
    const sampleItem: TrackingItem = {
      item_id: "DJ-SP-100G",
      item_name: "Darjeeling Spring Clonal First Flush (100g)",
      item_category: "Black Tea",
      price: 950.0,
      quantity: 2,
    };
    pushEcommerceEvent("add_to_cart", {
      currency: "INR",
      value: 1900.0,
      items: [sampleItem],
    });
    logTestEvent("add_to_cart", { currency: "INR", value: 1900.0, items: [sampleItem] });
  };

  const handleTestBeginCheckout = () => {
    const sampleItems: TrackingItem[] = [
      {
        item_id: "DJ-SP-100G",
        item_name: "Darjeeling Spring Clonal First Flush (100g)",
        item_category: "Black Tea",
        price: 950.0,
        quantity: 2,
      },
    ];
    pushEcommerceEvent("begin_checkout", {
      currency: "INR",
      value: 1900.0,
      items: sampleItems,
    });
    logTestEvent("begin_checkout", { currency: "INR", value: 1900.0, items: sampleItems });
  };

  const handleTestPurchase = () => {
    const ref = "TEST-" + Math.floor(100000 + Math.random() * 900000);
    const sampleItems: TrackingItem[] = [
      {
        item_id: "DJ-SP-100G",
        item_name: "Darjeeling Spring Clonal First Flush (100g)",
        item_category: "Black Tea",
        price: 950.0,
        quantity: 2,
      },
    ];
    pushEcommerceEvent("purchase", {
      transaction_id: ref,
      currency: "INR",
      value: 1995.0,
      shipping: 0.0,
      tax: 95.0,
      items: sampleItems,
    });
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "teafloww_purchase",
        tf_purchase_value: 1995.0,
        tf_purchase_currency: "INR",
        tf_purchase_order_id: ref,
        tf_purchase_event_id: `purchase_${ref}`,
      });
    }
    logTestEvent("purchase (standard + teafloww_purchase)", {
      transaction_id: ref,
      currency: "INR",
      value: 1995.0,
      shipping: 0.0,
      tax: 95.0,
      items: sampleItems,
      tf_purchase_value: 1995.0,
      tf_purchase_currency: "INR",
      tf_purchase_order_id: ref,
      tf_purchase_event_id: `purchase_${ref}`,
    });
  };

  const handleTestLead = () => {
    const payload = {
      lead_type: "newsletter",
      source: "admin_test",
    };
    pushDataLayerEvent("lead", payload);
    logTestEvent("lead", payload);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <RefreshCw className="w-8 h-8 animate-spin text-[#2c4e38]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e5e0d8] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#555f50] mb-1">
            <Tag className="w-4 h-4 text-[#2c4e38]" />
            <span>Marketing, Tracking & Pixels</span>
          </div>
          <h1 className="text-3xl font-serif text-[#18231c]">
            Google Tag Manager & Analytics
          </h1>
          <p className="text-sm text-[#555f50] mt-1 max-w-2xl">
            Configure Google Tag Manager (GTM), Meta / Facebook Pixel, and Google Analytics.
            All shopping funnels push standardized events to the client dataLayer with strict Zero-PII privacy protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#18231c] bg-[#ede9df] hover:bg-[#e2ddd0] rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1b3022] hover:bg-[#2c4e38] rounded-md transition-all shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* 2. Status Notifications */}
      {statusMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg flex items-start gap-3 border ${
            statusMessage.type === "success"
              ? "bg-[#edf7ed] border-[#c8e6c9] text-[#1e4620]"
              : "bg-[#fdeded] border-[#ffcdd2] text-[#5f2120]"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#2e7d32]" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#d32f2f]" />
          )}
          <span className="text-sm font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* 3. Top Metrics / Connection Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GTM status */}
        <div className="bg-white border border-[#e5e0d8] rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#555f50]">
              Google Tag Manager
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                gtmEnabled && gtmContainerId
                  ? "bg-[#e8f5e9] text-[#2e7d32]"
                  : "bg-[#f5f5f5] text-[#757575]"
              }`}
            >
              {gtmEnabled && gtmContainerId ? "Active" : "Disabled"}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-[#18231c]">
            {gtmContainerId || "Not set"}
          </div>
          <p className="text-xs text-[#555f50] mt-1">
            Container script & noscript active on all pages
          </p>
        </div>

        {/* Meta Pixel status */}
        <div className="bg-white border border-[#e5e0d8] rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#555f50]">
              Meta Pixel
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                metaPixelEnabled && metaPixelId
                  ? "bg-[#e8f5e9] text-[#2e7d32]"
                  : "bg-[#f5f5f5] text-[#757575]"
              }`}
            >
              {metaPixelEnabled && metaPixelId ? "Active" : "Disabled"}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-[#18231c]">
            {metaPixelId || "Not set"}
          </div>
          <p className="text-xs text-[#555f50] mt-1">
            Direct fbq standard events bridging
          </p>
        </div>

        {/* GA4 status */}
        <div className="bg-white border border-[#e5e0d8] rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#555f50]">
              Google Analytics 4
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                ga4Enabled && ga4MeasurementId
                  ? "bg-[#e8f5e9] text-[#2e7d32]"
                  : "bg-[#f5f5f5] text-[#757575]"
              }`}
            >
              {ga4Enabled && ga4MeasurementId ? "Active" : "Disabled"}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-[#18231c]">
            {ga4MeasurementId || "Managed via GTM"}
          </div>
          <p className="text-xs text-[#555f50] mt-1">
            Optional direct gtag.js stream
          </p>
        </div>

        {/* Privacy badge */}
        <div className="bg-[#f7f5ef] border border-[#e5e0d8] rounded-lg p-5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#2c4e38] mb-2">
            <ShieldCheck className="w-4 h-4 text-[#2c4e38]" />
            <span>Zero-PII Governance</span>
          </div>
          <div className="text-lg font-bold text-[#18231c]">100% Privacy Compliant</div>
          <p className="text-xs text-[#555f50] mt-1">
            Customer names, addresses & payment info are never passed to tracking tags.
          </p>
        </div>
      </div>

      {/* 4. Configuration Cards Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card: Google Tag Manager */}
        <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f0f4ef] flex items-center justify-center text-[#2c4e38]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#18231c]">Google Tag Manager</h2>
                <p className="text-xs text-[#555f50]">
                  Inject container script in &lt;head&gt; and fallback iframe in &lt;body&gt;
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-bold uppercase tracking-wider text-[#555f50]">
                {gtmEnabled ? "Enabled" : "Disabled"}
              </span>
              <input
                type="checkbox"
                checked={gtmEnabled}
                onChange={(e) => setGtmEnabled(e.target.checked)}
                className="w-4 h-4 text-[#2c4e38] rounded border-gray-300 focus:ring-[#2c4e38]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="gtm_container_id"
                className="block text-xs font-bold uppercase tracking-wider text-[#18231c] mb-1.5"
              >
                GTM Container ID
              </label>
              <input
                id="gtm_container_id"
                type="text"
                value={gtmContainerId}
                onChange={(e) => setGtmContainerId(e.target.value)}
                placeholder="GTM-M5G27HSQ"
                className={`w-full px-3 py-2 text-sm border rounded-md font-mono ${
                  errors.gtmContainerId ? "border-red-500 bg-red-50" : "border-[#ded8cb]"
                }`}
              />
              {errors.gtmContainerId && (
                <p className="text-xs text-red-600 mt-1">{errors.gtmContainerId}</p>
              )}
              <p className="text-xs text-[#555f50] mt-1.5">
                Default: <code className="bg-[#ede9df] px-1 py-0.5 rounded text-[11px]">GTM-M5G27HSQ</code>.
                Found in your Google Tag Manager workspace top header.
              </p>
            </div>

            <div className="bg-[#fbfaf8] border border-[#e8e4dc] rounded-md p-4 text-xs text-[#555f50] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#18231c]">External Console</span>
                <a
                  href="https://tagmanager.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#2c4e38] hover:underline font-semibold"
                >
                  <span>Open Tag Manager</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p>
                GTM receives website events through <code className="bg-[#ede9df] px-1 py-0.5 rounded">window.dataLayer</code>. Configure matching event tags, triggers and consent checks inside the container; loading GTM alone does not confirm delivery to GA4 or advertising platforms.
              </p>
            </div>
          </div>
        </section>

        {/* Card: Meta / Facebook Pixel */}
        <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#eaf2ff] flex items-center justify-center text-[#1877f2]">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#18231c]">Meta / Facebook Pixel</h2>
                <p className="text-xs text-[#555f50]">
                  Track conversions and ad optimization for Instagram & Facebook Ads
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-bold uppercase tracking-wider text-[#555f50]">
                {metaPixelEnabled ? "Enabled" : "Disabled"}
              </span>
              <input
                type="checkbox"
                checked={metaPixelEnabled}
                onChange={(e) => setMetaPixelEnabled(e.target.checked)}
                className="w-4 h-4 text-[#2c4e38] rounded border-gray-300 focus:ring-[#2c4e38]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="meta_pixel_id"
                className="block text-xs font-bold uppercase tracking-wider text-[#18231c] mb-1.5"
              >
                Meta Pixel ID
              </label>
              <input
                id="meta_pixel_id"
                type="text"
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.target.value)}
                placeholder="e.g. 123456789012345"
                className={`w-full px-3 py-2 text-sm border rounded-md font-mono ${
                  errors.metaPixelId ? "border-red-500 bg-red-50" : "border-[#ded8cb]"
                }`}
              />
              {errors.metaPixelId && (
                <p className="text-xs text-red-600 mt-1">{errors.metaPixelId}</p>
              )}
              <p className="text-xs text-[#555f50] mt-1.5">
                Standalone fallback when GTM is disabled. With GTM enabled, configure Meta in that container; this direct pixel is suppressed. Supported events:{" "}
                <code className="text-[11px]">PageView</code>, <code className="text-[11px]">ViewContent</code>,{" "}
                <code className="text-[11px]">AddToCart</code>, <code className="text-[11px]">InitiateCheckout</code>,{" "}
                <code className="text-[11px]">Purchase</code>, <code className="text-[11px]">Lead</code>.
              </p>
            </div>

            <div className="bg-[#fbfaf8] border border-[#e8e4dc] rounded-md p-4 text-xs text-[#555f50] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#18231c]">Meta Events Manager</span>
                <a
                  href="https://business.facebook.com/events_manager2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#1877f2] hover:underline font-semibold"
                >
                  <span>Events Manager</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p>
                When enabled, the base script is loaded and client shopping events trigger standard Meta
                e-commerce actions with currency (INR) and item values.
              </p>
            </div>
          </div>
        </section>

        {/* Card: Google Analytics 4 (Direct gtag.js) */}
        <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#fff4e5] flex items-center justify-center text-[#e37400]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#18231c]">Google Analytics 4 (Direct gtag.js)</h2>
                <p className="text-xs text-[#555f50]">
                  Standalone gtag.js snippet. When Google Tag Manager is enabled, configure GA4 in that container; the direct snippet is suppressed.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-bold uppercase tracking-wider text-[#555f50]">
                {ga4Enabled ? "Enabled" : "Disabled"}
              </span>
              <input
                type="checkbox"
                checked={ga4Enabled}
                onChange={(e) => setGa4Enabled(e.target.checked)}
                className="w-4 h-4 text-[#2c4e38] rounded border-gray-300 focus:ring-[#2c4e38]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="ga4_measurement_id"
                className="block text-xs font-bold uppercase tracking-wider text-[#18231c] mb-1.5"
              >
                GA4 Measurement ID
              </label>
              <input
                id="ga4_measurement_id"
                type="text"
                value={ga4MeasurementId}
                onChange={(e) => setGa4MeasurementId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className={`w-full px-3 py-2 text-sm border rounded-md font-mono ${
                  errors.ga4MeasurementId ? "border-red-500 bg-red-50" : "border-[#ded8cb]"
                }`}
              />
              {errors.ga4MeasurementId && (
                <p className="text-xs text-red-600 mt-1">{errors.ga4MeasurementId}</p>
              )}
              <p className="text-xs text-[#555f50] mt-1.5">
                Format: <code className="bg-[#ede9df] px-1 py-0.5 rounded text-[11px]">G-XXXXXXXXXX</code>.
                Found in Google Analytics &gt; Admin &gt; Data Streams.
              </p>
            </div>

            <div className="bg-[#fbfaf8] border border-[#e8e4dc] rounded-md p-4 text-xs text-[#555f50] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#18231c]">Google Analytics Console</span>
                <a
                  href="https://analytics.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#e37400] hover:underline font-semibold"
                >
                  <span>Google Analytics</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p>
                <strong>Pro-tip:</strong> When Google Tag Manager is enabled, it is usually best practice
                to manage GA4 tags inside GTM to avoid duplicate event calls.
              </p>
            </div>
          </div>
        </section>

        {/* Card: Custom Scripts (Advanced) */}
        <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f0f0f0] flex items-center justify-center text-[#555]">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#18231c]">Custom Scripts & Pixels</h2>
                <p className="text-xs text-[#555f50]">
                  Optional custom HTML/JS (Microsoft Clarity, Pinterest, TikTok Pixel, etc.)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedScripts(!showAdvancedScripts)}
              className="text-xs font-semibold text-[#2c4e38] hover:underline"
            >
              {showAdvancedScripts ? "Hide Advanced" : "Show Advanced"}
            </button>
          </div>

          {showAdvancedScripts && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#f0ece1]">
              <div>
                <label
                  htmlFor="custom_head_script"
                  className="block text-xs font-bold uppercase tracking-wider text-[#18231c] mb-1.5"
                >
                  Custom Head Scripts
                </label>
                <textarea
                  id="custom_head_script"
                  rows={4}
                  value={customHeadScript}
                  onChange={(e) => setCustomHeadScript(e.target.value)}
                  placeholder="<!-- Custom <head> tags -->"
                  className="w-full px-3 py-2 text-xs font-mono border border-[#ded8cb] rounded-md"
                />
              </div>

              <div>
                <label
                  htmlFor="custom_body_script"
                  className="block text-xs font-bold uppercase tracking-wider text-[#18231c] mb-1.5"
                >
                  Custom Body Scripts
                </label>
                <textarea
                  id="custom_body_script"
                  rows={4}
                  value={customBodyScript}
                  onChange={(e) => setCustomBodyScript(e.target.value)}
                  placeholder="<!-- Custom <body> tags / noscripts -->"
                  className="w-full px-3 py-2 text-xs font-mono border border-[#ded8cb] rounded-md"
                />
              </div>
            </div>
          )}
        </section>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e0d8]">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1b3022] hover:bg-[#2c4e38] rounded-md transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving Changes..." : "Save Tracking Settings"}</span>
          </button>
        </div>
      </form>

      {/* 5. Live Event Tester & DataLayer Inspector */}
      <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0ece1] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e8f5e9] flex items-center justify-center text-[#2e7d32]">
              <CheckCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#18231c]">
                Live Event Trigger & DataLayer Inspector
              </h2>
              <p className="text-xs text-[#555f50]">
                Fire sample events in the current browser session to inspect GTM / GA4 dataLayer pushes.
              </p>
            </div>
          </div>
        </div>

        {/* Test buttons row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTestViewItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f0f4ef] text-[#1b3022] hover:bg-[#e2eade] rounded-md border border-[#cde0cb] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Test view_item</span>
          </button>

          <button
            type="button"
            onClick={handleTestAddToCart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f0f4ef] text-[#1b3022] hover:bg-[#e2eade] rounded-md border border-[#cde0cb] transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Test add_to_cart</span>
          </button>

          <button
            type="button"
            onClick={handleTestBeginCheckout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f0f4ef] text-[#1b3022] hover:bg-[#e2eade] rounded-md border border-[#cde0cb] transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Test begin_checkout</span>
          </button>

          <button
            type="button"
            onClick={handleTestPurchase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#e8f5e9] text-[#1b431e] hover:bg-[#d4edd6] rounded-md border border-[#b2dfdb] transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
            <span>Test purchase (Conversion)</span>
          </button>

          <button
            type="button"
            onClick={handleTestLead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f0f4ef] text-[#1b3022] hover:bg-[#e2eade] rounded-md border border-[#cde0cb] transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test lead</span>
          </button>
        </div>

        {/* Live log viewer */}
        <div className="bg-[#18231c] text-[#d4decb] rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-64 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#86997f] border-b border-[#2d3d32] pb-1.5">
            <span>window.dataLayer Event Stream</span>
            <span>{testLogs.length} events triggered</span>
          </div>

          {testLogs.length === 0 ? (
            <p className="text-[#86997f] italic py-2">
              No test events fired yet. Click one of the test buttons above to inspect the exact payload pushed to Google Tag Manager.
            </p>
          ) : (
            testLogs.map((log) => (
              <div key={log.id} className="pt-1.5 border-b border-[#243329] pb-2 last:border-b-0">
                <div className="flex items-center gap-2 text-[#a8c99e]">
                  <span className="text-[10px] text-[#6e8568]">[{log.time}]</span>
                  <span className="font-bold text-[#c9e8be]">event: &quot;{log.event}&quot;</span>
                </div>
                <pre className="text-[11px] text-[#e0eadb] mt-1 overflow-x-auto">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 6. Event Schema & Privacy Governance Matrix */}
      <section className="bg-white border border-[#e5e0d8] rounded-lg p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-[#f0ece1] pb-3">
          <div className="w-9 h-9 rounded-lg bg-[#f0f4ef] flex items-center justify-center text-[#2c4e38]">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#18231c]">
              Conversion Funnel & Data Governance Matrix
            </h2>
            <p className="text-xs text-[#555f50]">
              Verified standard GA4 e-commerce events and strict privacy fences
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#ded8cb] text-[#555f50] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Event Name</th>
                <th className="py-2.5 px-3">Trigger Point</th>
                <th className="py-2.5 px-3">Parameters Transmitted</th>
                <th className="py-2.5 px-3">Privacy Fence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ece1]">
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">purchase</td>
                <td className="py-2.5 px-3">Order confirmation page (/order/[id])</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">
                  transaction_id, currency, value, tax, shipping, items[]
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> No Customer PII
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">begin_checkout</td>
                <td className="py-2.5 px-3">Checkout initiation page (/checkout)</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">currency, value, items[]</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Anonymous Cart
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">add_to_cart</td>
                <td className="py-2.5 px-3">Add to Bag button (PDP, Drawer, Quick-Add)</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">currency, value, items[]</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Anonymous SKU
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">remove_from_cart</td>
                <td className="py-2.5 px-3">Removing item from bag</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">currency, value, items[]</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Anonymous SKU
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">view_cart</td>
                <td className="py-2.5 px-3">Bag overview (/cart)</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">currency, value, items[]</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Anonymous Cart
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">view_item</td>
                <td className="py-2.5 px-3">Product detail view (/tea/[slug])</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">currency, value, items[]</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Zero PII
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-bold text-[#1b3022]">lead</td>
                <td className="py-2.5 px-3">Newsletter signup or Wholesale form submit</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">lead_type, business_tier</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[#2e7d32] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Zero PII Transmitted
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
