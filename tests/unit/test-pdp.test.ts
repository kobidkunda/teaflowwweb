import React from "react";
import { test, expect } from "vitest";
import { getProductBySlug } from "@/lib/products";
import { getProductImages } from "@/lib/storefront";
import { getProductSchema } from "@/lib/seo/schema";
import Home from "@/app/page";
import ProductPage from "@/app/tea/[slug]/page";

test("PDP data test", async () => {
  const p = getProductBySlug("darjeeling-spring");
  expect(p).not.toBeNull();
  if (!p) return;
  const images = getProductImages(p.id);
  const schema = getProductSchema(p, p.variants, images);
  expect(schema).toBeDefined();
});

test("Home data test", async () => {
  const p = getProductBySlug("darjeeling-spring");
  expect(p).not.toBeNull();
});
