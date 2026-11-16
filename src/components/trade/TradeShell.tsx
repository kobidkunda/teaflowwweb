"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import type { AnyTradeLocale } from "@/lib/trade/contracts";
import { TRADE_LANGUAGE_META, type TradeDictionary } from "@/lib/trade/i18nMeta";
import { LanguageSheet } from "./ui/Primitives";
import styles from "./trade.module.css";

const TRADE_LANG_STORAGE_KEY = "tf_trade_lang";

export function TradeShell({
  locale,
  enabledLocales,
  dict,
  stickyAction,
  modalOpen = false,
  children,
}: {
  locale: AnyTradeLocale;
  enabledLocales: AnyTradeLocale[];
  dict: TradeDictionary;
  stickyAction?: React.ReactNode;
  modalOpen?: boolean;
  children: React.ReactNode;
}) {
  const [langOpen, setLangOpen] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const meta = TRADE_LANGUAGE_META[locale] || TRADE_LANGUAGE_META.en;

  function handleSelectLocale(nextLocale: AnyTradeLocale) {
    try {
      window.localStorage.setItem(TRADE_LANG_STORAGE_KEY, nextLocale);
    } catch {}
    setLangOpen(false);
    const qs = searchParams.toString();
    const rest = pathname.replace(/^\/tea-shops\/[^/]+/, "") || "";
    const target = `/tea-shops/${nextLocale}${rest}${qs ? `?${qs}` : ""}`;
    router.push(target);
    setTimeout(() => langBtnRef.current?.focus(), 0);
  }

  return (
    <div className={styles.tradeRoot} lang={locale}>
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.nav}`}>
          <Link href={`/tea-shops/${locale}`} className={styles.brandlink}>
            <span className={styles.logo}>TeaFloww</span>
            <span className={styles.tradeBadge}>{dict["brand.subtitle"]}</span>
          </Link>
          <nav className={styles.navlinks} aria-label="Trade sections">
            <a href="#trial">{dict["nav.trial"]}</a>
            <a href="#bulk">{dict["nav.bulk"]}</a>
            <a href="#cost">{dict["nav.cost"]}</a>
          </nav>
          <button
            ref={langBtnRef}
            type="button"
            className={styles.pill}
            style={{ marginLeft: "auto" }}
            onClick={() => setLangOpen(true)}
            aria-label={dict["lang.chooseTitle"]}
          >
            <Globe size={18} aria-hidden="true" />
            <span>{meta.nativeName} ▾</span>
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={styles.wrap}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <span className={styles.logo}>TeaFloww</span>
          <span style={{ fontSize: 12 }}>
            Nirva · Siliguri, West Bengal · {dict["brand.subtitle"]}
          </span>
        </div>
      </footer>

      {stickyAction && !modalOpen && !langOpen ? (
        <div className={`${styles.sticky} ${styles.stickyActive}`}>
          {stickyAction}
        </div>
      ) : null}

      <LanguageSheet
        open={langOpen}
        locales={enabledLocales}
        currentLocale={locale}
        title={dict["lang.chooseTitle"]}
        onSelect={handleSelectLocale}
        onClose={() => {
          setLangOpen(false);
          setTimeout(() => langBtnRef.current?.focus(), 0);
        }}
      />
    </div>
  );
}
