"use client";
import React, { useEffect, useState, useRef } from "react";
import { trackPurchase } from "@/lib/seo/tracking";
import type { quoteAnalytics } from "@/lib/international/analytics";
import { useCart } from "@/components/CartProvider";
export function PurchaseStatus({ id, token, initial, analytics }: { id: string; token: string; initial: string; analytics: ReturnType<typeof quoteAnalytics> }) {
  const [status, setStatus] = useState(initial), [tracking, setTracking] = useState<{ code: string; status: string } | null>(null), [message, setMessage] = useState("");
  const { clear } = useCart();
  const tracked = useRef(false);
  useEffect(() => {
    if (status !== "paid" || tracked.current) return;
    try { if (localStorage.getItem(`tf_purchase_${id}`)) { tracked.current = true; return; } } catch {}
    trackPurchase(id, analytics.total, analytics.shipping, analytics.tax, analytics.items, analytics.currency);
    tracked.current = true;
    try { localStorage.setItem(`tf_purchase_${id}`, "1"); } catch {}
  }, [id, status, analytics]);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/commerce/order?id=${id}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const result = await response.json(); if (active) { setStatus(result.paymentStatus); setTracking(result.tracking); setMessage(""); }
      } catch { if (active) setMessage("Status is temporarily unavailable. Please refresh shortly."); }
    };
    poll(); const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [id, token]);
  useEffect(() => { if (["paid", "cod_due"].includes(status)) clear(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const text: Record<string, string> = { payment_pending: "Payment verification pending. Confirmation appears after the payment provider verifies capture.", payment_failed: "Payment was not completed. Contact us if your bank shows a debit.", creating: "Preparing your payment.", creation_uncertain: "Your payment request needs verification. Please contact us with the order reference.", paid: "Payment confirmed. Your order is awaiting preparation.", paid_exception: "Payment received. Our team is reviewing fulfillment and will arrange delivery or a refund.", cod_due: "Cash on delivery order received. Payment is due on delivery.", cod_remitted: "Cash on delivery remittance confirmed.", refunded: "Your payment has been refunded.", partially_refunded: "A partial refund has been processed.", cancelled: "This order has been cancelled." };
  return (
    <div
      className="p-4 sm:p-5 rounded-xl border border-[#ded7cb] bg-[#faf7f2] shadow-sm mb-6"
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
              ["paid", "cod_due", "cod_remitted"].includes(status)
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
    </div>
  );
}
