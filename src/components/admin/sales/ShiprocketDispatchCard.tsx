"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Package,
  Printer,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  ShieldCheck,
  Zap,
} from "lucide-react";

export type ShiprocketShipmentView = {
  orderId: string;
  status: string;
  shiprocketOrderId?: number | string;
  shipmentId?: number | string;
  courierId?: string | number;
  awbCode?: string;
  courierName?: string;
  labelUrl?: string;
  pickupToken?: string;
  pickupDate?: string;
  publicTracking?: {
    code: string;
    status: string;
  };
  updatedAt?: number;
};

export function ShiprocketDispatchCard({
  orderId,
  paymentStatus,
  dispatchStatus,
  onStatusUpdated,
}: {
  orderId: string;
  paymentStatus: string;
  dispatchStatus: string;
  onStatusUpdated?: () => void;
}) {
  const [shipment, setShipment] = useState<ShiprocketShipmentView | null>(null);
  const [mode, setMode] = useState<string>("test");
  const [orderCreationMode, setOrderCreationMode] = useState<string>("manual");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchShipment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`);
      if (res.ok) {
        const data = await res.json();
        setShipment(data.shipment || null);
        if (data.mode) setMode(data.mode);
        if (data.orderCreationMode) setOrderCreationMode(data.orderCreationMode);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchShipment();
  }, [orderId]);

  const handleAction = async (action: string) => {
    setActing(true);
    setError(null);
    setSuccessToast(null);

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/shiprocket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      setSuccessToast(
        action === "prepare_full"
          ? "Shiprocket order, AWB, and carrier label generated successfully!"
          : "Action completed."
      );
      await fetchShipment();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Shiprocket dispatch failed.");
    } finally {
      setActing(false);
    }
  };

  const isPaidOrCod = ["paid", "partially_refunded", "cod", "cod_due", "cod_collected", "cod_remitted"].includes(
    paymentStatus.toLowerCase()
  );

  return (
    <div
      className="shiprocket-dispatch-card"
      style={{
        background: "#ffffff",
        border: "1px solid #dcd7cb",
        borderRadius: "10px",
        padding: "20px",
        marginTop: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "6px", borderRadius: "6px", color: "#23483a" }}>
            <Truck size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1d2a24" }}>
              Shiprocket Logistics Dispatch
            </h3>
            <span style={{ fontSize: "12px", color: "#666" }}>Carrier preparation, AWB & label automation</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              background: mode === "production" ? "#eef6f0" : "#fff8e6",
              color: mode === "production" ? "#1e5e34" : "#92400e",
              border: `1px solid ${mode === "production" ? "#c7e6d0" : "#fde68a"}`,
            }}
          >
            {mode === "production" ? "LIVE SHIPROCKET" : "SANDBOX TEST"}
          </span>

          {shipment?.awbCode && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                background: "#eef6f0",
                color: "#1e5e34",
              }}
            >
              AWB: {shipment.awbCode}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            background: "#fdf2f2",
            color: "#b91c1c",
            borderRadius: "6px",
            fontSize: "13px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {successToast && (
        <div
          role="status"
          style={{
            padding: "8px 12px",
            background: "#eef6f0",
            color: "#1e5e34",
            borderRadius: "6px",
            fontSize: "13px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <CheckCircle2 size={15} />
          <span>{successToast}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "16px 0", textAlign: "center", color: "#666", fontSize: "13px" }}>
          <RefreshCw className="spin" size={16} style={{ display: "inline", marginRight: "6px" }} />
          Checking Shiprocket state...
        </div>
      ) : !shipment?.shipmentId ? (
        /* CASE 1: NOT PREPARED IN SHIPROCKET YET */
        <div>
          <p style={{ fontSize: "13px", color: "#555", margin: "0 0 14px 0", lineHeight: "1.4" }}>
            This order has not been booked on Shiprocket yet. Click below to automatically create the order, assign the carrier, generate the printable shipping label, and schedule warehouse pickup in 1 click.
          </p>

          <button
            type="button"
            disabled={acting || !isPaidOrCod}
            onClick={() => handleAction("prepare_full")}
            className="button button-primary"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              background: isPaidOrCod ? "#23483a" : "#ccc",
              cursor: isPaidOrCod ? "pointer" : "not-allowed",
            }}
          >
            {acting ? (
              <>
                <RefreshCw className="spin" size={16} />
                <span>Preparing in Shiprocket (Order + AWB + Label)...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Prepare Full Shiprocket Order & Label</span>
              </>
            )}
          </button>

          {!isPaidOrCod && (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#b91c1c" }}>
              ⚠️ Orders must reach &ldquo;paid&rdquo; or confirmed &ldquo;COD&rdquo; status before courier dispatch.
            </p>
          )}
        </div>
      ) : (
        /* CASE 2: PREPARED IN SHIPROCKET */
        <div>
          <div
            style={{
              background: "#f9f8f5",
              borderRadius: "8px",
              padding: "14px",
              marginBottom: "16px",
              border: "1px solid #ebe8df",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#777", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Shiprocket Order ID</span>
                <strong>#{shipment.shiprocketOrderId || shipment.orderId}</strong>
              </div>
              <div>
                <span style={{ color: "#777", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Shipment ID</span>
                <strong>#{shipment.shipmentId}</strong>
              </div>
              <div>
                <span style={{ color: "#777", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Courier Partner</span>
                <strong>{shipment.courierName || "Assigned"}</strong>
              </div>
              <div>
                <span style={{ color: "#777", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Tracking Number</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{shipment.awbCode || "Pending"}</span>
              </div>
            </div>

            {(shipment.pickupDate || shipment.pickupToken) && (
              <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #dcd7cb", fontSize: "12px", color: "#555", display: "flex", gap: "16px" }}>
                {shipment.pickupDate && <span>📅 Pickup: <strong>{shipment.pickupDate}</strong></span>}
                {shipment.pickupToken && <span>🎟️ Token: <strong>{shipment.pickupToken}</strong></span>}
              </div>
            )}

            {shipment.publicTracking?.status && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#1e5e34", fontWeight: 600 }}>
                📍 Latest Milestone: {shipment.publicTracking.status}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {shipment.labelUrl ? (
              <a
                href={shipment.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-primary"
                style={{
                  flex: "1 1 auto",
                  padding: "10px 16px",
                  fontSize: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "#1e5e34",
                  textDecoration: "none",
                  color: "#fff",
                  borderRadius: "6px",
                }}
              >
                <Printer size={16} />
                <span>Print Shipping Label (PDF)</span>
              </a>
            ) : (
              <button
                type="button"
                disabled={acting}
                onClick={() => handleAction("label")}
                className="button button-primary"
                style={{ flex: "1 1 auto", padding: "10px 16px", fontSize: "13px" }}
              >
                {acting ? "Generating..." : "Generate Shipping Label"}
              </button>
            )}

            <button
              type="button"
              disabled={acting}
              onClick={() => handleAction("track")}
              className="button button-outline"
              style={{ padding: "10px 14px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw className={acting ? "spin" : ""} size={14} />
              <span>Track Courier</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
