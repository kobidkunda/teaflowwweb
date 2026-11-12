"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  MapPin,
  FileText,
  CreditCard,
  Truck,
  Eye,
} from "lucide-react";
import type { FullOrder } from "./OrderDossierView";

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderModifyForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
        if (!res.ok) throw new Error("Order not found");
        const data = await res.json();
        if (mounted && data.order) {
          const ord = data.order;
          setOrder(ord);
          setCustomerName(ord.customer_name || "");
          setCustomerEmail(ord.customer_email || "");
          setCustomerPhone(ord.customer_phone || "");
          setShippingAddress(ord.shipping_address || "");
          setAdminNotes(ord.admin_notes || "");
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load order details");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Basic client validation
    if (!customerName.trim()) {
      setError("Customer name is required.");
      setSaving(false);
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      setError("A valid customer email address is required.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          customer_phone: customerPhone.trim() || null,
          shipping_address: shippingAddress.trim(),
          admin_notes: adminNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update order details");
      }

      setOrder(data.order);
      setSuccess("Order modified successfully! Changes have been saved to the audit log.");
      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="state-card" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading order modification form #{orderId}...</span>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="state-card error">
        <AlertCircle size={32} className="text-amber" aria-hidden="true" />
        <h2>Order Not Found</h2>
        <p>{error}</p>
        <Link href="/admin/orders" className="button button-outline">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Orders List</span>
        </Link>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="modify-order-root">
      {/* Header bar */}
      <div className="modify-header">
        <div>
          <Link href={`/admin/orders/${order.id}`} className="back-link">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Order #{order.id} Dossier</span>
          </Link>
          <h1 className="modify-title">Modify Order #{order.id}</h1>
          <p className="modify-subtitle">
            Update customer contact, delivery address, and internal staff instructions.
          </p>
        </div>

        <div className="modify-actions">
          <Link href={`/admin/orders/${order.id}`} className="button button-outline">
            <Eye size={15} aria-hidden="true" />
            <span>View Dossier</span>
          </Link>
          <Link href={`/admin/orders/${order.id}/dispatch`} className="button button-outline">
            <Truck size={15} aria-hidden="true" />
            <span>Dispatch Center</span>
          </Link>
        </div>
      </div>

      {success && (
        <div className="alert-box success-alert" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="alert-box error-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="modify-grid">
        {/* Left Form: Editable Details */}
        <div className="modify-main-col">
          {/* Customer Information Card */}
          <section className="modify-card">
            <h2 className="card-heading">
              <User size={18} aria-hidden="true" />
              <span>Customer Contact Details</span>
            </h2>

            <div className="form-group">
              <label htmlFor="customer-name-input" className="form-label">
                Full Name <span className="req">*</span>
              </label>
              <input
                id="customer-name-input"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="form-input"
                placeholder="e.g. Ramesh Chandra"
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer-email-input" className="form-label">
                Email Address <span className="req">*</span>
              </label>
              <input
                id="customer-email-input"
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="form-input"
                placeholder="customer@example.com"
              />
              <span className="field-hint">
                Transactional confirmations and shipment tracking alerts will be delivered here.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="customer-phone-input" className="form-label">
                Phone Number (for Courier &amp; SMS)
              </label>
              <input
                id="customer-phone-input"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="form-input font-mono"
                placeholder="+91 9876543210"
              />
            </div>
          </section>

          {/* Shipping Address Card */}
          <section className="modify-card">
            <h2 className="card-heading">
              <MapPin size={18} aria-hidden="true" />
              <span>Shipping &amp; Delivery Destination</span>
            </h2>

            <div className="form-group">
              <label htmlFor="shipping-address-input" className="form-label">
                Full Street Address, Landmark &amp; Postal PIN Code
              </label>
              <textarea
                id="shipping-address-input"
                rows={4}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="form-textarea"
                placeholder="House / Flat No, Street, Landmark, City, State, PIN Code"
              />
              <span className="field-hint">
                Address changes are synchronized with the shipment dispatch manifest.
              </span>
            </div>
          </section>

          {/* Internal Admin Notes */}
          <section className="modify-card">
            <h2 className="card-heading">
              <FileText size={18} aria-hidden="true" />
              <span>Internal Admin Notes</span>
            </h2>

            <div className="form-group">
              <label htmlFor="admin-notes-input" className="form-label">
                Staff Notes &amp; Packaging Instructions
              </label>
              <textarea
                id="admin-notes-input"
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="form-textarea"
                placeholder="e.g. Include wooden tea scoop sample; verified payment with accounts team."
              />
              <span className="field-hint">
                These notes are private to administrative staff and never visible to the customer.
              </span>
            </div>
          </section>

          <div className="form-actions-bar">
            <button
              type="submit"
              disabled={saving}
              className="button button-primary save-btn"
            >
              {saving ? (
                <>
                  <Clock size={16} className="spin" aria-hidden="true" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden="true" />
                  <span>Save Order Modifications</span>
                </>
              )}
            </button>
            <Link href={`/admin/orders/${order.id}`} className="button button-outline">
              Cancel
            </Link>
          </div>
        </div>

        {/* Right Sidebar: Order Summary Card */}
        <div className="modify-side-col">
          <section className="modify-card">
            <h2 className="card-heading">
              <CreditCard size={18} aria-hidden="true" />
              <span>Order Summary</span>
            </h2>

            <div className="summary-item">
              <span className="summary-label">Order Total</span>
              <span className="summary-value font-bold">{formatRupees(order.total_paise)}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Payment Status</span>
              <span className={`status-pill payment-${order.payment_status}`}>
                {order.payment_status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Dispatch Status</span>
              <span className={`status-pill dispatch-${order.dispatch_status}`}>
                {order.dispatch_status}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Order Date</span>
              <span className="summary-value">
                {new Date(order.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Total Items</span>
              <span className="summary-value">
                {order.items ? order.items.reduce((s, i) => s + i.quantity, 0) : 0} items
              </span>
            </div>
          </section>
        </div>
      </form>

      <style jsx>{`
        .modify-order-root {
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

        .modify-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .modify-title {
          font-size: clamp(24px, 3vw, 32px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .modify-subtitle {
          font-size: 13px;
          color: #6a6e64;
          margin: 4px 0 0;
        }

        .modify-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .alert-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 13px;
        }

        .success-alert {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #a5d6a7;
        }

        .error-alert {
          background: #fdf2f2;
          color: #8f2f2a;
          border: 1px solid #f8b4b4;
        }

        .modify-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          align-items: start;
        }

        .modify-main-col,
        .modify-side-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .modify-card {
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

        .form-group {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: #485347;
        }

        .req {
          color: #b36b3d;
        }

        .field-hint {
          font-size: 11px;
          color: #7b8075;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 9px 12px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
          box-sizing: border-box;
          color: var(--forest, #1d2a24);
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: 2px solid var(--pine, #23483a);
          outline-offset: 1px;
        }

        .form-actions-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 10px;
        }

        .save-btn {
          background: var(--pine, #23483a);
          color: #ffffff;
          border: 1px solid var(--pine, #23483a);
          padding: 10px 20px;
          font-size: 14px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #ede9df;
          font-size: 13px;
        }

        .summary-label {
          color: #6a6e64;
        }

        .summary-value {
          color: var(--forest, #1d2a24);
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

        .state-card {
          padding: 48px;
          text-align: center;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        @media (max-width: 800px) {
          .modify-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
