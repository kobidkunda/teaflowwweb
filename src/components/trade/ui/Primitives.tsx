"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Globe, Pause, Play, RotateCcw, Volume2, X } from "lucide-react";
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

/**
 * Native top-layer modal dialog implementing Modern Web Guidance:
 * - Uses showModal() / close() (never raw <dialog open>)
 * - Omits redundant role="dialog" and aria-modal="true"
 * - Supports closedby="any" + Safari pointerdown/pointerup outside light-dismiss fallback
 */
export function ModalDialog({
  open,
  onClose,
  titleId,
  title,
  wide = false,
  closeLabel = "Close",
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId?: string;
  title: React.ReactNode;
  wide?: boolean;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  const fallbackId = useId();
  const headingId = titleId || fallbackId;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      try {
        dlg.showModal();
      } catch {
        // Fallback only in environments without showModal (e.g. partial JSDOM)
        dlg.setAttribute("open", "");
      }
    } else if (!open && dlg.open) {
      try {
        dlg.close();
      } catch {
        dlg.removeAttribute("open");
      }
    }
  }, [open]);

  // Safari fallback for closedby="any" (pointerdown + pointerup outside bounding box)
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg || typeof HTMLDialogElement === "undefined") return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dlg.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onDown = (e: PointerEvent) => {
      pressedOutsideRef.current = dlg.open && isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutsideRef.current && dlg.open && isOutside(e)) {
        onClose();
      }
      pressedOutsideRef.current = false;
    };

    dlg.addEventListener("pointerdown", onDown);
    dlg.addEventListener("pointerup", onUp);
    return () => {
      dlg.removeEventListener("pointerdown", onDown);
      dlg.removeEventListener("pointerup", onUp);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`.trim()}
      aria-labelledby={headingId}
      {...({ closedby: "any" } as Record<string, string>)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.sheethead}>
          <h2 id={headingId} className={styles.h3}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
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
  intent?: "primary" | "soft" | "outline" | "gold" | "whatsapp";
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
      : intent === "gold"
      ? styles.btnGold
      : intent === "whatsapp"
      ? styles.btnWhatsapp
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
  increaseLabel = "Increase",
  decreaseLabel = "Decrease",
  locale,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  increaseLabel?: string;
  decreaseLabel?: string;
  locale: string;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.counter}>
        <button
          type="button"
          aria-label={`${decreaseLabel} ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <output aria-live="polite">{formatTradeNumber(value, locale)}</output>
        <button
          type="button"
          aria-label={`${increaseLabel} ${label}`}
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
  invalidMessage = "Enter a valid 6-digit Indian PIN code.",
  pending = false,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string | null;
  buttonLabel: string;
  invalidMessage?: string;
  pending?: boolean;
  onChange: (pin: string) => void;
  onBlur?: () => void;
}) {
  const errId = `${id}-err`;
  const [touched, setTouched] = useState(false);
  const localInvalid = touched && value.length > 0 && !/^[1-9][0-9]{5}$/.test(value);
  const activeError =
    error || (localInvalid ? invalidMessage : null);

  return (
    <div>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputrow}>
        <input
          id={id}
          name="postalCode"
          type="text"
          className={styles.input}
          inputMode="numeric"
          autoComplete="postal-code"
          enterKeyHint="search"
          maxLength={6}
          pattern="[1-9][0-9]{5}"
          placeholder={placeholder}
          value={value}
          aria-invalid={activeError ? "true" : "false"}
          aria-describedby={activeError ? errId : undefined}
          onBlur={() => {
            setTouched(true);
            onBlur?.();
          }}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          required
        />
        <ActionButton type="submit" intent="primary" pending={pending}>
          {buttonLabel}
        </ActionButton>
      </div>
      {activeError ? (
        <p id={errId} className={styles.errorText} role="alert">
          {activeError}
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

export function AudioButton({
  label,
  pauseLabel = "Pause",
  replayLabel = "Replay",
  script,
  locale,
  audioUrl,
  transcript,
  variant = "light",
}: {
  label: string;
  pauseLabel?: string;
  replayLabel?: string;
  script: string;
  locale: AnyTradeLocale;
  audioUrl?: string | null;
  transcript?: string | null;
  variant?: "light" | "dark";
}) {
  const [playState, setPlayState] = useState<"idle" | "playing" | "paused">("idle");
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

  function stopAll() {
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      window.speechSynthesis?.cancel();
    } catch {}
  }

  function startPlayback() {
    stopAll();
    const spoken = transcript || script;

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayState("idle");
      audio.onerror = () => {
        setPlayState("idle");
        setStatus(spoken);
      };
      setPlayState("playing");
      setStatus(spoken);
      audio.play().catch(() => {
        setPlayState("idle");
        setStatus(spoken);
      });
      return;
    }

    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    const bcp47 = TRADE_LANGUAGE_META[locale]?.bcp47 || "en-IN";
    const voices = synth?.getVoices?.() || [];
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(bcp47.split("-")[0]));
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      setStatus(spoken);
      setPlayState("idle");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(spoken);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = bcp47;
    }
    utterance.onend = () => setPlayState("idle");
    utterance.onerror = () => setPlayState("idle");
    setPlayState("playing");
    setStatus(spoken);
    synth.speak(utterance);
  }

  function togglePlayPause() {
    if (playState === "playing") {
      try {
        if (audioRef.current) audioRef.current.pause();
        window.speechSynthesis?.pause();
      } catch {}
      setPlayState("paused");
      return;
    }
    if (playState === "paused") {
      try {
        if (audioRef.current) {
          void audioRef.current.play();
        } else {
          window.speechSynthesis?.resume();
        }
        setPlayState("playing");
      } catch {
        startPlayback();
      }
      return;
    }
    startPlayback();
  }

  const btnCls =
    variant === "dark" ? `${styles.voiceControlBtn} ${styles.voiceControlDark}` : styles.voiceControlBtn;

  return (
    <div>
      <div className={styles.voiceBar}>
        <button
          type="button"
          className={btnCls}
          onClick={togglePlayPause}
          aria-pressed={playState === "playing"}
        >
          {playState === "playing" ? (
            <>
              <Pause size={16} aria-hidden="true" />
              <span>{pauseLabel}</span>
            </>
          ) : playState === "paused" ? (
            <>
              <Play size={16} aria-hidden="true" />
              <span>{label}</span>
            </>
          ) : (
            <>
              <Volume2 size={16} aria-hidden="true" />
              <span>{label}</span>
            </>
          )}
        </button>
        {playState !== "idle" || status ? (
          <button
            type="button"
            className={btnCls}
            onClick={startPlayback}
            aria-label={replayLabel}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>{replayLabel}</span>
          </button>
        ) : null}
      </div>
      {status ? (
        <p
          className={variant === "dark" ? styles.voiceTranscriptDark : styles.small}
          role="status"
        >
          {status}
        </p>
      ) : null}
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

  const spokenSummary = `${dict["quote.heading"]}. ${dict["quote.tea"]}: ${formatInrPaise(
    quote.goodsPaise,
    locale
  )}. ${dict["quote.freight"]}: ${formatInrPaise(quote.freightPaise, locale)}. ${
    dict["quote.total"]
  }: ${formatInrPaise(quote.totalPaise, locale)}. ${perKgText}. ${handoverText}.`;

  return (
    <div>
      <div className={styles.ticketHeaderRow}>
        <h3 className={styles.h3}>{dict["quote.heading"]}</h3>
        <span className={styles.handoverBadge}>
          {quote.handover.kind === "depot" ? dict["ui.depot"] || "Transport Depot" : dict["ui.doorstep"] || "Doorstep"}
        </span>
      </div>
      <p className={styles.small}>
        {quote.lines
          .map(
            (l) =>
              `${l.quantity} × ${quote.quoteType === "trial" ? dict["trial.catalogTitle"] || l.productName : dict[`product.${l.productId}.name`] || l.productName} (${
                l.grams >= 1000 ? `${l.grams / 1000} kg` : `${l.grams} g`
              })`
          )
          .join(" + ")}
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
      <div className={styles.small} style={{ marginTop: 0 }}>
        {dict["quote.total"]}
      </div>
      <div className={styles.amount}>{formatInrPaise(quote.totalPaise, locale)}</div>
      <div>
        <b>{perKgText}</b>
      </div>
      <p className={styles.small}>
        {handoverText} · {quote.destinationPin}
        {quote.etaLabel ? ` · ${dict[`lane.${quote.laneId}.eta`] || quote.etaLabel}` : ""}
      </p>
      {quote.handover.kind === "depot" && !quote.handover.onwardIncluded ? (
        <p className={styles.small}>
          {dict["ui.onward"] || "Onward transport from depot is arranged by the buyer."}
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
            Chargeable weight: {formatTradeNumber(quote.billedGrams / 1000, locale)} kg · Net{" "}
            {formatTradeNumber(quote.netGrams / 1000, locale)} /{" "}
            {formatTradeNumber(quote.maxNetGrams / 1000, locale)} kg
          </div>
          <div className={styles.capacityTrack} aria-hidden="true">
            <div
              className={styles.capacityFill}
              style={{ width: `${Math.min(100, Math.round(quote.capacityRatio * 100))}%` }}
            />
          </div>
        </div>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <AudioButton
          label={dict["hero.listen"]}
          pauseLabel={dict["hero.pause"]}
          replayLabel={dict["hero.replay"]}
          script={spokenSummary}
          locale={locale}
        />
      </div>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
      {extra}
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
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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
    <ModalDialog
      open={open}
      onClose={onClose}
      titleId="tradeLangDialogTitle"
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Globe size={22} aria-hidden="true" />
          <span>{title}</span>
        </span>
      }
    >
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
    </ModalDialog>
  );
}
