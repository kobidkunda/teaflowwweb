# Project: TeaFloww Blend Lab (Milestones A & B)

## Architecture

TeaFloww Blend Lab is an artisanal B2B custom tea evaluation and formulation service ("Atelier") integrated into the Himalayan Tea House Next.js App Router storefront (`himalayan-tea-house`).

```
[Storefront Shoppers & Commercial Buyers]
       │
       ├──► Header Nav & Footer: "Blend Lab" / "Blend Lab (Atelier)"
       ├──► Homepage Discovery Section (between Carousel and BentoStory)
       │
       ▼
[/blend-lab] Marketing Page (Atelier Theme: Leaf & Ledger)
       │
       ├──► Editorial Hero & Methodology ("From Auction Lot to Signature Cup")
       ├──► Interactive Synthetic Cupping Report Preview (Zero Fabricated Certifications)
       ├──► 3-Tier Plan Comparison Table (@container queries, sticky headers, mobile card reflow)
       ├──► Interactive Goal Explorer (Cost / Balanced / Premium)
       └──► FAQ Accordion & CTA to [/blend-lab/start]
       │
       ▼
[/blend-lab/start] 5-Step Customer Intake Wizard
       │
       ├── Step 1: Plan Selection (Match & Quote, Tea Quality Audit, Signature Blend Lab)
       ├── Step 2: Tea Sample Information (Category, Grade, Current Price, Volume)
       ├── Step 3: Tasting & Commercial Goals (Target Price, Sensory Sliders, Notes)
       ├── Step 4: Pickup Pincode & Contact (6-digit PIN serviceability, Fail-Closed Guidance)
       └── Step 5: Review & Project Draft Creation (Idempotent draft generation, Terms Acceptance)
       │
       ▼
[Backend Domain & API Layer]
       │
       ├── GET  /api/blend-lab/plans (Typed Catalog: 29900, 199900, 299900 paise)
       ├── POST /api/blend-lab/coverage (Pincode serviceability verification)
       ├── POST /api/blend-lab/projects (Zod-validated idempotent project draft creation)
       ├── GET  /api/blend-lab/projects/[publicId] (Customer-safe project status)
       └── GET  /api/blend-lab/projects/[publicId]/report/[version]/download (Entitlement enforcement)
       │
       ▼
[Data Storage: SQLite (local dev) / PostgreSQL (prod)]
       │
       └── Migration 033: bl_service_plans, bl_projects, bl_project_briefs, bl_pincode_coverage
```

## Feature Inventory

Every feature discovered during the survey phase (BL-001 through BL-034 plus testing infrastructure) is recorded below with its assigned milestone:

