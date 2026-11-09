# Operations Runbook — Himalayan Tea House SEO, Catalog & Search Feeds

**Version:** 2026-10-11  
**Target Roles:** Site Administrators, Content Editors, Sourcing Leads, DevOps Engineers  
**Platform:** Next.js 15 App Router · Node.js 20+ · SQLite WAL Mode

---

## 1. Publishing Workflows

### Workflow A: Publishing a New Seasonal Harvest Batch
1. **Access Admin Portal:** Log into `https://himalayantea.com/admin` using authorized credentials.
2. **Navigate to Products:** Click **Products** → **Create New Product**.
3. **Fill Agricultural & Terroir Attributes:**
   * Enter verified Estate Name, Origin, Harvest Flush (e.g. `Spring First Flush`), Harvest Date, and Elevation.
   * Input the 6 sensory cupping scores (0–5) and professional tasting notes.
   * Enter the precise steeping parameters (water temperature in °C, leaf dose in grams, infusion seconds).
4. **Configure Packaging Variants:**
   * Add at least one packaging variant with unique SKU (e.g., `DJ-SP-100G`).
   * Specify accurate price in INR (paise) and verified physically sealed stock.
5. **Configure SEO & SERP Settings (Section 6):**
   * Review the live Google SERP preview snippet.
   * Provide an informative Custom SEO Title (under 60 characters) and Meta Description (120–160 characters).
   * Leave Canonical Override blank (uses default `/tea/[slug]`) unless syndicating.
   * Ensure `noindex` remains unchecked.
6. **Publish & Index:** Click **Create Product**. The product is immediately live, available in `/feeds/google.xml`, and included in `/sitemap.xml`.

### Workflow B: Publishing a Connoisseur Brewing Guide
1. **Navigate to Articles:** Go to `/admin/blogs` → **New Article**.
2. **Enter Editorial Copy:** Include H2/H3 markdown headings, actionable brewing tables, and genuine estate insights.
3. **Set Status:** Set status to `published` and provide a publication date.
4. **Save Article:** Article automatically appears on `/learn` and renders Schema.org `Article` JSON-LD.

---

## 2. Real-Time IndexNow Submission Procedure

To notify search engines (Bing, Yandex, IndexNow network) immediately following major harvest releases:

```bash
# Example IndexNow ping via Node script
node -e "
const { submitToIndexNow } = require('./src/lib/seo/indexnow.js');
submitToIndexNow([
  'https://himalayantea.com/tea/darjeeling-spring',
  'https://himalayantea.com/learn/darjeeling-first-flush-guide'
]).then(res => console.log(res));
"
```

---

## 3. Merchant Center Feed Management

### Feed Verification Endpoints
* **Google Merchant RSS/XML:** `https://himalayantea.com/feeds/google.xml`
* **Meta Catalog CSV:** `https://himalayantea.com/feeds/catalog.csv`

### Troubleshooting Feed Discrepancies
* If Google Merchant Center reports an item price or availability mismatch:
  1. Inspect the variant row in SQLite:
     ```sql
     SELECT sku, price_paise, stock FROM variants WHERE sku = 'DJ-SP-100G';
     ```
  2. Verify that `v.price_paise / 100` matches the storefront display price.
  3. Re-fetch the feed endpoint directly in Google Merchant Center: **Products** → **Feeds** → **Fetch Now**.

---

## 4. Redirect Management & URL Migrations

To add or update permanent redirects:
1. Edit `next.config.ts`:
   ```typescript
   async redirects() {
     return [
       {
         source: '/old-path',
         destination: '/new-path',
         permanent: true, // Emits 308 Permanent Redirect
       },
     ];
   }
   ```
2. Verify redirect locally with curl:
   ```bash
   curl -I http://localhost:3000/old-path
   # Should return HTTP/1.1 308 Permanent Redirect with Location header
   ```

---

## 5. Incident Response & Monitoring Routines

### Incident A: Sudden Google Search Console Indexing Drops
* **Diagnostic Check 1:** Verify `/robots.txt` is accessible and has not blocked public routes.
* **Diagnostic Check 2:** Run `curl -I https://himalayantea.com/tea/[slug]` to ensure HTTP status is 200, not 404 or 500.
* **Diagnostic Check 3:** Check that `noindex` was not accidentally enabled in the product admin form.

### Incident B: Schema.org Validation Errors
* Check that product price is numeric and currency is `INR`.
* Confirm no deprecated `FAQPage` schema was mistakenly introduced.
* Run the URL through Google's Rich Results Test tool (`https://search.google.com/test/rich-results`).

---

## 6. Maintenance Schedule

| Frequency | Routine Task | Owner |
| :--- | :--- | :--- |
| **Weekly** | Review Google Search Console for crawl errors or merchant issues. | SEO Lead |
| **Monthly** | Verify sitemap indexation health and review organic search impressions. | Product Team |
| **Seasonal** | Update harvest flushes, retire past year lots with 301 redirects, update elevation/lot cupping notes. | Sourcing Lead |
| **Quarterly** | Audit Core Web Vitals (LCP, INP, CLS) in Chrome User Experience Report (CrUX). | DevOps / Eng |
