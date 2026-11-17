"use client";
import React, { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { getClientAttributionBundle } from "@/lib/funnel/clientAttribution";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import type { TradeDictionary } from "@/lib/trade/i18nMeta";
import { tradeText } from "@/lib/trade/copy";
import { ActionButton } from "./ui/Primitives";
import styles from "./trade.module.css";
export function TradeEnquiryForm({
  locale,
  dict,
  pin = "",
  source,
  trial = false,
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  pin?: string;
  source: string;
  trial?: boolean;
}) {
  const t = (key: string) => tradeText(dict, `ui.${key}`);
  const id = source === "inline_enquiry_section" ? "inline-enq" : "enq";
  const key = useRef("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{
    id: string;
    whatsappUrl: string;
  } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    if (data.get("consent") !== "on") return;
    key.current ||= crypto.randomUUID();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/trade/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: key.current,
          locale,
          destinationPin: String(data.get("pin") || ""),
          enquiryType: trial ? "trial" : "bulk",
          contactName: data.get("name"),
          contactPhone: data.get("phone"),
          preferredHours: data.get("hours"),
          consentGiven: true,
          whatsappDraft: data.get("message"),
          ctaSource: source,
          attribution: getClientAttributionBundle(`/tea-shops/${locale}`),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.enquiry?.id) throw new Error(t("error"));
      setSaved({
        id: result.enquiry.id,
        whatsappUrl: result.whatsappUrl || "",
      });
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }
  if (saved)
    return (
      <div className={styles.enquirySuccessCard} role="status">
        <CheckCircle2 aria-hidden="true" />
        <h3 className={styles.h3}>{t("saved")}</h3>
        <p>{t("savedBody")}</p>
        <p>
          <b>{saved.id}</b>
        </p>
        {saved.whatsappUrl && (
          <a
            className={`${styles.btn} ${styles.btnPrimary}`}
            href={saved.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {dict["enquiry.whatsappOpen"]}
          </a>
        )}
      </div>
    );
  return (
    <form onSubmit={submit} aria-label={t("enquiryTitle")}>
      <div className={styles.pair}>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${id}-name`}>
            {t("shopName")}
          </label>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            className={styles.input}
            maxLength={120}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${id}-phone`}>
            {t("phone")} *
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            className={styles.input}
            required
            minLength={8}
            maxLength={20}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${id}-pin`}>
            {dict["enquiry.pinLabel"]}
          </label>
          <input
            id={`${id}-pin`}
            name="pin"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={pin}
            className={styles.input}
            required
            pattern="[1-9][0-9]{5}"
            maxLength={6}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`${id}-hours`}>
            {t("hours")}
          </label>
          <input
            id={`${id}-hours`}
            name="hours"
            className={styles.input}
            maxLength={120}
          />
        </div>
      </div>
      <label className={styles.fieldLabel} htmlFor={`${id}-message`}>
        {t("message")}
      </label>
      <textarea
        id={`${id}-message`}
        name="message"
        className={styles.textarea}
        defaultValue={t("enquiryDraft")}
        maxLength={1500}
      />
      <label className={styles.consentRow}>
        <input name="consent" type="checkbox" required />
        <span>{t("consent")}</span>
      </label>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
      <ActionButton type="submit" pending={pending}>
        {t("saveEnquiry")}
        <ArrowRight size={18} aria-hidden="true" />
      </ActionButton>
    </form>
  );
}
