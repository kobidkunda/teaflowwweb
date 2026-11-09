import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { ProductCard } from "@/components/ProductCard";
import { listProducts } from "@/lib/products";
import { getPageOrDefault } from "@/lib/pages";
import { constructMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const page = getPageOrDefault("gifts");
  return constructMetadata({
    title: page.meta_title || "The Gift Atelier — Himalayan Tea House",
    description: page.meta_description || "Handcrafted wooden presentation boxes, multi-flush discovery flights, and bespoke gifting sets.",
    path: "/gifts",
    ogImage: "/images/cat-gift-sets.jpg",
  });
}

export default function GiftsPage() {
  const page = getPageOrDefault("gifts");
  const products = listProducts({ category: "Gifts" });

  const eyebrow = page.eyebrow || "The Gift Atelier";
  const headline = page.headline || "The art of giving.";
  const subtitle = page.subtitle || "A beautiful gesture begins with a thoughtful choice. Handcrafted wooden presentation boxes, multi-flush discovery flights, and bespoke gifting sets.";

  return (
    <div className="container page-shell">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{headline}</h1>
      <p className="page-intro">{subtitle}</p>
      <div className="gift-banner">
        <span> <StorefrontText id="copy_f5f6b7b67a253cec" fallback="THE GIFT EDITION" /> </span>
        <h2> <StorefrontText id="copy_ce0f13687fe8f16d" fallback="Some rituals are" /> <br />
          <em> <StorefrontText id="copy_a0ac299d1213b7ab" fallback="better shared." /> </em>
        </h2>
      </div>
      {products.length ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2> <StorefrontText id="copy_32b89507eab3edfe" fallback="No gift sets right now." /> </h2>
          <p> <StorefrontText id="copy_fcec8224d8414949" fallback="Our gift shelf is being prepared. Explore the full tea collection instead." /> </p>
          <Link href="/shop" className="button button-primary"> <StorefrontText id="copy_58bb39627cb39860" fallback="Shop all teas" /> </Link>
        </div>
      )}
    </div>
  );
}
