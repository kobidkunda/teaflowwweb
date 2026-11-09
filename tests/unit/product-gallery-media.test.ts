import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductGallery } from "../../src/components/ProductGallery";
import { AdminProductImage, findSectionImage } from "../../src/components/AdminProductImage";
import type { ProductImage } from "../../src/lib/storefront";

const image: ProductImage = { id: 1, product_id: 1, url: "/uploads/admin-tea.webp", alt_text: "AI-created dry leaf illustration", sort_order: 0, is_primary: 1 };

describe("Admin product media authority", () => {
  it("uses a one-image catalogue without adding invented slides or film controls", () => {
    const html = renderToStaticMarkup(React.createElement(ProductGallery, { productName: "Tea", flush: "Spring", category: "Black", images: [image] }));
    expect(decodeURIComponent(html)).toContain(image.url);
    expect(html).toContain(image.alt_text);
    expect(html).toContain("View image 1 of 1");
    expect(html).not.toContain("/images/pdp/");
    expect(html).not.toContain("Play tea harvest film");
  });
  it("shows an honest empty gallery without substitute photos", () => {
    const html = renderToStaticMarkup(React.createElement(ProductGallery, { productName: "Tea", flush: "", category: "Black", images: [] }));
    expect(html).toContain("Product images have not been added yet.");
    expect(html).not.toContain("<img");
  });
  it("keeps admin descriptions visible and escapes text", () => {
    const html = renderToStaticMarkup(React.createElement(AdminProductImage, { image: { ...image, alt_text: "AI-created <leaf> illustration" } }));
    expect(html).toContain("<figcaption>AI-created &lt;leaf&gt; illustration</figcaption>");
    expect(renderToStaticMarkup(React.createElement(AdminProductImage))).toBe("");
  });
  it("only selects supplied sensory or estate imagery", () => {
    expect(findSectionImage([image], "dry leaf")).toEqual(image);
    expect(findSectionImage([image], "estate")).toBeUndefined();
  });
});
