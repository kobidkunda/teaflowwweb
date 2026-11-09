import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import type { Product } from "@/lib/products";
export function TasteMap({ product }: { product: Product }) {
  const traits = [
    ["Floral", product.floral], ["Fruity", product.fruity],
    ["Malty", product.malty], ["Body", product.body]
  ] as const;
  const summary = traits.map(([label, value]) => label + " " + value + " of 5").join(", ");
  return <section className="taste-map" aria-label={"Taste map for " + product.name}>
    <p className="eyebrow"> <StorefrontText id="copy_bc0832f11d800466" fallback="Taste map" /> </p><h2> <StorefrontText id="copy_27478f4aed15c4b1" fallback="Know your cup." /> </h2>
    <p> <StorefrontText id="copy_8b1da24fd113842c" fallback="Intensity is illustrative on a five-point scale; replace with verified tasting-panel scores." /> </p>
    <p className="sr-only"> <StorefrontText id="copy_37067f9192789830" fallback="Taste intensities:" /> {summary}.</p>
    {traits.map(([label, value]) => <div className="taste-row" key={label}>
      <span>{label}</span><div className="taste-track" role="img" aria-label={label + ": " + value + " out of 5"}><div style={{ width: value * 20 + "%" }}/></div><strong>{value}/5</strong>
    </div>)}
    <div className="flavour-arc"><span> <StorefrontText id="copy_f4b13e93df077dc3" fallback="Opening" /> </span><strong>{product.tasting_notes}</strong><span> <StorefrontText id="copy_a6c7a84baa6750fc" fallback="Finish" /> </span></div>
  </section>;
}
