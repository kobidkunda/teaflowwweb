"use client";
import { CartItemImage } from "@/components/CartItemImage";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useEffect, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ShieldCheck, Truck, ArrowLeft } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { CouponField } from "@/components/CouponField";
import { getCartItemImage } from "@/lib/cartImageHelper";
import {
  formatINR,
  quoteTotals,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/money";
import { trackBeginCheckout } from "@/lib/seo/tracking";
import { generateUUID } from "@/lib/uuid";

type FieldErrors = { name?: string; email?: string; address?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFields(name: string, email: string, address: string): FieldErrors {
  const errors: FieldErrors = {};
  const cleanName = name.trim();
  if (cleanName.length < 2) errors.name = "Enter your full name (at least 2 characters).";
  else if (cleanName.length > 100) errors.name = "Keep the name under 100 characters.";
  const cleanEmail = email.trim();
  if (!cleanEmail) errors.email = "Enter your email address.";
  else if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail))
    errors.email = "Enter a valid email address, e.g. you@example.com.";
  const cleanAddress = address.trim();
  if (cleanAddress.length < 10)
    errors.address = "Enter the full delivery address (at least 10 characters).";
  else if (cleanAddress.length > 400) errors.address = "Keep the address under 400 characters.";
  return errors;
}

/**
 * Premium demo-checkout form. Client validation mirrors the server contract
 * (name/email/address shapes in checkoutSchema) for fast feedback; the
 * server re-prices every line and re-validates the coupon before saving.
 * No PII is persisted in Web storage — the cart key stays anonymous.
 */
