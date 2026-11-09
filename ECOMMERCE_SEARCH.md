# E-Commerce Search & Feed Synchronization Specification — Himalayan Tea House

**Version:** 2026-10-11  
**Catalog Currency:** INR (Indian Rupee, ₹)  
**Tax Treatment:** Inclusive of 5% Goods and Services Tax (GST)  
**Standard Shipping:** Flat ₹99.00 (Free for orders ≥ ₹1,500.00)  
**Merchant Endpoints:**
* Google Merchant XML Feed: `https://himalayantea.com/feeds/google.xml` & `/api/feeds/google-merchant`
* Meta Catalog Feed: `https://himalayantea.com/api/feeds/meta`
* CSV Catalog Export: `https://himalayantea.com/feeds/catalog.csv`

---

## 1. Single Source of Truth Architecture

Price and inventory synchronization across search engines, shopping feeds, and storefront buying boxes is enforced through a strict single source of truth:

```
                  ┌──────────────────────────────┐
                  │ SQLite Database              │
                  │ (data/store.sqlite)          │
                  │ products & variants tables   │
                  │ (price_paise, stock, sku)    │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼────────────────────────┐
         ▼                       ▼                        ▼
┌──────────────────┐   ┌───────────────────┐    ┌──────────────────┐
│ Storefront PDP   │   │ Schema.org JSON-LD│    │ Google Merchant  │
│ HTML + Buy Box   │   │ Product + Offer   │    │ RSS/XML Feed     │
│ (price in ₹ INR) │   │ (price in ₹ INR)  │    │ (<g:price> INR)  │
└──────────────────┘   └───────────────────┘    └──────────────────┘
```

* **No Discrepancies:** Because all three layers derive price from `v.price_paise / 100` and inventory from `v.stock > 0`, Google Merchant Center automated crawlers never trigger price mismatch or out-of-sync inventory suspensions.

---

## 2. Product Variant Policy & Item Grouping

Each tea product represents an agricultural harvest batch containing multiple packaging formats and weights:

* **`g:item_group_id`:** Mapped to the product slug (e.g. `darjeeling-spring`, `assam-golden-breakfast`). Groups variants into a single cohesive product card on Google Shopping.
* **`g:id` (Unique SKU):** Formatted systematically as `[ESTATE_CODE]-[FLUSH]-[GRAMS]G` (e.g., `DJ-SP-100G`, `AGB-100G-TIN`).
* **Attributes per Variant:**
  * `g:title`: `[Product Name] — [Packaging Format] ([Grams]g)`
  * `g:description`: Cleaned plain-text description free of HTML entities or promotional fluff.
  * `g:link`: Canonical PDP URL with variant query: `https://himalayantea.com/tea/[slug]?sku=[SKU]`
  * `g:image_link`: Absolute HTTPS URL of the primary image.
  * `g:availability`: `in_stock` (if `stock > 0`) or `out_of_stock`.
  * `g:price`: `[Price].00 INR`
  * `g:brand`: `Himalayan Tea House`
  * `g:condition`: `new`
  * `g:google_product_category`: `Food, Beverages & Tobacco > Beverages > Tea & Infusions`

---

## 3. Shipping & Tax Disclosures

In accordance with Google Merchant Center requirements for Indian e-commerce merchants:
1. **Tax Disclosures:**
   * In India, consumers pay inclusive GST. Our store displays GST-inclusive prices, and merchant feeds report exact checkout prices to avoid mismatch penalties.
2. **Shipping Rules in Feeds:**
   * Embedded `<g:shipping>` nodes specify:
     * Country: `IN`
     * Service: `Standard Express`
     * Price: `99.00 INR` (or `0.00 INR` for orders meeting free threshold)
   * Transit time: 2–5 business days via Blue Dart / Delhivery.

---

## 4. Discontinued, Out-of-Stock & Seasonal Flush Policy

Because specialty teas are harvested seasonally, lot availability fluctuates naturally:

1. **Temporary Out-of-Stock:**
   * When `stock == 0`, the product URL **remains live with HTTP 200**.
   * The variant Offer availability changes to `https://schema.org/OutOfStock`.
   * Feed availability changes to `out_of_stock`.
   * The visible buy box displays "Harvest Batch Sold Out" with an email notification waitlist.
2. **Permanent Retirement (Discontinued Past Year Crop):**
   * Archived lots without planned re-harvest are maintained with historical tasting notes and a prominent banner directing visitors to the current year's seasonal equivalent.
   * If a URL is retired entirely, a permanent 301 redirect is instituted pointing to the relevant category hub.
