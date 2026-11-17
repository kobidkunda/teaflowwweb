"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { AnyTradeLocale, Handover, QuoteLineSnapshot } from "@/lib/trade/contracts";
import type { TradeSettings } from "@/lib/trade/catalogue";
import type { TradeDictionary } from "@/lib/trade/i18n";
import { TradeShell } from "./TradeShell";
import { ActionButton, InlineStatus, formatInrPaise } from "./ui/Primitives";
import styles from "./trade.module.css";

export type TradeOrderViewModel = {
  orderId: string;
  quoteId: string;
  quoteType: "bulk" | "trial";
  locale: string;
  destinationPin: string;
  customerName: string;
  shippingAddress: string;
  paymentMode: string;
  orderStatus: string;
  paymentStatus: string;
  dispatchStatus: string;
  handover: Handover;
  lines: QuoteLineSnapshot[];
  netGrams: number;
  billedGrams: number;
  goodsPaise: number;
  freightPaise: number;
  extraTaxPaise: number;
  otherFeesPaise: number;
  creditPaise: number;
  totalPaise: number;
  dueNowPaise: number;
  dueLaterPaise: number;
  remittanceStatus: string;
  etaLabel: string | null;
  createdAt: string;
};

export function TradeOrderClient({
  locale,
  dict,
  settings,
  order,
  accessToken,
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  settings: TradeSettings;
  order: TradeOrderViewModel | null;
  accessToken: string;
}) {
  const [remPhone, setRemPhone] = useState("");
  const [cadenceDays, setCadenceDays] = useState("15");
  const [remSaved, setRemSaved] = useState(false);

  return (
    <TradeShell locale={locale} enabledLocales={settings.enabled_locales} dict={dict}>
      <section className={styles.section} aria-labelledby="orderHeading">
        <div className={styles.kicker}>Order receipt</div>
        <h1 id="orderHeading" className={styles.h2} style={{ marginBottom: 20 }}>
          {dict["order.title"]}
        </h1>

        {!order ? (
          <InlineStatus
            title="Order link unavailable"
            body="This order link is invalid or requires its access token."
            action={
              <Link
                href={`/tea-shops/${locale}`}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Go to TeaFloww Trade
              </Link>
            }
          />
        ) : (
          <div className={styles.grid}>
            <div className={`${styles.panel} ${styles.ticket}`}>
              <h2 className={styles.h3}>{order.orderId}</h2>
              <p className={styles.small}>
                Status: <b>{order.orderStatus}</b> · Payment:{" "}
                <b>{order.paymentStatus}</b> · Dispatch:{" "}
                <b>{order.dispatchStatus}</b>
              </p>
              <hr />
              {order.lines.map((l, i) => (
                <div key={i} className={styles.row}>
                  <span>
                    {l.quantity} × {l.productName} ({l.grams / 1000} kg)
                  </span>
                  <b>{formatInrPaise(l.lineTotalPaise, locale)}</b>
                </div>
              ))}
              <div className={styles.row}>
                <span>{dict["quote.freight"]}</span>
                <b>{formatInrPaise(order.freightPaise, locale)}</b>
              </div>
              <hr />
              <div className={styles.amount}>
                {formatInrPaise(order.totalPaise, locale)}
              </div>
              <div className={styles.row}>
                <span>{dict["quote.payNow"]}</span>
                <b>{formatInrPaise(order.dueNowPaise, locale)}</b>
              </div>
              <div className={styles.row}>
                <span>{dict["quote.balanceAtCollection"]}</span>
                <b>{formatInrPaise(order.dueLaterPaise, locale)}</b>
              </div>
              <p className={styles.small}>
                Handover:{" "}
                {order.handover.kind === "depot"
                  ? `${order.handover.name} (${order.handover.address})`
                  : `Doorstep delivery · ${order.handover.locality}`}{" "}
                · PIN {order.destinationPin}
              </p>
              <div style={{ marginTop: 16 }}>
                <Link
                  href={`/tea-shops/${locale}?pin=${encodeURIComponent(order.destinationPin)}#bulk`}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  Check today&apos;s price to reorder
                </Link>
              </div>
            </div>

            <div className={styles.panel}>
              <h2 className={styles.h3} style={{ fontSize: 22 }}>
                Reorder reminder (optional)
              </h2>
              <p className={styles.small}>
                Get a reminder before your counter runs low. You can opt out
                anytime.
              </p>
              {remSaved ? (
                <InlineStatus
                  title="Reminder preference saved"
                  body={`We will remind you every ${cadenceDays} days.`}
                />
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch(
                      `/api/trade/orders/${encodeURIComponent(order.orderId)}`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          accessToken,
                          contactPhone: remPhone,
                          locale,
                          cadenceDays: Number(cadenceDays) || 15,
                          optedIn: true,
                        }),
                      }
                    );
                    if (res.ok) setRemSaved(true);
                  }}
                >
                  <label className={styles.fieldLabel} htmlFor="rem-phone">
                    WhatsApp / phone number
                  </label>
                  <input
                    id="rem-phone"
                    className={styles.input}
                    style={{ width: "100%" }}
                    required
                    value={remPhone}
                    onChange={(e) => setRemPhone(e.target.value)}
                  />
                  <label className={styles.fieldLabel} htmlFor="rem-days">
                    Remind every (days)
                  </label>
                  <select
                    id="rem-days"
                    className={styles.select}
                    value={cadenceDays}
                    onChange={(e) => setCadenceDays(e.target.value)}
                  >
                    <option value="10">10 days</option>
                    <option value="15">15 days</option>
                    <option value="30">30 days</option>
                  </select>
                  <div style={{ marginTop: 14 }}>
                    <ActionButton type="submit" intent="soft">
                      Save reminder
                    </ActionButton>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </section>
    </TradeShell>
  );
}
