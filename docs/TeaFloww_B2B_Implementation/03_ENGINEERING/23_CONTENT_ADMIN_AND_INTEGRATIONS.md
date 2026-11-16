# Admin-Led Offers, Content Models, Services & Integration Interfaces

## Core principle

Products, variant pricing, inventory and packaging availability come from TeaFloww admin. **Landing pages should not be a second price/stock database.** The user confirms a Siliguri supply business and A–Z service categories; exact service deliverables, print minimums and freight require per-offer validation. Front end displays only approved content that the merchant can actually fulfil.

## Data flow and ownership

```text
Existing TeaFloww admin / commerce
  ├── Products / variants / images -----------┐
  ├── Approved B2B offer configuration -------┤
  ├── Brand/design/marketing service scope ---┤──► Typed B2B read adapter
  ├── Approved testimonials & case photos ----┤         │
  └── Commercial terms & MOQ matrix ----------┘         ▼
                                                SSR landing page
                                                      │
                                             Business form + quote
                                                      │
                                               Lead/CRM API
                                                      ▼
                                        Sales quotation + first order
```

If these tables/entities do not currently exist, request approval for incremental admin fields rather than storing business rules as static JSX.

## Proposed admin screen set — use shared primitives

| Page | Fields | Validation | Permissions |
|---|---|---|---|
| **Offer catalog** | name, type, active, linked SKUs, eligible formats, sales contact | only current SKUs; no retired offers | product/admin |
| **MOQ & packaging matrix** | pack format, print method, min kg/units, expiry, scope | never global MOQ if method differs | sourcing/ops |
| **Service scope** | branding/design/marketing components, included vs add-on, turnaround | no guarantee without contract | owner/marketing |
| **Proof/media** | owned photos, usage rights, alt text, approval, claim mapping | reject unapproved image | editor/legal |
| **Rate card** | geography, valid period, freight policy, currency, tax mode | explicit dates and rule version | finance/ops |
| **Inbound B2B leads** | source, stage, buyer type, product need, assigned owner | stage transitions + audit log | sales |
| **Quotes and orders** | quote line items, taxes, freight, payment, linked order | no fake guaranteed price before quote | sales/finance |
| **Campaign content** | headlines, subheads, variant status, claim proof | never publish unapproved line | marketing/owner |

Do not grant advertising users direct access to all personal contact information. Export requires authorized role and audit trail.

## Type definitions: `src/lib/business/offers.ts`

```ts
export type OfferCode = 'bulk_supply' | 'ready_retail' | 'private_label';

export type TradeOffer = {
  id: string;
  code: OfferCode;
  title: string;
  description: string;
  skuIds: string[];
  active: boolean;
  approvedAt: string | null;
  proofAssetIds: string[];
  moqText?: string;           // Show only if signed off for this offer
  pricingMode: 'request_quote' | 'approved_display_price';
  serviceScope?: string[];    // E.g. "artwork planning" only if confirmed
};

export type OfferResponse = {
  offers: TradeOffer[];
  lastVerifiedAt: string;
};

export function publicOffers(raw: OfferResponse): TradeOffer[] {
  return raw.offers.filter((offer) => offer.active && offer.approvedAt !== null);
}
```

This type represents an **integration boundary**, not an assertion that TeaFloww already exposes this API. The real adapter should map actual admin SKU variant IDs into `skuIds`, and only `approved_display_price` may show visible prices.

## Source adapter example — `src/lib/business/offer-adapter.ts`

```ts
import type { TradeOffer } from './offers';

// Caller passes an already-authenticated, permission-checked admin response.
// Do not expose admin API tokens in client components.
export function mapApprovedOffers(input: {
  offers: Array<{
    id: string;
    code: 'bulk_supply' | 'ready_retail' | 'private_label';
    title: string;
    summary: string;
    skuIds: string[];
    enabled: boolean;
    approvedAt: string | null;
    proofAssetIds: string[];
    moqText?: string;
  }>;
}): TradeOffer[] {
  return input.offers
    .filter((item) => item.enabled && Boolean(item.approvedAt))
    .map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      description: item.summary,
      skuIds: item.skuIds,
      active: item.enabled,
      approvedAt: item.approvedAt,
      proofAssetIds: item.proofAssetIds,
      ...(item.moqText ? { moqText: item.moqText } : {}),
      pricingMode: 'request_quote' as const,
    }));
}
```

## Claims content model

```ts
export type ApprovedClaim = {
  claimKey: string;
  exactCopy: string;
  evidenceUrlOrInternalId: string;
  evidenceOwner: string;
  allowedChannels: Array<'web' | 'meta' | 'google' | 'sales'>;
  approvedAt: string;
  validUntil: string | null;
  markets: string[];
  formatScope: string[];
};

// Render by claimKey only after approval+date+channel+scope checks.
// If an approved statement expires, fall back to neutral inquiry copy.
```

### Editorial approval example

```text
Draft offer → Sourcing validation → Finance/Legal review → Owner approval
    → Scheduled publish → Live → Expiry review → Revision / Unpublish
```

The advertiser's “A–Z solution” can describe **tea sourcing, design, packaging and marketing support**, but do not promise professional legal sign-off, distribution, free creative production, minimum order, guaranteed profitability or paid marketing management unless written inclusions are confirmed.

## Quote and logistics integration

- Collect pincode/region to obtain *possible route*; shipping must be priced with actual product weight, volumetric weight, postcode, freight slab, GST and COD/RTO flags.
- Source first-order quantities from current product options and service-dependent MOQ matrix.
- Quote ID should include immutable price-breakdown snapshot, freight method, fulfillment terms and expiry; price should not silently change from lead page or dynamic SKU updates.
- Support separate **bulk 25kg** pack from **branded 25kg private-label** production quantity: the presence of one does not imply the other is possible at same minimum.

## Required admin API contracts (proposal)

```text
GET   /api/business/offers                 public; approved only, cacheable
GET   /api/business/proof                  public; approved only
POST  /api/business-leads                  public; validated, rate-limited
GET   /api/admin/business-leads            authenticated sales
PATCH /api/admin/business-leads/:id        authenticated stage transition
POST  /api/admin/business-quotes           authenticated, quote versioned
GET   /api/admin/business-offers           authenticated ops/editor
PATCH /api/admin/business-offers/:id       approved role only
```

These endpoints are **proposed**. Prefer to integrate with actual existing API paths and admin tools; never expose `/api/admin` endpoints without authentication and authorization.

## Migration acceptance

Existing orders and leads remain intact; new stage values reconcile to current CRM; switching promo offer off does not delete historic quotes; admin inventory remains canonical; global nav continues to show consumer products. Sales must see campaign source and stage without downloading all raw customer details.
