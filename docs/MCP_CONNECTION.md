# MCP Connection Guide — `POST /mcp?token=`

The store exposes a **Streamable-HTTP Model Context Protocol (MCP) endpoint** with **100% specification capabilities** (Tools, Resources, Prompts, Logging, and Completion) at exactly one URL:

```
https://<host>/mcp?token=<MCP_TOKEN>
```

## 1. Point an MCP Client at it

Any MCP client that supports Streamable HTTP (ChatGPT developer mode, Claude Code, Cursor, generic MCP remotes, Antigravity) connects with the full URL **including the `?token=` query param** — that is the credential:

| Client field        | Value                                        |
| ------------------- | -------------------------------------------- |
| Transport           | Streamable HTTP (JSON-RPC 2.0)               |
| Server URL          | `https://<host>/mcp?token=<MCP_TOKEN>`       |
| Auth headers        | none (do not add `Authorization`)            |
| Extra body fields   | none (a `token` in the body is ignored)      |

Example client config (generic JSON shape — adapt key names to your client):

```json
{
  "mcpServers": {
    "tea-house": {
      "url": "https://<host>/mcp?token=<MCP_TOKEN>",
      "transport": "streamable-http"
    }
  }
}
```

### Smoke Test with cURL

```bash
BASE="https://<host>/mcp?token=${MCP_TOKEN}"

# 1. Initialize (Returns 100% Capabilities: tools, resources, prompts, logging, completion)
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2025-03-26"}}'

# 2. List tools
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Call a tool
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"store.listProducts","arguments":{"featured":true}}}'

# 4. List resources and read a resource
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"resources/list"}'

curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":5,"method":"resources/read",
       "params":{"uri":"tea://catalog/products"}}'

# 5. List prompts and get a prompt
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":6,"method":"prompts/list"}'

curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":7,"method":"prompts/get",
       "params":{"name":"tea-sommelier-recommendation","arguments":{"tasteProfile":"floral, muscatel"}}}'

# 6. Autocomplete completion
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":8,"method":"completion/complete",
       "params":{"argument":{"name":"slug","value":"darj"}}}'

# 7. Set logging level
curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":9,"method":"logging/setLevel",
       "params":{"level":"info"}}'
```

## 2. Auth Rules (Contract §4)

- **Query param only.** `Authorization` headers and body tokens never authenticate — they are ignored. Missing/wrong token → `401` with a generic `Unauthorized` JSON-RPC error.
- Token lives in the server-only `MCP_TOKEN` env var, compared constant-time with `crypto.timingSafeEqual`. Rotation = new env value, no code change.
- The token travels in the URL, so **access logs must strip query strings** and the value must never be logged.
- `GET`/`DELETE /mcp` return `405` (POST carries every call).

## 3. 100% Capabilities Matrix

### Capability 1: Tools (17 Operational Tools)

Catalogue reads:
- `store.listProducts {q?, category?, featured?}`
- `store.getProduct {slug}`
- `store.listCategories {activeOnly?}`
- `store.listSliders {activeOnly?}`
- `store.validateCoupon {code, subtotalPaise}` → validity + discount, no mutation
- `store.getSettings {}` → operational configuration (tax rates, shipping fees, contact email)
- `store.getHomepageContent {storefrontOnly?}` → full structured homepage layout & sections

Catalogue & Admin editing (each takes `idempotencyKey?`; replays echo `{ deduped: true }`):
- `admin.upsertProduct`, `admin.upsertVariant`, `admin.upsertCategory`,
  `admin.upsertProductImage`, `admin.upsertSlider`, `admin.upsertCoupon`,
  `admin.deleteEntity {entity, id}` (supports `product`, `variant`, `category`, `product_image`, `slider`, `coupon`, `blog`, `user`)
- `admin.updateSettings {store_name?, currency?, tax_rate_percent?, shipping_flat_fee_paise?, free_shipping_threshold_paise?, contact_email?}`
- `admin.updateHomepageContent {content, idempotencyKey?}`
- `admin.upsertSitePlacement {section_key, media_id?, image_url?, alt_text?, title?, subtitle?, cta_label?, cta_href?}`
- `admin.listUsers {}`
- `admin.upsertUser {id?, username, email?, password?, role?, is_active?, idempotencyKey?}`
- `admin.deleteUser {id}`

