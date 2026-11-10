"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, Package, ShieldCheck, Truck, FileText } from "lucide-react";
import { QCMilestoneTimeline, type QCMilestoneData } from "@/components/private-label/orders/QCMilestoneTimeline";

interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  total_paise: number;
  deposit_paise: number;
  balance_paise: number;
  deposit_paid_at: string | null;
  full_paid_at: string | null;
  shipping_address: ShippingAddress;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  created_at: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price_paise: number;
    line_total_paise: number;
  }>;
  job: {
    id: string;
    job_number: string;
    status: string;
    target_completion_date: string | null;
    milestones: QCMilestoneData[];
  } | null;
  approved_proof?: {
    preview_render_url?: string;
    signer_name?: string;
    created_at?: string;
    version_number?: number;
  } | null;
}

export default function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/private-label/orders/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Order not found or you do not have permission to view this order.");
          } else {
            setError("Failed to load order details.");
          }
          return;
        }
        const data = await res.json();
        setOrder(data);
      } catch {
        setError("Network error while loading order details.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] py-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 text-[#65746D]">
          <RefreshCw className="w-8 h-8 animate-spin text-[#143C31] mb-3" />
          <p className="text-sm font-medium">Retrieving cleanroom order dossier...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] py-16 px-4">
        <div className="max-w-3xl mx-auto bg-white border border-[#E8E4DC] rounded-2xl p-8 text-center shadow-xs">
          <Package className="w-12 h-12 text-[#65746D] mx-auto mb-4" />
          <h1 className="text-2xl font-serif font-bold text-[#143C31] mb-2">Order Notice</h1>
          <p className="text-sm text-[#65746D] mb-6">{error || "Order not found."}</p>
          <Link
            href="/account/private-label"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors"
          >
            <ArrowLeft size={16} /> Return to Private Label Hub
          </Link>
        </div>
      </div>
    );
  }

  const formatPaise = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-[#FBF9F4] py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link
              href="/account/private-label"
              className="inline-flex items-center gap-1.5 text-xs text-[#65746D] hover:text-[#143C31] transition-colors mb-2"
            >
              <ArrowLeft size={14} /> Back to Private Label Hub
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#143C31]">
                Order {order.order_number}
              </h1>
              <span
                data-testid="order-status-badge"
                className="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider bg-[#143C31] text-white"
              >
                {order.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-[#65746D] mt-1">
              Placed on {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/private-label/orders/${order.id}/invoice`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-white border border-[#DDE4DC] text-[#143C31] hover:bg-[#F3EFE6] transition-colors shadow-2xs"
            >
              <Download size={14} /> Print Commercial Summary
            </a>
          </div>
        </div>

        {/* Dispatch & Tracking Banner if dispatched */}
        {(order.tracking_number || order.carrier) && (
          <div className="bg-[#EBF3EF] border border-[#C5D6CC] rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#143C31] text-white flex items-center justify-center shrink-0">
                <Truck size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#143C31]">
                  Shipment Dispatched via {order.carrier || "Dedicated Logistics"}
                </p>
                <p className="text-xs text-[#4A5550]">
                  Consignment Waybill: <span className="font-mono font-medium">{order.tracking_number}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 7-Stage QC Milestone Timeline */}
        {order.job && (
          <QCMilestoneTimeline
            milestones={order.job.milestones}
            jobStatus={order.job.status}
          />
        )}

        {/* Order Dossier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Order Line Items */}
          <div className="md:col-span-2 bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs">
            <h2 className="text-base font-serif font-bold text-[#143C31] mb-4 pb-2 border-b border-[#E8E4DC] flex items-center gap-2">
              <Package size={16} /> Manufactured Specifications & Quantities
            </h2>
            <div className="divide-y divide-[#E8E4DC]">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 flex justify-between items-center gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-[#143C31]">{item.description}</p>
                    <p className="text-[#65746D]">Quantity: {item.quantity.toLocaleString("en-IN")} units</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#143C31]">{formatPaise(item.line_total_paise)}</p>
                    <p className="text-[#65746D]">{formatPaise(item.unit_price_paise)} / unit</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Approved Design Proof Preview if available */}
            {order.approved_proof && (
              <div className="mt-6 pt-6 border-t border-[#E8E4DC]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#143C31] mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-700" /> Locked Approved Design Proof
                </h3>
                <div className="bg-[#F8F6F0] border border-[#E8E4DC] rounded-lg p-3 text-xs flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-[#143C31]">Version {order.approved_proof.version_number || 1} Signed</p>
                    <p className="text-[#65746D]">Approved by {order.approved_proof.signer_name || "Authorized Signer"}</p>
                  </div>
                  {order.approved_proof.preview_render_url && (
                    <a
                      href={order.approved_proof.preview_render_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#143C31] underline font-medium hover:text-[#1E5244]"
                    >
                      View Signed Dieline
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Financial & Delivery Summary */}
          <div className="space-y-6">
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-4">
              <h2 className="text-base font-serif font-bold text-[#143C31] pb-2 border-b border-[#E8E4DC] flex items-center gap-2">
                <FileText size={16} /> Financial Overview
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#65746D]">Total Contract Value</span>
                  <span className="font-semibold text-[#143C31]">{formatPaise(order.total_paise)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>50% Advance Deposit</span>
                  <span className="font-semibold">{formatPaise(order.deposit_paise)}</span>
                </div>
                <div className="flex justify-between text-[#65746D]">
                  <span>Remaining Balance Due</span>
                  <span className="font-semibold">{formatPaise(order.balance_paise)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E4DC]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#65746D]">Deposit Status</span>
                  <span className="font-semibold text-emerald-800">
                    {order.deposit_paid_at ? "Payment recorded" : "Awaiting verified payment"}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-2 text-xs">
              <h2 className="text-base font-serif font-bold text-[#143C31] pb-2 border-b border-[#E8E4DC]">
                Delivery Address
              </h2>
              {order.shipping_address?.line1 || order.shipping_address?.city ? (
                <>
                  <p className="font-medium text-[#143C31]">{order.shipping_address.name || "Client Receiving Dept"}</p>
                  {order.shipping_address.line1 && <p className="text-[#65746D]">{order.shipping_address.line1}</p>}
                  {order.shipping_address.line2 && <p className="text-[#65746D]">{order.shipping_address.line2}</p>}
                  <p className="text-[#65746D]">
                    {[
                      order.shipping_address.city,
                      order.shipping_address.state,
                      order.shipping_address.pincode || order.shipping_address.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </>
              ) : (
                <p className="text-[#65746D] italic">To be confirmed prior to consignment dispatch</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
