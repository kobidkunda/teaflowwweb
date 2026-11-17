import Image from "next/image";
import Link from "next/link";
import { Store, Coffee, Leaf, ArrowRight, Package, Truck } from "lucide-react";
import { CartProvider } from "@/components/CartProvider";
import { localize, publishedTexts } from "@/lib/international/translations";
import { LANGUAGES } from "@/lib/international/models";
import { getB2BSettings } from "@/lib/business/repository";
import { getTraderCatalogue, getTraderPresentation } from "@/lib/business/traderRepository";
import { TraderHero } from "./TraderHero";
import { TraderShelf, TraderBag } from "./TraderShelf";
import { TraderEnquiry } from "./TraderEnquiry";
import styles from "./traders.module.css";

export function TraderLanding({locale}:{locale:string}) {
  const settings = getB2BSettings();
  const content = localize(getTraderPresentation(),"tea-traders",locale);
  const c = content.copy;
  if(!settings.business_landing_enabled) return <div className={styles.root}><main className={styles.section}><h1>TeaFloww</h1><p>{c.empty}</p><Link href="/shop">{c.shop}</Link></main></div>;
  const all = getTraderCatalogue().map(p=>localize(p,`product:${p.id}`,locale));
  const selected = content.productIds.length ? content.productIds.flatMap(id=>all.find(p=>p.id===id) || []) : all.slice(0,6);
  const autoSlides = all.filter(p=>p.primary_image_url || p.primary_image?.url).slice(0,3).map(p=>({id:`product-${p.id}`,productId:p.id,title:c.headline,body:c.intro}));
  const slides = (content.slides.length ? content.slides : autoSlides).flatMap(s=>{
    const p = all.find(p=>p.id===s.productId); if(!p) return [];
    return [{id:s.id,title:s.title,body:s.body,imageUrl:p.primary_image_url || p.primary_image?.url || null,alt:p.primary_image?.alt_text || p.name}];
  });
  const journey = all.find(p=>p.id===content.journeyProductId) || selected.find(p=>p.primary_image_url) || all.find(p=>p.primary_image_url);
  const journeyImage = journey?.primary_image_url || journey?.primary_image?.url;
  const whatsapp = settings.whatsapp_enabled && settings.whatsapp_e164 ? `https://wa.me/${settings.whatsapp_e164}?text=${encodeURIComponent("Hello TeaFloww, I would like to discuss tea for my business.")}` : null;
  const languages = LANGUAGES.filter(l=>l.code==="en" || l.code==="hi" || l.code===locale || publishedTexts("tea-traders",l.code));
  return <CartProvider><div className={styles.root} lang={locale} dir={LANGUAGES.find(l=>l.code===locale)?.dir || "ltr"}>
    <header className={styles.header}>
      <Link href="/" className={styles.logo}><Image src="/logo/svg/02_primary_horizontal_full_color.svg" alt="TeaFloww" width={215} height={64} priority/></Link>
      <nav className={styles.nav} aria-label={c.heroLabel}><a href="#trade-packs">{c.navShop}</a><a href="#business-quote">{c.navBulk}</a><a href="#how-it-works">{c.navProcess}</a></nav>
      <div className={styles.headerActions}><nav aria-label={c.language} className={styles.languages}>{languages.map(l=><Link key={l.code} href={`/tea-traders${l.code==="en"?"":`?lang=${l.code}`}`} lang={l.code} hrefLang={l.code} aria-current={l.code===locale?"page":undefined}>{l.code==="en"?"EN":l.name}</Link>)}</nav><TraderBag label={c.bag}/></div>
    </header>
    <main id="main-content" tabIndex={-1}>
      <TraderHero slides={slides} copy={c} whatsapp={whatsapp}/>
      <section id="solutions" className={styles.section}>
        <h2>{c.audienceTitle}</h2>
        <div className={styles.audiences}>{[{Icon:Store,title:c.retailTitle,body:c.retailBody,link:c.retailLink,href:"#trade-packs"},{Icon:Coffee,title:c.bulkTitle,body:c.bulkBody,link:c.bulkLink,href:"#business-quote"},{Icon:Leaf,title:c.brandTitle,body:c.brandBody,link:c.brandLink,href:"/private-label"}].map(({Icon,title,body,link,href})=><article key={title}><Icon size={35} strokeWidth={1.3}/><h3>{title}</h3><p>{body}</p><Link className={styles.textLink} href={href}>{link}<ArrowRight size={16}/></Link></article>)}</div>
      </section>
      <section id="trade-packs" className={`${styles.section} ${styles.catalogue}`}>
        <p className={styles.eyebrow}>{c.catalogueEyebrow}</p><h2>{c.catalogueTitle}</h2><p className={styles.sectionIntro}>{c.catalogueBody}</p>
        <TraderShelf products={selected} copy={c} locale={locale}/>
      </section>
      <section id="how-it-works" className={styles.journey}>
        {journeyImage && <div className={styles.journeyImage}><Image src={journeyImage} alt={journey?.name || ""} fill sizes="(max-width: 760px) 90vw, 45vw"/></div>}
        <div className={styles.journeyCopy}><h2>{c.journeyTitle}</h2><ol>{[{Icon:Leaf,label:c.journeyOne},{Icon:Package,label:c.journeyTwo},{Icon:Truck,label:c.journeyThree}].map(({Icon,label})=><li key={label}><Icon size={27} strokeWidth={1.3}/>{label}</li>)}</ol><a href="#trade-packs" className={styles.gold}>{c.journeyCta}<ArrowRight size={18}/></a></div>
      </section>
      <section id="business-quote" className={styles.section}><p className={styles.eyebrow}>{c.eyebrow}</p><h2>{c.formTitle}</h2><p className={styles.sectionIntro}>{c.formIntro}</p><p className={styles.fine}>{c.formNotice}</p><TraderEnquiry copy={c} locale={locale} enabled={settings.leads_enabled} whatsapp={whatsapp}/></section>
      <section id="faq" className={`${styles.section} ${styles.faq}`}><h2>{c.faqTitle}</h2>{[[c.faqOneQ,c.faqOneA],[c.faqTwoQ,c.faqTwoA],[c.faqThreeQ,c.faqThreeA]].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    </main>
    <footer className={styles.footer}><div><strong>{c.footer}</strong><p>{c.footerBody}</p><a href="mailto:info@teafloww.com">info@teafloww.com</a><p>{settings.support_hours}</p></div><nav aria-label={c.footer}><Link href="/shop">{c.shop}</Link><Link href="/contact">{c.contact}</Link><Link href="/privacy">{c.privacy}</Link><Link href="/terms">{c.terms}</Link></nav></footer>
  </div></CartProvider>;
}
