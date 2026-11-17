import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coffee, ClipboardList, Calculator, PackageCheck, RefreshCw, ArrowUpRight } from "lucide-react";
import type { B2BPageContentRecord, B2BSettings, PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale } from "@/lib/business/schema";
import { getStarterSamples } from "@/lib/business/starterSamples";
import { intlLocale } from "@/lib/i18n/locale";
import { BusinessFooter } from "../BusinessFooter";
import { BusinessLanguageSwitch } from "../BusinessLanguageSwitch";
import { FaqAccordion } from "../FaqAccordion";
import { StarterCalculator } from "./StarterCalculator";
import { StarterConversion } from "./StarterConversion";
import { StartupBudget } from "./StartupBudget";
import { LaunchResources } from "./LaunchResources";
import styles from "./starter.module.css";
import { serverTr } from "@/lib/business/starterTexts";

export function StarterLanding({ content, settings, offers, locale, quoteNotice, siliguriClaim }: {
  content: B2BPageContentRecord; settings: B2BSettings; offers: PublicOfferView[];
  locale: BusinessLocale; quoteNotice: string; siliguriClaim: string;
}) {
  const t = serverTr(locale);
  const defaultHeadlines = ["Your tea business starts here.", "Start your tea business. Buy in bulk or build your own brand.", "आपका चाय का बिज़नेस यहाँ से शुरू होता है।"];
  const headline = defaultHeadlines.includes(content.headline)
    ? t("Start your tea business with a plan, not guesswork.") : content.headline;
  const illustratedHero = content.hero_image_url === "/images/hero-himalayan-tea.webp" || !content.hero_image_url;
  const heroUrl = illustratedHero ? "/images/business/starter-tea-table.webp" : content.hero_image_url;
  const { trials, error: samplesError } = getStarterSamples();
  const faqs = [
    ...content.faq,
    { q: t("How much money do I need to start?"), a: t("There is no single starting budget. Allow for samples, tea, packaging or printing, inward freight, applicable tax, selling expenses and working capital. Your chosen format, quantity and destination determine the quotation. Keep a buffer for slower sales and reorders.") },
    { q: t("How much profit can I make selling tea?"), a: t("Your earnings depend on your selling price, all costs and actual demand. The calculator shows an illustrative contribution and operating surplus, not promised earnings. It excludes tax, owner remuneration and unentered costs. Test demand with customers before committing to a larger stock purchase.") },
    { q: t("Can I buy samples before a commercial order?"), a: t("Explore the published sample kits and check their contents, price and availability on the kit page. Samples help you evaluate taste; they do not reserve a commercial batch or guarantee bulk availability, pricing or packaging. Confirm the commercial specification in your written quote.") },
    { q: t("Are branding and marketing services included?"), a: t("Do not assume they are included in the tea price. Confirm artwork, printing, packaging, revisions and any marketing work as separately written inclusions and fees. Sales, distribution and customer acquisition need your own plan.") },
    { q: t("How should I plan repeat orders?"), a: t("Track sales by pack, your remaining stock and the lead time confirmed for each order. Reconfirm the tea specification, batch availability, packaging minimums and delivery costs before reordering. A first order does not lock future prices or supply.") },
  ].filter((item, index, list) => list.findIndex(other => other.q === item.q) === index);
  const roadmap = [
    { Icon: Coffee, title: t("Taste"), body: t("Try a sample. Test it in the way your customers brew.") },
    { Icon: ClipboardList, title: t("Choose"), body: t("Match your tea, pack and business model to your market.") },
    { Icon: Calculator, title: t("Confirm costs"), body: t("Get MOQ, itemised costs, tax and freight in writing.") },
    { Icon: PackageCheck, title: t("Approve & order"), body: t("Review specifications and terms before placing an order.") },
    { Icon: RefreshCw, title: t("Sell & replenish"), body: t("Track demand and plan your next stock purchase.") },
  ];
  const essentials = [
    [t("Know your customer"), t("Choose a first audience: neighbourhood shops, direct buyers, cafés or a channel you can actually reach.")],
    [t("Test the taste"), t("Brew with the milk, water, dose and method your customers use. Ask for feedback before buying more.")],
    [t("Plan the pack"), t("Decide size, material and label needs. Confirm artwork responsibilities and print minimums before approving.")],
    [t("Budget beyond tea"), t("Include samples, initial stock, packaging, freight and applicable tax. Keep working capital for reorders.")],
    [t("Count selling costs"), t("Delivery, ads, channel fees, returns, storage and your own time all affect what you keep.")],
    [t("Start with demand"), t("Choose stock you can realistically sell. Review results and confirm fresh terms for every reorder.")],
  ];
  return <div className={`tf-b2b-root ${styles.root}`} lang={locale}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand}>TEAFLOWW</Link>
      <nav className={styles.nav} aria-label={t("Page sections")}>
        <a href="#planner">{t("Your business plan")}</a><a href="#solutions">{t("Supply options")}</a><a href="#margins">{t("Costs & margins")}</a>
      </nav>
      <div className={styles.headerActions}><BusinessLanguageSwitch path="/start-tea-business" locale={locale} className={styles.language} label={t("Select language")} /><a className={styles.goldButton} href="#business-quote">{t("Get a quote")}</a></div>
    </div></header>
    <main id="main-content" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="business-hero-title">
        <div className={styles.heroCopy}>
          <h1 id="business-hero-title">{headline}</h1><p className={styles.heroIntro}>{content.intro}</p>
          <div className={styles.actions}><a className={styles.goldButton} href="#planner">{t("Build my free business plan")}<ArrowRight size={17} aria-hidden="true" /></a>
            <a className={styles.outlineButton} href="#solutions">{t("Explore supply options")}</a></div>
          <p className={styles.heroFootnote}>{t("No sign-up to explore. No promised profits. Your next step, made clearer.")}</p>
          <Link className={styles.tradeLink} href="/tea-traders">{t("Already in business? Get a bulk quote")}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        <figure className={styles.heroMedia}><Image src={heroUrl} alt={illustratedHero ? t("Conceptual tea-tasting table with bowls, loose leaves and unbranded pouches") : content.hero_image_alt} fill priority sizes="(max-width: 760px) 100vw, 53vw" />
          {illustratedHero && <figcaption>{t("Conceptual illustration")}</figcaption>}</figure>
      </section>
      <div className={styles.journeyStrip}><span>{t("Discover your model")}</span><ArrowRight size={15} aria-hidden="true" /><span>{t("Understand the numbers")}</span><ArrowRight size={15} aria-hidden="true" /><span>{t("Taste & plan your launch")}</span></div>
      <StarterConversion offers={offers} locale={locale} leadsEnabled={settings.leads_enabled} whatsappE164={settings.whatsapp_enabled ? settings.whatsapp_e164 : null}
        heading={content.form_heading} subhead={content.form_subhead} quoteNotice={quoteNotice}
        faq={<section key="faq" id="faq" className={styles.section}><div className={styles.container}><p className={styles.eyebrow}>{t("BEFORE YOU BEGIN")}</p><h2>{t("Good questions. Clear answers.")}</h2><FaqAccordion items={faqs} locale={locale} /></div></section>}>
        <StartupBudget key="budget" locale={locale} />
        <StarterCalculator key="calculator" locale={locale} />
        <LaunchResources key="guides" locale={locale} />
        <section key="samples" id="samples" aria-labelledby="starter-samples-title">
          <div className={styles.sampleBanner}><Image src="/images/business/starter-sampling.webp" alt="" fill sizes="100vw" />
            <div className={styles.bannerCopy}><p className={styles.eyebrow}>{t("A SMALLER FIRST STEP")}</p><h2 id="starter-samples-title">{t("Taste it before you build around it.")}</h2><p>{t("Find the tea you want to put your name—or your shelf—behind. Start with a sample kit.")}</p><Link href="/trials#top" className={styles.goldButton}>{t("View all sample kits")}<ArrowRight size={16} aria-hidden="true" /></Link></div>
            <span className={styles.disclosure}>{t("Conceptual illustration")}</span>
          </div>
          <div className={`${styles.container} ${styles.sampleCollection}`}>
            <div className={styles.sectionTop}><h3>{t("A taste of what’s available.")}</h3><Link href="/trials#top">{t("Explore the collection")}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
            {samplesError ? <p role="status">{t("We couldn’t load sample kits. Visit the sample collection to try again, or ask the trade desk.")}</p> : !trials.length ? <p>{t("There are no published sample kits right now. Ask the trade desk about current sampling options.")}</p> :
              <div className={styles.sampleGrid}>{trials.map(trial => {
                const seedImage = trial.id === "trial-discovery-200g-001" && trial.hero_image?.url === "/images/trials/discovery-packaging.jpg";
                const image = seedImage ? "/images/trials/discovery-shelf-kit.webp" : trial.hero_image?.url;
                return <article key={trial.id} className={styles.sampleCard}>
                  {image && <div className={styles.kitImage}><Image src={image} alt={seedImage ? t("Illustrative sample-kit packaging") : trial.hero_image?.alt_text || trial.title} fill sizes="(max-width: 760px) 90vw, 30vw" />{seedImage && <span className={styles.disclosure}>{t("Illustrative packaging")}</span>}</div>}
                  <h3><Link href={`/trials/${trial.slug}`}>{trial.title}</Link></h3><ul className={styles.kitContents}>{[...trial.components].sort((a,b) => a.slot_index - b.slot_index).map(c => <li key={c.slot_index}><span>{c.name}</span><span>{c.weight_g}g</span></li>)}</ul>
                  <div className={styles.kitBottom}><strong>{new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(trial.price_paise / 100)}</strong><Link className={styles.outlineButton} href={`/trials/${trial.slug}`}>{trial.in_stock ? t("View kit") : t("View details")}<ArrowRight size={15} aria-hidden="true" /></Link></div>
                  <p className={styles.small}>{trial.in_stock ? t("Available to order") : t("Currently unavailable")}</p>
                </article>;
              })}</div>}
            <p className={styles.sampleTerms}>{t("Samples help you evaluate taste. Commercial blend, batch availability, packaging and pricing must be confirmed separately. Check each kit page for current purchase and delivery terms.")}</p>
          </div>
        </section>
        <section key="process" id="process" className={styles.section}><div className={styles.container}><p className={styles.eyebrow}>{t("YOUR PATH, MADE SIMPLE")}</p><h2>{t("From a first taste to a considered first order.")}</h2>
          <ol className={styles.roadmap}>{roadmap.map(({ Icon, title, body }) => <li key={title}><Icon size={28} strokeWidth={1.4} aria-hidden="true" /><h3>{title}</h3><p>{body}</p></li>)}</ol>
          <details className={styles.processDetails}><summary>{t("Our quotation process")}</summary><p>{content.process_intro}</p><ol>{content.steps.map(step => <li key={step.title}><strong>{step.title}</strong><p>{step.body}</p></li>)}</ol></details>
        </div></section>
        <section key="essentials" className={`${styles.section} ${styles.essentials}`}><div className={styles.container}><p className={styles.eyebrow}>{t("THE PRACTICAL PART")}</p><h2>{t("A good tea is the beginning. A plan takes it further.")}</h2><div className={styles.essentialsGrid}>{essentials.map(([title, body], i) => <article key={title}><span className={styles.number}>{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
        <section key="proof" id="proof" className={styles.section}><div className={styles.container}><p className={styles.eyebrow}>{t("TEA. PACKS. A CLEAR SCOPE.")}</p><h2>{content.proof_title}</h2><p className={styles.intro}>{content.proof_body}</p>
          <div className={styles.scopeGrid}><div><h3>{t("Tea & supply options")}</h3><p>{t("Explore the active supply formats above. Confirm the tea specification, quantity, pack and destination with the trade desk before ordering.")}</p><p>{siliguriClaim}</p></div><div><h3>{t("Agree the extras in writing")}</h3><p>{t("Custom pouches, artwork, printing and any creative or marketing work need a defined scope, price and approval. They are not automatically included in your tea purchase.")}</p><Link href="/private-label">{t("Explore private label")}<ArrowUpRight size={16} aria-hidden="true" /></Link></div></div>
          {content.proof_items.length > 0 && <details className={styles.processDetails}><summary>{t("View our published pack references")}</summary><div className={styles.proofGrid}>{content.proof_items.map(item => <figure key={item.imageUrl}><Image src={item.imageUrl} alt={item.alt} width={600} height={350} sizes="(max-width: 760px) 90vw, 44vw" /><figcaption><strong>{item.title}</strong><p>{item.caption}</p><span>{item.sourceOwner}</span></figcaption></figure>)}</div></details>}
          <div className={styles.identity}><strong>TeaFloww · Nirva</strong><span>GSTIN: 19CTHPK8646J2ZY</span><a href="mailto:info@teafloww.com">info@teafloww.com</a><a href="tel:+917001304853">+91 7001304853</a></div>
        </div></section>
      </StarterConversion>
    </main>
    <div id="starter-footer"><BusinessFooter locale={locale} supportHours={settings.support_hours} siliguriClaim={siliguriClaim} /></div>
  </div>;
}
