import Image from "next/image";
import type { B2BProofItem } from "@/lib/business/repository";

export function ProofGallery({ items }: { items: B2BProofItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="tf-proof-grid">
      {items.map((item, idx) => (
        <figure key={`${item.title}-${idx}`} className="tf-proof-card">
          <div className="tf-proof-card__media">
            <Image
              src={item.imageUrl}
              alt={item.alt}
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <figcaption className="tf-proof-card__body">
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
            <span className="tf-proof-card__source">{item.sourceOwner}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
