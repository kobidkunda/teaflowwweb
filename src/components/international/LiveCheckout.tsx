"use client";

import React, { useEffect, useRef, useState } from "react";
import { CONSENT_EVENT } from "@/lib/seo/consent";
import type { quoteAnalytics } from "@/lib/international/analytics";
import type { CustomerAddress } from "@/lib/customerAddresses";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo } from "@/lib/seo/tracking";
import { useCart } from "@/components/CartProvider";
import { useInternational } from "./InternationalProvider";
import { formatMoney } from "@/lib/international/money";
import { generateUUID } from "@/lib/uuid";
import {
  Zap,
  CreditCard,
  Building2,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Lock,
  Clock,
  X,
  ShoppingBag,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/wholesale/WholesaleForm";
import { PhoneInputField, validatePhoneNumber } from "@/components/checkout/PhoneInputField";

type QuoteView = {
  id: string;
  currency: string;
  totalMinor: number;
  expires: number;
  dutiesMode: string;
  components: Record<string, number>;
  analytics?: ReturnType<typeof quoteAnalytics>;
  method?: string;
  paymentDiscountPaise?: number;
  wholesale?: {
    isWholesale: boolean;
    advancePercent: number;
    advancePaise: number;
    balancePaise: number;
    advanceMinor: number;
    balanceMinor: number;
    bankDetails: {
      beneficiary: string;
      bankName: string;
      accountNumber: string;
      ifsc: string;
      branch: string;
      upiId: string;
    };
  };
};

type Payment = {
  orderId: string;
  token: string;
  keyId: string;
  gatewayOrderId: string | null;
  amount: number;
  currency: string;
  paymentStatus: string;
  expires: number;
  gateway?: "razorpay" | "youpi";
  checkoutUrl?: string;
};

type PaymentMethodsConfig = {
  onlinePaymentEnabled?: boolean;
  whatsappNumber?: string;
  discounts: {
    upi: { enabled: boolean; type: "percentage" | "flat"; value: number; maxRupees: number };
    card: { enabled: boolean; type: "percentage" | "flat"; value: number; maxRupees: number };
    netbanking: { enabled: boolean; type: "percentage" | "flat"; value: number; maxRupees: number };
    cod: {
      enabled: boolean;
      feePaise: number;
      feeRupees?: number;
      minRupees?: number;
      maxRupees?: number;
      minPaise?: number;
      maxPaise?: number;
      postcodes?: string[];
    };
    minOrderRupees: number;
    badgeText: string;
  };
  shipping: {
    minDeliveryOrderRupees?: number;
    minDeliveryOrderPaise?: number;
    freeShippingThresholdRupees: number;
    freeShippingThresholdPaise: number;
    shippingFlatFeeRupees: number;
    shippingFlatFeePaise: number;
    freeShippingEnabled: boolean;
    dispatchCommitment: string;
  };
  wholesale?: {
    advancePercent: number;
    bankDetails: {
      beneficiary: string;
      bankName: string;
      accountNumber: string;
      ifsc: string;
      branch: string;
      upiId: string;
    };
  };
};

import { loadCheckout } from "@/components/checkout/razorpay";

export function LiveCheckout() {
  const ctx = useInternational();
  const cart = useCart();
  const form = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const initialCoupon = searchParams ? searchParams.get("coupon") || "" : "";

  const [quoteResult, setQuoteResult] = useState<{ view: QuoteView; input: string } | null>(null);
  const requestSequence = useRef(0);
  const [couponCode, setCouponCode] = useState(initialCoupon);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentCurrency, setPaymentCurrency] = useState(ctx?.currency || "INR");
  const [method, setMethod] = useState<"upi" | "card" | "netbanking" | "cod" | "prepaid" | "bank_transfer">("upi");
  const [inrAccepted, setInrAccepted] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentMethodsConfig | null>(null);
  const onlinePaymentEnabled = paymentConfig?.onlinePaymentEnabled ?? true;

  const hasWholesaleInCart = cart.items.some((i) => i.isWholesale || (typeof i.quantity === "number" && i.quantity > 20));
  const isWholesale = Boolean(quoteResult?.view?.wholesale?.isWholesale || hasWholesaleInCart);
  const wholesaleAdvancePercent = quoteResult?.view?.wholesale?.advancePercent ?? paymentConfig?.wholesale?.advancePercent ?? 0;

  useEffect(() => {
    if (isWholesale) {
      if (wholesaleAdvancePercent === 0 && method !== "bank_transfer") {
        setMethod("bank_transfer");
      } else if (wholesaleAdvancePercent > 0 && (method === "cod" || method === "bank_transfer")) {
        setMethod("upi");
      }
    } else if (paymentConfig && paymentConfig.onlinePaymentEnabled === false && method !== "cod") {
      setMethod("cod");
    }
  }, [isWholesale, wholesaleAdvancePercent, paymentConfig, method]);

  const key = useRef("");
  const quotedItems = useRef("");
  const beganCheckout = useRef(false);
  const paymentTracked = useRef("");
  useEffect(() => {
    const record = () => {
      if (!beganCheckout.current && cart.items.length && cart.items.every(i => i.sku || i.trialId || i.variantId)) {
        beganCheckout.current = trackBeginCheckout(cart.items.map(i => ({ item_id: i.sku || i.trialId || `HTH-${i.variantId}`, item_name: i.name, price: i.pricePaise / 100, quantity: i.quantity })), cart.subtotal / 100, "INR");
      }
    };
    record(); window.addEventListener(CONSENT_EVENT, record);
    return () => window.removeEventListener(CONSENT_EVENT, record);
  }, [cart.items, cart.subtotal]);
  const t = (id: string) => ctx?.texts[id] || id;
  const [country, setCountry] = useState(ctx?.country || "IN");

  const [customer, setCustomer] = useState<{ id: string; name?: string; email: string; phone?: string } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postcode: "",
  });

  // Fetch logged in customer and their saved addresses
  useEffect(() => {
    let active = true;
    fetch("/api/customer/me?optional=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.customer) return;
        setCustomer(data.customer);
        setFormData((prev) => ({
          ...prev,
          name: data.customer.name || prev.name,
          email: data.customer.email || prev.email,
          phone: data.customer.phone || prev.phone,
        }));
        return fetch("/api/customer/addresses")
          .then((res) => (res.ok ? res.json() : null))
          .then((addrData) => {
            if (!active || !addrData?.addresses?.length) return;
            setSavedAddresses(addrData.addresses);
            const def = addrData.addresses.find((a: CustomerAddress) => a.is_default === 1) || addrData.addresses[0];
            if (def) {
              setSelectedAddressId(def.id);
              const loadedAddr = {
                name: def.name || data.customer.name || "",
                phone: def.phone || data.customer.phone || "",
                email: data.customer.email || "",
                line1: def.address_line1 || "",
                line2: def.address_line2 || "",
                city: def.city || "",
                state: def.state || "",
                postcode: def.postal_code || "",
              };
              setFormData(loadedAddr);
              if (def.country) setCountry(def.country);
              // The quote effect recalculates after the saved address is loaded.
            }
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch payment and shipping configuration for live badges
  useEffect(() => {
    let cancelled = false;
    fetch("/api/commerce/payment-methods")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setPaymentConfig(data);
          if (data.onlinePaymentEnabled === false) {
            setMethod("cod");
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const itemsSignature = JSON.stringify(cart.items.map(i => ({ variantId: i.variantId, ...(i.trialId ? { trialId: i.trialId } : {}), quantity: i.quantity })));
  const quoteInput = JSON.stringify({ items: itemsSignature, formData, country, method, paymentCurrency, couponCode, onlinePaymentEnabled });
  const latestInput = useRef(quoteInput);
  latestInput.current = quoteInput;
  const quote = quoteResult?.input === quoteInput ? quoteResult.view : null;

  const invalidate = () => {
    requestSequence.current++;
    setQuoteResult(null);
    setBusy(false);
    key.current = "";
    setFieldErrors({});
  };

  const errorDialogRef = useRef<HTMLDialogElement>(null);
  const [modalError, setModalError] = useState<{
    title: string;
    message: string;
    detail?: string;
    type: "expired" | "address" | "cart" | "payment" | "general";
  } | null>(null);

  const showErrorModal = (
    message: string,
    explicitType?: "expired" | "address" | "cart" | "payment" | "general"
  ) => {
    if (!message) return;
    setError(message);

    let type = explicitType;
    if (!type) {
      const lower = message.toLowerCase();
      if (lower.includes("expired") || lower.includes("expire") || message === t("expired")) {
        type = "expired";
      } else if (
        lower.includes("address") ||
        lower.includes("pin") ||
        lower.includes("postcode") ||
        lower.includes("delivery is not available") ||
        lower.includes("highlighted fields")
      ) {
        type = "address";
      } else if (
        lower.includes("bag") ||
        lower.includes("item") ||
        lower.includes("stock") ||
        lower.includes("unavailable") ||
        lower.includes("empty")
      ) {
        type = "cart";
      } else if (
        lower.includes("payment") ||
        lower.includes("gateway") ||
        lower.includes("card") ||
        lower.includes("upi")
      ) {
        type = "payment";
      } else {
        type = "general";
      }
    }

    let title = "Checkout Notice";
    let detail = "";

    if (type === "expired") {
      title = "Quote Expired";
      detail =
        "To guarantee real-time shipping rates, fresh inventory stock, and instant payment discounts, quotes remain active for 15 minutes. Click below to recalculate an updated total.";
    } else if (type === "address") {
      title = "Delivery Notice";
      detail =
        "Please check your shipping address and 6-digit PIN code to ensure courier serviceability.";
    } else if (type === "cart") {
      title = "Bag & Stock Notice";
      detail =
        "One or more teas in your bag may have adjusted availability or require a different quantity.";
    } else if (type === "payment") {
      title = "Payment Notice";
      detail =
        "No money was charged. You can retry with your payment provider or select an alternative method like Cash on Delivery.";
    }

    setModalError({
      title,
      message,
      detail,
      type,
    });
  };

  const closeErrorModal = () => {
    setModalError(null);
    if (errorDialogRef.current?.open) {
      errorDialogRef.current.close();
    }
  };

  const handleRecalculateFromModal = () => {
    closeErrorModal();
    computeQuote(method, formData, country, false);
  };

  // Pre-filled WhatsApp assistance URL with complete checkout context
  const checkoutWhatsAppUrl = React.useMemo(() => {
    const rawNumber = paymentConfig?.whatsappNumber || "917001304853";
    const helpline = rawNumber.replace(/\D/g, "") || "917001304853";
    const lines: string[] = [
      "🌿 *TeaFloww Live Checkout Assistance*",
      "",
      "Hello TeaFloww Sommelier & Dispatch Desk,",
      "I'm at the checkout page and would like live help with my order:",
      "",
    ];

    const customerName = formData.name.trim() || customer?.name?.trim();
    if (customerName) {
      lines.push(`• *Name:* ${customerName}`);
    }

    const contactPhone = formData.phone.trim() || customer?.phone?.trim();
    if (contactPhone) {
      lines.push(`• *Contact Phone:* ${contactPhone}`);
    }

    const cityLoc = [formData.city.trim(), formData.state.trim(), formData.postcode.trim(), country || "IN"].filter(Boolean).join(", ");
    if (cityLoc) {
      lines.push(`• *Delivery Destination:* ${cityLoc}`);
    }

    if (cart.items.length > 0) {
      const itemsText = cart.items
        .map((i) => `${i.quantity}x ${i.name}${i.grams ? ` (${i.grams}g)` : ""}`)
        .join("; ");
      lines.push(`• *Bag Items:* ${itemsText}`);
    }

    if (quote) {
      lines.push(`• *Calculated Total:* ${formatMoney(quote.totalMinor, quote.currency, ctx?.locale)}`);
      lines.push(`• *Quote ID:* ${quote.id.slice(0, 8)}...`);
    } else if (cart.subtotal > 0) {
      lines.push(`• *Bag Subtotal:* ₹${Math.round(cart.subtotal / 100)}`);
    }

    if (method) {
      lines.push(`• *Preferred Payment:* ${method.toUpperCase()}`);
    }

    if (error) {
      lines.push(`• *Notice / Issue:* ${error}`);
    } else if (Object.keys(fieldErrors).length > 0) {
      const activeErrors = Object.entries(fieldErrors)
        .filter(([, msg]) => Boolean(msg))
        .map(([k, msg]) => `${k}: ${msg}`)
        .join("; ");
      if (activeErrors) {
        lines.push(`• *Stuck on field:* ${activeErrors}`);
      }
    }

    lines.push("", "Could you please help me verify details and complete this checkout?");

    return `https://wa.me/${helpline}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [formData, customer, country, cart.items, cart.subtotal, quote, ctx?.locale, method, error, fieldErrors, paymentConfig?.whatsappNumber]);

  // Open / close native <dialog> based on modalError state
  useEffect(() => {
    const dialog = errorDialogRef.current;
    if (!dialog) return;

    if (modalError) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Dialog may already be open
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [modalError]);

  // Modern Web Guidance: Native dialog close sync & light-dismiss fallback for browsers without native <dialog closedby="any"> (e.g. Safari)
  useEffect(() => {
    const dialog = errorDialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      setModalError(null);
    };
    dialog.addEventListener("close", handleNativeClose);

    let removePointerListener: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;

      const isOutside = (e: PointerEvent, el: HTMLDialogElement) => {
        const r = el.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };

      const handlePointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e, dialog);
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e, dialog)) {
          dialog.close();
        }
      };

      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);

      removePointerListener = () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      if (removePointerListener) removePointerListener();
    };
  }, []);

  const isAddressComplete = (addr: typeof formData, c: string) => {
    const name = addr.name.trim();
    const phone = addr.phone.trim();
    const email = addr.email.trim();
    const line1 = addr.line1.trim();
    const city = addr.city.trim();
    const state = addr.state.trim();
    const postcode = addr.postcode.trim().replace(/\s+/g, "");

    return (
      name.length >= 2 &&
      validatePhoneNumber(phone, c) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      line1.length >= 5 &&
      city.length > 0 &&
      state.length > 0 &&
      (c !== "IN" || /^\d{6}$/.test(postcode))
    );
  };

  // Auto-sync checkout contact & partial shipping details to abandoned cart as user types
  const syncCustomerDetails = cart.syncCustomerDetails;
  useEffect(() => {
    if (!cart.items.length) return;
    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim();
    const cleanEmail = formData.email.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, "");
    const hasMeaningfulContact =
      cleanName.length >= 2 ||
      phoneDigits.length >= 7 ||
      cleanEmail.includes("@");
    if (!hasMeaningfulContact) return;

    const addressLine = [formData.line1.trim(), formData.line2.trim()].filter(Boolean).join(", ");
    const timer = setTimeout(() => {
      syncCustomerDetails({
        name: cleanName || undefined,
        phone: phoneDigits.length >= 7 ? cleanPhone : undefined,
        email: cleanEmail.includes("@") ? cleanEmail : undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        postcode: formData.postcode.trim() || undefined,
        address: addressLine || undefined,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    cart.items.length,
    formData.name,
    formData.phone,
    formData.email,
    formData.line1,
    formData.line2,
    formData.city,
    formData.state,
    formData.postcode,
    syncCustomerDetails,
  ]);

  // Auto-quote calculation effect with debounce when valid address details are typed
  useEffect(() => {
    if (!cart.items.length) return;
    if (!isAddressComplete(formData, country)) return;

    const timer = setTimeout(() => {
      computeQuote(method, formData, country, true);
    }, 400);

    return () => clearTimeout(timer);
  }, [formData, country, method, itemsSignature, paymentCurrency, couponCode, onlinePaymentEnabled]);

  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(() => {
      invalidate();
      const expMsg = t("expired");
      setError(expMsg);
      showErrorModal(expMsg, "expired");
    }, Math.max(0, quote.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [quote]);

  // Trigger or re-trigger quote calculation
  async function computeQuote(
    selectedMethod = method,
    explicitAddress?: typeof formData,
    explicitCountry?: string,
    silent = false
  ) {
    if (!cart.items.length) {
      if (!silent) {
        const emptyMsg = "Your shopping bag is empty.";
        setError(emptyMsg);
        showErrorModal(emptyMsg, "cart");
      }
      return;
    }

    const sequence = ++requestSequence.current;
    const inputSnapshot = quoteInput;
    setQuoteResult(null);
    const activeAddress = explicitAddress || formData;
    const activeCountry = explicitCountry || country || "IN";
    const coupon = couponCode.trim();

    const address = {
      name: (activeAddress.name || "").trim(),
      phone: (activeAddress.phone || "").trim(),
      email: (activeAddress.email || "").trim(),
      country: activeCountry,
      line1: (activeAddress.line1 || "").trim(),
      line2: (activeAddress.line2 || "").trim(),
      city: (activeAddress.city || "").trim(),
      state: (activeAddress.state || "").trim(),
      postcode: (activeAddress.postcode || "").trim(),
    };
    if (address.country === "IN") {
      address.postcode = address.postcode.replace(/\s+/g, "");
    }

    // Client-side validation with instant inline feedback
    const clientErrors: Record<string, string> = {};
    if (!address.name || address.name.length < 2) {
      clientErrors.name = "Please enter your full name (at least 2 characters).";
    }
    if (!address.phone || !validatePhoneNumber(address.phone, address.country)) {
      clientErrors.phone = "Please enter a valid contact phone number with country code.";
    }
    if (!address.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      clientErrors.email = "Please enter a valid email address.";
    }
    if (!address.line1 || address.line1.length < 5) {
      clientErrors.line1 = "Please enter your street address (at least 5 characters).";
    }
    if (!address.city) {
      clientErrors.city = "Please enter your city.";
    }
    if (!address.state) {
      clientErrors.state = "Please enter your state or region.";
    }
    if (address.country === "IN" && !/^\d{6}$/.test(address.postcode)) {
      clientErrors.postcode = "Please enter a 6-digit PIN code.";
    }

    if (Object.keys(clientErrors).length > 0) {
      if (!silent) {
        setFieldErrors(clientErrors);
        const valMsg = "Please check the highlighted fields on your address.";
        setError(valMsg);
        showErrorModal(valMsg, "address");
      }
      return;
    }

    setError("");
    setFieldErrors({});
    setBusy(true);

    try {
      const items = cart.items
        .map((i) => {
          const isTrial = Boolean(i.trialId && String(i.trialId).trim());
          return {
            variantId: isTrial ? 0 : Number(i.variantId) || 0,
            ...(isTrial ? { trialId: String(i.trialId).trim() } : {}),
            quantity: Math.min(20, Math.max(1, Number(i.quantity) || 1)),
          };
        })
        .filter((i) => (i.trialId ? i.variantId === 0 : i.variantId > 0));

      const effectiveMethod = !onlinePaymentEnabled ? "cod" : selectedMethod;

      const response = await fetch("/api/commerce/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          currency: paymentCurrency,
          locale: ctx?.locale || "en",
          method: effectiveMethod,
          coupon: coupon || "",
          items,
        }),
      });

      const result = await response.json();
      if (sequence !== requestSequence.current || latestInput.current !== inputSnapshot) return;
      if (!response.ok) {
        if (Array.isArray(result.detail)) {
          const mapped: Record<string, string> = {};
          let itemIssue = "";
          for (const item of result.detail) {
            const key = item.path?.replace(/^address\./, "") || "";
            if (item.path?.startsWith("items")) {
              itemIssue = "An item in your bag is unavailable or invalid. Please check your bag.";
            } else if (key) {
              mapped[key] = item.message;
            }
          }
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped);
          }
          if (itemIssue) {
            throw new Error(itemIssue);
          }
        }
        throw new Error(result.error || "Unable to calculate total.");
      }

      setQuoteResult({ view: result, input: inputSnapshot });
      if (result.analytics) {
        trackAddShippingInfo("destination_quote", result.analytics.items, result.analytics.value, result.analytics.currency);
      }
      key.current = generateUUID();
      quotedItems.current = JSON.stringify(items);
    } catch (e) {
      if (sequence !== requestSequence.current || latestInput.current !== inputSnapshot) return;
      const calcMsg = e instanceof Error ? e.message : "Unable to calculate total.";
      setError(calcMsg);
      if (!silent) {
        showErrorModal(calcMsg);
      }
    } finally {
      if (sequence === requestSequence.current) setBusy(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    computeQuote(method, formData, country, false);
  }

  function handleMethodChange(newMethod: "upi" | "card" | "netbanking" | "cod" | "prepaid" | "bank_transfer") {
    if (!onlinePaymentEnabled && newMethod !== "cod") return;
    setMethod(newMethod);
    key.current = generateUUID();
    // The quote effect uses the newly selected method.
  }

  async function pay() {
    if (!quote) return;
    if (country !== "IN" && quote.currency === "INR" && !inrAccepted) {
      const inrMsg = "Please confirm acceptance of the INR charge before continuing.";
      setError(inrMsg);
      showErrorModal(inrMsg, "general");
      return;
    }
    if (
      Date.now() >= quote.expires ||
      JSON.stringify(cart.items.map((i) => ({ variantId: i.variantId, ...(i.trialId ? { trialId: i.trialId } : {}), quantity: i.quantity }))) !== quotedItems.current
    ) {
      invalidate();
      const expMsg = t("expired");
      setError(expMsg);
      showErrorModal(expMsg, "expired");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (method !== "cod") await loadCheckout();

      if (!key.current || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key.current)) {
        key.current = generateUUID();
      }

      if (!quote.id || quote.method !== method || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quote.id)) {
        await computeQuote(method, formData, country, false);
        return;
      }

      const response = await fetch("/api/commerce/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          idempotencyKey: key.current,
          currencyAcceptance: quote.currency,
          inrAcceptance: inrAccepted,
          method: method,
        }),
      });

      const p: Payment & { error?: string; preferredMethod?: string } = await response.json();
      if (!response.ok) throw new Error(p.error);

      if (quote.analytics && paymentTracked.current !== quote.id) {
        if (trackAddPaymentInfo(method, quote.analytics.items, quote.analytics.value, quote.analytics.currency)) paymentTracked.current = quote.id;
      }

      if (saveAddressToAccount && customer) {
        fetch("/api/customer/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            address_line1: formData.line1,
            address_line2: formData.line2,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postcode,
            country,
          }),
        }).catch(() => {});
      }

      const resultUrl = `/purchase/${p.orderId}?token=${encodeURIComponent(p.token)}`;
      // Cash on Delivery must ALWAYS go directly to the confirmation order receipt, NEVER to YouPI or payment gateway!
      if (method === "cod" || p.preferredMethod === "cod" || p.paymentStatus === "cod_due" || p.paymentStatus === "paid") {
        if (method === "cod" && p.paymentStatus !== "cod_due" && p.paymentStatus !== "paid") {
          const codMsg = "Cash on Delivery could not be confirmed for this order. Please check bag requirements or re-verify address.";
          setError(codMsg);
          showErrorModal(codMsg, "general");
          setBusy(false);
          return;
        }
        cart.clear();
        window.location.assign(resultUrl);
        return;
      }

      if (method === "bank_transfer" || p.preferredMethod === "bank_transfer" || p.paymentStatus === "pending_bank_transfer") {
        cart.clear();
        window.location.assign(resultUrl);
        return;
      }

      if (p.gateway === "youpi" && p.checkoutUrl) {
        window.location.assign(p.checkoutUrl);
        return;
      }

      if (Date.now() >= p.expires) {
        const expErr = t("expired");
        showErrorModal(expErr, "expired");
        throw new Error(expErr);
      }

      const formFields = form.current ? new FormData(form.current) : null;
      const widget = new window.Razorpay!({
        key: p.keyId,
        order_id: p.gatewayOrderId,
        amount: p.amount,
        currency: p.currency,
        name: "TeaFloww",
        description: "Direct-from-origin Himalayan orthodox teas",
        handler: () => {
          cart.clear();
          window.location.assign(resultUrl);
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#23483A" },
        prefill: {
          name: (formFields?.get("name") as string) || undefined,
          email: (formFields?.get("email") as string) || undefined,
          contact: (formFields?.get("phone") as string) || undefined,
          method: method === "upi" ? "upi" : method === "card" ? "card" : method === "netbanking" ? "netbanking" : undefined,
        },
        config:
          method === "upi"
            ? {
                display: {
                  blocks: {
                    upi: {
                      name: "Pay via UPI / QR Code",
                      instruments: [{ method: "upi" }],
                    },
                  },
                  sequence: ["block.upi"],
                },
              }
            : undefined,
      });

      widget.on("payment.failed", () => {
        const failMsg = "Payment was not completed. You can retry with another payment method.";
        setError(failMsg);
        showErrorModal(failMsg, "payment");
        setBusy(false);
      });
      widget.open();
    } catch (e) {
      const payErr = e instanceof Error ? e.message : "Unable to initiate payment.";
      setError(payErr);
      showErrorModal(payErr, "payment");
      setBusy(false);
    }
  }

  // Minimum Delivery Order & Free shipping threshold calculations
  const cartSubtotalRupees = Math.round((cart.subtotal || 0) / 100);
  const minDeliveryOrder = paymentConfig?.shipping.minDeliveryOrderRupees || 0;
  const isBelowMinDeliveryOrder = country === "IN" && minDeliveryOrder > 0 && cartSubtotalRupees < minDeliveryOrder;
  const minOrderDeficit = Math.max(0, minDeliveryOrder - cartSubtotalRupees);

  const freeThreshold = paymentConfig?.shipping.freeShippingThresholdRupees || 599;
  const remainingForFree = Math.max(0, freeThreshold - cartSubtotalRupees);
  const shippingProgressPercent = Math.min(100, Math.round((cartSubtotalRupees / freeThreshold) * 100));

  const upiValue = paymentConfig?.discounts.upi.value || 2;
  const cardValue = paymentConfig?.discounts.card.value || 1;

  const codConfig = paymentConfig?.discounts.cod;
  const codEnabled = country === "IN" && (codConfig?.enabled ?? true);
  const codFee = codConfig?.feeRupees ?? Math.round((codConfig?.feePaise || 5000) / 100);
  const codMin = codConfig?.minRupees ?? 100;
  const codMax = codConfig?.maxRupees ?? 5000;
  const isCodSubtotalValid = (!codMin || cartSubtotalRupees >= codMin) && (!codMax || cartSubtotalRupees <= codMax);

  return (
    <div className="tf-live-checkout-v2 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT COLUMN: Customer Info, Shipping Address, Payment Method */}
      <div className="lg:col-span-7 space-y-6">
        {/* Minimum Delivery Order Requirement Alert */}
        {isBelowMinDeliveryOrder && (
          <div className="p-4 rounded-xl border border-[#fca5a5] bg-[#fef2f2] text-xs sm:text-sm text-[#991b1b] flex items-center gap-3 shadow-sm">
            <span className="text-base font-bold flex-shrink-0">⚠️</span>
            <div>
              <strong>Minimum Delivery Order Required:</strong> The minimum order value for delivery is{" "}
              <strong>₹{minDeliveryOrder}</strong>. Please add <strong>₹{minOrderDeficit}</strong> more to your bag to complete checkout.
            </div>
          </div>
        )}

        {/* Free Shipping Alert Bar */}
        {country === "IN" && (
          <div className="p-4 rounded-xl border border-[#dce3d8] bg-[#f4f7f2] shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-[#23483a] mb-2">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#b39156]" />
                {remainingForFree > 0
                  ? `Add ₹${remainingForFree} more for FREE Delivery across India!`
                  : "🎉 Congratulations! You have unlocked FREE Delivery across India!"}
              </span>
              <span>₹{freeThreshold} Threshold</span>
            </div>
            <div className="w-full bg-[#eae6db] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#23483a] h-full transition-all duration-300"
                style={{ width: `${shippingProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Customer Account / Sign In Status Bar */}
        {customer ? (
          <div className="p-4 rounded-xl border border-[#c6d7c5] bg-[#f2f7f0] flex items-center justify-between text-xs text-[#23483a]">
            <div>
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#23483a]" />
                Signed in as {customer.name || customer.email}
              </p>
              <p className="text-[11px] text-[#4b594e] mt-0.5">
                Saved addresses and orders are linked to your TeaFloww account.
              </p>
            </div>
            <Link
              href="/account"
              className="px-3 py-1.5 rounded-lg border border-[#23483a] text-[#23483a] font-semibold hover:bg-[#23483a] hover:text-white transition-colors"
            >
              My Account
            </Link>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-[#e4ded3] bg-[#faf8f4] flex items-center justify-between text-xs text-[#524e46]">
            <span>Have a TeaFloww account?</span>
            <Link
              href="/login?redirect=/checkout"
              className="text-[#23483a] font-bold hover:underline"
            >
              Sign in for 1-click address autofill →
            </Link>
          </div>
        )}

        {/* Saved Addresses Quick Selector */}
        {customer && savedAddresses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#737067]">
                Saved Addresses
              </span>
              <Link href="/account/addresses" className="text-[11px] text-[#23483a] hover:underline font-semibold">
                Manage Addresses →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedAddresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setSelectedAddressId(addr.id);
                      const selectedAddr = {
                        name: addr.name || customer.name || "",
                        phone: addr.phone || customer.phone || "",
                        email: customer.email,
                        line1: addr.address_line1 || "",
                        line2: addr.address_line2 || "",
                        city: addr.city || "",
                        state: addr.state || "",
                        postcode: addr.postal_code || "",
                      };
                      setFormData(selectedAddr);
                      const targetCountry = addr.country || country || "IN";
                      if (addr.country) setCountry(addr.country);
                      setFieldErrors({});
                      computeQuote(method, selectedAddr, targetCountry, false);
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "border-[#23483a] bg-[#f5f8f4] shadow-sm ring-1 ring-[#23483a]"
                        : "border-[#dcd6c8] bg-white hover:border-[#b39156]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#171713]">{addr.name}</span>
                      {addr.is_default === 1 && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#e8e2d4] text-[#697a55] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#524e46] truncate">{addr.address_line1}</p>
                    <p className="text-xs text-[#524e46]">
                      {addr.city}, {addr.state} — {addr.postal_code}
                    </p>
                    <p className="text-[11px] text-[#737067] mt-1">{addr.phone}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form ref={form} onSubmit={handleFormSubmit} className="tf-ops-card space-y-6">
          <div>
            <h2 className="text-2xl font-serif text-[#171713] font-normal mb-1">{t("checkout")}</h2>
            <p className="text-sm text-[#46524a]">1. Enter your delivery address details below.</p>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#737067]">Contact Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
                {t("name")} *
                <input
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="e.g. Ananya Roy"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  className={`w-full min-h-[46px] border ${fieldErrors.name ? "border-red-500 bg-red-50" : "border-[#b8b5a8] bg-[#fffefa]"} rounded-md px-3 py-2 text-sm`}
                />
                {fieldErrors.name && <span className="text-[11px] text-red-600 font-medium">{fieldErrors.name}</span>}
              </label>

              <div className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
                <label htmlFor="checkout-phone-input" className="text-xs font-semibold text-[#171713]">
                  {t("phone")} *
                </label>
                <PhoneInputField
                  id="checkout-phone-input"
                  name="phone"
                  required
                  country={country}
                  value={formData.phone}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, phone: val }));
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  error={fieldErrors.phone}
                  aria-describedby={fieldErrors.phone ? "checkout-phone-error" : undefined}
                />
                {fieldErrors.phone ? (
                  <span id="checkout-phone-error" className="text-[11px] text-red-600 font-medium" role="alert">
                    {fieldErrors.phone}
                  </span>
                ) : (
                  <span className="text-[11px] font-normal text-[#737067]">
                    Country code auto-selected. Change anytime; number formats as you type.
                  </span>
                )}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
              {t("email")} *
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="ananya@example.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, email: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }}
                className={`w-full min-h-[46px] border ${fieldErrors.email ? "border-red-500 bg-red-50" : "border-[#b8b5a8] bg-[#fffefa]"} rounded-md px-3 py-2 text-sm`}
              />
              {fieldErrors.email && <span className="text-[11px] text-red-600 font-medium">{fieldErrors.email}</span>}
            </label>
          </div>

          {/* Delivery Address */}
          <div className="space-y-4 pt-4 border-t border-[#e4dfd5]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#737067]">Delivery Address</h3>

            <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
              {t("country")} *
              <select
                name="country"
                value={country}
                onChange={(e) => {
                  const newCountry = e.target.value;
                  setCountry(newCountry);
                  setInrAccepted(false);
                  if (newCountry !== "IN" && method === "cod") {
                    setMethod("upi");
                  }
                }}
                className="w-full min-h-[46px] border border-[#b8b5a8] rounded-md px-3 py-2 bg-[#fffefa] text-sm"
              >
                {!ctx?.markets.some((m) => m.code === country) && <option value={country}>{country}</option>}
                {ctx?.markets.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} {!m.available ? " · unavailable" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
              {t("line1")} *
              <input
                name="line1"
                type="text"
                required
                maxLength={180}
                autoComplete="address-line1"
                placeholder="Flat / House No., Building Name, Street"
                value={formData.line1}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, line1: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, line1: "" }));
                }}
                className={`w-full min-h-[46px] border ${fieldErrors.line1 ? "border-red-500 bg-red-50" : "border-[#b8b5a8] bg-[#fffefa]"} rounded-md px-3 py-2 text-sm`}
              />
              {fieldErrors.line1 && <span className="text-[11px] text-red-600 font-medium">{fieldErrors.line1}</span>}
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
              {t("line2")}
              <input
                name="line2"
                type="text"
                maxLength={180}
                autoComplete="address-line2"
                placeholder="Colony, Landmark, Area (Optional)"
                value={formData.line2}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, line2: e.target.value }));
                }}
                className="w-full min-h-[46px] border border-[#b8b5a8] rounded-md px-3 py-2 bg-[#fffefa] text-sm"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
                {t("city")} *
                <input
                  name="city"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="address-level2"
                  placeholder="e.g. Siliguri"
                  value={formData.city}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, city: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, city: "" }));
                  }}
                  className={`w-full min-h-[46px] border ${fieldErrors.city ? "border-red-500 bg-red-50" : "border-[#b8b5a8] bg-[#fffefa]"} rounded-md px-3 py-2 text-sm`}
                />
                {fieldErrors.city && <span className="text-[11px] text-red-600 font-medium">{fieldErrors.city}</span>}
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
                {t("state")} *
                <input
                  name="state"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="address-level1"
                  placeholder="e.g. West Bengal"
                  value={formData.state}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, state: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, state: "" }));
                  }}
                  className={`w-full min-h-[46px] border ${fieldErrors.state ? "border-red-500 bg-red-50" : "border-[#b8b5a8] bg-[#fffefa]"} rounded-md px-3 py-2 text-sm`}
                />
                {fieldErrors.state && <span className="text-[11px] text-red-600 font-medium">{fieldErrors.state}</span>}
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
                {t("postcode")} {country === "IN" ? "*" : ""}
                <input
                  name="postcode"
                  type="text"
                  inputMode="numeric"
                  required={country === "IN"}
                  pattern={country === "IN" ? "\\d{6}" : undefined}
                  title={country === "IN" ? "Enter a 6-digit PIN code" : undefined}
                  maxLength={country === "IN" ? 6 : 20}
                  autoComplete="postal-code"
                  placeholder={country === "IN" ? "734005" : "ZIP / Postal"}
                  value={formData.postcode}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, postcode: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, postcode: "" }));
                  }}
                  className={`w-full min-h-[46px] border ${fieldErrors.postcode ? "border-red-500 bg-red-50" : "border-[#b8b5a8] bg-[#fffefa]"} rounded-md px-3 py-2 text-sm`}
                />
                {fieldErrors.postcode && <span className="text-[11px] text-red-600 font-medium">{fieldErrors.postcode}</span>}
              </label>
            </div>

            {customer && (
              <label className="flex items-center gap-2 text-xs font-medium text-[#23483a] cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={saveAddressToAccount}
                  onChange={(e) => setSaveAddressToAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-[#23483a] accent-[#23483a]"
                />
                <span>Save this delivery address to my TeaFloww account for future orders</span>
              </label>
            )}
          </div>

          {/* Payment Method Selector (Step 2) */}
          <div className="pt-4 border-t border-[#e4dfd5] space-y-4" role="radiogroup" aria-labelledby="payment-methods-legend">
            <div className="flex items-center justify-between">
              <div>
                <h3 id="payment-methods-legend" className="text-sm font-bold text-[#171713]">
                  2. Select Payment Method
                </h3>
                <p className="text-xs text-[#526359]">
                  {onlinePaymentEnabled
                    ? "Choose prepaid to unlock instant discounts and priority dispatch"
                    : "Cash on Delivery is currently the only available payment method"}
                </p>
              </div>
              {onlinePaymentEnabled && (
                <Link
                  href="/payment-methods"
                  target="_blank"
                  className="text-xs text-[#23483a] hover:underline flex items-center gap-1 font-semibold"
                >
                  Why prepaid? <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {!onlinePaymentEnabled && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#fefce8] border border-[#fde047] text-xs text-[#854d0e]">
                <Truck className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Online payment disabled:</strong> All online payment gateways are currently paused. Orders are accepted exclusively via Cash on Delivery.
                </span>
              </div>
            )}

            {country !== "IN" && !onlinePaymentEnabled && (
              <div className="p-4 rounded-xl border border-[#fca5a5] bg-[#fef2f2] text-xs text-[#991b1b]">
                <strong>Online payment paused:</strong> Digital payment gateways are currently turned off. Cash on Delivery is currently available for domestic delivery in India only.
              </div>
            )}

            {country === "IN" && !codEnabled && !onlinePaymentEnabled && (
              <div className="p-4 rounded-xl border border-[#fca5a5] bg-[#fef2f2] text-xs text-[#991b1b]">
                <strong>No payment method available:</strong> Both online payments and Cash on Delivery are currently turned off. Please contact customer support.
              </div>
            )}

            {isWholesale && wholesaleAdvancePercent > 0 && (
              <div className="p-3.5 rounded-xl border border-[#cbe0d3] bg-[#f4f7f2] text-xs text-[#23483a]">
                <strong className="block font-semibold mb-1 text-sm">🌿 Wholesale Order · Advance PG Payment</strong>
                <p className="leading-relaxed">
                  A <strong>{wholesaleAdvancePercent}% advance payment</strong> is required via online payment gateway (UPI, Cards, or NetBanking) to confirm production and inventory reservation. The remaining <strong>{100 - wholesaleAdvancePercent}% balance</strong> is payable via Direct Account Transfer before surface transport dispatch.
                </p>
              </div>
            )}

            {isWholesale && wholesaleAdvancePercent === 0 && (
              <div className="p-3.5 rounded-xl border border-[#cbe0d3] bg-[#f4f7f2] text-xs text-[#23483a]">
                <strong className="block font-semibold mb-1 text-sm">🌿 Wholesale Order · Direct Account Transfer</strong>
                <p className="leading-relaxed">
                  Online payment is skipped. Complete order placement now; bank transfer details for NEFT/RTGS/IMPS/UPI will be provided on the order confirmation screen for settlement prior to transport dispatch.
                </p>
              </div>
            )}

            <div className={`grid ${onlinePaymentEnabled && (!isWholesale || wholesaleAdvancePercent > 0) ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-3`}>
              {/* Wholesale 0% Advance Option: Direct Bank / Account Transfer */}
              {isWholesale && wholesaleAdvancePercent === 0 && (
                <label
                  className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    method === "bank_transfer"
                      ? "border-[#23483a] bg-[#f4f7f2] shadow-sm"
                      : "border-[#d7d5c7] bg-white hover:border-[#b8b5a8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    value="bank_transfer"
                    checked={method === "bank_transfer"}
                    onChange={() => handleMethodChange("bank_transfer")}
                    className="mt-1 accent-[#23483a] w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#171713] text-sm flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#23483a]" />
                        Direct Bank / Account Transfer
                      </span>
                      <span className="text-[11px] font-bold text-[#166534] bg-[#e2edd9] px-2 py-0.5 rounded-full">
                        Pay Before Dispatch
                      </span>
                    </div>
                    <p className="text-[#526359] leading-tight">
                      Zero gateway transaction surcharge. Place order immediately to lock inventory; transfer via NEFT, RTGS, IMPS, or corporate UPI before transport dispatch.
                    </p>
                  </div>
                </label>
              )}

              {/* Option 1: UPI / QR Code */}
              {onlinePaymentEnabled && (!isWholesale || wholesaleAdvancePercent > 0) && (
                <label
                  className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    method === "upi"
                      ? "border-[#23483a] bg-[#f4f7f2] shadow-sm"
                      : "border-[#d7d5c7] bg-white hover:border-[#b8b5a8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    value="upi"
                    checked={method === "upi"}
                    onChange={() => handleMethodChange("upi")}
                    className="mt-1 accent-[#23483a] w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#171713] text-sm flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-[#23483a]" />
                        UPI &amp; QR Code
                      </span>
                      {!isWholesale && (
                        <span className="text-[11px] font-bold text-[#166534] bg-[#e2edd9] px-2 py-0.5 rounded-full">
                          ⚡ Save {upiValue}%
                        </span>
                      )}
                    </div>
                    <p className="text-[#526359] leading-tight">
                      Instant scan with Google Pay, PhonePe, Paytm, or BHIM. Zero processing fee.
                    </p>
                  </div>
                </label>
              )}

              {/* Option 2: Cards */}
              {onlinePaymentEnabled && (!isWholesale || wholesaleAdvancePercent > 0) && (
                <label
                  className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    method === "card"
                      ? "border-[#23483a] bg-[#f4f7f2] shadow-sm"
                      : "border-[#d7d5c7] bg-white hover:border-[#b8b5a8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    value="card"
                    checked={method === "card"}
                    onChange={() => handleMethodChange("card")}
                    className="mt-1 accent-[#23483a] w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#171713] text-sm flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#b39156]" />
                        Credit &amp; Debit Cards
                      </span>
                      {!isWholesale && (
                        <span className="text-[11px] font-bold text-[#166534] bg-[#e2edd9] px-2 py-0.5 rounded-full">
                          💳 Save {cardValue}%
                        </span>
                      )}
                    </div>
                    <p className="text-[#526359] leading-tight">
                      Visa, MasterCard, RuPay, Amex. 256-bit AES encrypted via Razorpay.
                    </p>
                  </div>
                </label>
              )}

              {/* Option 3: Net Banking */}
              {onlinePaymentEnabled && (!isWholesale || wholesaleAdvancePercent > 0) && (
                <label
                  className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    method === "netbanking"
                      ? "border-[#23483a] bg-[#f4f7f2] shadow-sm"
                      : "border-[#d7d5c7] bg-white hover:border-[#b8b5a8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    value="netbanking"
                    checked={method === "netbanking"}
                    onChange={() => handleMethodChange("netbanking")}
                    className="mt-1 accent-[#23483a] w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#171713] text-sm flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#46524a]" />
                        Net Banking &amp; Wallets
                      </span>
                      <span className="text-[11px] font-medium text-[#46524a] bg-[#f0ede6] px-2 py-0.5 rounded-full">
                        50+ Banks
                      </span>
                    </div>
                    <p className="text-[#526359] leading-tight">
                      HDFC, ICICI, SBI, Axis, Cred &amp; popular digital wallets.
                    </p>
                  </div>
                </label>
              )}

              {/* Wholesale COD Unavailable Notice */}
              {isWholesale && (
                <div className="sm:col-span-2 p-3.5 rounded-xl border border-[#eedab2] bg-[#fff9ed] text-xs text-[#7d5615] flex items-start gap-2.5">
                  <Truck className="w-4 h-4 text-[#b39156] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#684407] font-semibold mb-0.5">Cash on Delivery Unavailable for Wholesale</strong>
                    Wholesale cargo is dispatched via commercial surface road transport with freight payable on delivery (To-Pay Bilty). Cash on Delivery is strictly unavailable for wholesale orders.
                  </div>
                </div>
              )}

              {/* Option 4: COD (Only for Retail Orders in India) */}
              {!isWholesale && country === "IN" && codEnabled && (
                <label
                  className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                    !isCodSubtotalValid
                      ? "opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed"
                      : method === "cod"
                      ? "border-[#854d0e] bg-[#fefce8] shadow-sm cursor-pointer"
                      : "border-[#d7d5c7] bg-white hover:border-[#b8b5a8] cursor-pointer"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    value="cod"
                    disabled={!isCodSubtotalValid}
                    checked={method === "cod"}
                    onChange={() => {
                      if (isCodSubtotalValid) handleMethodChange("cod");
                    }}
                    className="mt-1 accent-[#854d0e] w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#171713] text-sm flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#737067]" />
                        Cash on Delivery
                      </span>
                      <span className="text-[11px] font-semibold text-[#854d0e] bg-[#fef3c7] px-2 py-0.5 rounded-full">
                        +₹{codFee} Fee {codMin > 0 || codMax < 100000 ? `· ₹${codMin}–₹${codMax}` : ""}
                      </span>
                    </div>
                    <p className="text-[#737067] leading-tight">
                      {!isCodSubtotalValid
                        ? cartSubtotalRupees < codMin
                          ? `COD requires a minimum bag value of ₹${codMin}.`
                          : `COD is available for orders up to ₹${codMax}. Please select prepaid payment.`
                        : !onlinePaymentEnabled
                        ? "Pay cash upon delivery to your courier. Online payments are currently paused."
                        : "Pay cash upon delivery. Subject to phone confirmation. No discount."}
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Coupon Code Input */}
          <div className="pt-4 border-t border-[#e4dfd5]">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
              {t("coupon")}
              <div className="flex gap-2">
                <input
                  name="coupon"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  maxLength={24}
                  placeholder="e.g. HARVEST10"
                  className="flex-1 min-h-[46px] border border-[#b8b5a8] rounded-md px-3 py-2 bg-[#fffefa] text-sm uppercase tracking-wider"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[46px] px-5 bg-[#23483a] text-white rounded-md text-xs font-semibold hover:bg-[#1a382d] transition-colors"
                >
                  Apply
                </button>
              </div>
            </label>
          </div>

          {/* Currency Selector (For International Orders) */}
          {country !== "IN" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#e4dfd5]">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#171713]">
                {t("currency")}
                <select
                  value={paymentCurrency}
                  onChange={(e) => {
                    setPaymentCurrency(e.target.value);
                    setInrAccepted(false);
                    invalidate();
                  }}
                  className="w-full min-h-[46px] border border-[#b8b5a8] rounded-md px-3 py-2 bg-[#fffefa] text-sm"
                >
                  {Array.from(
                    new Set([
                      paymentCurrency,
                      ...(ctx?.markets.find((m) => m.code === country)?.approvedCurrencies || ["INR"]),
                    ])
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* INR Acceptance Notice for International buyers paying INR */}
          {country !== "IN" && paymentCurrency === "INR" && (
            <div className="p-3.5 rounded-lg bg-[#f5f3ec] border border-[#d9d5c5] text-xs text-[#46524a] space-y-2">
              <p>
                Payment for this destination is processed in INR (Indian Rupees). Your bank or card issuer will apply
                standard foreign exchange conversion.
              </p>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#171713]">
                <input
                  type="checkbox"
                  checked={inrAccepted}
                  onChange={(e) => setInrAccepted(e.target.checked)}
                  className="accent-[#23483a] w-4 h-4 cursor-pointer"
                />
                {t("inrAcceptance")}
              </label>
            </div>
          )}

          {/* Calculate Quote / Review Button */}
          <div>
            <button
              type="submit"
              disabled={busy || !cart.items.length}
              className="w-full min-h-[48px] rounded-lg bg-[#23483a] hover:bg-[#1a382d] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? "Calculating authoritative rates…" : quote ? "Update Order Total →" : "Review Order & Confirm Total →"}
            </button>
          </div>

          {/* Stuck at Checkout Direct Assistance Callout */}
          <div className="pt-3 border-t border-[#e4dfd5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#23483a]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
                <WhatsAppIcon size={16} color="#128C7E" />
              </div>
              <div>
                <p className="font-semibold text-[#171713]">Stuck or prefer ordering via chat?</p>
                <p className="text-[11px] text-[#526359]">
                  Chat directly with our Siliguri dispatch desk on WhatsApp ({paymentConfig?.whatsappNumber || "+91 7001304853"})
                </p>
              </div>
            </div>
            <a
              href={checkoutWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f0f9f4] hover:bg-[#e1f5eb] text-[#128c7e] border border-[#c3ead4] font-semibold text-xs transition-colors shrink-0 shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
              aria-label="Open WhatsApp chat for live checkout assistance (opens in a new tab)"
            >
              <WhatsAppIcon size={15} color="#25D366" />
              <span>Ping on WhatsApp →</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: Order Summary, Live Quote Breakdown, Final Action */}
      <aside className="lg:col-span-5 sticky top-6 space-y-4" aria-live="polite">
        <div className="tf-ops-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#e4dfd5] pb-4">
            <h2 className="text-xl font-serif text-[#171713] font-normal">{t("total")}</h2>
            <div className="text-xs text-[#737067] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#23483a]" /> Secure checkout
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div role="alert" className="p-3.5 rounded-lg bg-[#faebeb] border border-[#f5c6cb] text-xs text-[#991b1b] flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#991b1b]" />
              <div className="flex-1 min-w-0">
                <span className="font-medium leading-relaxed">{error}</span>
                <button
                  type="button"
                  onClick={() => showErrorModal(error)}
                  className="block mt-1.5 font-semibold underline text-[#7f1d1d] hover:text-[#991b1b] transition-colors"
                >
                  View Details &amp; Resolve →
                </button>
              </div>
            </div>
          )}

          {quote ? (
            <div className="space-y-4">
              {/* Line Items Breakdown */}
              <div className="space-y-2.5 text-xs text-[#46524a]">
                {Object.entries(quote.components).map(([component, value]) => {
                  const isDiscount = component === "paymentDiscount" || value < 0;
                  const label =
                    component === "cod"
                      ? "Cash on delivery fee"
                      : component === "paymentDiscount"
                      ? "⚡ Prepaid Instant Discount"
                      : component === "merchandise"
                      ? "Teas"
                      : t(component);

                  return (
                    <div
                      key={component}
                      className={`flex justify-between items-center py-1.5 ${
                        isDiscount ? "text-[#166534] font-semibold bg-[#e2edd9]/40 px-2 rounded" : ""
                      }`}
                    >
                      <span>{label}</span>
                      <strong className={isDiscount ? "text-[#166534]" : "text-[#171713]"}>
                        {isDiscount ? `−${formatMoney(Math.abs(value), quote.currency, ctx?.locale)}` : formatMoney(value, quote.currency, ctx?.locale)}
                      </strong>
                    </div>
                  );
                })}

                {/* Final Total Row */}
                <div className="flex justify-between items-baseline pt-4 border-t-2 border-[#171713] text-[#171713]">
                  <span className="text-base font-bold">
                    {isWholesale ? "Total Order Value" : t("total")}
                  </span>
                  <strong className="text-2xl font-serif font-bold">
                    {formatMoney(quote.totalMinor, quote.currency, ctx?.locale)}
                  </strong>
                </div>

                {/* Wholesale Advance & Balance Due Breakout */}
                {quote.wholesale?.isWholesale && (
                  <div className="mt-3 pt-3 border-t border-dashed border-[#d7d5c7] space-y-2">
                    {quote.wholesale.advancePercent > 0 ? (
                      <>
                        <div className="flex justify-between items-center text-xs font-semibold text-[#23483a] bg-[#f4f7f2] p-2.5 rounded-lg border border-[#cbe0d3]">
                          <span>Advance Payable Now ({quote.wholesale.advancePercent}% via PG):</span>
                          <strong className="text-sm">{formatMoney(quote.wholesale.advanceMinor, quote.currency, ctx?.locale)}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs text-[#526359] px-2 py-1">
                          <span>Balance Due Before Dispatch (via A/C Transfer):</span>
                          <strong className="text-[#171713]">{formatMoney(quote.wholesale.balanceMinor, quote.currency, ctx?.locale)}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#f4f7f2] border border-[#cbe0d3] text-xs text-[#23483a]">
                        <strong className="block font-semibold">100% Direct A/C Transfer Before Dispatch</strong>
                        <span className="text-[11px] text-[#526359]">
                          Online payment skipped. Complete account transfer before surface transport dispatch.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Savings Highlight */}
              {quote.components.paymentDiscount && quote.components.paymentDiscount < 0 && (
                <div className="p-2.5 rounded-lg bg-[#e2edd9] text-[#166534] text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>
                    You saved {formatMoney(Math.abs(quote.components.paymentDiscount), quote.currency, ctx?.locale)} with prepaid checkout!
                  </span>
                </div>
              )}

              {/* Quote Expiry Notice */}
              <p className="text-[11px] text-[#737067] leading-relaxed">
                Quote valid until {new Date(quote.expires).toLocaleTimeString()}. Availability is checked again before your order is created.
              </p>

              {/* Dynamic Action Button */}
              <div>
                <button
                  type="button"
                  onClick={pay}
                  disabled={
                    busy ||
                    (!isWholesale && isBelowMinDeliveryOrder) ||
                    (country !== "IN" && quote.currency === "INR" && !inrAccepted) ||
                    (!isWholesale && !onlinePaymentEnabled && (country !== "IN" || !codEnabled || !isCodSubtotalValid))
                  }
                  className="w-full min-h-[50px] rounded-lg bg-[#23483a] hover:bg-[#1a382d] text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? (
                    "Processing…"
                  ) : !isWholesale && isBelowMinDeliveryOrder ? (
                    `Minimum Order ₹${minDeliveryOrder} Required`
                  ) : !isWholesale && !onlinePaymentEnabled && country !== "IN" ? (
                    "Domestic COD Only Available"
                  ) : !isWholesale && !onlinePaymentEnabled && !codEnabled ? (
                    "No Payment Method Available"
                  ) : isWholesale && (quote.wholesale?.advancePercent === 0 || method === "bank_transfer") ? (
                    `Place Wholesale Order · Pay via A/C Transfer (${formatMoney(quote.totalMinor, quote.currency, ctx?.locale)}) →`
                  ) : isWholesale && (quote.wholesale?.advancePercent || 0) > 0 ? (
                    `Pay ${quote.wholesale?.advancePercent}% Advance (${formatMoney(quote.wholesale?.advanceMinor || quote.totalMinor, quote.currency, ctx?.locale)}) via ${method === "upi" ? "UPI" : method === "card" ? "Card" : "NetBanking"} →`
                  ) : method === "cod" ? (
                    !isCodSubtotalValid ? (
                      `COD Available ₹${codMin}–₹${codMax}`
                    ) : (
                      "Place Cash on Delivery Order →"
                    )
                  ) : method === "upi" ? (
                    `Pay ${formatMoney(quote.totalMinor, quote.currency, ctx?.locale)} with UPI →`
                  ) : method === "card" ? (
                    `Pay ${formatMoney(quote.totalMinor, quote.currency, ctx?.locale)} with Card →`
                  ) : (
                    `Pay ${formatMoney(quote.totalMinor, quote.currency, ctx?.locale)} Online →`
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] text-[#737067] pt-2">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#23483a]" /> 100% Genuine
                </span>
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-[#23483a]" /> Air Express
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#23483a]" /> Fresh Siliguri Pack
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#737067] space-y-3">
              {busy ? (
                <div className="py-4 space-y-3">
                  <div className="w-8 h-8 mx-auto border-2 border-[#23483a] border-t-transparent rounded-full animate-spin" />
                  <p className="max-w-xs mx-auto font-medium text-[#23483a]">
                    Calculating live rates &amp; instant discounts…
                  </p>
                </div>
              ) : isAddressComplete(formData, country) ? (
                <div className="py-4 space-y-3">
                  <Truck className="w-8 h-8 mx-auto text-[#23483a] opacity-75" />
                  <p className="max-w-xs mx-auto font-medium text-[#171713]">
                    Delivery details ready. Calculate your order total to proceed.
                  </p>
                  <button
                    type="button"
                    onClick={() => computeQuote(method, formData, country, false)}
                    className="px-4 py-2 bg-[#23483a] text-white rounded-md text-xs font-semibold hover:bg-[#1a382d] transition-colors"
                  >
                    Confirm Delivery &amp; Total →
                  </button>
                </div>
              ) : (
                <>
                  <Truck className="w-8 h-8 mx-auto text-[#b39156] opacity-75" />
                  <p className="max-w-xs mx-auto">
                    Fill your delivery address on the left to see the final delivery quote, instant payment discount, and payable amount.
                  </p>
                </>
              )}
            </div>
          )}

          {/* WhatsApp Live Checkout Assistance */}
          <div className="pt-4 border-t border-[#e4dfd5] space-y-1.5">
            <a
              href={checkoutWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#f0f9f4] hover:bg-[#e1f5eb] text-[#128c7e] border border-[#c3ead4] text-xs font-semibold transition-colors shadow-2xs group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
              aria-label="Ping on WhatsApp for live checkout help and order verification (opens in new tab)"
            >
              <WhatsAppIcon size={16} color="#25D366" />
              <span>Need live help? Ping on WhatsApp →</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-[11px] text-center text-[#737067]">
              Real-time checkout assistance from our Siliguri dispatch desk (+91 7001304853)
            </p>
          </div>
        </div>
      </aside>

      {/* ===================================================================
          Modern Web Guidance: Native <dialog> Modal Error Overlay
          Supports: closedby="any", overscroll containment, @starting-style,
          accessible naming (aria-labelledby, aria-describedby),
          autofocus on primary action, and light-dismiss fallback.
          =================================================================== */}
      <dialog
        ref={errorDialogRef}
        id="checkout-error-dialog"
        className="tf-checkout-error-dialog"
        closedby="any"
        aria-labelledby="checkout-error-title"
        aria-describedby="checkout-error-desc"
      >
        <div className="p-6 sm:p-7 space-y-5 bg-[#fdfbf7]">
          {/* Header row with badge and close button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
                  modalError?.type === "expired"
                    ? "bg-[#faf0df] text-[#b39156] border border-[#f1dec1]"
                    : modalError?.type === "address"
                    ? "bg-[#e8f0eb] text-[#23483a] border border-[#cde0d3]"
                    : modalError?.type === "cart"
                    ? "bg-[#f5e6e8] text-[#8f2d24] border border-[#e8cdd1]"
                    : "bg-[#faebeb] text-[#991b1b] border border-[#f5c6cb]"
                }`}
              >
                {modalError?.type === "expired" ? (
                  <Clock className="w-5 h-5 text-[#b39156]" />
                ) : modalError?.type === "address" ? (
                  <Truck className="w-5 h-5 text-[#23483a]" />
                ) : modalError?.type === "cart" ? (
                  <ShoppingBag className="w-5 h-5 text-[#8f2d24]" />
                ) : modalError?.type === "payment" ? (
                  <CreditCard className="w-5 h-5 text-[#991b1b]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#991b1b]" />
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#737067]">
                  {modalError?.type === "expired"
                    ? "Rate Guarantee"
                    : modalError?.type === "address"
                    ? "Address Verification"
                    : modalError?.type === "cart"
                    ? "Stock & Availability"
                    : modalError?.type === "payment"
                    ? "Payment Gateway"
                    : "Checkout Notice"}
                </span>
                <h2
                  id="checkout-error-title"
                  className="text-lg sm:text-xl font-serif text-[#171713] font-normal leading-snug"
                >
                  {modalError?.title || "Checkout Notice"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={closeErrorModal}
              aria-label="Close error notice"
              className="p-1.5 rounded-md text-[#737067] hover:text-[#171713] hover:bg-[#ede7dd] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#23483a]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Message & Details */}
          <div className="space-y-2 rounded-xl bg-[#ffffff] p-4 border border-[#e4dfd5] text-xs leading-relaxed shadow-2xs">
            <p id="checkout-error-desc" className="font-semibold text-[#171713] text-sm">
              {modalError?.message}
            </p>
            {modalError?.detail && (
              <p className="text-[#63685e]">
                {modalError.detail}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={closeErrorModal}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-[#d9d4c8] text-xs font-semibold text-[#46524a] hover:bg-[#ede7dd] transition-colors text-center"
            >
              {modalError?.type === "expired" ? "Review Details" : "Dismiss"}
            </button>

            {modalError?.type === "expired" ? (
              <button
                type="button"
                autoFocus
                onClick={handleRecalculateFromModal}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-semibold hover:bg-[#1a382d] transition-colors flex items-center justify-center gap-1.5 shadow-sm text-center"
              >
                <span>Recalculate Total Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : modalError?.type === "address" ? (
              <button
                type="button"
                autoFocus
                onClick={() => {
                  closeErrorModal();
                  const firstErr = Object.keys(fieldErrors)[0];
                  if (firstErr) {
                    const el = document.querySelector(`[name="${firstErr}"]`) as HTMLElement | null;
                    el?.focus();
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-semibold hover:bg-[#1a382d] transition-colors text-center"
              >
                Edit Address
              </button>
            ) : (
              <button
                type="button"
                autoFocus
                onClick={closeErrorModal}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#23483a] text-white text-xs font-semibold hover:bg-[#1a382d] transition-colors text-center"
              >
                Got It
              </button>
            )}
          </div>

          {/* WhatsApp Direct Help Link */}
          <div className="pt-3 border-t border-[#e4dfd5] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#526359]">
            <span className="flex items-center gap-1.5 font-medium text-[11px] text-[#737067]">
              <WhatsAppIcon size={14} color="#25D366" />
              Need live help completing your order?
            </span>
            <a
              href={checkoutWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#128c7e] hover:text-[#0b655b] font-semibold flex items-center gap-1 hover:underline text-xs"
              aria-label="Ping TeaFloww on WhatsApp with full checkout details for live assistance (opens in new tab)"
            >
              <span>Ping on WhatsApp with order info →</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </dialog>

      {/* Floating WhatsApp Live Checkout Help Button for Stuck Customers */}
      <aside aria-label="Customer Checkout Assistance" className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
        <a
          href={checkoutWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 rounded-full bg-[#128C7E] hover:bg-[#075E54] text-white pl-3 pr-4 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200 border border-[#25D366]/40 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
          aria-label="Stuck or need help with checkout? Chat with TeaFloww support on WhatsApp (opens in a new tab)"
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xs">
            <WhatsAppIcon size={17} color="#ffffff" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white" />
            </span>
          </span>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[11px] font-bold tracking-wide">Need Help?</span>
            <span className="text-[10px] text-emerald-100 flex items-center gap-1">
              Chat on WhatsApp
            </span>
          </div>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </aside>
    </div>
  );
}
