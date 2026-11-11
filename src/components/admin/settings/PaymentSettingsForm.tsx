"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Copy,
  Check,
  Banknote,
  Sliders,
  Globe,
  Lock,
  Percent,
  Zap,
  Sparkles,
  QrCode,
  ArrowRightLeft,
  ExternalLink,
  Activity,
  Power,
} from "lucide-react";
import type { PaymentSettings } from "@/lib/paymentSettings";

export function PaymentSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Master Online Payments Toggle (True = Online + COD, False = COD Only)
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);

  // Environment Mode: test vs production
  const [paymentMode, setPaymentMode] = useState<"test" | "production">("test");

  // Active/Legacy
  const [rzpEnabled, setRzpEnabled] = useState(true);
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpSecret, setRzpSecret] = useState("");
  const [rzpWebhookSecret, setRzpWebhookSecret] = useState("");

  // Test Mode Specific Credentials
  const [rzpTestKeyId, setRzpTestKeyId] = useState("");
  const [rzpTestSecret, setRzpTestSecret] = useState("");
  const [rzpTestWebhookSecret, setRzpTestWebhookSecret] = useState("");
  const [rzpTestSecretConfigured, setRzpTestSecretConfigured] = useState(false);
  const [rzpTestWebhookConfigured, setRzpTestWebhookConfigured] = useState(false);

  // Production Mode Specific Credentials
  const [rzpProdKeyId, setRzpProdKeyId] = useState("");
  const [rzpProdSecret, setRzpProdSecret] = useState("");
  const [rzpProdWebhookSecret, setRzpProdWebhookSecret] = useState("");
  const [rzpProdSecretConfigured, setRzpProdSecretConfigured] = useState(false);
  const [rzpProdWebhookConfigured, setRzpProdWebhookConfigured] = useState(false);

  // Active status
  const [activeKeyId, setActiveKeyId] = useState("");
  const [activeSecretConfigured, setActiveSecretConfigured] = useState(false);
  const [activeWebhookConfigured, setActiveWebhookConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://teafloww.com/api/webhooks/razorpay");

  // COD Fields
  const [codEnabled, setCodEnabled] = useState(true);
  const [codFeeRupees, setCodFeeRupees] = useState(0);
  const [codMinRupees, setCodMinRupees] = useState(0);
  const [codMaxRupees, setCodMaxRupees] = useState(1000);

  // Payment Method Discounts & Incentives
  const [upiDiscountEnabled, setUpiDiscountEnabled] = useState(true);
  const [upiDiscountType, setUpiDiscountType] = useState<"percentage" | "flat">("percentage");
  const [upiDiscountValue, setUpiDiscountValue] = useState(2);
  const [upiDiscountMaxRupees, setUpiDiscountMaxRupees] = useState(150);

  const [cardDiscountEnabled, setCardDiscountEnabled] = useState(true);
  const [cardDiscountType, setCardDiscountType] = useState<"percentage" | "flat">("percentage");
  const [cardDiscountValue, setCardDiscountValue] = useState(1);
  const [cardDiscountMaxRupees, setCardDiscountMaxRupees] = useState(100);

  const [netbankingDiscountEnabled, setNetbankingDiscountEnabled] = useState(true);
  const [netbankingDiscountType, setNetbankingDiscountType] = useState<"percentage" | "flat">("percentage");
  const [netbankingDiscountValue, setNetbankingDiscountValue] = useState(1);
  const [netbankingDiscountMaxRupees, setNetbankingDiscountMaxRupees] = useState(100);

  const [minOrderForDiscountRupees, setMinOrderForDiscountRupees] = useState(0);
  const [paymentDiscountBadgeText, setPaymentDiscountBadgeText] = useState("⚡ Instant 2% Off with UPI · 1% Off on Cards");

  // Gateway Routing Controls
  const [gatewayDirectPurchase, setGatewayDirectPurchase] = useState<"razorpay" | "youpi">("razorpay");
  const [gatewaySampleKit, setGatewaySampleKit] = useState<"razorpay" | "youpi">("razorpay");
  const [gatewaySubscription, setGatewaySubscription] = useState<"razorpay" | "youpi">("razorpay");

  // YouPI-PG Configuration
  const [youpiEnabled, setYoupiEnabled] = useState(true);
  const [youpiApiUrl, setYoupiApiUrl] = useState("https://pay-api.biolastic.co.in");
  const [youpiCheckoutUrl, setYoupiCheckoutUrl] = useState("https://pay.biolastic.co.in");
  const [youpiAdminUrl, setYoupiAdminUrl] = useState("https://pay-admin.biolastic.co.in");
  const [youpiMerchantId, setYoupiMerchantId] = useState("00000000-0000-0000-0000-000000000001");
  const [youpiApiToken, setYoupiApiToken] = useState("");
  const [youpiWebhookSecret, setYoupiWebhookSecret] = useState("");
  const [youpiApiTokenConfigured, setYoupiApiTokenConfigured] = useState(false);
  const [youpiWebhookConfigured, setYoupiWebhookConfigured] = useState(false);
  const [youpiWebhookUrl, setYoupiWebhookUrl] = useState("https://teafloww.com/api/webhooks/youpi");
  const [copiedYoupiWebhook, setCopiedYoupiWebhook] = useState(false);
  const [testingYoupi, setTestingYoupi] = useState(false);
  const [youpiTestResult, setYoupiTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Wholesale Payment & Bank Details
  const [wholesaleAdvancePercent, setWholesaleAdvancePercent] = useState<number>(0);
  const [wholesaleBankBeneficiary, setWholesaleBankBeneficiary] = useState("Nirva");
  const [wholesaleBankName, setWholesaleBankName] = useState("HDFC Bank");
  const [wholesaleBankAccountNumber, setWholesaleBankAccountNumber] = useState("");
  const [wholesaleBankIfsc, setWholesaleBankIfsc] = useState("");
  const [wholesaleBankBranch, setWholesaleBankBranch] = useState("");
  const [wholesaleBankUpiId, setWholesaleBankUpiId] = useState("");

  const fetchSettings = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/settings/payment", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load payment settings.");
      const data = (await res.json()) as { settings: PaymentSettings };
      if (data.settings) {
        setOnlinePaymentEnabled(data.settings.online_payment_enabled ?? true);
        setPaymentMode(data.settings.payment_mode || "test");
        setRzpEnabled(data.settings.razorpay_enabled ?? true);

        setRzpKeyId(data.settings.razorpay_key_id || "");
        setRzpSecret(data.settings.razorpay_key_secret || "");
        setRzpWebhookSecret(data.settings.razorpay_webhook_secret || "");

        setRzpTestKeyId(data.settings.razorpay_test_key_id || "");
        setRzpTestSecret(data.settings.razorpay_test_key_secret || "");
        setRzpTestWebhookSecret(data.settings.razorpay_test_webhook_secret || "");
        setRzpTestSecretConfigured(Boolean(data.settings.razorpay_test_secret_configured));
        setRzpTestWebhookConfigured(Boolean(data.settings.razorpay_test_webhook_configured));

        setRzpProdKeyId(data.settings.razorpay_prod_key_id || "");
        setRzpProdSecret(data.settings.razorpay_prod_key_secret || "");
        setRzpProdWebhookSecret(data.settings.razorpay_prod_webhook_secret || "");
        setRzpProdSecretConfigured(Boolean(data.settings.razorpay_prod_secret_configured));
        setRzpProdWebhookConfigured(Boolean(data.settings.razorpay_prod_webhook_configured));

        setActiveKeyId(data.settings.active_key_id || "");
        setActiveSecretConfigured(Boolean(data.settings.active_secret_configured));
        setActiveWebhookConfigured(Boolean(data.settings.active_webhook_configured));

        if (data.settings.webhook_url) setWebhookUrl(data.settings.webhook_url);

        setCodEnabled(data.settings.cod_enabled ?? true);
        setCodFeeRupees(data.settings.cod_fee_rupees ?? 0);
        setCodMinRupees(data.settings.cod_min_rupees ?? 0);
        setCodMaxRupees(data.settings.cod_max_rupees ?? 1000);

        // Discounts
        setUpiDiscountEnabled(data.settings.upi_discount_enabled ?? true);
        setUpiDiscountType(data.settings.upi_discount_type || "percentage");
        setUpiDiscountValue(Number(data.settings.upi_discount_value ?? 2));
        setUpiDiscountMaxRupees(Number(data.settings.upi_discount_max_rupees ?? 150));

        setCardDiscountEnabled(data.settings.card_discount_enabled ?? true);
        setCardDiscountType(data.settings.card_discount_type || "percentage");
        setCardDiscountValue(Number(data.settings.card_discount_value ?? 1));
        setCardDiscountMaxRupees(Number(data.settings.card_discount_max_rupees ?? 100));

        setNetbankingDiscountEnabled(data.settings.netbanking_discount_enabled ?? true);
        setNetbankingDiscountType(data.settings.netbanking_discount_type || "percentage");
        setNetbankingDiscountValue(Number(data.settings.netbanking_discount_value ?? 1));
        setNetbankingDiscountMaxRupees(Number(data.settings.netbanking_discount_max_rupees ?? 100));

        setMinOrderForDiscountRupees(Number(data.settings.min_order_for_discount_rupees ?? 0));
        setPaymentDiscountBadgeText(data.settings.payment_discount_badge_text || "⚡ Instant 2% Off with UPI · 1% Off on Cards");

        // Gateway Routing
        setGatewayDirectPurchase(data.settings.gateway_direct_purchase || "razorpay");
        setGatewaySampleKit(data.settings.gateway_sample_kit || "razorpay");
        setGatewaySubscription(data.settings.gateway_subscription || "razorpay");

        // YouPI settings
        setYoupiEnabled(data.settings.youpi_enabled ?? true);
        if (data.settings.youpi_api_url) setYoupiApiUrl(data.settings.youpi_api_url);
        if (data.settings.youpi_checkout_url) setYoupiCheckoutUrl(data.settings.youpi_checkout_url);
        if (data.settings.youpi_admin_url) setYoupiAdminUrl(data.settings.youpi_admin_url);
        if (data.settings.youpi_merchant_id) setYoupiMerchantId(data.settings.youpi_merchant_id);
        setYoupiApiToken(data.settings.youpi_api_token || "");
        setYoupiWebhookSecret(data.settings.youpi_webhook_secret || "");
        setYoupiApiTokenConfigured(Boolean(data.settings.youpi_api_token_configured));
        setYoupiWebhookConfigured(Boolean(data.settings.youpi_webhook_configured));
        if (data.settings.youpi_webhook_url) setYoupiWebhookUrl(data.settings.youpi_webhook_url);

        // Wholesale settings
        setWholesaleAdvancePercent(data.settings.wholesale_advance_percent ?? 0);
        setWholesaleBankBeneficiary(data.settings.wholesale_bank_beneficiary || "Nirva");
        setWholesaleBankName(data.settings.wholesale_bank_name || "HDFC Bank");
        setWholesaleBankAccountNumber(data.settings.wholesale_bank_account_number || "");
        setWholesaleBankIfsc(data.settings.wholesale_bank_ifsc || "");
        setWholesaleBankBranch(data.settings.wholesale_bank_branch || "");
        setWholesaleBankUpiId(data.settings.wholesale_bank_upi_id || "");
      }
    } catch {
      setStatusMessage({ type: "error", text: "Unable to load payment settings from database." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const handleCopyWebhook = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(webhookUrl).then(() => {
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      });
    }
  };

  const handleCopyYoupiWebhook = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(youpiWebhookUrl).then(() => {
        setCopiedYoupiWebhook(true);
        setTimeout(() => setCopiedYoupiWebhook(false), 2000);
      });
    }
  };

  const handleTestYoupiConnection = async () => {
    setTestingYoupi(true);
    setYoupiTestResult(null);
    try {
      const res = await fetch("/api/admin/settings/payment/verify-youpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setYoupiTestResult({ ok: false, message: data.error || "Connection failed" });
      } else {
        setYoupiTestResult({
          ok: true,
          message: `Connected! Service: ${data.health?.service || "payment-api"}, Auth: ${data.authStatus}`,
        });
      }
    } catch (err: unknown) {
      setYoupiTestResult({ ok: false, message: (err as Error)?.message || "Network error" });
    } finally {
      setTestingYoupi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setSaving(true);

    try {
      const payload = {
        online_payment_enabled: onlinePaymentEnabled,
        payment_mode: paymentMode,
        razorpay_enabled: rzpEnabled,
        // Gateway Routing
        gateway_direct_purchase: gatewayDirectPurchase,
        gateway_sample_kit: gatewaySampleKit,
        gateway_subscription: gatewaySubscription,
        // YouPI Configuration
        youpi_enabled: youpiEnabled,
        youpi_api_url: youpiApiUrl.trim(),
        youpi_checkout_url: youpiCheckoutUrl.trim(),
        youpi_admin_url: youpiAdminUrl.trim(),
        youpi_merchant_id: youpiMerchantId.trim(),
        youpi_api_token: youpiApiToken.startsWith("•••") ? undefined : youpiApiToken.trim(),
        youpi_webhook_secret: youpiWebhookSecret.startsWith("•••") ? undefined : youpiWebhookSecret.trim(),
        // Legacy active
        razorpay_key_id: (paymentMode === "test" ? rzpTestKeyId : rzpProdKeyId) || rzpKeyId,
        razorpay_key_secret: (paymentMode === "test" ? rzpTestSecret : rzpProdSecret)?.startsWith("•••") ? undefined : (paymentMode === "test" ? rzpTestSecret : rzpProdSecret),
        razorpay_webhook_secret: (paymentMode === "test" ? rzpTestWebhookSecret : rzpProdWebhookSecret)?.startsWith("•••") ? undefined : (paymentMode === "test" ? rzpTestWebhookSecret : rzpProdWebhookSecret),
        // Test slots
        razorpay_test_key_id: rzpTestKeyId.trim(),
        razorpay_test_key_secret: rzpTestSecret.startsWith("•••") ? undefined : rzpTestSecret,
        razorpay_test_webhook_secret: rzpTestWebhookSecret.startsWith("•••") ? undefined : rzpTestWebhookSecret,
        // Prod slots
        razorpay_prod_key_id: rzpProdKeyId.trim(),
        razorpay_prod_key_secret: rzpProdSecret.startsWith("•••") ? undefined : rzpProdSecret,
        razorpay_prod_webhook_secret: rzpProdWebhookSecret.startsWith("•••") ? undefined : rzpProdWebhookSecret,
        // COD
        cod_enabled: codEnabled,
        cod_fee_rupees: Number(codFeeRupees),
        cod_min_rupees: Number(codMinRupees),
        cod_max_rupees: Number(codMaxRupees),
        // Payment Method Discounts & Incentives
        upi_discount_enabled: upiDiscountEnabled,
        upi_discount_type: upiDiscountType,
        upi_discount_value: Number(upiDiscountValue),
        upi_discount_max_rupees: Number(upiDiscountMaxRupees),
        card_discount_enabled: cardDiscountEnabled,
        card_discount_type: cardDiscountType,
        card_discount_value: Number(cardDiscountValue),
        card_discount_max_rupees: Number(cardDiscountMaxRupees),
        netbanking_discount_enabled: netbankingDiscountEnabled,
        netbanking_discount_type: netbankingDiscountType,
        netbanking_discount_value: Number(netbankingDiscountValue),
        netbanking_discount_max_rupees: Number(netbankingDiscountMaxRupees),
        prepaid_discount_enabled: upiDiscountEnabled || cardDiscountEnabled,
        prepaid_discount_type: "percentage",
        prepaid_discount_value: Number(upiDiscountValue),
        prepaid_discount_max_rupees: Number(upiDiscountMaxRupees),
        min_order_for_discount_rupees: Number(minOrderForDiscountRupees),
        payment_discount_badge_text: paymentDiscountBadgeText.trim(),
        // Wholesale Payment & Bank Settings
        wholesale_advance_percent: Math.min(100, Math.max(0, Number(wholesaleAdvancePercent) || 0)),
        wholesale_bank_beneficiary: wholesaleBankBeneficiary.trim(),
        wholesale_bank_name: wholesaleBankName.trim(),
        wholesale_bank_account_number: wholesaleBankAccountNumber.trim(),
        wholesale_bank_ifsc: wholesaleBankIfsc.trim().toUpperCase(),
        wholesale_bank_branch: wholesaleBankBranch.trim(),
        wholesale_bank_upi_id: wholesaleBankUpiId.trim(),
      };

      const res = await fetch("/api/admin/settings/payment", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage({ type: "success", text: "Payment gateway settings saved successfully." });
        await fetchSettings();
      } else {
        setStatusMessage({
          type: "error",
          text: data?.error || "Failed to update payment settings.",
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="state-card" role="status" style={{ padding: "40px 20px", textAlign: "center" }}>
        <RefreshCw className="spin" size={24} style={{ margin: "0 auto 12px" }} aria-hidden="true" />
        <p style={{ margin: 0, color: "#666" }}>Loading payment gateway settings...</p>
      </div>
    );
  }

  return (
    <div className="payment-settings-page" style={{ maxWidth: "940px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <p className="eyebrow" style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-primary, #23483a)", margin: "0 0 4px" }}>
          Payment Gateways & Checkout
        </p>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "32px", fontWeight: 700, color: "#1d2a24" }}>
          Payment Settings
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px", lineHeight: "1.5" }}>
          Manage Razorpay online checkout environments (Test vs Production) and Cash on Delivery (COD) policies.
        </p>
      </div>

      {statusMessage && (
        <div
          role={statusMessage.type === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "14px",
            background: statusMessage.type === "success" ? "#eef6f0" : "#fdf2f2",
            color: statusMessage.type === "success" ? "#1e5e34" : "#b91c1c",
            border: `1px solid ${statusMessage.type === "success" ? "#c7e6d0" : "#fecaca"}`,
          }}
        >
          {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* CARD -1: Master Payment Acceptance Control */}
        <div
          className="tf-ops-card"
          style={{
            background: onlinePaymentEnabled ? "#fff" : "#fffdf5",
            border: onlinePaymentEnabled ? "1px solid #e5e2d9" : "2px solid #eab308",
            borderRadius: "10px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: onlinePaymentEnabled ? "0 1px 3px rgba(0,0,0,0.05)" : "0 2px 8px rgba(202, 138, 4, 0.12)",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  background: onlinePaymentEnabled ? "rgba(35, 72, 58, 0.08)" : "rgba(234, 179, 8, 0.15)",
                  padding: "8px",
                  borderRadius: "8px",
                  color: onlinePaymentEnabled ? "#23483a" : "#854d0e",
                }}
              >
                <Power size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#1d2a24" }}>
                  Online Payment Acceptance
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Master switch to enable or disable digital online payments across the storefront. If disabled, customers can only pay with Cash on Delivery (COD).
                </p>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background: onlinePaymentEnabled ? "#eef6f0" : "#fef9c3",
                color: onlinePaymentEnabled ? "#1e5e34" : "#854d0e",
                border: `1px solid ${onlinePaymentEnabled ? "#c7e6d0" : "#fde047"}`,
                whiteSpace: "nowrap",
              }}
            >
              {onlinePaymentEnabled ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Online Payments Active (Prepaid + COD)</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  <span>COD Only Mode Active (Online Disabled)</span>
                </>
              )}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginTop: "16px" }}>
            {/* Mode 1: Enable Online Payments */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "16px",
                borderRadius: "8px",
                border: `2px solid ${onlinePaymentEnabled ? "#23483a" : "#e5e2d9"}`,
                background: onlinePaymentEnabled ? "#f4f7f2" : "#fff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="radio"
                name="online_payment_enabled_choice"
                checked={onlinePaymentEnabled === true}
                onChange={() => setOnlinePaymentEnabled(true)}
                style={{ marginTop: "3px", accentColor: "#23483a" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#1d2a24", marginBottom: "4px" }}>
                  Enable Online Payments (Default)
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#555", lineHeight: 1.4 }}>
                  Accept online payments via UPI, Credit/Debit cards, Netbanking (via Razorpay and YouPI-PG), plus optional Cash on Delivery.
                </p>
              </div>
            </label>

            {/* Mode 2: Disable Online Payments (COD Only) */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "16px",
                borderRadius: "8px",
                border: `2px solid ${!onlinePaymentEnabled ? "#ca8a04" : "#e5e2d9"}`,
                background: !onlinePaymentEnabled ? "#fefce8" : "#fff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="radio"
                name="online_payment_enabled_choice"
                checked={onlinePaymentEnabled === false}
                onChange={() => setOnlinePaymentEnabled(false)}
                style={{ marginTop: "3px", accentColor: "#ca8a04" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#854d0e", marginBottom: "4px" }}>
                  Disable Online Payments (COD Only Mode)
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#666", lineHeight: 1.4 }}>
                  Completely turn off all digital payment gateways across the storefront. Checkout will exclusively present Cash on Delivery (COD).
                </p>
              </div>
            </label>
          </div>

          {!onlinePaymentEnabled && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "#fef3c7",
                border: "1px solid #fde68a",
                fontSize: "13px",
                color: "#92400e",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>COD Only Mode is Active:</strong> Online gateways (Razorpay, YouPI) are paused on the storefront. Customers will only see Cash on Delivery at checkout.
                {!codEnabled && (
                  <div style={{ marginTop: "6px", color: "#b91c1c", fontWeight: 700 }}>
                    ⚠️ Warning: Domestic Cash on Delivery is currently disabled below. You must enable COD so customers can complete checkout!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CARD 0: Active Payment Gateway Routing & Stream Selection */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Payment Gateway Routing</h2>
                  {!onlinePaymentEnabled && (
                    <span style={{ fontSize: "11px", color: "#854d0e", background: "#fef9c3", border: "1px solid #fde047", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
                      Paused (COD Only Mode)
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Select which payment processor handles each checkout stream. Switch between Razorpay and YouPI-PG at any time.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {/* Stream 1: Direct Purchase */}
            <div style={{ background: "#fcfbfa", border: "1px solid #e8e6df", borderRadius: "8px", padding: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#1d2a24" }}>
                Direct Store Purchases
              </label>
              <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px 0", minHeight: "32px" }}>
                Standard cart checkouts and catalog product orders.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="gatewayDirectPurchase"
                    value="razorpay"
                    checked={gatewayDirectPurchase === "razorpay"}
                    onChange={() => setGatewayDirectPurchase("razorpay")}
                  />
                  <span><strong>Razorpay</strong> (Cards, UPI, Netbanking)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="gatewayDirectPurchase"
                    value="youpi"
                    checked={gatewayDirectPurchase === "youpi"}
                    onChange={() => setGatewayDirectPurchase("youpi")}
                  />
                  <span><strong>YouPI-PG</strong> (Zero-Fee Direct UPI)</span>
                </label>
              </div>
            </div>

            {/* Stream 2: Sample Kit */}
            <div style={{ background: "#fcfbfa", border: "1px solid #e8e6df", borderRadius: "8px", padding: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#1d2a24" }}>
                Sample & Trial Kits
              </label>
              <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px 0", minHeight: "32px" }}>
                4x50g discovery kit tastings and sample orders.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="gatewaySampleKit"
                    value="razorpay"
                    checked={gatewaySampleKit === "razorpay"}
                    onChange={() => setGatewaySampleKit("razorpay")}
                  />
                  <span><strong>Razorpay</strong> (Cards, UPI, Netbanking)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="gatewaySampleKit"
                    value="youpi"
                    checked={gatewaySampleKit === "youpi"}
                    onChange={() => setGatewaySampleKit("youpi")}
                  />
                  <span><strong>YouPI-PG</strong> (Zero-Fee Direct UPI)</span>
                </label>
              </div>
            </div>

            {/* Stream 3: Subscriptions */}
            <div style={{ background: "#fcfbfa", border: "1px solid #e8e6df", borderRadius: "8px", padding: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#1d2a24" }}>
                Subscriptions & Renewals
              </label>
              <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px 0", minHeight: "32px" }}>
                Scheduled tea replenishment plans and cycle renewals.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="gatewaySubscription"
                    value="razorpay"
                    checked={gatewaySubscription === "razorpay"}
                    onChange={() => setGatewaySubscription("razorpay")}
                  />
                  <span><strong>Razorpay</strong> (Cards, UPI)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="gatewaySubscription"
                    value="youpi"
                    checked={gatewaySubscription === "youpi"}
                    onChange={() => setGatewaySubscription("youpi")}
                  />
                  <span><strong>YouPI-PG</strong> (UPI Per Billing Cycle)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 1: Gateway Environment & Razorpay Configuration */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
                <CreditCard size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Razorpay Payment Gateway</h2>
                  {!onlinePaymentEnabled && (
                    <span style={{ fontSize: "11px", color: "#854d0e", background: "#fef9c3", border: "1px solid #fde047", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
                      Paused (COD Only Mode)
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Primary online checkout processor for UPI, Credit/Debit cards, and Indian Netbanking.
                </p>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background: paymentMode === "production" ? "#eef6f0" : "#fff8e6",
                color: paymentMode === "production" ? "#1e5e34" : "#92400e",
                border: `1px solid ${paymentMode === "production" ? "#c7e6d0" : "#fde68a"}`,
              }}
            >
              <ShieldCheck size={14} />
              <span>{paymentMode === "production" ? "LIVE PRODUCTION" : "TEST SANDBOX"}</span>
            </span>
          </div>

          {/* ENVIRONMENT TOGGLE */}
          <div style={{ background: "#f8f7f2", border: "1px solid #e7e5dc", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#333" }}>
              Active Gateway Environment
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <label
                style={{
                  flex: "1 1 200px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  border: `2px solid ${paymentMode === "test" ? "#b45309" : "#d1d5db"}`,
                  background: paymentMode === "test" ? "#fffbeb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value="test"
                  checked={paymentMode === "test"}
                  onChange={() => setPaymentMode("test")}
                  style={{ width: "16px", height: "16px", accentColor: "#b45309" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: paymentMode === "test" ? "#92400e" : "#111" }}>
                    Test Mode (Sandbox)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Use dummy test cards (e.g. <code>rzp_test_...</code>). No real money charged.
                  </span>
                </div>
              </label>

              <label
                style={{
                  flex: "1 1 200px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  border: `2px solid ${paymentMode === "production" ? "#23483a" : "#d1d5db"}`,
                  background: paymentMode === "production" ? "#f2f7f4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value="production"
                  checked={paymentMode === "production"}
                  onChange={() => setPaymentMode("production")}
                  style={{ width: "16px", height: "16px", accentColor: "#23483a" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: paymentMode === "production" ? "#1e5e34" : "#111" }}>
                    Production Mode (Live)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Live payments via real UPI, Cards & Netbanking (e.g. <code>rzp_live_...</code>).
                  </span>
                </div>
              </label>
            </div>

            {/* Mode Banner */}
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                lineHeight: "1.5",
                background: paymentMode === "production" ? "#eef6f0" : "#fef3c7",
                color: paymentMode === "production" ? "#166534" : "#92400e",
                border: `1px solid ${paymentMode === "production" ? "#bbf7d0" : "#fde68a"}`,
              }}
            >
              {paymentMode === "production" ? (
                <span>🛡️ <strong>Live Mode Active:</strong> Storefront checkout uses production credentials. Active Key ID: <code>{activeKeyId || rzpProdKeyId || "Not set"}</code></span>
              ) : (
                <span>⚠️ <strong>Test Mode Active:</strong> Storefront checkout uses sandbox credentials for risk-free testing. Active Key ID: <code>{activeKeyId || rzpTestKeyId || "Not set"}</code></span>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={rzpEnabled}
                onChange={(e) => setRzpEnabled(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#23483a" }}
              />
              <span><strong>Enable Razorpay Online Checkout</strong></span>
            </label>
          </div>

          {/* SECTION: TEST CREDENTIALS */}
          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", marginBottom: "20px", background: paymentMode === "test" ? "#fffcf4" : "#faf9f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#b45309" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Test Mode Credentials (<code>rzp_test_...</code>)
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: rzpTestKeyId && rzpTestSecretConfigured ? "#1e5e34" : "#666" }}>
                {rzpTestKeyId && rzpTestSecretConfigured ? "✓ Ready for test orders" : "Incomplete test keys"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Key ID
                </label>
                <input
                  type="text"
                  value={rzpTestKeyId}
                  onChange={(e) => setRzpTestKeyId(e.target.value)}
                  placeholder="rzp_test_..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Key Secret {rzpTestSecretConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpTestSecret}
                  onChange={(e) => setRzpTestSecret(e.target.value)}
                  placeholder={rzpTestSecretConfigured ? "•••••••••••• (Unchanged)" : "Enter test secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Webhook Secret {rzpTestWebhookConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpTestWebhookSecret}
                  onChange={(e) => setRzpTestWebhookSecret(e.target.value)}
                  placeholder={rzpTestWebhookConfigured ? "•••••••••••• (Unchanged)" : "Enter test webhook secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>
              Defaults to <code>RAZORPAY_TEST_KEY_ID</code> and <code>RAZORPAY_TEST_KEY_SECRET</code> from environment variables.
            </p>
          </div>

          {/* SECTION: PRODUCTION CREDENTIALS */}
          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", marginBottom: "20px", background: paymentMode === "production" ? "#f4faf6" : "#faf9f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#166534" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Production Mode Credentials (<code>rzp_live_...</code>)
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: rzpProdKeyId && rzpProdSecretConfigured ? "#1e5e34" : "#666" }}>
                {rzpProdKeyId && rzpProdSecretConfigured ? "✓ Ready for live customers" : "Incomplete production keys"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Production Key ID
                </label>
                <input
                  type="text"
                  value={rzpProdKeyId}
                  onChange={(e) => setRzpProdKeyId(e.target.value)}
                  placeholder="rzp_live_..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Production Key Secret {rzpProdSecretConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpProdSecret}
                  onChange={(e) => setRzpProdSecret(e.target.value)}
                  placeholder={rzpProdSecretConfigured ? "•••••••••••• (Unchanged)" : "Enter live secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Production Webhook Secret {rzpProdWebhookConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpProdWebhookSecret}
                  onChange={(e) => setRzpProdWebhookSecret(e.target.value)}
                  placeholder={rzpProdWebhookConfigured ? "•••••••••••• (Unchanged)" : "Enter live webhook secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>
              Defaults to <code>RAZORPAY_PROD_KEY_ID</code> and <code>RAZORPAY_PROD_KEY_SECRET</code> from environment variables.
            </p>
          </div>

          {/* Webhook Endpoint Display */}
          <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "6px", padding: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#495057", marginBottom: "6px" }}>
              Razorpay Webhook URL (Paste into Razorpay Dashboard &gt; Settings &gt; Webhooks)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={webhookUrl}
                style={{ flex: 1, padding: "8px 10px", background: "#fff", border: "1px solid #ced4da", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace" }}
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="button button-outline"
                style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}
              >
                {copiedWebhook ? <Check size={14} color="green" /> : <Copy size={14} />}
                <span>{copiedWebhook ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#6c757d" }}>
              Subscribed events: <code>payment.captured</code>, <code>payment.failed</code>, <code>refund.processed</code>.
            </p>
          </div>
        </div>

        {/* CARD 1.5: YouPI-PG Gateway Configuration */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "8px", borderRadius: "8px", color: "#059669" }}>
                <QrCode size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>YouPI-PG Gateway Settings</h2>
                  {!onlinePaymentEnabled && (
                    <span style={{ fontSize: "11px", color: "#854d0e", background: "#fef9c3", border: "1px solid #fde047", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
                      Paused (COD Only Mode)
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Self-hosted zero-fee UPI payment gateway with automated observer payment verification.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={handleTestYoupiConnection}
                disabled={testingYoupi}
                className="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                  cursor: testingYoupi ? "wait" : "pointer",
                }}
              >
                {testingYoupi ? <RefreshCw className="spin" size={13} /> : <Activity size={13} />}
                <span>{testingYoupi ? "Testing..." : "Test Connection"}</span>
              </button>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={youpiEnabled}
                  onChange={(e) => setYoupiEnabled(e.target.checked)}
                  style={{ width: "16px", height: "16px" }}
                />
                <span>Enabled</span>
              </label>
            </div>
          </div>

          {youpiTestResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "6px",
                marginBottom: "16px",
                fontSize: "13px",
                background: youpiTestResult.ok ? "#f0fdf4" : "#fef2f2",
                color: youpiTestResult.ok ? "#166534" : "#991b1b",
                border: `1px solid ${youpiTestResult.ok ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              {youpiTestResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{youpiTestResult.message}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "4px" }}>
                Base Payment API URL
              </label>
              <input
                type="url"
                value={youpiApiUrl}
                onChange={(e) => setYoupiApiUrl(e.target.value)}
                placeholder="https://pay-api.biolastic.co.in"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "4px" }}>
                Hosted Checkout URL
              </label>
              <input
                type="url"
                value={youpiCheckoutUrl}
                onChange={(e) => setYoupiCheckoutUrl(e.target.value)}
                placeholder="https://pay.biolastic.co.in"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "4px" }}>
                Admin Portal URL
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="url"
                  value={youpiAdminUrl}
                  onChange={(e) => setYoupiAdminUrl(e.target.value)}
                  placeholder="https://pay-admin.biolastic.co.in"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
                />
                {youpiAdminUrl && (
                  <a
                    href={youpiAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open YouPI Admin"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 10px",
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      color: "#374151",
                    }}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "4px" }}>
                Merchant ID / UUID
              </label>
              <input
                type="text"
                value={youpiMerchantId}
                onChange={(e) => setYoupiMerchantId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000001"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#333" }}>
                  Admin API Token / Merchant Key
                </label>
                {youpiApiTokenConfigured && (
                  <span style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>● Configured</span>
                )}
              </div>
              <input
                type="password"
                value={youpiApiToken}
                onChange={(e) => setYoupiApiToken(e.target.value)}
                placeholder={youpiApiTokenConfigured ? "••••••••••••••••" : "Paste API Token"}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#333" }}>
                  Webhook HMAC Secret
                </label>
                {youpiWebhookConfigured && (
                  <span style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>● Configured</span>
                )}
              </div>
              <input
                type="password"
                value={youpiWebhookSecret}
                onChange={(e) => setYoupiWebhookSecret(e.target.value)}
                placeholder={youpiWebhookConfigured ? "••••••••••••••••" : "Paste Webhook Secret"}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
          </div>

          {/* Webhook endpoint copy */}
          <div style={{ background: "#f8f7f2", border: "1px solid #e7e5dc", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#666", marginBottom: "2px" }}>
                  TeaFloww YouPI Webhook Target URL
                </span>
                <code style={{ fontSize: "12px", color: "#1d2a24", wordBreak: "break-all" }}>{youpiWebhookUrl}</code>
              </div>
              <button
                type="button"
                onClick={handleCopyYoupiWebhook}
                className="button button-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {copiedYoupiWebhook ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                <span>{copiedYoupiWebhook ? "Copied" : "Copy URL"}</span>
              </button>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#777" }}>
              Configure this URL under <em>Merchant Settings → Webhook URL</em> in the YouPI Admin dashboard.
            </p>
          </div>
        </div>

        {/* CARD 2: Cash on Delivery (COD) Policies */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
              <Banknote size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Cash on Delivery (COD) Rules</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                Enable or restrict cash payments upon courier doorstep arrival in India. Synced with <a href="/admin/shipping-settings" style={{ color: "#23483a", fontWeight: 600, textDecoration: "underline" }}>Shipping &amp; Delivery Settings</a>.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={codEnabled}
                onChange={(e) => setCodEnabled(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#23483a" }}
              />
              <span><strong>Enable Cash on Delivery (COD) Option</strong></span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                COD Convenience Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={codFeeRupees}
                onChange={(e) => setCodFeeRupees(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>Set 0 for free COD handling.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={codMinRupees}
                onChange={(e) => setCodMinRupees(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>Orders below this cannot use COD.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Maximum Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={codMaxRupees}
                onChange={(e) => setCodMaxRupees(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>High-value orders require online payment.</span>
            </div>
          </div>
        </div>

        {/* CARD 3: Payment Method Discounts & Prepaid Incentives */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.12)", padding: "8px", borderRadius: "8px", color: "#059669" }}>
              <Zap size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Payment Method Discounts & Prepaid Incentives</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                Incentivize digital prepaid orders over Cash on Delivery by offering instant discounts on UPI and cards.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Promotional Banner & Badge Text
            </label>
            <input
              type="text"
              maxLength={100}
              value={paymentDiscountBadgeText}
              onChange={(e) => setPaymentDiscountBadgeText(e.target.value)}
              placeholder="e.g. ⚡ Instant 2% Off with UPI · 1% Off on Cards"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
            />
            <span style={{ fontSize: "12px", color: "#666" }}>Appears on product pages, cart, and checkout headers.</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            {/* UPI Section */}
            <div style={{ background: "#f8faf9", border: "1px solid #d1e7dd", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#0f5132", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={16} /> UPI & QR Code
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={upiDiscountEnabled}
                    onChange={(e) => setUpiDiscountEnabled(e.target.checked)}
                    style={{ accentColor: "#059669" }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Discount Type</label>
                  <select
                    value={upiDiscountType}
                    onChange={(e) => setUpiDiscountType(e.target.value as "percentage" | "flat")}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>
                    {upiDiscountType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={upiDiscountType === "percentage" ? "0.5" : "1"}
                    value={upiDiscountValue}
                    onChange={(e) => setUpiDiscountValue(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={upiDiscountMaxRupees}
                  onChange={(e) => setUpiDiscountMaxRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#777" }}>Set 0 for unlimited cap.</span>
              </div>
            </div>

            {/* Cards Section */}
            <div style={{ background: "#fbfbfb", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#333", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CreditCard size={16} /> Credit & Debit Cards
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={cardDiscountEnabled}
                    onChange={(e) => setCardDiscountEnabled(e.target.checked)}
                    style={{ accentColor: "#23483a" }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Discount Type</label>
                  <select
                    value={cardDiscountType}
                    onChange={(e) => setCardDiscountType(e.target.value as "percentage" | "flat")}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>
                    {cardDiscountType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={cardDiscountType === "percentage" ? "0.5" : "1"}
                    value={cardDiscountValue}
                    onChange={(e) => setCardDiscountValue(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cardDiscountMaxRupees}
                  onChange={(e) => setCardDiscountMaxRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#777" }}>Set 0 for unlimited cap.</span>
              </div>
            </div>

            {/* Net Banking Section */}
            <div style={{ background: "#fbfbfb", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#333", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Banknote size={16} /> Net Banking & Wallets
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={netbankingDiscountEnabled}
                    onChange={(e) => setNetbankingDiscountEnabled(e.target.checked)}
                    style={{ accentColor: "#23483a" }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Discount Type</label>
                  <select
                    value={netbankingDiscountType}
                    onChange={(e) => setNetbankingDiscountType(e.target.value as "percentage" | "flat")}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>
                    {netbankingDiscountType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={netbankingDiscountType === "percentage" ? "0.5" : "1"}
                    value={netbankingDiscountValue}
                    onChange={(e) => setNetbankingDiscountValue(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={netbankingDiscountMaxRupees}
                  onChange={(e) => setNetbankingDiscountMaxRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#777" }}>Set 0 for unlimited cap.</span>
              </div>
            </div>
          </div>

          {/* Min Order & Simulation Summary */}
          <div style={{ background: "#edf4f0", border: "1px solid #bce1ce", borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#14452f", marginBottom: "4px" }}>
                  Minimum Order Value for Discounts (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minOrderForDiscountRupees}
                  onChange={(e) => setMinOrderForDiscountRupees(Number(e.target.value))}
                  style={{ width: "100%", maxWidth: "200px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                />
                <span style={{ fontSize: "12px", color: "#447055", display: "block", marginTop: "2px" }}>Set 0 to offer discounts on all orders.</span>
              </div>

              <div style={{ flex: "2 1 300px", background: "#fff", padding: "12px 16px", borderRadius: "6px", border: "1px solid #c7e0d3" }}>
                <strong style={{ fontSize: "13px", color: "#14452f", display: "block", marginBottom: "6px" }}>
                  💡 Live Simulation on a ₹1,000 Order:
                </strong>
                <div style={{ fontSize: "12px", color: "#333", lineHeight: 1.6 }}>
                  <div>• <strong>UPI:</strong> Saves ₹{upiDiscountEnabled ? (upiDiscountType === "percentage" ? Math.min(1000 * upiDiscountValue / 100, upiDiscountMaxRupees || Infinity) : Math.min(upiDiscountValue, upiDiscountMaxRupees || Infinity)) : 0} (Customer pays ₹{1000 - (upiDiscountEnabled ? (upiDiscountType === "percentage" ? Math.min(1000 * upiDiscountValue / 100, upiDiscountMaxRupees || Infinity) : Math.min(upiDiscountValue, upiDiscountMaxRupees || Infinity)) : 0)})</div>
                  <div>• <strong>Card:</strong> Saves ₹{cardDiscountEnabled ? (cardDiscountType === "percentage" ? Math.min(1000 * cardDiscountValue / 100, cardDiscountMaxRupees || Infinity) : Math.min(cardDiscountValue, cardDiscountMaxRupees || Infinity)) : 0} (Customer pays ₹{1000 - (cardDiscountEnabled ? (cardDiscountType === "percentage" ? Math.min(1000 * cardDiscountValue / 100, cardDiscountMaxRupees || Infinity) : Math.min(cardDiscountValue, cardDiscountMaxRupees || Infinity)) : 0)})</div>
                  <div>• <strong>Cash on Delivery:</strong> No discount + ₹{codFeeRupees} fee (Customer pays ₹{1000 + codFeeRupees})</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD: Wholesale Orders: Direct Bank Transfer & Advance PG Configuration */}
        <div
          className="tf-ops-card"
          style={{
            background: "#fff",
            border: "1px solid #e5e2d9",
            borderRadius: "10px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(35, 72, 58, 0.1)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
                <Banknote size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Wholesale Order Payment &amp; Advance PG Rules</h2>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#666" }}>
                  Wholesale orders are dispatched via commercial transport (To-Pay Bilty). COD is strictly disabled. Set the advance % payable via PG at checkout, and company bank details for direct A/C transfers.
                </p>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background: wholesaleAdvancePercent === 0 ? "#eff6ff" : "#eef6f0",
                color: wholesaleAdvancePercent === 0 ? "#1d4ed8" : "#1e5e34",
                border: `1px solid ${wholesaleAdvancePercent === 0 ? "#bfdbfe" : "#c7e6d0"}`,
                whiteSpace: "nowrap",
              }}
            >
              {wholesaleAdvancePercent === 0 ? "100% Direct Bank Transfer (0% PG)" : `${wholesaleAdvancePercent}% Advance via PG`}
            </span>
          </div>

          <div style={{ background: "#faf8f4", border: "1px solid #d9d4c8", borderRadius: "8px", padding: "18px", marginBottom: "20px" }}>
            <div style={{ maxWidth: "340px", marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#1d2a24" }}>
                Wholesale Advance Percent (0–100%)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={wholesaleAdvancePercent}
                  onChange={(e) => setWholesaleAdvancePercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  style={{ width: "120px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px", fontWeight: 600 }}
                />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#23483a" }}>%</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#63665e", lineHeight: 1.4 }}>
                {wholesaleAdvancePercent === 0
                  ? "At 0%, customers bypass online payment at checkout; order is created immediately as 'Awaiting Bank Transfer' with surface transport to-pay."
                  : `Customers pay ${wholesaleAdvancePercent}% online via PG at checkout. The remaining ${100 - wholesaleAdvancePercent}% balance is settled via direct bank transfer before dispatch.`}
              </p>
            </div>
          </div>

          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", background: "#fbfbfb" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#1d2a24", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Company Bank Account Details (Presented on Checkout &amp; Order Confirmation)
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Beneficiary Account Name</label>
                <input
                  type="text"
                  value={wholesaleBankBeneficiary}
                  onChange={(e) => setWholesaleBankBeneficiary(e.target.value)}
                  placeholder="e.g. Nirva"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Bank Name</label>
                <input
                  type="text"
                  value={wholesaleBankName}
                  onChange={(e) => setWholesaleBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Account Number</label>
                <input
                  type="text"
                  value={wholesaleBankAccountNumber}
                  onChange={(e) => setWholesaleBankAccountNumber(e.target.value)}
                  placeholder="e.g. 50200012345678"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>IFSC Code</label>
                <input
                  type="text"
                  value={wholesaleBankIfsc}
                  onChange={(e) => setWholesaleBankIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0000123"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Branch Name</label>
                <input
                  type="text"
                  value={wholesaleBankBranch}
                  onChange={(e) => setWholesaleBankBranch(e.target.value)}
                  placeholder="e.g. Siliguri"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>UPI ID (Optional)</label>
                <input
                  type="text"
                  value={wholesaleBankUpiId}
                  onChange={(e) => setWholesaleBankUpiId(e.target.value)}
                  placeholder="e.g. nirva@okhdfcbank"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="submit"
            disabled={saving}
            className="button button-primary"
            style={{
              padding: "12px 24px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
            <span>{saving ? "Saving Settings..." : "Save Payment Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