| # | Code | Feature | Description | Milestone | Source |
|---|------|---------|-------------|-----------|--------|
| 1 | BL-001 | Leaf & Ledger Design Tokens | CSS variables (`--tl-forest`, `--tl-forest-deep`, `--tl-cream`, `--tl-ivory`, `--tl-copper`, `--tl-gold`, `--tl-sage`, `--tl-ink`, `--tl-line`, `--tl-danger`, `--tl-good`) in Tailwind v4 `@theme` | M1 | DESIGN.md / Survey 2 |
| 2 | BL-002 | Atelier Typography & Motion | Fraunces/Georgia headings, Inter sans, visible focus rings, >=44px touch targets, strict `prefers-reduced-motion` | M1 | DESIGN.md / Survey 2 |
| 3 | BL-003 | Header & Footer Navigation | Blend Lab link in `StorefrontHeader.tsx` `DEFAULT_NAV` and footer `DISCOVERY_LINKS` / `SHOP_LINKS` | M1 | StorefrontHeader / Survey 1, 2 |
| 4 | BL-004 | Homepage B2B Discovery Banner | Editorial feature section between retail carousel and bento story leading to `/blend-lab` | M1 | page.tsx / Survey 1, 2 |
| 5 | BL-005 | Blend Lab Editorial Hero | Atmospheric hero section with atelier narrative, value proposition, and primary intake CTA | M1 | DESIGN.md / Survey 2 |
| 6 | BL-006 | Methodology & Proof-of-Process | Step-by-step 4-stage laboratory process explanation (Sample, Cupping, Formulation, Commercialization) | M1 | DESIGN.md / Survey 2 |
| 7 | BL-007 | Interactive Goal Explorer | 3-mode selector (Cost optimization, Balanced profile, Premium signature) highlighting tailored recommendations | M1 | DESIGN.md / Survey 2 |
| 8 | BL-008 | Synthetic Cupping Report Preview | Interactive sensory evaluation teaser clearly marked with mandatory disclaimer (zero fabricated claims) | M1 | AGENTS.md / Survey 2 |
| 9 | BL-009 | 3-Tier Pricing Comparison Table | Responsive comparison of ₹299, ₹1,999, and ₹2,999 tiers with features, deliverables, and turnaround times | M1 | plans.ts / Survey 2 |
| 10 | BL-010 | Container Query Responsive Table | `@container (max-width: 720px)` card transformation, desktop sticky header, accessible `thead { display: none }` reflow | M1 | Modern Web / Survey 2 |
| 11 | BL-011 | Accessible Table Navigation | Keyboard scrollable container (`tabindex="0"`, `role="region"`), accessible row headers, zero screen-reader duplication | M1 | Modern Web / Survey 2 |
| 12 | BL-012 | Marketing FAQ Accordion | Accessible accordion answering turnaround times, sample weight requirements (100g), courier pickup, and commercial scale | M1 | DESIGN.md / Survey 2 |
| 13 | BL-013 | Marketing Page Metadata & SEO | Server-side metadata, OpenGraph, JSON-LD schema for professional blending service | M1 | SEO_STRATEGY.md / Survey 1 |
| 14 | BL-014 | Marketing Responsive Verification | Flawless mobile & desktop rendering (360px, 390px, 768px, 1280px) with 0 horizontal overflow | M1 | ORIGINAL_REQUEST / Survey 2 |
| 15 | BL-015 | Typed Plan Domain Catalog | Authoritative single-source plans catalog with integer paise (29900, 199900, 299900), entitlements, and tax splitting | M2 | plans.ts, money.ts / Survey 1 |
| 16 | BL-016 | Plan Entitlement Domain Logic | Strict domain enforcement: ₹299 (quotes only, no PDF), ₹1,999 (audit PDF, no trial blends), ₹2,999 (full blend development) | M2 | IMPLEMENTATION_PLAN / Survey 1 |
| 17 | BL-017 | Migration 033 Database Schema | Additive SQLite tables (`bl_service_plans`, `bl_projects`, `bl_project_briefs`, `bl_pincode_coverage`) with status indexes | M2 | DATA_MODEL.sql / Survey 1 |
| 18 | BL-018 | Zod Validation Schemas | Strict input schemas for plan selection, sample metadata, commercial goals, pickup details, and project drafts | M2 | API_CONTRACTS / Survey 1 |
| 19 | BL-019 | Public Plans API Endpoint | `GET /api/blend-lab/plans` returning active catalog with formatted INR prices and entitlement flags | M2 | API_CONTRACTS / Survey 1 |
| 20 | BL-020 | Pincode Coverage API Endpoint | `POST /api/blend-lab/coverage` validating 6-digit PIN with fail-closed fallback guidance | M2 | API_CONTRACTS / Survey 1 |
| 21 | BL-021 | Idempotent Project Creation API | `POST /api/blend-lab/projects` enforcing `Idempotency-Key` header, validating amounts in paise, generating public project ID | M2 | API_CONTRACTS / Survey 1 |
| 22 | BL-022 | Customer Project Status API | `GET /api/blend-lab/projects/[publicId]` returning sanitized project status and timeline | M2 | API_CONTRACTS / Survey 1 |
| 23 | BL-023 | Entitlement-Gated Report Download | `GET /api/blend-lab/projects/[publicId]/report/[version]/download` returning 403 on ₹299 plan | M2 | API_CONTRACTS / Survey 1 |
| 24 | BL-024 | 5-Step Wizard Stepper Layout | Responsive multi-step container with progress indicator, step navigation, and breadcrumbs | M2 | SITE_MAP_AND_FLOWS / Survey 1, 2 |
| 25 | BL-025 | Intake Step 1: Plan Selection | Accessible radio cards selecting tier with live feature summary derived from typed catalog | M2 | SITE_MAP_AND_FLOWS / Survey 2 |
| 26 | BL-026 | Intake Step 2: Sample Info | Tea category, leaf grade, current purchase price, sample weight acknowledgment (minimum 100g) | M2 | SITE_MAP_AND_FLOWS / Survey 1 |
| 27 | BL-027 | Intake Step 3: Goals & Sliders | Target price, goal selector (Cost, Chai, Consistency, Signature), flavor sensory balance sliders | M2 | SITE_MAP_AND_FLOWS / Survey 1 |
| 28 | BL-028 | Intake Step 4: Pincode & Address | Contact details, pickup address, 6-digit PIN lookup with dynamic serviceability check and fallback instructions | M2 | SITE_MAP_AND_FLOWS / Survey 1 |
| 29 | BL-029 | Intake Step 5: Review & Draft Intent | Server-verified order review, inclusive GST breakdown, terms acceptance checkbox, and draft creation | M2 | SITE_MAP_AND_FLOWS / Survey 1 |
| 30 | BL-030 | Native `:user-invalid` Form UX | Modern Web Guidance form styling: errors only display after field interaction / blur, success `:user-valid` indicators | M2 | Modern Web / Survey 2 |
| 31 | BL-031 | Synchronized ARIA Error Alerts | Accessible capture-phase `aria-invalid` and `aria-describedby` linking preventing premature screen-reader announcements | M2 | Modern Web / Survey 2 |
| 32 | BL-032 | Wizard State Persistence | Draft form state persisted across steps via `sessionStorage` with safe draft recovery and reset | M2 | Modern Web / Survey 2 |
| 33 | BL-033 | Keyboard & A11y Verification | Full tab navigation, Space/Enter activation, Esc modal dismissal, WCAG 2.2 AA compliant focus states | M2 | Modern Web / Survey 2 |
| 34 | BL-034 | E2E Testing Infrastructure Track | Test harness, synthetic fixture data, Category-Partition, BVA, and pairwise combinatorial test suites | M3 (E2E Track) | Dual Track Protocol |
| 35 | BL-035 | Final E2E Pass & Adversarial Hardening | 100% pass of requirement test suite (Tiers 1-4) plus Tier 5 adversarial coverage hardening | M4 (Final) | Dual Track Protocol |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Leaf & Ledger Design System, Placements & /blend-lab Marketing Experience | Design tokens in globals.css, header/footer nav, homepage B2B discovery, `/blend-lab` page, `@container` comparison table, synthetic report preview, FAQ | none | PLANNED |
| M2 | Blend Lab Service Domain, Contracts & Safe 5-Step Intake Flow | Typed plan catalog (paise), Migration 033, Zod validation, API endpoints (`plans`, `coverage`, `projects`), `/blend-lab/start` 5-step wizard with `:user-valid`/`:user-invalid` and ARIA sync | none (parallel with M1) | PLANNED |
| M3 | E2E Testing Track (Requirement-Driven) | Test runner harness, synthetic test fixtures, Tiers 1-4 test cases (Feature, Boundary, Combinatorial, Scenario), publish `TEST_READY.md` | none (parallel with M1, M2) | PLANNED |
| M4 | Final Milestone: 100% E2E Pass + Adversarial Coverage Hardening | Phase 1: 100% pass of Tiers 1-4 tests; Phase 2: Tier 5 adversarial white-box coverage hardening with challenger | M1, M2, M3 | PLANNED |

