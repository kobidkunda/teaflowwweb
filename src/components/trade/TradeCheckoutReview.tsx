"use client";
import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard } from "lucide-react";
import type { AnyTradeLocale, QuoteResult } from "@/lib/trade/contracts";
import type { TradeSettings } from "@/lib/trade/catalogue";
import type { TradeDictionary } from "@/lib/trade/i18nMeta";
import { tradeText } from "@/lib/trade/copy";
import { loadCheckout } from "@/components/checkout/razorpay";
import { TradeShell } from "./TradeShell";
import { ActionButton, InlineStatus, formatInrPaise } from "./ui/Primitives";
import styles from "./trade.module.css";
type FinalQuote = {
  id: string;
  expires: number;
  totalMinor: number;
  currency: string;
  components: {
    merchandise: number;
    shipping: number;
    tax: number;
    duties: number;
    cod: number;
    paymentDiscount?: number;
  };
  wholesale?: { advanceMinor: number; balanceMinor: number };
};
export function TradeCheckoutReview({
  locale,
  dict,
  settings,
  quote,
  expired,
  trialId,
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  settings: TradeSettings;
  quote: Extract<QuoteResult, { kind: "confirmed" }> | null;
  expired: boolean;
  trialId?: string;
}) {
  const t = (key: string) => tradeText(dict, `ui.${key}`);
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [final, setFinal] = useState<FinalQuote | null>(null);
  const key = useRef("");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    line1: "",
    city: "",
    state: "",
  });
  const [method, setMethod] = useState<"prepaid" | "cod">(
    quote?.payment === "cod" ? "cod" : "prepaid",
  );
  const requestSequence = useRef(0);
  function invalidate() {
    requestSequence.current++;
    setFinal(null);
    setPending(false);
    key.current = "";
  }
  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    const seq = ++requestSequence.current;
    setPending(true);
    setError("");
    try {
      if (quote.quoteType === "trial" && !trialId) throw new Error();
      const response = await fetch("/api/commerce/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            ...customer,
            line2: "",
            postcode: quote.destinationPin,
            country: "IN",
          },
          currency: "INR",
          locale: locale === "kn" ? "en" : locale,
          method,
          coupon: "",
          items:
            quote.quoteType === "trial"
              ? [{ trialId, quantity: 1 }]
              : quote.lines.map((l) => ({
                  variantId: l.variantId,
                  quantity: l.quantity,
                })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.id) throw new Error();
      if (seq === requestSequence.current) {
        setFinal(data);
        key.current = crypto.randomUUID();
      }
    } catch {
      if (seq === requestSequence.current) setError(t("error"));
    } finally {
      if (seq === requestSequence.current) setPending(false);
    }
  }
  async function pay() {
    if (!final || pending) return;
    if (final.expires <= Date.now()) {
      setFinal(null);
      setError(t("expired"));
      return;
    }
    setPending(true);
    setError("");
    try {
      // Keep the selected trade language on the existing receipt/payment journey.
      const preferences = await fetch("/api/commerce/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: "IN",
          currency: "INR",
          locale: locale === "kn" ? "en" : locale,
        }),
      });
      if (!preferences.ok) throw new Error();
      const response = await fetch("/api/commerce/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: final.id,
          idempotencyKey: key.current,
          currencyAcceptance: final.currency,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.orderId) throw new Error();
      const receipt = `/purchase/${encodeURIComponent(data.orderId)}?token=${encodeURIComponent(data.token)}`;
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.gateway === "razorpay" && data.gatewayOrderId) {
        await loadCheckout();
        if (!window.Razorpay) throw new Error();
        const widget = new window.Razorpay({
          key: data.keyId,
          order_id: data.gatewayOrderId,
          amount: data.amount,
          currency: data.currency,
          name: "TeaFloww",
          prefill: {
            name: customer.name,
            email: customer.email,
            contact: customer.phone,
          },
          handler: () => router.push(receipt),
          modal: { ondismiss: () => router.push(receipt) },
          theme: { color: "#23483A" },
        });
        widget.on("payment.failed", () => router.push(receipt));
        widget.open();
      } else router.push(receipt);
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }
  return (
    <TradeShell
      locale={locale}
      enabledLocales={settings.enabled_locales}
      dict={dict}
    >
      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.kicker}>{t("direct")}</div>
          <h1 id="checkoutTitle" className={styles.h2}>
            {dict["checkout.title"]}
          </h1>
          <p className={styles.small}>{t("finalReviewBody")}</p>
          {!quote || expired ? (
            <InlineStatus
              title={t("expired")}
              body={t("deliveryNote")}
              action={
                <Link
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  href={`/tea-shops/${locale}#bulk`}
                >
                  {t("back")}
                </Link>
              }
            />
          ) : (
            <div className={styles.grid} style={{ marginTop: 30 }}>
              <form className={styles.panel} onSubmit={calculate}>
                <h2 className={styles.h3}>{t("address")}</h2>
                {(Object.keys(customer) as Array<keyof typeof customer>).map(
                  (field) => (
                    <div key={field}>
                      <label
                        className={styles.fieldLabel}
                        htmlFor={`tc-${field}`}
                      >
                        {t(
                          {
                            name: "shopName",
                            phone: "phone",
                            email: "email",
                            line1: "address",
                            city: "city",
                            state: "state",
                          }[field],
                        )}{" "}
                        *
                      </label>
                      <input
                        id={`tc-${field}`}
                        className={styles.input}
                        style={{ width: "100%" }}
                        type={
                          field === "email"
                            ? "email"
                            : field === "phone"
                              ? "tel"
                              : "text"
                        }
                        autoComplete={
                          {
                            name: "name",
                            phone: "tel",
                            email: "email",
                            line1: "address-line1",
                            city: "address-level2",
                            state: "address-level1",
                          }[field]
                        }
                        required
                        maxLength={
                          field === "line1"
                            ? 180
                            : field === "email"
                              ? 254
                              : 100
                        }
                        minLength={
                          field === "name" ? 2 : field === "line1" ? 5 : 1
                        }
                        value={customer[field]}
                        onChange={(e) => {
                          setCustomer({ ...customer, [field]: e.target.value });
                          invalidate();
                        }}
                      />
                    </div>
                  ),
                )}
                <p>
                  {dict["bulk.pinLabel"]}: <b>{quote.destinationPin}</b>
                </p>
                <label className={styles.fieldLabel} htmlFor="tc-method">
                  {dict["bulk.payment"]}
                </label>
                <select
                  id="tc-method"
                  className={styles.select}
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as "prepaid" | "cod");
                    invalidate();
                  }}
                >
                  <option value="prepaid">{dict["payment.prepaid"]}</option>
                  <option value="cod">{dict["payment.cod"]}</option>
                </select>
                <div style={{ marginTop: 24 }}>
                  <ActionButton type="submit" pending={pending}>
                    {t("calculate")}
                    <ArrowRight size={18} />
                  </ActionButton>
                </div>
              </form>
              <div
                className={`${styles.panel} ${styles.ticket}`}
                aria-live="polite"
              >
                <h2 className={styles.h3}>{t("finalReview")}</h2>
                {quote.lines.map((l, i) => (
                  <p key={i}>
                    {l.quantity} × {l.productName} · {l.grams} g
                  </p>
                ))}
                {final ? (
                  <>
                    <div className={styles.row}>
                      <span>{dict["quote.tea"]}</span>
                      <b>
                        {formatInrPaise(final.components.merchandise, locale)}
                      </b>
                    </div>
                    <div className={styles.row}>
                      <span>{dict["quote.freight"]}</span>
                      <b>{formatInrPaise(final.components.shipping, locale)}</b>
                    </div>
                    <div className={styles.row}>
                      <span>
                        {dict["quote.taxes"]} / {dict["quote.fees"]}
                      </span>
                      <b>
                        {formatInrPaise(
                          final.components.tax +
                            final.components.duties +
                            final.components.cod,
                          locale,
                        )}
                      </b>
                    </div>
                    {Boolean(final.components.paymentDiscount) && (
                      <div className={styles.row}>
                        <span>{t("paymentDiscount")}</span>
                        <b>
                          {formatInrPaise(
                            final.components.paymentDiscount!,
                            locale,
                          )}
                        </b>
                      </div>
                    )}
                    <hr />
                    <p>{t("finalTotal")}</p>
                    <strong className={styles.amount}>
                      {formatInrPaise(final.totalMinor, locale)}
                    </strong>
                    {final.wholesale && (
                      <>
                        <div className={styles.row}>
                          <span>{dict["quote.payNow"]}</span>
                          <b>
                            {formatInrPaise(
                              final.wholesale.advanceMinor,
                              locale,
                            )}
                          </b>
                        </div>
                        <div className={styles.row}>
                          <span>{dict["quote.balanceAtCollection"]}</span>
                          <b>
                            {formatInrPaise(
                              final.wholesale.balanceMinor,
                              locale,
                            )}
                          </b>
                        </div>
                      </>
                    )}
                    <p className={styles.small}>{t("reviewPayable")}</p>
                    <ActionButton pending={pending} onClick={() => void pay()}>
                      <CreditCard size={18} />
                      {method === "cod" || final.wholesale?.advanceMinor === 0
                        ? dict["checkout.placeOrder"]
                        : t("pay")}
                    </ActionButton>
                  </>
                ) : (
                  <>
                    <p className={styles.small}>
                      {t("previewTotal")}:{" "}
                      {formatInrPaise(quote.totalPaise, locale)}
                    </p>
                    <p>{t("finalReviewBody")}</p>
                  </>
                )}
                {error && (
                  <p role="alert" className={styles.errorText}>
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </TradeShell>
  );
}
