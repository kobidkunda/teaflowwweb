"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";
import { imagesForVariant } from "@/lib/imageVariants";
import type { getTraderCatalogue } from "@/lib/business/traderRepository";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";
type CatalogueProduct = ReturnType<typeof getTraderCatalogue>[number];
function Pack({product:p,copy:c,locale}:{product:CatalogueProduct;copy:TraderCopy;locale:string}) {
  const [selected,setSelected] = useState(p.variants.find(v=>v.stock>0)?.id || p.variants[0]?.id);
  const [added,setAdded] = useState(false);
  const [broken,setBroken] = useState<string|null>(null);
  const v = p.variants.find(v=>v.id===selected);
  const image = imagesForVariant(p.gallery,v?.sku,{format:v?.packaging_format,variants:p.variants})[0];
  const imageUrl = image?.url || (!p.gallery.length ? p.primary_image_url : null);
  const {add,buyNow} = useCart(); const router = useRouter(); const money = useDisplayMoney();
  const available = Boolean(v && v.stock>0 && v.price_paise>0);
  function purchase(checkout=false) {
    if(!available || !v) return;
    const line = {variantId:v.id,sku:v.sku,slug:p.slug,name:p.name,grams:v.grams,pricePaise:v.price_paise,imageUrl};
    if(checkout) buyNow(line,true); else add(line,true,false);
    setAdded(true);
    if(checkout) router.push(locale === "en" ? "/checkout" : `/${locale}/checkout`);
  }
  return <article className={styles.product}>
    <Link className={styles.productImage} href={`/tea/${p.slug}`} aria-label={`${c.details}: ${p.name}`}>
      {imageUrl && broken!==imageUrl ? <Image src={imageUrl} alt={image?.alt_text || p.name} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 30vw" onError={()=>setBroken(imageUrl)}/> : <span className={styles.imageMissing}>{c.imageUnavailable}</span>}
    </Link>
    <p className={styles.productCategory}>{p.category}</p><h3><Link href={`/tea/${p.slug}`}>{p.name}</Link></h3>
    <label className={styles.packLabel}>{c.pack}<select value={selected || ""} onChange={e=>{setSelected(Number(e.target.value));setAdded(false);}} disabled={!p.variants.length}>
      {p.variants.map(v=><option key={v.id} value={v.id}>{v.grams>=1000 ? `${v.grams/1000} kg` : `${v.grams} g`} · {v.packaging_format==="luxury_tin"?c.tin:v.packaging_format==="pyramid_bags"?c.pyramid:c.pouch} · {money(v.price_paise)}{v.stock<1 ? ` · ${c.unavailable}` : ""}</option>)}
    </select></label>
    <div className={styles.productPrice}>{v ? money(v.price_paise) : c.unavailable}</div>
    <div className={styles.productActions}><button className={styles.primary} disabled={!available} onClick={()=>purchase(true)}>{available?c.buyNow:c.unavailable}<ArrowRight size={17}/></button><button className={styles.outline} disabled={!available} onClick={()=>purchase()} aria-label={`${c.add}: ${p.name}`}><ShoppingBag size={17}/>{c.add}</button></div>
    <p className={styles.added} role="status">{added?c.added:""}</p>
  </article>;
}
export function TraderShelf({products,copy,locale}:{products:CatalogueProduct[];copy:TraderCopy;locale:string}) {
  return <>{products.length ? <div className={styles.productGrid}>{products.map(p=><Pack key={p.id} product={p} copy={copy} locale={locale}/>)}</div> : <p role="status">{copy.empty}</p>}<p className={styles.fine}>{copy.totals}</p><Link className={styles.textLink} href="/shop">{copy.allTeas}<ArrowRight size={16}/></Link></>;
}
export function TraderBag({label}:{label:string}) {const {count}=useCart();return <Link href="/cart" className={styles.bag} aria-label={`${label} (${count})`}><ShoppingBag size={21}/>{count>0 && <span>{count}</span>}</Link>;}
