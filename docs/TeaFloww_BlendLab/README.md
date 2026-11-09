# TeaFloww Blend Lab — Implementation & UI Design Handoff

**Delivery type:** technical/design documentation + reusable code *examples*, not a complete application.  
**Target:** extend the existing [teafloww.com](https://teafloww.com/) experience with a professional tea-testing and blend-development service.  
**Prepared:** 31 October 2026.  
**Status:** proposed scope — nothing deployed or changed on the live site.

## Start here

1. **`DESIGN.md`** — the visual language, templates, hierarchy, copy, responsive standards.
2. **`docs/IMPLEMENTATION_PLAN.md`** — milestone-by-milestone engineering execution, roles, dependency gates and deliverables.
3. **`docs/TODOS.md`** — detailed checkbox backlog with P0/P1/P2 priorities and IDs.
4. **`docs/ARCHITECTURE.md`** — integration topology, module boundaries, payment/courier/report workflows.
5. **`docs/DATA_MODEL.sql`** and **`docs/API_CONTRACTS.yaml`** — *illustrative contracts*, not migrations or production routes.
6. **`examples/static-preview/index.html`** — open locally to view an attractive **static reference only**. It contains no production checkout, order creation, tracking, customer access, or backend integration.
7. **`examples/react/`** — reuse-friendly TSX examples and CSS tokens, not a runnable application.
8. **`checklists/LAUNCH_GATE.md`** — audit before making any service publicly purchasable.

## The three service tiers

| Tier | Advertised inclusive price | Inbound courier | Tasting | Detailed PDF | New blend development | Outbound physical samples |
|---|---:|---|---|---|---|---|
| Match & Quote | ₹299 | Yes, within published terms | Reference matching only | No | Internal matching/quote, no sample development entitlement | No |
| Tea Quality Audit | ₹1,999 | Yes, within published terms | Comprehensive | Yes | No | No |
| Signature Blend Lab | ₹2,999 | Yes, within published terms | Comprehensive | Yes | Yes, defined trial and revision scope | Yes, one included outbound shipment |

**Important launch gate:** Tax treatment (services vs retail goods), included courier limits, sample weight, trial quantities, 26 kg proposed MOQ, tester credentials, food licensing, service turnarounds, confidentiality and recipe rights require real operational validation. The current connected store setting shown during research had a 5% general tax rate; do not inherit it for a service SKU without tax review. Professional/technical services may fall into a different GST category.

## Included structure

```text
teafloww-blend-lab-handoff/
├── README.md
├── AGENTS.md
├── DESIGN.md
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── TODOS.md
│   ├── ARCHITECTURE.md
│   ├── SITE_MAP_AND_FLOWS.md
│   ├── DATA_MODEL.sql
│   ├── API_CONTRACTS.yaml
│   ├── STATE_MACHINES.md
│   ├── REPORT_SPEC.md
│   ├── CONTENT_AND_SEO.md
│   ├── OPERATIONS_SOP.md
│   ├── SECURITY_AND_COMPLIANCE.md
│   ├── QA_AND_ACCEPTANCE.md
│   ├── ANALYTICS.md
│   ├── INTEGRATION_DISCOVERY.md
│   └── REFERENCES.md
├── examples/
│   ├── static-preview/index.html
│   └── react/
│       ├── components/*.tsx
│       ├── domain/*.ts
│       ├── styles/tokens.css
│       └── snippets/*.tsx
├── diagrams/*.mmd
└── checklists/LAUNCH_GATE.md
```

## Design preview

Open `examples/static-preview/index.html` directly in a browser. The page uses local styling and vector/CSS artwork; interactive toggles are presentation-only. There is no backend, dependencies, real quotation, report, email, payment or shipping.

## Engineering integration rule

**Inspect the existing website codebase and the TeaPilot integration points before choosing frameworks.** This handoff includes React/TypeScript examples and optional Next.js-style route conventions because they are common, but it does not establish the site's real framework. Adapt to the existing architecture rather than force a rewrite.

## Source notes

The public website and `/brand` page could not be fetched reliably through the browser research tool during preparation; the visual design is therefore grounded in the user's provided TeaFloww direction and read-only connected storefront metadata (brand, active slider records and categories), not a claim of pixel-perfect recreation.

The latest research links are in `docs/REFERENCES.md`. No live write was performed.
