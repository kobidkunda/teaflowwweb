"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  MapPin,
  Sparkles,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Compass,
  Headphones,
} from "lucide-react";
import type { SafeCustomer } from "@/lib/customerSessions";
import type { CustomerOrderSummary } from "@/lib/customerOrders";
import { formatINR } from "@/lib/money";

export default function AccountPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<SafeCustomer | null>(null);
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [addressCount, setAddressCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAccountData() {
      try {
        const meRes = await fetch("/api/customer/me");
        if (!meRes.ok) {
          router.push("/login?redirect=/account");
          return;
        }
        const meData = await meRes.json();
        if (active) setCustomer(meData.customer);

        const [ordersRes, addrRes] = await Promise.all([
          fetch("/api/customer/orders"),
          fetch("/api/customer/addresses"),
        ]);

        if (active && ordersRes.ok) {
          const ordData = await ordersRes.json();
          setOrders(ordData.orders || []);
        }

        if (active && addrRes.ok) {
          const addrData = await addrRes.json();
          setAddressCount((addrData.addresses || []).length);
        }
      } catch {
        if (active) router.push("/login?redirect=/account");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccountData();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    try {
      await fetch("/api/customer/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      window.location.href = "/";
    }
  }

  if (loading) {
    return (
      <div className="container page-shell py-16 text-center">
        <p className="text-xs text-[#5c6659]"><StorefrontText id="copy_b026341871d3829a" fallback="Loading your TeaFloww account…" /></p>
      </div>
    );
  }

  if (!customer) return null;

  const activeOrders = orders.filter(
    (o) =>
      o.dispatch_status !== "delivered" &&
      o.dispatch_status !== "cancelled" &&
      o.status !== "cancelled"
  );
  const recentOrder = orders[0];

  return (
    <div className="container page-shell py-10 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#f4f7f2] border border-[#d6dfd3] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b39156] mb-1">
              <Sparkles size={14} />
              <span><StorefrontText id="copy_93913793b5b887a9" fallback="TeaFloww Connoisseur" /></span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal"><StorefrontText id="copy_e203b8137479f101" fallback="Namaste," /> {customer.name || customer.email.split("@")[0]}
            </h1>
            <p className="text-xs sm:text-sm text-[#46524a] mt-1"><StorefrontText id="copy_23cc97b03f581741" fallback="Account:" /> {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#c2bcae] bg-white text-xs font-semibold text-[#8b2323] hover:bg-[#fee2e2] transition-colors self-start sm:self-center"
          >
            <LogOut size={14} />
            <span><StorefrontText id="copy_0b184bc5d5341998" fallback="Sign Out" /></span>
          </button>
        </div>

        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#d8e2d5]">
          <div className="p-4 rounded-xl bg-white border border-[#e1ded6] shadow-sm">
            <span className="text-[11px] font-bold text-[#737067] uppercase tracking-wider"><StorefrontText id="copy_8075b35a285e300a" fallback="Total Orders" />
            </span>
            <p className="text-2xl font-serif font-bold text-[#171713] mt-1">
              {orders.length}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#e1ded6] shadow-sm">
            <span className="text-[11px] font-bold text-[#737067] uppercase tracking-wider"><StorefrontText id="copy_99231d2a198821b4" fallback="Active Shipments" />
            </span>
            <p className="text-2xl font-serif font-bold text-[#23483a] mt-1">
              {activeOrders.length}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#e1ded6] shadow-sm">
            <span className="text-[11px] font-bold text-[#737067] uppercase tracking-wider"><StorefrontText id="copy_919b4b003f2a4701" fallback="Saved Addresses" />
            </span>
            <p className="text-2xl font-serif font-bold text-[#171713] mt-1">
              {addressCount}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Order Snapshot (if available) */}
      {recentOrder && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-serif font-bold text-[#171713]"><StorefrontText id="copy_228319b8aaf8b755" fallback="Most Recent Order" />
            </h2>
            <Link
              href="/account/orders"
              className="text-xs font-semibold text-[#23483a] hover:underline flex items-center gap-1"
            ><StorefrontText id="copy_30a64216eaeac5d3" fallback="View all" /> {orders.length}<StorefrontText id="copy_1c168adb00d208e4" fallback="orders" /> <ChevronRight size={14} />
            </Link>
          </div>

          <div className="p-5 rounded-xl border border-[#d8d2c4] bg-[#fffefa] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#eee8dc]">
              <div>
                <span className="text-xs font-bold text-[#171713]"><StorefrontText id="copy_a458d68f7f27f131" fallback="Order #" />{recentOrder.reference}
                </span>
                <p className="text-xs text-[#5c6659] mt-0.5"><StorefrontText id="copy_bef9707be900fb31" fallback="Placed on" /> {new Date(recentOrder.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                    recentOrder.dispatch_status === "delivered"
                      ? "bg-[#e8f5e9] text-[#2e7d32]"
                      : recentOrder.dispatch_status === "cancelled"
                      ? "bg-[#ffebee] text-[#c62828]"
                      : "bg-[#e8f0fe] text-[#1565c0]"
                  }`}
                >
                  {recentOrder.dispatch_status === "shipped"
                    ? "In Transit"
                    : recentOrder.dispatch_status}
                </span>
                <span className="text-sm font-bold text-[#171713]">
                  {formatINR(recentOrder.total_paise)}
                </span>
              </div>
            </div>

            <div className="py-3 text-xs text-[#46524a]">
              <p className="truncate font-medium">{recentOrder.items_summary}</p>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#eee8dc]">
              <Link
                href={`/account/orders/${recentOrder.id}`}
                className="px-4 py-2 rounded-lg bg-[#23483a] text-white text-xs font-bold hover:bg-[#1a362b] transition-colors"
              >
                Order Dossier &amp; Receipt
              </Link>
              <Link
                href={`/track?id=${recentOrder.id}`}
                className="px-4 py-2 rounded-lg border border-[#c2bcae] text-[#171713] text-xs font-semibold hover:bg-[#f5f1e8] transition-colors"
              ><StorefrontText id="copy_58a16085d0d3b3ad" fallback="Track Live Shipment" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <Link href="/account/subscriptions" className="button button-outline mb-6">My subscriptions · schedule, pay &amp; skip →</Link>
      {/* Core Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Orders Card */}
        <Link
          href="/account/orders"
          className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] hover:border-[#b39156] transition-all group shadow-sm flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
            <Package size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#171713] group-hover:text-[#23483a] transition-colors"><StorefrontText id="copy_00db793f2b8cff97" fallback="My Orders" />
              </h3>
              <ChevronRight size={18} className="text-[#a8a499] group-hover:text-[#23483a] transition-colors" />
            </div>
            <p className="text-xs text-[#5c6659] mt-1"><StorefrontText id="copy_f8e8f1b211dcbe3c" fallback="Review full itemizations, GST tax invoices, courier tracking status, and self-service order cancellations." />
            </p>
          </div>
        </Link>

        {/* Private Label Studio Card */}
        <Link
          href="/account/private-label"
          className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] hover:border-[#23483a] transition-all group shadow-sm flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
            <Sparkles size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#171713] group-hover:text-[#23483a] transition-colors"><StorefrontText id="copy_fa75dc95001ee8a5" fallback="Private Label Studio" />
              </h3>
              <ChevronRight size={18} className="text-[#a8a499] group-hover:text-[#23483a] transition-colors" />
            </div>
            <p className="text-xs text-[#5c6659] mt-1"><StorefrontText id="copy_0914ba6a4adfd806" fallback="Custom branded packaging runs, trial sample kits, 7-stage QC tracking, and B2B contracts." />
            </p>
          </div>
        </Link>

        {/* Saved Addresses Card */}
        <Link
          href="/account/addresses"
          className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] hover:border-[#b39156] transition-all group shadow-sm flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
            <MapPin size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#171713] group-hover:text-[#23483a] transition-colors"><StorefrontText id="copy_919b4b003f2a4701" fallback="Saved Addresses" />
              </h3>
              <ChevronRight size={18} className="text-[#a8a499] group-hover:text-[#23483a] transition-colors" />
            </div>
            <p className="text-xs text-[#5c6659] mt-1"><StorefrontText id="copy_ab638c20b60c1d47" fallback="Add, edit, and organize multiple delivery destinations across India with 1-click checkout autofill." />
            </p>
          </div>
        </Link>

        {/* Sourcing & Tea Discovery Card */}
        <Link
          href="/shop"
          className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] hover:border-[#b39156] transition-all group shadow-sm flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
            <Compass size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#171713] group-hover:text-[#23483a] transition-colors"><StorefrontText id="copy_d1228f86134924cb" fallback="Single-Estate Catalog" />
              </h3>
              <ChevronRight size={18} className="text-[#a8a499] group-hover:text-[#23483a] transition-colors" />
            </div>
            <p className="text-xs text-[#5c6659] mt-1"><StorefrontText id="copy_06301060b14a8114" fallback="Explore freshly harvested orthodox flushes from Darjeeling, Dooars, and Assam directly from Siliguri." />
            </p>
          </div>
        </Link>

        {/* Concierge & Support Card */}
        <Link
          href="/contact"
          className="p-6 rounded-2xl border border-[#ded7cb] bg-[#fffefa] hover:border-[#b39156] transition-all group shadow-sm flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f4f7f2] border border-[#dce5da] text-[#23483a] flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
            <Headphones size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#171713] group-hover:text-[#23483a] transition-colors"><StorefrontText id="copy_077f33d29dc4297f" fallback="Customer Care Concierge" />
              </h3>
              <ChevronRight size={18} className="text-[#a8a499] group-hover:text-[#23483a] transition-colors" />
            </div>
            <p className="text-xs text-[#5c6659] mt-1"><StorefrontText id="copy_37a9fcf2bacf2cf9" fallback="Reach our licensed tasters and customer care in Siliguri for brewing advice or delivery inquiries." />
            </p>
          </div>
        </Link>
      </div>

      {/* Sourcing Guarantee Footer */}
      <div className="p-4 rounded-xl border border-[#e2dcd0] bg-[#faf8f4] text-center text-xs text-[#5c6659] flex items-center justify-center gap-2">
        <ShieldCheck size={16} className="text-[#23483a]" />
        <span>Nirva Works &amp; Cupping Facility: Siliguri, West Bengal · GSTIN 19CTHPK8646J2ZY</span>
      </div>
    </div>
  );
}