Editorial & Blog tools:
- `blog.listBlogPosts {status?, q?, limit?}`
- `blog.getBlogPost {slugOrId}`
- `blog.upsertBlogPost {id?, slug?, title, content, summary?, excerpt?, cover_image_url?, cover_media_id?, author_name?, status?, published_at?, seo_title?, seo_description?, canonical_override?, noindex?, idempotencyKey?}`
- `blog.deleteBlogPost {idOrSlug}`

Media Library tools & Dimension Specifications:
- `media.getImageRequirements {entity_type?, section_key?}` → Query recommended and required image dimensions, aspect ratios, min/max resolutions, and format constraints for all storefront placements (products, categories, sliders, site placements, and blogs).
- `media.listMedia {search?, mime_type?, cursor?, limit?}`
- `media.uploadMedia {filename, base64_data, alt_text?, caption?, sort_order?, idempotencyKey?}` → Automatically detects width and height dimensions from binary image headers (PNG/JPEG/WebP/AVIF), records in DB, and returns `dimensions`, `required_dimensions`, and `compatible_targets`.
- `media.updateMetadata {id, alt_text?, caption?, sort_order?}`
- `media.associateMedia {media_id, entity_type, entity_id, is_primary?}` → Links asset to target entity and returns `required_dimensions`, `asset_dimensions`, and `dimension_match` suitability evaluation.
- `media.deleteMedia {id}`

Orders / fulfillment:
- `orders.getOrder {orderId}`
- `orders.listOrders {paymentStatus?, dispatchStatus?, cursor?, limit?}`
- `orders.setDispatchStatus {orderId, to, idempotencyKey?}`
- `orders.cancelOrder {orderId, actor?}`
- `payments.recordIntent {orderId, amountPaise, idempotencyKey}` (key required)
- `payments.applyWebhook {gatewayPaymentId, status, signature}`

### Capability 2: Resources & Resource Templates

Static Resources:
- `tea://catalog/products`: Full catalog with origins, tasting notes, and variant pricing
- `tea://catalog/categories`: Active tea categories
- `tea://catalog/sliders`: Homepage editorial hero sliders
- `tea://store/coupons`: Active promotional discount codes and rules
- `tea://store/status`: Store operational status and health metrics
- `tea://orders/recent`: Recent orders manifest
- `tea://media/recent`: Recent media uploads
- `tea://media/requirements`: Exact image dimension, aspect ratio, resolution, and format specifications for all storefront slots, product galleries, categories, sliders, site placements, and blogs
- `tea://store/settings`: Store operational settings (tax rates, shipping fees, business name)
- `tea://content/homepage`: Live storefront homepage structured layout
- `tea://content/blogs`: Published educational tea journal articles

#### Storefront Image Dimensions & Aspect Ratio Guide

| Placement Target | Recommended Dimensions | Aspect Ratio | Min Resolution | Recommended Format | Display Locations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`product`** | `1200 × 1200 px` | `1:1` (Square) | `800 × 800 px` | WebP / JPEG / PNG | Zoomable PDP gallery, shop grid, cupping dossier sensory sheets, cart drawer, Google/Meta feeds |
| **`slider`** | `1920 × 800 px` | `2.4:1 / 16:9` (Panoramic Banner) | `1280 × 600 px` | WebP / JPEG | Full-viewport homepage hero showcase, seasonal promotional campaign banners |
| **`category`** | `1200 × 800 px` (Cover) / `800 × 800 px` (Strip) | `3:2` or `4:3` (Cards) / `1:1` (Circle) | `400 × 400 px` | WebP / JPEG | Collections page header, category card grid (`aspect-4/3`), homepage circular ribbon (`96×96`) |
| **`blog`** | `1200 × 675 px` (or `1200 × 630 px`) | `16:9` (Widescreen) / `1.91:1` (OG) | `800 × 450 px` | WebP / JPEG | Tea Academy masterclass header, journal card grid, OpenGraph / Twitter social cards |
| **`site_placement:home_hero`** | `1920 × 800 px` | `2.4:1 / 16:9` | `1440 × 600 px` | WebP / JPEG | Main homepage hero background behind headline and flush pills |
| **`site_placement:home_story`** | `1200 × 800 px` | `3:2` (Landscape) | `600 × 400 px` | WebP / JPEG | Bento grid origin story panel with mountain estate scenic video overlay |
| **`site_placement:home_craft`** | `1200 × 800 px` | `3:2` (Landscape) | `800 × 600 px` | WebP / JPEG | Artisanal craft & steeping ritual panel (Gaiwan, leaf sorting) |
| **`site_placement:home_newsletter`** | `1200 × 600 px` (or `800 × 800 px`) | `2:1` (Banner) / `1:1` (Square) | `600 × 600 px` | WebP / JPEG | Tea Society newsletter community graphic with tasting stamp |
| **`site_placement:home_values`** | `800 × 800 px` | `1:1` (Square) or `4:3` | `400 × 400 px` | WebP / JPEG | Direct garden sourcing assurance card |

