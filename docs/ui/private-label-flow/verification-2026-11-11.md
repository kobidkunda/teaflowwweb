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
