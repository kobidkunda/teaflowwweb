# Private-label form verification — 11 November 2026

Scope: local customer consultation, five-step studio, saved projects, quotation,
sample requests, proof approval and order documents. Testing uses synthetic
accounts and a disposable SQLite copy, never the production database.

## Repairs in the second verification pass

- Normalize persisted drafts before rendering; malformed numbers, enums and old
  artwork URLs no longer crash the studio.
- Keep screen printing selectable when switching from a six-color method, clamp
  colors to method limits and enforce compatibility on the server.
- Reject fractional quantities, invalid contact numbers and unknown sample
  coupons. Preserve customer input after failures and require an explicit state.
- Provision the authenticated customer's own sample client rather than selecting
  another customer's client. Keep project, quote, sample and order ownership gates.
- Preserve draft configuration on partial title updates and provide an explicit
  reload action after revision conflicts.
- Route missing dielines to a real prefilled enquiry instead of nonexistent API
  downloads or simulated delivery confirmations.
- Require operator-passed preflight, the exact design revision, named signer and
  explicit consent before proof approval. Customer requests cannot self-certify
  preflight. Release requires the latest approved, locked proof.
- Replace mocked payment secrets with an explicit unavailable response. An order
  request remains unpaid until verified payment is recorded.
- Calculate commercial summary tax from the stored quote, without adding another
  blanket 18 percent. Provide a printable customer page instead of a raw JSON link.
- Use the quote UUID for quote numbers; the prior four-digit random pool collided
  during the acceptance suite.

## Feature boundaries

Customer PNG/JPEG/WebP artwork is a studio preview. Production artwork and
prepress checks still require operator review. Missing dielines require a real
consultation request. Private-label online payment is not integrated; the API
returns 503 and never fabricates a payment intent or successful payment.
No physical manufacturing, live payment, dispatch or external email delivery is
claimed by this verification. No deployment is included.

## Executed acceptance evidence

- `npm run check` completed successfully: TypeScript, ESLint, 2,935 tests passed,
  six live-PostgreSQL tests skipped, and optimized production build completed.
- After tightening quotation button eligibility, the focused private-label suite
  passed again: 865 tests across 34 files. Targeted lint passed for the final
  quantity controls and print styles.
- Production-browser replay covered consultation failure/retry and real reference;
  all five studio steps; print/color compatibility; unsupported upload rejection;
  artwork rights, persistence and keyboard placement; all preview tabs and Escape;
  fractional/sub-MOQ quantities; pricing outage recovery; draft CAS conflict and
  reload; 2,500-unit quote creation; and PDF content type.
- A first-time customer submitted two sample kits with the server-calculated
  amount. Invalid phone and unknown coupon were rejected without losing inputs.
  Saved samples appeared in that customer's workspace and not another's.
- Customer-supplied passed preflight was ignored; approving pending preflight was
  rejected. A synthetic operator-reviewed proof fixture then exercised named
  consent, the exact proof revision, order conversion and idempotent replay.
  The test document used a quotation PDF as a fixture; this does not validate a
  real print-ready production proof or physical prepress.
- Payment intent returned 503 without a secret. The order and commercial summary
  remained unpaid; subtotal plus stored quote GST equalled the order total.
- A second authenticated customer received 404 for the first customer's project,
  quotation, order and commercial document.
- Quotation and commercial document fit 1440, 390 and 320px viewports. Generated
  front/back images loaded at each width. Actual browser screenshots were reviewed
  in `output/playwright/private-label-*-review.png` and related viewport captures.

The new paired Reserve concept images are `teafloww-reserve-front-v2.webp` and
`teafloww-reserve-back-v2.webp`; the interactive landing preview references them.
They use the requested label wording and remain marked as illustrative outside
the packaging image. Existing earlier images are retained.

Print-media verification also confirmed that the commercial summary stays visible while floating cookie/chat controls are hidden. A browser-generated A4 PDF is saved in `output/playwright/private-label-commercial-summary-print.pdf`. The isolated server was stopped and its SQLite database moved to Trash.
