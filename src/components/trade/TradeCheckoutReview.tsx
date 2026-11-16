"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnyTradeLocale, QuoteResult } from "@/lib/trade/contracts";
import type { TradeSettings } from "@/lib/trade/catalogue";
import type { TradeDictionary } from "@/lib/trade/i18n";
import { TradeShell } from "./TradeShell";
import {
  ActionButton,
  InlineStatus,
  PriceReceipt,
  formatInrPaise,
} from "./ui/Primitives";
import styles from "./trade.module.css";

export function TradeCheckoutReview({
  locale,
  dict,
  settings,
  quote,
  expired,
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  settings: TradeSettings;
  quote: Extract<QuoteResult, { kind: "confirmed" }> | null;
  expired: boolean;
}) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(
    () => `trd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/trade/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          idempotencyKey,
          customerName,
          customerPhone,
          customerEmail,
          shippingAddress,
          paymentMode: quote.payment,
        }),
      });
      const data = (await res.json()) as {
        orderId?: string;
        accessToken?: string;
        error?: string;
      };
      if (!res.ok || !data.orderId) {
        setError(data.error || "Unable to place order. Please refresh your quote.");
        return;
      }
      router.push(
        `/tea-shops/${locale}/orders/${encodeURIComponent(
          data.orderId
        )}?token=${encodeURIComponent(data.accessToken || "")}`
      );
    } catch {
      setError("Network error while confirming order. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <TradeShell locale={locale} enabledLocales={settings.enabled_locales} dict={dict}>
      <section className={styles.section} aria-labelledby="checkoutTitle">
        <div className={styles.kicker}>Trade checkout</div>
        <h1 id="checkoutTitle" className={styles.h2} style={{ marginBottom: 24 }}>
          {dict["checkout.title"]}
        </h1>

        {!quote || expired ? (
          <InlineStatus
            title={expired ? "Quote expired" : "Quote unavailable"}
            body={
              expired
                ? "Your delivery quote expired. Return to the trade page to check the latest stock and freight."
                : "We could not load a confirmed quote for this session."
            }
            action={
              <Link
                href={`/tea-shops/${locale}#bulk`}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Back to trade quote
              </Link>
            }
          />
        ) : (
          <div className={styles.grid}>
            <form className={styles.panel} onSubmit={handleSubmit}>
              <h2 className={styles.h3} style={{ fontSize: 24 }}>
                Shop & handover details
              </h2>
              <label className={styles.fieldLabel} htmlFor="tc-name">
                Shop owner / business name *
              </label>
              <input
                id="tc-name"
                className={styles.input}
                style={{ width: "100%" }}
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />

              <label className={styles.fieldLabel} htmlFor="tc-phone">
                Mobile / WhatsApp number *
              </label>
              <input
                id="tc-phone"
                className={styles.input}
                style={{ width: "100%" }}
                required
                placeholder="+91 98..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />

              <label className={styles.fieldLabel} htmlFor="tc-email">
                Email (optional)
              </label>
              <input
                id="tc-email"
                type="email"
                className={styles.input}
                style={{ width: "100%" }}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />

              <label className={styles.fieldLabel} htmlFor="tc-addr">
                {quote.handover.kind === "depot"
                  ? "Shop address (for invoice & depot release) *"
                  : "Shop delivery address *"}
              </label>
              <textarea
                id="tc-addr"
                className={styles.textarea}
                required
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />

              {error ? (
                <p className={styles.errorText} role="alert">
                  {error}
                </p>
              ) : null}

              <div style={{ marginTop: 18 }}>
                <ActionButton type="submit" intent="primary" pending={pending}>
                  {quote.dueNowPaise > 0
                    ? dict["checkout.payNow"].replace(
                        "{amount}",
                        formatInrPaise(quote.dueNowPaise, locale)
                      )
                    : dict["checkout.placeOrder"]}
                </ActionButton>
              </div>
            </form>

            <div className={`${styles.panel} ${styles.ticket}`}>
              <PriceReceipt quote={quote} locale={locale} dict={dict} />
            </div>
          </div>
        )}
      </section>
    </TradeShell>
  );
}
