"use client";
import { SubscribeLink } from "@/components/subscriptions/SubscribeLink";
import { CartItemImage } from "@/components/CartItemImage";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Check, Lock, ShieldCheck, Trash2, ArrowRight } from "lucide-react";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { CouponField } from "@/components/CouponField";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { getCartItemImage } from "@/lib/cartImageHelper";

import { CONSENT_EVENT } from "@/lib/seo/consent";
import { trackViewCart } from "@/lib/seo/tracking";

function CartPageContent() {
  const formatINR = useDisplayMoney();

  const { items, subtotal, changeQuantity, remove, add, clear } = useCart();
  const hasWholesale = items.some((x) => x.isWholesale || x.quantity > 20);
  const isTrialsOnly = items.length > 0 && items.every((x) => Boolean(x.trialId && String(x.trialId).trim()));
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const [storeConfig, setStoreConfig] = useState({
    freeShippingThresholdRupees: 599,
    flatShippingRupees: 99,
    codMinRupees: 299,
    codEnabled: true,
    onlinePaymentEnabled: true,
    whatsappNumber: "+91 7001304853",
  });
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinEstimate, setPinEstimate] = useState<{
    ok: boolean;
    city?: string;
    state?: string;
    estimatedDays?: string;
    serviceable?: boolean;
    codAllowed?: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/commerce/payment-methods")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setStoreConfig({
          freeShippingThresholdRupees: Number(data.shipping?.freeShippingThresholdRupees || 599),
          flatShippingRupees: Number(data.shipping?.flatFeeRupees ?? 99),
          codMinRupees: Number(data.discounts?.cod?.minRupees ?? 100),
          codEnabled: data.discounts?.cod?.enabled !== false,
          onlinePaymentEnabled: data.onlinePaymentEnabled !== false,
          whatsappNumber: data.whatsappNumber || "+91 7001304853",
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleCheckPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setPinEstimate({ ok: false, error: "Enter a valid 6-digit Indian PIN code." });
      return;
    }
    setPinLoading(true);
    try {
      const res = await fetch(`/api/shipping/pincode-lookup?pincode=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setPinEstimate(data);
    } catch {
      setPinEstimate({ ok: false, error: "Unable to check PIN right now. Shipping will calculate at checkout." });
    } finally {
      setPinLoading(false);
    }
  };

  const searchParams = useSearchParams();
  const recoveryToken = searchParams ? searchParams.get("recovery") : null;

  // 1. Recovery Token Hydration (/cart?recovery=<token>)
  useEffect(() => {
    if (!recoveryToken) return;
    const token = recoveryToken;

    let isCancelled = false;
    async function restoreCart() {
      setIsRecovering(true);
      try {
        const res = await fetch(`/api/cart/recover?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          setIsRecovering(false);
          return;
        }

        const data = await res.json();
        if (isCancelled) return;

        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          clear();
          for (const item of data.items) {
            const isWholesale = Boolean(item.isWholesale || (typeof item.quantity === "number" && item.quantity > 20));
            add({
              variantId: item.variantId || 0,
              trialId: item.trialId,
              sku: item.sku,
              slug: item.slug,
              name: item.name,
              grams: item.grams,
              pricePaise: item.pricePaise,
              quantity: item.quantity,
              isWholesale,
            }, false);
          }

          // Apply saved coupon code if provisioned
          const restoredCoupon = data.couponCode || data.cart?.appliedCouponCode;
          if (restoredCoupon) {
            setCouponCode(restoredCoupon);
            try {
              const valRes = await fetch("/api/coupons/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code: restoredCoupon,
                  subtotalPaise: data.cart?.subtotalPaise || subtotal,
                }),
              });
              const valData = await valRes.json();
              if (valData.valid) {
                setDiscount(valData.discountPaise);
              }
            } catch {
              // Ignore validation error in background
            }
          }

          setRecoveryMessage(
            restoredCoupon
              ? `Welcome back! Your saved tea selection has been restored with coupon ${restoredCoupon} applied.`
              : "Welcome back! Your saved tea selection has been restored."
          );
        }
      } catch {
        // Recovery hydration failure fails silently
      } finally {
        if (!isCancelled) {
          setIsRecovering(false);
        }
      }
    }

    restoreCart();

    return () => {
      isCancelled = true;
    };
  }, [recoveryToken]);

  // 2. Check for locally saved/unlocked coupon from previous visits or checkout
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)hth_applied_coupon=([^;]*)/);
      if (match && match[1]) {
        setCouponCode(decodeURIComponent(match[1]).trim().toUpperCase());
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  const trackedCart = useRef("");
  const trackingItems = JSON.stringify(items.map(line => ({ item_id: line.sku || (line.trialId ? line.trialId : (line.variantId ? `HTH-${line.variantId}` : "")), item_name: line.name, price: line.pricePaise / 100, quantity: line.quantity })));
  useEffect(() => {
    const record = () => {
      const lines = JSON.parse(trackingItems);
      if (lines.length && lines.every((line: { item_id: string }) => line.item_id) && trackedCart.current !== trackingItems && trackViewCart(lines, subtotal / 100)) trackedCart.current = trackingItems;
    };
    record(); window.addEventListener(CONSENT_EVENT, record);
    return () => window.removeEventListener(CONSENT_EVENT, record);
  }, [trackingItems, subtotal]);

  return (
    <div className="container page-shell cart-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/"> <StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" /> </Link> / <span aria-current="page"> <StorefrontText id="copy_b053c961f2acb0b9" fallback="Bag" /> </span>
      </nav>

      <CheckoutSteps currentStep={1} />

      <div className="cart-header-row">
        <div>
          <p className="eyebrow"> <StorefrontText id="copy_7c6640bda0391a00" fallback="Your selection" /> </p>
          <h1> <StorefrontText id="copy_518849e945ecc52d" fallback="Your tea bag." /> </h1>
        </div>
        {items.length > 0 && (
          <Link href="/shop" className="cart-continue-browsing"> <StorefrontText id="copy_c9bc95fdb7b9051e" fallback="← Continue shopping" /> </Link>
        )}
      </div>

      {/* Recovery Banner */}
      {recoveryMessage && (
        <div role="status" className="recovery-banner">
          <Check size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{recoveryMessage}</span>
        </div>
      )}

      {isRecovering && (
        <div className="recovering-banner" role="status"> <StorefrontText id="copy_0699e2cce2b613fa" fallback="Restoring your saved tea selection..." /> </div>
      )}

      {!items.length ? (
        <div className="empty-state">
          <h2> <StorefrontText id="copy_62e849af356a136b" fallback="Your tea shelf is empty." /> </h2>
          <p> <StorefrontText id="copy_cd9fb3a203fa5859" fallback="There is a beautiful cup waiting to be discovered from our Himalayan harvest." /> </p>
          <div className="button-row" style={{ justifyContent: "center", marginTop: "20px" }}>
            <Link href="/shop" className="button button-primary"> <StorefrontText id="copy_aebed38601ce6269" fallback="Explore tea collection" /> </Link>
            <Link href="/track" className="back-link"> <StorefrontText id="copy_e046d92f0e1fec87" fallback="Already placed an order? Track it →" /> </Link>
          </div>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-lines" role="list" aria-label="Items in your bag">
            {items.map((line) => {
              const itemImg = getCartItemImage(line);
              return (
                <div className="cart-line" role="listitem" key={line.trialId ? `trial-${line.trialId}` : `var-${line.variantId}`}>
                  <Link
                    href={line.trialId ? `/trials/${line.slug}` : `/tea/${line.slug}`}
                    className="cart-thumbnail-wrapper"
                    aria-label={`View details for ${line.name}`}
                  >
                    <CartItemImage
                      src={itemImg}
                      name={line.name || "Tea selection"}
                      size={64}
                      className="cart-thumbnail-img object-cover rounded-md"
                    />
                  </Link>

                  <div className="cart-line-details">
                    <Link href={line.trialId ? `/trials/${line.slug}` : `/tea/${line.slug}`} className="product-title">
                      {line.name}
                    </Link>
                    <p className="cart-line-meta">
                      {line.isWholesale ? (
                        <span className="wholesale-badge" style={{ background: "#eaf3e9", color: "#2e683f", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11, marginRight: 6 }}><StorefrontText id="copy_f007423ca322fd6d" fallback="🌿 Wholesale Slab" />
                        </span>
                      ) : null}
                      <span>
                        {line.grams >= 1000 ? `${line.grams / 1000} kg` : `${line.grams} g`}{" "}
                        {line.grams >= 10000 ? "Sack" : "Pouch"}
                      </span>
                      <span className="bullet">·</span>
                      <span>{formatINR(line.pricePaise)} <StorefrontText id="copy_bec1687971e36be5" fallback="each" /> </span>
                    </p>
                    <button
                      type="button"
                      className="cart-remove-btn"
                      onClick={() => remove(line.trialId || line.variantId)}
                      aria-label={"Remove " + line.name}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span> <StorefrontText id="copy_c3812fc4acb861d5" fallback="Remove" /> </span>
                    </button>
                  </div>

                  <div className="quantity-control cart-stepper">
                    <button
                      type="button"
                      aria-label={"Decrease quantity of " + line.name}
                      onClick={() => {
                        const min = line.isWholesale ? (line.wholesaleMoq || 50) : 1;
                        changeQuantity(line.trialId || line.variantId, Math.max(min, line.quantity - (line.isWholesale ? 10 : 1)));
                      }}
                      disabled={line.isWholesale ? line.quantity <= (line.wholesaleMoq || 50) : line.quantity <= 1}
                    >
                      {line.isWholesale ? "−10" : "−"}
                    </button>
                    <span aria-live="polite" aria-label={"Quantity: " + line.quantity}>
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={"Increase quantity of " + line.name}
                      onClick={() => changeQuantity(line.trialId || line.variantId, line.isWholesale ? Math.min(10000, line.quantity + 10) : line.quantity + 1)}
                      disabled={line.quantity >= (line.isWholesale ? 10000 : 20)}
                    >
                      {line.isWholesale ? "+10" : "+"}
                    </button>
                  </div>

                  <div className="cart-line-total">
                    <strong aria-label={"Line total " + formatINR(line.pricePaise * line.quantity)}>
                      {formatINR(line.pricePaise * line.quantity)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="cart-summary" aria-label="Order summary">
            <h2> <StorefrontText id="copy_6c200a8a390e2b61" fallback="Order summary" /> </h2>

            <p className="micro-note"> <StorefrontText id="copy_44209758ef5fbf82" fallback="Delivery, taxes and import charges are calculated for your address at checkout." /> </p>

            {/* Free-Shipping Progress Bar (Exempt for trials-only & wholesale) */}
            {!hasWholesale && !isTrialsOnly && (() => {
              const freePaise = storeConfig.freeShippingThresholdRupees * 100;
              const remainingPaise = Math.max(0, freePaise - subtotal);
              const pct = Math.min(100, Math.round((subtotal / Math.max(1, freePaise)) * 100));
              return (
                <div className="p-3 rounded-lg bg-[#f4f7f2] border border-[#dce3d8] mb-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#23483a] mb-1.5">
                    <span>
                      {remainingPaise > 0
                        ? `Add ₹${Math.ceil(remainingPaise / 100)} more for FREE Delivery across India!`
                        : "🎉 You unlocked FREE Delivery across India!"}
                    </span>
                    <span className="text-[11px] text-[#526359]">₹{storeConfig.freeShippingThresholdRupees}</span>
                  </div>
                  <div className="w-full bg-[#e4dfd5] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#23483a] h-full transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            <div className="cart-summary-calculations">
              <div className="summary-row">
                <span> <StorefrontText id="copy_8c0f2cb34079ede4" fallback="Subtotal" /> </span>
                <strong>{formatINR(subtotal)}</strong>
              </div>

              {discount > 0 && (
                <div className="summary-row coupon-discount-row">
                  <span> <StorefrontText id="copy_de3a70afd14a84aa" fallback="Coupon savings" /> <code className="coupon-tag">{couponCode}</code>
                  </span>
                  <strong className="discount-amount">−{formatINR(discount)}</strong>
                </div>
              )}

              <div className="summary-row">
                <span> <StorefrontText id="copy_20b84eb74315a1f7" fallback="Estimated Shipping" /> </span>
                <strong>
                  {hasWholesale
                    ? "Transport Charges Extra (To-Pay)"
                    : isTrialsOnly
                    ? "FREE (Included in Trial)"
                    : subtotal >= storeConfig.freeShippingThresholdRupees * 100
                    ? `FREE (₹${storeConfig.freeShippingThresholdRupees}+ unlocked)`
                    : `₹${storeConfig.flatShippingRupees} (Free above ₹${storeConfig.freeShippingThresholdRupees})`}
                </strong>
              </div>

              <div className="summary-row total-row">
                <span> <StorefrontText id="copy_17b50f174cae22ea" fallback="Merchandise estimate" /> </span>
                <strong>
                  {formatINR(
                    Math.max(
                      0,
                      subtotal - discount
                    )
                  )}
                </strong>
              </div>
            </div>

            {/* PIN Code Delivery Estimator */}
            {!hasWholesale && (
              <form onSubmit={handleCheckPin} className="my-3 p-3 rounded-lg bg-[#fbf9f4] border border-[#e4dfd5] space-y-2">
                <label htmlFor="cart-pin-estimator" className="block text-[11px] font-semibold text-[#171713]">
                  Check Delivery &amp; COD by PIN Code
                </label>
                <div className="flex gap-2">
                  <input
                    id="cart-pin-estimator"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (pinEstimate) setPinEstimate(null);
                    }}
                    placeholder="e.g. 734001"
                    className="flex-1 min-h-[38px] px-2.5 py-1.5 text-xs border border-[#b8b5a8] rounded bg-white"
                  />
                  <button
                    type="submit"
                    disabled={pinLoading}
                    className="px-3 py-1.5 min-h-[38px] rounded bg-[#23483a] text-white text-xs font-semibold hover:bg-[#1a382d] disabled:opacity-50"
                  >
                    {pinLoading ? "Checking…" : "Check"}
                  </button>
                </div>
                {pinEstimate && (
                  <p className={`text-[11px] font-medium ${pinEstimate.ok ? "text-[#166534]" : "text-[#991b1b]"}`}>
                    {pinEstimate.ok
                      ? `${[pinEstimate.city, pinEstimate.state].filter(Boolean).join(", ") || "India"} · Est. ${pinEstimate.estimatedDays}${pinEstimate.codAllowed ? " · COD available" : ""}`
                      : pinEstimate.error || "Unable to verify PIN."}
                  </p>
                )}
              </form>
            )}

            {hasWholesale && (
              <div style={{ background: "#fff9ed", border: "1px solid #eedab2", borderRadius: 6, padding: "10px 12px", margin: "14px 0", fontSize: 12, color: "#7d5615", display: "flex", gap: 8, alignItems: "start" }}>
                <span style={{ fontSize: 16 }}>🚛</span>
                <div>
                  <strong style={{ display: "block", color: "#684407", marginBottom: 2 }}><StorefrontText id="copy_cc3aa6a6436eec99" fallback="Commercial Transport Notice:" /></strong>
                  <span><StorefrontText id="copy_dd0177d8b304cf26" fallback="Your bag contains bulk wholesale items. Dispatch is arranged via commercial surface road transport." /> <strong><StorefrontText id="copy_11d3d58caeef6691" fallback="Transport charges are extra" /></strong><StorefrontText id="copy_dcffd679c362f8fc" fallback="and payable directly to the transporter upon delivery (To-Pay Bilty)." /></span>
                </div>
              </div>
            )}

            <div className="cart-coupon-wrapper">
              <CouponField
                id="cart-coupon"
                initialCode={couponCode}
                subtotalPaise={subtotal}
                onApplied={(code, d) => {
                  setCouponCode(code);
                  setDiscount(d);
                  try {
                    document.cookie = `hth_applied_coupon=${encodeURIComponent(code)}; path=/; max-age=604800; SameSite=Lax`;
                  } catch {}
                }}
                onCleared={() => {
                  setCouponCode("");
                  setDiscount(0);
                  try {
                    document.cookie = "hth_applied_coupon=; path=/; max-age=0";
                  } catch {}
                }}
              />
            </div>

            {(() => {
              const codMinPaise = storeConfig.codMinRupees * 100;
              const isBlockedSubMinCod =
                !hasWholesale &&
                !isTrialsOnly &&
                !storeConfig.onlinePaymentEnabled &&
                storeConfig.codEnabled &&
                codMinPaise > 0 &&
                subtotal < codMinPaise;

              if (isBlockedSubMinCod) {
                const deficitRupees = Math.ceil((codMinPaise - subtotal) / 100);
                const waDigits = storeConfig.whatsappNumber.replace(/\D/g, "") || "917001304853";
                return (
                  <>
                    <div className="p-3.5 rounded-lg bg-[#fff8eb] border border-[#f5dfb8] text-xs text-[#85570e] my-3 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#684407]">
                        <span>⚠️ Online Payments Temporarily Paused · COD Min ₹{storeConfig.codMinRupees}</span>
                      </div>
                      <p>
                        Online payment gateways are temporarily offline. Cash on Delivery requires a minimum order of{" "}
                        <strong>₹{storeConfig.codMinRupees}</strong>. Add <strong>₹{deficitRupees}</strong> more to unlock COD checkout.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Link href="/shop" className="text-[#23483a] font-bold underline hover:text-[#142d24]">
                          + Browse &amp; add more teas →
                        </Link>
                        <a
                          href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi TeaFloww! My bag is ₹${Math.round(subtotal / 100)} and I'd like help placing my order.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#128c7e] font-semibold underline"
                        >
                          Order via WhatsApp →
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="button button-primary cart-checkout-button opacity-60 cursor-not-allowed"
                    >
                      <span>Add ₹{deficitRupees} more to unlock COD checkout</span>
                    </button>
                  </>
                );
              }

              return (
                <Link
                  href={
                    couponCode
                      ? `/checkout?coupon=${encodeURIComponent(couponCode)}`
                      : "/checkout"
                  }
                  className="button button-primary cart-checkout-button"
                >
                  <span> <StorefrontText id="copy_5c91f1da3fd8bb91" fallback="Continue to checkout" /> </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              );
            })()}

            <SubscribeLink bag />
            <ul className="cart-trust-bullets" aria-label="Order perks">
              <li>
                <ShieldCheck size={16} aria-hidden="true" />
                <span> <StorefrontText id="copy_547d7a59a4d90801" fallback="Guest checkout · No account creation required" /> </span>
              </li>
              <li>
                <Lock size={16} aria-hidden="true" />
                <span>Secure checkout · Encrypted payment & order tracking</span>
              </li>
            </ul>

            <div className="cart-track-link-wrap">
              <Link href="/track" className="back-link"> <StorefrontText id="copy_6d08c3dfe4632c2a" fallback="Already ordered? Track your order →" /> </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="container page-shell cart-page">
          <p> <StorefrontText id="copy_bb97a0bd3aabd7e6" fallback="Loading your tea selection..." /> </p>
        </div>
      }
    >
      <CartPageContent />
    </Suspense>
  );
}
