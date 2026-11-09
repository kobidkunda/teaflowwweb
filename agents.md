# AGENTS — Repository Instructions for Coding Assistants

## Mission
Build a premium, accessible, fast tea commerce experience while preserving truthful sourcing and simple buying journeys.

## Brand & Company Information
- **Brand Name**: TeaFloww
- **Company / Entity**: Nirva
- **Domain**: TeaFloww.com
- **Email**: info@teafloww.com
- **Phone**: +91 7001304853
- **GSTIN**: 19CTHPK8646J2ZY
- **Office**: Shiv Shakti Kali Bari Rd Sukantapally East siliguri 734005
- **Works**: 00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri, Dist Jalpaiguri City Siliguri , West Bengal, 734015

## Read first
1. README.md
2. design.md
3. docs/IMPLEMENTATION_PLAN.md
4. docs/ARCHITECTURE.md
5. docs/TESTING.md
6. TODO.md

## Mandatory coding standards
- Use Next.js App Router, TypeScript strict mode and server components by default.
- Keep interactive code in small client components.
- SQLite queries must be parameterized.
- Do not trust client-side prices, stock or totals.
- Validate every mutating API request with Zod.
- Keep payment secrets out of client bundles and source control.
- Preserve idempotency for order/payment creation.
- Avoid leaking customer PII in public routes, logs or analytics.
- Never fabricate reviews, inventory scarcity, certifications, provenance or shipping promises.
- No real payment should be treated as successful without verified gateway webhook confirmation.
- Never expose raw database errors to customers.
- Respect WCAG 2.2 AA and prefers-reduced-motion.
- Never install unnecessary heavy dependencies.

## Database changes
Use versioned, additive migrations for real development. The initial migrate script is bootstrap-only. Never edit deployed schema silently. Add migration tests and backup strategy before production.

## Definition of done for a feature
1. Feature works on mobile and desktop.
2. Empty, loading, error and success states are covered.
3. Keyboard and screen reader paths are considered.
4. Server validation and authorization are implemented.
5. Unit/integration/e2e tests are added as appropriate.
6. Documentation and TODO status are updated.
7. npm run check passes locally.
8. Screenshot comparison is reviewed for significant UI changes.

## Suggested agent roles
- Architecture agent: schema, routes, APIs and operational boundaries.
- UI agent: design tokens, layout, component accessibility.
- Commerce agent: variants, pricing, cart, checkout and idempotency.
- QA agent: Vitest, Playwright, accessibility and security test cases.
- Content agent: verified provenance, imagery and editorial copy.
- Release agent: migration, monitoring, backups and deployment checks.

## Pull request template
Describe the customer problem, technical approach, changed files, tests run, screenshots, database changes, security considerations and remaining limitations.

## Never claim
Do not say a feature is implemented when only planned. Do not say tests passed unless executed. Do not call preview SVG/PNG files real browser screenshots.

## Production & Deployment Environment
- **Server Path**: `/www/wwwroot/teafloww.com`
- **Host / IP**: `43.230.200.121`
- **SSH User**: `root`
- **SSH Password**: `Kobid@1993`
- **Production PostgreSQL Database**:
  - **Host**: localhost (on server)
  - **Port**: `5433`
  - **Database**: `teafloww`
  - **User**: `teafloww`
  - **Password**: `teafloww`
- **Deployment Rules & Guidelines**:
  - **Do NOT deploy automatically**: Only deploy when explicitly requested by the user.
  - **Database Usage**: Use PostgreSQL in production only. Do not use PostgreSQL locally (keep local development on SQLite).
