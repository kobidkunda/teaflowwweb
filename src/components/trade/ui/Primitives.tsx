"use client";

import React, { useEffect, useRef, useState } from "react";
import { Globe, Volume2, X } from "lucide-react";
import type { AnyTradeLocale, QuoteResult } from "@/lib/trade/contracts";
import {
  formatTradeMessage,
  TRADE_LANGUAGE_META,
  type TradeDictionary,
} from "@/lib/trade/i18nMeta";
import styles from "../trade.module.css";

export function formatInrPaise(paise: number, locale: string): string {
  const bcp47 =
    (TRADE_LANGUAGE_META as Record<string, { bcp47: string }>)[locale]?.bcp47 ||
    "en-IN";
  return new Intl.NumberFormat(bcp47, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatTradeNumber(val: number, locale: string): string {
  const bcp47 =
    (TRADE_LANGUAGE_META as Record<string, { bcp47: string }>)[locale]?.bcp47 ||
    "en-IN";
  return new Intl.NumberFormat(bcp47, { maximumFractionDigits: 2 }).format(val);
}

export function ActionButton({
  intent = "primary",
  pending = false,
  disabled = false,
  type = "button",
  onClick,
  children,
  className = "",
}: {
  intent?: "primary" | "soft" | "outline";
  pending?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const kindClass =
    intent === "primary"
      ? styles.btnPrimary
      : intent === "soft"
      ? styles.btnSoft
      : "";
  return (
    <button
      type={type}
      disabled={disabled || pending}
      onClick={onClick}
      className={`${styles.btn} ${kindClass} ${className}`.trim()}
      aria-busy={pending ? "true" : undefined}
    >
      {children}
    </button>
  );
}

export function ChoiceGroup<T extends string | number>({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: Array<{ id: T; label: string; disabled?: boolean }>;
  selectedId: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.rail} role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={String(opt.id)}
            type="button"
            className={styles.choice}
            aria-pressed={opt.id === selectedId}
            disabled={opt.disabled}
            onClick={() => onSelect(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuantityStepper({
  label,
  value,
  min = 1,
  max = 99,
  locale,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  locale: string;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.counter}>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <output aria-live="polite">{formatTradeNumber(value, locale)}</output>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PinField({
  id,
  label,
  value,
  placeholder = "734001",
  error,
  buttonLabel,
  pending = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string | null;
  buttonLabel: string;
  pending?: boolean;
  onChange: (pin: string) => void;
}) {
  return (
    <div>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputrow}>
        <input
          id={id}
          className={styles.input}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          pattern="[1-9][0-9]{5}"
          placeholder={placeholder}
          value={value}
          aria-invalid={error ? "true" : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          required
        />
        <ActionButton type="submit" intent="primary" pending={pending}>
          {buttonLabel}
        </ActionButton>
      </div>
      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function InlineStatus({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.inlineStatus} role="status" aria-live="polite">
      <strong>{title}</strong>
      <p className={styles.small}>{body}</p>
      {action ? <div style={{ marginTop: 10 }}>{action}</div> : null}
    </div>
  );
}

export function PriceReceipt({
  quote,
  locale,
  dict,
  action,
  extra,
}: {
  quote: Extract<QuoteResult, { kind: "confirmed" }>;
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  action?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const netKg = quote.netGrams / 1000;
  const perKgPaise = netKg > 0 ? Math.round(quote.totalPaise / netKg) : quote.totalPaise;
  const perKgText = formatTradeMessage(
    quote.handover.kind === "depot" ? dict["quote.perKgDepot"] : dict["quote.perKg"],
    { amount: formatInrPaise(perKgPaise, locale) }
  );

  const handoverText =
    quote.handover.kind === "depot"
      ? formatTradeMessage(dict["quote.handover.depot"], {
          depot: quote.handover.name,
          address: quote.handover.address,
        })
      : formatTradeMessage(dict["quote.handover.doorstep"], {
          locality: quote.handover.locality,
        });

  return (
    <div>
      <h3 className={styles.h3}>{dict["quote.heading"]}</h3>
      <p className={styles.small}>
        {quote.lines.map((l) => `${l.quantity} × ${l.productName} (${l.grams >= 1000 ? `${l.grams / 1000} kg` : `${l.grams} g`})`).join(" + ")}
      </p>
      <hr />
      <div className={styles.row}>
        <span>{dict["quote.tea"]}</span>
        <b>{formatInrPaise(quote.goodsPaise, locale)}</b>
      </div>
      <div className={styles.row}>
        <span>{dict["quote.freight"]}</span>
        <b>{formatInrPaise(quote.freightPaise, locale)}</b>
      </div>
      {quote.extraTaxPaise > 0 ? (
        <div className={styles.row}>
          <span>{dict["quote.taxes"]}</span>
          <b>{formatInrPaise(quote.extraTaxPaise, locale)}</b>
        </div>
      ) : null}
      {quote.otherFeesPaise > 0 ? (
        <div className={styles.row}>
          <span>{dict["quote.fees"]}</span>
          <b>{formatInrPaise(quote.otherFeesPaise, locale)}</b>
        </div>
      ) : null}
      {quote.creditPaise > 0 ? (
        <div className={styles.row}>
          <span>{dict["quote.credit"]}</span>
          <b>−{formatInrPaise(quote.creditPaise, locale)}</b>
        </div>
      ) : null}
      <hr />
      <div className={styles.amount}>{formatInrPaise(quote.totalPaise, locale)}</div>
      <div>
        <b>{perKgText}</b>
      </div>
      <p className={styles.small}>
        {handoverText} · {quote.destinationPin}
        {quote.etaLabel ? ` · ${quote.etaLabel}` : ""}
      </p>
      {quote.handover.kind === "depot" && !quote.handover.onwardIncluded ? (
        <p className={styles.small}>
          Onward transport from depot is arranged by the buyer.
        </p>
      ) : null}
      {quote.dueLaterPaise > 0 ? (
        <>
          <hr />
          <div className={styles.row}>
            <span>{dict["quote.payNow"]}</span>
            <b>{formatInrPaise(quote.dueNowPaise, locale)}</b>
          </div>
          <div className={styles.row}>
            <span>{dict["quote.balanceAtCollection"]}</span>
            <b>{formatInrPaise(quote.dueLaterPaise, locale)}</b>
          </div>
        </>
      ) : null}
      {quote.quoteType === "bulk" ? (
        <div style={{ marginTop: 10 }}>
          <div className={styles.small}>
            Packed capacity: {formatTradeNumber(quote.netGrams / 1000, locale)} /{" "}
            {formatTradeNumber(quote.maxNetGrams / 1000, locale)} kg (billed{" "}
            {formatTradeNumber(quote.billedGrams / 1000, locale)} kg)
          </div>
          <div className={styles.capacityTrack} aria-hidden="true">
            <div
              className={styles.capacityFill}
              style={{ width: `${Math.min(100, Math.round(quote.capacityRatio * 100))}%` }}
            />
          </div>
        </div>
      ) : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
      {extra}
    </div>
  );
}

export function AudioButton({
  label,
  script,
  locale,
  audioUrl,
  transcript,
}: {
  label: string;
  script: string;
  locale: AnyTradeLocale;
  audioUrl?: string | null;
  transcript?: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, []);

  function handlePlay() {
    try {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    } catch {}

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play().catch(() => {
        setStatus(transcript || script);
      });
      return;
    }

    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    const bcp47 = TRADE_LANGUAGE_META[locale]?.bcp47 || "en-IN";
    const voice = synth
      ?.getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(bcp47.split("-")[0]));
    if (!synth || !voice) {
      setStatus(transcript || script);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    synth.speak(utterance);
    setStatus(null);
  }

  return (
    <div>
      <button type="button" className={styles.textbutton} onClick={handlePlay}>
        <Volume2 size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {status ? (
        <p className={styles.small} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

export function LanguageSheet({
  open,
  locales,
  currentLocale,
  title,
  onSelect,
  onClose,
}: {
  open: boolean;
  locales: AnyTradeLocale[];
  currentLocale: AnyTradeLocale;
  title: string;
  onSelect: (locale: AnyTradeLocale) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  function previewLocale(loc: AnyTradeLocale) {
    const meta = TRADE_LANGUAGE_META[loc];
    try {
      const synth = window.speechSynthesis;
      synth?.cancel();
      const voice = synth
        ?.getVoices()
        .find((v) => v.lang.toLowerCase().startsWith(loc));
      if (synth && voice) {
        const u = new SpeechSynthesisUtterance(meta.nativeName);
        u.voice = voice;
        u.lang = voice.lang;
        synth.speak(u);
        setStatusMsg(null);
        return;
      }
    } catch {}
    setStatusMsg(`${meta.nativeName} (${meta.englishName})`);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="tradeLangDialogTitle"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.sheethead}>
          <h2 id="tradeLangDialogTitle" className={styles.h3}>
            <Globe size={22} aria-hidden="true" style={{ marginRight: 8 }} />
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div>
          {locales.map((loc) => {
            const meta = TRADE_LANGUAGE_META[loc];
            return (
              <div key={loc} className={styles.langrow}>
                <button
                  type="button"
                  className={styles.textbutton}
                  lang={loc}
                  aria-current={loc === currentLocale ? "true" : undefined}
                  onClick={() => onSelect(loc)}
                >
                  <span>{meta.nativeName}</span>
                  <small>{meta.englishName}</small>
                </button>
                <button
                  type="button"
                  className={styles.voiceBtn}
                  aria-label={`Hear ${meta.englishName}`}
                  onClick={() => previewLocale(loc)}
                >
                  <Volume2 size={18} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
        {statusMsg ? (
          <p className={styles.small} role="status">
            {statusMsg}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
