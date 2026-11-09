import React from "react";
import Image from "next/image";
import type { ProductImage } from "@/lib/storefront";

export function findSectionImage(images: ProductImage[], section: "dry leaf" | "wet leaf" | "liquor" | "estate") {
  return images.find((image) => image.alt_text.toLowerCase().includes(section));
}

/** The admin owns both the image and its visible disclosure/description. */
export function AdminProductImage({ image, className = "" }: { image?: ProductImage; className?: string }) {
  if (!image) return null;
  return <figure className={`pdp-admin-illustration ${className}`}>
    <Image
      src={image.url}
      alt={image.alt_text}
      width={1254}
      height={1254}
      sizes="(max-width: 768px) 100vw, 600px"
      loading="lazy"
    />
    <figcaption>{image.alt_text}</figcaption>
  </figure>;
}
