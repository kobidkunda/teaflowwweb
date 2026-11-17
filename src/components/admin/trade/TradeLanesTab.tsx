"use client";

import React, { useMemo, useState } from "react";
import { Calculator, Copy, Pause, Play, Search, Truck } from "lucide-react";
import {
  formatRupees,
  type AdminTradePayload,
  type StatusToast,
} from "./types";

interface TradeLanesTabProps {
  data: AdminTradePayload;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

type QuotePreviewParsed = {
  kind?: string;
  id?: string;
  serviceLabel?: string;
  laneId?: string;
  laneVersion?: number;
  etaLabel?: string;
  billedGrams?: number;
  netGrams?: number;
  goodsPaise?: number;
  freightPaise?: number;
  extraTaxPaise?: number;
  otherFeesPaise?: number;
  totalPaise?: number;
  dueNowPaise?: number;
  dueLaterPaise?: number;
  reason?: string;
  handover?: {
    kind: string;
    locality?: string;
    name?: string;
    address?: string;
  };
  error?: string;
};

export function TradeLanesTab({ data, onSaved, onError }: TradeLanesTabProps) {
  const [laneCode, setLaneCode] = useState("NEW-LANE");
  const [pinStart, setPinStart] = useState("734001");
  const [pinEnd, setPinEnd] = useState("734099");
  const [serviceCode, setServiceCode] = useState("surface_doorstep");
  const [serviceLabel, setServiceLabel] = useState("Local Doorstep");
  const [handoverKind, setHandoverKind] = useState<"doorstep" | "depot">(
    "doorstep"
  );
  const [localityLabel, setLocalityLabel] = useState("Siliguri");
  const [depotName, setDepotName] = useState("");
  const [depotAddress, setDepotAddress] = useState("");
  const [onwardIncluded, setOnwardIncluded] = useState(false);
  const [baseFreightPaise, setBaseFreightPaise] = useState("90000");
  const [perKgFreightPaise, setPerKgFreightPaise] = useState("0");
  const [lastMilePaise, setLastMilePaise] = useState("0");
  const [extraTaxBps, setExtraTaxBps] = useState("0");
  const [otherFeesPaise, setOtherFeesPaise] = useState("0");
  const [tareGrams, setTareGrams] = useState("600");
  const [dimDivisor, setDimDivisor] = useState("5000");
  const [billingIncGrams, setBillingIncGrams] = useState("1000");
  const [maxNetGrams, setMaxNetGrams] = useState("30000");
  const [maxBilledGrams, setMaxBilledGrams] = useState("30000");
  const [etaLabel, setEtaLabel] = useState("2-4 business days");
  const [operatorName, setOperatorName] = useState("");
  const [codAllowed, setCodAllowed] = useState(true);
  const [codFeePaise, setCodFeePaise] = useState("9000");
  const [codMaxTotalPaise, setCodMaxTotalPaise] = useState("");
  const [advanceAllowed, setAdvanceAllowed] = useState(true);
  const [savingLane, setSavingLane] = useState(false);

  // PIN simulator state
  const [previewPin, setPreviewPin] = useState("734001");
  const [previewVariantId, setPreviewVariantId] = useState<string>(() =>
    data.catalog.variants[0] ? String(data.catalog.variants[0].id) : ""
  );
  const [previewQty, setPreviewQty] = useState("1");
  const [previewPayment, setPreviewPayment] = useState<
    "prepaid" | "cod" | "freight_advance"
  >("prepaid");
  const [previewing, setPreviewing] = useState(false);
  const [previewRaw, setPreviewRaw] = useState<string | null>(null);
  const [previewParsed, setPreviewParsed] =
    useState<QuotePreviewParsed | null>(null);

  // Lanes filter
  const [laneSearch, setLaneSearch] = useState("");

  const filteredLanes = useMemo(() => {
    const q = laneSearch.trim().toLowerCase();
    if (!q) return data.lanes;
    return data.lanes.filter((l) => {
      const text = [
        l.lane_code,
        l.pin_start,
        l.pin_end,
        l.locality_label,
        l.service_label,
      ]
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [data.lanes, laneSearch]);

  function cloneLaneToForm(l: Record<string, unknown>) {
    setLaneCode(String(l.lane_code ?? "NEW-LANE"));
    setPinStart(String(l.pin_start ?? "734001"));
    setPinEnd(String(l.pin_end ?? "734099"));
    setServiceCode(String(l.service_code ?? "surface_doorstep"));
    setServiceLabel(String(l.service_label ?? "Local Doorstep"));
    setHandoverKind(
      String(l.handover_kind) === "depot" ? "depot" : "doorstep"
    );
    setLocalityLabel(String(l.locality_label ?? ""));
    setDepotName(l.depot_name ? String(l.depot_name) : "");
    setDepotAddress(l.depot_address ? String(l.depot_address) : "");
    setOnwardIncluded(Boolean(l.onward_included));
    setBaseFreightPaise(String(l.base_freight_paise ?? 0));
    setPerKgFreightPaise(String(l.per_kg_freight_paise ?? 0));
    setLastMilePaise(String(l.last_mile_paise ?? 0));
    setExtraTaxBps(String(l.extra_tax_bps ?? 0));
    setOtherFeesPaise(String(l.other_fees_paise ?? 0));
    setTareGrams(String(l.tare_grams ?? 600));
    setDimDivisor(String(l.dim_divisor ?? 5000));
    setBillingIncGrams(String(l.billing_increment_grams ?? 1000));
    setMaxNetGrams(String(l.max_net_grams ?? 30000));
    setMaxBilledGrams(String(l.max_billed_grams ?? 30000));
    setEtaLabel(String(l.eta_label ?? "2-4 business days"));
    setOperatorName(l.operator_name ? String(l.operator_name) : "");
    setCodAllowed(Boolean(l.cod_allowed));
    setCodFeePaise(String(l.cod_fee_paise ?? 0));
    setCodMaxTotalPaise(
      l.cod_max_total_paise ? String(l.cod_max_total_paise) : ""
    );
    setAdvanceAllowed(Boolean(l.freight_advance_allowed));
  }

  async function saveLane(e: React.FormEvent) {
    e.preventDefault();
    setSavingLane(true);
    try {
      const res = await fetch("/api/admin/trade/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lane_code: laneCode,
          is_active: true,
          pin_start: pinStart,
          pin_end: pinEnd,
          service_code: serviceCode,
          service_label: serviceLabel,
          handover_kind: handoverKind,
          locality_label: localityLabel,
          depot_name: handoverKind === "depot" ? depotName : null,
          depot_address: handoverKind === "depot" ? depotAddress : null,
          onward_included: onwardIncluded,
          base_freight_paise: Number(baseFreightPaise) || 0,
          per_kg_freight_paise: Number(perKgFreightPaise) || 0,
          last_mile_paise: Number(lastMilePaise) || 0,
          extra_tax_bps: Number(extraTaxBps) || 0,
          other_fees_paise: Number(otherFeesPaise) || 0,
          tare_grams: Number(tareGrams) || 600,
          dim_divisor: Number(dimDivisor) || 5000,
          billing_increment_grams: Number(billingIncGrams) || 1000,
          max_net_grams: Number(maxNetGrams) || 30000,
          max_billed_grams: Number(maxBilledGrams) || 30000,
          eta_label: etaLabel,
          operator_name: operatorName || null,
          cod_allowed: codAllowed,
          cod_fee_paise: Number(codFeePaise) || 0,
          cod_max_total_paise: codMaxTotalPaise
            ? Number(codMaxTotalPaise)
            : null,
          freight_advance_allowed: advanceAllowed,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(json.error || "Failed to publish lane version.");
        return;
      }
      await onSaved({ kind: "ok", text: "Versioned lane saved." });
    } catch {
      onError("Network error while saving lane.");
    } finally {
      setSavingLane(false);
    }
  }

  async function runPreviewQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!previewVariantId) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/trade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "trade",
          quoteType: "bulk",
          locale: "en",
          destinationPin: previewPin,
          lines: [
            {
              variantId: Number(previewVariantId),
              quantity: Math.max(1, Number(previewQty) || 1),
            },
          ],
          payment: previewPayment,
        }),
      });
      const json = (await res.json()) as QuotePreviewParsed;
      setPreviewParsed(json);
      setPreviewRaw(JSON.stringify(json, null, 2));
    } catch {
      onError("Could not run quote simulation.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="tf-trade-stack">
      {/* First <form>: Create Versioned Lane (note: first <input> is Lane Code) */}
      <form
        onSubmit={saveLane}
        aria-labelledby="trade-lane-form-heading"
        className="tf-trade-card tf-trade-stack"
      >
        <div className="tf-trade-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 id="trade-lane-form-heading" className="tf-trade-card-title">
              <Truck size={18} aria-hidden="true" />
              <span>Create Versioned Lane</span>
            </h2>
            <p className="tf-trade-card-desc">
              Each save publishes a new immutable version of the lane code so existing quotes stay reproducible.
            </p>
          </div>
        </div>

        <fieldset className="tf-trade-fieldset">
          <legend className="tf-trade-legend">Route &amp; Handover</legend>
          <div className="tf-trade-grid-3">
            <div className="tf-trade-field">
              <label htmlFor="lane-code" className="tf-trade-label">
                Lane Code
              </label>
              <input
                id="lane-code"
                type="text"
                className="tf-trade-input"
                value={laneCode}
                onChange={(e) => setLaneCode(e.target.value)}
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-pin-start" className="tf-trade-label">
                PIN Start
              </label>
              <input
                id="lane-pin-start"
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]{5}"
                className="tf-trade-input"
                value={pinStart}
                onChange={(e) => setPinStart(e.target.value)}
                required
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-pin-end" className="tf-trade-label">
                PIN End
              </label>
              <input
                id="lane-pin-end"
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]{5}"
                className="tf-trade-input"
                value={pinEnd}
                onChange={(e) => setPinEnd(e.target.value)}
                required
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-service-code" className="tf-trade-label">
                Service Code
              </label>
              <input
                id="lane-service-code"
                type="text"
                className="tf-trade-input"
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-service-label" className="tf-trade-label">
                Service Label
              </label>
              <input
                id="lane-service-label"
                type="text"
                className="tf-trade-input"
                value={serviceLabel}
                onChange={(e) => setServiceLabel(e.target.value)}
                required
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-handover" className="tf-trade-label">
                Handover Mode
              </label>
              <select
                id="lane-handover"
                className="tf-trade-select"
                value={handoverKind}
                onChange={(e) =>
                  setHandoverKind(e.target.value as "doorstep" | "depot")
                }
              >
                <option value="doorstep">Doorstep delivery</option>
                <option value="depot">Transport depot pickup</option>
              </select>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-locality" className="tf-trade-label">
                Locality / Region Label
              </label>
              <input
                id="lane-locality"
                type="text"
                className="tf-trade-input"
                value={localityLabel}
                onChange={(e) => setLocalityLabel(e.target.value)}
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-eta" className="tf-trade-label">
                ETA Label
              </label>
              <input
                id="lane-eta"
                type="text"
                className="tf-trade-input"
                value={etaLabel}
                onChange={(e) => setEtaLabel(e.target.value)}
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-operator" className="tf-trade-label">
                Operator / Carrier
                <span className="tf-trade-optional-tag">Optional</span>
              </label>
              <input
                id="lane-operator"
                type="text"
                className="tf-trade-input"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
              />
            </div>
          </div>

          {handoverKind === "depot" ? (
            <div className="tf-trade-grid-2" style={{ marginTop: 14 }}>
              <div className="tf-trade-field">
                <label htmlFor="lane-depot-name" className="tf-trade-label">
                  Depot Name
                </label>
                <input
                  id="lane-depot-name"
                  type="text"
                  className="tf-trade-input"
                  value={depotName}
                  onChange={(e) => setDepotName(e.target.value)}
                />
              </div>
              <div className="tf-trade-field">
                <label htmlFor="lane-depot-address" className="tf-trade-label">
                  Depot Address
                </label>
                <input
                  id="lane-depot-address"
                  type="text"
                  className="tf-trade-input"
                  value={depotAddress}
                  onChange={(e) => setDepotAddress(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="tf-trade-fieldset">
          <legend className="tf-trade-legend">Freight &amp; Surcharges</legend>
          <div className="tf-trade-grid-4">
            <div className="tf-trade-field">
              <label htmlFor="lane-base-freight" className="tf-trade-label">
                Base Freight (paise)
              </label>
              <input
                id="lane-base-freight"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={baseFreightPaise}
                onChange={(e) => setBaseFreightPaise(e.target.value)}
              />
              <span className="tf-trade-help">
                <span className="tf-trade-money-hint">
                  {formatRupees(baseFreightPaise)}
                </span>
              </span>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-per-kg" className="tf-trade-label">
                Per-kg Freight (paise)
              </label>
              <input
                id="lane-per-kg"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={perKgFreightPaise}
                onChange={(e) => setPerKgFreightPaise(e.target.value)}
              />
              <span className="tf-trade-help">
                <span className="tf-trade-money-hint">
                  {formatRupees(perKgFreightPaise)}
                </span>{" "}
                / kg
              </span>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-last-mile" className="tf-trade-label">
                Last-mile (paise)
              </label>
              <input
                id="lane-last-mile"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={lastMilePaise}
                onChange={(e) => setLastMilePaise(e.target.value)}
              />
              <span className="tf-trade-help">
                <span className="tf-trade-money-hint">
                  {formatRupees(lastMilePaise)}
                </span>
              </span>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-extra-tax" className="tf-trade-label">
                Extra Tax (bps)
              </label>
              <input
                id="lane-extra-tax"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={extraTaxBps}
                onChange={(e) => setExtraTaxBps(e.target.value)}
              />
              <span className="tf-trade-help">
                {(Number(extraTaxBps || 0) / 100).toFixed(2)}%
              </span>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-other-fees" className="tf-trade-label">
                Other Fees (paise)
              </label>
              <input
                id="lane-other-fees"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={otherFeesPaise}
                onChange={(e) => setOtherFeesPaise(e.target.value)}
              />
              <span className="tf-trade-help">
                <span className="tf-trade-money-hint">
                  {formatRupees(otherFeesPaise)}
                </span>
              </span>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-cod-fee" className="tf-trade-label">
                COD Fee (paise)
              </label>
              <input
                id="lane-cod-fee"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={codFeePaise}
                onChange={(e) => setCodFeePaise(e.target.value)}
              />
              <span className="tf-trade-help">
                <span className="tf-trade-money-hint">
                  {formatRupees(codFeePaise)}
                </span>
              </span>
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-cod-max" className="tf-trade-label">
                COD Max Total (paise)
              </label>
              <input
                id="lane-cod-max"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="No limit"
                className="tf-trade-input"
                value={codMaxTotalPaise}
                onChange={(e) => setCodMaxTotalPaise(e.target.value)}
              />
              <span className="tf-trade-help">
                {codMaxTotalPaise ? formatRupees(codMaxTotalPaise) : "Optional cap"}
              </span>
            </div>
          </div>
        </fieldset>

        <fieldset className="tf-trade-fieldset">
          <legend className="tf-trade-legend">
            Weight Slabs &amp; Payment Rules
          </legend>
          <div className="tf-trade-grid-4">
            <div className="tf-trade-field">
              <label htmlFor="lane-tare" className="tf-trade-label">
                Tare (g)
              </label>
              <input
                id="lane-tare"
                type="number"
                min={0}
                inputMode="numeric"
                className="tf-trade-input"
                value={tareGrams}
                onChange={(e) => setTareGrams(e.target.value)}
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-dim" className="tf-trade-label">
                Dim Divisor
              </label>
              <input
                id="lane-dim"
                type="number"
                min={1000}
                inputMode="numeric"
                className="tf-trade-input"
                value={dimDivisor}
                onChange={(e) => setDimDivisor(e.target.value)}
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-billing-inc" className="tf-trade-label">
                Billing Increment (g)
              </label>
              <input
                id="lane-billing-inc"
                type="number"
                min={100}
                inputMode="numeric"
                className="tf-trade-input"
                value={billingIncGrams}
                onChange={(e) => setBillingIncGrams(e.target.value)}
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-max-net" className="tf-trade-label">
                Max Net (g)
              </label>
              <input
                id="lane-max-net"
                type="number"
                min={100}
                inputMode="numeric"
                className="tf-trade-input"
                value={maxNetGrams}
                onChange={(e) => setMaxNetGrams(e.target.value)}
              />
            </div>

            <div className="tf-trade-field">
              <label htmlFor="lane-max-billed" className="tf-trade-label">
                Max Billed (g)
              </label>
              <input
                id="lane-max-billed"
                type="number"
                min={100}
                inputMode="numeric"
                className="tf-trade-input"
                value={maxBilledGrams}
                onChange={(e) => setMaxBilledGrams(e.target.value)}
              />
            </div>
          </div>

          <div className="tf-trade-chip-grid" style={{ marginTop: 14 }}>
            <label className="tf-trade-check-pill">
              <input
                type="checkbox"
                checked={codAllowed}
                onChange={(e) => setCodAllowed(e.target.checked)}
              />
              <span>COD Allowed</span>
            </label>
            <label className="tf-trade-check-pill">
              <input
                type="checkbox"
                checked={advanceAllowed}
                onChange={(e) => setAdvanceAllowed(e.target.checked)}
              />
              <span>Freight Advance Allowed</span>
            </label>
            <label className="tf-trade-check-pill">
              <input
                type="checkbox"
                checked={onwardIncluded}
                onChange={(e) => setOnwardIncluded(e.target.checked)}
              />
              <span>Onward Included (Depot)</span>
            </label>
          </div>
        </fieldset>

        <div className="tf-trade-form-actions">
          <button
            type="submit"
            className="tf-trade-btn tf-trade-btn--primary"
            disabled={savingLane}
          >
            <Truck size={16} aria-hidden="true" />
            <span>
              {savingLane ? "Publishing…" : "Publish New Lane Version"}
            </span>
          </button>
        </div>
      </form>

      {/* PIN Quote Simulator */}
      <form
        onSubmit={runPreviewQuote}
        aria-labelledby="trade-quote-sim-heading"
        className="tf-trade-card"
      >
        <div className="tf-trade-card-header" style={{ marginBottom: 14 }}>
          <div>
            <h2 id="trade-quote-sim-heading" className="tf-trade-card-title">
              <Calculator size={18} aria-hidden="true" />
              <span>Preview PIN Quote Simulator</span>
            </h2>
            <p className="tf-trade-card-desc">
              Test live server freight pricing and handover resolution against any 6-digit Indian PIN.
            </p>
          </div>
        </div>

        <div className="tf-trade-grid-4" style={{ alignItems: "end" }}>
          <div className="tf-trade-field">
            <label htmlFor="sim-pin" className="tf-trade-label">
              Destination PIN
            </label>
            <input
              id="sim-pin"
              type="text"
              inputMode="numeric"
              pattern="[1-9][0-9]{5}"
              className="tf-trade-input"
              value={previewPin}
              onChange={(e) => setPreviewPin(e.target.value)}
              required
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="sim-variant" className="tf-trade-label">
              Pack Variant
            </label>
            <select
              id="sim-variant"
              className="tf-trade-select"
              value={previewVariantId}
              onChange={(e) => setPreviewVariantId(e.target.value)}
            >
              {data.catalog.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  #{v.id} · {v.sku} ({v.grams / 1000} kg)
                </option>
              ))}
            </select>
          </div>

          <div className="tf-trade-field">
            <label htmlFor="sim-qty" className="tf-trade-label">
              Quantity
            </label>
            <input
              id="sim-qty"
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              className="tf-trade-input"
              value={previewQty}
              onChange={(e) => setPreviewQty(e.target.value)}
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="sim-payment" className="tf-trade-label">
              Payment Mode
            </label>
            <select
              id="sim-payment"
              className="tf-trade-select"
              value={previewPayment}
              onChange={(e) =>
                setPreviewPayment(
                  e.target.value as "prepaid" | "cod" | "freight_advance"
                )
              }
            >
              <option value="prepaid">Prepaid</option>
              <option value="cod">Cash on Delivery</option>
              <option value="freight_advance">Freight Advance</option>
            </select>
          </div>
        </div>

        <div className="tf-trade-form-actions" style={{ marginTop: 12 }}>
          <button
            type="submit"
            className="tf-trade-btn tf-trade-btn--primary"
            disabled={previewing}
          >
            <Calculator size={15} aria-hidden="true" />
            <span>{previewing ? "Calculating…" : "Test Quote"}</span>
          </button>
        </div>

        {previewParsed ? (
          <div
            className={`tf-trade-quote-card ${
              previewParsed.kind !== "confirmed" ? "is-manual" : ""
            }`}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className={`tf-badge ${
                    previewParsed.kind === "confirmed"
                      ? "tf-badge--ok"
                      : "tf-badge--warn"
                  }`}
                >
                  {previewParsed.kind ?? "response"}
                </span>
                {previewParsed.serviceLabel ? (
                  <strong>{previewParsed.serviceLabel}</strong>
                ) : null}
                {previewParsed.handover ? (
                  <span className="tf-trade-help">
                    {previewParsed.handover.kind === "depot"
                      ? `Depot: ${previewParsed.handover.name}`
                      : `Doorstep: ${previewParsed.handover.locality}`}
                  </span>
                ) : null}
              </div>
              {previewParsed.etaLabel ? (
                <span className="tf-badge tf-badge--info">
                  ETA: {previewParsed.etaLabel}
                </span>
              ) : null}
            </div>

            {previewParsed.kind === "confirmed" ? (
              <div className="tf-trade-quote-grid">
                <div className="tf-trade-quote-stat">
                  <span>Goods</span>
                  <strong>{formatRupees(previewParsed.goodsPaise)}</strong>
                </div>
                <div className="tf-trade-quote-stat">
                  <span>Freight</span>
                  <strong>{formatRupees(previewParsed.freightPaise)}</strong>
                </div>
                <div className="tf-trade-quote-stat">
                  <span>Total</span>
                  <strong>{formatRupees(previewParsed.totalPaise)}</strong>
                </div>
                <div className="tf-trade-quote-stat">
                  <span>Due Now / Later</span>
                  <strong>
                    {formatRupees(previewParsed.dueNowPaise)} /{" "}
                    {formatRupees(previewParsed.dueLaterPaise)}
                  </strong>
                </div>
                <div className="tf-trade-quote-stat">
                  <span>Billed Weight</span>
                  <strong>
                    {((previewParsed.billedGrams ?? 0) / 1000).toFixed(1)} kg
                  </strong>
                </div>
              </div>
            ) : (
              <p className="tf-trade-help" style={{ marginTop: 8 }}>
                Reason: {previewParsed.reason || previewParsed.error || "Manual handling required."}
              </p>
            )}

            {previewRaw ? (
              <details style={{ marginTop: 12 }}>
                <summary
                  style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
                >
                  Inspect raw quote JSON
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 8,
                    background: "#ffffff",
                    border: "1px solid #d9d4c8",
                    fontSize: 12,
                    overflowX: "auto",
                  }}
                >
                  {previewRaw}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </form>

      {/* Lanes Search Toolbar */}
      <search className="tf-trade-toolbar">
        <div className="tf-trade-toolbar-group">
          <div className="tf-trade-search-wrap">
            <Search size={15} className="tf-trade-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="tf-trade-input tf-trade-search-input"
              aria-label="Filter freight lanes"
              placeholder="Filter by lane code, PIN, or locality…"
              value={laneSearch}
              onChange={(e) => setLaneSearch(e.target.value)}
            />
          </div>
          <span className="tf-trade-help">
            Showing {filteredLanes.length} of {data.lanes.length} lanes
          </span>
        </div>
      </search>

      {/* Lanes Table */}
      <div className="tf-trade-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="trade-lanes-table-caption"
          className="tf-trade-table-wrap"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="tf-trade-table">
            <caption id="trade-lanes-table-caption">
              Versioned freight lanes
            </caption>
            <thead>
              <tr>
                <th scope="col">Code (Ver)</th>
                <th scope="col">PIN Range &amp; Locality</th>
                <th scope="col">Handover &amp; ETA</th>
                <th scope="col">Freight</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLanes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-trade-empty">
                    No matching lanes found.
                  </td>
                </tr>
              ) : (
                filteredLanes.map((l) => (
                  <tr key={String(l.id)}>
                    <th scope="row">
                      {String(l.lane_code)} (v{String(l.version)})
                    </th>
                    <td data-label="PIN Range">
                      <div>
                        {String(l.pin_start)} – {String(l.pin_end)}
                      </div>
                      {l.locality_label ? (
                        <div className="tf-trade-help">
                          {String(l.locality_label)}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Handover">
                      <span className="tf-badge">
                        {String(l.handover_kind)}
                      </span>
                      <div className="tf-trade-help" style={{ marginTop: 4 }}>
                        {String(l.eta_label ?? "")}
                      </div>
                    </td>
                    <td data-label="Freight">
                      <div>{formatRupees(Number(l.base_freight_paise))} base</div>
                      {Number(l.per_kg_freight_paise) > 0 ? (
                        <div className="tf-trade-help">
                          + {formatRupees(Number(l.per_kg_freight_paise))}/kg
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`tf-badge ${
                          l.is_active ? "tf-badge--ok" : "tf-badge--warn"
                        }`}
                      >
                        {l.is_active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="tf-trade-row-actions">
                        <button
                          type="button"
                          className="tf-trade-btn tf-trade-btn--sm"
                          onClick={() => cloneLaneToForm(l)}
                        >
                          <Copy size={13} aria-hidden="true" />
                          <span>Clone</span>
                        </button>
                        <button
                          type="button"
                          className="tf-trade-btn tf-trade-btn--sm"
                          onClick={async () => {
                            const res = await fetch("/api/admin/trade/lanes", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              credentials: "same-origin",
                              body: JSON.stringify({
                                id: l.id,
                                is_active: !Boolean(l.is_active),
                              }),
                            });
                            if (!res.ok) {
                              onError("Failed to toggle lane status.");
                              return;
                            }
                            await onSaved({
                              kind: "ok",
                              text: `Lane ${String(l.lane_code)} ${
                                l.is_active ? "paused" : "activated"
                              }.`,
                            });
                          }}
                        >
                          {l.is_active ? (
                            <>
                              <Pause size={13} aria-hidden="true" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play size={13} aria-hidden="true" />
                              <span>Activate</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
