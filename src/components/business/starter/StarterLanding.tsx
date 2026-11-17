import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coffee, ClipboardList, Calculator, PackageCheck, RefreshCw, ArrowUpRight } from "lucide-react";
import type { B2BPageContentRecord, B2BSettings, PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale } from "@/lib/business/schema";
import { getStarterSamples } from "@/lib/business/starterSamples";
import { BusinessFooter } from "../BusinessFooter";
import { FaqAccordion } from "../FaqAccordion";
import { StarterCalculator } from "./StarterCalculator";
import { StarterConversion } from "./StarterConversion";
import styles from "./starter.module.css";

export function StarterLanding({ content, settings, offers, locale, quoteNotice, siliguriClaim }: {
  content: B2BPageContentRecord; settings: B2BSettings; offers: PublicOfferView[];
  locale: BusinessLocale; quoteNotice: string; siliguriClaim: string;
}) {
  const t = (en: string, hi: string) => locale === "hi" ? hi : en;
  const defaultHeadlines = ["Your tea business starts here.", "Start your tea business. Buy in bulk or build your own brand.", "आपका चाय का बिज़नेस यहाँ से शुरू होता है।"];
  const headline = defaultHeadlines.includes(content.headline)
    ? t("Your tea business starts with a better first step.", "आपका चाय का बिज़नेस शुरू हो एक बेहतर पहले कदम से।") : content.headline;
  const illustratedHero = content.hero_image_url === "/images/hero-himalayan-tea.webp" || !content.hero_image_url;
  const heroUrl = illustratedHero ? "/images/business/starter-tea-table.webp" : content.hero_image_url;
  const { trials, error: samplesError } = getStarterSamples();
  const faqs = [
    ...content.faq,
    { q: t("How much money do I need to start?", "शुरू करने के लिए कितना निवेश चाहिए?"), a: t("There is no single starting budget. Allow for samples, tea, packaging or printing, inward freight, applicable tax, selling expenses and working capital. Your chosen format, quantity and destination determine the quotation. Keep a buffer for slower sales and reorders.", "एक निश्चित शुरुआती बजट नहीं है। सैंपल, चाय, पैकेजिंग या प्रिंट, आने वाले माल का भाड़ा, लागू टैक्स, बिक्री खर्च और कार्यशील पूंजी जोड़ें। कोटेशन आपके फॉर्मेट, मात्रा और स्थान पर निर्भर है। धीमी बिक्री और अगले ऑर्डर के लिए राशि बचाकर रखें।") },
    { q: t("How much profit can I make selling tea?", "चाय बेचकर कितना मुनाफा हो सकता है?"), a: t("Your earnings depend on your selling price, all costs and actual demand. The calculator shows an illustrative contribution and operating surplus, not promised earnings. It excludes tax, owner remuneration and unentered costs. Test demand with customers before committing to a larger stock purchase.", "कमाई बिक्री मूल्य, सभी खर्चों और वास्तविक मांग पर निर्भर है। कैलकुलेटर का योगदान और अधिशेष केवल उदाहरण है, कमाई का वादा नहीं। टैक्स, मालिक का मेहनताना और न भरे गए खर्च शामिल नहीं हैं। बड़ा स्टॉक खरीदने से पहले ग्राहकों के साथ मांग परखें।") },
    { q: t("Can I buy samples before a commercial order?", "क्या कमर्शियल ऑर्डर से पहले सैंपल खरीद सकता हूं?"), a: t("Explore the published sample kits and check their contents, price and availability on the kit page. Samples help you evaluate taste; they do not reserve a commercial batch or guarantee bulk availability, pricing or packaging. Confirm the commercial specification in your written quote.", "प्रकाशित सैंपल किट देखें और उनके पेज पर सामग्री, कीमत और उपलब्धता जांचें। सैंपल स्वाद परखने के लिए हैं; इनसे कमर्शियल बैच आरक्षित नहीं होता और थोक उपलब्धता, कीमत या पैकेजिंग की गारंटी नहीं मिलती। लिखित कोटेशन में कमर्शियल विवरण तय करें।") },
    { q: t("Are branding and marketing services included?", "क्या ब्रांडिंग और मार्केटिंग सेवाएं शामिल हैं?"), a: t("Do not assume they are included in the tea price. Confirm artwork, printing, packaging, revisions and any marketing work as separately written inclusions and fees. Sales, distribution and customer acquisition need your own plan.", "इन्हें चाय की कीमत में शामिल न मानें। आर्टवर्क, प्रिंट, पैकेजिंग, संशोधन और मार्केटिंग के काम व शुल्क अलग से लिखित में तय करें। बिक्री, वितरण और ग्राहक बनाने के लिए अपनी योजना रखें।") },
    { q: t("How should I plan repeat orders?", "अगले ऑर्डर की योजना कैसे बनाऊं?"), a: t("Track sales by pack, your remaining stock and the lead time confirmed for each order. Reconfirm the tea specification, batch availability, packaging minimums and delivery costs before reordering. A first order does not lock future prices or supply.", "पैक के अनुसार बिक्री, बचा स्टॉक और हर ऑर्डर की पुष्ट समय सीमा देखें। दोबारा ऑर्डर से पहले चाय का विवरण, बैच उपलब्धता, पैकेजिंग न्यूनतम मात्रा और डिलीवरी खर्च फिर से तय करें। पहला ऑर्डर भविष्य की कीमत या सप्लाई तय नहीं करता।") },
  ].filter((item, index, list) => list.findIndex(other => other.q === item.q) === index);
  const roadmap = [
    { Icon: Coffee, title: t("Taste", "स्वाद परखें"), body: t("Try a sample. Test it in the way your customers brew.", "सैंपल को अपने ग्राहकों के बनाने के तरीके से परखें।") },
    { Icon: ClipboardList, title: t("Choose", "चुनें"), body: t("Match your tea, pack and business model to your market.", "अपने बाजार के अनुसार चाय, पैक और बिज़नेस मॉडल चुनें।") },
    { Icon: Calculator, title: t("Confirm costs", "खर्च तय करें"), body: t("Get MOQ, itemised costs, tax and freight in writing.", "MOQ, अलग-अलग खर्च, टैक्स और भाड़ा लिखित में लें।") },
    { Icon: PackageCheck, title: t("Approve & order", "स्वीकृत करें"), body: t("Review specifications and terms before placing an order.", "ऑर्डर से पहले विवरण और शर्तों की समीक्षा करें।") },
    { Icon: RefreshCw, title: t("Sell & replenish", "बेचें और फिर मंगाएं"), body: t("Track demand and plan your next stock purchase.", "मांग देखें और अगले स्टॉक की योजना बनाएं।") },
  ];
  const essentials = [
    [t("Know your customer", "अपने ग्राहक को जानें"), t("Choose a first audience: neighbourhood shops, direct buyers, cafés or a channel you can actually reach.", "पहले ग्राहक चुनें: आसपास की दुकानें, सीधे खरीदार, कैफ़े या ऐसा चैनल जहां आप पहुंच सकें।")],
    [t("Test the taste", "स्वाद परखें"), t("Brew with the milk, water, dose and method your customers use. Ask for feedback before buying more.", "ग्राहकों वाला दूध, पानी, मात्रा और तरीका इस्तेमाल करें। ज्यादा खरीदने से पहले प्रतिक्रिया लें।")],
    [t("Plan the pack", "पैक की योजना बनाएं"), t("Decide size, material and label needs. Confirm artwork responsibilities and print minimums before approving.", "आकार, सामग्री और लेबल तय करें। स्वीकृति से पहले डिज़ाइन की जिम्मेदारी और प्रिंट न्यूनतम मात्रा जांचें।")],
    [t("Budget beyond tea", "चाय से आगे का बजट"), t("Include samples, initial stock, packaging, freight and applicable tax. Keep working capital for reorders.", "सैंपल, शुरुआती स्टॉक, पैकेजिंग, भाड़ा और लागू टैक्स जोड़ें। अगले ऑर्डर के लिए कार्यशील पूंजी रखें।")],
    [t("Count selling costs", "बिक्री खर्च जोड़ें"), t("Delivery, ads, channel fees, returns, storage and your own time all affect what you keep.", "डिलीवरी, विज्ञापन, चैनल शुल्क, रिटर्न, भंडारण और आपका समय—सभी कमाई पर असर डालते हैं।")],
    [t("Start with demand", "मांग के अनुसार शुरू करें"), t("Choose stock you can realistically sell. Review results and confirm fresh terms for every reorder.", "उतना स्टॉक चुनें जितना वास्तव में बेच सकें। परिणाम देखें और हर अगले ऑर्डर की शर्तें फिर तय करें।")],
  ];
  return <div className={`tf-b2b-root ${styles.root}`} lang={locale}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand}>TEAFLOWW</Link>
      <nav className={styles.nav} aria-label={t("Page sections", "पेज अनुभाग")}>
        <a href="#solutions">{t("Business models", "बिज़नेस मॉडल")}</a><a href="#margins">{t("Margins", "मार्जिन")}</a><a href="#samples">{t("Samples", "सैंपल")}</a><a href="#faq">{t("FAQ", "सवाल-जवाब")}</a>
      </nav>
      <div className={styles.headerActions}><nav className={styles.language} aria-label={t("Select language", "भाषा चुनें")}>
        <Link href="/start-tea-business" lang="en" aria-current={locale === "en" ? "page" : undefined}>EN</Link>
        <Link href="/start-tea-business?lang=hi" lang="hi" aria-current={locale === "hi" ? "page" : undefined}>हिन्दी</Link>
      </nav><a className={styles.goldButton} href="#business-quote">{t("Get a quote", "कोटेशन लें")}</a></div>
    </div></header>
    <main id="main-content" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="business-hero-title">
        <div className={styles.heroCopy}><p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1 id="business-hero-title">{headline}</h1><p className={styles.heroIntro}>{content.intro}</p>
          <div className={styles.actions}><a className={styles.goldButton} href="#samples">{t("Explore sample kits", "सैंपल किट देखें")}<ArrowRight size={17} aria-hidden="true" /></a>
            <a className={styles.outlineButton} href="#margins">{t("Calculate your margins", "अपना मार्जिन देखें")}</a></div>
          <p className={styles.heroFootnote}>{t("Taste first. Plan clearly. Build at your own pace.", "पहले स्वाद परखें। स्पष्ट योजना बनाएं। अपनी गति से आगे बढ़ें।")}</p>
        </div>
        <figure className={styles.heroMedia}><Image src={heroUrl} alt={illustratedHero ? t("Conceptual tea-tasting table with bowls, loose leaves and unbranded pouches", "चाय के कप, पत्तियों और बिना ब्रांड वाले पाउच की काल्पनिक सजावट") : content.hero_image_alt} fill priority sizes="(max-width: 760px) 100vw, 53vw" />
          {illustratedHero && <figcaption>{t("Conceptual illustration", "काल्पनिक चित्रण")}</figcaption>}</figure>
      </section>
      <StarterConversion offers={offers} locale={locale} leadsEnabled={settings.leads_enabled} whatsappE164={settings.whatsapp_enabled ? settings.whatsapp_e164 : null}
        heading={content.form_heading} subhead={content.form_subhead} quoteNotice={quoteNotice}
        faq={<section key="faq" id="faq" className={styles.section}><div className={styles.container}><p className={styles.eyebrow}>{t("BEFORE YOU BEGIN", "शुरू करने से पहले")}</p><h2>{t("Good questions. Clear answers.", "सही सवाल। स्पष्ट जवाब।")}</h2><FaqAccordion items={faqs} locale={locale} /></div></section>}>
        <StarterCalculator key="calculator" locale={locale} />
        <section key="samples" id="samples" aria-labelledby="starter-samples-title">
          <div className={styles.sampleBanner}><Image src="/images/business/starter-sampling.webp" alt="" fill sizes="100vw" />
            <div className={styles.bannerCopy}><p className={styles.eyebrow}>{t("A SMALLER FIRST STEP", "एक छोटा पहला कदम")}</p><h2 id="starter-samples-title">{t("Taste it before you build around it.", "बिज़नेस बनाने से पहले स्वाद परखें।")}</h2><p>{t("Find the tea you want to put your name—or your shelf—behind. Start with a sample kit.", "जिस चाय को आप अपने नाम या अपनी दुकान से बेचना चाहेंगे, पहले उसे सैंपल किट में परखें।")}</p><Link href="/trials#top" className={styles.goldButton}>{t("View all sample kits", "सभी सैंपल किट देखें")}<ArrowRight size={16} aria-hidden="true" /></Link></div>
            <span className={styles.disclosure}>{t("Conceptual illustration", "काल्पनिक चित्रण")}</span>
          </div>
          <div className={`${styles.container} ${styles.sampleCollection}`}>
            <div className={styles.sectionTop}><h3>{t("A taste of what’s available.", "उपलब्ध सैंपल की एक झलक।")}</h3><Link href="/trials#top">{t("Explore the collection", "संग्रह देखें")}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
            {samplesError ? <p role="status">{t("We couldn’t load sample kits. Visit the sample collection to try again, or ask the trade desk.", "सैंपल किट लोड नहीं हो सकीं। फिर से देखने के लिए संग्रह खोलें या ट्रेड डेस्क से पूछें।")}</p> : !trials.length ? <p>{t("There are no published sample kits right now. Ask the trade desk about current sampling options.", "अभी कोई सैंपल किट प्रकाशित नहीं है। उपलब्ध विकल्पों के लिए ट्रेड डेस्क से पूछें।")}</p> :
              <div className={styles.sampleGrid}>{trials.map(trial => {
                const seedImage = trial.id === "trial-discovery-200g-001" && trial.hero_image?.url === "/images/trials/discovery-packaging.jpg";
                const image = seedImage ? "/images/trials/discovery-shelf-kit.webp" : trial.hero_image?.url;
                return <article key={trial.id} className={styles.sampleCard}>
                  {image && <div className={styles.kitImage}><Image src={image} alt={seedImage ? t("Illustrative sample-kit packaging", "सैंपल किट का काल्पनिक पैक") : trial.hero_image?.alt_text || trial.title} fill sizes="(max-width: 760px) 90vw, 30vw" />{seedImage && <span className={styles.disclosure}>{t("Illustrative packaging", "काल्पनिक पैकेजिंग")}</span>}</div>}
                  <h3><Link href={`/trials/${trial.slug}`}>{trial.title}</Link></h3><ul className={styles.kitContents}>{[...trial.components].sort((a,b) => a.slot_index - b.slot_index).map(c => <li key={c.slot_index}><span>{c.name}</span><span>{c.weight_g}g</span></li>)}</ul>
                  <div className={styles.kitBottom}><strong>{new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(trial.price_paise / 100)}</strong><Link className={styles.outlineButton} href={`/trials/${trial.slug}`}>{trial.in_stock ? t("View kit", "किट देखें") : t("View details", "विवरण देखें")}<ArrowRight size={15} aria-hidden="true" /></Link></div>
                  <p className={styles.small}>{trial.in_stock ? t("Available to order", "ऑर्डर के लिए उपलब्ध") : t("Currently unavailable", "अभी उपलब्ध नहीं")}</p>
                </article>;
              })}</div>}
            <p className={styles.sampleTerms}>{t("Samples help you evaluate taste. Commercial blend, batch availability, packaging and pricing must be confirmed separately. Check each kit page for current purchase and delivery terms.", "सैंपल स्वाद परखने में मदद करते हैं। कमर्शियल ब्लेंड, बैच उपलब्धता, पैकेजिंग और कीमत अलग से तय करें। खरीद और डिलीवरी की वर्तमान शर्तें किट पेज पर देखें।")}</p>
          </div>
        </section>
        <section key="process" id="process" className={styles.section}><div className={styles.container}><p className={styles.eyebrow}>{t("YOUR PATH, MADE SIMPLE", "आपका रास्ता, आसान कदम")}</p><h2>{t("From a first taste to a considered first order.", "पहले स्वाद से सोच-समझकर पहले ऑर्डर तक।")}</h2>
          <ol className={styles.roadmap}>{roadmap.map(({ Icon, title, body }) => <li key={title}><Icon size={28} strokeWidth={1.4} aria-hidden="true" /><h3>{title}</h3><p>{body}</p></li>)}</ol>
          <details className={styles.processDetails}><summary>{t("Our quotation process", "हमारी कोटेशन प्रक्रिया")}</summary><p>{content.process_intro}</p><ol>{content.steps.map(step => <li key={step.title}><strong>{step.title}</strong><p>{step.body}</p></li>)}</ol></details>
        </div></section>
        <section key="essentials" className={`${styles.section} ${styles.essentials}`}><div className={styles.container}><p className={styles.eyebrow}>{t("THE PRACTICAL PART", "जरूरी तैयारी")}</p><h2>{t("A good tea is the beginning. A plan takes it further.", "अच्छी चाय शुरुआत है। योजना इसे आगे बढ़ाती है।")}</h2><div className={styles.essentialsGrid}>{essentials.map(([title, body], i) => <article key={title}><span className={styles.number}>{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
        <section key="proof" id="proof" className={styles.section}><div className={styles.container}><p className={styles.eyebrow}>{t("TEA. PACKS. A CLEAR SCOPE.", "चाय। पैक। स्पष्ट शर्तें।")}</p><h2>{content.proof_title}</h2><p className={styles.intro}>{content.proof_body}</p>
          <div className={styles.scopeGrid}><div><h3>{t("Tea & supply options", "चाय और सप्लाई विकल्प")}</h3><p>{t("Explore the active supply formats above. Confirm the tea specification, quantity, pack and destination with the trade desk before ordering.", "ऊपर सक्रिय सप्लाई विकल्प देखें। ऑर्डर से पहले ट्रेड डेस्क के साथ चाय का विवरण, मात्रा, पैक और स्थान तय करें।")}</p><p>{siliguriClaim}</p></div><div><h3>{t("Agree the extras in writing", "अतिरिक्त काम लिखित में तय करें")}</h3><p>{t("Custom pouches, artwork, printing and any creative or marketing work need a defined scope, price and approval. They are not automatically included in your tea purchase.", "कस्टम पाउच, डिज़ाइन, प्रिंट और क्रिएटिव या मार्केटिंग काम का दायरा, कीमत और स्वीकृति तय करें। ये चाय की खरीद में अपने आप शामिल नहीं हैं।")}</p><Link href="/private-label">{t("Explore private label", "प्राइवेट लेबल देखें")}<ArrowUpRight size={16} aria-hidden="true" /></Link></div></div>
          {content.proof_items.length > 0 && <details className={styles.processDetails}><summary>{t("View our published pack references", "प्रकाशित पैक संदर्भ देखें")}</summary><div className={styles.proofGrid}>{content.proof_items.map(item => <figure key={item.imageUrl}><Image src={item.imageUrl} alt={item.alt} width={600} height={350} sizes="(max-width: 760px) 90vw, 44vw" /><figcaption><strong>{item.title}</strong><p>{item.caption}</p><span>{item.sourceOwner}</span></figcaption></figure>)}</div></details>}
          <div className={styles.identity}><strong>TeaFloww · Nirva</strong><span>GSTIN: 19CTHPK8646J2ZY</span><a href="mailto:info@teafloww.com">info@teafloww.com</a><a href="tel:+917001304853">+91 7001304853</a></div>
        </div></section>
      </StarterConversion>
    </main>
    <div id="starter-footer"><BusinessFooter locale={locale} supportHours={settings.support_hours} siliguriClaim={siliguriClaim} /></div>
  </div>;
}
