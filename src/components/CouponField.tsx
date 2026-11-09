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
  const initialCheckedRef = useRef(false);

  // Auto-validate initialCode if provided from URL query or recovered bag
  useEffect(() => {
    if (initialCode && !applied && subtotalPaise > 0 && !initialCheckedRef.current) {
      initialCheckedRef.current = true;
      const clean = initialCode.trim().toUpperCase();
      fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean, subtotalPaise }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.valid) {
            setApplied(clean);
            setDiscount(data.discountPaise);
            setMessage(`Code ${clean} applied · ${formatPrice(data.discountPaise)} off.`);
            setIsError(false);
            onApplied(clean, data.discountPaise);
          }
        })
        .catch(() => {});
    }
  }, [initialCode, subtotalPaise, applied, onApplied, formatPrice]);

  async function apply() {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setMessage("Enter a coupon code first.");
      setIsError(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean, subtotalPaise }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setMessage(data.reason || "This code is not valid for this order.");
        setIsError(true);
        return;
      }
      setApplied(clean);
      setDiscount(data.discountPaise);
      setMessage(`Code ${clean} applied · ${formatPrice(data.discountPaise)} off.`);
      setIsError(false);
      onApplied(clean, data.discountPaise);
    } catch {
      setMessage("Unable to check the code right now. Please retry.");
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setCode("");
    setApplied(null);
    setDiscount(0);
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
