"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, Volume2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { FunnelTracker } from "@/components/analytics/FunnelTracker";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import { TRADE_LANGUAGE_META } from "@/lib/trade/i18nMeta";
import styles from "./trade.module.css";

const TRADE_LANG_STORAGE_KEY = "tf_trade_lang";

export function TradeNeutralEntry({
  enabledLocales,
}: {
  enabledLocales: AnyTradeLocale[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    const paidClick = ["gclid", "fbclid", "gbraid", "wbraid", "msclkid"]
      .some((param) => searchParams.has(param));
    const paidMedium = /^(cpc|ppc|paid|paid_social|paid-search|paid_search)$/i
      .test(searchParams.get("utm_medium") || "");
    let saved: AnyTradeLocale | null = null;
    try {
      saved = window.localStorage.getItem(TRADE_LANG_STORAGE_KEY) as AnyTradeLocale | null;
    } catch {
      // Campaign visitors still need a destination if storage is unavailable.
    }
    // Paid ads should open the shop, not a mandatory language picker.
    // Keep all UTM and ad click identifiers on the new URL.
    const locale = saved && enabledLocales.includes(saved)
      ? saved
      : (paidClick || paidMedium) && enabledLocales.includes("en")
        ? "en"
        : null;
    if (locale) {
      router.replace("/tea-shops/" + locale + (qs ? "?" + qs : ""));
    }
  }, [enabledLocales, router, searchParams]);

  function preview(loc: AnyTradeLocale) {
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
      }
    } catch {}
  }

  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <div className={styles.tradeRoot}>
      <FunnelTracker />
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.nav}`}>
          <Link href="/" className={styles.brandlink}>
            <BrandLogo variant="symbol" size={34} aria-hidden={true} />
            <span className={styles.brandWordmarkGroup}>
              <span className={styles.logo}>TEAFLOWW</span>
              <span className={styles.tradeBadge}>For tea shops</span>
            </span>
          </Link>
        </div>
      </header>
      <main id="main-content" className={styles.wrap} style={{ paddingBlock: 48 }}>
        <div className={styles.panel} style={{ maxWidth: 540, marginInline: "auto" }}>
          <h1 className={styles.h2} style={{ fontSize: 32, marginBottom: 8 }}>
            <Globe size={24} aria-hidden="true" style={{ marginRight: 8 }} />
            Choose your language
          </h1>
          <p className={styles.small} lang="bn">
            আপনার ভাষা বেছে নিন · अपनी भाषा चुनें · ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ
          </p>
          <div style={{ marginTop: 18 }}>
            {enabledLocales.map((loc) => {
              const meta = TRADE_LANGUAGE_META[loc] || TRADE_LANGUAGE_META.en;
              return (
                <div key={loc} className={styles.langrow}>
                  <Link
                    href={`/tea-shops/${loc}${suffix}`}
                    className={styles.textbutton}
                    lang={loc}
                    onClick={() => {
                      try {
                        window.localStorage.setItem(TRADE_LANG_STORAGE_KEY, loc);
                      } catch {}
                    }}
                  >
                    <span>{meta.nativeName}</span>
                    <small>{meta.englishName}</small>
                  </Link>
                  <button
                    type="button"
                    className={styles.voiceBtn}
                    aria-label={`Hear ${meta.englishName}`}
                    onClick={() => preview(loc)}
                  >
                    <Volume2 size={18} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
