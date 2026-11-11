"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  XCircle,
  Printer,
  ShieldCheck,
  CreditCard,
  MapPin,
  ArrowLeft,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { CustomerOrderDossier } from "@/lib/customerOrders";
import { formatINR } from "@/lib/money";

const TIMELINE_STEPS = [
  { key: "unfulfilled", label: "Order Placed", desc: "Received at Siliguri Hub" },
  { key: "preparing", label: "Preparing", desc: "Vacuum-sealed packaging" },
  { key: "shipped", label: "In Transit", desc: "Courier partner dispatched" },
  { key: "delivered", label: "Delivered", desc: "Arrived at destination" },
];

function getTimelineIndex(dispatchStatus: string): number {
  const norm = (dispatchStatus || "unfulfilled").toLowerCase();
  if (norm === "delivered") return 3;
  if (norm === "shipped") return 2;
  if (norm === "preparing") return 1;
  return 0;
}

export default function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<CustomerOrderDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("Ordered wrong tea or size");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      try {
        const res = await fetch(`/api/customer/orders/${encodeURIComponent(id)}`);
        if (res.status === 401) {
          router.push(`/login?redirect=/account/orders/${encodeURIComponent(id)}`);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Order not found.");
        }
        const data = await res.json();
        if (active) setOrder(data.order);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load order.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      active = false;
    };
  }, [id, router]);

  async function handleCancelOrder() {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order.");

      setOrder(data.order);
      setCancelOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Unable to cancel order.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="container page-shell py-16 text-center text-xs text-[#5c6659]">
        <p><StorefrontText id="copy_85ff5f40199bb28e" fallback="Loading order details #" />{id.slice(0, 8)}…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container page-shell py-12 max-w-3xl mx-auto px-4">
        <div className="p-8 rounded-2xl border border-[#ded7cb] bg-[#fffefa] text-center">
          <AlertCircle size={36} className="text-[#b91c1c] mx-auto mb-3" />
          <h1 className="text-xl font-serif font-bold text-[#171713]"><StorefrontText id="copy_c8e4d6b93505eed6" fallback="Unable to load order" />
          </h1>
          <p className="text-xs text-[#5c6659] mt-1 mb-6">
            {error || "We could not find that order in your account."}
          </p>
          <Link
            href="/account/orders"
            className="px-4 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors"
          ><StorefrontText id="copy_46c72bff635e2c59" fallback="← Back to My Orders" />
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled =
    order.dispatch_status === "cancelled" || order.status === "cancelled";
  const isDelivered = order.dispatch_status === "delivered";
  const activeStep = getTimelineIndex(order.dispatch_status);

  return (
    <div className="container page-shell py-10 max-w-4xl mx-auto px-4 sm:px-6">
      {/* Breadcrumb */}
      <nav className="breadcrumbs mb-4 text-xs text-[#737067]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#171713]"><StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" />
        </Link>{" "}
        /{" "}
        <Link href="/account" className="hover:text-[#171713]"><StorefrontText id="copy_7e1b0d5641f2640c" fallback="Account" />
        </Link>{" "}
        /{" "}
        <Link href="/account/orders" className="hover:text-[#171713]"><StorefrontText id="copy_00db793f2b8cff97" fallback="My Orders" />
        </Link>{" "}
        / <span className="text-[#171713] font-bold" aria-current="page">#{order.reference}</span>
      </nav>

      {/* Top Bar with Reference & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ded7cb] mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal"><StorefrontText id="copy_a458d68f7f27f131" fallback="Order #" />{order.reference}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isDelivered
                  ? "bg-[#e8f5e9] text-[#2e7d32]"
                  : isCancelled
                  ? "bg-[#ffebee] text-[#c62828]"
                  : order.dispatch_status === "shipped"
                  ? "bg-[#fff8e1] text-[#b39156]"
                  : "bg-[#e8f0fe] text-[#1565c0]"
              }`}
            >
              {isCancelled
                ? "Cancelled"
                : isDelivered
                ? "Delivered"
                : order.dispatch_status === "shipped"
                ? "In Transit"
                : "Preparing"}
            </span>
          </div>
          <p className="text-xs text-[#5c6659] mt-1"><StorefrontText id="copy_bef9707be900fb31" fallback="Placed on" /> {new Date(order.created_at).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}<StorefrontText id="copy_1cb75de85b989788" fallback="· Single-Estate Himalayan Orthodox Teas" />
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg border border-[#c2bcae] bg-white text-xs font-semibold text-[#171713] hover:bg-[#f5f1e8] transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Printer size={15} />
            <span><StorefrontText id="copy_633b842126372b87" fallback="Print Tax Invoice" /></span>
          </button>

          {order.is_cancellable && (
            <button
              type="button"
              onClick={() => {
                setCancelOpen(true);
                setCancelError(null);
              }}
              className="px-3.5 py-2 rounded-lg border border-[#fca5a5] text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] transition-colors"
            ><StorefrontText id="copy_205f0163b0d783b2" fallback="Cancel Order" />
            </button>
          )}
        </div>
      </div>

      {order.shipping_method === "subscription" && <Link href="/account/subscriptions" className="button button-outline"><StorefrontText id="copy_20feba1f0e63ec41" fallback="Manage subscription, skip or cancel shipment →" /></Link>}
      {/* Cancellation Notice Banner (if cancelled) */}
      {isCancelled && (
        <div className="mb-8 p-5 rounded-2xl border border-[#fca5a5] bg-[#fff5f5] text-xs text-[#991b1b]">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="flex-none mt-0.5" />
            <div>
              <p className="font-bold text-sm"><StorefrontText id="copy_36e67184c13c82c6" fallback="This order has been cancelled." /></p>
              <p className="mt-1 text-[#7f1d1d] leading-relaxed"><StorefrontText id="copy_ad5feec1e7cb4c71" fallback="The items have been returned to origin inventory. If any payment was captured, the refund is processed directly back to your original source of payment within 2–5 business days." />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Timeline (if active or delivered) */}
      {!isCancelled && (
        <section className="mb-8 p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-serif font-bold text-[#171713]"><StorefrontText id="copy_a375b432a8b8bf5a" fallback="Shipment Progress" />
              </h2>
              <p className="text-[11px] text-[#5c6659] mt-0.5">
                Dispatched directly from Nirva Works &amp; Cupping Facility in Siliguri (PIN 734015)
              </p>
            </div>
            <Link
              href={`/track?id=${order.id}`}
              className="text-xs font-semibold text-[#23483a] hover:underline inline-flex items-center gap-1"
            ><StorefrontText id="copy_c6abd4c6feeb152a" fallback="Live Tracking Page →" />
            </Link>
          </div>

          {/* Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative">
            {TIMELINE_STEPS.map((step, idx) => {
              const isDone = idx <= activeStep;
              const isCurrent = idx === activeStep;

              return (
                <div key={step.key} className="flex flex-col items-start text-left">
                  <div className="flex items-center gap-2 mb-2 w-full">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isDone
                          ? "bg-[#23483a] text-white"
                          : "bg-[#eee8dc] text-[#737067]"
                      } ${isCurrent ? "ring-4 ring-[#d8e2d5]" : ""}`}
                    >
                      {idx + 1}
                    </div>
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div
                        className={`hidden sm:block flex-1 h-0.5 ${
                          idx < activeStep ? "bg-[#23483a]" : "bg-[#eee8dc]"
                        }`}
                      />
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isDone ? "text-[#171713]" : "text-[#737067]"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-[#5c6659] mt-0.5">
                    {step.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Itemized Order Table */}
      <section className="mb-8 rounded-2xl border border-[#ded7cb] bg-[#fffefa] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[#eee8dc]">
          <h2 className="text-sm font-serif font-bold text-[#171713]"><StorefrontText id="copy_4d91a975fc2c7865" fallback="Items in this Package (" />{order.item_count})
          </h2>
        </div>

        <div className="divide-y divide-[#eee8dc]">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#f4f7f2] border border-[#dce5da] flex items-center justify-center flex-none">
                  <Package size={24} className="text-[#23483a]" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#171713]">
                    {item.productName}
                  </h3>
                  <p className="text-[#5c6659] mt-0.5"><StorefrontText id="copy_85d15f3089612170" fallback="Estate:" /> {item.estate}<StorefrontText id="copy_49a244589fcb4eea" fallback="· Flush:" /> {item.flush}
                  </p>
                  <p className="text-[#737067] text-[11px] mt-0.5"><StorefrontText id="copy_9311e5cc88d53298" fallback="Unit:" /> {item.grams}<StorefrontText id="copy_2802d03ea79de4bd" fallback="g vacuum pouch · Rate:" /> {formatINR(item.unitPricePaise)}
                  </p>
                </div>
              </div>

              <div className="text-right sm:self-center">
                <p className="text-xs text-[#5c6659]"><StorefrontText id="copy_e1feb563b3deed91" fallback="Qty:" /> {item.quantity}</p>
                <p className="text-sm font-bold text-[#171713] mt-0.5">
                  {formatINR(item.totalPricePaise)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Two-Column Financial & Delivery Dossier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left: Financial Summary & Taxes */}
        <div className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] shadow-sm space-y-4">
          <h2 className="text-sm font-serif font-bold text-[#171713] pb-2 border-b border-[#eee8dc]">
            Financial Breakdown &amp; GST
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-[#5c6659]">
              <span><StorefrontText id="copy_2cba95cd092168f5" fallback="Merchandise Subtotal" /></span>
              <span className="font-semibold text-[#171713]">
                {formatINR(order.total_paise - order.shipping_paise + order.discount_paise)}
              </span>
            </div>

            {order.discount_paise > 0 && (
              <div className="flex justify-between text-[#15803d]">
                <span className="flex items-center gap-1">
                  <Sparkles size={13} />
                  <span><StorefrontText id="copy_321c199aa76a38cc" fallback="Coupon Discount (" />{order.coupon_code || "OFFER"})</span>
                </span>
                <span className="font-semibold">−{formatINR(order.discount_paise)}</span>
              </div>
            )}

            <div className="flex justify-between text-[#5c6659]">
              <span><StorefrontText id="copy_dce770fffd8a0258" fallback="Himalayan Courier Delivery" /></span>
              <span className="font-semibold text-[#171713]">
                {order.shipping_paise === 0 ? "FREE" : formatINR(order.shipping_paise)}
              </span>
            </div>

            <div className="flex justify-between text-[#737067] text-[11px] pt-1">
              <span><StorefrontText id="copy_d0338f9b5e96af2f" fallback="GST Included (5% Tea HSN 090230)" /></span>
              <span>{formatINR(order.tax_paise)}</span>
            </div>

            <div className="pt-3 border-t border-[#eee8dc] flex justify-between items-center text-sm font-bold text-[#171713]">
              <span><StorefrontText id="copy_dab186dfe5434c60" fallback="Final Total Paid" /></span>
              <span className="text-base text-[#23483a]">{formatINR(order.total_paise)}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#eee8dc] text-[11px] text-[#737067] leading-relaxed">
            <p><strong><StorefrontText id="copy_6c10a4f2d0bd1818" fallback="Nirva" /></strong><StorefrontText id="copy_d08aec01cad41f74" fallback="· GSTIN: 19CTHPK8646J2ZY" /></p>
            <p><StorefrontText id="copy_6ed4f7d26a8a84ca" fallback="Fulbari Ghoshpukur Bypass, Siliguri, WB 734015" /></p>
          </div>
        </div>

        {/* Right: Payment Method & Delivery Address */}
        <div className="space-y-6">
          {/* Payment Method */}
          <div className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#eee8dc]">
              <h2 className="text-sm font-serif font-bold text-[#171713] flex items-center gap-1.5">
                <CreditCard size={16} className="text-[#23483a]" /><StorefrontText id="copy_1eb2588957f7d863" fallback="Payment Information" />
              </h2>
              <span className="text-xs font-bold text-[#23483a] capitalize">
                {order.payment_status}
              </span>
            </div>

            <div className="text-xs text-[#46524a] space-y-1.5">
              <p>
                <strong className="text-[#171713]"><StorefrontText id="copy_9e943b1e112b5ede" fallback="Method:" /> </strong>
                <span className="capitalize">{order.payment_status === "cod_due" ? "Cash on Delivery" : "UPI / Online Payment"}</span>
              </p>
              <p>
                <strong className="text-[#171713]"><StorefrontText id="copy_177730351299510a" fallback="Transaction Reference:" /> </strong>
                <span className="font-mono text-[11px]">{order.id}</span>
              </p>
              <p className="text-[11px] text-[#737067] pt-1 flex items-center gap-1">
                <ShieldCheck size={13} className="text-[#23483a]" />
                Verified &amp; reconciled with gateway records
              </p>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#eee8dc]">
              <h2 className="text-sm font-serif font-bold text-[#171713] flex items-center gap-1.5">
                <MapPin size={16} className="text-[#23483a]" /><StorefrontText id="copy_ccf2c43ef257b089" fallback="Delivery Address" />
              </h2>
            </div>

            <div className="text-xs text-[#46524a] space-y-1">
              <p className="font-bold text-[#171713]">{order.customer_name}</p>
              <p>{order.shipping_address}</p>
              {order.customer_phone && (
                <p className="text-[#737067] text-[11px]"><StorefrontText id="copy_3305eb58093dce17" fallback="Phone:" /> {order.customer_phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center pt-4">
        <Link
          href="/account/orders"
          className="text-xs font-semibold text-[#23483a] hover:underline inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /><StorefrontText id="copy_0839659ae62bda67" fallback="Back to all orders" />
        </Link>
      </div>

      {/* Cancel Order Confirmation Modal */}
      {cancelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#fffefa] border border-[#ded7cb] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 id="cancel-title" className="text-lg font-serif font-bold text-[#171713]"><StorefrontText id="copy_a432e33b47e9eedd" fallback="Cancel Order #" />{order.reference}?
            </h3>
            <p className="text-xs text-[#5c6659] mt-1.5 leading-relaxed"><StorefrontText id="copy_55562f938e4bd404" fallback="This order will be immediately cancelled and the reserved teas released. If already paid, a full refund will be recorded." />
            </p>

            {cancelError && (
              <div role="alert" className="my-3 p-3 rounded-lg bg-[#fef2f2] border border-[#fca5a5] text-xs text-[#991b1b]">
                {cancelError}
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="modal-cancel-reason" className="block text-xs font-semibold text-[#171713] mb-1"><StorefrontText id="copy_8a899eb47f221a83" fallback="Reason for cancellation *" />
              </label>
              <select
                id="modal-cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[#b8b5a8] px-3 py-2 bg-white text-xs text-[#171713] outline-none focus:border-[#23483a]"
              >
                <option value="Ordered wrong tea or size">Ordered wrong tea or size</option>
                <option value="Need to change delivery address">Need to change delivery address</option>
                <option value="Found another product">Found another product</option>
                <option value="Estimated delivery date is too late">Estimated delivery date is too late</option>
                <option value="Changed mind">Changed mind</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#eee8dc]">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={cancelling}
                className="px-4 py-2 rounded-lg border border-[#c2bcae] text-xs font-semibold text-[#171713] hover:bg-[#f5f1e8] transition-colors"
              ><StorefrontText id="copy_83dce9e54e12b492" fallback="Keep Order" />
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="px-4 py-2 rounded-lg bg-[#b91c1c] text-white text-xs font-bold hover:bg-[#991b1b] transition-colors"
              >
                {cancelling ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
