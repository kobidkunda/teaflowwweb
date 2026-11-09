import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { isMcpAuthorized, mcpTokenFromUrl } from "../../src/lib/mcpAuth";
import {
  listToolDefinitions,
  dispatchToolCall,
  listResourceDefinitions,
  listResourceTemplateDefinitions,
  dispatchResourceRead,
  listPromptDefinitions,
  dispatchPromptGet,
  setMcpLogLevel,
  getMcpLogLevel,
  dispatchCompletion,
  MCP_CAPABILITIES,
  McpError,
} from "../../src/lib/mcp";
import { createDemoOrder } from "../../src/lib/checkout";
import { POST as mcpPostRoute } from "../../src/app/mcp/route";

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

// Isolated DB: temp file migrated fresh, so mutating-tool tests never touch dev data.
const TEST_DB = path.join(tmpdir(), `mcp-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
delete process.env.PAYMENT_WEBHOOK_SECRET;

function call<T>(name: string, args: unknown): T {
  return dispatchToolCall(name, args) as T;
}
function failsWith(name: string, args: unknown): number {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return (error as McpError).code;
  }
  throw new Error(`expected ${name} to fail`);
}

describe("mcp query-param auth", () => {
  beforeEach(() => {
    process.env.MCP_TOKEN = "test-token-123";
  });

  it("rejects a missing token", () => {
    expect(isMcpAuthorized(req("http://x/mcp"))).toBe(false);
  });
  it("rejects an empty token", () => {
    expect(isMcpAuthorized(req("http://x/mcp?token="))).toBe(false);
    expect(mcpTokenFromUrl(req("http://x/mcp?token="))).toBeNull();
  });
  it("rejects a wrong token (same and different length)", () => {
    expect(isMcpAuthorized(req("http://x/mcp?token=test-token-124"))).toBe(false);
    expect(isMcpAuthorized(req("http://x/mcp?token=short"))).toBe(false);
  });
  it("accepts the exact query-param token", () => {
    expect(isMcpAuthorized(req("http://x/mcp?token=test-token-123"))).toBe(true);
  });
  it("ignores the Authorization header — query only", () => {
    expect(
      isMcpAuthorized(req("http://x/mcp", { authorization: "Bearer test-token-123" }))
    ).toBe(false);
  });
  it("treats the param name case-sensitively", () => {
    expect(isMcpAuthorized(req("http://x/mcp?Token=test-token-123"))).toBe(false);
  });
  it("fails closed when MCP_TOKEN is unset", () => {
    delete process.env.MCP_TOKEN;
    expect(isMcpAuthorized(req("http://x/mcp?token=anything"))).toBe(false);
  });
});

describe("mcp 100% capabilities: full specification suite", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });
  afterAll(() => {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try { rmSync(TEST_DB + suffix, { force: true }); } catch { /* ignore */ }
    }
  });

  // -------------------------------------------------------------------------
  // 1. Core Capabilities Declaration
  // -------------------------------------------------------------------------
  it("declares 100% MCP server capabilities (tools, resources, prompts, logging, completion)", () => {
    expect(MCP_CAPABILITIES).toMatchObject({
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {},
      completion: {},
    });
  });

  // -------------------------------------------------------------------------
  // 2. Tools Capability (34 tools)
  // -------------------------------------------------------------------------
  it("exposes the full tool surface including media tools", () => {
    expect(listToolDefinitions().map((t) => t.name)).toEqual([
      "subscriptions.list", "subscriptions.savePolicy",
      "store.listProducts", "store.getProduct", "store.getProductSpecs",
      "store.listCategories", "store.getCategory",
      "store.listSliders", "store.validateCoupon",
      "admin.upsertProduct", "admin.createProduct", "admin.updateProduct", "admin.updateProductDetails", "admin.deleteProduct",
      "admin.setProductStatus", "admin.publishProduct", "admin.draftProduct",
      "admin.updateSteepingGuide", "admin.updateIngredients", "admin.updateSensoryProfile",
      "admin.updateLeafProfile", "admin.updateProvenance",
      "admin.listVariants", "admin.upsertVariant", "admin.createVariant", "admin.updateVariant", "admin.deleteVariant",
      "inventory.updateStock", "admin.updateInventory",
      "admin.upsertCategory", "admin.createCategory", "admin.updateCategory", "admin.deleteCategory",
      "admin.listProductImages", "admin.upsertProductImage", "admin.createProductImage", "admin.deleteProductImage",
      "admin.upsertSlider", "admin.createSlider", "admin.updateSlider", "admin.deleteSlider",
      "admin.listCoupons", "admin.getCoupon", "admin.upsertCoupon", "admin.createCoupon", "admin.updateCoupon", "admin.deleteCoupon",
      "admin.deleteEntity",
      "media.listMedia", "media.getImageRequirements", "media.uploadMedia", "media.replaceImage", "media.updateMetadata",
      "media.associateMedia", "media.deleteMedia",
      "orders.getOrder", "orders.listOrders", "orders.setDispatchStatus",
      "orders.cancelOrder", "orders.createDemoOrder",
      "blog.listBlogPosts", "blog.getBlogPost", "blog.upsertBlogPost", "blog.createBlogPost", "blog.updateBlogPost", "blog.deleteBlogPost",
      "store.getSettings", "admin.updateSettings",
      "store.getHomepageContent", "admin.updateHomepageContent",
      "admin.listSitePlacements", "admin.getSitePlacement", "admin.upsertSitePlacement", "admin.createSitePlacement", "admin.deleteSitePlacement",
      "admin.listUsers", "admin.upsertUser", "admin.createUser", "admin.updateUser", "admin.deleteUser",
      "payments.recordIntent", "payments.applyWebhook",
      "analytics.listAbandonedCarts", "analytics.getAbandonedCartDetails", "analytics.updateAbandonedCartStatus",
      "content.listPages", "content.getPage", "admin.upsertPage", "admin.deletePage",
      "content.getTextBlock", "admin.updateTextBlock", "content.listTextBlocks", "admin.deleteTextBlock",
      "store.getAnnouncement", "admin.updateAnnouncement",
      "store.getNavigation", "admin.updateNavigation", "admin.updateFooter",
      "store.getStoreInfo", "store.purgeMockupData",
      "email.listTemplates", "email.getTemplate", "email.updateTemplate", "email.previewTemplate",
      "email.sendTest", "email.getConfig", "email.generateDraft",
      "blendLab.listPlans", "blendLab.getPlan", "blendLab.upsertPlan",
      "blendLab.listProjects", "blendLab.getProject", "blendLab.updateProject",
      "blendLab.listCoverage", "blendLab.checkCoverage", "blendLab.upsertCoverage", "blendLab.deleteCoverage",
      "blendLab.getContent", "blendLab.updateContent",
      "trial_list", "trial_get", "trial_create", "trial_update",
      "trial_components_replace", "trial_media_attach", "trial_validate",
      "trial_submit_review", "trial_publish", "trial_unpublish",
      "trial_archive", "trial_history",
    ]);
  });

  it("rejects unknown tools and malformed arguments", () => {
    expect(failsWith("store.nope", {})).toBe(-32601);
    expect(failsWith("store.getProduct", {})).toBe(-32602);
    expect(failsWith("admin.upsertCoupon", { code: "X" })).toBe(-32602);
    expect(failsWith("payments.recordIntent", { orderId: "x" })).toBe(-32602);
    expect(failsWith("admin.deleteEntity", { entity: "orders", id: 1 })).toBe(-32602);
  });

  it("returns not-found for unknown product slugs and orders", () => {
    expect(failsWith("store.getProduct", { slug: "no-such-tea" })).toBe(-32004);
    expect(failsWith("orders.getOrder", { orderId: "no-such-order" })).toBe(-32004);
    expect(failsWith("admin.deleteEntity", { entity: "slider", id: 999999 })).toBe(-32004);
  });

  it("upserts a category with idempotency replay", () => {
    const key = "11111111-1111-4111-8111-111111111111";
    const first = call<{ id: number; slug: string; deduped: boolean }>(
      "admin.upsertCategory", { slug: "test-green", name: "Test Green", idempotencyKey: key });
    expect(first.slug).toBe("test-green");
    expect(first.deduped).toBe(false);
    const replay = call<{ id: number; deduped: boolean }>(
      "admin.upsertCategory", { slug: "test-green", name: "Test Green", idempotencyKey: key });
    expect(replay).toMatchObject({ id: first.id, deduped: true });
    const cats = call<{ categories: { slug: string }[] }>("store.listCategories", {});
    expect(cats.categories.some((c) => c.slug === "test-green")).toBe(true);
  });

  it("runs the catalogue chain: product, variant, image, slider, coupon", () => {
    const product = call<{ id: number; slug: string }>("admin.upsertProduct", {
      slug: "mcp-test-tea", name: "MCP Test Tea", category: "Test",
      origin: "Test origin", estate: "Test estate", flush: "Test flush",
      harvest_date: "Test harvest", description: "Test description.",
      tasting_notes: "Test notes", brew_temp: 90, brew_seconds: 180,
    });
    const variant = call<{ id: number; sku: string }>("admin.upsertVariant", {
      product_id: product.id, sku: "MCP-T-100", grams: 100, price_paise: 99900, stock: 10,
    });
    const image = call<{ id: number }>("admin.upsertProductImage", {
      product_id: product.id, url: "/tea.jpg", alt_text: "A cup of test tea",
    });
    expect(image.id).toBeGreaterThan(0);
    const slider = call<{ id: number }>("admin.upsertSlider", {
      title: "Test slider", image_url: "/hero.jpg",
    });
    expect(slider.id).toBeGreaterThan(0);
    const coupon = call<{ coupon: { code: string }; deduped: boolean }>("admin.upsertCoupon", {
      code: "MCP10", kind: "percent", value: 10,
    });
    expect(coupon.coupon.code).toBe("MCP10");
    const quote = call<{ valid: boolean; discountPaise: number }>(
      "store.validateCoupon", { code: "MCP10", subtotalPaise: 100000 });
    expect(quote).toMatchObject({ valid: true, discountPaise: 10000 });
    const fetched = call<{ product: { slug: string; variants: unknown[] } }>(
      "store.getProduct", { slug: "mcp-test-tea" });
    expect(fetched.product.variants.length).toBe(1);
    expect(variant.sku).toBe("MCP-T-100");
  });

  it("supports minimal product creation and direct price updates via admin.upsertProduct", () => {
    // 1. Create with minimal payload: only name and price in INR
    const created = call<{ id: number; slug: string; price: number; price_paise: number }>(
      "admin.upsertProduct",
      { name: "Live Special Flush", price: 199 }
    );
    expect(created.id).toBeGreaterThan(0);
    expect(created.price).toBe(199);
    expect(created.price_paise).toBe(19900);

    const fetched = call<{ product: { slug: string; price: number; price_paise: number; variants: { price_paise: number }[] } }>(
      "store.getProduct",
      { slug: created.slug }
    );
    expect(fetched.product.price).toBe(199);
    expect(fetched.product.price_paise).toBe(19900);
    expect(fetched.product.variants[0].price_paise).toBe(19900);

    // 2. Direct price update via MCP
    const updated = call<{ id: number; slug: string; price: number; price_paise: number }>(
      "admin.upsertProduct",
      { slug: created.slug, price: 299 }
    );
    expect(updated.price).toBe(299);
    expect(updated.price_paise).toBe(29900);

    const reFetched = call<{ product: { price: number; price_paise: number; variants: { price_paise: number }[] } }>(
      "store.getProduct",
      { slug: created.slug }
    );
    expect(reFetched.product.price).toBe(299);
    expect(reFetched.product.variants[0].price_paise).toBe(29900);
  });

  it("drives order dispatch, payment intent and webhook rejection", async () => {
    const { createDemoOrder } = await import("../../src/lib/checkout");
    const variantRow = call<{ product: { variants: { id: number }[] } }>(
      "store.getProduct", { slug: "mcp-test-tea" });
    const order = createDemoOrder({
      name: "MCP Tester", email: "mcp@example.com", address: "1 Test Street, Test City",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      items: [{ variantId: variantRow.product.variants[0].id, quantity: 1 }],
    });
    const got = call<{ order: { id: string; dispatch_status: string } }>(
      "orders.getOrder", { orderId: order.orderId });
    expect(got.order.id).toBe(order.orderId);
    const preparing = call<{ order: { dispatch_status: string }; deduped: boolean }>(
      "orders.setDispatchStatus", { orderId: order.orderId, to: "preparing" });
    expect(preparing.order.dispatch_status).toBe("preparing");
    expect(failsWith("orders.setDispatchStatus", { orderId: order.orderId, to: "shipped" })).toBe(-32009);
    const listed = call<{ orders: unknown[] }>(
      "orders.listOrders", { dispatchStatus: "preparing", limit: 10 });
    expect(listed.orders.length).toBeGreaterThanOrEqual(1);
    const intent = call<{ payment: { status: string }; deduped: boolean }>(
      "payments.recordIntent", {
        orderId: order.orderId, amountPaise: 109800,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      });
    expect(intent.payment.status).toBe("payment_pending");
    expect(intent.deduped).toBe(false);
    const rejected = call<{ ok: boolean }>("payments.applyWebhook", {
      gatewayPaymentId: "gw-1", status: "paid", signature: "00",
    });
    expect(rejected.ok).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. Resources Capability (static & dynamic templates)
  // -------------------------------------------------------------------------
  it("exposes all static resources and resource templates", () => {
    const resources = listResourceDefinitions();
    expect(resources.map((r) => r.uri)).toEqual([
      "tea://catalog/products",
      "tea://catalog/categories",
      "tea://catalog/sliders",
      "tea://store/coupons",
      "tea://store/status",
      "tea://orders/recent",
      "tea://media/recent",
      "tea://media/requirements",
      "tea://store/settings",
      "tea://content/homepage",
      "tea://content/blogs",
      "tea://analytics/abandoned-carts",
      "tea://pages",
      "tea://announcement",
      "tea://navigation",
      "tea://blend-lab/plans",
      "tea://blend-lab/content",
      "tea://blend-lab/projects",
      "tea://content/blocks",
      "tea://email/templates",
    ]);

    const templates = listResourceTemplateDefinitions();
    expect(templates.map((t) => t.uriTemplate)).toEqual([
      "tea://products/{slug}",
      "tea://orders/{id}",
      "tea://categories/{slug}",
      "tea://media/{id}",
      "tea://blogs/{slug}",
      "tea://site-placements/{section}",
      "tea://pages/{slug}",
      "tea://content/{key}",
    ]);
  });

  it("reads static resources with valid JSON payloads", () => {
    const productsRes = dispatchResourceRead("tea://catalog/products");
    expect(productsRes.contents).toHaveLength(1);
    expect(productsRes.contents[0].mimeType).toBe("application/json");
    const productsData = JSON.parse(productsRes.contents[0].text);
    expect(Array.isArray(productsData)).toBe(true);

    const categoriesRes = dispatchResourceRead("tea://catalog/categories");
    const categoriesData = JSON.parse(categoriesRes.contents[0].text);
    expect(Array.isArray(categoriesData)).toBe(true);

    const statusRes = dispatchResourceRead("tea://store/status");
    const statusData = JSON.parse(statusRes.contents[0].text);
    expect(statusData.status).toBe("operational");
    expect(statusData.capabilities_coverage).toBe("100%");
  });

  it("reads dynamic parameterized resource templates", () => {
    const productRes = dispatchResourceRead("tea://products/mcp-test-tea");
    const productData = JSON.parse(productRes.contents[0].text);
    expect(productData.product.slug).toBe("mcp-test-tea");
    expect(productData.images).toBeDefined();
    expect(productData.specs).toBeDefined();
    expect(productData.specs.cupping).toBeDefined();

    const categoryRes = dispatchResourceRead("tea://categories/test-green");
    const categoryData = JSON.parse(categoryRes.contents[0].text);
    expect(categoryData.category.slug).toBe("test-green");

    const settingsRes = dispatchResourceRead("tea://store/settings");
    const settingsData = JSON.parse(settingsRes.contents[0].text);
    expect(settingsData.store_name).toBeDefined();

    const homepageRes = dispatchResourceRead("tea://content/homepage");
    expect(homepageRes.contents).toHaveLength(1);
  });

  it("edits everything: blogs, settings, homepage content, users, placements, and cancels orders", async () => {
    // 1. Settings
    const initialSettings = call<{ settings: { store_name: string } }>("store.getSettings", {});
    expect(initialSettings.settings.store_name).toBeDefined();
    const updatedSettings = call<{ settings: { store_name: string; tax_rate_percent: number } }>(
      "admin.updateSettings",
      { store_name: "Himalayan Tea Sanctuary", tax_rate_percent: 12 }
    );
    expect(updatedSettings.settings.store_name).toBe("Himalayan Tea Sanctuary");
    expect(updatedSettings.settings.tax_rate_percent).toBe(12);

    // 2. Blog Posts
    const blog = call<{ post: { id: number; slug: string; title: string }; deduped: boolean }>(
      "blog.upsertBlogPost",
      {
        title: "The Magic of Spring Flush",
        slug: "magic-of-spring-flush",
        content: "Detailed harvesting guide...",
        summary: "Darjeeling first flush secrets.",
        status: "published",
      }
    );
    expect(blog.post.slug).toBe("magic-of-spring-flush");
    const fetchedBlog = call<{ post: { title: string } }>("blog.getBlogPost", { slugOrId: "magic-of-spring-flush" });
    expect(fetchedBlog.post.title).toBe("The Magic of Spring Flush");
    const blogList = call<{ posts: { slug: string }[] }>("blog.listBlogPosts", { status: "published" });
    expect(blogList.posts.some((p) => p.slug === "magic-of-spring-flush")).toBe(true);

    // Read dynamic blog resource
    const blogRes = dispatchResourceRead("tea://blogs/magic-of-spring-flush");
    const blogResData = JSON.parse(blogRes.contents[0].text);
    expect(blogResData.slug).toBe("magic-of-spring-flush");

    // 3. Homepage & Site Placement
    const placement = call<{ placement: { section_key: string; title: string } }>(
      "admin.upsertSitePlacement",
      { section_key: "hero-banner", title: "Harvest Fresh 2026", image_url: "/hero.jpg" }
    );
    expect(placement.placement.section_key).toBe("hero-banner");
    expect(placement.placement.title).toBe("Harvest Fresh 2026");

    const placementRes = dispatchResourceRead("tea://site-placements/hero-banner");
    const placementResData = JSON.parse(placementRes.contents[0].text);
    expect(placementResData.title).toBe("Harvest Fresh 2026");

    // 4. Staff Users
    const user = call<{ user: { id: number; username: string; role: string } }>(
      "admin.upsertUser",
      { username: "tea_curator", email: "curator@himalayan.com", password: "Password123!", role: "admin" }
    );
    expect(user.user.username).toBe("tea_curator");
    const users = call<{ users: { username: string }[] }>("admin.listUsers", {});
    expect(users.users.some((u) => u.username === "tea_curator")).toBe(true);

    // 5. Delete Entity with blog and user
    const deletedBlog = call<{ deleted: boolean }>("admin.deleteEntity", { entity: "blog", id: blog.post.id });
    expect(deletedBlog.deleted).toBe(true);
    const deletedUser = call<{ deleted: boolean }>("admin.deleteEntity", { entity: "user", id: user.user.id });
    expect(deletedUser.deleted).toBe(true);

    // 6. Cancel order via orders.cancelOrder
    expect(failsWith("orders.cancelOrder", { orderId: "ord_missing" })).toBe(-32004);

    // Cancel a real demo order
    const variantRow = call<{ product: { variants: { id: number }[] } }>("store.getProduct", { slug: "mcp-test-tea" });
    const orderToCancel = createDemoOrder({
      name: "Cancel Tester",
      email: "cancel@example.com",
      address: "9 Cancel Ave",
      idempotencyKey: "99999999-9999-4999-8999-999999999999",
      items: [{ variantId: variantRow.product.variants[0].id, quantity: 1 }],
    });
    const cancelled = call<{ order: { dispatch_status: string } }>("orders.cancelOrder", { orderId: orderToCancel.orderId });
    expect(cancelled.order.dispatch_status).toBe("cancelled");
  });

  it("rejects non-existent resource URIs with -32004", () => {
    expect(() => dispatchResourceRead("tea://products/nonexistent-tea")).toThrowError();
    try {
      dispatchResourceRead("tea://products/nonexistent-tea");
    } catch (e) {
      expect((e as McpError).code).toBe(-32004);
    }

    try {
      dispatchResourceRead("tea://unknown-scheme/foo");
    } catch (e) {
      expect((e as McpError).code).toBe(-32004);
    }
  });

  // -------------------------------------------------------------------------
  // 4. Prompts Capability
  // -------------------------------------------------------------------------
  it("exposes all 5 AI prompt templates", () => {
    const prompts = listPromptDefinitions();
    expect(prompts.map((p) => p.name)).toEqual([
      "tea-sommelier-recommendation",
      "order-status-inquiry",
      "steeping-guide",
      "inventory-restock-audit",
      "promotional-campaign-planner",
      "generate_cart_recovery_message",
      "page-content-editor",
      "announcement-banner-copywriter",
      "site-rebranding-planner",
      "email-template-composer",
    ]);
  });

  it("renders prompts with arguments correctly", () => {
    const sommelier = dispatchPromptGet("tea-sommelier-recommendation", {
      tasteProfile: "floral, honey",
      caffeinePreference: "medium",
      timeOfDay: "afternoon",
    }) as { messages: Array<{ role: string; content: { text: string } }> };
    expect(sommelier.messages[0].content.text).toContain("floral, honey");
    expect(sommelier.messages[0].content.text).toContain("afternoon");

    const guide = dispatchPromptGet("steeping-guide", {
      slug: "mcp-test-tea",
      vessel: "gaiwan",
    }) as { messages: Array<{ role: string; content: { text: string } }> };
    expect(guide.messages[0].content.text).toContain("mcp-test-tea");
    expect(guide.messages[0].content.text).toContain("gaiwan");
  });

  it("validates required prompt arguments and unknown prompt names", () => {
    expect(() => dispatchPromptGet("order-status-inquiry", {})).toThrowError();
    try {
      dispatchPromptGet("order-status-inquiry", {});
    } catch (e) {
      expect((e as McpError).code).toBe(-32602);
    }

    expect(() => dispatchPromptGet("unknown-prompt", {})).toThrowError();
    try {
      dispatchPromptGet("unknown-prompt", {});
    } catch (e) {
      expect((e as McpError).code).toBe(-32601);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Logging Capability (RFC 5424)
  // -------------------------------------------------------------------------
  it("sets and retrieves MCP log levels", () => {
    const res = setMcpLogLevel("debug");
    expect(res).toEqual({ ok: true, level: "debug" });
    expect(getMcpLogLevel()).toBe("debug");

    setMcpLogLevel("warning");
    expect(getMcpLogLevel()).toBe("warning");

    expect(() => setMcpLogLevel("invalid-level")).toThrowError();
    try {
      setMcpLogLevel("invalid-level");
    } catch (e) {
      expect((e as McpError).code).toBe(-32602);
    }
  });

  // -------------------------------------------------------------------------
  // 6. Completion Capability
  // -------------------------------------------------------------------------
  it("provides contextual autocomplete completions", () => {
    const slugComp = dispatchCompletion(null, { name: "slug", value: "mcp" });
    expect(slugComp.completion.values).toContain("mcp-test-tea");

    const catComp = dispatchCompletion(null, { name: "category", value: "test" });
    expect(catComp.completion.values).toContain("test-green");

    const timeComp = dispatchCompletion(null, { name: "timeOfDay", value: "morn" });
    expect(timeComp.completion.values).toEqual(["morning"]);

    const vesselComp = dispatchCompletion(null, { name: "vessel", value: "gai" });
    expect(vesselComp.completion.values).toEqual(["gaiwan"]);
  });

  // -------------------------------------------------------------------------
  // 7. Route HTTP End-to-End Handshake Matrix
  // -------------------------------------------------------------------------
  it("handles complete JSON-RPC 2.0 lifecycle over /mcp endpoint", async () => {
    process.env.MCP_TOKEN = "secret-token-test";

    // 1. initialize
    const initReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
    });
    const initRes = await mcpPostRoute(initReq);
    expect(initRes.status).toBe(200);
    const initBody = await initRes.json();
    expect(initBody.result.capabilities).toMatchObject({
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {},
      completion: {},
    });

    // 2. ping & notifications
    const pingReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }),
    });
    const pingRes = await mcpPostRoute(pingReq);
    const pingBody = await pingRes.json();
    expect(pingBody.result).toEqual({});

    const notifReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    const notifRes = await mcpPostRoute(notifReq);
    expect(notifRes.status).toBe(202);

    // 3. resources/list and resources/read via HTTP
    const resListReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/list" }),
    });
    const resListRes = await mcpPostRoute(resListReq);
    const resListBody = await resListRes.json();
    expect(resListBody.result.resources.length).toBeGreaterThanOrEqual(6);

    const resReadReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "tea://store/status" } }),
    });
    const resReadRes = await mcpPostRoute(resReadReq);
    const resReadBody = await resReadRes.json();
    expect(resReadBody.result.contents[0].uri).toBe("tea://store/status");

    // 4. prompts/list and prompts/get via HTTP
    const promptListReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "prompts/list" }),
    });
    const promptListRes = await mcpPostRoute(promptListReq);
    const promptListBody = await promptListRes.json();
    expect(promptListBody.result.prompts.length).toBe(10);

    // 5. logging and completion via HTTP
    const logReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 6, method: "logging/setLevel", params: { level: "info" } }),
    });
    const logRes = await mcpPostRoute(logReq);
    const logBody = await logRes.json();
    expect(logBody.result.level).toBe("info");

    const compReq = new Request("http://localhost:3000/mcp?token=secret-token-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "completion/complete", params: { argument: { name: "vessel", value: "gai" } } }),
    });
    const compRes = await mcpPostRoute(compReq);
    const compBody = await compRes.json();
    expect(compBody.result.completion.values).toContain("gaiwan");
  });

  // -------------------------------------------------------------------------
  // 8. Tool Annotations & Connector Normalization (OpenAI / Claude MCP)
  // -------------------------------------------------------------------------
  it("exposes annotations for all tools with safe vs destructive hints", () => {
    const tools = listToolDefinitions() as Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: {
        title?: string;
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
      };
    }>;

    expect(tools.length).toBe(131);

    for (const tool of tools) {
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations?.title).toBe("string");
      expect(typeof tool.annotations?.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint).toBe("boolean");
      expect(typeof tool.annotations?.idempotentHint).toBe("boolean");
    }

    const destructiveTools = ["admin.deleteEntity", "media.deleteMedia", "blog.deleteBlogPost", "admin.deleteUser", "orders.cancelOrder"];
    for (const name of destructiveTools) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.annotations?.destructiveHint).toBe(true);
    }

    // Critical safe update operations must not be flagged as destructive to prevent connector write blocks
    const safeUpdateTools = ["admin.updateSettings", "admin.updateHomepageContent", "admin.upsertProduct", "admin.upsertVariant", "inventory.updateStock"];
    for (const name of safeUpdateTools) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.annotations?.destructiveHint).toBe(false);
      expect(tool?.annotations?.readOnlyHint).toBe(false);
    }
  });

  it("dispatches tools using dot, underscore, and hyphen identifiers", () => {
    // Both standard dot-notation and OpenAI/connector underscore/hyphen-notation must dispatch smoothly
    const dotRes = dispatchToolCall("store.getSettings", {}) as { settings: { store_name: string } };
    expect(dotRes.settings).toBeDefined();

    const underscoreRes = dispatchToolCall("store_getSettings", {}) as { settings: { store_name: string } };
    expect(underscoreRes.settings).toBeDefined();

    const hyphenRes = dispatchToolCall("store-getSettings", {}) as { settings: { store_name: string } };
    expect(hyphenRes.settings).toBeDefined();

    const caseRes = dispatchToolCall("STORE_GETSETTINGS", {}) as { settings: { store_name: string } };
    expect(caseRes.settings).toBeDefined();
  });

  it("handles store-name update payloads in kebab-case, snake_case, and camelCase", () => {
    // 1. Kebab-case ("store-name")
    const res1 = dispatchToolCall("admin_updateSettings", {
      "store-name": "Tea Floww Kebab Test",
    }) as { settings: { store_name: string } };
    expect(res1.settings.store_name).toBe("Tea Floww Kebab Test");

    // 2. CamelCase ("storeName")
    const res2 = dispatchToolCall("admin.updateSettings", {
      storeName: "Tea Floww Camel Test",
    }) as { settings: { store_name: string } };
    expect(res2.settings.store_name).toBe("Tea Floww Camel Test");

    // 3. Snake_case ("store_name")
    const res3 = dispatchToolCall("admin-updateSettings", {
      store_name: "Himalayan Tea House",
    }) as { settings: { store_name: string } };
    expect(res3.settings.store_name).toBe("Himalayan Tea House");
  });

  it("guards destructive actions when confirmation is explicitly rejected", () => {
    expect(() =>
      dispatchToolCall("admin.deleteEntity", {
        entity: "product",
        id: 99999,
        confirmed: false,
      })
    ).toThrowError();

    try {
      dispatchToolCall("admin.deleteEntity", {
        entity: "product",
        id: 99999,
        confirm: false,
      });
    } catch (e) {
      expect((e as McpError).code).toBe(-32009);
    }

    try {
      dispatchToolCall("media.deleteMedia", {
        id: 99999,
        confirmed: false,
      });
    } catch (e) {
      expect((e as McpError).code).toBe(-32009);
    }

    try {
      dispatchToolCall("blog.deleteBlogPost", {
        idOrSlug: "non-existent-blog",
        confirm: false,
      });
    } catch (e) {
      expect((e as McpError).code).toBe(-32009);
    }
  });

  // -------------------------------------------------------------------------
  // 6. Complete Entity CRUD & Technical Specifications Coverage
  // -------------------------------------------------------------------------
  it("provides full CRUD and technical specifications for all catalogue entities", async () => {
    // A. Product Specifications via store.getProductSpecs and store.getProduct
    const specsBySlug = call<{
      product_id: number;
      slug: string;
      specs: {
        cupping: {
          scores: { floral: number; fruity: number; malty: number; body: number; sweetness: number; earthy: number };
          dry_leaf: { appearance: string; grade: string; aroma: string };
          liquor: { hue_hex: string; hue_name: string; clarity: string; body: string };
          wet_leaf: { aroma: string; oxidation: string };
          aroma_tags: string[];
        };
        steeping: { brew_temp: number; brew_seconds: number; leaf_dose_grams: number; water_ml: number; steep_count: number };
        terroir: { origin: string; estate: string; flush: string; harvest_date: string; elevation_feet: number };
        pricing: { price: number; price_paise: number };
        packaging: { variant_count: number };
      };
    }>("store.getProductSpecs", { slug: "mcp-test-tea" });

    expect(specsBySlug.slug).toBe("mcp-test-tea");
    expect(specsBySlug.specs).toBeDefined();
    expect(specsBySlug.specs.cupping.scores.floral).toBeDefined();
    expect(specsBySlug.specs.steeping.brew_temp).toBe(90);
    expect(specsBySlug.specs.steeping.brew_seconds).toBe(180);
    expect(specsBySlug.specs.terroir.origin).toBe("Test origin");
    expect(specsBySlug.specs.pricing.price).toBeDefined();

    // Query specs by numeric ID
    const specsById = call<{ slug: string }>("store.getProductSpecs", { id: specsBySlug.product_id });
    expect(specsById.slug).toBe("mcp-test-tea");

    // store.getProduct returns specs
    const productWithSpecs = call<{
      product: { slug: string };
      specs: { cupping: unknown; steeping: unknown };
    }>("store.getProduct", { slug: "mcp-test-tea" });
    expect(productWithSpecs.specs).toBeDefined();

    // B. Product CRUD: createProduct, updateProduct, deleteProduct
    const newProd = call<{
      id: number;
      slug: string;
      price: number;
      specs: { terroir: { estate: string }; pricing: { price: number } };
    }>("admin.createProduct", {
      name: "Makaibari Silver Needle Reserve",
      price: 199,
      estate: "Makaibari Estate",
      origin: "Kurseong, Darjeeling",
      brew_temp: 85,
      brew_seconds: 240,
    });
    expect(newProd.id).toBeGreaterThan(0);
    expect(newProd.price).toBe(199);
    expect(newProd.specs.terroir.estate).toBe("Makaibari Estate");

    const updatedProd = call<{
      id: number;
      slug: string;
      price: number;
      specs: { pricing: { price: number } };
    }>("admin.updateProduct", {
      slug: newProd.slug,
      price: 249,
    });
    expect(updatedProd.price).toBe(249);
    expect(updatedProd.specs.pricing.price).toBe(249);

    // C. Variant CRUD: createVariant, updateVariant, listVariants, deleteVariant
    const newVar = call<{ id: number; sku: string }>("admin.createVariant", {
      product_id: newProd.id,
      sku: "MK-SILVER-50G",
      grams: 50,
      price_paise: 14900,
      stock: 35,
      packaging_format: "luxury_tin",
      servings: 25,
    });
    expect(newVar.sku).toBe("MK-SILVER-50G");

    const updatedVar = call<{ id: number; sku: string }>("admin.updateVariant", {
      product_id: newProd.id,
      sku: "MK-SILVER-50G",
      grams: 50,
      price_paise: 13900,
      stock: 40,
    });
    expect(updatedVar.sku).toBe("MK-SILVER-50G");

    const variantsList = call<{ variants: { sku: string }[] }>("admin.listVariants", {
      product_id: newProd.id,
    });
    expect(variantsList.variants.some((v) => v.sku === "MK-SILVER-50G")).toBe(true);

    const deletedVar = call<{ deleted: boolean }>("admin.deleteVariant", {
      sku: "MK-SILVER-50G",
      confirmed: true,
    });
    expect(deletedVar.deleted).toBe(true);

    // D. Category CRUD: createCategory, getCategory, updateCategory, deleteCategory
    const newCat = call<{ id: number; slug: string }>("admin.createCategory", {
      slug: "white-reserve",
      name: "White Reserve Teas",
      description: "Rare sun-dried white teas.",
    });
    expect(newCat.slug).toBe("white-reserve");

    const fetchedCat = call<{ category: { slug: string; name: string } }>("store.getCategory", {
      slug: "white-reserve",
    });
    expect(fetchedCat.category.name).toBe("White Reserve Teas");

    const updatedCat = call<{ id: number; slug: string }>("admin.updateCategory", {
      slug: "white-reserve",
      name: "Artisanal White Reserve",
    });
    expect(updatedCat.slug).toBe("white-reserve");

    const deletedCat = call<{ deleted: boolean }>("admin.deleteCategory", {
      slug: "white-reserve",
      confirmed: true,
    });
    expect(deletedCat.deleted).toBe(true);

    // E. Product Images CRUD: createProductImage, listProductImages, deleteProductImage
    const newImg = call<{ id: number }>("admin.createProductImage", {
      product_id: newProd.id,
      url: "/images/tea-gallery-test.webp",
      alt_text: "Fresh whole white tea needle leaves",
    });
    expect(newImg.id).toBeGreaterThan(0);

    const imgList = call<{ images: { id: number; url: string }[] }>("admin.listProductImages", {
      product_id: newProd.id,
    });
    expect(imgList.images.some((i) => i.url === "/images/tea-gallery-test.webp")).toBe(true);

    const deletedImg = call<{ deleted: boolean }>("admin.deleteProductImage", {
      id: newImg.id,
      confirmed: true,
    });
    expect(deletedImg.deleted).toBe(true);

    // Delete Product
    const deletedProd = call<{ deleted: boolean }>("admin.deleteProduct", {
      slug: newProd.slug,
      confirmed: true,
    });
    expect(deletedProd.deleted).toBe(true);

    // F. Slider CRUD: createSlider, updateSlider, deleteSlider
    const sliderCreated = call<{ id: number }>("admin.createSlider", {
      title: "Spring Symphony 2026",
      image_url: "/banners/spring.webp",
      fg_image_url: "/banners/spring-fg.webp",
    });
    expect(sliderCreated.id).toBeGreaterThan(0);

    const sliderUpdated = call<{ id: number }>("admin.updateSlider", {
      id: sliderCreated.id,
      title: "Spring Symphony 2026 Live",
      image_url: "/banners/spring-live.webp",
      fg_image_url: "/banners/spring-card.webp",
    });
    expect(sliderUpdated.id).toBe(sliderCreated.id);

    // Partial update: updating ONLY fg_image_url without title or image_url
    const partialFgUpdate = call<{ id: number }>("admin.updateSlider", {
      id: sliderCreated.id,
      fg_image_url: "/banners/spring-harvest.webp",
    });
    expect(partialFgUpdate.id).toBe(sliderCreated.id);

    // Update Featured Harvest Card content via MCP admin.updateSlider
    const cardContentUpdate = call<{ id: number; slider: Record<string, unknown> }>("admin.updateSlider", {
      id: sliderCreated.id,
      card_tag: "2026 Spring Reserve",
      card_title: "Darjeeling First Flush Artisanal",
      card_subtitle: "Single Estate · 6,800 ft",
      card_tasting_notes: "Muscatel • Wild Orchid",
      card_quote: "From Our Gardens to Your Cup",
      card_badge: "LIMITED RESERVE",
      card_cta_label: "Shop This Flush",
      card_cta_href: "/collections/darjeeling",
    });
    expect(cardContentUpdate.slider.card_title).toBe("Darjeeling First Flush Artisanal");
    expect(cardContentUpdate.slider.card_badge).toBe("LIMITED RESERVE");
    expect(cardContentUpdate.slider.card_cta_label).toBe("Shop This Flush");
    expect(cardContentUpdate.slider.card_tasting_notes).toBe("Muscatel • Wild Orchid");

    // Disable front card via MCP admin.updateSlider
    const disableCardUpdate = call<{ id: number; slider: Record<string, unknown> }>("admin.updateSlider", {
      id: sliderCreated.id,
      card_enabled: 0,
    });
    expect(disableCardUpdate.slider.card_enabled).toBe(0);

    // Verify through store.listSliders
    const slidersList = call<{ sliders: { id: number; image_url: string; fg_image_url: string; card_title?: string; card_badge?: string; card_enabled?: number }[] }>("store.listSliders", {});
    const activeSlide = slidersList.sliders.find((s) => s.id === sliderCreated.id);
    expect(activeSlide).toBeDefined();
    expect(activeSlide?.image_url).toBe("/banners/spring-live.webp");
    expect(activeSlide?.fg_image_url).toBe("/banners/spring-harvest.webp");
    expect(activeSlide?.card_title).toBe("Darjeeling First Flush Artisanal");
    expect(activeSlide?.card_badge).toBe("LIMITED RESERVE");
    expect(activeSlide?.card_enabled).toBe(0);

    // Test media.associateMedia with slot: "fg" if media exists
    const mediaList = call<{ items: { id: number; url: string }[] }>("media.listMedia", {});
    if (mediaList.items && mediaList.items.length > 0) {
      const asset = mediaList.items[0];
      const assocRes = call<{ associated: boolean; slot: string }>("media.associateMedia", {
        media_id: asset.id,
        entity_type: "slider",
        entity_id: sliderCreated.id,
        slot: "fg",
      });
      expect(assocRes.associated).toBe(true);
      expect(assocRes.slot).toBe("fg");

      const verifyAssoc = call<{ sliders: { id: number; fg_image_url: string }[] }>("store.listSliders", {});
      const assocSlide = verifyAssoc.sliders.find((s) => s.id === sliderCreated.id);
      expect(assocSlide?.fg_image_url).toBe(asset.url);
    }

    const sliderDeleted = call<{ deleted: boolean }>("admin.deleteSlider", {
      id: sliderCreated.id,
      confirmed: true,
    });
    expect(sliderDeleted.deleted).toBe(true);

    // G. Coupon CRUD: createCoupon, getCoupon, listCoupons, updateCoupon, deleteCoupon
    const newCoupon = call<{ coupon: { code: string } }>("admin.createCoupon", {
      code: "FESTIVE25",
      kind: "percent",
      value: 25,
    });
    expect(newCoupon.coupon.code).toBe("FESTIVE25");

    const gotCoupon = call<{ coupon: { code: string; value: number } }>("admin.getCoupon", {
      code: "FESTIVE25",
    });
    expect(gotCoupon.coupon.value).toBe(25);

    const couponsList = call<{ coupons: { code: string }[] }>("admin.listCoupons", {});
    expect(couponsList.coupons.some((c) => c.code === "FESTIVE25")).toBe(true);

    const updatedCoupon = call<{ coupon: { code: string; value: number } }>("admin.updateCoupon", {
      code: "FESTIVE25",
      kind: "percent",
      value: 30,
    });
    expect(updatedCoupon.coupon.value).toBe(30);

    const deletedCoupon = call<{ deleted: boolean }>("admin.deleteCoupon", {
      code: "FESTIVE25",
      confirmed: true,
    });
    expect(deletedCoupon.deleted).toBe(true);

    // H. Blog CRUD: createBlogPost, updateBlogPost
    const newArticle = call<{ post: { id: number; slug: string } }>("blog.createBlogPost", {
      title: "Muscatel Alchemy: Second Flush Notes",
      slug: "muscatel-alchemy",
      content: "Exploring the terroir behind Darjeeling muscatel character.",
    });
    expect(newArticle.post.slug).toBe("muscatel-alchemy");

    const updatedArticle = call<{ post: { title: string } }>("blog.updateBlogPost", {
      id: newArticle.post.id,
      title: "Muscatel Alchemy: Second Flush Notes 2026",
      content: "Updated notes on Muscatel terroir.",
    });
    expect(updatedArticle.post.title).toBe("Muscatel Alchemy: Second Flush Notes 2026");

    const deletedArticle = call<{ deleted: boolean }>("blog.deleteBlogPost", {
      idOrSlug: newArticle.post.id,
      confirmed: true,
    });
    expect(deletedArticle.deleted).toBe(true);

    // I. Site Placements CRUD: createSitePlacement, getSitePlacement, listSitePlacements, deleteSitePlacement
    const newPlacement = call<{ placement: { section_key: string } }>("admin.createSitePlacement", {
      section_key: "summer_spotlight",
      title: "Summer Solstice Flushes",
      image_url: "/placements/summer.webp",
    });
    expect(newPlacement.placement.section_key).toBe("summer_spotlight");

    const gotPlacement = call<{ placement: { title: string }; required_dimensions: unknown }>("admin.getSitePlacement", {
      section_key: "summer_spotlight",
    });
    expect(gotPlacement.placement.title).toBe("Summer Solstice Flushes");
    expect(gotPlacement.required_dimensions).toBeDefined();

    const placementsList = call<{ placements: { section_key: string }[] }>("admin.listSitePlacements", {});
    expect(placementsList.placements.some((p) => p.section_key === "summer_spotlight")).toBe(true);

    const deletedPlacement = call<{ deleted: boolean }>("admin.deleteSitePlacement", {
      section_key: "summer_spotlight",
      confirmed: true,
    });
    expect(deletedPlacement.deleted).toBe(true);

    // J. Staff Users CRUD: createUser, updateUser, deleteUser
    const newUser = call<{ user: { id: number; username: string } }>("admin.createUser", {
      username: "tea_sommelier_bob",
      email: "bob@himalayantea.com",
      role: "admin",
      password: "BobPassword123!",
    });
    expect(newUser.user.username).toBe("tea_sommelier_bob");

    const updatedUser = call<{ user: { id: number; username: string; role: string } }>("admin.updateUser", {
      id: newUser.user.id,
      username: "tea_sommelier_bob",
      email: "bob_updated@himalayantea.com",
    });
    expect(updatedUser.user.username).toBe("tea_sommelier_bob");
    const staffList = call<{ users: { id: number; email: string }[] }>("admin.listUsers", {});
    expect(staffList.users.find((u) => u.id === newUser.user.id)?.email).toBe("bob_updated@himalayantea.com");

    const deletedStaff = call<{ deleted: boolean }>("admin.deleteUser", {
      id: newUser.user.id,
      confirmed: true,
    });
    expect(deletedStaff.deleted).toBe(true);

    // K. Orders Demo Creation: orders.createDemoOrder
    const prodForOrder = call<{ product: { variants: { id: number }[] } }>("store.getProduct", { slug: "mcp-test-tea" });
    const demoOrder = call<{ orderId: string; totalPaise: number }>("orders.createDemoOrder", {
      name: "Demo Sommelier Client",
      email: "sommelier_demo@example.com",
      address: "Estate House 1, Darjeeling, West Bengal",
      idempotencyKey: "88888888-8888-4888-8888-888888888888",
      items: [{ variantId: prodForOrder.product.variants[0].id, quantity: 2 }],
    });
    expect(demoOrder.orderId).toBeDefined();
    expect(demoOrder.totalPaise).toBeGreaterThan(0);

    // L. Universal Deletion: admin.deleteEntity with site_placement and string slug
    const tempPlacement = call<{ placement: { section_key: string } }>("admin.createSitePlacement", {
      section_key: "temp_footer_banner",
      title: "Temporary Banner",
    });
    expect(tempPlacement.placement.section_key).toBe("temp_footer_banner");
    const universalDeletedPlacement = call<{ deleted: boolean }>("admin.deleteEntity", {
      entity: "site_placement",
      id: "temp_footer_banner",
      confirmed: true,
    });
    expect(universalDeletedPlacement.deleted).toBe(true);

    // M. Tool Aliases in dispatchToolCall (create_product, get_product_specs, delete_product)
    const aliasedCreated = dispatchToolCall("create_product", {
      name: "Giddapahar Muscatel Delight",
      price: 199,
    }) as { id: number; slug: string; specs: { cupping: unknown } };
    expect(aliasedCreated.id).toBeGreaterThan(0);
    expect(aliasedCreated.specs).toBeDefined();

    const aliasedSpecs = dispatchToolCall("get_product_specs", {
      slug: aliasedCreated.slug,
    }) as { slug: string; specs: { terroir: unknown } };
    expect(aliasedSpecs.slug).toBe(aliasedCreated.slug);
    expect(aliasedSpecs.specs.terroir).toBeDefined();

    const aliasedDeleted = dispatchToolCall("delete_product", {
      slug: aliasedCreated.slug,
      confirmed: true,
    }) as { deleted: boolean };
    expect(aliasedDeleted.deleted).toBe(true);

    // N. 100% Product Connector Fidelity: Complete details, auto SKU, and safe archiving
    const fullProd = call<{
      id: number;
      slug: string;
      price: number;
      inventory: number;
      product: {
        id: number;
        slug: string;
        name: string;
        category: string;
        ingredients: string;
        verified_origin: string;
        description: string;
        status: string;
        is_draft: boolean;
        seo_title: string;
        seo_description: string;
        price: number;
        inventory: number;
      };
    }>("admin.createProduct", {
      name: "Dooars CTC Reserve Chai",
      category: "Bengal Signature Blends",
      ingredients: "100% Orthodox & CTC Whole Leaf, crushed cardamom pods",
      verified_origin: "Dooars Foothills, West Bengal, India",
      description: "A robust morning breakfast tea harvested at the Himalayan foothills.",
      draft: true,
      price: 199,
      inventory: 45,
      seo_title: "Dooars CTC Reserve Chai | Teafloww",
      seo_description: "Authentic single-origin Dooars CTC chai with verified provenance.",
    });

    expect(fullProd.id).toBeGreaterThan(0);
    expect(fullProd.slug).toBe("dooars-ctc-reserve-chai");
    expect(fullProd.price).toBe(199);
    expect(fullProd.inventory).toBe(45);
    expect(fullProd.product.category).toBe("Bengal Signature Blends");
    expect(fullProd.product.ingredients).toContain("Orthodox & CTC Whole Leaf");
    expect(fullProd.product.verified_origin).toContain("Dooars Foothills");
    expect(fullProd.product.description).toContain("robust morning breakfast tea");
    expect(fullProd.product.status).toBe("draft");
    expect(fullProd.product.is_draft).toBe(true);
    expect(fullProd.product.seo_title).toBe("Dooars CTC Reserve Chai | Teafloww");

    // Test variant creation via MCP with loose packaging format and auto-generated SKU
    const autoSkuVar = call<{ id: number; sku: string; price_paise: number; stock: number }>("admin.createVariant", {
      product_id: fullProd.id,
      packaging_format: "tin",
      price: 199,
      stock: 30,
      grams: 100,
    });
    expect(autoSkuVar.sku).toBe("DOOARS-CTC-RESER-100G");
    expect(autoSkuVar.price_paise).toBe(19900);
    expect(autoSkuVar.stock).toBe(30);

    // Update product via MCP with ID and new slug, publish it
    const updatedFull = call<{
      id: number;
      slug: string;
      product: { status: string; is_draft: boolean; slug: string; price: number; inventory: number };
    }>("admin.updateProduct", {
      id: fullProd.id,
      slug: "dooars-ctc-reserve-published",
      status: "published",
      price: 199,
    });
    expect(updatedFull.product.slug).toBe("dooars-ctc-reserve-published");
    expect(updatedFull.product.status).toBe("published");
    expect(updatedFull.product.is_draft).toBe(false);

    // Verify it appears in store.listProducts when published
    const catalogBeforeArchive = call<{ products: { id: number; slug: string }[] }>("store.listProducts", {});
    expect(catalogBeforeArchive.products.some((p) => p.id === fullProd.id)).toBe(true);

    // Create an order referencing this product's variant to test order preservation guard
    const orderWithProd = createDemoOrder({
      name: "Historical Collector",
      email: "collector@example.com",
      address: "10 Heritage Road, Kolkata",
      idempotencyKey: "a7b8c9d0-1234-4567-89ab-cdef01234567",
      items: [{ variantId: autoSkuVar.id, quantity: 1 }],
    });
    expect(orderWithProd.orderId).toBeDefined();

    // Call admin.deleteProduct on the order-referenced product
    const softDelResult = call<{ deleted: boolean; archived: boolean; preserved_orders: boolean }>("admin.deleteProduct", {
      id: fullProd.id,
      confirmed: true,
    });
    expect(softDelResult.deleted).toBe(true);
    expect(softDelResult.archived).toBe(true);
    expect(softDelResult.preserved_orders).toBe(true);

    // Historical order must remain completely intact
    const verifyOrder = call<{ order: { id: string; items: { variant_id: number }[] } }>("orders.getOrder", {
      orderId: orderWithProd.orderId,
    });
    expect(verifyOrder.order.id).toBe(orderWithProd.orderId);
    expect(verifyOrder.order.items[0].variant_id).toBe(autoSkuVar.id);

    // Public storefront catalog must now hide the archived product
    const catalogAfterArchive = call<{ products: { id: number; slug: string }[] }>("store.listProducts", {});
    expect(catalogAfterArchive.products.some((p) => p.id === fullProd.id)).toBe(false);

    // Direct archive via admin.archiveProduct
    const secondProd = call<{ id: number; slug: string }>("admin.createProduct", {
      name: "Kangra Artisanal Green",
      price: 199,
    });
    const directArchive = dispatchToolCall("admin.archiveProduct", {
      id: secondProd.id,
    }) as { archived: boolean; deleted: boolean };
    expect(directArchive.archived).toBe(true);
  });
});
