"use client";
import { trackLead } from "@/lib/seo/tracking";
import { getClientAttributionBundle } from "@/lib/funnel/clientAttribution";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "@/components/CartProvider";
import { Sparkles, Check, Copy, X, Leaf } from "lucide-react";

export function LeadCaptureModal() {
  const { items, sessionId, count } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [source, setSource] = useState<"exit_intent" | "cart_incentive">("exit_intent");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockedCoupon, setUnlockedCoupon] = useState<{
    code: string;
    discountPercent: number;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const isSuppressed = useCallback(() => {
    if (typeof document === "undefined") return true;
    try {
      const matchDismissed = document.cookie.match(/(?:^|;\s*)hth_lead_dismissed=([^;]*)/);
      const matchSubmitted = document.cookie.match(/(?:^|;\s*)hth_lead_submitted=([^;]*)/);
      if (matchSubmitted && matchSubmitted[1] === "true") return true;
      if (matchDismissed) {
        // Suppress for 7 days if dismissed
        const dismissedTime = parseInt(matchDismissed[1], 10);
        if (!isNaN(dismissedTime) && Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const openModal = useCallback(
    (triggerSource: "exit_intent" | "cart_incentive") => {
      if (isSuppressed()) return;
      setSource(triggerSource);
      setIsOpen(true);
    },
    [isSuppressed]
  );

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    try {
      const expires = new Date(Date.now() + 7 * 864e5).toUTCString();
      document.cookie = `hth_lead_dismissed=${Date.now()}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {
      // Ignore cookie errors
    }
  }, []);

  // 1. Desktop exit-intent detection (clientY <= 10 on mouseleave)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSuppressed()) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger when mouse moves out towards the browser chrome / top bar
      if (e.clientY <= 10 && !isSuppressed()) {
        openModal("exit_intent");
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isSuppressed, openModal]);

  // 2. Cart trigger detection (when cart has items and user is idle or on cart page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSuppressed()) return;
    if (count === 0 && items.length === 0) return;

    // Dwell timer: trigger after 20s on cart page or 40s idle on other storefront pages
    const isCartRoute = window.location.pathname === "/cart";
    const triggerDelayMs = isCartRoute ? 18000 : 45000;

    let idleTimer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!isSuppressed()) {
          openModal("cart_incentive");
        }
      }, triggerDelayMs);
    };

    resetIdleTimer();

    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("scroll", resetIdleTimer);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("scroll", resetIdleTimer);
    };
  }, [count, items.length, isSuppressed, openModal]);

  // 3. Accessibility: Keyboard ESC close & focus management
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    const timer = setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      if (dialog?.open) {
        dialog.close();
      }
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, handleDismiss]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanDigits = phoneNumber.replace(/\D/g, "");
    if (cleanDigits.length < 10 || cleanDigits.length > 15) {
      setErrorMessage("Please enter a valid 10-15 digit mobile number (e.g., 98320 12345).");
      phoneInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId || "sess_anonymous",
          phoneNumber: phoneNumber.trim(),
          customerName: customerName.trim() || undefined,
          source,
          attribution: getClientAttributionBundle(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Unable to save your details. Please try again.");
        return;
      }

      trackLead("cart_recovery");
      // Record suppression and store coupon code in cookies
      try {
        const subExpires = new Date(Date.now() + 30 * 864e5).toUTCString();
        document.cookie = `hth_lead_submitted=true; expires=${subExpires}; path=/; SameSite=Lax`;
        if (data.couponCode) {
          const coupExpires = new Date(Date.now() + 7 * 864e5).toUTCString();
          document.cookie = `hth_applied_coupon=${encodeURIComponent(data.couponCode)}; expires=${coupExpires}; path=/; SameSite=Lax`;
        }
      } catch {
        // Ignore cookie errors
      }

      setUnlockedCoupon({
        code: data.couponCode || "COMEBACK10",
        discountPercent: data.discountPercent || 10,
        message: data.message || "Your 10% coupon has been unlocked!",
      });
    } catch {
      setErrorMessage("Network connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!unlockedCoupon?.code) return;
    try {
      await navigator.clipboard.writeText(unlockedCoupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="tf-lead-dialog"
      aria-labelledby="lead-modal-title"
      aria-describedby="lead-modal-desc"
      onCancel={(e) => {
        e.preventDefault();
        handleDismiss();
      }}
      onClick={(e) => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const rect = dialog.getBoundingClientRect();
        const clickedOutside =
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom;
        if (clickedOutside) {
          handleDismiss();
        }
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "32px 28px",
          fontFamily: "inherit",
          color: "#18231c",
        }}
      >
        {/* Accessible Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close exclusive offer dialog"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#f4efe6",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#18231c",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        {!unlockedCoupon ? (
          /* Form View */
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#eef5ed", color: "#256338", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>
              <Sparkles size={14} aria-hidden="true" />
              <span> <StorefrontText id="copy_af48b182f46d0dde" fallback="Himalayan Welcome Offer" /> </span>
            </div>

            <h2 id="lead-modal-title" style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 8px 0", color: "#18231c", lineHeight: 1.25 }}> <StorefrontText id="copy_5fcdad6cb7b4ab3e" fallback="Unlock 10% Off Your First Harvest" /> </h2>

            <p id="lead-modal-desc" style={{ fontSize: "14px", color: "#556358", margin: "0 0 20px 0", lineHeight: 1.5 }}> <StorefrontText id="copy_c616d3333c82d7a8" fallback="Before you step away, reserve an exclusive 10% savings coupon on fresh single-estate Darjeeling teas. We will text you a direct 1-click cart recovery link." /> </p>

            {errorMessage && (
              <div
                id="lead-modal-error"
                role="alert"
                style={{
                  backgroundColor: "#fdf2f2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  htmlFor="lead-phone-input"
                  style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#2b3b30", marginBottom: "6px" }}
                > <StorefrontText id="copy_e6aead37a2cfc1ce" fallback="WhatsApp / Mobile Number" /> <span style={{ color: "#b91c1c" }}>*</span>
                </label>
                <span id="lead-phone-hint" style={{ display: "block", fontSize: "12px", color: "#556358", marginBottom: "6px" }}>
                  10-15 digits with country code (e.g. +91 98320 12345)
                </span>
                <input
                  id="lead-phone-input"
                  name="phoneNumber"
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  required
                  aria-invalid={errorMessage ? "true" : "false"}
                  aria-describedby={errorMessage ? "lead-phone-hint lead-modal-error" : "lead-phone-hint"}
                  placeholder="+91 98320 12345"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #c7d2ca",
                    fontSize: "16px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="lead-name-input"
                  style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#2b3b30", marginBottom: "6px" }}
                > <StorefrontText id="copy_9cd26bee4d76694c" fallback="Your Name" /> <span style={{ fontSize: "12px", color: "#708075", fontWeight: 400 }}> <StorefrontText id="copy_0059798b7f7023e4" fallback="(optional)" /> </span>
                </label>
                <input
                  id="lead-name-input"
                  name="customerName"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="send"
                  placeholder="e.g. Tenzing"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #c7d2ca",
                    fontSize: "16px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: "8px",
                  padding: "13px 20px",
                  backgroundColor: "#223d2b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: "background-color 0.2s",
                }}
              >
                {isSubmitting ? (
                  "Unlocking Your Offer..."
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden="true" />
                    <span> <StorefrontText id="copy_b7f84e31df963aea" fallback="Unlock 10% Discount" /> </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#708075",
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: "6px",
                  textAlign: "center",
                  textDecoration: "underline",
                }}
              > <StorefrontText id="copy_2937edea5b10057a" fallback="No thank you, I prefer full price" /> </button>
            </form>
          </div>
        ) : (
          /* Success View */
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#e8f5e9",
                color: "#1b5e20",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <Check size={28} aria-hidden="true" />
            </div>

            <h2 id="lead-modal-title" style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 8px 0", color: "#18231c" }}> <StorefrontText id="copy_7ffec6ce31325632" fallback="10% Discount Unlocked!" /> </h2>

            <p id="lead-modal-desc" style={{ fontSize: "14px", color: "#556358", margin: "0 0 20px 0", lineHeight: 1.5 }}> <StorefrontText id="copy_4b184cffcf295c4a" fallback="Use your exclusive voucher code at checkout to enjoy 10% off your order." /> </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                backgroundColor: "#f4efe6",
                border: "2px dashed #bfa57d",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >
              <span style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "1px", color: "#1b2a21" }}>
                {unlockedCoupon.code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Copy voucher code"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  backgroundColor: copied ? "#256338" : "#18231c",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                <span>{copied ? "Copied!" : "Copy Code"}</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", color: "#256338", marginBottom: "20px" }}>
              <Leaf size={15} aria-hidden="true" />
              <span> <StorefrontText id="copy_c2fbab3ed7b31434" fallback="Coupon automatically saved for your checkout bag" /> </span>
            </div>

            <a
              href={`/cart`}
              onClick={handleDismiss}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 20px",
                backgroundColor: "#223d2b",
                color: "#ffffff",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              View Bag & Apply Discount →
            </a>
          </div>
        )}
      </div>
    </dialog>
  );
}
