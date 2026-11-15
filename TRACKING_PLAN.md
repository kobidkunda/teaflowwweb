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
* **First-Party Attribution Storage (`tf_attr`, `tf_sid`, `tf_attribution_v1`):** Captures UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`), ad click IDs (`gclid`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `msclkid`), referrer, and landing page into TeaFloww's first-party database (`visitor_sessions`, `funnel_events`, `funnel_conversations`, `entity_attributions`).
* **Consent-Gated Third-Party Pixels & Server CAPI:** External pixels (`gtag`, `fbq`, GTM) and server-side Meta Conversions API (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`, `Contact`, `Purchase`) remain strictly gated on explicit cookie consent (`CONSENT_KEY` / `marketingConsent`).
* **Tracking Disclosures:** Outlined clearly in the public `/privacy` policy page with direct opt-out provisions.

---

## 5. Unified First-Party Funnel, Attribution & Remarketing Architecture

### Captured Touchpoints & Entities
1. **Storefront & Landing Visits:** `FunnelTracker` (`src/components/analytics/FunnelTracker.tsx`) + `POST /api/funnel/track`.
2. **Product Views & Add-to-Cart:** `PDPTracker`, `CartProvider` (`add_to_cart`), `/api/cart/sync`.
3. **Leads, Forms & Inquiries:** `LeadCaptureModal` (`captured_leads`), `/api/contact` (`contact_inquiries`), `/api/wholesale` (`wholesale_inquiries`), `/api/newsletter` (`newsletter_subscriptions`), `/api/blend-lab/projects`, `/api/brochure/download`, `/api/v1/private-label/*` (projects, quotes, samples, checkout), `/api/subscriptions/enroll`.
4. **Conversations:** Delegated WhatsApp (`wa.me` / `whatsapp.com`) & `tel:` link clicks across storefront/checkout/wholesale, plus contact & wholesale form threads and `/admin/responses` replies & customer feedback mirrored into `funnel_conversations`.
5. **Abandoned Carts, Checkout & Orders:** `/api/cart/sync`, `/api/commerce/quote`, `/api/commerce/payment`, `/api/checkout`, Razorpay/YouPI payment webhooks, COD transitions, and bank transfer confirmation (`applyPaymentEvent`, `applyYoupiPaymentEvent`, `switchOrderToCod`, `confirmBankTransferPayment`).

### Attribution Models & Admin Intelligence
* **First-Touch & Last-Touch Models:** Preserves immutable first campaign/keyword touch alongside latest touch in `visitor_sessions` and `entity_attributions`.
* **Click-ID Normalization:** Automatically infers `google / cpc`, `meta / paid_social`, `tiktok / paid_social`, or `microsoft / cpc` when ad click IDs (`gclid`, `fbclid`, `ttclid`, `msclkid`) appear without explicit UTM parameters.
* **Admin Hub (`/admin/funnel`):** Stage-by-stage funnel visualization, First-Touch vs Last-Touch toggle, Campaign / Source-Medium / Keywords / Ad Content / Landing Page / Funnel breakdowns, live event & conversation feed, and Remarketing Audience Builder.
* **Remarketing Exports (`/api/admin/funnel/audiences`):** Generates Meta Custom Audiences (SHA-256 hashed), Google Ads Customer Match (SHA-256 hashed), and CRM Plain CSVs with formula-injection escaping and automatic paid-buyer exclusion on unconverted segments.
