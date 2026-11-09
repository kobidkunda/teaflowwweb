# TeaFloww Trials — v3 planning & design handoff

**Prepared 6 November 2026.** This bundle is a detailed **plan and UI reference**, not a production deployment.

## What is in this bundle

1. `IMPLEMENTATION_PLAN.md` — production architecture, exact source-code mapping, normalized data model, SQL and Python reference snippets, API/MCP contracts, page templates, design system, commerce/compliance gates, QA and deployment runbook.
2. `ENGINEERING_TODOS.md` — engineering tickets grouped by eight implementation milestones; each includes priority, responsible discipline and acceptance criterion.
3. `DESIGN_TEMPLATE.html` — standalone interactive, responsive visual design template inspired by the supplied Obsidian/Copper/Gold direction while keeping TeaFloww Forest/Ivory brand continuity. The Catalogue, Product and Admin tabs work within the HTML file, including pouch/stage switching, a transparent price-per-cup calculator and in-memory edit preview. **There is no actual checkout, production API, stock, courier, admin identity or MCP connection.**

## Verified technical baseline

Source checked: `../production_module/` in this working session.
- Existing local reference tests: `pytest -q` → **10 passed**.
- HTML template parse and JavaScript syntax checks passed.
- New design-template browser rendering could not be completed because the environment's browser policy blocked access to both local file and localhost URLs. The package therefore does not claim a screenshot-based verification.
- Current live TeaFloww integration (actual site repository, production DB, auth, checkout, and live MCP tool registration) remains **unverified/unfinished**.

## Work sequence

**Discover live site → schema/domain → shared Admin+MCP write service → storefront → genuine checkout & compliance → staging QA → controlled launch.**

Important: the uploaded 763-line example has unsupported assumptions (50% lower dosing, 45 second extraction, invented sensory scores, purported prepayment subsidy and voucher, free scoop, and fixed shipping economics) and incomplete publish/auth restrictions. The v3 plan documents corrections and makes unverified commercial statements launch-blocking instead of public claims.

## Open the design

Open `DESIGN_TEMPLATE.html` in a local browser or serve it as a static HTML file in a safe development environment. Select Catalogue, Product or Admin in its header to inspect different screens. No external assets or services are needed.
