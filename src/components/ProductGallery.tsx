"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { imagesForVariant } from "@/lib/imageVariants";
import type { ProductImage } from "@/lib/storefront";

type Props = {
  productName: string;
  flush: string;
  category: string;
  images: ProductImage[];
  productId?: number;
  defaultVariantSku?: string;
  defaultPackagingFormat?: string;
  variants?: Array<{ sku: string; packaging_format: string }>;
};

/** Only admin-supplied catalogue images; no invented film or fallback slides. */
export function ProductGallery({
  productName,
  flush,
  category,
  images: allImages,
  productId,
  defaultVariantSku,
  defaultPackagingFormat,
  variants,
}: Props) {
  const [variantSku, setVariantSku] = useState(defaultVariantSku);
  const [packagingFormat, setPackagingFormat] = useState(defaultPackagingFormat);

  useEffect(() => {
    const handleVariant = (event: Event) => {
      const detail = (event as CustomEvent<{
        product?: { id: number };
        variant?: { sku: string; packaging_format?: string };
        format?: string;
      }>).detail;
      if (detail?.product?.id !== productId || !detail.variant) return;
      setVariantSku(detail.variant.sku);
      setPackagingFormat(detail.format || detail.variant.packaging_format);
      setSelected(0);
      setZoomed(false);
      setFailedUrl("");
    };
    window.addEventListener("tea-variant-change", handleVariant);
    return () => window.removeEventListener("tea-variant-change", handleVariant);
  }, [productId]);

  const images = imagesForVariant(allImages, variantSku, {
    format: packagingFormat,
    variants,
  });
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [failedUrl, setFailedUrl] = useState("");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = images[Math.min(selected, images.length - 1)];
  if (!current) return <div className="pdp-gallery" data-testid="product-gallery"><div className="pdp-image gallery-empty"><p> <StorefrontText id="copy_5932fbccede289dd" fallback="Product images have not been added yet." /> </p></div></div>;

  function choose(index: number) { setSelected(index); setZoomed(false); setFailedUrl(""); }
  return <div className="pdp-gallery product-gallery min-w-0 max-w-full" data-testid="product-gallery">
    <div className={`pdp-image gallery-main min-w-0 max-w-full art-${category.toLowerCase().replace(/[^a-z]/g, "")}`}>
      {flush && <span className="art-badge">{flush}</span>}
      {failedUrl === current.url ? (
        <p role="status" className="gallery-image-error"> <StorefrontText id="copy_59fbf337b57fbb03" fallback="This image could not be loaded. Choose another view." /> </p>
      ) : (
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt_text || (packagingFormat ? `${productName} (${packagingFormat.replace(/_/g, " ")})` : productName)}
          width={1254}
          height={1254}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 627px"
          className={zoomed ? "gallery-photo zoomed max-w-full transition-opacity duration-200" : "gallery-photo max-w-full transition-opacity duration-200"}
          onError={() => setFailedUrl(current.url)}
        />
      )}
      <button className="gallery-zoom" type="button" aria-label={zoomed ? "Reset image zoom" : "Zoom image preview"} aria-pressed={zoomed} disabled={failedUrl === current.url} onClick={() => setZoomed(!zoomed)}><ZoomIn size={19} aria-hidden="true" /></button>
    </div>
    <div className="gallery-thumbs" role="group" aria-label={`Product images for ${productName}`}>
      {images.map((image,index) => <button key={image.id} type="button" ref={(node) => { refs.current[index] = node; }} className={index === selected ? "gallery-thumb selected" : "gallery-thumb"} aria-pressed={index === selected} aria-label={`View image ${index + 1} of ${images.length}: ${image.alt_text || productName}`} onClick={() => choose(index)} onKeyDown={(event) => {
        const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (delta) { event.preventDefault(); const next = (index + delta + images.length) % images.length; choose(next); refs.current[next]?.focus(); }
      }}>
        <Image
          src={image.url}
          alt=""
          aria-hidden="true"
          width={76}
          height={76}
          sizes="76px"
          loading="lazy"
        />
      </button>)}
    </div>
    <p className="gallery-caption" aria-live="polite">{String(selected + 1).padStart(2,"0")} / {String(images.length).padStart(2,"0")} · {current.alt_text || productName}</p>
  </div>;
}
export default ProductGallery;
