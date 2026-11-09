import React from "react";
import { Leaf, Mountain, Sprout, Gift } from "lucide-react";

export interface TrustItem {
  title: string;
  subtitle: string;
}

export interface TrustBarProps {
  items?: TrustItem[];
}

const DEFAULT_ITEMS: TrustItem[] = [
  {
    title: "Single-Origin Authenticity",
    subtitle: "Teas from renowned gardens",
  },
  {
    title: "Seasonal Harvests",
    subtitle: "Picked at the peak of flavour",
  },
  {
    title: "Freshness Guaranteed",
    subtitle: "Small batch, often re-stocked",
  },
  {
    title: "Thoughtful Gifting",
    subtitle: "Beautifully packaged",
  },
];

const ICONS = [Leaf, Mountain, Sprout, Gift];

export function TrustBar({ items }: TrustBarProps = {}) {
  const displayItems = items && items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <section className="tf-trust-bar tf-trust-bar-mockup" aria-label="Our quality and ethical promises">
      <div className="container">
        <div className="tf-trust-grid tf-trust-grid-mockup">
          {displayItems.map((item, idx) => {
            const Icon = ICONS[idx % ICONS.length];
            return (
              <div key={idx} className="tf-trust-item">
                <span className="tf-trust-icon-circle" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <div className="tf-trust-copy">
                  <strong className="tf-trust-title">{item.title}</strong>
                  <span className="tf-trust-subtitle">{item.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
