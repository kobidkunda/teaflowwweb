# Product Requirements Document — Tea Business Partner Acquisition

## Product concept

**Product name:** TeaFloww Business / व्यापार के लिए TeaFloww  
**Positioning:** Tea sourcing, packaging, branding and trade support from Siliguri, organized as a practical business acquisition journey.  
**One-sentence value:** 'From tea supply to your branded pack, explore the right business solution with one Siliguri partner.'

## Problem statement

TeaFloww's consumer homepage, wholesale page and advanced private-label tool serve different jobs. A cold prospect looking to **begin tea trading** does not necessarily know grades, print MOQs or configurations. An experienced trader wants rapid quote inputs, grade/consistency evidence and freight-inclusive economics. Sending both to the consumer store or a complex configurator increases uncertainty and friction.

## Objectives

| Objective | Metric | Interpretation |
|---|---|---|
| Acquire serious B2B demand | Qualified business leads | Contactable, serviceable and commercially compatible, not just chat clicks |
| Improve efficiency | Cost per qualified lead (CPQL) | Spend / deduped qualified leads |
| Turn enquiries into sales | Quote-to-first-paid-order conversion | Quote and paid-order join by lead ID |
| Establish supply credibility | Quote request completion + content engagement | Supporting diagnostic only |
| Preserve storefront UX | No degradation of existing B2C pages | New routes isolated/shared shell visually consistent |
| Keep site fast | Core Web Vitals by device | Especially budget Android devices and 3G/4G |
| Support India | Language and logistics-aware journeys | Initial English + Hindi; expand based on qualified demand |

## Personas (hypotheses, validate with interviews)

### P1. First-time entrepreneur

Motivations: own brand, small reseller business, local distribution, or a new product category. Needs clear 3-offer model, packaging examples, quantity expectations, how quotes work, sample opportunities, cost transparency and responsible next steps. Often on mobile. May prefer Hindi/Hinglish, sometimes another regional language.

Top objections: 'Do I need my own company?', 'How much stock is required?', 'Who designs the label?', 'Is delivery available to my town?', 'What is the final landed price?', 'Can I taste it first?' Sales team must answer each with verified terms, not generic guarantees.

### P2. Experienced tea trader / distributor

Motivations: new supply source, better landed economics, pack diversification, custom blend specification, reliability and reduced coordination work. Needs price bands and specs by grade, proof, MOQ matrix, sample policy, dispatch promise and trade quotation fast.

Top objections: 'Show sample and grade', 'Can you match my market profile?', 'What's price at 100kg or 500kg?', 'Freight to my pincode?', 'What's repeated-lot process?', 'Who owns artwork and printing inventory?'

### P3. Sales agent (internal)

Needs enough structured data to decide if an enquiry is worth a quote, a reliable way to reach it, assignment, status timeline and deduplication. Should never need to search spreadsheet rows for UTM campaign attribution.

### P4. Operations / sourcing / design owner

Needs quoted grade, available format, approved files, sample requirements, lead stage, address/pincode, freight and promised ship date captured with audit trail.

## Must-have functional requirements

| ID | Requirement | Acceptance gate |
|---|---|---|
| FR-01 | Two SEO-compatible public entry pages | Unique URLs, distinct H1, canonical, descriptive meta |
| FR-02 | Two-position intent switch | Keyboard, screen-reader and touch accessible; no forced modal |
| FR-03 | Three offer families (bulk, retail, private label) | Each can prefill quote interest |
| FR-04 | Plain-English process and qualifications | No unverified fixed price/guarantee |
| FR-05 | Minimal lead form (5 information groups) | Mobile submit success + persisted lead ID |
| FR-06 | Assisted WhatsApp path | Single verified number, clear prefilled message, click separately tracked |
| FR-07 | Attribution persistence per lead | Whitelisted UTM + available click IDs, source recorded |
| FR-08 | CRM lead lifecycle | New → contact attempted → qualified/disqualified → quoted → won/lost |
| FR-09 | Accurate conversion events | Deduped, non-PII marketing event payloads |
| FR-10 | Language toggle | English/Hindi copy switching with correct `lang` and layout |
| FR-11 | Responsive design | 320px to wide desktop, no horizontal scrolling |
| FR-12 | Admin-controlled content in future | First release static approved copy; leave typed content adapter |
| FR-13 | Link to existing advanced tools | Only on relevant post-qualification path |

## Non-functional requirements

- Reliability: lead API transaction commit before reporting success; back-office notifications retry without duplicating lead.
- Security: server-side validation, abuse throttling, input encoding, CSRF/origin policy as needed, minimal PII, no credentials in browser code.
- Performance: LCP under 2.5s p75, INP under 200ms p75, CLS under 0.1 p75; measure rather than declare achieved.
- Accessibility: WCAG 2.2 AA target, keyboard operation, high-contrast type, reduced-motion behavior.
- Privacy: clear enquiry purpose, contact policy, separate optional marketing consent, deletion/retention controls.
- Operability: error telemetry, webhook/CRM retries, deduplication, idempotent conversion events, revisioned copy.

## Explicit non-goals for v1

- No replacement of current storefront/checkout.
- No full self-serve tea blend pricing engine or unsupported instant manufacturing quote.
- No automatic ad campaign launch or changes to existing tea-stall budgets.
- No fake reviews, fabricated factory scenes, guaranteed income or unverified certifications.
- No forced language-selection modal or autoplay background video on low-end phones.
- No requiring user account registration before first quote.

## Definition of a qualified lead (tunable with sales data)

A sales-verified contact with a plausible buying role, valid India phone, usable city/pincode, specified business stage, one relevant product request and an estimated volume compatible with the confirmed MOQ/route. A lead is **not qualified** merely because the page form was submitted.

## Commercial offer objects

Model `offer_id` independently of SKU: `bulk_supply`, `ready_retail`, `private_label`. One lead can request multiple offers. A customer who wants TeaFloww-branded 250g pouches is not the same as one who wants newly printed 250g pouches with their own logo: always clarify.
