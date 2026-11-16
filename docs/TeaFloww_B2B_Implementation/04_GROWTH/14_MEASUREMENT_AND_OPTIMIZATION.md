# Full-Funnel Measurement, Attribution & Lowest **Qualified** Lead Cost

## Why website interactions are not conversions

TeaFloww's reviewed baseline had only three GA4 `generate_lead` events across the site for 18 Oct–16 Nov 2026 and little distinct business-specific traffic. There is no statistically defensible existing B2B CPQL benchmark. Meta click and landing-page counts may differ due to user behavior **or** measurement configuration. Therefore, establish trustworthy first-party facts before auto-optimizing media.

## Required funnel and business logic

```text
impression → ad click → landing viewed → form started
  → form submitted → phone/intent qualified → quotation sent
  → sample/approval (optional) → paid first B2B order
  → repeat order / realized contribution
```

| Event | Trigger | Source of truth | Metric use | Deduplication |
|---|---|---|---|---|
| `business_page_view` | Consent-compliant page impression | Client analytics | Page performance | Standard analytics session |
| `business_quote_start` | First meaningful form interaction | Client analytics | Form friction | Session/page |
| `business_quote_submit` | Valid API-created new lead | Backend + analytics | Intake, not quality | Unique lead ID |
| `business_whatsapp_click` | Clicked outbound chat link | Client | Diagnostic only | Click event only |
| `qualified_business_lead` | Sales checks intent, contact, volume and destination | CRM | Primary quality KPI | `lead_id:qualified` |
| `business_quote_sent` | Quote recorded with monetary terms | CRM | Conversion progress | `lead_id:quote:<version>` |
| `first_b2b_paid_order` | Payment settled and order linked | Store/orders + CRM | North-star acquisition | Unique order ID |

### Qualified means a person, not a click

Minimum: valid contact attempt; genuine intent to sell/trade tea; product need compatible with TeaFloww's current supply; approved shipping area; credible quantity/next-action path. *Uncertain MOQ is a reason to quote or clarify, not necessarily auto-reject.* Sales must mark why a lead is unqualified. Require one lead-level row per submitted form; no duplicate paid conversions after page refresh.

## Core equations

```text
CPQL = Total B2B campaign spend / distinct qualified B2B leads
Lead-to-quote rate = quoted leads / qualified leads
Quote-to-first-order rate = paid first-order leads / quoted leads
CAC = B2B campaign spend / distinct first-time paid B2B customers
Net first-order contribution = received revenue net of taxes/discounts
                              - product cost - packaging - freight
                              - payment fees - variable fulfilment
                              - expected cancellation/RTO loss
Break-even CPQL = net first-order contribution × qualified-to-paid rate
```

**Illustration, not a forecast:** if first-order contribution is ₹1,500 and 10% of *qualified* leads buy, break-even CPQL is ₹150 before overhead/risk. Actual target should come from paid-order economics, not an assumed platform CPM/CPC.

## GA4 setup

- Create a B2B-specific custom event schema with the above event names; avoid mapping generic B2C `purchase` to business quote submit.
- Use business `segment`, `offer_id`, `route`, `creative_variant`, `quantity_band` only when not personal; avoid sending exact pincode, name, phone, WhatsApp text, email, lead notes or full URL carrying personal values.
- Instrument only with consent manager and proper tag firing conditions; test before and after consent decisions.
- Confirm `form_submit`/`generate_lead` are not fired twice by app and GTM on the same successful submission.
- Preserve GA4 diagnostics independently from CRM's definitive sales record.

## Meta and Google feedback loop

**Meta:** where supported, configure approved leads conversion objective, connect Pixel/CAPI and use a stable event identifier for browser/server duplicates. Track qualified stage only with lawful basis, appropriate integration and match data handling.

**Google Ads:** create B2B lead goal; use enhanced conversions for leads or supported offline uploads after qualification; keep consumer Purchase separate. Respect data consent and advertising data restrictions. Do not assume GCLID alone guarantees attributed conversions. Review Data Manager settings, conversion action ownership, click window, latency and diagnostics.