Resource URI Templates:
- `tea://products/{slug}`: Product details, tasting notes, brewing parameters, and variants
- `tea://orders/{id}`: Order line items, payment status, and dispatch status
- `tea://categories/{slug}`: Category profile and associated products
- `tea://media/{id}`: Media asset metadata, dimensions, and reference audit
- `tea://blogs/{slug}`: Journal article markdown content, author, and SEO metadata
- `tea://site-placements/{section}`: Visual placement banner, media bindings, and CTA button destinations

### Capability 3: Prompts (Specialized Assistant Prompts)

- `tea-sommelier-recommendation {tasteProfile?, caffeinePreference?, timeOfDay?}`
- `order-status-inquiry {orderId, customerTone?}`
- `steeping-guide {slug, vessel?}`
- `inventory-restock-audit {stockThreshold?}`
- `promotional-campaign-planner {season, discountPercent?}`

### Capability 4: Logging (RFC 5424 Severity Control)

- `logging/setLevel {level}`: `debug`, `info`, `notice`, `warning`, `error`, `critical`, `alert`, `emergency`
- Real-time logging to `mcp_logs` SQLite table with audit duration, tool/resource target, arguments, and outcome status.

### Capability 5: Completion (Context Autocomplete)

- `completion/complete {ref?, argument: {name, value}}`:
  Contextual autocomplete for product and blog slugs (`slug`, `blogSlug`), categories (`category`), coupons (`code`), staff usernames (`username`), site placement keys (`section_key`), settings keys (`settingKey`), brewing vessels, and caffeine levels.

---

## 3. MCPO (Model Context Protocol to OpenAPI Proxy) & Open WebUI Integration

For environments like **Open WebUI** or systems requiring standard REST/OpenAPI interfaces:

### Option A: Run via MCPO CLI / uvx / Docker
Run the stdio bridge with `mcpo`:
```bash
# Via npm script
mcpo --port 8000 -- npm run mcp

# Or direct node execution
mcpo --port 8000 -- node scripts/mcp-server.mjs
```

### Option B: Native OpenAPI Spec
Himalayan Tea House natively exposes the complete OpenAPI 3.1 specification for all 36 tools at:
```
http://<host>/api/mcp/openapi
```
Point Open WebUI (or any OpenAPI client) directly to this URL, authenticate with `?token=<MCP_TOKEN>` or `Authorization: Bearer <MCP_TOKEN>`, and all tools become instantly executable.

## 5. LLM Connector & Client Compatibility (OpenAI / Claude / Cursor)

Modern LLM connectors enforce client-side safety policies, function name regexes (`^[a-zA-Z0-9_-]+$`), and parameter naming styles:

1. **Tool Annotations (`ToolAnnotations`):**
   - Every tool definition in `tools/list` provides RFC-compliant MCP annotations:
     - `readOnlyHint` (boolean): `true` for catalog reads, dimension queries, reports.
     - `destructiveHint` (boolean): `true` strictly for irreversible deletions (`admin.deleteEntity`, `media.deleteMedia`, `blog.deleteBlogPost`, `admin.deleteUser`, `orders.cancelOrder`).
     - Configuration updates (`admin.updateSettings`, `admin.updateHomepageContent`) are explicitly marked `destructiveHint: false`, allowing MCP connectors to execute routine store settings changes without false-positive blocking.
     - `idempotentHint` (boolean): `true` for safe replays.

2. **Identifier Normalization:**
   - Both dotted identifiers (`admin.updateSettings`) and underscore / hyphen equivalents (`admin_updateSettings`, `admin-updateSettings`) are accepted seamlessly by the tool dispatcher.

3. **Field Naming Flexibility:**
   - Write tools accept kebab-case, snake_case, and camelCase aliases (e.g. `store-name`, `store_name`, `storeName` for `admin.updateSettings`).

4. **Destructive Safety Guards:**
   - Destructive operations accept optional confirmation parameters (`confirmed: boolean` or `confirm: boolean`). If explicitly rejected (`false`), the request is blocked with error code `-32009`.
