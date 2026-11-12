"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Printer,
  ExternalLink,
  PackageCheck,
  FileText,
  MapPin,
  Save,
} from "lucide-react";
import type { FullOrder } from "./OrderDossierView";
import { ShiprocketDispatchCard } from "./ShiprocketDispatchCard";

const CARRIERS = [
  { id: "shiprocket", name: "Shiprocket (Automated)" },
  { id: "delhivery", name: "Delhivery", trackingPrefix: "https://www.delhivery.com/track/package/" },
  { id: "bluedart", name: "Blue Dart", trackingPrefix: "https://www.bluedart.com/tracking?handler=t&awb=awb&numbers=" },
  { id: "dtdc", name: "DTDC", trackingPrefix: "https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=" },
  { id: "indiapost", name: "India Post Speed Post", trackingPrefix: "https://www.indiapost.gov.in/_layouts/15/dpt.cpt.proc/trackconsignment.aspx?consNo=" },
  { id: "fedex", name: "FedEx India", trackingPrefix: "https://www.fedex.com/fedextrack/?trknbr=" },
  { id: "transport", name: "Road Transport / Bilty" },
  { id: "custom", name: "Other / Custom Courier" },
];

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderDispatchView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [events, setEvents] = useState<FullOrder["events"]>([]);
  const [shipmentDoc, setShipmentDoc] = useState<{
    carrierName?: string;
    awb?: { awb_code?: string; courier_name?: string };
    trackingUrl?: string;
    labelUrl?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition state
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(null);

  // Manual Tracking Form State
  const [carrier, setCarrier] = useState("shiprocket");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingSuccess, setTrackingSuccess] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
      if (!res.ok) throw new Error("Order not found");
      const data = await res.json();
      if (data.order) {
        setOrder(data.order);
        setEvents(data.events || []);
        setAdminNotes(data.order.admin_notes || "");
      }
      if (data.shipment) {
        setShipmentDoc(data.shipment);
        if (data.shipment.carrierName) setCarrier(data.shipment.carrierName);
        if (data.shipment.awb?.awb_code) setTrackingNumber(data.shipment.awb.awb_code);
        if (data.shipment.trackingUrl) setTrackingUrl(data.shipment.trackingUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading order details");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Dispatch State Transition
  async function handleStatusTransition(targetStatus: string) {
    if (!order) return;
    setTransitioning(true);
    setTransitionError(null);
    setTransitionSuccess(null);

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to transition dispatch status to ${targetStatus}`);
      }

      setTransitionSuccess(`Order dispatch status successfully advanced to: ${targetStatus.toUpperCase()}`);
      await loadData();
    } catch (err: unknown) {
      setTransitionError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  // Handle Manual Tracking Form Save
  async function handleSaveTracking(e: React.FormEvent) {
    e.preventDefault();
    setSavingTracking(true);
    setTrackingSuccess(null);
    setTrackingError(null);

    // Auto-fill tracking URL if carrier prefix exists
    let finalUrl = trackingUrl.trim();
    const selectedCarrier = CARRIERS.find((c) => c.id === carrier);
    if (!finalUrl && selectedCarrier?.trackingPrefix && trackingNumber.trim()) {
      finalUrl = `${selectedCarrier.trackingPrefix}${trackingNumber.trim()}`;
    }

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_carrier: selectedCarrier ? selectedCarrier.name : carrier,
          tracking_number: trackingNumber.trim() || null,
          tracking_url: finalUrl || null,
          admin_notes: adminNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update shipment tracking details");
      }

      setTrackingSuccess("Shipment tracking details saved successfully!");
      if (finalUrl) setTrackingUrl(finalUrl);
      await loadData();
    } catch (err: unknown) {
      setTrackingError(err instanceof Error ? err.message : "Failed to save tracking details");
    } finally {
      setSavingTracking(false);
    }
  }

  if (loading) {
    return (
      <div className="state-card" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading dispatch operations for #{orderId}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="state-card error">
        <AlertTriangle size={32} className="text-amber" aria-hidden="true" />
        <h2>Order Not Found</h2>
        <p>{error || "Order could not be loaded."}</p>
        <Link href="/admin/orders" className="button button-outline">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Orders List</span>
        </Link>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid" || order.payment_status === "cod_due" || order.payment_status === "cod_remitted";
  const currentDispatch = order.dispatch_status;
  const isCancelled = currentDispatch === "cancelled";

  return (
    <div className="dispatch-module-root">
      {/* Header bar */}
      <div className="dispatch-header">
        <div>
          <Link href={`/admin/orders/${order.id}`} className="back-link">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Order #{order.id} Dossier</span>
          </Link>
          <div className="title-row">
            <h1 className="dispatch-title">Fulfillment &amp; Dispatch Center</h1>
            <span className={`status-pill dispatch-${order.dispatch_status}`}>
              {order.dispatch_status}
            </span>
            <span className={`status-pill payment-${order.payment_status}`}>
              {order.payment_status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="dispatch-subtitle">
            Order #{order.id} · Customer: {order.customer_name} ({order.customer_email})
          </p>
        </div>

        <div className="dispatch-actions">
          <button
            type="button"
            onClick={() => window.print()}
            className="button button-outline print-btn"
          >
            <Printer size={15} aria-hidden="true" />
            <span>Print Packing Slip</span>
          </button>
          <Link href={`/admin/orders/${order.id}/modify`} className="button button-outline">
            <span>Modify Address/Info</span>
          </Link>
          <Link href={`/admin/orders/${order.id}`} className="button button-primary">
            <span>Order Dossier</span>
          </Link>
        </div>
      </div>

      {transitionSuccess && (
        <div className="alert-box success-alert" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{transitionSuccess}</span>
        </div>
      )}

      {transitionError && (
        <div className="alert-box error-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{transitionError}</span>
        </div>
      )}

      {/* Visual Pipeline Progression */}
      <section className="dispatch-card pipeline-card">
        <h2 className="card-heading">
          <PackageCheck size={18} aria-hidden="true" />
          <span>Fulfillment Progress Pipeline</span>
        </h2>

        <div className="pipeline-steps">
          <div className={`step-item ${currentDispatch !== "unfulfilled" ? "step-completed" : "step-active"}`}>
            <div className="step-circle">1</div>
            <span className="step-title">Unfulfilled</span>
            <span className="step-sub">Order Placed</span>
          </div>
          <div className="step-line" />

          <div
            className={`step-item ${
              currentDispatch === "shipped" || currentDispatch === "delivered"
                ? "step-completed"
                : currentDispatch === "preparing"
                ? "step-active"
                : "step-pending"
            }`}
          >
            <div className="step-circle">2</div>
            <span className="step-title">Preparing</span>
            <span className="step-sub">Pack &amp; Weigh</span>
          </div>
          <div className="step-line" />

          <div
            className={`step-item ${
              currentDispatch === "delivered"
                ? "step-completed"
                : currentDispatch === "shipped"
                ? "step-active"
                : "step-pending"
            }`}
          >
            <div className="step-circle">3</div>
            <span className="step-title">Shipped</span>
            <span className="step-sub">Carrier In Transit</span>
          </div>
          <div className="step-line" />

          <div
            className={`step-item ${
              currentDispatch === "delivered" ? "step-completed step-active" : "step-pending"
            }`}
          >
            <div className="step-circle">4</div>
            <span className="step-title">Delivered</span>
            <span className="step-sub">Handed to Customer</span>
          </div>
        </div>

        {/* State Transition Actions */}
        {!isCancelled ? (
          <div className="pipeline-actions-row">
            {currentDispatch === "unfulfilled" && (
              <button
                type="button"
                disabled={transitioning}
                onClick={() => handleStatusTransition("preparing")}
                className="button button-primary pipeline-action-btn"
              >
                Advance to Preparing (Packaging) →
              </button>
            )}

            {currentDispatch === "preparing" && (
              <button
                type="button"
                disabled={transitioning || !isPaid}
                onClick={() => handleStatusTransition("shipped")}
                className="button button-primary pipeline-action-btn"
                title={!isPaid ? "Payment required before dispatch" : undefined}
              >
                Mark as Shipped (Courier Handover) →
              </button>
            )}

            {currentDispatch === "shipped" && (
              <button
                type="button"
                disabled={transitioning}
                onClick={() => handleStatusTransition("delivered")}
                className="button button-primary pipeline-action-btn"
              >
                Mark as Delivered ✓
              </button>
            )}

            {currentDispatch === "shipped" && (
              <button
                type="button"
                disabled={transitioning}
                onClick={() => handleStatusTransition("returned")}
                className="button button-outline text-amber"
              >
                Mark as Returned / RTO
              </button>
            )}

            {!isPaid && currentDispatch === "preparing" && (
              <p className="warning-note">
                <AlertCircle size={14} aria-hidden="true" />
                Dispatch beyond preparing requires verified payment (current status: {order.payment_status}).
              </p>
            )}
          </div>
        ) : (
          <div className="cancelled-banner">
            <AlertCircle size={18} aria-hidden="true" />
            <span>This order was cancelled. Fulfillment operations are halted.</span>
          </div>
        )}
      </section>

      {/* Main Grid: Shipping Integration & Manual Courier Form */}
      <div className="dispatch-grid">
        {/* Left Column: Courier & Tracking Form */}
        <div className="dispatch-col">
          {/* Shiprocket Automated Integration */}
          <ShiprocketDispatchCard
            orderId={order.id}
            paymentStatus={order.payment_status}
            dispatchStatus={order.dispatch_status}
            onStatusUpdated={loadData}
          />

          {/* Manual / Third-Party Tracking Assignment */}
          <section className="dispatch-card">
            <h2 className="card-heading">
              <Truck size={18} aria-hidden="true" />
              <span>Courier &amp; Tracking Information</span>
            </h2>

            {trackingSuccess && (
              <div className="alert-box success-alert" style={{ marginBottom: 12 }}>
                <CheckCircle2 size={16} />
                <span>{trackingSuccess}</span>
              </div>
            )}
            {trackingError && (
              <div className="alert-box error-alert" style={{ marginBottom: 12 }}>
                <AlertCircle size={16} />
                <span>{trackingError}</span>
              </div>
            )}

            {shipmentDoc?.labelUrl && (
              <div style={{ marginBottom: 14 }}>
                <a
                  href={shipmentDoc.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button-outline"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "12px" }}
                >
                  <Printer size={14} />
                  <span>Download / Print Generated Shipping Label</span>
                </a>
              </div>
            )}

            <form onSubmit={handleSaveTracking}>
              <div className="form-group">
                <label htmlFor="carrier-select" className="form-label">
                  Logistics Courier / Carrier
                </label>
                <select
                  id="carrier-select"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="form-select"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tracking-number-input" className="form-label">
                  AWB / Tracking Number
                </label>
                <input
                  id="tracking-number-input"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. 143256789012 or BLU12345"
                  className="form-input font-mono"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tracking-url-input" className="form-label">
                  Live Tracking URL
                </label>
                <input
                  id="tracking-url-input"
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://carrier.com/track/..."
                  className="form-input"
                />
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tracking-link-preview"
                  >
                    <ExternalLink size={12} />
                    <span>Test tracking link in new tab</span>
                  </a>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="notes-textarea" className="form-label">
                  Dispatch Notes / Warehouse Instructions
                </label>
                <textarea
                  id="notes-textarea"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Dispatched via Siliguri Hub with fragile sticker; weight 1.2kg."
                  className="form-textarea"
                />
              </div>

              <button
                type="submit"
                disabled={savingTracking}
                className="button button-primary"
              >
                {savingTracking ? (
                  <>
                    <Clock size={15} className="spin" />
                    <span>Saving Tracking Info...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Save Tracking &amp; Notes</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Destination Address & Packing Manifest */}
        <div className="dispatch-col">
          {/* Delivery Destination */}
          <section className="dispatch-card">
            <h2 className="card-heading">
              <MapPin size={18} aria-hidden="true" />
              <span>Delivery Destination</span>
            </h2>
            <div className="address-box">
              <p className="font-bold text-forest">{order.customer_name}</p>
              <p className="text-muted">{order.customer_email}</p>
              <p className="address-text">{order.shipping_address || "No address provided"}</p>
            </div>
            <Link
              href={`/admin/orders/${order.id}/modify`}
              className="button button-outline btn-sm"
              style={{ marginTop: 12 }}
            >
              Edit Delivery Address
            </Link>
          </section>

          {/* Packing Manifest */}
          <section className="dispatch-card printable-slip" id="packing-manifest">
            <h2 className="card-heading">
              <FileText size={18} aria-hidden="true" />
              <span>Packing Slip Manifest</span>
            </h2>
            <p className="manifest-intro">
              Verify items before sealing tea caddies / vacuum pouches:
            </p>

            <table className="manifest-table">
              <thead>
                <tr>
                  <th>Variant / SKU</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Unit Price</th>
                </tr>
              </thead>
              <tbody>
                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="font-mono">{it.sku || `Variant #${it.variant_id}`}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{it.quantity}</td>
                      <td style={{ textAlign: "right" }}>{formatRupees(it.unit_price_paise)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-muted" style={{ textAlign: "center" }}>
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="manifest-footer">
              <div>
                <strong>Total Amount:</strong> {formatRupees(order.total_paise)}
              </div>
              <div>
                <strong>Payment:</strong> {order.payment_status.toUpperCase()}
              </div>
            </div>
          </section>

          {/* Timeline */}
          {events && events.length > 0 && (
            <section className="dispatch-card">
              <h2 className="card-heading">
                <Clock size={18} aria-hidden="true" />
                <span>Transition History</span>
              </h2>
              <ol className="mini-timeline">
                {events.map((ev) => (
                  <li key={ev.id} className="mini-timeline-item">
                    <span className="ev-time">
                      {new Date(ev.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="ev-status">
                      {ev.from_status} → {ev.to_status}
                    </span>
                    <span className="ev-actor">({ev.actor})</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      <style jsx>{`
        .dispatch-module-root {
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

        .dispatch-header {
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

        .dispatch-title {
          font-size: clamp(24px, 3vw, 32px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .dispatch-subtitle {
          font-size: 13px;
          color: #6a6e64;
          margin: 4px 0 0;
        }

        .dispatch-actions {
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

        .dispatch-card {
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

        .pipeline-card {
          border-left: 4px solid var(--pine, #23483a);
        }

        .pipeline-steps {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 20px 0;
          flex-wrap: wrap;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          text-align: center;
          flex: 1;
          min-width: 90px;
        }

        .step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          background: #ede9df;
          color: #555850;
          border: 2px solid #d9d4c8;
        }

        .step-completed .step-circle {
          background: var(--pine, #23483a);
          color: #ffffff;
          border-color: var(--pine, #23483a);
        }

        .step-active .step-circle {
          background: #ffffff;
          color: var(--pine, #23483a);
          border-color: var(--pine, #23483a);
          box-shadow: 0 0 0 3px rgba(35, 72, 58, 0.2);
        }

        .step-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
        }

        .step-sub {
          font-size: 11px;
          color: #7b8075;
        }

        .step-line {
          height: 2px;
          flex: 1;
          background: #d9d4c8;
          min-width: 20px;
          margin-bottom: 24px;
        }

        .pipeline-actions-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .pipeline-action-btn {
          font-size: 14px;
          padding: 10px 18px;
          background: var(--pine, #23483a);
          color: #ffffff;
        }

        .warning-note {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--amber, #b36b3d);
          margin: 0;
        }

        .cancelled-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #fdf2f2;
          color: #8f2f2a;
          border-radius: 6px;
          font-size: 13px;
        }

        .dispatch-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          align-items: start;
        }

        .dispatch-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          margin-bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: #485347;
        }

        .form-select,
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

        .tracking-link-preview {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--pine, #23483a);
          text-decoration: underline;
          margin-top: 2px;
        }

        .address-box {
          background: #ede9df;
          padding: 14px;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.6;
        }

        .address-text {
          margin-top: 6px;
          white-space: pre-wrap;
        }

        .manifest-intro {
          font-size: 12px;
          color: #6a6e64;
          margin-bottom: 10px;
        }

        .manifest-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 14px;
        }

        .manifest-table th,
        .manifest-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #ede9df;
        }

        .manifest-footer {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          border-top: 1px solid var(--admin-border, #d9d4c8);
          padding-top: 10px;
          color: #485347;
        }

        .mini-timeline {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12px;
        }

        .mini-timeline-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #555850;
        }

        .ev-time {
          font-family: monospace;
          color: #7b8075;
        }

        .ev-status {
          font-weight: 600;
          color: var(--forest, #1d2a24);
        }

        .ev-actor {
          font-size: 11px;
          color: #8c9085;
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

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
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

        @media print {
          body * {
            visibility: hidden;
          }
          #packing-manifest, #packing-manifest * {
            visibility: visible;
          }
          #packing-manifest {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            background: #ffffff;
          }
        }

        @media (max-width: 800px) {
          .dispatch-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
