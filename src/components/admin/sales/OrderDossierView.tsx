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
  CheckCircle2,
  Building2,
  Landmark,
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
  wholesale?: {
    isWholesale: true;
    advancePercent: number;
    advancePaise: number;
    balancePaise: number;
    advanceMinor: number;
    balanceMinor: number;
    bankDetails: {
      beneficiary: string;
      bankName: string;
      accountNumber: string;
      ifsc: string;
      branch: string;
      upiId?: string;
    };
  };
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

  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [utrInput, setUtrInput] = useState("");
  const [confirmNotesInput, setConfirmNotesInput] = useState("");
  const [confirmingBankTransfer, setConfirmingBankTransfer] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

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

  async function handleConfirmBankTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setConfirmingBankTransfer(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/confirm-bank-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utrReference: utrInput.trim() || undefined,
          notes: confirmNotesInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm bank transfer payment");
      }
      setConfirmSuccess("Bank transfer payment confirmed! Order is now marked as Paid.");
      setShowBankTransferModal(false);
      setUtrInput("");
      setConfirmNotesInput("");
      // Reload order data
      const refreshRes = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`);
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json();
        if (refreshed.order) setOrder(refreshed.order);
        if (refreshed.events) setEvents(refreshed.events);
      }
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : "Error confirming payment");
    } finally {
      setConfirmingBankTransfer(false);
    }
  }

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
          {(order.payment_status === "pending_bank_transfer" || order.payment_status === "advance_paid") && !isCancelled && (
            <button
              type="button"
              onClick={() => {
                setConfirmError(null);
                setShowBankTransferModal(true);
              }}
              className="button button-primary"
              style={{ background: "#23483a", color: "#ffffff", borderColor: "#23483a" }}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Confirm Full A/C Transfer Received</span>
            </button>
          )}
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

      {confirmSuccess && (
        <div className="p-4 rounded-lg bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{confirmSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmSuccess(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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

          {/* Wholesale Settlement & Bank Transfer Details */}
          {(order.wholesale || order.payment_status === "pending_bank_transfer" || order.payment_status === "advance_paid") && (
            <section className="dossier-card" aria-label="Wholesale settlement details">
              <h2 className="card-heading">
                <Building2 size={18} aria-hidden="true" />
                <span>Wholesale A/C Settlement</span>
              </h2>

              <div className="info-item">
                <span className="info-label">Advance Required</span>
                <span className="info-value font-bold">
                  {order.wholesale ? `${order.wholesale.advancePercent}% (${formatRupees(order.wholesale.advancePaise)})` : "0% (Full Bank Transfer)"}
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">Advance Status</span>
                <span className={`status-pill ${order.payment_status === "advance_paid" || order.payment_status === "paid" ? "payment-paid" : "payment-unpaid"}`}>
                  {order.payment_status === "advance_paid" || order.payment_status === "paid" ? "Paid / Verified" : "Pending"}
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">Balance Due Before Dispatch</span>
                <span className="info-value font-bold" style={{ color: order.payment_status === "paid" ? "#2e7d32" : "#b36b3d" }}>
                  {order.payment_status === "paid" ? "₹0.00 (Fully Settled)" : formatRupees(order.wholesale ? order.wholesale.balancePaise : order.total_paise)}
                </span>
              </div>

              {order.wholesale?.bankDetails && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--admin-border, #d9d4c8)", fontSize: 12, lineHeight: 1.5 }}>
                  <span className="info-label" style={{ display: "block", marginBottom: 6 }}>Company Bank Account</span>
                  <div><strong>Beneficiary:</strong> {order.wholesale.bankDetails.beneficiary}</div>
                  <div><strong>Bank:</strong> {order.wholesale.bankDetails.bankName}</div>
                  <div><strong>A/C No:</strong> <span className="font-mono">{order.wholesale.bankDetails.accountNumber}</span></div>
                  <div><strong>IFSC:</strong> <span className="font-mono">{order.wholesale.bankDetails.ifsc}</span></div>
                  <div><strong>Branch:</strong> {order.wholesale.bankDetails.branch}</div>
                  {order.wholesale.bankDetails.upiId ? <div><strong>UPI ID:</strong> <span className="font-mono">{order.wholesale.bankDetails.upiId}</span></div> : null}
                </div>
              )}

              {(order.payment_status === "pending_bank_transfer" || order.payment_status === "advance_paid") && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmError(null);
                    setShowBankTransferModal(true);
                  }}
                  className="button button-primary"
                  style={{ width: "100%", marginTop: 14, justifyContent: "center", background: "#23483a", color: "#ffffff", borderColor: "#23483a" }}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Confirm Full A/C Transfer</span>
                </button>
              )}
            </section>
          )}

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

      {/* Modal: Confirm Full A/C Transfer Received */}
      {showBankTransferModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-transfer-title"
          className="modal-backdrop"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-icon">
                <Landmark size={22} />
              </div>
              <div>
                <h3 id="confirm-transfer-title" className="modal-title">
                  Confirm Full A/C Transfer Received
                </h3>
                <p className="modal-subtitle">
                  Order #{order.id} · Total: {formatRupees(order.total_paise)}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmBankTransfer} className="modal-body">
              <div className="modal-notice">
                Confirm that the remaining balance of{" "}
                <strong>
                  {formatRupees(order.wholesale ? order.wholesale.balancePaise : order.total_paise)}
                </strong>{" "}
                has been received and cleared in the company bank account via RTGS, NEFT, IMPS, or UPI.
              </div>

              {confirmError && (
                <div className="modal-error">
                  {confirmError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="utr-input">
                  Bank UTR / Transaction Reference (Optional)
                </label>
                <input
                  id="utr-input"
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. HDFC000123987 or UTR123456789"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="notes-input">
                  Internal Staff Notes (Optional)
                </label>
                <textarea
                  id="notes-input"
                  value={confirmNotesInput}
                  onChange={(e) => setConfirmNotesInput(e.target.value)}
                  placeholder="e.g. Verified with HDFC statement on 12-Nov-2026. Approved for transport bilty dispatch."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  disabled={confirmingBankTransfer}
                  onClick={() => setShowBankTransferModal(false)}
                  className="button button-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmingBankTransfer}
                  className="button button-primary"
                  style={{ background: "#23483a", color: "#ffffff", borderColor: "#23483a" }}
                >
                  {confirmingBankTransfer ? (
                    <>
                      <Clock size={14} className="spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm Payment Received</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

        .payment-pending_bank_transfer {
          background: rgba(179, 145, 86, 0.15);
          color: #7d6537;
          border: 1px solid rgba(179, 145, 86, 0.3);
        }

        .payment-advance_paid {
          background: rgba(2, 132, 199, 0.12);
          color: #0369a1;
          border: 1px solid rgba(2, 132, 199, 0.3);
        }

        .payment-cod_due {
          background: rgba(109, 40, 217, 0.12);
          color: #6d28d9;
          border: 1px solid rgba(109, 40, 217, 0.3);
        }

        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9999;
        }

        .modal-dialog {
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 12px;
          max-width: 520px;
          width: 100%;
          padding: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid #ede9df;
        }

        .modal-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .modal-title {
          font-family: Georgia, serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .modal-subtitle {
          font-size: 12px;
          color: #7b8075;
          margin: 2px 0 0;
        }

        .modal-body {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-notice {
          background: #faf8f4;
          border: 1px solid #ded7cb;
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          color: #555850;
          line-height: 1.5;
        }

        .modal-error {
          background: #fde8e8;
          border: 1px solid #f5c6cb;
          color: #c62828;
          font-size: 12px;
          padding: 10px 12px;
          border-radius: 6px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #555850;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          font-size: 13px;
          background: #ffffff;
          box-sizing: border-box;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--pine, #23483a);
          box-shadow: 0 0 0 2px rgba(35, 72, 58, 0.2);
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #ede9df;
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
