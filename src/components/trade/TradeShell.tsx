"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Globe, MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { FunnelTracker } from "@/components/analytics/FunnelTracker";
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
  onOpenEnquiry,
  children,
}: {
  locale: AnyTradeLocale;
  enabledLocales: AnyTradeLocale[];
  dict: TradeDictionary;
  stickyAction?: React.ReactNode;
  modalOpen?: boolean;
  onOpenEnquiry?: () => void;
  children: React.ReactNode;
}) {
  const [langOpen, setLangOpen] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const langBtnRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const meta = TRADE_LANGUAGE_META[locale] || TRADE_LANGUAGE_META.en;

  useEffect(() => {
    const onScroll = () => {
      setIsStuck(window.scrollY > 18);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <FunnelTracker />
      <a href="#main-content" className={styles.skipLink}>
        {dict["ui.skip"]}
      </a>

      <header
        ref={headerRef}
        className={`${styles.header} ${isStuck ? styles.headerStuck : ""}`}
      >
        <div className={`${styles.wrap} ${styles.nav}`}>
          <Link href={`/tea-shops/${locale}`} className={styles.brandlink}>
            <BrandLogo variant="symbol" size={34} aria-hidden={true} />
            <span className={styles.brandWordmarkGroup}>
              <span className={styles.logo}>TEAFLOWW</span>
              <span className={styles.tradeBadge}>{dict["brand.subtitle"]}</span>
            </span>
          </Link>

          <nav className={styles.navlinks} aria-label="Trade sections">
            <a href={`/tea-shops/${locale}#trial`}>{dict["nav.trial"]}</a>
            <a href={`/tea-shops/${locale}#blends`}>{dict["nav.blends"]}</a>
            <a href={`/tea-shops/${locale}#bulk`}>{dict["nav.bulk"]}</a>
            <a href={`/tea-shops/${locale}#cost`}>{dict["nav.cost"]}</a>
          </nav>

          <div className={styles.headerActions}>
            {onOpenEnquiry ? (
              <button
                type="button"
                className={styles.headerEnquiryBtn}
                aria-label={dict["nav.enquiry"]}
                onClick={onOpenEnquiry}
              >
                <MessageCircle size={16} aria-hidden="true" />
                <span>{dict["nav.enquiry"]}</span>
              </button>
            ) : null}
            <button
              ref={langBtnRef}
              type="button"
              className={styles.pill}
              onClick={() => setLangOpen(true)}
              aria-label={dict["lang.chooseTitle"]}
            >
              <Globe size={17} aria-hidden="true" />
              <span>{meta.nativeName} ▾</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <div className={styles.footerBrandBlock}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BrandLogo variant="symbol-gold" size={34} aria-hidden={true} />
              <div>
                <div className={styles.footerLogo}>TEAFLOWW</div>
                <div className={styles.footerSub}>
                  Nirva · Siliguri, West Bengal · {dict["brand.subtitle"]}
                </div>
              </div>
            </div>
            <p className={styles.footerAddr}>
              Works: 00, Fulbari Ghoshpukur Bypass, Fulbari, Siliguri 734015 · GSTIN 19CTHPK8646J2ZY
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href={`/tea-shops/${locale}#trial`}>{dict["nav.trial"]}</a>
            <a href={`/tea-shops/${locale}#blends`}>{dict["nav.blends"]}</a>
            <a href={`/tea-shops/${locale}#bulk`}>{dict["nav.bulk"]}</a>
            <a href={`/tea-shops/${locale}#cost`}>{dict["nav.cost"]}</a>
            <Link href="/privacy">{dict["ui.privacy"]}</Link>
            <Link href="/terms">{dict["ui.terms"]}</Link>
          </div>
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
