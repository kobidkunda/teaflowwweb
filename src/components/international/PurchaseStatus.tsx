"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_EVENT } from "@/lib/seo/consent";
import { trackPurchase } from "@/lib/seo/tracking";
import type { quoteAnalytics } from "@/lib/international/analytics";
import { useCart } from "@/components/CartProvider";
import { Truck, RefreshCw } from "lucide-react";

export function PurchaseStatus({
  id,
  token,
  initial,
  analytics,
  isWholesale = false,
}: {
  id: string;
  token: string;
  initial: string;
  analytics: ReturnType<typeof quoteAnalytics>;
  isWholesale?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [tracking, setTracking] = useState<{ code: string; status: string } | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<"cod" | "retry" | null>(null);
  const { clear } = useCart();

  useEffect(() => {
    const record = () => {
      if (["paid", "cod_due", "cod_remitted", "advance_paid", "pending_bank_transfer"].includes(status)) {
        trackPurchase(
          id,
          analytics.value,
          analytics.shipping,
          analytics.tax,
          analytics.items,
          analytics.currency,
          analytics.total
        );
      }
    };
    record();
    window.addEventListener(CONSENT_EVENT, record);
    return () => window.removeEventListener(CONSENT_EVENT, record);
  }, [id, status, analytics]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/commerce/order?id=${id}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (active) {
          setStatus(result.paymentStatus);
          setTracking(result.tracking);
          if (["paid", "cod_due", "cod_remitted", "advance_paid", "pending_bank_transfer"].includes(result.paymentStatus)) {
            setActionError("");
          }
        }
      } catch {
        if (active && !message) setMessage("Status is temporarily unavailable. Please refresh shortly.");
      }
    };
    poll();
    const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [id, token, message]);

  useEffect(() => {
    if (["paid", "cod_due", "cod_remitted", "advance_paid", "pending_bank_transfer"].includes(status)) {
      clear();
    }
  }, [status, clear]);

  const isConfirmed = ["paid", "cod_due", "cod_remitted", "advance_paid", "pending_bank_transfer"].includes(status);
  const isFailedOrPending = ["payment_failed", "payment_pending", "creation_uncertain", "creating"].includes(status);

  async function handleSwitchToCod() {
    setBusyAction("cod");
    setActionError("");
    try {
      const res = await fetch("/api/commerce/change-to-cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to switch order to Cash on Delivery.");
      setStatus("cod_due");
      clear();
      setMessage("Order successfully changed to Cash on Delivery! Payment is due upon delivery.");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to change order to Cash on Delivery.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRetryPayment() {
    setBusyAction("retry");
    setActionError("");
    try {
      const res = await fetch("/api/commerce/retry-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to initiate payment retry.");
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.gateway === "razorpay" && typeof window !== "undefined" && (window as unknown as { Razorpay?: new (opts: unknown) => { open: () => void } }).Razorpay) {
        const widget = new (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay({
          key: data.keyId,
          order_id: data.gatewayOrderId,
          name: "TeaFloww",
          handler: () => {
            // A browser callback is not payment confirmation. Poll the server,
            // whose paid status is established by the verified gateway webhook.
            setMessage("Payment submitted. Waiting for verification.");
            router.refresh();
          },
          modal: { ondismiss: () => setBusyAction(null) },
          theme: { color: "#23483A" },
        });
        widget.open();
        return;
      }
      setMessage("Payment retry request initiated. Please check your payment app or reload.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to retry online payment.");
    } finally {
      setBusyAction(null);
    }
  }

  const text: Record<string, string> = {
    payment_pending: "Payment verification pending. If money was debited, your bank will update shortly.",
    payment_failed: "Online payment was not completed or was cancelled.",
    creating: "Preparing your payment.",
    creation_uncertain: "Your payment request needs verification. Please retry or change to Cash on Delivery.",
    paid: "Payment confirmed. Your order is awaiting preparation.",
    pending_bank_transfer: "Wholesale order confirmed. Awaiting direct A/C transfer prior to transport dispatch.",
    advance_paid: "Wholesale advance payment received. Balance due via direct A/C transfer prior to transport dispatch.",
    paid_exception: "Payment received. Our team is reviewing fulfillment and will arrange delivery or a refund.",
    cod_due: "Cash on delivery order received. Payment is due on delivery.",
    cod_remitted: "Cash on delivery remittance confirmed.",
    refunded: "Your payment has been refunded.",
    partially_refunded: "A partial refund has been processed.",
    cancelled: "This order has been cancelled.",
  };

  return (
    <div
      className={`p-4 sm:p-6 rounded-xl border shadow-sm mb-6 transition-all ${
        isConfirmed
          ? "border-[#ded7cb] bg-[#faf7f2]"
          : "border-[#f5c6cb] bg-[#fffaf9]"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full mt-1 flex-shrink-0 ${
              isConfirmed
                ? "bg-[#2e7d32]"
                : status.includes("failed") || status === "cancelled"
                ? "bg-[#c62828]"
                : "bg-[#b39156] animate-pulse"
            }`}
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#171713] leading-snug">
              {text[status] || "Your order is under review."}
            </h3>
            {tracking && (
              <p className="text-xs text-[#5c6659] mt-1">
                Shipment: <strong className="text-[#171713]">{tracking.status}</strong>
                {tracking.code ? ` · Tracking ID: ${tracking.code}` : ""}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="text-xs font-semibold text-[#23483a] mt-2 bg-[#e8f5e9] px-2.5 py-1 rounded inline-block"
              >
                {message}
              </p>
            )}
            {actionError && (
              <p
                role="alert"
                className="text-xs font-semibold text-[#c62828] mt-2 bg-[#fde8e8] px-2.5 py-1 rounded inline-block"
              >
                {actionError}
              </p>
            )}
          </div>
        </div>

        <button
          className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-[#ded7cb] bg-white text-xs font-semibold text-[#171713] hover:bg-[#f6f1e7] transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-xs"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${window.location.origin}/purchase/${id}?token=${encodeURIComponent(token)}`
              );
              setMessage("Private order link copied to clipboard.");
            } catch {
              setMessage("The link could not be copied. Save this page from your browser.");
            }
          }}
        >
          <span>Copy private order link</span>
        </button>
      </div>

      {/* Prominent recovery options when payment failed or pending */}
      {isFailedOrPending && (
        <div className="mt-5 pt-4 border-t border-[#f0ede6] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!isWholesale && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleSwitchToCod}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-[#23483a] hover:bg-[#1a382d] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Truck size={16} aria-hidden="true" />
              <span>
                {busyAction === "cod" ? "Switching to COD…" : "Change to Cash on Delivery (COD) →"}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleRetryPayment}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-[#23483a] text-[#23483a] hover:bg-[#f0f5f2] text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={busyAction === "retry" ? "animate-spin" : ""} aria-hidden="true" />
            <span>
              {busyAction === "retry" ? "Connecting to gateway…" : "Retry Online Payment"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
