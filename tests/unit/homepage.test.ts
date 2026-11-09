import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import seed from "../../scripts/content/homepage.json";
import { homepageSchema, homepagePath } from "../../src/lib/homepageSchema";
import { up } from "../../scripts/migrations/012_homepage_content.mjs";
let db: Database.Database;
let authenticated = true;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/adminHttp", () => ({
  guard: () => authenticated ? null : new Response(null, { status: 401 }),
  invalid: () => new Response(null, { status: 400 }),
}));
const { getHomepageContent, saveHomepageContent } = await import("../../src/lib/homepage");
const { GET, PUT } = await import("../../src/app/api/admin/homepage/route");
beforeEach(() => {
  authenticated = true;
  db = new Database(":memory:");
  db.exec("CREATE TABLE store_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE categories (id INTEGER PRIMARY KEY, slug TEXT);");
  db.prepare("INSERT INTO categories VALUES (?,?)").run(91, "black");
  db.prepare("INSERT INTO categories VALUES (?,?)").run(27, "green");
});
afterEach(() => db.close());
describe("Homepage content safety and migration", () => {
  it("rejects external schemes, protocol-relative and escaped URL paths", () => {
    for (const value of ["javascript:alert(1)", "//evil.example", "/\\evil", "/\nevil", "https://evil.example"]) expect(homepagePath.safeParse(value).success).toBe(false);
    expect(homepagePath.safeParse("/shop?category=Black").success).toBe(true);
    expect(homepageSchema.safeParse({ ...seed, unknown: "extra" }).success).toBe(false);
  });
  it("resolves deployed category IDs and replays without overwriting admin edits", () => {
    up(db);
    const first = getHomepageContent()!;
    expect(first.discovery.tiles.map((t) => t.category_id)).toEqual([91, 27]);
    saveHomepageContent({ ...first, footer_text: "Edited by operator" });
    up(db);
    expect(getHomepageContent()?.footer_text).toBe("Edited by operator");
  });
  it("omits discovery panels when corresponding categories are absent", () => {
    db.exec("DELETE FROM categories"); up(db);
    expect(getHomepageContent()?.discovery.tiles).toEqual([]);
  });
  it("returns no invented editorial copy for missing or corrupt content", () => {
    expect(getHomepageContent()).toBeNull();
    db.prepare("INSERT INTO store_settings (key,value) VALUES (?,?)").run("homepage_content_v1", "{broken");
    expect(getHomepageContent()).toBeNull();
  });
  it("denies reads and writes without an admin session", async () => {
    authenticated = false;
    expect(GET(new Request("http://localhost/api/admin/homepage")).status).toBe(401);
    expect((await PUT(new Request("http://localhost/api/admin/homepage", { method: "PUT", body: JSON.stringify(seed) }))).status).toBe(401);
    expect(getHomepageContent()).toBeNull();
  });
  it("rejects invalid requests without replacing saved content", async () => {
    up(db);
    const response = await PUT(new Request("http://localhost/api/admin/homepage", { method: "PUT", body: JSON.stringify({ ...seed, hero: { ...seed.hero, primary: { label: "Go", href: "javascript:alert(1)" } } }) }));
    expect(response.status).toBe(400);
    expect(getHomepageContent()?.hero.primary.href).toBe("/shop");
  });
  it("persists and returns an authenticated editorial edit", async () => {
    up(db);
    const edited = { ...getHomepageContent()!, brand: "Operator's tea house" };
    const response = await PUT(new Request("http://localhost/api/admin/homepage", { method: "PUT", body: JSON.stringify(edited) }));
    expect(response.status).toBe(200);
    expect(getHomepageContent()?.brand).toBe("Operator's tea house");
  });
});

describe("Homepage editorial rendering", () => {
  it("does not invent a brand or provenance message when configuration is absent", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RitualFooter } = await import("../../src/components/home/RitualFooter");
    const html = renderToStaticMarkup(createElement(RitualFooter, { content: null }));
    expect(html).not.toContain("Single-estate");
    expect(html).not.toContain("TEAFLOWW");
  });
  it("uses the editor's exact brand, message and link labels", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RitualFooter } = await import("../../src/components/home/RitualFooter");
    const content = homepageSchema.parse({ ...seed, brand: "Edited Brand", footer_text: "Edited footer" });
    const html = renderToStaticMarkup(createElement(RitualFooter, { content }));
    expect(html).toContain("Edited Brand");
    expect(html).toContain("Edited footer");
    expect(html).toContain("Your bag");
  });
});
