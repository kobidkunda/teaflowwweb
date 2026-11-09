"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { FullOrder } from "./OrderDossierView";

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderCancelForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

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
      <div className="cancel-card" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading cancellation safety checks for order #{orderId}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="cancel-card error">
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
  const isAlreadyCancelled = order.dispatch_status === "cancelled";

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault();
    if (isPaid) {
      setCancelError("Paid orders must be refunded through the payment gateway, not cancelled.");
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to cancel the order");
      }

      setCancelSuccess(true);
      setTimeout(() => {
        router.push(`/admin/orders/${encodeURIComponent(orderId)}`);
      }, 1200);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="cancel-page-root">
      <div>
        <Link href={`/admin/orders/${order.id}`} className="back-link">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Order Dossier</span>
        </Link>
        <h1 className="cancel-page-title">Cancel Order #{order.id}</h1>
        <p className="cancel-subtitle">
          Dedicated safe cancellation workflow with payment gateway dependency checks.
        </p>
      </div>

      {isAlreadyCancelled ? (
        <div className="cancel-card info">
          <CheckCircle size={28} className="text-pine" aria-hidden="true" />
          <h2>Order Already Cancelled</h2>
          <p>This order has already been marked as cancelled in the registry.</p>
          <Link href={`/admin/orders/${order.id}`} className="button button-primary">
            Return to Order Dossier
          </Link>
        </div>
      ) : isPaid ? (
        /* Cancellation Blocked for Paid Orders */
        <div className="cancel-card blocked-guard">
          <ShieldAlert size={36} className="text-danger" aria-hidden="true" />
          <h2 className="guard-title">Cancellation Blocked: Paid Order</h2>
          <div className="guard-explanation">
            <p>
              Order <strong>#{order.id}</strong> has been confirmed as{" "}
              <strong className="badge-paid">PAID</strong> ({formatRupees(order.total_paise)}).
            </p>
            <p className="guard-callout">
              <strong>Truthful Commerce Mandate:</strong> Paid orders cannot be cancelled directly
              through the store admin portal to prevent stranded inventory reservations and financial
              mismatches. Paid orders must be refunded through the payment gateway.
            </p>
            <p>
              Once a verified refund webhook confirms gateway processing, the order record will be
              updated to <code>refunded</code> and inventory will be safely restored.
            </p>
          </div>

          <div className="guard-actions">
            <button
              type="button"
              disabled
              className="button button-disabled"
              title="Cancellation blocked for paid orders"
            >
              <XCircle size={16} aria-hidden="true" />
              <span>Cancel Order (Blocked)</span>
            </button>
            <Link href={`/admin/orders/${order.id}`} className="button button-outline">
              Return to Order Dossier
            </Link>
          </div>
        </div>
      ) : (
        /* Cancellation Allowed for Unpaid Orders */
        <div className="cancel-card warning-panel">
          <AlertTriangle size={36} className="text-amber" aria-hidden="true" />
          <h2>Confirm Order Cancellation</h2>
          <p className="warning-text">
            Are you sure you want to cancel order <strong>#{order.id}</strong> for customer{" "}
            <strong>{order.customer_name}</strong> ({order.customer_email})?
          </p>

          <div className="order-summary-box">
            <div className="summary-row">
              <span>Order Total:</span>
              <strong>{formatRupees(order.total_paise)}</strong>
            </div>
            <div className="summary-row">
              <span>Payment Status:</span>
              <span className="unpaid-badge">UNPAID</span>
            </div>
            <div className="summary-row">
              <span>Current Dispatch:</span>
              <span>{order.dispatch_status}</span>
            </div>
          </div>

          {cancelSuccess ? (
            <div className="cancel-success-msg" role="status">
              <CheckCircle size={20} aria-hidden="true" />
              <span>Order #{order.id} cancelled. Redirecting to dossier...</span>
            </div>
          ) : (
            <form onSubmit={handleConfirmCancel} className="cancel-confirm-form">
              {cancelError && (
                <div className="cancel-error-alert" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="action-buttons-row">
                <button
                  type="submit"
                  disabled={cancelling}
                  className="button button-danger"
                >
                  <XCircle size={16} aria-hidden="true" />
                  <span>{cancelling ? "Cancelling Order..." : "Confirm Permanent Cancellation"}</span>
                </button>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="button button-outline"
                >
                  Keep Order (Do Not Cancel)
                </Link>
              </div>
            </form>
          )}
        </div>
      )}

      <style jsx>{`
        .cancel-page-root {
          max-width: 680px;
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

        .cancel-page-title {
          font-size: clamp(22px, 3vw, 28px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .cancel-subtitle {
          font-size: 13px;
          color: #6a6e64;
          margin-top: 4px;
        }

        .cancel-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 32px 28px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .blocked-guard {
          border-color: #f8b4b4;
          background: #fff8f8;
        }

        .guard-title {
          font-family: Georgia, serif;
          color: #8f2f2a;
          margin: 0;
        }

        .guard-explanation {
          text-align: left;
          font-size: 14px;
          line-height: 1.6;
          color: #555850;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .guard-callout {
          background: rgba(143, 47, 42, 0.08);
          border-left: 3px solid #8f2f2a;
          padding: 12px 14px;
          border-radius: 4px;
          color: #722420;
          margin: 4px 0;
        }

        .badge-paid {
          background: rgba(35, 72, 58, 0.15);
          color: var(--pine, #23483a);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .guard-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .button-disabled {
          background: #d9d4c8 !important;
          color: #7b8075 !important;
          cursor: not-allowed !important;
          opacity: 0.6;
        }

        .warning-panel {
          border-color: rgba(179, 107, 61, 0.4);
        }

        .warning-panel h2 {
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .warning-text {
          font-size: 14px;
          color: #555850;
          line-height: 1.5;
          margin: 0;
        }

        .order-summary-box {
          background: #ede9df;
          border-radius: 6px;
          padding: 14px 20px;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
          font-size: 13px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .unpaid-badge {
          background: rgba(179, 107, 61, 0.2);
          color: var(--amber, #b36b3d);
          font-weight: 700;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .cancel-confirm-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .action-buttons-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .button-danger {
          background: #8f2f2a;
          color: #ffffff;
          border: 1px solid #722420;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .button-danger:hover {
          background: #722420;
        }

        .cancel-error-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fdf2f2;
          color: #8f2f2a;
          border: 1px solid #f8b4b4;
          border-radius: 6px;
          font-size: 13px;
          text-align: left;
        }

        .cancel-success-msg {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: rgba(35, 72, 58, 0.15);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
