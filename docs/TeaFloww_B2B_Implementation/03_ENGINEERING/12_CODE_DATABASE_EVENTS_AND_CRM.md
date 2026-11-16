# Copyable Code — Database Schema, Consent-Aware Events & CRM Lifecycle

## 1. `prisma/schema.prisma` — first-party lead data model

> Adjust to existing ORM/schema if the live TeaFloww app already has enquiries, private-label quotes and customer records. Do **not** create an orphan duplicate lead table without reconciliation.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model BusinessLead {
  id                 String   @id @default(cuid())
  reference          String   @unique @default(cuid())
  idempotencyKey     String   @unique
  requestFingerprint String?
  segment            String
  interest           String
  quantityBand       String
  pincode            String
  name               String
  phone              String
  status             String   @default("new")
  qualificationReason String?
  ownerId            String?
  contactConsentAt   DateTime
  marketingConsentAt DateTime?
  utmSource          String?
  utmMedium          String?
  utmCampaign        String?
  utmContent         String?
  utmTerm            String?
  gclid              String?
  gbraid             String?
  wbraid             String?
  fbclid             String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  firstContactAt     DateTime?
  qualifiedAt        DateTime?
  quotedAt           DateTime?
  wonAt              DateTime?
  lostAt             DateTime?
  quotedAmountPaise  Int?
  firstOrderId       String?
  deletionRequestedAt DateTime?
  events             BusinessLeadEvent[]

  @@index([createdAt])
  @@index([segment, status])
  @@index([utmCampaign, createdAt])
}

model BusinessLeadEvent {
  id          String   @id @default(cuid())
  leadId      String
  lead        BusinessLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type        String
  actorId     String?
  metadata    Json?
  eventTime   DateTime @default(now())
  externalKey String?  @unique

  @@index([leadId, eventTime])
}

model IntegrationOutbox {
  id          String   @id @default(cuid())
  topic       String
  aggregateId String
  payload     Json
  attempt     Int      @default(0)
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  processedAt DateTime?
  dedupeKey   String   @unique

  @@index([status, createdAt])
}
```

**Protect PII:** phone/name/pincode are internal CRM data, not dataLayer fields. Lock down access and retention. Encrypt at rest (cloud-managed), restrict export, audit administrator reads/exports and run deletion workflow as applicable.

## 2. Strict lifecycle state machine

```text
new
 ├── contact_attempted
 │    ├── qualified
 │    │    ├── quote_sent
 │    │    │    ├── won              → first paid B2B order verified
 │    │    │    └── lost
 │    │    └── lost
 │    └── disqualified
 └── disqualified
```

Valid reasons for disqualification (internal taxonomy): `no_buying_intent`, `unserviceable_destination`, `below_confirmed_moq`, `wrong_product`, `invalid_contact`, `duplicate_existing`, `not_ready`. Quote stage includes quote currency/line items and freight terms. Winning requires a **verified paid order**—not promise-to-pay, not open COD booking.

## 3. `src/lib/business/events.ts` — no raw PII in browser events

```ts
export type BusinessEvent =
  | 'business_page_view'
  | 'business_quote_start'
  | 'business_quote_submit'
  | 'business_whatsapp_click'
  | 'qualified_business_lead'
  | 'business_quote_sent'
  | 'first_b2b_paid_order';

type SafeProperties = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    __tfAnalyticsConsent?: boolean;
  }
}

export function trackBusinessEvent(event: BusinessEvent, properties: SafeProperties = {}) {
  if (typeof window === 'undefined' || window.__tfAnalyticsConsent !== true) return;
  // Never pass phone, name, pincode, email, exact personal message or raw form fields.
  window.dataLayer ??= [];
  window.dataLayer.push({ event, ...properties });
}
```

This is an example **consent-manager integration point**, not a complete CMP. The live app must set `__tfAnalyticsConsent` consistently with current consent policy, and GTM must enforce consent at the tag level. Some first-party operational events are stored **server-side** as business records regardless of marketing-consent choice where legally justified; that does not authorize forwarding them to ad platforms.

## 4. `src/lib/business/whatsapp.ts` — safe messaging deep link

```ts
import type { OfferId, Segment } from './content';