## Interface Contracts

### 1. Plan Domain Catalog Contract (`src/lib/blend-lab/plans.ts`)
```typescript
export interface BlendLabPlan {
  code: "MATCH_QUOTE" | "QUALITY_AUDIT" | "SIGNATURE";
  name: string;
  tagline: string;
  totalPaise: number; // 29900, 199900, 299900
  taxRateBps: number; // 1800 (18% GST)
  inboundShipments: number; // 1
  outboundShipments: number; // 0 for quote/audit, 1 for signature
  detailedPdf: boolean; // false for quote, true for audit/signature
  developmentIncluded: boolean; // false for quote/audit, true for signature
  includedRevisionRounds: number;
  includedTrialCandidates: number;
  turnaroundDays: number;
  sampleWeightGrams: number;
  highlighted?: boolean;
}
```

### 2. Pincode Serviceability Contract (`POST /api/blend-lab/coverage`)
- **Request Body (Zod)**:
  ```typescript
  {
    pincode: string; // Regex: /^[1-9][0-9]{5}$/
    country?: "IN";
    planCode?: "MATCH_QUOTE" | "QUALITY_AUDIT" | "SIGNATURE";
  }
  ```
- **Response (Success)**:
  ```typescript
  {
    serviceable: boolean;
    pincode: string;
    city?: string;
    state?: string;
    carrier?: string;
    estimatedPickupDays?: number;
    fallbackInstructions?: string; // If serviceable: false
  }
  ```

