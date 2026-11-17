import Image from "next/image";
import Link from "next/link";
import { Leaf, ArrowRight, Package, Truck } from "lucide-react";
import { CartProvider } from "@/components/CartProvider";
import { localize, publishedTexts } from "@/lib/international/translations";
import { LANGUAGES } from "@/lib/international/models";
import { getB2BSettings } from "@/lib/business/repository";
import { getTraderCatalogue, getTraderPresentation } from "@/lib/business/traderRepository";
import { TraderHero } from "./TraderHero";
import { TraderShelf, TraderBag } from "./TraderShelf";
import { TraderEnquiry } from "./TraderEnquiry";
import { TraderJourney } from "./TraderJourney";
import { TraderPlanner } from "./TraderPlanner";
import { TraderEconomics } from "./TraderEconomics";
import { TraderResources, TraderHelp } from "./TraderResources";
import { TRADER_DEFAULTS } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";

export function TraderLanding({locale}:{locale:string}) {
  const settings = getB2BSettings();
  const source = getTraderPresentation();
  const content = localize(source,"tea-traders",locale);
  const c = content.copy;
  const headline = source.copy.headline === TRADER_DEFAULTS.copy.headline ? c.toolsHeadline : c.headline;
  const intro = source.copy.intro === TRADER_DEFAULTS.copy.intro ? c.toolsIntro : c.intro;
  if(!settings.business_landing_enabled) return <div className={styles.root}><main className={styles.section}><h1>TeaFloww</h1><p>{c.empty}</p><Link href="/shop">{c.shop}</Link></main></div>;
  const all = getTraderCatalogue().map(p=>localize(p,`product:${p.id}`,locale));
  const selected = content.productIds.length ? content.productIds.flatMap(id=>all.find(p=>p.id===id) || []) : all.slice(0,6);
  const autoSlides = all.filter(p=>p.primary_image_url || p.primary_image?.url).slice(0,1).map(p=>({id:`product-${p.id}`,productId:p.id,title:headline,body:intro}));
  const slides = (content.slides.length ? content.slides : autoSlides).flatMap(s=>{
    const p = all.find(p=>p.id===s.productId); if(!p) return [];
    return [{id:s.id,title:source.slides.find(item=>item.id===s.id)?.title===TRADER_DEFAULTS.copy.headline ? headline : s.title,body:source.slides.find(item=>item.id===s.id)?.body===TRADER_DEFAULTS.copy.intro ? intro : s.body,imageUrl:p.primary_image_url || p.primary_image?.url || null,alt:p.primary_image?.alt_text || p.name}];
  });
  const journey = all.find(p=>p.id===content.journeyProductId) || selected.find(p=>p.primary_image_url) || all.find(p=>p.primary_image_url);
  const journeyImage = journey?.primary_image_url || journey?.primary_image?.url;
  const whatsapp = settings.whatsapp_enabled && settings.whatsapp_e164 ? `https://wa.me/${settings.whatsapp_e164}?text=${encodeURIComponent("Hello TeaFloww, I would like to discuss tea for my business.")}` : null;
  const languages = LANGUAGES.filter(l=>l.code==="en" || l.code==="hi" || l.code===locale || publishedTexts("tea-traders",l.code));
  return <CartProvider><TraderJourney><div className={styles.root} lang={locale} dir={LANGUAGES.find(l=>l.code===locale)?.dir || "ltr"}>
    <header className={styles.header}>
      <Link href="/" className={styles.logo}><Image src="/logo/svg/02_primary_horizontal_full_color.svg" alt="TeaFloww" width={215} height={64} priority/></Link>
      <nav className={styles.nav} aria-label={c.heroLabel}><a href="#solutions">{c.toolsModel}</a><a href="#trade-packs">{c.navShop}</a><a href="#trade-economics">{c.toolsNumbers}</a><a href="#business-quote">{c.quote}</a></nav>
      <div className={styles.headerActions}><nav aria-label={c.language} className={styles.languages}>{languages.map(l=><Link key={l.code} href={`/tea-traders${l.code==="en"?"":`?lang=${l.code}`}`} lang={l.code} hrefLang={l.code} aria-current={l.code===locale?"page":undefined}>{l.code==="en"?"EN":l.name}</Link>)}</nav><TraderBag label={c.bag}/></div>
    </header>
    <main id="main-content" tabIndex={-1}>
      <TraderHero slides={slides} copy={{...c,headline,intro}} whatsapp={whatsapp}/>
      <TraderPlanner copy={c}/>
      <TraderEconomics products={selected} copy={c} locale={locale} observedAt={new Date().toISOString()}/>
      <section id="trade-packs" className={`${styles.section} ${styles.catalogue}`}>
        <h2>{source.copy.catalogueTitle===TRADER_DEFAULTS.copy.catalogueTitle ? c.toolsCatalogueTitle : c.catalogueTitle}</h2><p className={styles.sectionIntro}>{source.copy.catalogueBody===TRADER_DEFAULTS.copy.catalogueBody ? c.toolsCatalogueIntro : c.catalogueBody}</p>
        <TraderShelf products={selected} copy={c} locale={locale}/>
      </section>
      <section id="how-it-works" className={styles.journey}>
        {journeyImage && <div className={styles.journeyImage}><Image src={journeyImage} alt={journey?.name || ""} fill sizes="(max-width: 760px) 90vw, 45vw"/></div>}
        <div className={styles.journeyCopy}><h2>{c.journeyTitle}</h2><ol>{[{Icon:Leaf,label:c.journeyOne},{Icon:Package,label:c.journeyTwo},{Icon:Truck,label:c.journeyThree}].map(({Icon,label})=><li key={label}><Icon size={27} strokeWidth={1.3}/>{label}</li>)}</ol><a href="#trade-packs" className={styles.gold}>{c.journeyCta}<ArrowRight size={18}/></a></div>
      </section>
      <section className={`${styles.section} ${styles.partner}`}><div><h2>{c.toolsProofTitle}</h2><p className={styles.sectionIntro}>{c.toolsProofBody}</p><Link href="/trials#top" className={styles.primary}>{c.toolsSample}<ArrowRight size={17} aria-hidden="true"/></Link></div><div><details open><summary>{c.toolsQuoteChecklist}</summary><p>{c.toolsQuoteChecklistBody}</p></details><details><summary>{c.toolsRolesTitle}</summary><p>{c.toolsRolesBody}</p></details><p className={styles.fine}>TeaFloww · Nirva · GSTIN 19CTHPK8646J2ZY<br/><a href="tel:+917001304853">+91 7001304853</a> · <a href="mailto:info@teafloww.com">info@teafloww.com</a></p></div></section>
      <TraderResources copy={c}/>
      <section id="business-quote" className={styles.section}><h2 id="trader-enquiry-title" tabIndex={-1}>{c.formTitle}</h2><p className={styles.sectionIntro}>{c.formIntro}</p><p className={styles.fine}>{c.formNotice}</p><TraderEnquiry copy={c} locale={locale} enabled={settings.leads_enabled} whatsapp={whatsapp}/></section>
      <TraderHelp copy={c}/>
      <section className={`${styles.section} ${styles.final}`}><h2>{c.toolsFinalTitle}</h2><div className={styles.toolActions}><Link className={styles.primary} href="/trials#top">{c.toolsSample}</Link><a className={styles.outline} href="#business-quote">{c.quote}</a><Link href="/private-label" className={styles.textLink}>{c.brandLink}<ArrowRight size={16} aria-hidden="true"/></Link></div><Link className={styles.textLink} href="/start-tea-business">{c.toolsGeneralPlan}<ArrowRight size={16} aria-hidden="true"/></Link></section>
    </main>
    <footer className={styles.footer}><div><strong>{c.footer}</strong><p>{c.footerBody}</p><a href="mailto:info@teafloww.com">info@teafloww.com</a><p>{settings.support_hours}</p></div><nav aria-label={c.footer}><Link href="/shop">{c.shop}</Link><Link href="/contact">{c.contact}</Link><Link href="/privacy">{c.privacy}</Link><Link href="/terms">{c.terms}</Link></nav></footer>
  </div></TraderJourney></CartProvider>;
}
