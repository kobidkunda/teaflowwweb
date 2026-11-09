# Homepage performance and accessibility repair — 2026-10-16

Scope: public homepage, mobile and desktop. Skills used: diagnosing-bugs,
performance, accessibility and web-quality-audit. All changes are local; no
production deployment, database migration or tracking-container publication.

## Reproduced production failures

Lighthouse 13.5.0 against `https://teafloww.com/`, Chrome 155, default mobile
simulation (412 × 823, simulated Slow 4G/CPU throttling), fresh browser storage:

| Metric | Live baseline |
| --- | --- |
| Performance | 73 |
| FCP | 1.3 s |
| LCP | 2.8 s |
| TBT | 110 ms |
| CLS | 0.587 |
| Speed Index | 1.5 s |
| Accessibility | 97 |
| Best Practices | 100 |
| SEO | 92 |
| Agentic Browsing | 53 |

This is one diagnostic baseline, not a statistically stable score or field data.
The user's earlier report used Chrome 153 and scored Performance 66. Do not
compare these scores as a code change: both measurements preceded this repair.

The live HTML initially sends a short “Loading the tea collection…” Suspense
fallback in `main`, followed by the footer. The full homepage arrives later in
React's streamed content. The footer is consequently painted in the first
viewport and moves down when the homepage replaces the fallback. Lighthouse
identifies the footer as the shifted node, not the initiating cause.

## Changes

- `StorefrontShell` reserves `100svh` on the homepage's main element in server
  HTML. The footer stays below the viewport even while the streamed page is
  incomplete. Other routes and admin layout retain their existing sizing.
- Darken the original-price text, video watch link and the more-specific
  `.tf-trust-copy span` rule. The latter overrode the already darker generic
  subtitle rule and was responsible for the remaining trust-text failure.
- Remove redundant accessible names that excluded responsive visible labels;
  preserve explicit names on icon-only controls. Include the visible brand and
  wholesale wording in the remaining contextual labels.
- GTM is the sole Google loader when enabled with a container ID; standalone GA4
  remains available when GTM is disabled or has no ID. The admin explains this
  priority. GA4 must be configured inside the GTM container in GTM mode. Next's
  `lazyOnload` handles load/idle scheduling; a redundant inner load listener
  could otherwise miss `load` in browsers without `requestIdleCallback`.
