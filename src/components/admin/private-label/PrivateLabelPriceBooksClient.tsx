"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Calculator,
  Sliders,
} from "lucide-react";

interface PriceBook {
  id: string;
  name: string;
  currency: string;
  is_default: number;
  margin_rate: number;
  filling_labor_paise_per_unit: number;
  qc_charge_paise_per_batch: number;
  contingency_rate: number;
  loss_allowance_rate: number;
  status: "draft" | "active" | "archived";
  revision: number;
  tier_count?: number;
  tiers?: PriceBookTier[];
}

interface PriceBookTier {
  id: string;
  item_type: "packaging" | "print_method" | "tea_markup";
  item_id: string;
  min_qty: number;
  max_qty: number | null;
  unit_price_paise: number;
}

export function PrivateLabelPriceBooksClient() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<PriceBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulator State
  const [simUnits, setSimUnits] = useState(1000);
  const [simTeaCostKg, setSimTeaCostKg] = useState(2500); // ₹25.00/kg
  const [simPackCost, setSimPackCost] = useState(1500); // ₹15.00/unit
  const [simNetWeight, setSimNetWeight] = useState(100); // 100g

  const fetchPriceBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/private-label/price-books");
      const data = await res.json();
      const list: PriceBook[] = data.priceBooks || [];
      setPriceBooks(list);
      if (list.length > 0 && !selectedBook) {
        // Fetch detail of default or first book
        const def = list.find((b) => b.is_default === 1) || list[0];
        fetchBookDetail(def.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching price books");
    } finally {
      setLoading(false);
    }
  }, [selectedBook]);

  const fetchBookDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/admin/private-label/price-books/${id}`);
      const data = await res.json();
      setSelectedBook(data.priceBook || data);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    void fetchPriceBooks();
  }, [fetchPriceBooks]);

  // Simulation calculations using active price book parameters
  const marginRate = selectedBook ? selectedBook.margin_rate : 0.25;
  const laborPaise = selectedBook ? selectedBook.filling_labor_paise_per_unit : 300;
  const qcBatchPaise = selectedBook ? selectedBook.qc_charge_paise_per_batch : 250000;
  const lossRate = selectedBook ? selectedBook.loss_allowance_rate : 0.03;

  const totalTeaKg = (simUnits * simNetWeight) / 1000;
  const teaCostPaise = Math.round(totalTeaKg * (simTeaCostKg * 100) * (1 + lossRate));
  const packCostPaise = simUnits * simPackCost;
  const laborCostPaise = simUnits * laborPaise;
  const subtotalPaise = teaCostPaise + packCostPaise + laborCostPaise + qcBatchPaise;
  const marginPaise = Math.round(subtotalPaise * marginRate);
  const teaGst = Math.round(teaCostPaise * 0.05);
  const nonTeaGst = Math.round((subtotalPaise - teaCostPaise + marginPaise) * 0.18);
  const grandTotalPaise = subtotalPaise + marginPaise + teaGst + nonTeaGst;
  const unitPricePaise = Math.round(grandTotalPaise / simUnits);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6a6e64", fontWeight: 600 }}>
            Private Label Studio
          </span>
          <h1 style={{ margin: "4px 0", fontSize: 28, fontWeight: 700, color: "var(--forest, #1d2a24)", fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Price Books &amp; MOQs
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555850" }}>
            Configure commercial margin multipliers, cleanroom labor rates, quantity tier brackets, and simulate quote economics.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void fetchPriceBooks()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d9d4c8",
              background: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Price Book Selector & Active Status */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#1d2a24" }}>Select Active Price Book:</label>
        <select
          value={selectedBook?.id || ""}
          onChange={(e) => fetchBookDetail(e.target.value)}
          style={{
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 6,
            border: "1px solid #d9d4c8",
            background: "#ffffff",
            minWidth: 260,
          }}
        >
          {priceBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.currency}) {b.is_default ? "★ Default" : ""}
            </option>
          ))}
        </select>

        {selectedBook && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: selectedBook.status === "active" ? "#e8f5e9" : "#fff8e1",
              color: selectedBook.status === "active" ? "#1b5e20" : "#8d6000",
            }}
          >
            Status: {selectedBook.status.toUpperCase()} · Revision: v{selectedBook.revision}
          </span>
        )}
      </div>

      {/* Multiplier Cards */}
      {selectedBook && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Commercial Margin</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
              {(selectedBook.margin_rate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Multiplier on subtotal</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Cleanroom Labor</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
              ₹{(selectedBook.filling_labor_paise_per_unit / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Per unit filled &amp; sealed</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Batch QC Inspection</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
              ₹{(selectedBook.qc_charge_paise_per_batch / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Cupping &amp; seal test fee</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Loss &amp; Sifting Allowance</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2a24", marginTop: 4 }}>
              {(selectedBook.loss_allowance_rate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Covers cleanroom handling loss</div>
          </div>
        </div>
      )}

      {/* Simulator Playground */}
      <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 24, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Calculator size={20} color="#23483a" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
            Live MOQ &amp; Quotation Calculation Simulator
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
              Production Run Units:
            </label>
            <input
              type="number"
              min={100}
              step={100}
              value={simUnits}
              onChange={(e) => setSimUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d9d4c8" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
              Net Weight (grams):
            </label>
            <input
              type="number"
              min={10}
              step={10}
              value={simNetWeight}
              onChange={(e) => setSimNetWeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d9d4c8" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
              Base Tea Cost (₹/kg):
            </label>
            <input
              type="number"
              min={100}
              step={100}
              value={simTeaCostKg}
              onChange={(e) => setSimTeaCostKg(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d9d4c8" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
              Packaging Unit Cost (paise):
            </label>
            <input
              type="number"
              min={100}
              step={50}
              value={simPackCost}
              onChange={(e) => setSimPackCost(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d9d4c8" }}
            />
          </div>
        </div>

        {/* Simulator Outputs */}
        <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: 6, padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <span style={{ fontSize: 12, color: "#666" }}>Total Bulk Tea Required:</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>{totalTeaKg.toFixed(1)} kg</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#666" }}>Tea Subtotal (5% GST):</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>₹{(teaCostPaise / 100).toFixed(2)}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#666" }}>Packaging Subtotal:</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>₹{(packCostPaise / 100).toFixed(2)}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#666" }}>Cleanroom Labor:</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>₹{(laborCostPaise / 100).toFixed(2)}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#666" }}>GST (Dual Rate 5%/18%):</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2a24" }}>₹{((teaGst + nonTeaGst) / 100).toFixed(2)}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "#666" }}>Estimated Unit Price:</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#23483a" }}>₹{(unitPricePaise / 100).toFixed(2)} / unit</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
