"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  AlertTriangle,
  Clock,
  Save,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import type { FullOrder } from "./OrderDossierView";

export function OrderFulfillmentForm({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fulfillment transition state
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Admin notes state
  const [notes, setNotes] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
        if (!res.ok) throw new Error("Order not found");
        const data = await res.json();
        if (mounted) {
          setOrder(data.order);
          setNotes(data.order.admin_notes || "");
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load order");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="state-card" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading fulfillment controls for order #{orderId}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="state-card error">
        <AlertTriangle size={32} className="text-amber" aria-hidden="true" />
        <h2>Order Not Found</h2>
        <p>{error || "Unable to locate order."}</p>
        <Link href="/admin/orders" className="button button-outline">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Orders List</span>
        </Link>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";
  const currentDispatch = order.dispatch_status;

  // Determine allowed next transitions based on state machine
  const allowedNext: string[] = [];
  if (currentDispatch === "unfulfilled") {
    allowedNext.push("preparing");
  } else if (currentDispatch === "preparing") {
    allowedNext.push("shipped");
  } else if (currentDispatch === "shipped") {
    allowedNext.push("delivered");
  }

  // Handle status transition
  async function handleApplyTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStatus) return;

    // Client-side guard check before submitting
    if ((targetStatus === "shipped" || targetStatus === "delivered") && !isPaid) {
      setTransitionError("Dispatch beyond preparing requires a paid order. Paid status required.");
      return;
    }

    setTransitioning(true);
    setTransitionError(null);
    setTransitionMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update dispatch status");
      }

      setOrder(data.order);
      setTransitionMessage(`Order successfully transitioned to "${data.order.dispatch_status}".`);
      setTargetStatus("");
    } catch (err: unknown) {
      setTransitionError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  // Handle notes save
  async function handleSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotes(true);
    setNotesError(null);
    setNotesMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: notes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save admin notes");
      }

      setOrder(data.order);
      setNotesMessage("Admin notes saved successfully.");
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : "Error saving notes");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="fulfillment-page-root">
      {/* Header */}
      <div>
        <Link href={`/admin/orders/${order.id}`} className="back-link">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Order Dossier</span>
        </Link>
        <div className="title-row">
          <h1 className="fulfillment-page-title">Fulfillment & Status — #{order.id}</h1>
          <span className={`status-pill payment-${order.payment_status}`}>
            {order.payment_status}
          </span>
          <span className={`status-pill dispatch-${order.dispatch_status}`}>
            {order.dispatch_status}
          </span>
        </div>
        <p className="customer-info-line">
          Customer: <strong>{order.customer_name}</strong> ({order.customer_email})
        </p>
      </div>

      <div className="fulfillment-grid">
        {/* State Machine Transition Section */}
        <section className="form-card" aria-label="Dispatch state machine controls">
          <h2 className="card-title">
            <Truck size={18} aria-hidden="true" />
            <span>Fulfillment State Machine</span>
          </h2>
          <p className="card-desc">
            Enforced sequential dispatch workflow:{" "}
            <code>unfulfilled → preparing → shipped → delivered</code>.
          </p>

          {/* Payment Warning Guard if unpaid */}
          {!isPaid && (
            <div className="payment-guard-alert" role="alert">
              <ShieldAlert size={20} className="guard-icon" aria-hidden="true" />
              <div>
                <strong>Payment Guard Active (Unpaid Order):</strong>
                <p>
                  Orders cannot be marked as <code>shipped</code> or <code>delivered</code> until
                  payment status is confirmed as <strong>paid</strong>. You may advance this order to{" "}
                  <code>preparing</code>, but shipping requires payment capture confirmation.
                </p>
              </div>
            </div>
          )}

          {/* Stepper Visualization */}
          <div className="stepper-visual" aria-label="Fulfillment stages">
            {["unfulfilled", "preparing", "shipped", "delivered"].map((step, idx) => {
              const stages = ["unfulfilled", "preparing", "shipped", "delivered"];
              const currentIdx = stages.indexOf(currentDispatch);
              const isPast = currentIdx >= idx;
              const isCurrent = currentDispatch === step;
              return (
                <div key={step} className={`step-item ${isPast ? "done" : ""} ${isCurrent ? "active" : ""}`}>
                  <div className="step-circle">{idx + 1}</div>
                  <span className="step-label">{step}</span>
                </div>
              );
            })}
          </div>

          {allowedNext.length > 0 ? (
            <form onSubmit={handleApplyTransition} className="transition-form">
              <label htmlFor="target-status-select" className="field-label">
                Advance Dispatch Status to:
              </label>
              <div className="transition-controls-row">
                <select
                  id="target-status-select"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="status-select"
                  required
                >
                  <option value="">Select next transition...</option>
                  {allowedNext.map((st) => {
                    const requiresPaid = (st === "shipped" || st === "delivered") && !isPaid;
                    return (
                      <option key={st} value={st} disabled={requiresPaid}>
                        {st.toUpperCase()} {requiresPaid ? "(Blocked: Unpaid Order)" : ""}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="submit"
                  disabled={!targetStatus || transitioning}
                  className="button button-primary"
                >
                  <Truck size={16} aria-hidden="true" />
                  <span>{transitioning ? "Applying..." : "Apply Transition"}</span>
                </button>
              </div>

              {transitionMessage && (
                <div className="feedback-message success" role="status">
                  <CheckCircle size={16} aria-hidden="true" />
                  <span>{transitionMessage}</span>
                </div>
              )}

              {transitionError && (
                <div className="feedback-message error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{transitionError}</span>
                </div>
              )}
            </form>
          ) : (
            <div className="terminal-status-notice">
              <CheckCircle size={18} className="text-pine" aria-hidden="true" />
              <span>
                This order is in a final status (<code>{currentDispatch}</code>). No further forward
                dispatch transitions are available.
              </span>
            </div>
          )}
        </section>

        {/* Admin Notes Section */}
        <section className="form-card" aria-label="Internal staff notes">
          <h2 className="card-title">
            <Save size={18} aria-hidden="true" />
            <span>Internal Admin Notes</span>
          </h2>
          <p className="card-desc">
            Private internal notes for packaging, customer communication, or courier tracking numbers.
          </p>

          <form onSubmit={handleSaveNotes} className="notes-form">
            <label htmlFor="admin-notes-textarea" className="field-label">
              Notes & Fulfillment History:
            </label>
            <textarea
              id="admin-notes-textarea"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. VIP customer, requested bubble-wrap packaging, tracking #BLR-48928..."
              className="notes-textarea"
            />

            <div className="notes-submit-row">
              <button
                type="submit"
                disabled={savingNotes}
                className="button button-primary"
              >
                <Save size={16} aria-hidden="true" />
                <span>{savingNotes ? "Saving..." : "Save Notes"}</span>
              </button>
              <Link href={`/admin/orders/${order.id}`} className="button button-outline">
                Return to Dossier
              </Link>
            </div>

            {notesMessage && (
              <div className="feedback-message success" role="status">
                <CheckCircle size={16} aria-hidden="true" />
                <span>{notesMessage}</span>
              </div>
            )}

            {notesError && (
              <div className="feedback-message error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{notesError}</span>
              </div>
            )}
          </form>
        </section>
      </div>

      <style jsx>{`
        .fulfillment-page-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 960px;
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

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .fulfillment-page-title {
          font-size: clamp(22px, 3vw, 28px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .customer-info-line {
          font-size: 13px;
          color: #6a6e64;
          margin-top: 4px;
        }

        .fulfillment-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 24px;
        }

        .card-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin: 0 0 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-desc {
          font-size: 13px;
          color: #6a6e64;
          margin: 0 0 20px;
        }

        .payment-guard-alert {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: rgba(179, 107, 61, 0.12);
          border: 1px solid rgba(179, 107, 61, 0.3);
          border-radius: 6px;
          padding: 14px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #663d1a;
        }

        .payment-guard-alert strong {
          display: block;
          margin-bottom: 4px;
        }

        .payment-guard-alert p {
          margin: 0;
          line-height: 1.4;
        }

        .guard-icon {
          color: var(--amber, #b36b3d);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .stepper-visual {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ede9df;
          padding: 16px 20px;
          border-radius: 6px;
          margin-bottom: 24px;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0.5;
        }

        .step-item.done {
          opacity: 0.9;
        }

        .step-item.active {
          opacity: 1;
          font-weight: 700;
        }

        .step-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #9ea399;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .step-item.done .step-circle {
          background: var(--pine, #23483a);
        }

        .step-item.active .step-circle {
          background: var(--amber, #b36b3d);
        }

        .step-label {
          font-size: 12px;
          text-transform: capitalize;
        }

        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          margin-bottom: 8px;
        }

        .transition-controls-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .status-select {
          flex: 1;
          min-width: 240px;
          padding: 10px 14px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
        }

        .notes-textarea {
          width: 100%;
          padding: 12px;
          font-size: 13px;
          line-height: 1.5;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
          box-sizing: border-box;
          font-family: inherit;
        }

        .notes-submit-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
        }

        .feedback-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          margin-top: 14px;
        }

        .feedback-message.success {
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
        }

        .feedback-message.error {
          background: rgba(143, 47, 42, 0.12);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.3);
        }

        .terminal-status-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px;
          background: #ede9df;
          border-radius: 6px;
          font-size: 13px;
          color: #555850;
        }

        .status-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
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

        .state-card {
          text-align: center;
          padding: 48px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