**Consent Mode v2:** Google consent parameters include `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`. Default/update sequencing must be implemented by the actual consent solution. Link: https://developers.google.com/tag-platform/security/guides/consent

## Source capture and UTM standard

```text
utm_source    facebook | instagram | google
utm_medium    paid_social | cpc | video
utm_campaign  tfw_b2b_<segment>_<objective>_<YYYYMM>
utm_content   <angle>_<creative_version>_<format>
utm_term      <keyword> or <audience>
```

Store `gclid`, `gbraid`, `wbraid`, `fbclid` **only under configured retention/consent policy**. Record a first-touch and recent-touch campaign snapshot only if disclosure/legal basis supports it. For cross-route navigation use allowlisted attribution; never put contact fields into URLs.

## Example analytics record (no PII)

```json
{
  "event": "business_quote_submit",
  "event_id": "server-generated-unique-event-id",
  "segment": "trader",
  "offer_id": "bulk_supply",
  "quantity_band": "100-249",
  "route": "/tea-traders",
  "creative_variant": "TRADE-A",
  "consent_applied": true
}
```

The example event ID is conceptual; generate a real ID server-side, then propagate through a controlled event queue.

## Reporting model, queries and dashboard

Daily dashboard: spend, impressions, qualified leads, quoted leads, first paid orders, CPQL, quote rate, CAC, first-order contribution and lead ageing by segment/source/creative/region. Join ads data to first-party CRM using *stored campaign identifiers and timestamps*, not fuzzy matching by name.

```sql
-- Illustrative PostgreSQL CRM query, adapt to production column names.
WITH cohorts AS (
 SELECT date_trunc('day', "createdAt")::date AS day,
        "utmSource" AS source,
        segment,
        count(*) AS leads,
        count(*) FILTER (WHERE "qualifiedAt" IS NOT NULL) AS qualified,
        count(*) FILTER (WHERE "quotedAt" IS NOT NULL) AS quoted,
        count(*) FILTER (WHERE "wonAt" IS NOT NULL) AS won
 FROM "BusinessLead"
 WHERE "createdAt" >= current_date - interval '30 days'
 GROUP BY 1,2,3
)
SELECT * FROM cohorts ORDER BY day DESC, source, segment;
```

This query returns lead cohorts, **not** ad cost or attributed CPQL. Join platform spend in an ETL table with tested attribution windows and data type normalization, then calculate CPQL with an explicit denominator. Don't combine Meta and Google conversion counts without cross-platform deduplication.

## Sales response operations

- Assign new lead, timestamp first contact, attempt calls or chat per consent and working hours.
- Capture quote number, grade and pack configuration, sample costs, tax, freight, payment terms, validity, marketing/design scope and expected order date.
- When lead is lost, record reason including out-of-area, below MOQ, quote price, poor fit, competitor, no response, timing.
- Feed aggregate learnings to creative and keyword review; do not publish customer details.

## Optimization cadence without pretending certainty

| Check | Starting cadence | Action |
|---|---|---|
| Broken URL, missing form, missing server event | At every deploy and daily after launch | Pause affected ads; repair source |
| Search terms and negative keywords | Twice weekly initially | Remove demonstrably irrelevant intent |
| Quality reasons and contactability | Twice weekly | Adjust form/copy for lead quality |
| Hook/landing engagement and basic delivery | Weekly | Diagnose, not declare winner |
| CPQL, CAC and real sales contribution | As conversion volume supports | Compare cohorts, control test changes |

### Example instrumentation event sequence for one lead

```text
Page view (0/1)  -> form_start (0/1) -> form_submit (once)
CRM record: new  -> contact_attempted -> qualified -> quote_sent -> won
                                            |          |            |
                                        Meta/Google approved stage uploads
```

**Safeguard:** website form fires only a submit event; only CRM knows whether sales qualified the inquiry. Reconciliation job should report dropped uploads and duplicates rather than silently retrying forever.
