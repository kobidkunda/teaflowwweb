"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";
import { imagesForVariant } from "@/lib/imageVariants";
import type { getTraderCatalogue } from "@/lib/business/traderRepository";
import type { TraderCopy } from "@/lib/business/traderPresentation";
import styles from "./traders.module.css";
import { useTraderJourney } from "./TraderJourney";
type CatalogueProduct = ReturnType<typeof getTraderCatalogue>[number];
function Pack({product:p,copy:c,locale}:{product:CatalogueProduct;copy:TraderCopy;locale:string}) {
  const [selected,setSelected] = useState(p.variants.find(v=>v.stock>0)?.id || p.variants[0]?.id);
  const [added,setAdded] = useState(false);
  const [broken,setBroken] = useState<string|null>(null);
  const v = p.variants.find(v=>v.id===selected);
  const image = imagesForVariant(p.gallery,v?.sku,{format:v?.packaging_format,variants:p.variants})[0];
  const imageUrl = image?.url || (!p.gallery.length ? p.primary_image_url : null);
  const {add,buyNow} = useCart(); const router = useRouter(); const money = useDisplayMoney();
  const journey = useTraderJourney();
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
    <div className={styles.productPrice}>{v ? money(v.price_paise) : c.unavailable}</div><p className={styles.fine}>{c.toolsPublicPrice}</p>
    <div className={styles.productActions}><button className={styles.primary} disabled={!available} onClick={()=>purchase(true)}>{available?c.buyNow:c.unavailable}<ArrowRight size={17}/></button><button className={styles.outline} disabled={!available} onClick={()=>purchase()} aria-label={`${c.add}: ${p.name}`}><ShoppingBag size={17}/>{c.add}</button></div>
    <p className={styles.added} role="status">{added?c.added:""}</p>
    {v && <button className={styles.textLink} type="button" onClick={()=>journey?.requestQuote({interest:v.grams>1000?"bulk_supply":"ready_retail",note:`${p.name} / ${v.sku} / ${v.grams}g`})}>{c.quote}<ArrowRight size={16} aria-hidden="true"/></button>}
  </article>;
}
export function TraderShelf({products,copy,locale}:{products:CatalogueProduct[];copy:TraderCopy;locale:string}) {
  const [filter,setFilter] = useState("all");
  const [compared,setCompared] = useState<number[]>([]);
  const [notice,setNotice] = useState("");
  const journey = useTraderJourney();
  useEffect(()=>{
    const next = journey?.model === "distributor" ? "bulk" : journey?.model === "retail" ? "retail" : "all";
    setFilter(next === "all" || products.some(product=>product.variants.some(variant=>next === "bulk" ? variant.grams>1000 : variant.grams<=1000)) ? next : "all");
  },[journey?.model,products]);
  const visible = products.map(product=>({...product,variants:product.variants.filter(variant=>filter==="all" || (filter==="retail" ? variant.grams<=1000 : variant.grams>1000))})).filter(product=>product.variants.length);
  const comparison = products.filter(product=>compared.includes(product.id));
  const filters = [{id:"all",label:copy.toolsFilterAll},{id:"retail",label:copy.toolsFilterRetail},{id:"bulk",label:copy.toolsFilterBulk}].filter(item=>item.id==="all" || products.some(product=>product.variants.some(variant=>item.id==="retail" ? variant.grams<=1000 : variant.grams>1000)));
  return <><div className={styles.catalogueFilters} role="group" aria-label={copy.pack}>{filters.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}</button>)}</div><p className={styles.fine}>{copy.toolsCompareHint}</p><p role="status" className={styles.fine}>{notice}</p>{visible.length ? <div className={styles.productGrid}>{visible.map(product=><div key={`${product.id}-${filter}`}><Pack product={product} copy={copy} locale={locale}/><label className={styles.compareChoice}><input type="checkbox" checked={compared.includes(product.id)} onChange={event=>{if(event.target.checked && compared.length>=3){setNotice(copy.toolsCompareLimit);return;}setNotice("");setCompared(previous=>event.target.checked?[...previous,product.id]:previous.filter(id=>id!==product.id));}}/>{copy.toolsCompare}: {product.name}</label></div>)}</div> : <p role="status">{copy.empty}</p>}{comparison.length>=2 && <div className={styles.comparison} role="region" aria-label={copy.toolsCompareTitle} tabIndex={0}><table><caption>{copy.toolsCompareTitle}</caption><thead><tr><th scope="col">{copy.toolsProduct}</th>{comparison.map(product=><th scope="col" key={product.id}>{product.name}</th>)}</tr></thead><tbody>{[{title:copy.toolsIngredients,value:(product:CatalogueProduct)=>product.ingredients},{title:copy.toolsNotes,value:(product:CatalogueProduct)=>product.tasting_notes},{title:copy.toolsGrade,value:(product:CatalogueProduct)=>product.dry_leaf_grade},{title:copy.pack,value:(product:CatalogueProduct)=>product.variants.map(variant=>`${variant.grams}g`).join(" / ")}].map(row=><tr key={row.title}><th scope="row">{row.title}</th>{comparison.map(product=><td key={product.id}>{row.value(product)||copy.toolsNotRecorded}</td>)}</tr>)}<tr><th scope="row">{copy.toolsDocument}</th>{comparison.map(product=><td key={product.id}>{product.pdf_url && product.pdf_url.startsWith("/") && !product.pdf_url.startsWith("//") ? <a href={product.pdf_url}>{product.pdf_title||copy.toolsDocument}</a> : copy.toolsNotRecorded}</td>)}</tr></tbody></table></div>}<p className={styles.fine}>{copy.totals}</p><Link className={styles.textLink} href="/shop">{copy.allTeas}<ArrowRight size={16}/></Link></>;
}
export function TraderBag({label}:{label:string}) {const {count}=useCart();return <Link href="/cart" className={styles.bag} aria-label={`${label} (${count})`}><ShoppingBag size={21}/>{count>0 && <span>{count}</span>}</Link>;}