### 3. Project Draft Intake Contract (`POST /api/blend-lab/projects`)
- **Headers**: `Idempotency-Key: <UUID>`
- **Request Body (Zod)**:
  ```typescript
  {
    idempotencyKey: string;
    planCode: "MATCH_QUOTE" | "QUALITY_AUDIT" | "SIGNATURE";
    sampleInfo: {
      category: "CTC" | "orthodox" | "green" | "flavoured" | "other" | "unknown";
      leafGrade?: string;
      currentPurchasePricePerKg?: number;
      sampleVolumeWeightGrams: number; // >= 100
      primaryUseCase: string;
    };
    commercialGoals: {
      goalType: "lower_cost" | "stronger_chai" | "consistent_cup" | "new_signature";
      targetPricePerKg?: number;
      notes?: string;
      sensorySliders?: {
        strength?: number; // 1-5
        astringency?: number; // 1-5
        aroma?: number; // 1-5
        sweetness?: number; // 1-5
      };
    };
    pickupDetails: {
      contactName: string;
      businessName?: string;
      email: string;
      phone: string; // 10 digits
      gstin?: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      pincode: string;
    };
    acceptedTermsVersion: string; // e.g. "2026-v1"
  }
  ```
- **Response**:
  ```typescript
  {
    success: true;
    publicId: string; // e.g. "bl_proj_..."
    status: "draft_submitted";
    planCode: string;
    totalPaise: number;
    basePaise: number;
    gstPaise: number;
    pickupServiceable: boolean;
    createdAt: string;
  }
  ```

## Code Layout

- `src/app/globals.css` — Leaf & Ledger design tokens (`--tl-*`) in Tailwind v4 `@theme`
- `src/components/StorefrontHeader.tsx` & `src/lib/contentBlocks.ts` — Navigation link integration
- `src/components/Footer.tsx` — Footer navigation integration
- `src/components/home/BlendLabDiscoverySection.tsx` — Homepage B2B feature section
- `src/app/blend-lab/page.tsx` — Blend Lab marketing page
- `src/components/blend-lab/BlendLabHero.tsx` — Editorial hero
- `src/components/blend-lab/MethodologySection.tsx` — 4-stage laboratory process
- `src/components/blend-lab/SyntheticReportPreview.tsx` — Interactive sensory evaluation preview
- `src/components/blend-lab/TierComparisonTable.tsx` — Responsive `@container` query comparison table
- `src/components/blend-lab/GoalExplorer.tsx` — Interactive commercial goal selector
- `src/components/blend-lab/BlendLabFaq.tsx` — Accessible FAQ accordion
- `src/lib/blend-lab/plans.ts` — Typed plan catalog, integer paise arithmetic, and entitlement rules
- `src/lib/blend-lab/validation.ts` — Zod schemas for intake forms and API payloads
- `src/lib/blend-lab/coverage.ts` — Pincode serviceability checking and fallback logic
- `src/lib/blend-lab/projects.ts` — SQLite database access layer for Blend Lab projects
- `scripts/migrations/033_blend_lab_intake_projects.mjs` — Additive database migration
- `src/app/api/blend-lab/plans/route.ts` — Public plans endpoint
- `src/app/api/blend-lab/coverage/route.ts` — Pincode coverage endpoint
- `src/app/api/blend-lab/projects/route.ts` — Idempotent project draft intake endpoint
- `src/app/api/blend-lab/projects/[publicId]/route.ts` — Customer project status endpoint
- `src/app/api/blend-lab/projects/[publicId]/report/[version]/download/route.ts` — Entitlement download endpoint
- `src/app/blend-lab/start/page.tsx` — 5-step intake wizard container
- `src/components/blend-lab/wizard/` — Step components (PlanStep, SampleStep, GoalsStep, PickupStep, ReviewStep)
- `tests/unit/blend-lab-plans.test.ts` — Unit tests for pricing, entitlements, and tax math
- `tests/unit/blend-lab-validation.test.ts` — Unit tests for Zod validation schemas
- `tests/unit/blend-lab-api.test.ts` — API endpoint tests
- `tests/e2e/blend-lab.spec.ts` — Playwright E2E test suite (Tiers 1-4)
