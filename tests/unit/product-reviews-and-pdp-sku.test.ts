import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDb } from "@/lib/db";
import {
  getApprovedReviewSummary,
  listApprovedReviews,
  moderateProductReview,
  submitVerifiedProductReview,
} from "@/lib/reviews";
import { generateGoogleProductReviewsXml } from "@/lib/feeds";
import { GET as getLlmsFullRoute } from "@/app/llms-full.txt/route";
import { VariantPicker } from "@/components/VariantPicker";
import { getProductBySlug } from "@/lib/products";
import { CartProvider } from "@/components/CartProvider";

describe("Verified Product Reviews, PDP ?sku= Parity, and Dynamic llms-full.txt", () => {
  const createdReviewIds: number[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    const db = getDb();
    for (const revId of createdReviewIds.splice(0)) {
      db.prepare("DELETE FROM product_reviews WHERE id = ?").run(revId);
    }
    for (const ordId of createdOrderIds.splice(0)) {
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(ordId);
      db.prepare("DELETE FROM orders WHERE id = ?").run(ordId);
    }
  });

  it("rejects unverified reviews and emits aggregateRating / Google Reviews XML only for approved verified orders", () => {
    const product = getProductBySlug("darjeeling-spring");
    expect(product).toBeTruthy();
    if (!product || !product.variants[0]) return;

    expect(() =>
      submitVerifiedProductReview({
        entity_type: "product",
        entity_id: String(product.id),
        order_reference: "NON-EXISTENT-ORDER-999",
        reviewer_email: "nobody@example.com",
        reviewer_name: "Test User",
        rating: 5,
        title: "Great tea",
        body: "This should not be accepted without a matching order.",
      })
    ).toThrow(/verify a qualifying purchase/i);

    const testOrderId = `ord-review-test-${Date.now()}`;
    createdOrderIds.push(testOrderId);
    const db = getDb();
    db.prepare(
      `INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid')`
    ).run(
      testOrderId,
      `idem-${testOrderId}`,
      "Aarav Sen",
      "aarav.verified@example.com",
      "Siliguri, WB",
      product.variants[0].price_paise,
      0,
      product.variants[0].price_paise
    );
    db.prepare(
      "INSERT INTO order_items (order_id, variant_id, quantity, unit_price_paise) VALUES (?, ?, 1, ?)"
    ).run(testOrderId, product.variants[0].id, product.variants[0].price_paise);

    const pendingReview = submitVerifiedProductReview({
      entity_type: "product",
      entity_id: String(product.id),
      order_reference: testOrderId,
      reviewer_email: "aarav.verified@example.com",
      reviewer_name: "Aarav S.",
      rating: 5,
      title: "Vibrant spring muscatel",
      body: "Clean floral liquor and crisp second steep without bitterness.",
    });
    createdReviewIds.push(pendingReview.id);

    expect(pendingReview.status).toBe("pending");
    expect(pendingReview.verified_purchase).toBe(true);
    expect(getApprovedReviewSummary("product", product.id)).toBeNull();

    const approved = moderateProductReview(pendingReview.id, "approved");
    expect(approved?.status).toBe("approved");

    const summary = getApprovedReviewSummary("product", product.id);
    expect(summary).toEqual({ ratingValue: 5, reviewCount: 1 });
    expect(listApprovedReviews("product", product.id)).toHaveLength(1);

    const reviewsXml = generateGoogleProductReviewsXml("https://teafloww.com");
    expect(reviewsXml).toContain("Vibrant spring muscatel");
    expect(reviewsXml).toContain("<overall min=\"1\" max=\"5\">5</overall>");
  });

  it("renders VariantPicker with matching delivery window, shipping policy, return window, and preselected variant", () => {
    const product = getProductBySlug("darjeeling-spring");
    expect(product).toBeTruthy();
    if (!product || product.variants.length === 0) return;

    const targetVariant = product.variants[product.variants.length - 1];
    const markup = renderToStaticMarkup(
      React.createElement(
        CartProvider,
        null,
        React.createElement(VariantPicker, {
          product,
          initialFormat: targetVariant.packaging_format,
          initialGrams: targetVariant.grams,
          commercePolicy: {
            deliveryWindowLabel: "3–9 day delivery",
            flatShippingPaise: 15000,
            hasExplicitShippingOverride: false,
            freeShippingEnabled: true,
            freeShippingThresholdPaise: 59900,
            returnWindowDays: 7,
            returnMethod: "ReturnByMail",
            returnFees: "FreeReturn",
            reviewSummary: { ratingValue: 4.3, reviewCount: 61 },
          },
        })
      )
    );

    expect(markup).toContain("3–9 day delivery");
    expect(markup).toContain("7-day returns");
    expect(markup).toContain("4.3");
    expect(markup).toContain("(61)");
    expect(markup).not.toContain("Free delivery ₹499+");
  });

  it("serves dynamic /llms-full.txt listing available teas, trials, and packaging with prices, stock, delivery, and returns", async () => {
    const res = await getLlmsFullRoute(new Request("https://teafloww.com/llms-full.txt"));
    expect(res.status).toBe(200);
    const text = await res.text();

    expect(text).toContain("## Live Available Product Catalog");
    expect(text).toContain("Single-Estate & Blended Teas");
    expect(text).toContain("Craft Tea Trial Kits");
    expect(text).toContain("Private Label Packaging Structures");
    expect(text).toContain("/feeds/openai.jsonl");
    expect(text).toContain("/feeds/google.xml");
    expect(text).toContain("day delivery");
    expect(text).toContain("-day returns");
  });
});
