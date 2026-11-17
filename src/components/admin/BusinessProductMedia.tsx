"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductImagesEditor } from "./catalog/ProductImagesEditor";
import type { GalleryImage } from "./catalog/MultiImageUploader";

type ProductMedia = {
  images: GalleryImage[];
  variants: { sku: string; grams: number; packaging_format: string }[];
};

function ProductMediaLoader({ productId, onSaved }: { productId: number; onSaved: (url: string | null) => void }) {
  const [data, setData] = useState<ProductMedia | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      try {
        const response = await fetch(`/api/admin/products/${productId}`, { credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load product images.");
        const result = await response.json();
        if (!controller.signal.aborted) setData(result.product);
      } catch {
        if (!controller.signal.aborted) setError("Unable to load product images. Please retry.");
      }
    }
    void load();
    return () => controller.abort();
  }, [productId, attempt]);
  if (error) return <div><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)}>Retry image loading</button></div>;
  if (!data) return <p role="status">Loading product images…</p>;
  return <ProductImagesEditor productId={productId} images={data.images || []} variants={data.variants || []} onSaved={images => {
    setData(current => current ? { ...current, images } : current);
    onSaved(images.find(image => image.is_primary)?.url || images[0]?.url || null);
  }} />;
}

export function BusinessProductMedia({ products, onSaved }: {
  products: { id: number; name: string }[];
  onSaved: (id: number, url: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState(0);
  const productId = selectedId || products[0]?.id;
  return <details className="tf-admin-card">
    <summary>Upload Tea Traders product images &amp; assets</summary>
    <p>Manage the catalogue photographs used by the slider, product shelf and “Taste first” section. Saving images updates this product wherever it appears on the site. Page copy is saved separately.</p>
    {products.length ? <>
      <label className="tf-admin-label" htmlFor="business-media-product">Product images to manage</label>
      <select id="business-media-product" className="tf-admin-input" value={productId} onChange={event => setSelectedId(Number(event.target.value))}>
        {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
      {productId && <ProductMediaLoader key={productId} productId={productId} onSaved={url => onSaved(productId, url)} />}
    </> : <p>No published products are available. Add a product in <Link href="/admin/products/new">Products</Link> to upload catalogue assets.</p>}
  </details>;
}
