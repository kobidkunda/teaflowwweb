# Technical Architecture, Code Structure & System Boundaries

## Architecture choice

**Reference implementation:** React + TypeScript + Next.js App Router + Tailwind CSS v4 theme tokens + PostgreSQL/Prisma + typed API route. This is a reference, **not an assertion TeaFloww currently runs Next.js or Prisma**. Before implementation, inspect existing `teafloww.com` application repositories, deployment setup, auth, content/SKU API, lead inquiry storage and CRM tooling. Reuse existing infrastructure if possible.

Use the frontend module on the existing site; do not create an isolated marketing microsite with different navigation and analytics unless the main app cannot support safe changes.

## Reference repository tree (actual file paths for code fences)

```text
teafloww/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                           # Existing site shell — adapt, don't replace
│   │   ├── (business)/
│   │   │   ├── layout.tsx                       # Shared header/footer for B2B public routes
│   │   │   ├── start-tea-business/
│   │   │   │   └── page.tsx
│   │   │   └── tea-traders/
│   │   │       └── page.tsx
│   │   └── api/
│   │       └── business-leads/
│   │           └── route.ts
│   ├── components/
│   │   ├── business/
│   │   │   ├── BusinessLanding.tsx
│   │   │   ├── BusinessHero.tsx
│   │   │   ├── AudienceSwitch.tsx
│   │   │   ├── OfferGrid.tsx
│   │   │   ├── ProcessTimeline.tsx
│   │   │   ├── ProofGallery.tsx
│   │   │   ├── FaqAccordion.tsx
│   │   │   ├── BusinessLeadForm.tsx
│   │   │   └── StickyLeadBar.tsx
│   │   └── ui/
│   │       ├── Section.tsx
│   │       ├── ButtonLink.tsx
│   │       └── FormField.tsx
│   ├── lib/
│   │   ├── business/
│   │   │   ├── content.ts
│   │   │   ├── schema.ts
│   │   │   ├── events.ts
│   │   │   ├── attribution.ts
│   │   │   ├── lead-service.ts
│   │   │   └── whatsapp.ts
│   │   ├── prisma.ts
│   │   ├── crm.ts
│   │   └── quote-ops.ts
│   └── messages/
│       ├── en.json
│       └── hi.json
├── prisma/
│   └── schema.prisma
├── public/
│   └── images/business/                    # Only real, approved assets
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example                            # In production; sample described in MD here
└── package.json                            # Actual repository outside this MD archive
```

All reference code is contained as fenced blocks in the Markdown files; the ZIP deliberately contains **no TSX, CSS, SQL, image or binary files** as requested.

## Responsibilities

```text
Ad click / organic page
       │
       ▼
SSR content route (Next.js or existing site)
       │  - Approved content + lightweight images
       │  - Segment, offer, locale + safe CTA
       ▼
Client lead form
       │  - UI validation + attribution context
       ▼
POST /api/business-leads
       │  - origin/size/abuse checks
       │  - Zod validation, idempotency
       ▼
PostgreSQL lead transaction
       │
       ├──────────────► CRM sync job (retry/idempotent)
       ├──────────────► sales notification (retry/idempotent)
       └──────────────► warehouse analytics stages
                              │
                              └──────► approved conversion imports (Meta/Google)
```

## Why separate CRM from ad platforms

Ads platforms are not a source of truth for lead quality. A submission must exist and be contactable before it can be qualified. Qualify in first-party CRM, send conversion events back after policy checks, and use unique IDs to deduplicate. Never delay an end-user success state waiting on external Meta or Google API.

## Integration adapters

| Adapter | Inputs | Outputs | Rules |
|---|---|---|---|
| `StoreCatalog` | SKU/pack/availability | Real offer cards | **No** hardcoded prices if live catalog differs |
| `LeadRepository` | Validated lead | Lead ID, timestamps | DB transaction and idempotency |
| `CrmPublisher` | Lead ID and private metadata | Queued/ack/failure | Retries; do not sync raw user details to analytics |
| `SalesNotifier` | Lead reference and priority | Internal task | Retry and dedupe |
| `AttributionCapture` | UTMs/click IDs | Sanitized fields | Consent/policy-aware, whitelist only |
| `ConversionReporter` | Qualified/won lifecycle event | Reporting receipts | Authorized integration, deduped, no raw phone in client pixels |
| `QuoteOps` | Grade, volume, pincode, taxes, costs | Final landed price | Owner-operated with approved calculator, never estimated as fact |

## Package / dependency approach

- Use current installed versions compatible with the existing site; lock versions in `package-lock.json` or `pnpm-lock.yaml`, do not blindly force latest.
- Essential: React, Next.js (if adopted), Tailwind CSS, Zod, Prisma + PostgreSQL driver, icon set.
- Optional: React Hook Form, shadcn/ui, queue service/Redis, PostHog/GA4 adapter, test frameworks. Every additional library must earn its bundle size.
- Never include Google/Meta account tokens, CRM webhook secrets or database credentials in `NEXT_PUBLIC_` environment variables.

## Environment contract

```dotenv
# These are example variable NAMES; set actual values securely in deploy environment.
DATABASE_URL=<server-managed-secret>
SITE_ORIGIN=https://teafloww.com
BUSINESS_LEAD_NOTIFICATIONS_ENABLED=false
BUSINESS_CRM_WEBHOOK_URL=<server-managed-url>
BUSINESS_CRM_WEBHOOK_SECRET=<server-managed-secret>
NEXT_PUBLIC_BUSINESS_WHATSAPP_E164=<verified-public-business-number>
```

## Data ownership

Public pages can render approved service content, but pricing, quotation generation, leads, contact consent, internal sales notes and access-controlled business reporting remain on server. The existing store product API remains owner of product variants and price; the CRM remains owner of qualification. No duplicate product price lists embedded in UI code.

## Version control and release model

- Branch per ticket: `feat/b2b-business-landing`, `feat/b2b-lead-pipeline`, etc.
- Pull requests require UI preview, accessibility check, source fact checklist, performance budget and events diff.
- Feature flag `b2b_leads_enabled`, ability to keep routes published but form temporarily disabled if integrations fail.
- Environment progression `local → staging → production`, test ads with sandbox tags or paused campaigns before live spend.

## Framework adaptation if TeaFloww is NOT Next.js

Replace only transport/route wrappers: React components, CSS tokens, validation schemas, content objects, offer mapping and analytics event names remain usable. On backend adapt `POST /api/business-leads` to existing framework and its DB while preserving exact semantics, idempotency, privacy checks and lifecycle. Do not fork a separate database without a migration/ownership design.
