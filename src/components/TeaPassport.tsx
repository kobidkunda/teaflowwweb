import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import type { Product } from "@/lib/products";
export function TeaPassport({ product }: { product: Product }) {
  const rows = [
    ["Origin", product.origin], ["Estate / maker", product.estate],
    ["Harvest", product.harvest_date], ["Flush", product.flush],
    ["Brew temperature", product.brew_temp + "°C"],
    ["Steep time", Math.floor(product.brew_seconds / 60) + "m " + product.brew_seconds % 60 + "s"]
  ];
  return <section className="passport">
    <p className="eyebrow"> <StorefrontText id="copy_4e4d241270c2b657" fallback="The Tea Passport · Demo data" /> </p>
    <h2> <StorefrontText id="copy_5dd00dbf16af2d34" fallback="A little more about the leaf." /> </h2>
    <div className="passport-grid">{rows.map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>
    <p className="micro-note"> <StorefrontText id="copy_131fe8ea6cbd33d2" fallback="Verify origin, estate, harvest, cultivar, batch and certifications before publishing real products." /> </p>
  </section>;
}
