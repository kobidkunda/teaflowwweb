# Measurement, Analytics & Tracking Plan — Himalayan Tea House

**Version:** 2026-10-11  
**Framework:** Privacy-First GA4 Measurement + Search Console + IndexNow  
**Data Governance:** Zero-PII Leakage Policy · India DPDP Act & GDPR Compliant

---

## 1. Analytics Architecture Overview

The tracking infrastructure (`src/lib/seo/tracking.ts`) balances granular e-commerce conversion insights with strict customer privacy:

1. **Client-Side DataLayer:** Standardized Google Analytics 4 (GA4) e-commerce schema pushes events to `window.dataLayer`.
2. **Server-Side Verification:** High-value conversions (`purchase`) are reconciled against confirmed server-side payment webhook events (`/api/payments/webhook`) to eliminate duplicate or fraudulent client tracking.
3. **Zero PII Leakage:** Customer names, street addresses, phone numbers, email addresses, and credit card credentials are systematically stripped before event payload transmission.

---

## 2. GA4 E-Commerce Conversion Funnel Events

| Event Name | Trigger Point | Payload Parameters | Privacy Fence |
| :--- | :--- | :--- | :--- |
| **`view_item`** | Product detail page (`/tea/[slug]`) mount | `currency: "INR"`, `value`, `items: [{ item_id: SKU, item_name, item_category, price }]` | No user identifiers |
| **`add_to_cart`** | User clicks "Add to Cart" button in buy box | `currency: "INR"`, `value`, `items: [{ item_id: SKU, item_name, price, quantity }]` | No user identifiers |
| **`begin_checkout`** | Customer navigates from cart to `/checkout` | `currency: "INR"`, `value: subtotal`, `items: [TrackingItem[]]` | No user identifiers |
| **`purchase`** | Order confirmation page (`/order/[id]`) after verified payment | `transaction_id: order_id`, `currency: "INR"`, `value: total`, `tax`, `shipping`, `items: [TrackingItem[]]` | Customer address & name strictly excluded |

### Sample Payload: `view_item`
```javascript
window.dataLayer.push({ ecommerce: null });
window.dataLayer.push({
  event: "view_item",
  ecommerce: {
    currency: "INR",
    value: 950.00,
    items: [
      {
        item_id: "DJ-SP-100G",
        item_name: "Darjeeling Spring Clonal First Flush — Luxury Tin (100g)",
        item_category: "Black Tea",
        price: 950.00,
        quantity: 1
      }
    ]
  }
});
```

---

## 3. Search Engine Measurement & IndexNow Integration

### 1. Google Search Console (GSC)
* **Domain Property:** `sc-domain:himalayantea.com`
* **Reports Monitored:**
  * **Search Performance:** Clicks, impressions, CTR, average position by query and URL.
  * **AI Overviews & Search Generative Experience (SGE):** Tracking impressions and citation referrals from Google AI features.
  * **Page Indexing & Sitemaps:** Monitored weekly; zero indexation errors or accidental exclusions.
  * **Merchant Listings:** Validating Product rich snippets, Offer prices, and return policy compliance.

### 2. Bing Webmaster Tools & IndexNow
* **IndexNow Endpoint:** `src/lib/seo/indexnow.ts`
* **Submission Trigger:** Catalog updates (new product additions, flush price changes, new brewing guides) submit URLs instantly via API to `https://api.indexnow.org/indexnow` for immediate Bing/Yandex crawling.

---

## 4. User Consent & Cookie Handling

* **Essential Cookies Only:** Session cookies (`cart_session`, `admin_session`) are strictly functional and required for shopping security.
* **Tracking Disclosures:** Outlined clearly in the public `/privacy` policy page with direct opt-out provisions.
