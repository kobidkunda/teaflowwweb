"use client";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  Coffee,
  MapPin,
  MessageCircle,
  Package,
  Truck,
} from "lucide-react";
import type { TrialPublicDto } from "@/lib/trials/types";
import type {
  AnyTradeLocale,
  QuoteResult,
  TradePaymentMethod,
} from "@/lib/trade/contracts";
import type {
  TradeProductDto,
  TradeSettings,
  TradeSharedPilotRecord,
} from "@/lib/trade/catalogue";
import type { TradeDictionary } from "@/lib/trade/i18nMeta";
import { tradeText } from "@/lib/trade/copy";
import {
  ActionButton,
  AudioButton,
  ChoiceGroup,
  InlineStatus,
  ModalDialog,
  PinField,
  PriceReceipt,
  QuantityStepper,
  formatInrPaise,
} from "./ui/Primitives";
import { TradeShell } from "./TradeShell";
import { TradeEnquiryForm } from "./TradeEnquiryForm";
import { CupCalculator } from "./CupCalculator";
import { TradeHeroArt } from "./TradeHeroArt";
import { TradePilotLocations } from "./TradePilotLocations";
import styles from "./trade.module.css";
import ui from "./ritual.module.css";

export function TradeStorefrontClient({
  locale,
  dict,
  settings,
  products,
  trial,
  sharedPilots,
  heroAudioUrl,
  heroTranscript,
}: {
  locale: AnyTradeLocale;
  dict: TradeDictionary;
  settings: TradeSettings;
  products: TradeProductDto[];
  trial: TrialPublicDto | null;
  sharedPilots: TradeSharedPilotRecord[];
  heroAudioUrl?: string | null;
  heroTranscript?: string | null;
}) {
  const t = (key: string) => tradeText(dict, `ui.${key}`);
  const productName = (p: TradeProductDto) =>
    dict[`product.${p.productId}.name`] ||
    (locale === "hi" ? dict[`ui.product.${p.slug}`] : null) ||
    p.name;
  const router = useRouter();
  const search = useSearchParams();
  const initial =
    products.find((p) => p.slug === search.get("blend")) || products[0];
  const [productId, setProductId] = useState(initial?.productId || 0);
  const product =
    products.find((p) => p.productId === productId) || products[0];
  const defaultVariant = (p?: TradeProductDto) =>
    p?.variants.find((v) => v.id === p.defaultVariantId && v.inStock) ||
    p?.variants.find((v) => v.grams === 25000 && v.inStock) ||
    p?.variants.find((v) => v.inStock);
  const [variantId, setVariantId] = useState(defaultVariant(initial)?.id || 0);
  const variant =
    product?.variants.find((v) => v.id === variantId) ||
    defaultVariant(product);
  const [quantity, setQuantity] = useState(1);
  const [payment, setPayment] = useState<TradePaymentMethod>("prepaid");
  const [pin, setPin] = useState(
    /^[1-9][0-9]{5}$/.test(search.get("pin") || "") ? search.get("pin")! : "",
  );
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [pending, setPending] = useState(false);
  const [pinError, setPinError] = useState("");
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialPin, setTrialPin] = useState("");
  const [trialQuote, setTrialQuote] = useState<QuoteResult | null>(null);
  const [trialPending, setTrialPending] = useState(false);
  const [trialError, setTrialError] = useState("");
  const [enquiryTrial, setEnquiryTrial] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [brewOpen, setBrewOpen] = useState(false);
  const [blendB, setBlendB] = useState(products[1]?.productId || 0);
  const compareB = products.find((p) => p.productId === blendB);
  const requestRef = useRef(0);
  const trialRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [editing, setEditing] = useState(false);
  const [enquiryVisible, setEnquiryVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => setEnquiryVisible(entries[0].isIntersecting),
      { threshold: 0.05 },
    );
    const element = document.getElementById("enquiry");
    if (element) observer.observe(element);
    const focus = () =>
      setEditing(
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName || "",
        ),
      );
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    return () => {
      observer.disconnect();
      controllerRef.current?.abort();
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
    };
  }, []);
  function invalidate() {
    controllerRef.current?.abort();
    requestRef.current++;
    setQuote(null);
    setPending(false);
  }
  function choose(p: TradeProductDto, id?: number) {
    setProductId(p.productId);
    setVariantId(id || defaultVariant(p)?.id || 0);
    invalidate();
  }
  function focusBulk() {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById("bulk")
      ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
    document.getElementById("trade-pin")?.focus({ preventScroll: true });
  }
  const totalGrams =
    trial?.components.reduce((sum, c) => sum + c.weight_g, 0) ||
    trial?.net_weight_g ||
    0;
  const packLabel = (g: number) => (g >= 1000 ? `${g / 1000} kg` : `${g} g`);
  async function checkQuote(isTrial: boolean) {
    const destination = isTrial ? trialPin : pin;
    if (!/^[1-9][0-9]{5}$/.test(destination)) {
      (isTrial ? setTrialError : setPinError)(t("pinError"));
      return;
    }
    if (isTrial ? !trial : !variant) return;
    const seq = isTrial ? ++trialRef.current : ++requestRef.current;
    if (!isTrial) {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
    }
    const setResult = isTrial ? setTrialQuote : setQuote,
      setBusy = isTrial ? setTrialPending : setPending;
    setBusy(true);
    setResult(null);
    (isTrial ? setTrialError : setPinError)("");
    try {
      const res = await fetch("/api/trade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: isTrial ? undefined : controllerRef.current?.signal,
        body: JSON.stringify({
          channel: "trade",
          quoteType: isTrial ? "trial" : "bulk",
          locale,
          destinationPin: destination,
          payment: isTrial ? "prepaid" : payment,
          ...(isTrial
            ? { trialId: trial!.id, quantity: 1 }
            : { lines: [{ variantId: variant!.id, quantity }] }),
        }),
      });
      if (!res.ok) throw new Error();
      const result: QuoteResult = await res.json();
      if (seq === (isTrial ? trialRef.current : requestRef.current))
        setResult(result);
    } catch (e) {
      if (
        (e as Error).name !== "AbortError" &&
        seq === (isTrial ? trialRef.current : requestRef.current)
      )
        setResult({ kind: "temporarily_unavailable", retryable: true });
    } finally {
      if (seq === (isTrial ? trialRef.current : requestRef.current))
        setBusy(false);
    }
  }
  function openEnquiry(isTrial = false) {
    setTrialOpen(false);
    setEnquiryTrial(isTrial);
    setEnquiryOpen(true);
  }
  function buy(q: Extract<QuoteResult, { kind: "confirmed" }>) {
    router.push(
      `/tea-shops/${locale}/checkout?quoteId=${encodeURIComponent(q.id)}`,
    );
  }
  function openTrial() {
    trialRef.current++;
    setTrialQuote(null);
    setTrialPending(false);
    setTrialError("");
    setTrialPin(pin);
    setTrialOpen(true);
  }
  function receipt(q: QuoteResult | null, isTrial = false) {
    if (q?.kind === "confirmed")
      return (
        <PriceReceipt
          quote={q}
          dict={dict}
          locale={locale}
          action={
            <ActionButton onClick={() => buy(q)}>
              {dict["quote.reviewPack"]}
              <ArrowRight size={18} aria-hidden="true" />
            </ActionButton>
          }
          extra={<p className={styles.small}>{t("finalReviewBody")}</p>}
        />
      );
    if (q?.kind === "manual")
      return (
        <InlineStatus
          title={dict["quote.manualTitle"]}
          body={dict["quote.manualBody"].replace("{pin}", q.destinationPin)}
          action={
            <ActionButton
              onClick={() => {
                openEnquiry(q.quoteType === "trial");
              }}
            >
              {dict["quote.prepareEnquiry"]}
            </ActionButton>
          }
        />
      );
    if (q?.kind === "temporarily_unavailable")
      return (
        <InlineStatus
          title={t("error")}
          body={t("deliveryNote")}
          action={
            <ActionButton onClick={() => void checkQuote(isTrial)}>
              {t("retry")}
            </ActionButton>
          }
        />
      );
    if (q?.kind === "unavailable")
      return (
        <InlineStatus
          title={t("quoteUnavailable")}
          body={t("choosePayment")}
          action={
            <ActionButton onClick={() => openEnquiry()}>
              {t("help")}
            </ActionButton>
          }
        />
      );
    return (
      <div>
        <div className={styles.kicker}>{t("previewTotal")}</div>
        <h3 className={styles.h3}>{dict["quote.heading"]}</h3>
        {!isTrial && variant && (
          <>
            <p>
              {productName(product)} · {quantity} × {packLabel(variant.grams)}
            </p>
            <div className={styles.row}>
              <span>{dict["quote.tea"]}</span>
              <strong>
                {formatInrPaise(variant.pricePaise * quantity, locale)}
              </strong>
            </div>
          </>
        )}
        <div className={styles.amount}>₹—</div>
        <p className={styles.small}>{dict["quote.enterPin"]}</p>
      </div>
    );
  }
  const packs = useMemo(
    () =>
      Array.from(
        new Set(
          products.flatMap((p) =>
            p.variants.filter((v) => v.inStock).map((v) => v.grams),
          ),
        ),
      ),
    [products],
  );
  const heroImage = settings.hero_image_url;
  const pouchesImage = settings.trial_image_url;
  const knownOrder = [
    "Rozana Kadak — Daily Stall Tea",
    "Elaichi Tea — Cardamom Chai",
    "Ginger Tea — Adrak Chai",
    "Masala Tea — Spiced Chai Blend",
  ];
  const displayComponents = isGeneratedPouches
    ? [...(trial?.components || [])].sort((a, b) => {
        const rank = (name: string) => {
          const i = knownOrder.indexOf(name);
          return i < 0 ? 99 : i;
        };
        return rank(a.name) - rank(b.name);
      })
    : trial?.components || [];
  const steps = [
    { icon: Coffee, title: "taste", body: "tasteBody", href: "#brew-proof" },
    { icon: Calculator, title: "compare", body: "compareBody", href: "#cost" },
    { icon: Package, title: "order", body: "orderBody", href: "#bulk" },
  ];
  const sticky =
    quote?.kind === "confirmed" ? (
      <ActionButton onClick={() => buy(quote)}>
        {dict["quote.reviewPack"]} · {formatInrPaise(quote.totalPaise, locale)}
        <ArrowRight size={16} />
      </ActionButton>
    ) : (
      <div className={styles.stickySplit}>
        <ActionButton intent="gold" onClick={trial ? openTrial : focusBulk}>
          {trial ? dict["hero.ctaTrial"] : dict["hero.ctaBulk"]}
        </ActionButton>
        <ActionButton onClick={focusBulk}>{dict["hero.ctaBulk"]}</ActionButton>
      </div>
    );
  return (
    <TradeShell
      locale={locale}
      enabledLocales={settings.enabled_locales}
      dict={dict}
      modalOpen={trialOpen || enquiryOpen || brewOpen}
      stickyAction={editing || enquiryVisible ? null : sticky}
      onOpenEnquiry={() => openEnquiry()}
    >
      <div className={ui.ritual}>
        <section className={ui.hero} aria-labelledby="tradeHeroTitle">
          <TradeHeroArt key={heroImage} src={heroImage} alt={t("heroAlt")} hindi={locale === "hi"} />
          <div className={`${styles.wrap} ${ui.heroInner}`}>
            <div className={ui.heroCopy}>
              <div className={styles.kickerDark}>{dict["hero.kicker"]}</div>
              <h1 id="tradeHeroTitle">
                {dict["hero.title"]}
                <em>{dict["hero.titleEmphasis"]}</em>
              </h1>
              <p>{dict["hero.intro"]}</p>
              <div className={ui.heroActions}>
                <ActionButton
                  intent="gold"
                  onClick={trial ? openTrial : focusBulk}
                >
                  {trial ? dict["hero.ctaTrial"] : dict["hero.ctaBulk"]}
                  <ArrowRight size={21} />
                </ActionButton>
                <a
                  href="#bulk"
                  onClick={(e) => {
                    e.preventDefault();
                    focusBulk();
                  }}
                >
                  {dict["hero.ctaBulk"]}
                </a>
              </div>
              <div className={ui.heroHelp}>
                <button type="button" onClick={() => openEnquiry()}>
                  <MessageCircle size={18} aria-hidden="true" />
                  {t("help")}
                </button>
                <AudioButton
                  label={dict["hero.listen"]}
                  pauseLabel={dict["hero.pause"]}
                  replayLabel={dict["hero.replay"]}
                  script={dict["hero.intro"]}
                  locale={locale}
                  audioUrl={heroAudioUrl}
                  transcript={heroTranscript}
                  variant="dark"
                />
              </div>
            </div>
          </div>
        </section>
        <section
          id="trial"
          className={ui.trialBand}
          aria-labelledby="trialHeading"
        >
          <div className={`${styles.wrap} ${ui.trialInner}`}>
            <div className={ui.trialSummary}>
              <div className={styles.kickerDark}>{dict["trial.kicker"]}</div>
              <h2 id="trialHeading">{dict["trial.title"]}</h2>
              {trial ? (
                <>
                  <p>
                    {new Set(trial.components.map((c) => c.weight_g)).size === 1
                      ? `${trial.components.length} × ${trial.components[0]?.weight_g} g`
                      : trial.components
                          .map((c) => `${c.weight_g} g`)
                          .join(" + ")}{" "}
                    · {t("net")} {totalGrams} g
                  </p>
                  <strong className={ui.trialPrice}>
                    {formatInrPaise(trial.price_paise, locale)}
                  </strong>
                  <ActionButton
                    intent="gold"
                    disabled={!trial.in_stock}
                    onClick={openTrial}
                  >
                    {dict["trial.cta"]}
                    <ArrowRight size={18} />
                  </ActionButton>
                </>
              ) : (
                <p>{dict["trial.unavailable"]}</p>
              )}
            </div>
            <figure className={ui.pouches}>
              <Image
                src={pouchesImage}
                alt={t("pouchesAlt")}
                width={1600}
                height={650}
                sizes="(max-width: 700px) 100vw, 50vw"
              />
              {trial && (
                <figcaption>
                  {displayComponents.map((c) => (
                    <span key={c.slot_index}>
                      {dict[`trial.component.${c.slot_index}.name`] || c.name}
                      <small>{c.weight_g} g</small>
                    </span>
                  ))}
                </figcaption>
              )}
            </figure>
            <div className={ui.deliveryNote}>
              <MapPin aria-hidden="true" size={27} />
              <p>{t("deliveryNote")}</p>
              <span>{t("direct")}</span>
            </div>
          </div>
          <ol className={`${styles.wrap} ${ui.steps}`}>
            {steps.map((s, i) => (
              <li key={s.title}>
                <s.icon size={32} strokeWidth={1.5} aria-hidden="true" />
                <a href={s.href}>
                  <small>0{i + 1}</small>
                  <strong>{t(s.title)}</strong>
                  <span>{t(s.body)}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
        <section
          id="bulk"
          className={`${styles.section} ${ui.buySection}`}
          aria-labelledby="bulkHeading"
        >
          <div className={styles.wrap}>
            <div className={styles.titleRow}>
              <div>
                <div className={styles.kicker}>{dict["bulk.kicker"]}</div>
                <h2 id="bulkHeading" className={styles.h2}>
                  {dict["bulk.title"]}
                </h2>
              </div>
              <p className={styles.small}>{t("direct")}</p>
            </div>
            {!product || !variant ? (
              <InlineStatus
                title={t("noProducts")}
                body={t("enquiryBody")}
                action={
                  <ActionButton onClick={() => openEnquiry()}>
                    {t("help")}
                  </ActionButton>
                }
              />
            ) : (
              <div className={ui.buyGrid}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void checkQuote(false);
                  }}
                  className={ui.buyForm}
                >
                  <label className={styles.fieldLabel} htmlFor="trade-blend">
                    {dict["bulk.chooseTea"]}
                  </label>
                  <select
                    id="trade-blend"
                    className={styles.select}
                    value={product.productId}
                    onChange={(e) => {
                      const p = products.find(
                        (p) => p.productId === Number(e.target.value),
                      );
                      if (p) choose(p);
                    }}
                  >
                    {products.map((p) => (
                      <option value={p.productId} key={p.productId}>
                        {productName(p)}
                      </option>
                    ))}
                  </select>
                  <ChoiceGroup
                    label={dict["bulk.packSize"]}
                    selectedId={variant.id}
                    options={product.variants.map((v) => ({
                      id: v.id,
                      label: `${packLabel(v.grams)}${v.inStock ? "" : ` · ${t("out")}`}`,
                      disabled: !v.inStock,
                    }))}
                    onSelect={(id) => {
                      setVariantId(id);
                      invalidate();
                    }}
                  />
                  <div className={ui.paymentRow}>
                    <QuantityStepper
                      increaseLabel={t("increase")}
                      decreaseLabel={t("decrease")}
                      label={dict["bulk.packs"]}
                      value={quantity}
                      locale={locale}
                      onChange={(q) => {
                        setQuantity(q);
                        invalidate();
                      }}
                    />
                    <ChoiceGroup
                      label={dict["bulk.payment"]}
                      selectedId={payment}
                      options={[
                        { id: "prepaid", label: dict["payment.prepaid"] },
                        { id: "cod", label: dict["payment.cod"] },
                      ]}
                      onSelect={(p) => {
                        setPayment(p);
                        invalidate();
                      }}
                    />
                  </div>
                  <PinField
                    invalidMessage={t("pinError")}
                    id="trade-pin"
                    label={dict["bulk.pinLabel"]}
                    value={pin}
                    error={pinError}
                    buttonLabel={t("buyBulk")}
                    pending={pending}
                    onChange={(v) => {
                      setPin(v);
                      setPinError("");
                      invalidate();
                    }}
                  />
                  <p className={styles.small}>{t("choosePayment")}</p>
                </form>
                <div
                  className={ui.receipt}
                  aria-live="polite"
                  aria-busy={pending}
                >
                  {receipt(quote)}
                </div>
              </div>
            )}
          </div>
        </section>
        <section
          className={`${styles.section} ${ui.catalogue}`}
          id="blends"
          aria-labelledby="blendsHeading"
        >
          <div className={styles.wrap}>
            <div className={styles.titleRow}>
              <div>
                <div className={styles.kicker}>{dict["blends.kicker"]}</div>
                <h2 className={styles.h2} id="blendsHeading">
                  {dict["blends.title"]}
                </h2>
              </div>
              <p className={styles.small}>{dict["blends.subtitle"]}</p>
            </div>
            <div className={ui.blends}>
              {products.map((p) => {
                const available = p.variants.filter((v) => v.inStock);
                const lowest = available.length
                  ? Math.min(
                      ...available.map((v) => (v.pricePaise * 1000) / v.grams),
                    )
                  : 0;
                return (
                  <article key={p.productId} className={ui.blend}>
                    {p.imageUrl && (
                      <Image
                        src={p.imageUrl}
                        onError={(e) => {
                          e.currentTarget.hidden = true;
                        }}
                        alt={productName(p)}
                        width={500}
                        height={400}
                        sizes="(max-width: 700px) 50vw, 25vw"
                      />
                    )}
                    <h3>{productName(p)}</h3>
                    {dict[`product.${p.productId}.tasting_notes`] && (
                      <p>{dict[`product.${p.productId}.tasting_notes`]}</p>
                    )}
                    <div className={ui.productPrice}>
                      {lowest
                        ? `${t("from")} ${formatInrPaise(Math.round(lowest), locale)} / kg`
                        : t("out")}
                      <small>{t("freightExcluded")}</small>
                    </div>
                    <div className={ui.packList}>
                      {available
                        .filter((v) => v.grams >= 1000)
                        .map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              choose(p, v.id);
                              focusBulk();
                            }}
                          >
                            <strong>{packLabel(v.grams)}</strong>
                            <span>{formatInrPaise(v.pricePaise, locale)}</span>
                          </button>
                        ))}
                    </div>
                    <ActionButton
                      disabled={!available.length}
                      onClick={() => {
                        choose(p);
                        focusBulk();
                      }}
                    >
                      {t("buyBulk")}
                      <ArrowRight size={17} />
                    </ActionButton>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="brew-proof"
          className={`${styles.section} ${ui.brew}`}
          aria-labelledby="brewProofHeading"
        >
          <div className={styles.wrap}>
            <div className={styles.titleRow}>
              <div>
                <div className={styles.kicker}>{t("brewKicker")}</div>
                <h2 className={styles.h2} id="brewProofHeading">
                  {t("brewTitle")}
                </h2>
                <p className={styles.small}>{t("brewBody")}</p>
              </div>
              <ActionButton intent="soft" onClick={() => setBrewOpen(true)}>
                <Coffee size={18} />
                {dict["hero.brewGuide"]}
              </ActionButton>
            </div>
            <div className={ui.brewSteps}>
              {[
                {
                  title: "measure",
                  body: "measureBody",
                  image: "/images/trade/brew-measure-v2.webp",
                },
                {
                  title: "boil",
                  body: "boilBody",
                  image: "/images/trade/brew-simmer-v2.webp",
                },
                {
                  title: "liquor",
                  body: "liquorBody",
                  image: "/images/trade/brew-compare-v2.webp",
                },
                {
                  title: "serve",
                  body: "serveBody",
                  image: "/images/trade/brew-strain-v2.webp",
                },
              ].map((s, i) => (
                <article key={s.title}>
                  <Image
                    src={s.image}
                    alt={t(s.title)}
                    width={360}
                    height={250}
                    sizes="(max-width: 700px) 50vw, 25vw"
                  />
                  <small>0{i + 1}</small>
                  <h3>{t(s.title)}</h3>
                  <p>{t(s.body)}</p>
                </article>
              ))}
            </div>
            {product && compareB && (
              <details className={ui.compare}>
                <summary>{t("compareTitle")}</summary>
                <div className={styles.pair}>
                  {[
                    { id: "cmp-blend-a", p: product, label: "blendA" },
                    { id: "cmp-blend-b", p: compareB, label: "blendB" },
                  ].map(({ id, p, label }) => (
                    <div key={id}>
                      <label className={styles.fieldLabel} htmlFor={id}>
                        {t(label)}
                      </label>
                      <select
                        id={id}
                        className={styles.select}
                        value={p.productId}
                        onChange={(e) =>
                          id === "cmp-blend-b"
                            ? setBlendB(Number(e.target.value))
                            : choose(
                                products.find(
                                  (p) => p.productId === Number(e.target.value),
                                )!,
                              )
                        }
                      >
                        {products.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {productName(p)}
                          </option>
                        ))}
                      </select>
                      <p>
                        {t("brewSpec")}: {p.brewTemp} °C ·{" "}
                        {Math.round(p.brewSeconds / 60)} min
                      </p>
                      <p>
                        {dict[`product.${p.productId}.tasting_notes`] ||
                          (locale === "en" ? p.tastingNotes : t("liquorBody"))}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>
        <CupCalculator
          locale={locale}
          dict={dict}
          availablePackGrams={packs}
          selectedExWorksPerKgRupees={
            variant ? (variant.pricePaise / variant.grams) * 10 : null
          }
          confirmedPerKgRupees={
            quote?.kind === "confirmed"
              ? (quote.totalPaise / quote.netGrams) * 10
              : null
          }
          selectedProductName={product ? productName(product) : ""}
          onEnquireCoverage={() => openEnquiry()}
        />
        <TradePilotLocations pilots={sharedPilots} dict={dict} onEnquire={() => openEnquiry()} />
        <section
          className={`${styles.section} ${ui.enquiry}`}
          id="enquiry"
          aria-labelledby="enquirySectionHeading"
        >
          <div className={`${styles.wrap} ${ui.enquiryGrid}`}>
            <div>
              <div className={styles.kicker}>{dict["help.kicker"]}</div>
              <h2 id="enquirySectionHeading" className={styles.h2}>
                {t("enquiryTitle")}
              </h2>
              <p>{t("enquiryBody")}</p>
              <TradeEnquiryForm
                dict={dict}
                locale={locale}
                pin={pin}
                source="inline_enquiry_section"
              />
            </div>
            <div id="help" className={ui.faq}>
              <Truck size={32} strokeWidth={1.4} aria-hidden="true" />
              <h2 className={styles.h3}>{t("faqTitle")}</h2>
              {[1, 2, 3, 4].map((n) => (
                <details className={styles.faqItem} key={n}>
                  <summary>{t(`faq${n}`)}</summary>
                  <p>{t(`faq${n}Body`)}</p>
                </details>
              ))}
              <p className={styles.small}>
                {dict["support.hours"] || settings.support_hours}
              </p>
            </div>
          </div>
        </section>
      </div>
      <ModalDialog
        closeLabel={t("close")}
        open={trialOpen}
        onClose={() => {
          setTrialOpen(false);
          trialRef.current++;
          setTrialPending(false);
        }}
        titleId="trialModalTitle"
        title={dict["trial.title"]}
      >
        {trial && (
          <>
            <p>
              {trial.components
                .map(
                  (c) =>
                    `${dict[`trial.component.${c.slot_index}.name`] || c.name} (${c.weight_g} g)`,
                )
                .join(" · ")}
            </p>
            <p>
              <b>{formatInrPaise(trial.price_paise, locale)}</b> · {totalGrams}{" "}
              g
            </p>
            <p className={styles.small}>{t("deliveryNote")}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void checkQuote(true);
              }}
            >
              <PinField
                invalidMessage={t("pinError")}
                id="trial-pin"
                label={dict["bulk.pinLabel"]}
                value={trialPin}
                error={trialError}
                buttonLabel={dict["bulk.checkDelivery"]}
                pending={trialPending}
                onChange={(v) => {
                  setTrialPin(v);
                  trialRef.current++;
                  setTrialPending(false);
                  setTrialQuote(null);
                  setTrialError("");
                }}
              />
            </form>
            <div className={ui.trialReceipt} aria-live="polite">
              {trialQuote && receipt(trialQuote, true)}
            </div>
            <button
              className={styles.textbutton}
              type="button"
              onClick={() => {
                openEnquiry(true);
              }}
            >
              {t("help")}
            </button>
          </>
        )}
      </ModalDialog>
      <ModalDialog
        closeLabel={t("close")}
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        titleId="enquiryModalTitle"
        title={t("enquiryTitle")}
      >
        <TradeEnquiryForm
          locale={locale}
          dict={dict}
          pin={pin || trialPin}
          source="trade_modal"
          trial={enquiryTrial}
        />
      </ModalDialog>
      <ModalDialog
        closeLabel={t("close")}
        open={brewOpen}
        onClose={() => setBrewOpen(false)}
        titleId="brewModalTitle"
        title={dict["hero.brewGuide"]}
      >
        {settings.hero_video_url && (
          <video
            controls
            playsInline
            preload="none"
            poster={settings.hero_video_poster_url || heroImage}
          >
            <source src={settings.hero_video_url} />
          </video>
        )}
        <p>{t("brewBody")}</p>
        <p>{t("measureBody")}</p>
        <p>{t("boilBody")}</p>
        <p>{t("serveBody")}</p>
      </ModalDialog>
    </TradeShell>
  );
}
