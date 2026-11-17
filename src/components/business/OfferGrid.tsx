"use client";

import Image from "next/image";
import { Package, PenTool, ShoppingBag } from "lucide-react";
import type { PublicOfferView } from "@/lib/business/repository";
import type { BusinessLocale, OfferCode } from "@/lib/business/schema";
import { useTr } from "./BusinessI18n";

const ICONS = {
  package: Package,
  "shopping-bag": ShoppingBag,
  "pen-tool": PenTool,
} as const;

export function OfferGrid({
  offers,
  selectedOffer,
  locale,
  onSelect,
}: {
  offers: PublicOfferView[];
  selectedOffer?: OfferCode;
  locale: BusinessLocale;
  onSelect: (offerCode: OfferCode) => void;
}) {
  const t = useTr();

  return (
    <div className="tf-card-grid">
      {offers.map((offer) => {
        const Icon = ICONS[offer.icon] ?? Package;
        const isSelected = selectedOffer === offer.code;
        return (
          <article
            key={offer.id}
            className={`tf-card ${isSelected ? "tf-card--selected" : ""}`.trim()}
          >
            {isSelected ? (
              <span className="tf-card__badge">{t("Selected")}</span>
            ) : null}

            <div className="tf-card__illustration" aria-hidden={offer.imageUrl ? undefined : true}>
              {offer.imageUrl ? (
                <Image
                  src={offer.imageUrl}
                  alt={offer.imageAlt || offer.title}
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <Icon size={40} strokeWidth={1.6} />
              )}
            </div>

            <span className="tf-eyebrow" style={{ marginTop: "1rem" }}>
              {offer.eyebrow}
            </span>
            <h3>{offer.title}</h3>
            <p>{offer.description}</p>
            {offer.moqText ? <p className="tf-card__moq">{offer.moqText}</p> : null}

            <button
              type="button"
              className="tf-card__link"
              aria-pressed={isSelected}
              onClick={() => {
                onSelect(offer.code);
                const el = document.getElementById("business-quote");
                if (el) {
                  const prefersReduced =
                    typeof window !== "undefined" &&
                    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                  el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
                }
              }}
            >
              <span>{offer.ctaLabel}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}
