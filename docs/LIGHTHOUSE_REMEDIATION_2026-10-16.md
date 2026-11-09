# Homepage Lighthouse remediation — October 16, 2026

## Evidence and scope

The supplied desktop Lighthouse 13.5 report recorded CLS 0.634, TBT 380 ms,
accessibility 97 and an invalid AI catalog. It contained no CrUX field data.
A fresh live desktop run reproduced CLS 0.634 and the catalog failure; its TBT
was 0 ms, demonstrating that the blocking-time result varies between runs.
The live report is saved in `output/playwright/quality/live-before.json`.

A browser layout-shift observer identified the footer moving out of the viewport
from y=344 when page content arrived. Applying a minimum viewport height to the
main region, before the first paint, produced no layout shifts in three fresh
1350 × 940 browser sessions against the live response. Those were local browser
overrides, not production changes.

## Changes

- The homepage main region reserves `100svh` while App Router streams its content.
  Admin layout and other storefront routes retain their previous sizing.
- The story video link is now `#924d24` on `#faf7f2` (5.94:1).
  Trust subtitles use `#384335` on `#f7f4ee` (9.46:1). Both selectors that can
  supply the subtitle color are corrected; the older `.tf-trust-copy span`
  selector had overridden the newer `.tf-trust-subtitle` rule.
- GTM still loads using Next's `lazyOnload`, but no longer waits for a second
  browser load event. Its initialization remains idempotent and retains queued
  commerce events. When GTM is enabled with a container ID, it owns Google tags;
  operators configure GA4 in that container. Direct GA4 remains available when
  GTM is disabled or has no container. The admin help text explains this rule.
- Carousel pagination buttons have 44 × 44 px targets with small visual dots.
  Header/wholesale accessible names include their complete visible labels.
- Metadata is emitted in the initial head for all consumers using Next's
  supported `htmlLimitedBots` configuration. Previously the description was
  present only in streamed body metadata, which the SEO audit missed.
- Unconditional preconnects to Google and Cloudflare are removed.
- `src/lib/seo/aiCatalog.json` is the single imported catalog source. The root,
  legacy well-known and current ARD well-known URLs share one handler. This
  removes stale duplicate public files and a public-file/App-Router conflict.
  Both discovery link relations are included in the page head.
- The catalog now has `specVersion`, `host` and typed `entries` with stable URNs,
  linking to the existing OpenAPI and shopping feeds. It passes the actual
  Lighthouse 13.5 bundled JSON Schema validator. Its real resource media types
  may receive Lighthouse advisory warnings because they are not MCP/agent cards;
  they must not be relabeled as unsupported protocols merely to improve a score.

## Validation

Regression coverage includes the streamed shell's reserved height, GTM
initialization without requestIdleCallback, queued-event preservation, single
Google loader ownership, standalone GA4 and identical secure responses on all
three discovery URLs. The full local test suite has 1,282 passing tests and five
intentionally skipped PostgreSQL cases. Local work uses SQLite only.

Final `npm run check` passed with TypeScript, zero ESLint errors (53 existing
warnings), all 1,282 tests and the production build. An initial parallel run hit a
shared-SQLite hook timeout; the final check used an online-backup SQLite copy.

Final local Lighthouse 13.5 desktop diagnostic: performance 100, accessibility
100, best practices 100, SEO 100 and agentic browsing 98. CLS and TBT were zero;
contrast, target size, visible-label matching and head metadata passed. This is
a single local diagnostic score, not a production score comparison. The tool's
trace engine logged a NO_LCP fallback warning, but the final report contains
successful paint metrics and no runtimeError; CLS was independently observed.

Three fresh browser contexts at each of 1350, 390 and 320 px (940 px tall,
reduced motion, no explicit CPU/network throttling) recorded zero CLS and no
horizontal page overflow. Computed contrast ratios were 5.94:1 and 9.46:1.
Keyboard Enter activated the second carousel control; all eight measured
44 × 44 px. Skip-link focus/activation passed. Screenshots were reviewed at
mobile sizes and the updated desktop pagination row.

The exact audit settings, scores and browser observations are recorded in
`output/playwright/quality/verification.json`.
Browser captures and measurements are written under
`output/playwright/quality/`. These are real browser captures. Synthetic local
results do not establish field p75 performance or a new production score.

## Remaining operational items

No production deployment, production database migration or CDN setting was
changed. Cloudflare injects and controls its beacon's code and cache lifetime;
application code cannot change those response headers. Review that service's
zone configuration if the beacon is unnecessary. Next.js and Google/Cloudflare
own the compatibility code reported under legacy JavaScript. Do not remove
framework polyfills through undocumented bundle patches.

CSP nonce and Trusted Types hardening were additional manual recommendations in
the supplied report, not failed Best Practices audits (the score was 100). They
remain a separately scoped compatibility rollout for the framework and every
configured third-party integration. Manual screen-reader acceptance and actual
field metrics remain necessary beyond automated audit scores.

Reference: Lighthouse's [catalog schema](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/third-party/ard/spec/schemas/ai-catalog.schema.json)
and Next's [Script loading documentation](https://nextjs.org/docs/app/api-reference/components/script).
