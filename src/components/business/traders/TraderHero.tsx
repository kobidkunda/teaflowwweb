"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";
export type HeroSlide = {id:string;title:string;body:string;imageUrl:string|null;alt:string};
export function TraderHero({slides,copy:c,whatsapp}:{slides:HeroSlide[];copy:TraderCopy;whatsapp:string|null}) {
  const [index,setIndex] = useState(0);
  const [broken,setBroken] = useState<string|null>(null);
  const slide = slides[index] || {title:c.headline,body:c.intro,imageUrl:null,alt:"",id:"empty"};
  return <section className={styles.hero} aria-label={c.heroLabel} aria-roledescription="carousel">
    <div className={styles.heroImage}>
      {slide.imageUrl && slide.imageUrl!==broken ? <Image key={slide.imageUrl} src={slide.imageUrl} alt={slide.alt} fill onError={()=>setBroken(slide.imageUrl)} priority={index===0} sizes="(max-width: 760px) 100vw, 58vw" /> : <p className={styles.imageMissing}>{c.imageUnavailable}</p>}
      {slides.length > 1 && <div className={styles.sliderControls}>
        <button aria-label={c.previous} onClick={()=>setIndex(i=>(i+slides.length-1)%slides.length)}><ArrowLeft size={18}/></button>
        <span aria-live="polite">{c.slide} {index+1} / {slides.length}</span>
        <button aria-label={c.next} onClick={()=>setIndex(i=>(i+1)%slides.length)}><ArrowRight size={18}/></button>
      </div>}
    </div>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>{c.eyebrow}</p><h1>{slide.title}</h1><p className={styles.intro}>{slide.body}</p>
      <a className={styles.primary} href="#trade-packs">{c.buy}<ArrowRight size={18}/></a>
      <a className={styles.outline} href="#business-quote">{c.quote}</a>
      {whatsapp && <a className={styles.whatsapp} href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={22}/>{c.whatsapp}</a>}
    </div>
  </section>;
}
