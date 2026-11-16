import type { B2BFaqItem } from "@/lib/business/repository";

export function FaqAccordion({ items }: { items: B2BFaqItem[] }) {
  return (
    <div className="tf-faq">
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
