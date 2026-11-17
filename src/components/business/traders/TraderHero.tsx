"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";
export type HeroSlide = {id:string;title:string;body:string;imageUrl:string|null;alt:string};
export function TraderHero({slides,copy:c,whatsapp}:{slides:HeroSlide[];copy:TraderCopy;whatsapp:string|null}) {
  const [broken,setBroken] = useState<string|null>(null);
  const slide = slides[0] || {title:c.headline,body:c.intro,imageUrl:null,alt:"",id:"empty"};
  return <section className={styles.hero} aria-label={c.heroLabel}>
    <div className={styles.heroImage}>
      {slide.imageUrl && slide.imageUrl!==broken ? <Image key={slide.imageUrl} src={slide.imageUrl} alt={slide.alt} fill onError={()=>setBroken(slide.imageUrl)} priority sizes="(max-width: 760px) 100vw, 48vw" /> : <p className={styles.imageMissing}>{c.imageUnavailable}</p>}
    </div>
    <div className={styles.heroCopy}>
      <h1>{slide.title}</h1><p className={styles.intro}>{slide.body}</p>
      <a className={styles.gold} href="#solutions">{c.toolsExplore}<ArrowRight size={18} aria-hidden="true"/></a>
      <div className={styles.heroLinks}><Link href="/trials#top">{c.toolsSample}</Link><a href="#business-quote">{c.quote}<ArrowRight size={15} aria-hidden="true"/></a></div>
      <p className={styles.heroPromise}>{c.toolsPromise}</p>
      {whatsapp && <a className={styles.whatsapp} href={whatsapp} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a>}
    </div>
  </section>;
}
