# The Tea House — Next.js + SQLite starter

A functional full-stack premium tea ecommerce development starter. The UI follows the supplied Contemporary Himalayan Connoisseurship design direction.

## Requirements
- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- Local writable filesystem for SQLite
- A modern browser

## Start
1. Extract the ZIP and open the project directory.
2. Run: npm install
3. Run: npm run db:setup
4. Run: npm run dev
5. Visit: http://localhost:3000

For browser tests:
1. Run: npx playwright install chromium
2. Run: npm run test:e2e

For code validation:
- npm run typecheck
- npm run lint
- npm run test
- npm run build

## What works in this starter
- Responsive homepage and editorial sections
- SQLite-backed tea catalogue, variants, prices and sample stock
- Search and category filtering
- Product detail pages with taste and provenance modules
- Client-side persisted cart
- Quantity changes, removal and shipping threshold
- Server-validated demo checkout with idempotency
- Demo order confirmation and API health endpoint
- Rule-based Tea Finder
- Gift landing page
- Unit and Playwright browser tests
- Design previews and screenshot capture instructions

## What is NOT production-ready
- No real payment capture, refunds or fulfillment
- No authenticated accounts or admin CMS
- No inventory reservation after payment
- No real delivery estimates or carrier integration
- No verified estates, certifications, harvest dates or reviews
- No transactional email
- No customer consent, privacy retention or data-deletion workflow
- No production rate limiting or fraud controls
- No real product photography

Do not deploy a live checkout with these omissions. Sample product data and imagery are fictional design placeholders.

## Project structure
- src/app: App Router pages and API routes
- src/components: reusable storefront components
- src/lib: database, product queries, validation and pricing
- scripts: SQLite migration and sample data
- tests/unit: Vitest tests
- tests/e2e: Playwright browser tests
- docs: implementation, architecture, UI and testing documentation
- design.md: design system
- agents.md: coding agent instructions
- TODO.md: prioritized development checklist

## Deployment
SQLite needs a persistent writable disk. Do not assume a serverless or edge deployment provides one. Use a single persistent Node.js host for local/small deployment or migrate to a managed database for horizontally scaled production. Back up and encrypt sensitive data.

## Brand and legal note
The Tea House is a temporary project identity, not a trademark-cleared brand name. Replace it after proper legal and domain screening.

## International commerce (local implementation)

Country/currency/language preferences, reviewed translations, market delivery rules,
Razorpay checkout, COD, and fulfillment operations are documented in
[International commerce operations](docs/INTERNATIONAL_COMMERCE.md). Start at
`/admin/markets`, `/admin/translations`, and `/admin/fulfillment`.

New commerce checkout requires configured, verified providers and enabled markets.
Missing integrations fail closed; no sample FX, duties, or carrier costs are used.
Run `npm run commerce:worker` alongside the app after configuring its server secret.
Production deployment and account activation remain separate, explicit operations.
