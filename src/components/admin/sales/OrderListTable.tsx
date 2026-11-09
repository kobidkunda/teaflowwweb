"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Eye,
  Truck,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

export type OrderSummary = {
  id: string;
  customer_name: string;
  customer_email: string;
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
  items?: Array<{ variant_id: number; quantity: number; unit_price_paise: number; sku?: string }>;
};

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderListTable() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dispatchFilter, setDispatchFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
        if (dispatchFilter !== "all") params.set("dispatchStatus", dispatchFilter);
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        params.set("limit", "50");

        const res = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load orders");
        }
        const data = await res.json();
        if (mounted) {
          setOrders(data.orders || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error fetching orders");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timer = setTimeout(fetchOrders, 200);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [paymentFilter, dispatchFilter, searchQuery]);

  // Aggregate stats
  const totalVolumePaise = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + (o.total_paise || 0), 0);
  const pendingCount = orders.filter(
    (o) => o.dispatch_status === "unfulfilled" || o.dispatch_status === "preparing"
  ).length;

  return (
    <div className="orders-module-root">
      {/* Top Action & Metrics Bar */}
      <div className="orders-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Total Listed</span>
          <span className="metric-val">{orders.length}</span>
          <span className="metric-sub">Orders found</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Awaiting Fulfillment</span>
          <span className="metric-val text-amber">{pendingCount}</span>
          <span className="metric-sub">Unfulfilled / Preparing</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Paid Volume</span>
          <span className="metric-val text-pine">{formatRupees(totalVolumePaise)}</span>
          <span className="metric-sub">Verified paid total</span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="orders-filters-card">
        <div className="filters-row">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by Order ID or Customer Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="orders-search-input"
              aria-label="Search orders"
            />
          </div>

          <div className="filter-select-group">
            <div className="filter-item">
              <label htmlFor="payment-filter" className="filter-label">
                Payment:
              </label>
              <select
                id="payment-filter"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="payment_pending">Pending</option>
                <option value="payment_failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="dispatch-filter" className="filter-label">
                Dispatch:
              </label>
              <select
                id="dispatch-filter"
                value={dispatchFilter}
                onChange={(e) => setDispatchFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Dispatch Statuses</option>
                <option value="unfulfilled">Unfulfilled</option>
                <option value="preparing">Preparing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            {(paymentFilter !== "all" || dispatchFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setPaymentFilter("all");
                  setDispatchFilter("all");
                  setSearchQuery("");
                }}
                className="clear-filters-btn"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {error && (
        <div className="error-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="orders-loading" role="status">
          <Clock className="spin" size={24} aria-hidden="true" />
          <span>Loading order registry...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="orders-empty-card">
          <ShoppingBag size={48} className="empty-icon" aria-hidden="true" />
          <h3>No matching orders</h3>
          <p>Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="admin-table orders-table">
            <thead>
              <tr>
                <th scope="col">Order Reference</th>
                <th scope="col">Date</th>
                <th scope="col">Customer</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfillment</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isCancelled = order.dispatch_status === "cancelled";
                return (
                  <tr key={order.id} className={isCancelled ? "row-cancelled" : ""}>
                    <td className="font-mono">
                      <Link href={`/admin/orders/${order.id}`} className="order-id-link">
                        {order.id}
                      </Link>
                      {order.admin_notes && (
                        <span className="notes-indicator" title={order.admin_notes}>
                          📝 Note
                        </span>
                      )}
                    </td>
                    <td className="text-muted">
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">{order.customer_name}</span>
                        <span className="customer-email">{order.customer_email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="items-badge">
                        {order.items ? order.items.reduce((s, i) => s + i.quantity, 0) : "—"} items
                      </span>
                    </td>
                    <td className="font-bold text-ink">
                      {formatRupees(order.total_paise)}
                    </td>
                    <td>
                      <span className={`status-pill payment-${order.payment_status}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill dispatch-${order.dispatch_status}`}>
                        {order.dispatch_status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="actions-cluster">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="table-action-btn view-btn"
                          title="View order dossier"
                        >
                          <Eye size={14} aria-hidden="true" />
                          <span>Dossier</span>
                        </Link>
                        {!isCancelled && (
                          <Link
                            href={`/admin/orders/${order.id}/edit`}
                            className="table-action-btn fulfill-btn"
                            title="Manage fulfillment status and notes"
                          >
                            <Truck size={14} aria-hidden="true" />
                            <span>Fulfill</span>
                          </Link>
                        )}
                        {!isCancelled && (
                          <Link
                            href={`/admin/orders/${order.id}/cancel`}
                            className="table-action-btn cancel-btn"
                            title="Safe cancellation view"
                          >
                            <XCircle size={14} aria-hidden="true" />
                            <span>Cancel</span>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .orders-module-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .orders-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .metric-box {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #6a6e64;
        }

        .metric-val {
          font-size: 26px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          line-height: 1.1;
        }

        .metric-sub {
          font-size: 12px;
          color: #7b8075;
        }

        .text-amber {
          color: var(--amber, #b36b3d);
        }

        .text-pine {
          color: var(--pine, #23483a);
        }

        .orders-filters-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 16px;
        }

        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .search-input-wrap {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #7b8075;
          pointer-events: none;
        }

        .orders-search-input {
          width: 100%;
          padding: 9px 12px 9px 36px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
          box-sizing: border-box;
        }

        .filter-select-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .filter-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: #555850;
        }

        .filter-select {
          padding: 8px 12px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
        }

        .clear-filters-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #6a6e64;
          background: #ede9df;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          cursor: pointer;
        }

        .orders-table-wrapper {
          overflow-x: auto;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
        }

        .orders-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .order-id-link {
          font-weight: 600;
          color: var(--pine, #23483a);
          text-decoration: underline;
        }

        .notes-indicator {
          display: inline-block;
          margin-left: 6px;
          font-size: 11px;
          padding: 1px 5px;
          background: rgba(179, 145, 86, 0.2);
          border-radius: 4px;
          color: #6d531d;
        }

        .customer-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .customer-name {
          font-weight: 600;
          color: var(--forest, #1d2a24);
        }

        .customer-email {
          font-size: 12px;
          color: #7b8075;
        }

        .items-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #ede9df;
          border-radius: 12px;
          font-size: 11px;
          color: #555850;
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

        .payment-payment_failed {
          background: rgba(143, 47, 42, 0.12);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.3);
        }

        .payment-refunded {
          background: rgba(105, 122, 85, 0.15);
          color: var(--moss, #697a55);
          border: 1px solid rgba(105, 122, 85, 0.3);
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

        .actions-cluster {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .table-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          transition: background 120ms ease;
        }

        .view-btn {
          background: rgba(35, 72, 58, 0.08);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.2);
        }

        .fulfill-btn {
          background: rgba(179, 145, 86, 0.12);
          color: #7d6537;
          border: 1px solid rgba(179, 145, 86, 0.3);
        }

        .cancel-btn {
          background: rgba(143, 47, 42, 0.08);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.2);
        }

        .row-cancelled td {
          opacity: 0.6;
        }

        .orders-empty-card {
          text-align: center;
          padding: 48px 24px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
        }

        .empty-icon {
          color: #aeb7aa;
          margin-bottom: 12px;
        }

        .orders-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 48px;
          color: #6a6e64;
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fdf2f2;
          color: #8f2f2a;
          border: 1px solid #f8b4b4;
          border-radius: 6px;
          font-size: 13px;
        }

        @media (max-width: 800px) {
          .orders-metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