export function CheckoutForm() {
  const { items, subtotal, changeQuantity, remove, clear } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const key = useRef<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [couponCode, setCouponCode] = useState(
    (searchParams.get("coupon") || "").toUpperCase().slice(0, 24)
  );
  const [discount, setDiscount] = useState(0);

  const quote = quoteTotals(subtotal, discount);
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const shipProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  // Auto-validate coupon code if passed via search param or saved cookie
  useEffect(() => {
    let candidate = couponCode;
    if (!candidate && typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)hth_applied_coupon=([^;]*)/);
      if (match) {
        candidate = decodeURIComponent(match[1]).toUpperCase().slice(0, 24);
        setCouponCode(candidate);
      }
    }
    if (candidate && subtotal > 0 && discount === 0) {
      fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: candidate, subtotalPaise: subtotal }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.valid) {
            setDiscount(data.discountPaise);
          }
        })
        .catch(() => {});
    }
  }, [couponCode, subtotal, discount]);

  // Move focus into the error summary after it renders (state updates first).
  useEffect(() => {
    if (formError) summaryRef.current?.focus();
  }, [formError]);

  const trackedCheckoutRef = useRef(false);

  // Track begin_checkout in Google Tag Manager
  useEffect(() => {
    if (items.length > 0 && !trackedCheckoutRef.current) {
      trackedCheckoutRef.current = true;
      trackBeginCheckout(
        items.map((x) => ({
          item_id: x.sku || x.trialId || String(x.variantId),
          item_name: x.name,
          price: x.pricePaise / 100,
          quantity: x.quantity,
        })),
        subtotal / 100
      );
    }
  }, [items, subtotal]);

  if (!items.length) {
    return (
      <div className="empty-state">
        <h2> <StorefrontText id="copy_335a37320046740b" fallback="Your bag is empty." /> </h2>
        <p> <StorefrontText id="copy_2d3ba8e2132cb29d" fallback="Add a tea before checking out — your selection is saved on this device only." /> </p>
        <div className="button-row" style={{ justifyContent: "center", marginTop: "20px" }}>
          <Link href="/shop" className="button button-primary"> <StorefrontText id="copy_0844a60fb78812e3" fallback="Explore tea" /> </Link>
          <Link href="/track" className="back-link"> <StorefrontText id="copy_e046d92f0e1fec87" fallback="Already placed an order? Track it →" /> </Link>
        </div>
      </div>
    );
  }

  const errorList = Object.entries(fieldErrors).filter(([, v]) => v) as [keyof FieldErrors, string][];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || loading) return;
    const form = new FormData(event.currentTarget);
    const nextName = String(form.get("name") ?? "");
    const nextEmail = String(form.get("email") ?? "");
    const nextAddress = String(form.get("address") ?? "");
    const problems = validateFields(nextName, nextEmail, nextAddress);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      setFormError("Please check the highlighted fields below.");
      return;
    }
    setLoading(true);
    setFormError("");
    if (!key.current) key.current = generateUUID();
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName.trim(),
          email: nextEmail.trim(),
          address: nextAddress.trim(),
          idempotencyKey: key.current,
          couponCode: couponCode || undefined,
          items: items.map((x) => ({ variantId: x.variantId, quantity: x.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed.");
      clear();
      router.push("/order/" + data.orderId);
    } catch (cause) {
      // New idempotency key on field-level failure so a retry never replays a failed shape.
      if (cause instanceof Error && /check the checkout fields/i.test(cause.message)) key.current = null;
      setFormError(cause instanceof Error ? cause.message : "Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="checkout-premium" onSubmit={submit} noValidate aria-busy={loading}>
      {formError ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-label="There is a problem with your checkout"
          className="checkout-alert"
        >
          <strong>{formError || "Please check the highlighted fields below."}</strong>
          {errorList.length > 0 ? (
            <ul>
              {errorList.map(([field, message]) => (
                <li key={field}>
                  <a href={`#checkout-${field}`}>{message}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="checkout-card" aria-labelledby="checkout-contact-h">
            <p className="eyebrow"> <StorefrontText id="copy_96c3d6caccbe4d01" fallback="Step 1 · Contact Information" /> </p>
            <h2 id="checkout-contact-h"> <StorefrontText id="copy_b5074ffbe9354cbb" fallback="Who should we write to?" /> </h2>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="checkout-name"> <StorefrontText id="copy_f13a64ba2fea87ef" fallback="Full name" /> </label>
                <input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder="e.g. Aarav Sharma"
                  required
                  maxLength={100}
                  disabled={loading}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? "checkout-name-error" : "checkout-name-hint"}
                />
                <p id="checkout-name-hint" className="field-hint"> <StorefrontText id="copy_f58083765f946a63" fallback="For your order confirmation receipt." /> </p>
                {fieldErrors.name ? (
                  <p id="checkout-name-error" className="field-error">{fieldErrors.name}</p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="checkout-email"> <StorefrontText id="copy_f2488fd4ef4adbc6" fallback="Email address" /> </label>
                <input
                  id="checkout-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="next"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                  }}
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                  disabled={loading}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={fieldErrors.email ? "checkout-email-error" : "checkout-email-hint"}
                />
                <p id="checkout-email-hint" className="field-hint"> <StorefrontText id="copy_69ca51feab0d87a0" fallback="We will email your confirmation and dispatch notice." /> </p>
                {fieldErrors.email ? (
                  <p id="checkout-email-error" className="field-error">{fieldErrors.email}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="checkout-card" aria-labelledby="checkout-delivery-h">
            <p className="eyebrow"> <StorefrontText id="copy_4e3c587cfff53b1d" fallback="Step 2 · Shipping Destination" /> </p>
            <h2 id="checkout-delivery-h"> <StorefrontText id="copy_b82618aeb9e63aec" fallback="Where should the tea travel?" /> </h2>
            <div className="field">
              <label htmlFor="checkout-address"> <StorefrontText id="copy_eb4c6f5640860965" fallback="Delivery address" /> </label>
              <textarea
                id="checkout-address"
                name="address"
                autoComplete="street-address"
                enterKeyHint="done"
                rows={3}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value.slice(0, 400));
                  if (fieldErrors.address) setFieldErrors((p) => ({ ...p, address: undefined }));
                }}
                placeholder="House / Apartment no., Street, City, State & PIN code — e.g. 14 Mall Road, Shimla 171001"
                required
                maxLength={400}
                disabled={loading}
                aria-invalid={fieldErrors.address ? true : undefined}
                aria-describedby={
                  fieldErrors.address ? "checkout-address-error" : "checkout-address-hint"
                }
              />
              <p id="checkout-address-hint" className="field-hint"> <StorefrontText id="copy_772d0df4cfc1683f" fallback="Standard delivery within India." /> {address.trim().length}/400
              </p>
              {fieldErrors.address ? (
                <p id="checkout-address-error" className="field-error">{fieldErrors.address}</p>
              ) : null}
            </div>
          </section>

          <section className="checkout-card" aria-labelledby="checkout-coupon-h">
            <p className="eyebrow"> <StorefrontText id="copy_320b2cc101757ec6" fallback="Step 3 · Promotional Savings" /> </p>
            <h2 id="checkout-coupon-h"> <StorefrontText id="copy_e1a2a8af0c8d3292" fallback="Have a coupon code?" /> </h2>
            <CouponField
              id="checkout-coupon"
              initialCode={couponCode || undefined}
              subtotalPaise={subtotal}
              onApplied={(code, d) => {
                setCouponCode(code);
                setDiscount(d);
              }}
              onCleared={() => {
                setCouponCode("");
                setDiscount(0);
              }}
            />
          </section>

          <ul className="checkout-trust" aria-label="Good to know">
            <li><ShieldCheck size={18} aria-hidden="true" /> <StorefrontText id="copy_bf5e3040c5d5d3a2" fallback="No real payment collected — this records a complimentary demo order." /> </li>
            <li><Truck size={18} aria-hidden="true" /> <StorefrontText id="copy_a0aab610f08ce212" fallback="Complimentary shipping unlocked for orders above ₹1,500 (flat ₹99 under)." /> </li>
            <li><Lock size={18} aria-hidden="true" /> <StorefrontText id="copy_1fbd4be4b23b933a" fallback="GST included in quoted prices. The server re-verifies every line." /> </li>
          </ul>
        </div>

        <aside className="checkout-summary" aria-label="Order summary">
          <div className="checkout-summary-card">
            <div className="checkout-summary-header">
              <h2> <StorefrontText id="copy_f159e18f1328d9a0" fallback="Your order" /> </h2>
              <span className="checkout-summary-count">
                {items.length} {items.length === 1 ? "line item" : "line items"}
              </span>
            </div>

            <ul className="checkout-lines">
              {items.map((x) => (
                <li key={x.variantId} className="checkout-line-item">
                  <div className="checkout-line-thumb">
                    <CartItemImage
                      src={getCartItemImage(x)}
                      name={x.name || "Tea selection"}
                      size={56}
                      className="checkout-thumb-img object-cover rounded-md"
                    />
                  </div>
                  <div className="checkout-line-content">
                    <div className="checkout-line-top">
                      <span className="checkout-line-name">{x.name}</span>
                      <strong className="checkout-line-price">{formatINR(x.pricePaise * x.quantity)}</strong>
                    </div>
                    <p className="checkout-line-variant">{x.grams} <StorefrontText id="copy_f6d17905794e3132" fallback="g tin" /> </p>
                    <div className="checkout-line-controls">
                      <div className="quantity-control quantity-compact">
                        <button
                          type="button"
                          aria-label={"Decrease quantity of " + x.name}
                          disabled={loading || x.quantity <= 1}
                          onClick={() => changeQuantity(x.variantId, x.quantity - 1)}
                        >−</button>
                        <span aria-live="polite" aria-label={"Quantity: " + x.quantity}>{x.quantity}</span>
                        <button
                          type="button"
                          aria-label={"Increase quantity of " + x.name}
                          disabled={loading || x.quantity >= 20}
                          onClick={() => changeQuantity(x.variantId, x.quantity + 1)}
                        >+</button>
                      </div>
                      <button
                        type="button"
                        className="checkout-remove-btn"
                        disabled={loading}
                        onClick={() => remove(x.variantId)}
                        aria-label={"Remove " + x.name}
                      > <StorefrontText id="copy_c3812fc4acb861d5" fallback="Remove" /> </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="checkout-back-link-wrap">
              <Link href="/cart" className="checkout-back-to-bag">
                <ArrowLeft size={14} aria-hidden="true" />
                <span> <StorefrontText id="copy_911c1c694bda5c4e" fallback="Return to tea bag" /> </span>
              </Link>
            </div>

            <div className="checkout-ship-progress">
              <p>
                {remaining
                  ? `${formatINR(remaining)} away from complimentary shipping`
                  : "Complimentary shipping unlocked!"}
              </p>
              <div
                className="shipping-track"
                role="progressbar"
                aria-valuenow={shipProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to complimentary shipping"
              >
                <div style={{ width: `${shipProgress}%` }} />
              </div>
            </div>

            <div className="checkout-totals" aria-live="polite">
              <div>
                <span> <StorefrontText id="copy_8c0f2cb34079ede4" fallback="Subtotal" /> </span>
                <strong>{formatINR(subtotal)}</strong>
              </div>
              {discount > 0 ? (
                <div className="coupon-discount-row">
                  <span> <StorefrontText id="copy_152428da2871a491" fallback="Coupon" /> {couponCode}</span>
                  <strong className="discount-amount">−{formatINR(discount)}</strong>
                </div>
              ) : null}
              <div>
                <span> <StorefrontText id="copy_ad5751430e295f0c" fallback="Shipping" /> </span>
                <strong>
                  {quote.shippingPaise ? formatINR(quote.shippingPaise) : <span className="free-shipping-tag"> <StorefrontText id="copy_40a759107d744ceb" fallback="Complimentary" /> </span>}
                </strong>
              </div>
              {quote.taxPaise ? (
                <div>
                  <span> <StorefrontText id="copy_f95b4b6e1b3ca733" fallback="Includes GST" /> </span>
                  <strong>{formatINR(quote.taxPaise)}</strong>
                </div>
              ) : null}
              <div className="total">
                <span> <StorefrontText id="copy_483d677295901380" fallback="Demo total" /> </span>
                <strong>{formatINR(quote.totalPaise)}</strong>
              </div>
            </div>

            <button
              type="submit"
              className="button button-primary checkout-submit-btn"
              disabled={loading || !items.length}
            >
              {loading ? (
                "Placing demo order…"
              ) : (
                `Place demo order · ${formatINR(quote.totalPaise)}`
              )}
            </button>

            <p className="micro-note checkout-secure-note">
              <Lock size={13} aria-hidden="true" />
              <span> <StorefrontText id="copy_c93f29f77a0ed2d4" fallback="Demo checkout — no charge, no dispatch." /> </span>
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
