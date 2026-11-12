"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Eye,
  Truck,
  Edit,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from "lucide-react";

export type OrderSummary = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
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
  payment_info?: {
    gateway: string;
    gateway_order_id?: string | null;
    gateway_payment_id?: string | null;
    payment_method?: string | null;
    refund_minor?: number;
  };
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPaymentBadgeLabel(order: OrderSummary): string | null {
  if (order.payment_info?.payment_method) {
    const m = order.payment_info.payment_method.toUpperCase();
    if (m === "UPI") return "UPI";
    if (m === "CARD") return "Card";
    if (m === "NETBANKING") return "NetBanking";
    if (m === "COD") return "COD";
    return order.payment_info.payment_method;
  }
  if (order.payment_status === "cod_due" || order.payment_status === "cod_remitted") {
    return "COD";
  }
  if (order.payment_status === "pending_bank_transfer" || order.payment_status === "advance_paid") {
    return "Bank Transfer";
  }
  if (order.payment_info?.gateway && order.payment_info.gateway !== "unknown") {
    return order.payment_info.gateway;
  }
  return null;
}

export function OrderListTable() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dispatchFilter, setDispatchFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [, startTransition] = useTransition();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (dispatchFilter !== "all") params.set("dispatchStatus", dispatchFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load orders");
      }
      const data = await res.json();
      startTransition(() => {
        setOrders(data.orders || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching orders");
    } finally {
      setLoading(false);
    }
  }, [paymentFilter, dispatchFilter, searchQuery, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchOrders();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  // Aggregate stats from currently loaded slice
  const currentPaidPaise = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + (o.total_paise || 0), 0);
  const awaitingDispatchCount = orders.filter(
    (o) => o.dispatch_status === "unfulfilled" || o.dispatch_status === "preparing"
  ).length;

  const startIdx = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endIdx = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="orders-module-root">
      {/* Top Metrics Cards */}
      <div className="orders-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Total Found</span>
          <span className="metric-val">{pagination.total.toLocaleString("en-IN")}</span>
          <span className="metric-sub">Across all database records</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Awaiting Dispatch (On Page)</span>
          <span className="metric-val text-amber">{awaitingDispatchCount}</span>
          <span className="metric-sub">Unfulfilled / Preparing</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Paid Volume (On Page)</span>
          <span className="metric-val text-pine">{formatRupees(currentPaidPaise)}</span>
          <span className="metric-sub">Verified paid total</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="orders-filters-card">
        <div className="filters-row">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search Order ID, Name, Email or Phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
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
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="pending_bank_transfer">Pending Bank Transfer</option>
                <option value="advance_paid">Advance Paid</option>
                <option value="payment_pending">Pending Gateway</option>
                <option value="payment_failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="cod_due">COD Due</option>
                <option value="cod_remitted">COD Remitted</option>
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="dispatch-filter" className="filter-label">
                Dispatch:
              </label>
              <select
                id="dispatch-filter"
                value={dispatchFilter}
                onChange={(e) => {
                  setDispatchFilter(e.target.value);
                  setPage(1);
                }}
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

            <div className="filter-item">
              <label htmlFor="page-size-select" className="filter-label">
                Per page:
              </label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {(paymentFilter !== "all" || dispatchFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setPaymentFilter("all");
                  setDispatchFilter("all");
                  setSearchQuery("");
                  setPage(1);
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
          <span>Loading orders page {page}...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="orders-empty-card">
          <ShoppingBag size={48} className="empty-icon" aria-hidden="true" />
          <h3>No matching orders found</h3>
          <p>Try adjusting your search terms or filters.</p>
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
                const paymentBadge = getPaymentBadgeLabel(order);
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
                        {order.customer_phone && (
                          <span className="customer-phone font-mono">{order.customer_phone}</span>
                        )}
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
                      <div className="payment-cell">
                        <span className={`status-pill payment-${order.payment_status}`}>
                          {order.payment_status.replace(/_/g, " ")}
                        </span>
                        {paymentBadge && (
                          <span className="method-pill" title={`Payment method: ${paymentBadge}`}>
                            <CreditCard size={11} aria-hidden="true" />
                            {paymentBadge}
                          </span>
                        )}
                      </div>
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
                          <Eye size={13} aria-hidden="true" />
                          <span>Dossier</span>
                        </Link>
                        {!isCancelled && (
                          <Link
                            href={`/admin/orders/${order.id}/dispatch`}
                            className="table-action-btn fulfill-btn"
                            title="Dispatch & shipment tracking"
                          >
                            <Truck size={13} aria-hidden="true" />
                            <span>Dispatch</span>
                          </Link>
                        )}
                        <Link
                          href={`/admin/orders/${order.id}/modify`}
                          className="table-action-btn modify-btn"
                          title="Modify customer details & notes"
                        >
                          <Edit size={13} aria-hidden="true" />
                          <span>Modify</span>
                        </Link>
                        {!isCancelled && (
                          <Link
                            href={`/admin/orders/${order.id}/cancel`}
                            className="table-action-btn cancel-btn"
                            title="Safe cancellation view"
                          >
                            <XCircle size={13} aria-hidden="true" />
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

      {/* Pagination Controls Footer */}
      <div className="orders-pagination-bar">
        <div className="pagination-info">
          Showing <strong>{startIdx}</strong> to <strong>{endIdx}</strong> of{" "}
          <strong>{pagination.total.toLocaleString("en-IN")}</strong> orders
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1 || loading}
            className="pagination-btn"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Previous
          </button>

          <div className="pagination-pages">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              // Sliding window around current page
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  disabled={loading}
                  className={`page-num-btn ${pagination.page === pageNum ? "active" : ""}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="pagination-btn"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .orders-module-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
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
          padding: 14px 16px;
        }

        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
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
          padding: 8px 12px 8px 36px;
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
          padding: 7px 10px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
        }

        .clear-filters-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 7px 12px;
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

        .customer-phone {
          font-size: 11px;
          color: #8c9085;
        }

        .items-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #ede9df;
          border-radius: 12px;
          font-size: 11px;
          color: #555850;
        }

        .payment-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }

        .method-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 600;
          background: #f0ece3;
          border: 1px solid #d4cebe;
          border-radius: 4px;
          color: #5d6157;
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

        .payment-advance_paid {
          background: rgba(35, 72, 58, 0.15);
          color: #1b382d;
          border: 1px solid rgba(35, 72, 58, 0.35);
        }

        .payment-pending_bank_transfer {
          background: rgba(179, 145, 86, 0.15);
          color: #7d6537;
          border: 1px solid rgba(179, 145, 86, 0.35);
        }

        .payment-cod_due {
          background: rgba(179, 107, 61, 0.12);
          color: var(--amber, #b36b3d);
          border: 1px solid rgba(179, 107, 61, 0.3);
        }

        .payment-cod_remitted {
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

        .dispatch-returned {
          background: rgba(105, 122, 85, 0.15);
          color: #4c5a3d;
          border: 1px solid rgba(105, 122, 85, 0.3);
        }

        .actions-cluster {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .table-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 7px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          transition: background 120ms ease;
          white-space: nowrap;
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

        .modify-btn {
          background: rgba(33, 64, 95, 0.08);
          color: #21405f;
          border: 1px solid rgba(33, 64, 95, 0.2);
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

        .orders-pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 16px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .pagination-info {
          font-size: 13px;
          color: #555850;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pagination-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #23483a;
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          cursor: pointer;
        }

        .pagination-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .pagination-pages {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .page-num-btn {
          min-width: 32px;
          height: 32px;
          padding: 0 6px;
          font-size: 12px;
          font-weight: 600;
          color: #485347;
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          cursor: pointer;
        }

        .page-num-btn.active {
          background: #23483a;
          color: #ffffff;
          border-color: #23483a;
        }

        @media (max-width: 800px) {
          .orders-metrics-grid {
            grid-template-columns: 1fr;
          }
          .orders-pagination-bar {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