- Replace the incompatible catalog manifest with ARD 1.0 `specVersion`, `host`
  and typed `entries`, with representative queries. List the actual OpenAPI
  description and existing feeds with distinct URNs. One bundled manifest in
  `src/lib/seo/aiCatalog.json` serves all three discovery URLs, avoiding a duplicate
  public-file/route collision. Primary reference:
  [ARD catalog schema](https://github.com/ards-project/ard-spec/blob/main/spec/schemas/ai-catalog.schema.json).

The root configuration sends metadata in the initial HTML head so clients do not
need to execute streamed metadata scripts to find the description. The head also
links directly to the catalog.

## Deterministic streaming regression

A real browser replay of the captured live HTML delays its streamed content by
1.8 seconds. Only the reserved main height changes between control and repair.
Viewport 412 × 823; three independent contexts per variant:

| Variant | CLS, three runs | Final main height |
| --- | --- | --- |
| Original streaming HTML | 0.586877 / 0.586877 / 0.586877 | 4605.953 px |
| Reserved homepage space | 0 / 0 / 0 | 4605.953 px |

A fast live navigation did not reproduce the shift, so it was not accepted as
proof. The delayed replay reproduces the exact reported footer shift and removes
it with one variable changed. Its screenshots are real browser captures, not
preview artwork. Fixture scripts, captured HTML, reports, CPU profiles and check
logs are in `output/performance-20261016/`; screenshots are in
`output/playwright/fixture-{original,reserved}-mobile.png`.

## Local runtime contamination

The first local audit was invalid as a release comparison: requests stalled for
seconds and robots/catalog fetches timed out. A Node CPU profile identified
synchronous `Date.now()` spin waits in the installed Next.js manifest loader.
Nine other installed Next JavaScript files also differed from the registry
package. These were local dependency modifications, not application changes.

Restore the exact locked Next.js 15.5.27 JavaScript from the npm archive; its
SHA-512 integrity matched `package-lock.json`. Preserve the old modified files
under `output/performance-20261016/` for diagnosis. No version upgrade or new
runtime dependency was introduced. A clean `npm ci` is the reproducible installation
path; do not copy a previously patched `node_modules` to production. Official
[Next 15.5.27 manifest loader](https://github.com/vercel/next.js/blob/v15.5.27/packages/next/src/server/load-manifest.external.ts)
contains no retry spin loops. Whether production has similar dependency edits
has not been inspected and must not be assumed.

## Verification

Automated and browser verification results are recorded below after the final
build. CrUX field data is unavailable in this run; local results do not prove
production field Core Web Vitals. The GTM container and Cloudflare beacon remain
externally managed; their own unused JavaScript/polyfills cannot be removed by
editing the storefront bundle. Framework compatibility code should not be
stripped solely to silence Lighthouse's legacy-JavaScript insight.

### Final local mobile audit

Lighthouse 13.5.0 / Chrome 155, production build on
`http://127.0.0.1:3329/`; default Moto G Power viewport 412 × 823, DPR 1.75,
simulated 150 ms RTT / 1638.4 Kbps / 4× CPU. Three fresh browser runs with a
warm server/image optimizer. Local SQLite content and enabled tracking settings
differ from production; these results cannot be presented as deployed gains.

| Signal | Median | Range |
| --- | --- | --- |
| Performance | 95 | 94–96 |
| Accessibility | 100 | 100–100 |
| Best Practices | 100 | 100–100 |
| SEO | 100 | 100–100 |
| Agentic Browsing | 98 | 98–98 |
| FCP | 1.071 s | 1.068–1.079 s |
| LCP | 2.868 s | 2.800–2.978 s |
| TBT | 11 ms | 10.5–13 ms |
| CLS | 0 | 0–0 |
| Speed Index | 1.071 s | 1.068–1.079 s |

LCP remains above the 2.5 s field target in the local mobile simulation. No field
pass is claimed. Lighthouse validates the served catalog and reports only low
notices because accurate `application/openapi+json`, `text/csv` and
`application/xml` types fall outside its preferred agent-card media-type list.
These endpoints are not relabelled as agent cards simply to obtain 100.

The first attempt at the third mobile run had a Lighthouse `NO_NAVSTART` trace
failure; it was discarded and rerun. Earlier audits affected by the modified
runtime are retained for diagnosis and excluded from final results.

`NEXT_DIST_DIR=.next-perfcheck npm run check` passed: strict TypeScript,
ESLint (existing warnings, no errors), 1,282 tests passing, five intentionally
skipped PostgreSQL tests, and production build. New regression coverage exercises
server-rendered reserved space, one Google loader, queued events, browsers without
`requestIdleCallback`, valid catalogs at all discovery URLs and rejection of the
former manifest shape.

Real browser checks at 390 px and 1440 px verified that Tab first reaches the skip
link and Enter focuses `main-content`, descriptions are in the initial head,
there is no horizontal page overflow, and no page exceptions occurred. Reduced
motion was emulated. Final viewport screenshots are
`output/playwright/performance-final-{390,1440}.png`. A full human screen-reader
audit and production field verification remain pending.

Desktop Lighthouse returned scores and metrics, but its optional Lantern insight
processing logged `NO_LCP` on both attempts. Desktop insight conclusions are
therefore excluded; the independently verified desktop layout, keyboard and
accessibility results remain recorded above. Use the three complete mobile
reports for the headline performance comparison.

## Production deployment follow-up

The user subsequently explicitly requested deployment. The repair is now live
with a median mobile Performance score of 94 across three final runs, CLS 0,
and Accessibility/Best Practices/SEO 100. See
`docs/DEPLOYMENT_2026-10-16_PERFORMANCE.md` for native build, backup, Nginx/CDN
asset publication, rollout verification and remaining limitations. Earlier
statements that this work was local-only describe the pre-deployment audit.
