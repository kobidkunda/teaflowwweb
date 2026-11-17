"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TraderPresentation, TraderCopy } from "@/lib/business/traderPresentation";

type ProductOption = {id:number;name:string;imageUrl:string|null};
export function TraderPageEditor() {
  const [content,setContent]=useState<TraderPresentation|null>(null);
  const [products,setProducts]=useState<ProductOption[]>([]);
  const [error,setError]=useState("");const [message,setMessage]=useState("");const [saving,setSaving]=useState(false);
  async function load() {setError("");try {const r=await fetch("/api/admin/business/traders");if(!r.ok)throw new Error("Unable to load Tea Traders settings.");const data=await r.json();setContent(data.content);setProducts(data.products);}catch{setError("Unable to load Tea Traders settings. Try again.");}}
  useEffect(()=>{void load();},[]);
  async function save(e:React.FormEvent) {e.preventDefault();setSaving(true);setError("");setMessage("");try{const r=await fetch("/api/admin/business/traders",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(content)});const data=await r.json();if(!r.ok)throw new Error(data.detail || data.error || "Unable to save.");setContent(data.content);setMessage("Tea Traders page saved. Refresh the page preview to see your changes.");}catch(e){setError(e instanceof Error?e.message:"Unable to save.");}finally{setSaving(false);}}
  function patch(p:Partial<TraderPresentation>) {setContent(c=>c?{...c,...p}:c);setMessage("");}
  function moveSlide(index:number,direction:number) {if(!content)return;const slides=[...content.slides];[slides[index],slides[index+direction]]=[slides[index+direction],slides[index]];patch({slides});}
  if(!content) return <div className="tf-admin-card"><p role="status">{error || "Loading Tea Traders editor…"}</p>{error && <button onClick={()=>void load()}>Retry</button>}</div>;
  return <form onSubmit={save} className="tf-admin-card trader-editor">
    <div className="tf-admin-card-header"><h2>Tea Traders · slider & storefront</h2><Link href="/tea-traders" target="_blank">Preview page</Link></div>
    <p>Product photography, prices and pack availability come directly from the backend catalogue. Change product photographs in <Link href="/admin/products">Products</Link>. Manage language versions in <Link href="/admin/translations?search=tea-traders">Translations</Link> using the <strong>Tea Traders · page, slider & enquiry</strong> resource. English source changes make older translations stale until reviewed and republished.</p>
    <fieldset disabled={saving}>
    <h3>Hero slider</h3><p>Automatic mode shows the first three catalogue products with images. Add slides below to curate the slider. Images always follow the selected product’s current primary photo. Recommended photo: square or portrait, at least 1200 px wide.</p>
    {content.slides.length===0 && <p role="status">Automatic catalogue slider is active.</p>}
    {content.slides.map((slide,i)=>{const product=products.find(p=>p.id===slide.productId);return <fieldset key={slide.id} className="trader-slide"><legend>Slide {i+1}</legend>
      {product?.imageUrl && <Image src={product.imageUrl} alt={product.name} width={100} height={100} unoptimized/>}
      <label>Catalogue product<select value={slide.productId} onChange={e=>patch({slides:content.slides.map((s,j)=>j===i?{...s,productId:Number(e.target.value)}:s)})}>{!product&&<option value={slide.productId}>Unavailable product #{slide.productId} — select another</option>}{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Headline<textarea value={slide.title} maxLength={800} onChange={e=>patch({slides:content.slides.map((s,j)=>j===i?{...s,title:e.target.value}:s)})} required/></label>
      <label>Supporting copy<textarea value={slide.body} maxLength={800} onChange={e=>patch({slides:content.slides.map((s,j)=>j===i?{...s,body:e.target.value}:s)})} required/></label>
      <div className="trader-editor-actions"><button type="button" disabled={i===0} onClick={()=>moveSlide(i,-1)}>Move up</button><button type="button" disabled={i===content.slides.length-1} onClick={()=>moveSlide(i,1)}>Move down</button><button type="button" onClick={()=>patch({slides:content.slides.filter((_,j)=>j!==i)})}>Remove slide {i+1}</button></div>
    </fieldset>;})}
    <button type="button" disabled={content.slides.length>=8 || !products.length} onClick={()=>patch({slides:[...content.slides,{id:crypto.randomUUID(),productId:products[0].id,title:content.copy.headline,body:content.copy.intro}]})}>Add slide</button>
    <h3>Featured product shelf</h3><p>Choose up to 12 products. With none selected, the first six published, enabled catalogue products appear.</p>
    <div className="trader-product-options">{products.map(p=><label key={p.id}><input type="checkbox" checked={content.productIds.includes(p.id)} onChange={e=>patch({productIds:e.target.checked?[...content.productIds,p.id]:content.productIds.filter(id=>id!==p.id)})} disabled={!content.productIds.includes(p.id)&&content.productIds.length>=12}/>{p.name}</label>)}</div>
    {content.productIds.map((id,i)=><div key={id} className="trader-editor-actions"><span>{i+1}. {products.find(p=>p.id===id)?.name || `Unavailable product #${id}`}</span><button type="button" disabled={i===0} onClick={()=>{const ids=[...content.productIds];[ids[i-1],ids[i]]=[ids[i],ids[i-1]];patch({productIds:ids});}}>Move up</button><button type="button" disabled={i===content.productIds.length-1} onClick={()=>{const ids=[...content.productIds];[ids[i+1],ids[i]]=[ids[i],ids[i+1]];patch({productIds:ids});}}>Move down</button></div>)}
    <label>“Taste first” section product<select value={content.journeyProductId || ""} onChange={e=>patch({journeyProductId:e.target.value?Number(e.target.value):null})}><option value="">Automatic · first featured image</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <details className="trader-copy-fields"><summary>Edit all page copy</summary>{Object.entries(content.copy).map(([key,value])=><label key={key}>{key.replace(/([A-Z])/g," $1")}<textarea value={value} maxLength={800} required onChange={e=>patch({copy:{...content.copy,[key as keyof TraderCopy]:e.target.value}})}/></label>)}</details>
    </fieldset>
    {error && <p role="alert" className="tf-admin-status-error">{error}</p>}{message && <p role="status">{message}</p>}
    <button type="submit" className="tf-admin-btn tf-admin-btn-primary" disabled={saving}>{saving?"Saving…":"Save Tea Traders page"}</button>
    <p className="trader-editor-help">API: GET / PUT /api/admin/business/traders · MCP: business.getTradersPage / business.saveTradersPage. Changes apply to this site only; deployment remains a separate action.</p>
  </form>;
}
