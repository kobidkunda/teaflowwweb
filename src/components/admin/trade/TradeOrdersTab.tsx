"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import {
  formatDateTime,
  formatRupees,
  type AdminTradePayload,
  type StatusToast,
} from "./types";

interface TradeOrdersTabProps {
  data: AdminTradePayload;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

export function TradeOrdersTab({ data, onSaved, onError }: TradeOrdersTabProps) {
  const [search, setSearch] = useState("");
  const [dispatchFilter, setDispatchFilter] = useState("");

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.orders.filter((ord) => {
      const dispatchStr = String(ord.dispatch_status || "pending");
      if (dispatchFilter && dispatchStr !== dispatchFilter) return false;
      if (!q) return true;
      return `${String(ord.order_id ?? "")} ${String(ord.destination_pin ?? "")} ${String(
        ord.payment_mode ?? ""
      )}`
        .toLowerCase()
        .includes(q);
    });
  }, [data.orders, search, dispatchFilter]);

  return (
    <div className="tf-trade-stack">
      <search className="tf-trade-toolbar">
        <div className="tf-trade-toolbar-group">
          <div className="tf-trade-search-wrap">
            <Search size={15} className="tf-trade-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="tf-trade-input tf-trade-search-input"
              aria-label="Search trade orders"
              placeholder="Search by order ID, PIN, or payment mode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="tf-trade-select"
            style={{ width: "auto", minWidth: 165 }}
            aria-label="Filter orders by dispatch status"
            value={dispatchFilter}
            onChange={(e) => setDispatchFilter(e.target.value)}
          >
            <option value="">All dispatch states</option>
            <option value="pending">Pending</option>
            <option value="packed">Packed</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        <span className="tf-trade-help">
          Showing {filteredOrders.length} of {data.orders.length} trade orders
        </span>
      </search>

      <div className="tf-trade-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="trade-orders-table-caption"
          className="tf-trade-table-wrap"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="tf-trade-table">
            <caption id="trade-orders-table-caption">
              Trade orders and COD/remittance reconciliation
            </caption>
            <thead>
              <tr>
                <th scope="col">Order ID</th>
                <th scope="col">PIN &amp; Mode</th>
                <th scope="col">Total / Due Now / Later</th>
                <th scope="col">Remittance &amp; Dispatch</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tf-trade-empty">
                    No trade orders match your filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const orderId = String(ord.order_id);
                  const dispatchStatus = String(
                    ord.dispatch_status || "pending"
                  );
                  const remittanceStatus = String(
                    ord.remittance_status || "pending"
                  );
                  const isRemitted = remittanceStatus === "remitted";

                  return (
                    <tr key={orderId}>
                      <th scope="row">
                        <div className="tf-trade-single-line" style={{ maxWidth: 170 }} title={orderId}>
                          {orderId}
                        </div>
                        {ord.created_at ? (
                          <div className="tf-trade-help">
                            {formatDateTime(ord.created_at)}
                          </div>
                        ) : null}
                      </th>
                      <td data-label="PIN & Mode">
                        <strong>{String(ord.destination_pin)}</strong>{" "}
                        <span className="tf-badge">{String(ord.payment_mode)}</span>
                      </td>
                      <td
                        data-label="Totals"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        <div>
                          <strong>{formatRupees(Number(ord.total_paise))}</strong>{" "}
                          total
                        </div>
                        <div className="tf-trade-help">
                          Now: {formatRupees(Number(ord.due_now_paise))} · Later:{" "}
                          {formatRupees(Number(ord.due_later_paise))}
                        </div>
                      </td>
                      <td data-label="Status">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span
                            className={`tf-badge ${
                              isRemitted ? "tf-badge--ok" : "tf-badge--warn"
                            }`}
                          >
                            {remittanceStatus} (
                            {formatRupees(Number(ord.remitted_paise || 0))})
                          </span>
                          <span
                            className={`tf-badge ${
                              dispatchStatus === "delivered"
                                ? "tf-badge--ok"
                                : dispatchStatus === "dispatched"
                                ? "tf-badge--info"
                                : ""
                            }`}
                          >
                            {dispatchStatus}
                          </span>
                        </div>
                      </td>
                      <td data-label="Actions">
                        <div className="tf-trade-row-actions">
                          <select
                            value={dispatchStatus}
                            aria-label={`Dispatch status for ${orderId}`}
                            className="tf-trade-select"
                            style={{
                              width: "auto",
                              minHeight: 36,
                              padding: "4px 10px",
                              fontSize: 12.5,
                            }}
                            onChange={async (e) => {
                              const res = await fetch("/api/admin/trade/orders", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "same-origin",
                                body: JSON.stringify({
                                  order_id: ord.order_id,
                                  dispatch_status: e.target.value,
                                }),
                              });
                              if (!res.ok) {
                                onError(`Failed to update order ${orderId}.`);
                                return;
                              }
                              await onSaved({
                                kind: "ok",
                                text: `Order ${orderId} dispatch updated.`,
                              });
                            }}
                          >
                            <option value="pending">pending</option>
                            <option value="packed">packed</option>
                            <option value="dispatched">dispatched</option>
                            <option value="delivered">delivered</option>
                          </select>

                          <button
                            type="button"
                            className="tf-trade-btn tf-trade-btn--sm"
                            disabled={isRemitted}
                            onClick={async () => {
                              const res = await fetch("/api/admin/trade/orders", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "same-origin",
                                body: JSON.stringify({
                                  order_id: ord.order_id,
                                  remittance_status: "remitted",
                                  remitted_paise: ord.due_later_paise,
                                }),
                              });
                              if (!res.ok) {
                                onError(
                                  `Failed to mark order ${orderId} remitted.`
                                );
                                return;
                              }
                              await onSaved({
                                kind: "ok",
                                text: `Order ${orderId} marked remitted.`,
                              });
                            }}
                          >
                            <CheckCircle2 size={13} aria-hidden="true" />
                            <span>
                              {isRemitted ? "Remitted" : "Mark Remitted"}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
