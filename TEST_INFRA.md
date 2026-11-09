# E2E Test Infra: Himalayan Tea House Abandoned Cart & Visitor Intelligence System

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived strictly from `ORIGINAL_REQUEST.md`.
- No reliance on internal module mocking or implementation secrets.
- Systematic 4-tier methodology: Category-Partition, Boundary Value Analysis, Pairwise Combinations, and Real-World Scenarios.

## Feature Inventory & Test Coverage Goals

| # | Feature | Requirement Source | Tier 1 (Feature >=5) | Tier 2 (Boundary >=5) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|-------------------|:--------------------:|:---------------------:|:----------------------:|:-----------------:|
| 1 | Cart State Synchronization | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Device Fingerprinting & IP Geolocation | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Order Checkout Cart Conversion | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Phone Lead Capture & Incentive Modal | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | Cart Recovery Link & Hydration | ORIGINAL_REQUEST §R2, §R4 | 5 | 5 | ✓ | ✓ |
| 6 | Advanced Coupon Rules (Per-User / Per-Phone) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 7 | Coupon Discount Limits & Subtotals | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 8 | Admin Abandoned Carts Dashboard & Filters | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 9 | 1-Click WhatsApp Recovery Message Generation | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 10 | Admin Cart Status Updates & Notes | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 11 | MCP Tool: `list_abandoned_carts` | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| 12 | MCP Tool: `get_abandoned_cart_details` | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| 13 | MCP Tool: `update_abandoned_cart_status` | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| 14 | MCP Resource: `tea://analytics/abandoned-carts` | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Vitest (`./node_modules/vitest/vitest.mjs run`) and Next.js / Playwright.
- Test Files:
  - `tests/unit/abandoned-carts-mcp.test.ts` (MCP Tools & Resource verification)
  - `tests/unit/abandoned-carts-engine.test.ts` (Cart sync, fingerprinting, coupon rules, status machine)
  - `tests/unit/abandoned-carts-api.test.ts` (REST endpoints, Zod validation, rate limiting, admin guards)
  - `tests/e2e/abandoned-cart-recovery.spec.ts` (Browser storefront lead capture modal, WhatsApp link, recovery flow)

## Minimum Thresholds
- 14 features identified:
  - Tier 1: ≥ 70 test cases (5 × 14)
  - Tier 2: ≥ 70 test cases (5 × 14)
  - Tier 3: ≥ 14 cross-feature interaction cases
  - Tier 4: ≥ 7 real-world customer journey scenarios
  - Total Target: ≥ 161 test cases across unit, integration, and E2E suites.
