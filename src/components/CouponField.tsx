"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useState, useEffect, useRef } from "react";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

type Props = {
  id: string;
  initialCode?: string;
  subtotalPaise: number;
  onApplied: (code: string, discountPaise: number) => void;
  onCleared: () => void;
};

/**
 * Coupon code field. Preview pricing always comes from the server
 * (/api/coupons/validate); nothing typed here affects the order total until
 * checkout re-validates it server-side.
 */
export function CouponField({
  id,
  initialCode,
  subtotalPaise,
  onApplied,
  onCleared,
}: Props) {
  const formatPrice = useDisplayMoney();
  const [code, setCode] = useState(initialCode ?? "");
  const [applied, setApplied] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [selectedCode, setSelectedCode] = useState(initialCode || "");
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ onApplied, onCleared, formatPrice });
  callbacks.current = { onApplied, onCleared, formatPrice };

  useEffect(() => {
    setSelectedCode(initialCode || "");
  }, [initialCode]);

  // A coupon preview belongs to a particular subtotal. Cancel older validations
  // and remove stale savings while the current server calculation is pending.
  useEffect(() => {
    const clean = selectedCode.trim().toUpperCase();
    if (!clean) { setBusy(false); return; }
    const controller = new AbortController();
    setBusy(true);
    setDiscount(0);
    setMessage("Checking coupon for your current bag…");
    setIsError(false);
    callbacks.current.onApplied(clean, 0);
    fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: clean, subtotalPaise }),
      signal: controller.signal,
    })
      .then(async res => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (controller.signal.aborted) return;
        if (!ok || !data.valid) {
          setApplied(null);
          setMessage(data.reason || "This code is not valid for this order.");
          setIsError(true);
          callbacks.current.onCleared();
          return;
        }
        setApplied(clean);
        setDiscount(data.discountPaise);
        setMessage(`Code ${clean} applied · ${callbacks.current.formatPrice(data.discountPaise)} off.`);
        callbacks.current.onApplied(clean, data.discountPaise);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setApplied(null);
        setMessage("Unable to check the code right now. Please retry.");
        setIsError(true);
        callbacks.current.onCleared();
      })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [selectedCode, subtotalPaise, attempt]);

  function apply() {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setMessage("Enter a coupon code first.");
      setIsError(true);
      return;
    }
    setSelectedCode(clean);
    setAttempt(value => value + 1);
  }

  function clear() {
    setSelectedCode("");
    setCode("");
    setApplied(null);
    setDiscount(0);
    setBusy(false);
    setMessage("");
    setIsError(false);
    onCleared();
  }

  return (
    <div className="coupon-block">
      <label htmlFor={id}>
        <span> <StorefrontText id="copy_db65f65e1f316f1d" fallback="Coupon code" /> </span>
        <span className="micro-note"> <StorefrontText id="copy_00cb8a74fbe8125e" fallback="Optional · verified on the server at checkout." /> </span>
      </label>
      {applied ? (
        <div className="coupon-applied" aria-live="polite">
          <p>
            <strong>{applied}</strong> · {formatPrice(discount)} <StorefrontText id="copy_b4dc66dde806261b" fallback="off" /> </p>
          <button type="button" className="back-link" onClick={clear}> <StorefrontText id="copy_87c3ca57a9b5fbb5" fallback="Remove code" /> </button>
        </div>
      ) : (
        <div className="coupon-row">
          <input
            id={id}
            name="couponCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 24))}
            placeholder="e.g. WELCOME10"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            aria-describedby={`${id}-hint`}
          />
          <button
            type="button"
            className="button button-outline"
            disabled={busy || !code.trim()}
            onClick={apply}
          >
            {busy ? "Checking…" : "Apply"}
          </button>
        </div>
      )}
      <p id={`${id}-hint`} className="micro-note"> <StorefrontText id="copy_6881c41b413dfe7e" fallback="Discounts are calculated on the server from the current subtotal." /> </p>
      {message ? (
        <p role={isError ? "alert" : "status"} className={isError ? "error-message" : "success-message"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
