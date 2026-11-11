"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import type { CustomerOrderSummary } from "@/lib/customerOrders";
import { formatINR } from "@/lib/money";

type FilterTab = "all" | "active" | "delivered" | "cancelled";

export default function MyOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<CustomerOrderSummary | null>(null);
  const [cancelReason, setCancelReason] = useState("Ordered wrong tea or size");
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchOrders() {
      try {
        const res = await fetch("/api/customer/orders");
        if (res.status === 401) {
          router.push("/login?redirect=/account/orders");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active) setOrders(data.orders || []);
      } catch {
        if (active) setOrders([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchOrders();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleConfirmCancel() {
    if (!cancelModalOrder) return;
    setCancellingId(cancelModalOrder.id);
    setCancelError(null);

    try {
      const res = await fetch(`/api/customer/orders/${cancelModalOrder.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order.");

      // Update state locally
      setOrders((prev) =>
        prev.map((o) =>
          o.id === cancelModalOrder.id
            ? {
                ...o,
                dispatch_status: "cancelled",
                status: "cancelled",
                is_cancellable: false,
              }
            : o
        )
      );
      setCancelModalOrder(null);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Unable to cancel order.");
    } finally {
      setCancellingId(null);
    }
  }

  const filteredOrders = orders.filter((order) => {
    const isCancelled =
      order.dispatch_status === "cancelled" || order.status === "cancelled";
    const isDelivered = order.dispatch_status === "delivered";

    if (activeTab === "cancelled") return isCancelled;
    if (activeTab === "delivered") return isDelivered && !isCancelled;
    if (activeTab === "active") return !isDelivered && !isCancelled;
    return true;
  });

  return (
    <div className="container page-shell py-10 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Breadcrumb */}
      <nav className="breadcrumbs mb-4 text-xs text-[#737067]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#171713]"><StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" />
        </Link>{" "}
        /{" "}
        <Link href="/account" className="hover:text-[#171713]"><StorefrontText id="copy_7e1b0d5641f2640c" fallback="Account" />
        </Link>{" "}
        / <span className="text-[#171713] font-bold" aria-current="page"><StorefrontText id="copy_00db793f2b8cff97" fallback="My Orders" /></span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow text-xs font-bold uppercase tracking-wider text-[#b39156]">
            Order Management &amp; Dispatch
          </p>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal"><StorefrontText id="copy_00db793f2b8cff97" fallback="My Orders" />
          </h1>
          <p className="text-xs sm:text-sm text-[#5c6659] mt-1"><StorefrontText id="copy_95f512d85c4d339b" fallback="Track current deliveries from Siliguri hub, view detailed invoices, and manage past shipments." />
          </p>
        </div>

        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors self-start sm:self-center"
        >
          <span><StorefrontText id="copy_b51c1ea9a3042ad2" fallback="Explore Teas" /></span> <ArrowRight size={14} />
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#ded7cb] pb-2 mb-6 overflow-x-auto">
        {(
          [
            { id: "all", label: `All Orders (${orders.length})` },
            {
              id: "active",
              label: `In Transit (${
                orders.filter(
                  (o) =>
                    o.dispatch_status !== "delivered" &&
                    o.dispatch_status !== "cancelled" &&
                    o.status !== "cancelled"
                ).length
              })`,
            },
            {
              id: "delivered",
              label: `Delivered (${
                orders.filter((o) => o.dispatch_status === "delivered").length
              })`,
            },
            {
              id: "cancelled",
              label: `Cancelled (${
                orders.filter(
                  (o) =>
                    o.dispatch_status === "cancelled" || o.status === "cancelled"
                ).length
              })`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-[#23483a] text-white"
                : "bg-[#f5f2eb] text-[#5c6659] hover:bg-[#ebe6dc] hover:text-[#171713]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#5c6659]">
          <p><StorefrontText id="copy_c0df4899b4216d2a" fallback="Loading your orders…" /></p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[#ded7cb] bg-[#fffefa] my-6">
          <div className="w-14 h-14 rounded-full bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center mx-auto mb-3">
            <Package size={26} />
          </div>
          <h2 className="text-lg font-serif font-bold text-[#171713]">
            {activeTab === "all"
              ? "No orders found in your account."
              : `No ${activeTab} orders.`}
          </h2>
          <p className="text-xs text-[#5c6659] mt-1 max-w-sm mx-auto">
            {activeTab === "all"
              ? "When you place an order with your account email or phone, your tea shipments will appear here."
              : "Try switching to the 'All Orders' tab to view your full history."}
          </p>
          <div className="mt-5">
            <Link
              href="/shop"
              className="px-5 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors inline-flex items-center gap-2"
            ><StorefrontText id="copy_034ba41ecdeaa391" fallback="Explore Orthodox Teas" /> <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const isCancelled =
              order.dispatch_status === "cancelled" || order.status === "cancelled";
            const isDelivered = order.dispatch_status === "delivered";
            const isShipped = order.dispatch_status === "shipped";

            return (
              <div
                key={order.id}
                className="p-5 sm:p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] shadow-sm hover:border-[#c4bdae] transition-all"
              >
                {/* Order Top Meta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#eee8dc]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#171713]"><StorefrontText id="copy_a458d68f7f27f131" fallback="Order #" />{order.reference}
                      </span>
                      <span className="text-xs text-[#737067]">
                        · {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737067] mt-0.5"><StorefrontText id="copy_3ea36adcd1e02c94" fallback="ID:" /> {order.id}
                    </p>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isDelivered
                          ? "bg-[#e8f5e9] text-[#2e7d32]"
                          : isCancelled
                          ? "bg-[#ffebee] text-[#c62828]"
                          : isShipped
                          ? "bg-[#fff8e1] text-[#b39156]"
                          : "bg-[#e8f0fe] text-[#1565c0]"
                      }`}
                    >
                      {isDelivered && <CheckCircle2 size={13} />}
                      {isCancelled && <XCircle size={13} />}
                      {isShipped && <Truck size={13} />}
                      {!isDelivered && !isCancelled && !isShipped && <Clock size={13} />}
                      <span>
                        {isCancelled
                          ? "Cancelled"
                          : isDelivered
                          ? "Delivered"
                          : isShipped
                          ? "In Transit"
                          : "Preparing"}
                      </span>
                    </span>

                    <span className="text-sm font-bold text-[#171713]">
                      {formatINR(order.total_paise)}
                    </span>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="py-4 border-b border-[#eee8dc]">
                  <p className="text-xs font-semibold text-[#171713] mb-3">
                    {order.item_count} {order.item_count === 1 ? "Item" : "Items"}<StorefrontText id="copy_55380ead8b3617f8" fallback="in Package" />
                  </p>
                  <div className="space-y-3">
                    {order.items.length > 0 ? (
                      order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#f4f7f2] border border-[#e1e9df] flex items-center justify-center flex-none overflow-hidden">
                              <Package size={18} className="text-[#23483a]" />
                            </div>
                            <div>
                              <p className="font-bold text-[#171713]">
                                {item.productName}
                              </p>
                              <p className="text-[11px] text-[#5c6659]">
                                {item.estate} · {item.grams}<StorefrontText id="copy_7147f22849002423" fallback="g pouch · Qty:" /> {item.quantity}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-[#171713] flex-none">
                            {formatINR(item.totalPricePaise)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#5c6659]">{order.items_summary}</p>
                    )}
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <div className="text-xs text-[#5c6659]">
                    <span><StorefrontText id="copy_563a4f27ed4ccd35" fallback="Payment:" /> </span>
                    <strong className="text-[#171713] capitalize">
                      {order.payment_status}
                    </strong>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Track Button */}
                    <Link
                      href={`/track?id=${order.id}`}
                      className="px-3.5 py-2 rounded-lg border border-[#c2bcae] text-xs font-semibold text-[#171713] hover:bg-[#f5f1e8] transition-colors inline-flex items-center gap-1.5"
                    >
                      <Truck size={14} className="text-[#23483a]" />
                      <span><StorefrontText id="copy_73a75653065cfd73" fallback="Track Order" /></span>
                    </Link>

                    {/* Order Details Button */}
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="px-3.5 py-2 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>Order Details &amp; Receipt</span>
                      <ChevronRight size={14} />
                    </Link>

                    {/* Self-service Cancel Button */}
                    {order.is_cancellable && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalOrder(order);
                          setCancelError(null);
                        }}
                        className="px-3 py-2 rounded-lg border border-[#fca5a5] text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] transition-colors"
                      ><StorefrontText id="copy_205f0163b0d783b2" fallback="Cancel Order" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Modal Dialog */}
      {cancelModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#fffefa] border border-[#ded7cb] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 id="cancel-modal-title" className="text-lg font-serif font-bold text-[#171713]"><StorefrontText id="copy_a432e33b47e9eedd" fallback="Cancel Order #" />{cancelModalOrder.reference}?
            </h3>
            <p className="text-xs text-[#5c6659] mt-1.5 leading-relaxed"><StorefrontText id="copy_21a53829ac50c0d2" fallback="Are you sure you want to cancel this order? Once cancelled, the items will be returned to inventory and any pending charge will not be captured." />
            </p>

            {cancelError && (
              <div role="alert" className="my-3 p-3 rounded-lg bg-[#fef2f2] border border-[#fca5a5] text-xs text-[#991b1b]">
                {cancelError}
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="cancel-reason" className="block text-xs font-semibold text-[#171713] mb-1"><StorefrontText id="copy_8a899eb47f221a83" fallback="Reason for cancellation *" />
              </label>
              <select
                id="cancel-reason"
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
                onClick={() => setCancelModalOrder(null)}
                disabled={Boolean(cancellingId)}
                className="px-4 py-2 rounded-lg border border-[#c2bcae] text-xs font-semibold text-[#171713] hover:bg-[#f5f1e8] transition-colors"
              ><StorefrontText id="copy_83dce9e54e12b492" fallback="Keep Order" />
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={Boolean(cancellingId)}
                className="px-4 py-2 rounded-lg bg-[#b91c1c] text-white text-xs font-bold hover:bg-[#991b1b] transition-colors"
              >
                {cancellingId ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
