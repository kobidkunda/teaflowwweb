# Conversion Experiment Backlog & Next Features

## Rule for valid tests

First fix measurement and lead qualification. Then change **one primary factor at a time**, run until enough qualified lead data exists, and compare true unit economics. Low traffic makes traditional statistical-significance claims unreliable. Log hypotheses, launch date, markets, data completeness and decisions. Any numeric target here is a design/operational goal, **not a proven result**.

## Hypothesis register

| ID | Hypothesis | Test | Primary metric | Risk / minimum evidence |
|---|---|---|---|---|
| H01 | A person-first hero attracts more committed new founders | Starter A emotional vs B process visual | CPQL / quote rate | Requires distinct first paid orders eventually |
| H02 | Trader-specific pack specs prequalify better than generic A–Z offer | Trader A bulk+retail vs B sourcing+custom blend | CPQL and reached leads | Avoid losing brand prospects with over-narrow detail |
| H03 | Form-first gets better structured data than WhatsApp-first | Randomized eligible CTA destination | Qualified submissions per spend | WhatsApp click isn't conversation |
| H04 | Two buyer routes reduce irrelevant inquiries | Segmented route vs generic wholesale page | CPQL and disqualified rate | No unequal keyword targets |
| H05 | Clear freight/MOQ disclosure reduces low-value chats | Disclosure above vs below form | Qualified rate, dropout | Ensure all policies are true |
| H06 | Branded pack photos increase buyer confidence | Real physical packs vs neutral illustrations | Qualified quote starts | No fictional product representation |
| H07 | Process card order matters | Bulk-first vs private-label-first starter arrangement | Offer selection + CPQL | Keep same inventory/fees |
| H08 | Faster page improves ad-to-lead continuity | Optimized vs existing heavier experience | LCP and qualified starts | Avoid A/B when page speed blocks conversions |
| H09 | Language localized landing improves trust | Full Hindi vs English among matching audiences | Quality-adjusted conversion | Must be native reviewed and not geo-forced |
| H10 | Segment-specific lead question improves intent | Quantity band vs role question second | CPQL + sales effort/lead | Do not burden first-time user |
| H11 | Official team proof boosts confidence | Verified office/facility + document proof vs product-only | Quote conversion | Rights and compliance review |
| H12 | Return call offer helps high-value traders | Quote form with optional call vs no call | Qualified-to-quote rate | Staff availability and response SLA |

## Priority roadmap after initial launch

**Wave 1 — only after operational validation**

- Live quotation builder showing tea grade, pack, minimums and actual landed cost by pincode; prevent fake precision or unsupported COD rates.
- Sample request workflow with real fees, inventory, dispatch and refund handling.
- Role-aware CRM dashboard with next-action SLAs, grade requirements, quote versioning and follow-up status.
- English/Hindi/Bengali fully reviewed localization and accessible language preference.

**Wave 2 — once credible traffic and sales data exist**

- Personalization by business stage and selected format, powered by saved preferences rather than hidden profiling.
- Private-label configurator prefilled from inquiry, with explicit MOQ/print method choices and reviewed proof.
- Qualified lead feedback loop into Google Ads and Meta conversions with reconciliation.
- Native video subtitling/campaign operations for each eligible audience; incremental-budget guardrail.

**Wave 3 — separate business case**

- Replenishment alerts and reorder portal for existing traders.
- Region-wise trade grade selector with actual lab outcomes; no guaranteed taste equivalence.
- Dynamic reorder pricing with freight/risk model subject to commercial approval.
- Document handover package for own-label buyer containing brand brief, artwork proof, production approval and quote.

## Decision log template

```text
Experiment ID:
Segment / channel / landing:
Hypothesis and proposed lift mechanism:
Control and variant (the one change):
Exact tracking/CRM quality definition:
Budget/traffic split approval:
Start/stop dates:
Tracking reliability check:
Leading diagnostic metrics:
Qualified lead and paid order outcomes:
Decision: continue / iterate / revert / inconclusive
Owner + sign-off:
```

## Stop conditions

Pause/revert any experiment that breaks lead capture, consent, checkout, quote validity, source tracking, accessibility, ad platform policy or published claims. Do not call an experiment “won” on CTR, impressions, CPM or page views alone.
