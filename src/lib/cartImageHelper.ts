/**
 * Resolves high-resolution tea imagery for cart line items and checkout summaries.
 */
export function getCartItemImage(line: { slug?: string; name?: string; imageUrl?: string }): string {
  if (line.imageUrl && line.imageUrl.trim().length > 0) {
    return line.imageUrl;
  }

  const s = ((line.slug || "") + " " + (line.name || "")).toLowerCase();

  if (s.includes("darjeeling")) {
    return "/images/product-darjeeling-tin.jpg";
  }
  if (s.includes("assam")) {
    return "/images/product-assam-tin.jpg";
  }
  if (s.includes("nilgiri")) {
    return "/images/product-nilgiri-tin.jpg";
  }
  if (s.includes("chai") || s.includes("masala")) {
    return "/images/home/masala-chai.webp";
  }
  if (s.includes("peony") || s.includes("white") || s.includes("herbal") || s.includes("infusion")) {
    return "/images/product-herbal-tin.jpg";
  }

  return "/images/product-darjeeling-tin.jpg";
}
