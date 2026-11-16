"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Coffee, X } from "lucide-react";
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
import type { TradeDictionary } from "@/lib/trade/i18n";
import {
  ActionButton,
  AudioButton,
  ChoiceGroup,
  InlineStatus,
  PinField,
  PriceReceipt,
  QuantityStepper,
  formatInrPaise,
} from "./ui/Primitives";
import { TradeShell } from "./TradeShell";
import { CupCalculator } from "./CupCalculator";
import styles from "./trade.module.css";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("blend");

  const initialProduct = useMemo(() => {
    if (initialSlug) {
      const found = products.find((p) => p.slug === initialSlug);
      if (found) return found;
    }
    return products[0] ?? null;
  }, [initialSlug, products]);

  const [selectedProductId, setSelectedProductId] = useState<number>(
    initialProduct?.productId ?? 0
  );
  const selectedProduct = useMemo(
    () => products.find((p) => p.productId === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId]
  );

  const defaultVariant = useMemo(() => {
    if (!selectedProduct) return null;
    if (selectedProduct.defaultVariantId) {
      const def = selectedProduct.variants.find(
        (v) => v.id === selectedProduct.defaultVariantId && v.inStock
      );
      if (def) return def;
    }
    const twentyFiveKg = selectedProduct.variants.find(
      (v) => v.grams === 25000 && v.inStock
    );
    return (
      twentyFiveKg ??
      selectedProduct.variants.find((v) => v.inStock) ??
      selectedProduct.variants[0] ??
      null
    );
  }, [selectedProduct]);

  const [selectedVariantId, setSelectedVariantId] = useState<number>(
    defaultVariant?.id ?? 0
  );
  useEffect(() => {
    if (defaultVariant && !selectedProduct?.variants.some((v) => v.id === selectedVariantId)) {
      setSelectedVariantId(defaultVariant.id);
    }
  }, [defaultVariant, selectedProduct, selectedVariantId]);

  const selectedVariant = useMemo(
    () =>
      selectedProduct?.variants.find((v) => v.id === selectedVariantId) ??
      defaultVariant,
    [selectedProduct, selectedVariantId, defaultVariant]
  );

  const [quantity, setQuantity] = useState(1);
  const [payment, setPayment] = useState<TradePaymentMethod>("prepaid");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const quoteSeqRef = useRef(0);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Modals
  const [brewOpen, setBrewOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialPin, setTrialPin] = useState("");
  const [trialQuote, setTrialQuote] = useState<QuoteResult | null>(null);
  const [trialPending, setTrialPending] = useState(false);

  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiryPhone, setEnquiryPhone] = useState("");
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryHours, setEnquiryHours] = useState("");
  const [enquiryDraft, setEnquiryDraft] = useState("");
  const [enquiryConsent, setEnquiryConsent] = useState(true);
  const [enquiryPending, setEnquiryPending] = useState(false);
  const [enquiryResult, setEnquiryResult] = useState<{
    id: string;
    whatsappUrl: string;
  } | null>(null);

  // Comparison modal (5 vs 25 kg)
  const [compareQuotes, setCompareQuotes] = useState<{
    small: Extract<QuoteResult, { kind: "confirmed" }>;
    large: Extract<QuoteResult, { kind: "confirmed" }>;
  } | null>(null);

  // Shared pilot modal
  const [pilotInterestTarget, setPilotInterestTarget] =
    useState<TradeSharedPilotRecord | null>(null);
  const [pilotName, setPilotName] = useState("");
  const [pilotPhone, setPilotPhone] = useState("");
  const [pilotKg, setPilotKg] = useState("25");
  const [pilotDoneId, setPilotDoneId] = useState<string | null>(null);

  // Focus tracking to hide sticky action while typing
  const [editingField, setEditingField] = useState(false);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      setEditingField(tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA");
    };
    const onFocusOut = () => setEditingField(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  function invalidateBulkQuote() {
    quoteAbortRef.current?.abort();
    quoteSeqRef.current += 1;
    setQuote(null);
  }

  async function requestBulkQuote(
    overridePayment?: TradePaymentMethod,
    overrideVariantId?: number
  ) {
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setPinError("Enter a valid 6-digit Indian PIN code.");
      return;
    }
    const variantId = overrideVariantId ?? selectedVariant?.id;
    if (!variantId) return;

    setPinError(null);
    quoteAbortRef.current?.abort();
    const controller = new AbortController();
    quoteAbortRef.current = controller;
    const seq = ++quoteSeqRef.current;
    setQuotePending(true);

    try {
      const res = await fetch("/api/trade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          channel: "trade",
          quoteType: "bulk",
          locale,
          destinationPin: pin,
          lines: [{ variantId, quantity: overrideVariantId ? 1 : quantity }],
          payment: overridePayment ?? payment,
        }),
      });
      const data = (await res.json()) as QuoteResult;
      if (seq !== quoteSeqRef.current) return;
      setQuote(data);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (seq === quoteSeqRef.current) {
        setQuote({ kind: "temporarily_unavailable", retryable: true });
      }
    } finally {
      if (seq === quoteSeqRef.current) {
        setQuotePending(false);
      }
    }
  }

  async function requestTrialQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!trial || !/^[1-9][0-9]{5}$/.test(trialPin)) return;
    setTrialPending(true);
    try {
      const res = await fetch("/api/trade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "trade",
          quoteType: "trial",
          locale,
          destinationPin: trialPin,
          trialId: trial.id,
          quantity: 1,
          payment: "prepaid",
        }),
      });
      const data = (await res.json()) as QuoteResult;
      setTrialQuote(data);
    } catch {
      setTrialQuote({ kind: "temporarily_unavailable", retryable: true });
    } finally {
      setTrialPending(false);
    }
  }

  async function handleCompareFiveAndTwentyFive() {
    if (!selectedProduct || !/^[1-9][0-9]{5}$/.test(pin)) return;
    const v5 = selectedProduct.variants.find((v) => v.grams === 5000);
    const v25 = selectedProduct.variants.find((v) => v.grams === 25000);
    if (!v5 || !v25) return;

    const [r5, r25] = await Promise.all([
      fetch("/api/trade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "trade",
          quoteType: "bulk",
          locale,
          destinationPin: pin,
          lines: [{ variantId: v5.id, quantity: 1 }],
          payment,
        }),
      }).then((r) => r.json() as Promise<QuoteResult>),
      fetch("/api/trade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "trade",
          quoteType: "bulk",
          locale,
          destinationPin: pin,
          lines: [{ variantId: v25.id, quantity: 1 }],
          payment,
        }),
      }).then((r) => r.json() as Promise<QuoteResult>),
    ]);

    if (r5.kind === "confirmed" && r25.kind === "confirmed") {
      setCompareQuotes({ small: r5, large: r25 });
    }
  }

  function openEnquiryModal(prefillDraft?: string) {
    setEnquiryResult(null);
    setEnquiryDraft(
      prefillDraft ||
        `Hello TeaFloww, please share trade details for ${
          selectedProduct?.name || "Tea"
        } to PIN ${pin || "my shop"}.`
    );
    setEnquiryOpen(true);
  }

  async function submitEnquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!enquiryConsent) return;
    setEnquiryPending(true);
    try {
      const res = await fetch("/api/trade/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `enq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          locale,
          destinationPin: /^[1-9][0-9]{5}$/.test(pin) ? pin : "734001",
          enquiryType: "bulk",
          lines: selectedProduct && selectedVariant
            ? [
                {
                  variantId: selectedVariant.id,
                  label: `${selectedProduct.name} (${selectedVariant.grams / 1000} kg)`,
                  quantity,
                },
              ]
            : [],
          contactName: enquiryName,
          contactPhone: enquiryPhone,
          preferredHours: enquiryHours,
          consentGiven: true,
          whatsappDraft: enquiryDraft,
        }),
      });
      const data = (await res.json()) as {
        enquiry?: { id: string };
        whatsappUrl?: string;
      };
      if (data.enquiry?.id) {
        setEnquiryResult({
          id: data.enquiry.id,
          whatsappUrl: data.whatsappUrl || "",
        });
      }
    } finally {
      setEnquiryPending(false);
    }
  }

  const anyModalOpen =
    brewOpen ||
    trialOpen ||
    enquiryOpen ||
    Boolean(compareQuotes) ||
    Boolean(pilotInterestTarget);

  const stickyAction =
    quote?.kind === "confirmed" ? (
      <ActionButton
        intent="primary"
        onClick={() =>
          router.push(`/tea-shops/${locale}/checkout?quoteId=${encodeURIComponent(quote.id)}`)
        }
      >
        {dict["quote.reviewPack"]} · {formatInrPaise(quote.totalPaise, locale)}
      </ActionButton>
    ) : quote?.kind === "manual" ? (
      <ActionButton
        intent="primary"
        onClick={() => openEnquiryModal(quote.enquiryDraft)}
      >
        {dict["quote.prepareEnquiry"]}
      </ActionButton>
    ) : (
      <ActionButton
        intent="primary"
        onClick={() => document.getElementById("trade-pin")?.focus()}
      >
        {dict["bulk.checkDelivery"]}
      </ActionButton>
    );

  const availablePackGrams = useMemo(() => {
    const set = new Set<number>();
    products.forEach((p) => p.variants.forEach((v) => set.add(v.grams)));
    return Array.from(set).sort((a, b) => a - b);
  }, [products]);

  const confirmedPerKgRupees =
    quote?.kind === "confirmed" && quote.netGrams > 0
      ? quote.totalPaise / 100 / (quote.netGrams / 1000)
      : null;

  return (
    <TradeShell
      locale={locale}
      enabledLocales={settings.enabled_locales}
      dict={dict}
      modalOpen={anyModalOpen}
      stickyAction={editingField ? null : stickyAction}
    >
      {/* 1. HERO */}
      <section className={styles.hero} aria-labelledby="tradeHeroTitle">
        <div>
          <div className={styles.kicker}>{dict["hero.kicker"]}</div>
          <h1 id="tradeHeroTitle" className={styles.h1}>
            {dict["hero.title"]} <em>{dict["hero.titleEmphasis"]}</em>
          </h1>
          <p className={styles.intro}>{dict["hero.intro"]}</p>
          <div className={styles.actions}>
            {trial ? (
              <ActionButton intent="primary" onClick={() => setTrialOpen(true)}>
                <span>{dict["hero.ctaTrial"]}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </ActionButton>
            ) : null}
            <a href="#bulk" className={`${styles.btn} ${styles.btnSoft}`}>
              {dict["hero.ctaBulk"]}
            </a>
          </div>
          <div style={{ marginTop: 8 }}>
            <AudioButton
              label={dict["hero.listen"]}
              script={dict["hero.intro"]}
              locale={locale}
              audioUrl={heroAudioUrl}
              transcript={heroTranscript}
            />
          </div>
        </div>

        <div className={styles.heroimage}>
          <img
            src={settings.hero_image_url}
            alt="Milk chai pouring through a strainer at a tea counter"
            width={640}
            height={450}
          />
          <button
            type="button"
            className={styles.capBtn}
            onClick={() => setBrewOpen(true)}
          >
            <Coffee size={16} aria-hidden="true" />
            <span>{dict["hero.brewGuide"]}</span>
          </button>
        </div>
      </section>

      {/* 2. FEATURED TRIAL */}
      <section className={styles.section} id="trial" aria-labelledby="trialHeading">
        {trial ? (
          <div className={styles.trial}>
            <div className={styles.trialphoto}>
              <img
                src={trial.hero_image?.url || settings.trial_image_url}
                alt={trial.hero_image?.alt_text || trial.title}
                width={520}
                height={230}
              />
            </div>
            <div>
              <div className={styles.kicker}>{dict["trial.kicker"]}</div>
              <h2 id="trialHeading" className={styles.h2}>
                {dict["trial.title"]}
              </h2>
              <p className={styles.intro} style={{ marginBlock: 12 }}>
                {dict["trial.intro"]}
              </p>
              <p className={styles.small}>
                {trial.title} ·{" "}
                {trial.components
                  .map((c) => `${c.name} (${c.weight_g} g)`)
                  .join(", ")}{" "}
                · <b>{formatInrPaise(trial.price_paise, locale)}</b>
              </p>
              <div style={{ marginTop: 16 }}>
                <ActionButton intent="soft" onClick={() => setTrialOpen(true)}>
                  <span>{dict["trial.cta"]}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </ActionButton>
              </div>
            </div>
          </div>
        ) : (
          <InlineStatus
            title={dict["trial.kicker"]}
            body={dict["trial.unavailable"]}
          />
        )}
      </section>

      {/* 3. BULK & FREIGHT */}
      <section className={styles.section} id="bulk" aria-labelledby="bulkHeading">
        <div className={styles.titleRow}>
          <div>
            <div className={styles.kicker}>{dict["bulk.kicker"]}</div>
            <h2 id="bulkHeading" className={styles.h2}>
              {dict["bulk.title"]}
            </h2>
          </div>
          <p className={styles.small}>{settings.dispatch_cutoff_label}</p>
        </div>

        {products.length === 0 ? (
          <InlineStatus
            title="Trade catalogue unavailable"
            body="No blends are currently published for trade ordering. Please ask TeaFloww for assistance."
            action={
              <ActionButton intent="soft" onClick={() => openEnquiryModal()}>
                {dict["help.whatsappCta"]}
              </ActionButton>
            }
          />
        ) : (
          <div className={styles.grid}>
            <form
              className={styles.panel}
              onSubmit={(e) => {
                e.preventDefault();
                void requestBulkQuote();
              }}
            >
              <label className={styles.fieldLabel} htmlFor="trade-blend">
                {dict["bulk.chooseTea"]}
              </label>
              <select
                id="trade-blend"
                className={styles.select}
                value={selectedProduct?.productId ?? ""}
                onChange={(e) => {
                  const pid = Number(e.target.value);
                  setSelectedProductId(pid);
                  invalidateBulkQuote();
                }}
              >
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name}
                  </option>
                ))}
              </select>

              <div className={styles.columns}>
                <ChoiceGroup
                  label={dict["bulk.packSize"]}
                  selectedId={selectedVariant?.id ?? 0}
                  options={(selectedProduct?.variants ?? []).map((v) => ({
                    id: v.id,
                    label: `${v.grams >= 1000 ? `${v.grams / 1000} kg` : `${v.grams} g`}${
                      v.inStock ? "" : " (Out)"
                    }`,
                    disabled: !v.inStock,
                  }))}
                  onSelect={(id) => {
                    setSelectedVariantId(id);
                    invalidateBulkQuote();
                  }}
                />
                <QuantityStepper
                  label={dict["bulk.packs"]}
                  value={quantity}
                  locale={locale}
                  onChange={(q) => {
                    setQuantity(q);
                    invalidateBulkQuote();
                  }}
                />
              </div>

              <ChoiceGroup
                label={dict["bulk.payment"]}
                selectedId={payment}
                options={[
                  { id: "prepaid", label: dict["payment.prepaid"] },
                  { id: "cod", label: dict["payment.cod"] },
                  { id: "freight_advance", label: dict["payment.freight_advance"] },
                ]}
                onSelect={(p) => {
                  setPayment(p);
                  invalidateBulkQuote();
                }}
              />

              <PinField
                id="trade-pin"
                label={dict["bulk.pinLabel"]}
                value={pin}
                error={pinError}
                buttonLabel={dict["bulk.checkDelivery"]}
                pending={quotePending}
                onChange={(nextPin) => {
                  setPin(nextPin);
                  setPinError(null);
                  invalidateBulkQuote();
                }}
              />
            </form>

            <div className={`${styles.panel} ${styles.ticket}`} aria-live="polite">
              {quote?.kind === "confirmed" ? (
                <PriceReceipt
                  quote={quote}
                  locale={locale}
                  dict={dict}
                  action={
                    <ActionButton
                      intent="primary"
                      onClick={() =>
                        router.push(
                          `/tea-shops/${locale}/checkout?quoteId=${encodeURIComponent(
                            quote.id
                          )}`
                        )
                      }
                    >
                      <span>{dict["quote.reviewPack"]}</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </ActionButton>
                  }
                  extra={
                    selectedProduct?.variants.some((v) => v.grams === 5000) &&
                    selectedProduct?.variants.some((v) => v.grams === 25000) ? (
                      <button
                        type="button"
                        className={styles.textbutton}
                        style={{ marginTop: 8 }}
                        onClick={() => void handleCompareFiveAndTwentyFive()}
                      >
                        Compare 5 kg and 25 kg
                      </button>
                    ) : null
                  }
                />
              ) : quote?.kind === "manual" ? (
                <div>
                  <h3 className={styles.h3}>{dict["quote.manualTitle"]}</h3>
                  <p className={styles.small}>
                    {dict["quote.manualBody"].replace("{pin}", quote.destinationPin)}
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <ActionButton
                      intent="primary"
                      onClick={() => openEnquiryModal(quote.enquiryDraft)}
                    >
                      {dict["quote.prepareEnquiry"]}
                    </ActionButton>
                  </div>
                </div>
              ) : quote?.kind === "unavailable" ? (
                <div>
                  <h3 className={styles.h3}>Payment option unavailable</h3>
                  <p className={styles.small}>{quote.reason}</p>
                  {quote.alternatives.includes("prepaid") ? (
                    <div style={{ marginTop: 16 }}>
                      <ActionButton
                        intent="primary"
                        onClick={() => {
                          setPayment("prepaid");
                          void requestBulkQuote("prepaid");
                        }}
                      >
                        Check prepaid price instead
                      </ActionButton>
                    </div>
                  ) : null}
                </div>
              ) : quote?.kind === "temporarily_unavailable" ? (
                <div>
                  <h3 className={styles.h3}>Could not check delivery right now</h3>
                  <p className={styles.small}>
                    Your selection is saved. Please retry in a moment.
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <ActionButton
                      intent="primary"
                      onClick={() => void requestBulkQuote()}
                    >
                      Retry
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className={styles.h3}>{dict["quote.heading"]}</h3>
                  {selectedProduct && selectedVariant ? (
                    <>
                      <p className={styles.small}>
                        {selectedProduct.name} · {quantity} ×{" "}
                        {selectedVariant.grams / 1000} kg
                      </p>
                      <hr />
                      <div className={styles.row}>
                        <span>{dict["quote.tea"]}</span>
                        <b>
                          {formatInrPaise(
                            selectedVariant.pricePaise * quantity,
                            locale
                          )}
                        </b>
                      </div>
                    </>
                  ) : null}
                  <p className={styles.small}>{dict["quote.enterPin"]}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4. P2 SHARED SUPPLY (only when active town pilots exist) */}
      {sharedPilots.length > 0 ? (
        <section className={styles.section} aria-labelledby="sharedHeading">
          <div className={styles.titleRow}>
            <div>
              <div className={styles.kicker}>Local shared supply</div>
              <h2 id="sharedHeading" className={styles.h2}>
                Shared town dispatch
              </h2>
            </div>
          </div>
          <div className={styles.pair}>
            {sharedPilots.map((pilot) => (
              <div key={pilot.id} className={styles.panel}>
                <h3 className={styles.h3} style={{ fontSize: 22 }}>
                  {pilot.town_name} · {pilot.collection_point}
                </h3>
                <p className={styles.small}>{pilot.collection_address}</p>
                <p className={styles.small}>
                  Partner: {pilot.dispatch_partner} · {pilot.dispatch_schedule} ·
                  Local fee: {formatInrPaise(pilot.local_fee_paise, locale)}
                </p>
                <p className={styles.small}>
                  Booked: {pilot.booked_kg} / {pilot.target_kg} kg
                </p>
                <div style={{ marginTop: 12 }}>
                  <ActionButton
                    intent="soft"
                    onClick={() => {
                      setPilotDoneId(null);
                      setPilotInterestTarget(pilot);
                    }}
                  >
                    Register interest
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. P1 CUP CALCULATOR & PACK COVERAGE */}
      <CupCalculator
        locale={locale}
        dict={dict}
        availablePackGrams={availablePackGrams}
        confirmedPerKgRupees={confirmedPerKgRupees}
      />

      {/* 6. HELP & FAQ */}
      <section className={styles.section} id="help" aria-labelledby="helpHeading">
        <div className={styles.help}>
          <div>
            <div className={styles.kicker}>{dict["help.kicker"]}</div>
            <h2 id="helpHeading" className={styles.h2}>
              {dict["help.title"]}
            </h2>
            <p className={styles.small}>{settings.support_hours}</p>
            <div style={{ marginTop: 16 }}>
              <ActionButton intent="soft" onClick={() => openEnquiryModal()}>
                {dict["help.whatsappCta"]}
              </ActionButton>
            </div>
          </div>
          <div>
            <details className={styles.faqItem}>
              <summary>Will the tea reach my shop?</summary>
              <p className={styles.small}>
                Your confirmed quote clearly identifies doorstep delivery or the
                named collection depot before you pay.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>Can I pay on delivery?</summary>
              <p className={styles.small}>
                Available payment methods (prepaid, COD, or freight advance) depend
                on your route and order total.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>What comes in the trial?</summary>
              <p className={styles.small}>
                The trial card lists the published kit contents and portion weights
                before checkout.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>How do I reorder?</summary>
              <p className={styles.small}>
                Use your order confirmation link to recheck current stock and
                delivered price in one tap.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* MODALS */}
      {brewOpen ? (
        <dialog open className={styles.dialog} aria-labelledby="brewModalTitle">
          <div className={styles.sheet}>
            <div className={styles.sheethead}>
              <h2 id="brewModalTitle" className={styles.h3}>
                Brew a test pan
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close"
                onClick={() => setBrewOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {settings.hero_video_url ? (
              <video
                controls
                playsInline
                poster={settings.hero_video_poster_url || settings.hero_image_url}
                style={{ width: "100%", borderRadius: 10, marginBottom: 14 }}
              >
                <source src={settings.hero_video_url} />
              </video>
            ) : null}
            <div className={styles.row}>
              <span>Tea dose</span>
              <b>3 g (~333 servings / kg)</b>
            </div>
            <div className={styles.row}>
              <span>Water + milk</span>
              <b>120 ml + 80 ml</b>
            </div>
            <div className={styles.row}>
              <span>Simmer</span>
              <b>3–4 min</b>
            </div>
            <p className={styles.small}>
              Strain and taste. Use the same milk and measure when comparing
              batches.
            </p>
          </div>
        </dialog>
      ) : null}

      {trialOpen && trial ? (
        <dialog open className={styles.dialog} aria-labelledby="trialModalTitle">
          <div className={styles.sheet}>
            <div className={styles.sheethead}>
              <h2 id="trialModalTitle" className={styles.h3}>
                {trial.title}
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close"
                onClick={() => setTrialOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p className={styles.small}>
              Includes:{" "}
              {trial.components
                .map((c) => `${c.name} (${c.weight_g} g)`)
                .join(", ")}
            </p>
            <form onSubmit={requestTrialQuote}>
              <PinField
                id="trial-pin"
                label={dict["bulk.pinLabel"]}
                value={trialPin}
                buttonLabel={dict["bulk.checkDelivery"]}
                pending={trialPending}
                onChange={(v) => {
                  setTrialPin(v);
                  setTrialQuote(null);
                }}
              />
            </form>
            {trialQuote?.kind === "confirmed" ? (
              <div style={{ marginTop: 16 }}>
                <PriceReceipt
                  quote={trialQuote}
                  locale={locale}
                  dict={dict}
                  action={
                    <ActionButton
                      intent="primary"
                      onClick={() =>
                        router.push(
                          `/tea-shops/${locale}/checkout?quoteId=${encodeURIComponent(
                            trialQuote.id
                          )}`
                        )
                      }
                    >
                      <span>{dict["quote.reviewPack"]}</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </ActionButton>
                  }
                />
              </div>
            ) : trialQuote?.kind === "manual" ? (
              <InlineStatus
                title={dict["quote.manualTitle"]}
                body={trialQuote.enquiryDraft}
                action={
                  <ActionButton
                    intent="primary"
                    onClick={() => {
                      setTrialOpen(false);
                      openEnquiryModal(trialQuote.enquiryDraft);
                    }}
                  >
                    {dict["quote.prepareEnquiry"]}
                  </ActionButton>
                }
              />
            ) : null}
          </div>
        </dialog>
      ) : null}

      {enquiryOpen ? (
        <dialog open className={styles.dialog} aria-labelledby="enquiryModalTitle">
          <div className={styles.sheet}>
            <div className={styles.sheethead}>
              <h2 id="enquiryModalTitle" className={styles.h3}>
                {dict["enquiry.requestTransport"]}
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close"
                onClick={() => setEnquiryOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {enquiryResult ? (
              <InlineStatus
                title={`Enquiry ${enquiryResult.id} saved`}
                body="Our team will call you during support hours with the confirmed transport rate."
                action={
                  <a
                    href={enquiryResult.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    Open in WhatsApp
                  </a>
                }
              />
            ) : (
              <form onSubmit={submitEnquiry}>
                <label className={styles.fieldLabel} htmlFor="enq-draft">
                  Message draft
                </label>
                <textarea
                  id="enq-draft"
                  className={styles.textarea}
                  value={enquiryDraft}
                  onChange={(e) => setEnquiryDraft(e.target.value)}
                />
                <label className={styles.fieldLabel} htmlFor="enq-name">
                  Your name / shop name
                </label>
                <input
                  id="enq-name"
                  className={styles.input}
                  style={{ width: "100%" }}
                  value={enquiryName}
                  onChange={(e) => setEnquiryName(e.target.value)}
                />
                <label className={styles.fieldLabel} htmlFor="enq-phone">
                  Phone / WhatsApp number *
                </label>
                <input
                  id="enq-phone"
                  className={styles.input}
                  style={{ width: "100%" }}
                  required
                  placeholder="+91 98..."
                  value={enquiryPhone}
                  onChange={(e) => setEnquiryPhone(e.target.value)}
                />
                <label className={styles.fieldLabel} htmlFor="enq-hours">
                  Preferred callback hours
                </label>
                <input
                  id="enq-hours"
                  className={styles.input}
                  style={{ width: "100%" }}
                  placeholder="e.g. 11 AM – 2 PM"
                  value={enquiryHours}
                  onChange={(e) => setEnquiryHours(e.target.value)}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enquiryConsent}
                    onChange={(e) => setEnquiryConsent(e.target.checked)}
                    required
                  />
                  <span>I agree to be contacted by TeaFloww about this quote.</span>
                </label>
                <div style={{ marginTop: 16 }}>
                  <ActionButton
                    type="submit"
                    intent="primary"
                    pending={enquiryPending}
                  >
                    Save enquiry & prepare WhatsApp
                  </ActionButton>
                </div>
              </form>
            )}
          </div>
        </dialog>
      ) : null}

      {compareQuotes ? (
        <dialog open className={styles.dialog} aria-labelledby="compareTitle">
          <div className={styles.sheet}>
            <div className={styles.sheethead}>
              <h2 id="compareTitle" className={styles.h3}>
                5 kg vs 25 kg ({pin})
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close"
                onClick={() => setCompareQuotes(null)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.row}>
              <span>5 kg all-in</span>
              <b>
                {formatInrPaise(compareQuotes.small.totalPaise, locale)} (
                {formatInrPaise(
                  Math.round(compareQuotes.small.totalPaise / 5),
                  locale
                )}
                /kg)
              </b>
            </div>
            <div className={styles.row}>
              <span>25 kg all-in</span>
              <b>
                {formatInrPaise(compareQuotes.large.totalPaise, locale)} (
                {formatInrPaise(
                  Math.round(compareQuotes.large.totalPaise / 25),
                  locale
                )}
                /kg)
              </b>
            </div>
          </div>
        </dialog>
      ) : null}

      {pilotInterestTarget ? (
        <dialog open className={styles.dialog} aria-labelledby="pilotModalTitle">
          <div className={styles.sheet}>
            <div className={styles.sheethead}>
              <h2 id="pilotModalTitle" className={styles.h3}>
                {pilotInterestTarget.town_name} shared dispatch
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close"
                onClick={() => setPilotInterestTarget(null)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {pilotDoneId ? (
              <InlineStatus
                title={`Interest recorded (${pilotDoneId})`}
                body="This is an interest list, not a paid reservation. Our regional team will confirm before dispatch."
              />
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch("/api/trade/shared-pilots", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pilotId: pilotInterestTarget.id,
                      contactName: pilotName,
                      contactPhone: pilotPhone,
                      requestedKg: Number(pilotKg) || 25,
                      locale,
                    }),
                  });
                  const d = (await res.json()) as { interest?: { id: string } };
                  if (d.interest?.id) setPilotDoneId(d.interest.id);
                }}
              >
                <label className={styles.fieldLabel} htmlFor="sp-name">
                  Shop / contact name
                </label>
                <input
                  id="sp-name"
                  className={styles.input}
                  style={{ width: "100%" }}
                  required
                  value={pilotName}
                  onChange={(e) => setPilotName(e.target.value)}
                />
                <label className={styles.fieldLabel} htmlFor="sp-phone">
                  Phone number
                </label>
                <input
                  id="sp-phone"
                  className={styles.input}
                  style={{ width: "100%" }}
                  required
                  value={pilotPhone}
                  onChange={(e) => setPilotPhone(e.target.value)}
                />
                <label className={styles.fieldLabel} htmlFor="sp-kg">
                  Estimated kg needed
                </label>
                <input
                  id="sp-kg"
                  className={styles.input}
                  style={{ width: "100%" }}
                  type="number"
                  min="1"
                  required
                  value={pilotKg}
                  onChange={(e) => setPilotKg(e.target.value)}
                />
                <div style={{ marginTop: 16 }}>
                  <ActionButton type="submit" intent="primary">
                    Register interest
                  </ActionButton>
                </div>
              </form>
            )}
          </div>
        </dialog>
      ) : null}
    </TradeShell>
  );
}
