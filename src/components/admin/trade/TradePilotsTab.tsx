"use client";

import React, { useState } from "react";
import { MapPin, Pencil, Plus, RotateCcw } from "lucide-react";
import {
  formatDateTime,
  formatRupees,
  type AdminTradePayload,
  type StatusToast,
} from "./types";

interface TradePilotsTabProps {
  data: AdminTradePayload;
  onSaved: (toast: StatusToast) => Promise<void>;
  onError: (msg: string) => void;
}

export function TradePilotsTab({ data, onSaved, onError }: TradePilotsTabProps) {
  const [pilotId, setPilotId] = useState("");
  const [pilotTown, setPilotTown] = useState("");
  const [pilotPinPrefix, setPilotPinPrefix] = useState("734");
  const [pilotPoint, setPilotPoint] = useState("");
  const [pilotAddr, setPilotAddr] = useState("");
  const [pilotLocalFeePaise, setPilotLocalFeePaise] = useState("0");
  const [pilotTargetKg, setPilotTargetKg] = useState("200");
  const [pilotBookedKg, setPilotBookedKg] = useState("0");
  const [pilotStatus, setPilotStatus] = useState<
    "active" | "paused" | "dispatched" | "cancelled"
  >("active");
  const [pilotPartner, setPilotPartner] = useState("");
  const [pilotSchedule, setPilotSchedule] = useState("Every Tuesday");
  const [pilotCutoff, setPilotCutoff] = useState("2026-12-01T18:00:00Z");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setPilotId("");
    setPilotTown("");
    setPilotPinPrefix("734");
    setPilotPoint("");
    setPilotAddr("");
    setPilotLocalFeePaise("0");
    setPilotTargetKg("200");
    setPilotBookedKg("0");
    setPilotStatus("active");
    setPilotPartner("");
    setPilotSchedule("Every Tuesday");
    setPilotCutoff("2026-12-01T18:00:00Z");
  }

  async function savePilot(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/trade/pilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(pilotId ? { id: pilotId } : {}),
          town_name: pilotTown,
          pin_prefix: pilotPinPrefix,
          collection_point: pilotPoint,
          collection_address: pilotAddr,
          local_fee_paise: Number(pilotLocalFeePaise) || 0,
          target_kg: Number(pilotTargetKg) || 200,
          booked_kg: Number(pilotBookedKg) || 0,
          dispatch_partner: pilotPartner,
          dispatch_schedule: pilotSchedule,
          cutoff_at: pilotCutoff,
          status: pilotStatus,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(json.error || "Failed to save shared town pilot.");
        return;
      }
      await onSaved({ kind: "ok", text: "Shared pilot saved." });
    } catch {
      onError("Network error while saving shared pilot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-trade-stack">
      <form
        onSubmit={savePilot}
        aria-labelledby="trade-pilot-form-heading"
        className="tf-trade-card tf-trade-stack"
      >
        <div className="tf-trade-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 id="trade-pilot-form-heading" className="tf-trade-card-title">
              <MapPin size={18} aria-hidden="true" />
              <span>
                {pilotId
                  ? `Update Pilot (${pilotId})`
                  : "Create Shared-Load Town Pilot"}
              </span>
            </h2>
            <p className="tf-trade-card-desc">
              Aggregate tea shop orders in a town hub to unlock lower shared surface freight rates.
            </p>
          </div>
          {pilotId ? (
            <button
              type="button"
              className="tf-trade-btn tf-trade-btn--sm"
              onClick={resetForm}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>New Pilot</span>
            </button>
          ) : null}
        </div>

        {/* Keep input order 0..7 matching E2E contract */}
        <div className="tf-trade-grid-2">
          <div className="tf-trade-field">
            <label htmlFor="pilot-town" className="tf-trade-label">
              Town Name
            </label>
            <input
              id="pilot-town"
              type="text"
              className="tf-trade-input"
              placeholder="e.g. Siliguri"
              value={pilotTown}
              onChange={(e) => setPilotTown(e.target.value)}
              required
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-pin-prefix" className="tf-trade-label">
              PIN Prefix
            </label>
            <input
              id="pilot-pin-prefix"
              type="text"
              inputMode="numeric"
              className="tf-trade-input"
              placeholder="e.g. 734"
              value={pilotPinPrefix}
              onChange={(e) => setPilotPinPrefix(e.target.value)}
              required
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-point" className="tf-trade-label">
              Collection Point
            </label>
            <input
              id="pilot-point"
              type="text"
              className="tf-trade-input"
              placeholder="e.g. Bidhan Market Hub"
              value={pilotPoint}
              onChange={(e) => setPilotPoint(e.target.value)}
              required
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-address" className="tf-trade-label">
              Collection Address
            </label>
            <input
              id="pilot-address"
              type="text"
              className="tf-trade-input"
              placeholder="Full hub address"
              value={pilotAddr}
              onChange={(e) => setPilotAddr(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="tf-trade-grid-4">
          <div className="tf-trade-field">
            <label htmlFor="pilot-local-fee" className="tf-trade-label">
              Local Fee (paise)
            </label>
            <input
              id="pilot-local-fee"
              type="number"
              min={0}
              inputMode="numeric"
              className="tf-trade-input"
              value={pilotLocalFeePaise}
              onChange={(e) => setPilotLocalFeePaise(e.target.value)}
            />
            <span className="tf-trade-help">
              <span className="tf-trade-money-hint">
                {formatRupees(pilotLocalFeePaise)}
              </span>
            </span>
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-target-kg" className="tf-trade-label">
              Target Load (kg)
            </label>
            <input
              id="pilot-target-kg"
              type="number"
              min={1}
              inputMode="numeric"
              className="tf-trade-input"
              value={pilotTargetKg}
              onChange={(e) => setPilotTargetKg(e.target.value)}
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-booked-kg" className="tf-trade-label">
              Booked Load (kg)
            </label>
            <input
              id="pilot-booked-kg"
              type="number"
              min={0}
              inputMode="numeric"
              className="tf-trade-input"
              value={pilotBookedKg}
              onChange={(e) => setPilotBookedKg(e.target.value)}
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-partner" className="tf-trade-label">
              Dispatch Partner
            </label>
            <input
              id="pilot-partner"
              type="text"
              className="tf-trade-input"
              placeholder="Carrier name"
              value={pilotPartner}
              onChange={(e) => setPilotPartner(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="tf-trade-grid-3">
          <div className="tf-trade-field">
            <label htmlFor="pilot-schedule" className="tf-trade-label">
              Dispatch Schedule
            </label>
            <input
              id="pilot-schedule"
              type="text"
              className="tf-trade-input"
              value={pilotSchedule}
              onChange={(e) => setPilotSchedule(e.target.value)}
              required
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-cutoff" className="tf-trade-label">
              Cutoff Timestamp (ISO)
            </label>
            <input
              id="pilot-cutoff"
              type="text"
              className="tf-trade-input"
              value={pilotCutoff}
              onChange={(e) => setPilotCutoff(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>

          <div className="tf-trade-field">
            <label htmlFor="pilot-status" className="tf-trade-label">
              Pilot Status
            </label>
            <select
              id="pilot-status"
              className="tf-trade-select"
              value={pilotStatus}
              onChange={(e) =>
                setPilotStatus(
                  e.target.value as
                    | "active"
                    | "paused"
                    | "dispatched"
                    | "cancelled"
                )
              }
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="dispatched">Dispatched</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="tf-trade-form-actions">
          <button
            type="submit"
            className="tf-trade-btn tf-trade-btn--primary"
            disabled={saving}
          >
            <Plus size={16} aria-hidden="true" />
            <span>{saving ? "Saving…" : "Save Town Pilot"}</span>
          </button>
        </div>
      </form>

      {/* Pilots Table */}
      <div className="tf-trade-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="trade-pilots-table-caption"
          className="tf-trade-table-wrap"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="tf-trade-table">
            <caption id="trade-pilots-table-caption">
              Shared-load town collection pilots
            </caption>
            <thead>
              <tr>
                <th scope="col">Town</th>
                <th scope="col">Collection Point</th>
                <th scope="col">Booked / Target</th>
                <th scope="col">Schedule &amp; Cutoff</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.sharedPilots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-trade-empty">
                    No shared-load town pilots created yet.
                  </td>
                </tr>
              ) : (
                data.sharedPilots.map((p) => {
                  const booked = Number(p.booked_kg ?? 0);
                  const target = Math.max(1, Number(p.target_kg ?? 200));
                  const statusStr = String(p.status ?? "active");
                  return (
                    <tr key={String(p.id)}>
                      <th scope="row">
                        <div>{String(p.town_name)}</div>
                        <div className="tf-trade-help">
                          PIN {String(p.pin_prefix)}xxx
                        </div>
                      </th>
                      <td data-label="Collection Point">
                        <div>{String(p.collection_point)}</div>
                        <div className="tf-trade-help">
                          {String(p.collection_address ?? "")}
                        </div>
                      </td>
                      <td data-label="Capacity">
                        <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {booked} / {target} kg
                        </div>
                        <progress
                          className="tf-trade-progress"
                          value={Math.min(booked, target)}
                          max={target}
                          aria-label={`${String(p.town_name)} load progress`}
                          style={{ marginTop: 4, maxWidth: 140 }}
                        />
                      </td>
                      <td data-label="Schedule">
                        <div>{String(p.dispatch_schedule ?? "")}</div>
                        <div className="tf-trade-help">
                          Cutoff: {formatDateTime(p.cutoff_at)}
                        </div>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`tf-badge ${
                            statusStr === "active"
                              ? "tf-badge--ok"
                              : statusStr === "dispatched"
                              ? "tf-badge--info"
                              : statusStr === "paused"
                              ? "tf-badge--warn"
                              : "tf-badge--danger"
                          }`}
                        >
                          {statusStr}
                        </span>
                      </td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className="tf-trade-btn tf-trade-btn--sm"
                          onClick={() => {
                            setPilotId(String(p.id));
                            setPilotTown(String(p.town_name));
                            setPilotPinPrefix(String(p.pin_prefix));
                            setPilotPoint(String(p.collection_point));
                            setPilotAddr(String(p.collection_address));
                            setPilotLocalFeePaise(String(p.local_fee_paise ?? 0));
                            setPilotTargetKg(String(p.target_kg ?? 200));
                            setPilotBookedKg(String(p.booked_kg ?? 0));
                            setPilotPartner(String(p.dispatch_partner));
                            setPilotSchedule(String(p.dispatch_schedule));
                            setPilotCutoff(String(p.cutoff_at));
                            setPilotStatus(
                              statusStr as
                                | "active"
                                | "paused"
                                | "dispatched"
                                | "cancelled"
                            );
                          }}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          <span>Edit</span>
                        </button>
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
