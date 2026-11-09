# Proposed Repository Structure — Implement in EXISTING App, Do Not Create a New Monolith

## Important
The user's actual source tree was not supplied. Paths below are **recommended boundaries**, not statements about what currently exists. If a site uses PHP, Laravel, Remix, React SPA, Next, Nuxt or another stack, map these conceptual modules to its native conventions. Do not initiate a framework rewrite simply to use these example paths.

## Reference module layout (React / Next-like pseudostructure)

```text
<EXISTING STOREFRONT ROOT>/
├── src/
│   ├── app/                           # only if current framework has file-based app router
│   │   ├── (storefront)/
│   │   │   └── page.tsx                # EXISTING HOME: insert BlendLabPromo module
│   │   ├── blend-lab/
│   │   │   ├── page.tsx                # server-rendered marketing composition
│   │   │   └── start/page.tsx          # client-enhanced intake and payment shell
│   │   ├── account/blend-lab/
│   │   │   ├── page.tsx                # owner-scoped project list
│   │   │   └── [publicId]/page.tsx     # owner-scoped project detail
│   │   └── api/blend-lab/             # only if compatible with existing API design
│   ├── components/
│   │   └── ui/                         # existing Button/Field/Modal reused FIRST
│   ├── features/
│   │   └── blend-lab/
│   │       ├── components/
│   │       │   ├── BlendLabPromo.tsx
│   │       │   ├── BlendLabHero.tsx
│   │       │   ├── ProcessSteps.tsx
│   │       │   ├── PlanCard.tsx
│   │       │   ├── PlanComparison.tsx
│   │       │   ├── ReportTeaser.tsx
│   │       │   ├── GoalsSelector.tsx
│   │       │   ├── CheckoutStepper.tsx
│   │       │   ├── ProjectTimeline.tsx
│   │       │   ├── FeedbackForm.tsx
│   │       │   └── QuoteSummary.tsx
│   │       ├── domain/
│   │       │   ├── types.ts
│   │       │   ├── plans.ts             # mirrors server-approved catalog
│   │       │   ├── money.ts             # only for UI display; server owns billing
│   │       │   ├── state-machine.ts
│   │       │   └── entitlement-policy.ts
│   │       ├── server/
│   │       │   ├── project-service.ts
│   │       │   ├── intake-validator.ts
│   │       │   ├── payment-adapter.ts
│   │       │   ├── courier-adapter.ts
│   │       │   ├── teapilot-adapter.ts
│   │       │   ├── report-storage.ts
│   │       │   ├── quotation-service.ts
│   │       │   └── customer-view-serializer.ts
│   │       ├── email/
│   │       │   ├── payment-confirmed.tsx
│   │       │   ├── sample-received.tsx
│   │       │   ├── report-ready.tsx
│   │       │   └── quotation-ready.tsx
│   │       ├── css/blend-lab.css
│   │       └── tests/
│   │           ├── plans.test.ts
│   │           ├── entitlement.test.ts
│   │           ├── payment-webhook.int.test.ts
│   │           ├── ownership.int.test.ts
│   │           ├── courier.int.test.ts
│   │           └── checkout.e2e.ts
│   └── jobs/
│       ├── courier-reconcile.job.ts
│       ├── teapilot-sync.job.ts
│       └── report-publish.job.ts
├── database/migrations/                # actual location depends on project ORM
├── content/blend-lab/                  # human-reviewed copy and FAQs
└── docs/                                # ADRs and operating playbooks
```

## Component ownership rules
1. Reuse existing site primitives first; add Blend Lab styling via token extension instead of duplicating every button.
2. `PlanCard` accepts typed plan data, never imports separate hard-coded pricing copy into each page.
3. UI components are pure display where possible; state and network operations live in feature hooks or server services.
4. Domain types must be shared across backend and frontend or generated from OpenAPI/Zod to avoid drift.
5. Server-only files are never imported into client bundles; API serializers enforce public/private fields.
6. Marketing layout and operational forms share typography, spacing and semantic primitives, not necessarily the same density.
7. Separate `private_recipe` from `customer_formula_summary`; do not use a single DTO for both.

## Code review requirements
- No new `fetch` call directly inside a pure display card.
- No CSS hex values in TSX components; use tokens.
- No `totalPrice = 299` scattered in files.
- No trust in frontend plan permissions.
- No direct paid status from checkout success screen.
- No public report object key embedded in HTML.
- No invented review stats or certification graphics.

## Design deliverable mapping
| Feature | Shared pieces | Backend dependencies |
|---|---|---|
| Homepage banner | Button, Heading, Promo | none |
| Landing | Hero, ProcessSteps, ReportTeaser, PlanCard | approved plan catalog |
| Intake | Stepper, GoalsSelector, AddressField, CheckoutSummary | validation, coverage, draft |
| Account dashboard | Card, Status, Timeline, EmptyState | owner-authorized read DTO |
| Report screen | ReportReader, EvidenceTag, PdfDownload | signed authorized report file |
| Trials | FormulaPublicCard, FeedbackForm, ShipmentCard | entitlement, custody, formulation version |
| Quote | QuoteSummary, TermsPanel, ApprovalCTA | approved current price and stock |
| TeaPilot staff queue | Status, Filter, FormField, EvidencePanel | staff roles and TeaPilot adapter |
