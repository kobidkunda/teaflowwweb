"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { formatINR } from "@/lib/money";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
} from "lucide-react";

type Found = {
  id: string;
  status: string;
  payment_status: string | null;
  dispatch_status: string | null;
  discount_paise: number | null;
  tax_paise: number | null;
  total_paise: number;
  created_at: string;
  item_count: number;
};

const DISPATCH_STEPS = ["unfulfilled", "preparing", "shipped", "delivered"] as const;

function dispatchStepIndex(status: string | null): number {
  const i = DISPATCH_STEPS.indexOf(status as (typeof DISPATCH_STEPS)[number]);
  return i < 0 ? 0 : i;
}

function TrackContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams ? searchParams.get("id") || "" : "";

  const [reference, setReference] = useState(initialId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Found | null>(null);
  const [customerOrders, setCustomerOrders] = useState<
    { id: string; reference: string; dispatch_status: string }[]
  >([]);

  // Check if customer is signed in to offer 1-click tracking
  useEffect(() => {
    let active = true;
    fetch("/api/customer/orders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.orders?.length) {
          setCustomerOrders(data.orders);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function performLookup(refId: string) {
    const clean = refId.trim().slice(0, 64);
    if (clean.length < 8) {
      setError("Enter the 8-character order reference from your confirmation.");
      return;
    }
    setBusy(true);
    setError("");
    setOrder(null);
    try {
      const res = await fetch(`/api/orders/lookup?id=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We could not find that order.");
      setOrder(data.order as Found);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }

  // Auto-run lookup if search parameter exists
  useEffect(() => {
    if (initialId && initialId.length >= 8) {
      performLookup(initialId);
    }
  }, [initialId]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    performLookup(reference);
  }

  const step = order ? dispatchStepIndex(order.dispatch_status) : 0;
  const isCancelled = order?.dispatch_status === "cancelled" || order?.status === "cancelled";
  const isDelivered = order?.dispatch_status === "delivered";

  return (
    <div className="container page-shell track-page max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <nav className="breadcrumbs mb-4 text-xs text-[#737067]" aria-label="Breadcrumb">
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <BrandLogo variant="symbol" size={16} aria-hidden={true} />
          <span> <StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" /> </span>
        </Link> / <span className="text-[#171713] font-bold" aria-current="page"> <StorefrontText id="copy_f0648b2ae372e8c4" fallback="Track order" /> </span>
      </nav>

      <p className="eyebrow text-xs font-bold uppercase tracking-wider text-[#b39156] mb-1">
        Order &amp; dispatch tracking
      </p>
      <h1 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal">
        <StorefrontText id="copy_ebee3b3b5db719a8" fallback="Where is your tea?" />
      </h1>
      <p className="page-intro text-xs sm:text-sm text-[#5c6659] mt-1.5 mb-6 leading-relaxed max-w-2xl">
        <StorefrontText
          id="copy_77b7cfad2aa9a335"
          fallback="Enter the 8-character order reference from your confirmation. Real-time Himalayan dispatch progress is shown directly from our Siliguri hub."
        />
      </p>

      {/* 1-Click Track for Logged-In Customers */}
      {customerOrders.length > 0 && !order && (
        <div className="mb-6 p-5 rounded-2xl border border-[#d6dfd3] bg-[#f4f7f2]">
          <p className="text-xs font-bold text-[#23483a] uppercase tracking-wider mb-2"><StorefrontText id="copy_e846c59fa87f2b63" fallback="Your Active Shipments" />
          </p>
          <div className="flex flex-wrap gap-2.5">
            {customerOrders.slice(0, 3).map((co) => (
              <button
                key={co.id}
                type="button"
                onClick={() => {
                  setReference(co.id);
                  performLookup(co.id);
                }}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#c4d6c4] text-xs font-semibold text-[#171713] hover:border-[#23483a] transition-all flex items-center gap-2 shadow-sm"
              >
                <Package size={14} className="text-[#23483a]" />
                <span><StorefrontText id="copy_a458d68f7f27f131" fallback="Order #" />{co.reference}</span>
                <span className="text-[10px] uppercase font-bold text-[#b39156]">
                  {co.dispatch_status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lookup Form */}
      <form className="track-form flex flex-col sm:flex-row gap-3 max-w-lg mb-6" onSubmit={handleSubmit}>
        <div className="flex-1">
          <label htmlFor="track-ref-input" className="sr-only">
            <StorefrontText id="copy_04db5ae332e5dc58" fallback="Order reference" />
          </label>
          <input
            id="track-ref-input"
            value={reference}
            onChange={(e) => setReference(e.target.value.slice(0, 64))}
            placeholder="e.g. A1B2C3D4 or full order ID"
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            required
            minLength={8}
            disabled={busy}
            className="w-full min-h-[46px] border border-[#b8b5a8] rounded-xl px-4 py-2 bg-[#fffefa] text-sm text-[#171713] outline-none focus:border-[#23483a]"
          />
        </div>
        <button
          className="px-6 py-2.5 rounded-xl bg-[#23483a] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#1a362b] transition-colors disabled:opacity-60 min-h-[46px] flex items-center justify-center gap-2"
          type="submit"
          disabled={busy || reference.trim().length < 8}
        >
          {busy ? "Looking up…" : "Track Order"}
        </button>
      </form>

      <p id="track-hint" className="text-[11px] text-[#737067] mb-8">
        <StorefrontText
          id="copy_919b306bf4b638f6"
          fallback="Orders are packed and dispatched directly from our Siliguri origin works (West Bengal, 734015)."
        />
      </p>

      {/* Error state */}
      {error && (
        <div className="p-6 rounded-2xl border border-[#fca5a5] bg-[#fff5f5] text-xs text-[#991b1b] mb-8" role="alert">
          <h2 className="text-sm font-bold text-[#991b1b] mb-1">
            <StorefrontText id="copy_dbd82708a128d335" fallback="We could not find that order." />
          </h2>
          <p>{error}</p>
        </div>
      )}

      {/* Result Card */}
      {order && (
        <div className="p-6 sm:p-8 rounded-2xl border border-[#ded7cb] bg-[#fffefa] shadow-md animate-in fade-in duration-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#eee8dc]">
            <div>
              <p className="text-xs text-[#737067] uppercase font-bold tracking-wider">
                <StorefrontText id="copy_04db5ae332e5dc58" fallback="Order reference" />
              </p>
              <h2 className="text-2xl font-serif font-bold text-[#171713] mt-0.5">
                #{order.id.slice(0, 8).toUpperCase()}
              </h2>
              <p className="text-xs text-[#5c6659] mt-0.5"><StorefrontText id="copy_7426785d230724d4" fallback="Recorded:" /> {order.created_at}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                  isDelivered
                    ? "bg-[#e8f5e9] text-[#2e7d32]"
                    : isCancelled
                    ? "bg-[#ffebee] text-[#c62828]"
                    : order.dispatch_status === "shipped"
                    ? "bg-[#fff8e1] text-[#b39156]"
                    : "bg-[#e8f0fe] text-[#1565c0]"
                }`}
              >
                {isDelivered && <CheckCircle2 size={14} />}
                {isCancelled && <XCircle size={14} />}
                {order.dispatch_status === "shipped" && <Truck size={14} />}
                {!isDelivered && !isCancelled && order.dispatch_status !== "shipped" && <Clock size={14} />}
                <span>
                  {isCancelled
                    ? "Cancelled"
                    : isDelivered
                    ? "Delivered"
                    : order.dispatch_status === "shipped"
                    ? "In Transit"
                    : "Preparing"}
                </span>
              </span>
            </div>
          </div>

          {/* Stepper Timeline */}
          {!isCancelled && (
            <div className="py-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#737067] mb-4"><StorefrontText id="copy_86ee732f1ee6ccc8" fallback="Origin Transit Milestones" />
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {DISPATCH_STEPS.map((s, idx) => {
                  const isDone = idx <= step;
                  const isCurrent = idx === step;
                  return (
                    <div key={s} className="flex flex-col text-left">
                      <div className="flex items-center gap-2 mb-2 w-full">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDone ? "bg-[#23483a] text-white" : "bg-[#eee8dc] text-[#737067]"
                          } ${isCurrent ? "ring-2 ring-[#23483a]" : ""}`}
                        >
                          {idx + 1}
                        </div>
                        {idx < DISPATCH_STEPS.length - 1 && (
                          <div className={`hidden sm:block flex-1 h-0.5 ${idx < step ? "bg-[#23483a]" : "bg-[#eee8dc]"}`} />
                        )}
                      </div>
                      <span className={`text-xs font-bold capitalize ${isDone ? "text-[#171713]" : "text-[#737067]"}`}>
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Details breakdown */}
          <div className="p-4 rounded-xl bg-[#fbf9f4] border border-[#eee8dc] space-y-2 text-xs text-[#5c6659]">
            <div className="flex justify-between">
              <span><StorefrontText id="copy_bc3604d0aa63b2a4" fallback="Items in package:" /></span>
              <strong className="text-[#171713]">{order.item_count}<StorefrontText id="copy_5f3c4f8580d392e4" fallback="items" /></strong>
            </div>
            {order.discount_paise ? (
              <div className="flex justify-between text-[#15803d]">
                <span><StorefrontText id="copy_48e8af3eb66604c3" fallback="Offer savings:" /></span>
                <span className="font-semibold">−{formatINR(order.discount_paise)}</span>
              </div>
            ) : null}
            {order.tax_paise ? (
              <div className="flex justify-between text-[#737067] text-[11px]">
                <span><StorefrontText id="copy_4c330e16dd031f48" fallback="Includes 5% GST:" /></span>
                <span>{formatINR(order.tax_paise)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm font-bold text-[#171713] pt-2 border-t border-[#eee8dc]">
              <span><StorefrontText id="copy_b9d2f60f0b4d3140" fallback="Total Value:" /></span>
              <span className="text-[#23483a]">{formatINR(order.total_paise)}</span>
            </div>
          </div>

          {/* Footer Link */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/account/orders/${order.id}`}
              className="px-4 py-2 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors inline-flex items-center gap-1.5"
            >
              <span><StorefrontText id="copy_6b8522f4efe0d0b9" fallback="Full Order Dossier in Account" /></span>
              <ChevronRight size={14} />
            </Link>

            <Link href={`/order/${order.id}`} className="text-xs font-semibold text-[#23483a] hover:underline">
              <StorefrontText id="copy_3c73ec435a3d641c" fallback="Public confirmation view ↗" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="container page-shell py-12 text-center text-xs text-[#5c6659]"><StorefrontText id="copy_2486dbd63b91815e" fallback="Loading tracker…" /></div>}>
      <TrackContent />
    </Suspense>
  );
}
