"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

export interface ReleaseJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReleased: () => void;
  defaultOrderId?: string;
}

export function ReleaseJobModal({
  isOpen,
  onClose,
  onReleased,
  defaultOrderId = "",
}: ReleaseJobModalProps) {
  const [orderId, setOrderId] = useState(defaultOrderId);
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideJustification, setOverrideJustification] = useState("");
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    eligible: boolean;
    blockers: string[];
    deposit_status?: string;
    proof_status?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (defaultOrderId) {
      setOrderId(defaultOrderId);
    }
  }, [defaultOrderId]);

  useEffect(() => {
    if (!isOpen) {
      setValidationResult(null);
      setError(null);
      setOverrideJustification("");
      return;
    }

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Initial focus into modal
    setTimeout(() => {
      if (dialogRef.current) {
        const first = dialogRef.current.querySelector<HTMLElement>("input, select, textarea, button");
        first?.focus();
      }
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && orderId) {
      checkPrerequisites(orderId);
    }
  }, [isOpen, orderId]);

  async function checkPrerequisites(id: string) {
    if (!id.trim()) return;
    try {
      setValidating(true);
      setError(null);
      const res = await fetch(`/api/v1/admin/private-label/jobs/validate-release?order_id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
      }
    } catch {
      /* ignore */
    } finally {
      setValidating(false);
    }
  }

  async function handleRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId.trim()) {
      setError("Please specify an Order ID.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId.trim(),
          target_completion_date: targetDate || undefined,
          operator_notes: notes.trim() || undefined,
          override_justification: overrideJustification.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.blockers && Array.isArray(data.blockers)) {
          setError(`Production Release Blocked: ${data.blockers.join("; ")}`);
        } else {
          setError(data.error || "Failed to release production job.");
        }
        return;
      }

      onReleased();
      onClose();
    } catch {
      setError("Network error releasing production job.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-modal-title"
      data-testid="release-job-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg bg-white rounded-2xl border border-[#DDE4DC] shadow-xl p-6 space-y-5 animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#143C31]" />
            <h2 id="release-modal-title" className="text-base font-serif font-bold text-[#143C31]">
              Release Order to Cleanroom Production
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65746D] hover:text-[#143C31] p-1 rounded-lg"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Gate Checklist */}
        <div className="bg-[#F8F6F0] border border-[#E8E4DC] rounded-xl p-4 space-y-2 text-xs">
          <span className="font-mono uppercase font-bold text-[10px] text-[#65746D]">
            Production Prerequisite Gates
          </span>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2">
              {validationResult?.deposit_status === "deposit_paid" ? (
                <CheckCircle2 size={14} className="text-emerald-700" />
              ) : (
                <AlertCircle size={14} className="text-amber-600" />
              )}
              <span className="text-[#143C31]">
                50% Advance Deposit:{" "}
                <span className="font-semibold capitalize">
                  {validationResult?.deposit_status || "Checking..."}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {validationResult?.proof_status === "customer_approved" ? (
                <CheckCircle2 size={14} className="text-emerald-700" />
              ) : (
                <AlertCircle size={14} className="text-amber-600" />
              )}
              <span className="text-[#143C31]">
                Customer Design Proof Approval:{" "}
                <span className="font-semibold capitalize">
                  {validationResult?.proof_status || "Checking..."}
                </span>
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleRelease} className="space-y-4 text-xs">
          <div>
            <label htmlFor="rel-order-id" className="block font-medium text-[#143C31] mb-1">
              Order ID / Number *
            </label>
            <input
              id="rel-order-id"
              type="text"
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. order_test_001"
              className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
            />
          </div>

          <div>
            <label htmlFor="rel-target-date" className="block font-medium text-[#143C31] mb-1">
              Target Cleanroom Completion Date (YYYY-MM-DD)
            </label>
            <input
              id="rel-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
            />
          </div>

          <div>
            <label htmlFor="rel-operator-notes" className="block font-medium text-[#143C31] mb-1">
              Operator Instructions &amp; Batch Notes
            </label>
            <textarea
              id="rel-operator-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cleanroom Line 2 nitrogen flush batch assignment..."
              className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
            />
          </div>

          {/* Emergency Override Justification */}
          <div>
            <label htmlFor="rel-override" className="block font-medium text-[#143C31] mb-1">
              Emergency Operator Override (Optional)
            </label>
            <input
              id="rel-override"
              type="text"
              value={overrideJustification}
              onChange={(e) => setOverrideJustification(e.target.value)}
              placeholder="e.g. VIP Founder Launch expedited with physical signed proof"
              className="w-full px-3 py-2 border border-[#DDE4DC] rounded-lg focus:outline-hidden focus:border-[#143C31]"
            />
            <p className="text-[10px] text-[#65746D] mt-1">
              Bypasses release blockers with audit logging of the operator justification.
            </p>
          </div>

          <div className="pt-3 border-t border-[#E8E4DC] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-[#DDE4DC] text-[#65746D] hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || validating}
              data-testid="release-job-btn"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-lg font-bold uppercase tracking-wider bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shadow-2xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Releasing...
                </>
              ) : (
                "Confirm Cleanroom Release"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
