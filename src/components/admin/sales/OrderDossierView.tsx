"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  XCircle,
  Clock,
  User,
  MapPin,
  CreditCard,
  FileText,
  History,
  AlertTriangle,
} from "lucide-react";
import { ShiprocketDispatchCard } from "./ShiprocketDispatchCard";

export type OrderDetailProps = {
  orderId: string;
};

export type FullOrder = {
  id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  subtotal_paise: number;
  shipping_paise: number;
  discount_paise: number;
  total_paise: number;
  coupon_code: string | null;
  status: string;
  payment_status: string;
  dispatch_status: string;
  created_at: string;
  admin_notes?: string;
  idempotency_key?: string;
  items: Array<{
    variant_id: number;
    quantity: number;
    unit_price_paise: number;
    sku?: string;
  }>;
  events?: Array<{
    id: number;
    order_id: string;
    from_status: string;
    to_status: string;
    actor: string;
    created_at: string;
  }>;
};

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderDossierView({ orderId }: OrderDetailProps) {
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [events, setEvents] = useState<FullOrder["events"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Order not found");
          throw new Error("Failed to load order details");
        }
        const data = await res.json();
        if (mounted) {
          setOrder(data.order);
          setEvents(data.events || data.order?.events || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error loading order");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadOrder();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="dossier-state" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading order dossier #{orderId}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="dossier-error">
        <AlertTriangle size={32} className="text-amber" aria-hidden="true" />
        <h2>Order Not Found</h2>
        <p>{error || `Order with reference "${orderId}" could not be located.`}</p>
        <Link href="/admin/orders" className="button button-outline">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Orders List</span>
        </Link>
      </div>
    );
  }

  const isCancelled = order.dispatch_status === "cancelled";

  return (
    <div className="order-dossier-root">
      {/* Navigation & Header */}
      <div className="dossier-header-bar">
        <div>
          <Link href="/admin/orders" className="back-link">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Orders</span>
          </Link>
          <div className="title-row">
            <h1 className="order-dossier-title">Order #{order.id}</h1>
            <span className={`status-pill payment-${order.payment_status}`}>
              {order.payment_status}
            </span>
            <span className={`status-pill dispatch-${order.dispatch_status}`}>
              {order.dispatch_status}
            </span>
          </div>
          <p className="order-date-line">
            Placed on{" "}
            {new Date(order.created_at).toLocaleString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Action Controls */}
        <div className="dossier-actions">
          {!isCancelled && (
            <Link href={`/admin/orders/${order.id}/edit`} className="button button-primary">
              <Truck size={16} aria-hidden="true" />
              <span>Update Fulfillment & Notes</span>
            </Link>
          )}
          {!isCancelled && (
            <Link href={`/admin/orders/${order.id}/cancel`} className="button button-outline text-danger">
              <XCircle size={16} aria-hidden="true" />
              <span>Cancel Order</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid: Details & Line Items */}
      <div className="dossier-grid">
        {/* Left Column: Line Items & Totals */}
        <div className="grid-main-col">
          {/* Line Items Card */}
          <section className="dossier-card" aria-label="Order line items">
            <h2 className="card-heading">Purchased Line Items</h2>
            <div className="line-items-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Variant SKU</th>
                    <th scope="col" style={{ textAlign: "right" }}>Quantity</th>
                    <th scope="col" style={{ textAlign: "right" }}>Unit Price</th>
                    <th scope="col" style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-mono">{item.sku || `Variant #${item.variant_id}`}</td>
                        <td style={{ textAlign: "right" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>{formatRupees(item.unit_price_paise)}</td>
                        <td style={{ textAlign: "right" }} className="font-bold">
                          {formatRupees(item.quantity * item.unit_price_paise)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-muted" style={{ textAlign: "center" }}>
                        No specific item records attached to this demo order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financials Breakout */}
            <div className="financials-breakdown">
              <div className="fin-row">
                <span>Subtotal</span>
                <span>{formatRupees(order.subtotal_paise)}</span>
              </div>
              <div className="fin-row">
                <span>Shipping Fee</span>
                <span>{order.shipping_paise > 0 ? formatRupees(order.shipping_paise) : "Free (₹0.00)"}</span>
              </div>
              {order.discount_paise > 0 && (
                <div className="fin-row text-pine">
                  <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                  <span>- {formatRupees(order.discount_paise)}</span>
                </div>
              )}
              <div className="fin-row total-row">
                <span>Grand Total</span>
                <span className="total-amount">{formatRupees(order.total_paise)}</span>
              </div>
            </div>
          </section>

          {/* Audit Event Timeline */}
          <section className="dossier-card" aria-label="Fulfillment timeline">
            <div className="card-header-flex">
              <h2 className="card-heading">
                <History size={18} aria-hidden="true" />
                <span>Audit Event Timeline</span>
              </h2>
            </div>
            {events && events.length > 0 ? (
              <ol className="audit-timeline">
                {events.map((ev) => (
                  <li key={ev.id} className="timeline-item">
                    <div className="timeline-marker" />
                    <div className="timeline-content">
                      <div className="timeline-transition">
                        <span className="from-badge">{ev.from_status}</span>
                        <span className="arrow-sep">→</span>
                        <span className="to-badge">{ev.to_status}</span>
                      </div>
                      <div className="timeline-meta">
                        <span>Actor: {ev.actor}</span>
                        <span>·</span>
                        <span>
                          {new Date(ev.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="no-events-text">
                No status transitions recorded yet. Initial order creation was captured at{" "}
                {new Date(order.created_at).toLocaleDateString("en-IN")}.
              </p>
            )}
          </section>
        </div>

        {/* Right Column: Customer & Details */}
        <div className="grid-side-col">
          {/* Customer Dossier */}
          <section className="dossier-card" aria-label="Customer profile">
            <h2 className="card-heading">
              <User size={18} aria-hidden="true" />
              <span>Customer Information</span>
            </h2>
            <div className="info-item">
              <span className="info-label">Full Name</span>
              <span className="info-value font-bold">{order.customer_name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email Address</span>
              <a href={`mailto:${order.customer_email}`} className="info-value text-link">
                {order.customer_email}
              </a>
            </div>
          </section>

          {/* Shipping Address */}
          <section className="dossier-card" aria-label="Delivery destination">
            <h2 className="card-heading">
              <MapPin size={18} aria-hidden="true" />
              <span>Delivery Address</span>
            </h2>
            <p className="address-display">
              {order.shipping_address || "No shipping address on file."}
            </p>
          </section>

          {/* Payment Transaction Reference */}
          <section className="dossier-card" aria-label="Payment transaction details">
            <h2 className="card-heading">
              <CreditCard size={18} aria-hidden="true" />
              <span>Payment Details</span>
            </h2>
            <div className="info-item">
              <span className="info-label">Payment Status</span>
              <span className={`status-pill payment-${order.payment_status}`}>
                {order.payment_status}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Idempotency Reference</span>
              <span className="info-value font-mono font-xs">
                {order.idempotency_key || "Direct capture / demo"}
              </span>
            </div>
          </section>

          {/* Shiprocket Carrier Fulfillment & Label */}
          <ShiprocketDispatchCard
            orderId={order.id}
            paymentStatus={order.payment_status}
            dispatchStatus={order.dispatch_status}
            onStatusUpdated={() => {
              // Reload order data
              fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.order) setOrder(d.order);
                  if (d.events) setEvents(d.events);
                })
                .catch(() => {});
            }}
          />

          {/* Admin Notes */}
          <section className="dossier-card" aria-label="Internal staff notes">
            <div className="card-header-flex">
              <h2 className="card-heading">
                <FileText size={18} aria-hidden="true" />
                <span>Admin Notes</span>
              </h2>
              <Link href={`/admin/orders/${order.id}/edit`} className="edit-notes-link">
                Edit
              </Link>
            </div>
            {order.admin_notes ? (
              <p className="admin-notes-content">{order.admin_notes}</p>
            ) : (
              <p className="no-notes-content">No internal staff notes recorded.</p>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .order-dossier-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--pine, #23483a);
          margin-bottom: 8px;
          text-decoration: none;
        }

        .dossier-header-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .order-dossier-title {
          font-size: clamp(24px, 3vw, 32px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .order-date-line {
          font-size: 13px;
          color: #6a6e64;
          margin-top: 4px;
        }

        .dossier-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .dossier-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .grid-main-col,
        .grid-side-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .dossier-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 20px;
        }

        .card-heading {
          font-size: 15px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin: 0 0 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-header-flex {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .card-header-flex .card-heading {
          margin: 0;
        }

        .edit-notes-link {
          font-size: 12px;
          font-weight: 600;
          color: var(--pine, #23483a);
          text-decoration: underline;
        }

        .line-items-table-wrap {
          overflow-x: auto;
          margin-bottom: 20px;
        }

        .financials-breakdown {
          border-top: 1px solid #ede9df;
          padding-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fin-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #555850;
        }

        .total-row {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 2px solid var(--admin-border, #d9d4c8);
          font-size: 16px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
        }

        .total-amount {
          font-size: 20px;
          color: var(--pine, #23483a);
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 12px;
        }

        .info-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #7b8075;
        }

        .info-value {
          font-size: 13px;
          color: var(--forest, #1d2a24);
        }

        .font-xs {
          font-size: 11px;
          word-break: break-all;
        }

        .address-display {
          font-size: 13px;
          line-height: 1.6;
          color: var(--forest, #1d2a24);
          white-space: pre-wrap;
          background: #ede9df;
          padding: 12px;
          border-radius: 6px;
          margin: 0;
        }

        .admin-notes-content {
          font-size: 13px;
          line-height: 1.6;
          color: var(--forest, #1d2a24);
          background: rgba(179, 145, 86, 0.12);
          border-left: 3px solid #b39156;
          padding: 12px;
          border-radius: 4px;
          margin: 0;
        }

        .no-notes-content,
        .no-events-text {
          font-size: 13px;
          color: #7b8075;
          margin: 0;
        }

        .audit-timeline {
          list-style: none;
          margin: 0;
          padding: 0 0 0 16px;
          border-left: 2px solid #d9d4c8;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-item {
          position: relative;
        }

        .timeline-marker {
          position: absolute;
          left: -22px;
          top: 4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--pine, #23483a);
          border: 2px solid #ffffff;
        }

        .timeline-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .timeline-transition {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .from-badge {
          background: #ede9df;
          padding: 2px 6px;
          border-radius: 4px;
          color: #555850;
        }

        .to-badge {
          background: rgba(35, 72, 58, 0.15);
          color: var(--pine, #23483a);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .arrow-sep {
          color: #8c9b88;
        }

        .timeline-meta {
          font-size: 11px;
          color: #7b8075;
          display: flex;
          gap: 6px;
        }

        .status-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .payment-paid {
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
        }

        .payment-unpaid {
          background: rgba(179, 107, 61, 0.12);
          color: var(--amber, #b36b3d);
          border: 1px solid rgba(179, 107, 61, 0.3);
        }

        .dispatch-unfulfilled {
          background: #ede9df;
          color: #555850;
          border: 1px solid #d9d4c8;
        }

        .dispatch-preparing {
          background: rgba(179, 145, 86, 0.15);
          color: #7d6537;
          border: 1px solid rgba(179, 145, 86, 0.3);
        }

        .dispatch-shipped {
          background: rgba(35, 72, 58, 0.15);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
        }

        .dispatch-delivered {
          background: rgba(35, 72, 58, 0.2);
          color: #17382c;
          border: 1px solid #23483a;
        }

        .dispatch-cancelled {
          background: rgba(143, 47, 42, 0.12);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.3);
        }

        .dossier-state,
        .dossier-error {
          text-align: center;
          padding: 64px 20px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
        }

        .dossier-error h2 {
          font-family: Georgia, serif;
          margin: 12px 0 8px;
        }

        .dossier-error p {
          color: #6a6e64;
          margin-bottom: 20px;
        }

        @media (max-width: 900px) {
          .dossier-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
