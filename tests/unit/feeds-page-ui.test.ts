import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FeedsPage from "@/app/feeds/page";
import { FeedsClient } from "@/components/feeds/FeedsClient";
import { Footer } from "@/components/Footer";
import type { FeedItem } from "@/lib/feeds";

const mockSampleItems: FeedItem[] = [
  {
    id: "HTH-DARJ-FTGFOP-100G",
    itemGroupId: "makaibari-summer-solstice-muscatel",
    title: "Makaibari Summer Solstice Muscatel — Loose Leaf Pouch (100g)",
    description: "Finest Second Flush Darjeeling tea with distinct muscatel notes.",
    link: "https://himalayantea.com/tea/makaibari-summer-solstice-muscatel?sku=HTH-DARJ-FTGFOP-100G",
    imageLink: "https://himalayantea.com/images/tea-tin.svg",
    availability: "in_stock",
    price: "850.00 INR",
    brand: "Himalayan Tea House",
    condition: "new",
    googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
    productType: "Tea > Black Tea",
    packagingFormat: "loose_leaf_pouch",
    sizeGrams: 100,
    stock: 25,
  },
  {
    id: "HTH-ASSAM-GOLD-50G",
    itemGroupId: "assam-golden-tips-tippy-orthodox",
    title: "Assam Golden Tips — Luxury Tin (50g)",
    description: "Rich malty single-estate Assam tea with abundant golden tips.",
    link: "https://himalayantea.com/tea/assam-golden-tips-tippy-orthodox?sku=HTH-ASSAM-GOLD-50G",
    imageLink: "https://himalayantea.com/images/tea-tin.svg",
    availability: "out_of_stock",
    price: "1200.00 INR",
    brand: "Himalayan Tea House",
    condition: "new",
    googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
    productType: "Tea > Black Tea",
    packagingFormat: "luxury_tin",
    sizeGrams: 50,
    stock: 0,
  },
];

describe("Dedicated Feeds Page & UI Components", () => {
  it("renders FeedsPage server component without error", () => {
    const markup = renderToStaticMarkup(React.createElement(FeedsPage));
    expect(markup).toContain("Product Feeds");
    expect(markup).toContain("Google Merchant Center");
    expect(markup).toContain("Meta Product Catalog");
    expect(markup).toContain("OpenAI Commerce Feed");
    expect(markup).toContain("/feeds/google.xml");
    expect(markup).toContain("/feeds/catalog.csv");
    expect(markup).toContain("/feeds/openai.jsonl");
  });

  it("renders FeedsClient with channels, metrics, and actions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(FeedsClient, {
        items: mockSampleItems,
        isTokenProtected: false,
      })
    );

    // Channel 1: Google Merchant Center
    expect(markup).toContain("Google Merchant Center");
    expect(markup).toContain("RSS 2.0 XML with Google Namespace");
    expect(markup).toContain("/feeds/google.xml");
    expect(markup).toContain("Download XML");
    expect(markup).toContain("Copy Live URL");

    // Channel 2: Meta Catalog
    expect(markup).toContain("Meta Product Catalog");
    expect(markup).toContain("RFC 4180 CSV Spreadsheet");
    expect(markup).toContain("/feeds/catalog.csv");
    expect(markup).toContain("Download CSV");

    // Channel 3: OpenAI Commerce
    expect(markup).toContain("OpenAI Commerce Feed");
    expect(markup).toContain("UTF-8 JSONL / JSONL.GZ");
    expect(markup).toContain("/feeds/openai.jsonl");
    expect(markup).toContain("Download JSONL");

    // Metric summary
    expect(markup).toContain("Total SKUs / Variants");
    expect(markup).toContain("In Stock");
    expect(markup).toContain("Out of Stock");
    expect(markup).toContain("Public Access");

    // Sample data rows
    expect(markup).toContain("HTH-DARJ-FTGFOP-100G");
    expect(markup).toContain("Makaibari Summer Solstice Muscatel");
    expect(markup).toContain("850.00 INR");
    expect(markup).toContain("in_stock");
    expect(markup).toContain("HTH-ASSAM-GOLD-50G");
    expect(markup).toContain("out_of_stock");

    // Setup guides
    expect(markup).toContain("Google Merchant Center Setup");
    expect(markup).toContain("Meta Commerce Manager Setup");
    expect(markup).toContain("Scheduled fetch");
  });

  it("renders token protected indicator when isTokenProtected is true", () => {
    const markup = renderToStaticMarkup(
      React.createElement(FeedsClient, {
        items: mockSampleItems,
        isTokenProtected: true,
      })
    );

    expect(markup).toContain("Token Protected");
    expect(markup).toContain("FEED_ACCESS_TOKEN active");
  });

  it("renders Product Feeds link in the site Footer", () => {
    const markup = renderToStaticMarkup(React.createElement(Footer));
    expect(markup).toContain('href="/feeds"');
    expect(markup).toContain("Product Feeds");
  });

  it("verifies Admin navigation config includes Product Feeds link", async () => {
    const { NAV_GROUPS, getBreadcrumbs } = await import("@/components/admin/layout/navConfig");
    const catalogGroup = NAV_GROUPS.find((g) => g.id === "catalog");
    expect(catalogGroup).toBeDefined();

    const feedsItem = catalogGroup?.items.find((item) => item.href === "/admin/feeds");
    expect(feedsItem).toBeDefined();
    expect(feedsItem?.label).toBe("Product Feeds");

    const crumbs = getBreadcrumbs("/admin/feeds");
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0].label).toBe("Admin");
    expect(crumbs[1].label).toBe("Storefront & Catalog");
    expect(crumbs[2].label).toBe("Product Feeds");
    expect(crumbs[2].current).toBe(true);
  });

  it("renders AdminFeedsClient component with metrics, copy actions, and catalog table", async () => {
    const { AdminFeedsClient } = await import("@/components/admin/feeds/AdminFeedsClient");
    const mockAdminItems = [
      {
        id: "darjeeling-ff-tin-100g",
        itemGroupId: "darjeeling-ff",
        title: "Darjeeling First Flush — Tin (100g)",
        description: "Fresh springtime harvest.",
        link: "https://himalayantea.com/tea/darjeeling-ff",
        imageLink: "https://himalayantea.com/images/tea-tin.svg",
        availability: "in_stock" as const,
        price: "749.00 INR",
        brand: "Himalayan Tea House",
        condition: "new" as const,
        googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
        productType: "Tea > Black Tea",
        packagingFormat: "luxury_tin",
        sizeGrams: 100,
        stock: 14,
      },
    ];

    const markup = renderToStaticMarkup(
      React.createElement(AdminFeedsClient, {
        initialItems: mockAdminItems,
        isTokenProtected: true,
        configuredToken: "secret123",
        baseUrl: "https://himalayantea.com",
      })
    );

    expect(markup).toContain("Product Feeds &amp; Syndication");
    expect(markup).toContain("Google Merchant Center");
    expect(markup).toContain("Meta Product Catalog");
    expect(markup).toContain("OpenAI Commerce");
    expect(markup).toContain("https://himalayantea.com/feeds/google.xml?token=secret123");
    expect(markup).toContain("https://himalayantea.com/feeds/catalog.csv?token=secret123");
    expect(markup).toContain("https://himalayantea.com/feeds/openai.jsonl?token=secret123");
    expect(markup).toContain("darjeeling-ff-tin-100g");
    expect(markup).toContain("luxury_tin");
    expect(markup).toContain("749.00 INR");
    expect(markup).toContain("Token Protected");
  });
});

