import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { teaMomentsSchema, parseTeaMoments } from "@/lib/teaMoments";
import { TeaMoments } from "@/components/TeaMoments";
import { PDPInteractiveTabs } from "@/components/PDPInteractiveTabs";
import { productSchema } from "@/lib/validation";
import { getProduct, upsertProduct } from "@/lib/products";
import { PATCH } from "@/app/api/admin/products/[id]/route";
import { POST } from "@/app/api/admin/products/route";
import { dispatchToolCall, listToolDefinitions } from "@/lib/mcp";

let env: TestEnv;
let cookie: string;
let id: number;
const moments = teaMomentsSchema.parse({ introduction: "Take a little time for your cup.", occasion: "A quiet afternoon", food_pairing: "Your favourite biscuit" });
beforeAll(() => {
  env = setupAdminTestEnv(); cookie = getAuthCookie(env.db);
  id = upsertProduct(productSchema.parse({ slug: "tea-moments-test", name: "Tea Moments Test", origin: "Existing region", estate: "Existing estate", flush: "Existing flush", harvest_date: "Existing harvest", description: "Tea", tasting_notes: "", brew_temp: 90, brew_seconds: 180, lot_number: "LOT-1", cultivar: "Existing cultivar", estate_story: "Existing story" })).id;
});
afterAll(() => env.cleanup());
function update(body: unknown, authorized = true) {
  return PATCH(new Request("http://localhost/api/admin/products/" + id, { method: "PATCH", headers: { "Content-Type": "application/json", ...(authorized ? { cookie } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: String(id) }) });
}
describe("Tea Moments", () => {
  it("replays the additive migration without changing catalogue sourcing", () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_PATH: env.dbPath }, stdio: "ignore" });
    expect(getProduct(id)).toMatchObject({ origin: "Existing region", estate: "Existing estate", tea_moments: null });
  });
  it("saves, reads and preserves on unrelated edits, including hidden sourcing", async () => {
    expect((await update({ tea_moments: moments })).status).toBe(200);
    expect(getProduct(id)?.tea_moments).toEqual(moments);
    expect((await update({ description: "Edited description" })).status).toBe(200);
    expect(getProduct(id)).toMatchObject({ tea_moments: moments, origin: "Existing region", estate: "Existing estate", flush: "Existing flush", harvest_date: "Existing harvest", lot_number: "LOT-1", cultivar: "Existing cultivar", estate_story: "Existing story" });
  });
  it("rejects unauthorized writes and invalid image content", async () => {
    expect((await update({ tea_moments: null }, false)).status).toBe(401);
    for (const image_url of ["//external.test/image.jpg", "javascript:alert(1)", "/\\external.test/x", "/uploads/../private.jpg"]) {
      expect((await update({ tea_moments: { ...moments, image_url, image_alt: "Cup" } })).status).toBe(400);
    }
    expect((await update({ tea_moments: { ...moments, image_url: "/uploads/cup.jpg" } })).status).toBe(400);
    expect(getProduct(id)?.tea_moments).toEqual(moments);
  });
  it("clears explicitly and supports MCP updates and omission", async () => {
    expect((await update({ tea_moments: null })).status).toBe(200);
    expect(getProduct(id)?.tea_moments).toBeNull();
    dispatchToolCall("admin.updateProduct", { id, tea_moments: moments });
    dispatchToolCall("admin.updateProduct", { id, name: "Tea Moments Edited" });
    expect(getProduct(id)?.tea_moments).toEqual(moments);
    dispatchToolCall("admin.updateProduct", { id, tea_moments: null });
    expect(getProduct(id)?.tea_moments).toBeNull();
    const definition = listToolDefinitions().find((tool) => tool.name === "admin.updateProduct");
    expect(definition?.inputSchema.properties).toHaveProperty("tea_moments");
  });
  it("creates through the authenticated API and returns content", async () => {
    const response = await POST(new Request("http://localhost/api/admin/products", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ slug: "moments-created", name: "Moments Created", tea_moments: moments }) }));
    expect(response.status).toBe(201);
    expect((await response.json()).product.tea_moments).toEqual(moments);
  });
  it("renders only curated content, escapes copy, and omits empty recommendations", () => {
    const product = getProduct(id)!;
    expect(renderToStaticMarkup(React.createElement(TeaMoments, { product }))).toBe("");
    const html = renderToStaticMarkup(React.createElement(TeaMoments, { product: { ...product, tea_moments: { ...moments, introduction: "<script>bad</script>" } } }));
    expect(html).toContain("Make it your moment."); expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Pair it with"); expect(html).not.toContain("Serve it your way");
    expect(html).not.toContain("<figure"); expect(html).not.toContain("Existing estate");
    const empty = renderToStaticMarkup(React.createElement(PDPInteractiveTabs, { product }));
    expect(empty).not.toMatch(/Estate Terroir|Catalogue provenance|tab-moments/);
    const full = renderToStaticMarkup(React.createElement(PDPInteractiveTabs, { product: { ...product, tea_moments: moments } }));
    expect(full).toContain("tab-moments"); expect(full).toContain("Tea Moments");
  });
  it("handles malformed stored content and overlong fields", () => {
    expect(parseTeaMoments("{bad")).toBeNull();
    expect(teaMomentsSchema.safeParse({ introduction: "x".repeat(1201) }).success).toBe(false);
  });
});