export function buildWhatsAppLink(
  e164WithoutPlus: string | undefined,
  details: { segment: Segment; interest: OfferId | 'unsure'; reference?: string },
): string | null {
  if (!e164WithoutPlus || !/^\d{10,15}$/.test(e164WithoutPlus)) return null;
  const stage = details.segment === 'starter' ? 'new tea business' : 'existing tea trader';
  const message = [
    'Hello TeaFloww, I would like to discuss a business quotation.',
    `I am a ${stage}.`,
    `Interest: ${details.interest.replaceAll('_', ' ')}.`,
    details.reference ? `Reference: ${details.reference}.` : '',
    'Please share MOQ, sample and freight details.',
  ].filter(Boolean).join('\n');
  return `https://wa.me/${e164WithoutPlus}?text=${encodeURIComponent(message)}`;
}
```

**Do not put the customer's phone, pincode, exact name or quote amount into a marketing URL**. When logging chat clicks, record only the event and lead reference (if available), not actual WhatsApp message content. A click is not a delivered chat or replied conversation.

## 5. CRM outbox pattern — accurate integration, safe retries

The route handler in `11_CODE_LEAD_FORM_AND_API.md` only creates a lead. In production, create lead **and outbox job in one transaction**; then process jobs with a durable worker. Never send a webhook before the lead commit or report success based only on a webhook response.

### `src/lib/business/lead-service.ts` (transaction pattern)

```ts
import { prisma } from '@/lib/prisma';
import type { BusinessLeadInput } from './schema';

export async function saveLeadWithOutbox(
  input: BusinessLeadInput,
  idempotencyKey: string,
  fingerprint: string,
) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.businessLead.create({ data: {
      idempotencyKey,
      requestFingerprint: fingerprint,
      segment: input.segment,
      interest: input.interest,
      quantityBand: input.quantityBand,
      pincode: input.pincode,
      name: input.name,
      phone: input.phone,
      contactConsentAt: new Date(),
      marketingConsentAt: input.marketingConsent ? new Date() : null,
      utmSource: input.attribution.utm_source,
      utmMedium: input.attribution.utm_medium,
      utmCampaign: input.attribution.utm_campaign,
      utmContent: input.attribution.utm_content,
      utmTerm: input.attribution.utm_term,
      gclid: input.attribution.gclid,
      gbraid: input.attribution.gbraid,
      wbraid: input.attribution.wbraid,
      fbclid: input.attribution.fbclid,
    } });
    await tx.integrationOutbox.create({ data: {
      topic: 'crm.business_lead.created',
      aggregateId: saved.id,
      dedupeKey: `crm:created:${saved.id}`,
      payload: { leadId: saved.id }, // Avoid putting raw PII in queue payload.
    } });
    return saved;
  });
}
```

Integrate this service into the route handler instead of its direct `.create` when deployment worker is ready. Compute SHA-256 fingerprint from normalized, non-honeypot `BusinessLeadInput` and reject changed payload reuse of the same idempotency key with HTTP 409. The idempotency key must be UUID generated per intended submission, never per retry.

### Worker logic (pseudocode)

```text
for each pending outbox task with lease/row lock:
  load restricted lead record by ID
  validate destination/CRM permission
  upsert CRM lead using stable CRM_external_id = BusinessLead.id
  mark task done; set delivery receipt
on temporary error:
  exponentially retry with jitter, max retries, alert after terminal threshold
on permanent schema or 4xx error:
  dead-letter and alert sales+engineering
Never emit multiple `qualified_business_lead` conversions from retries.
```

## 6. Authorized conversion reporting

At a minimum, record first-party stages in DB. To feed platforms, implement separate consent-compliant integrations:

- Google Ads: enhanced conversions for leads via **Data Manager** after `qualified`/`won`, with current product settings, and appropriate handling of click IDs/user-provided information.
- Meta: CAPI for approved leads with unique event ID matching any browser Pixel event to avoid duplicate counts. Never send unapproved private lead notes.
- Business reports: one CRM lead table joined to ad source fields, quoted amounts and first paid orders; de-dupe by original lead ID.

**Do not** set `Purchase` on a tea business quote submit. Separate B2C purchases from first B2B paid order in campaign goals.

## 7. Attribution naming standards

`utm_source=facebook|instagram|google`, `utm_medium=paid_social|cpc|video`, `utm_campaign=tfw_b2b_tea_business_<segment>_<date>`, `utm_content=<concept>_<format>_<version>`, `utm_term=<keyword_or_audience>`. Every event includes `segment`, `offer_id`, `campaign_id` where non-PII and verified. Use case sensitivity consistently in ETL.

## 8. Operational dashboard fields

Lead reference, date, first source, campaign, ad variant, route, stage, offer, intended kg band, pincode/region, lead owner, contact SLA, qualified reason, quote sent, quote amount, first paid order, contribution estimate, RTO/cancellation adjustments. Implement access control so ads analysts do not see unnecessary phone numbers.
