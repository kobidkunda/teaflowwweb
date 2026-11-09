import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import seed from "../../scripts/content/homepage.json";
import additions from "../../scripts/content/homepage-completion.json";
import { up } from "../../scripts/migrations/013_homepage_completion.mjs";
import { resetRateLimits } from "../../src/lib/rateLimit";
let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
const { getHomepageContent, getStorefrontHomepageContent, saveHomepageContent } = await import("../../src/lib/homepage");
const { POST } = await import("../../src/app/api/newsletter/route");
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/newsletter", { method:"POST", headers:{"Content-Type":"application/json",origin}, body:JSON.stringify(body) });
}
beforeEach(() => {
  resetRateLimits(); db = new Database(":memory:");
  db.exec("CREATE TABLE store_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE categories(id INTEGER PRIMARY KEY,slug TEXT);");
  db.prepare("INSERT INTO store_settings(key,value) VALUES (?,?)").run("homepage_content_v1",JSON.stringify(seed));
  db.prepare("INSERT INTO categories VALUES (?,?)").run(69,"herbal-infusions");
  db.prepare("INSERT INTO categories VALUES (?,?)").run(35,"oolong");
});
afterEach(() => db.close());
describe("Homepage completion migration and publication", () => {
  it("adds absent sections and newsletter storage while preserving editor copy on replay", () => {
    up(db); const content=getHomepageContent()!;
    expect(content.discovery.tiles.map(t=>t.category_id)).toEqual([1,4,69,35]);
    expect(content.reviews?.entries).toEqual([]);
    saveHomepageContent({...content,story:{...content.story!,title:"An edited story"}});
    up(db); expect(getHomepageContent()?.story?.title).toBe("An edited story");
    expect(getHomepageContent()?.hero).toEqual(content.hero);
    expect(db.prepare("SELECT count(*) n FROM newsletter_subscriptions").get()).toEqual({n:0});
  });
  it("keeps unapproved customer quotes out of public content and browser payloads", () => {
    saveHomepageContent({...seed,...additions,reviews:{...additions.reviews,entries:[{quote:"PRIVATE DRAFT",attribution:"Private person",approved:false},{quote:"Approved original feedback",attribution:"Consenting customer",approved:true}]}});
    expect(getHomepageContent()?.reviews?.entries).toHaveLength(2);
    const published=getStorefrontHomepageContent();
    expect(published?.reviews?.entries).toHaveLength(1);
    expect(JSON.stringify(published)).not.toContain("PRIVATE DRAFT");
  });
  it("does not publish invented testimonials in the empty state", async () => {
    up(db); const {createElement}=await import("react"); const {renderToStaticMarkup}=await import("react-dom/server");
    const {RitualEditorial}=await import("../../src/components/home/RitualEditorial");
    const html=renderToStaticMarkup(createElement(RitualEditorial,{content:getStorefrontHomepageContent()!}));
    expect(html).toContain(additions.reviews.empty_title);
    expect(html).not.toContain("blockquote"); expect(html).not.toContain("5 stars");
  });
});
describe("Newsletter consent storage", () => {
  it("validates email and explicit consent before storing anything", async () => {
    up(db);
    for(const body of [{email:"bad",consent:true},{email:"a@example.test",consent:false},{email:"a@example.test",consent:true,extra:"no"}]) expect((await POST(request(body))).status).toBe(400);
    expect(db.prepare("SELECT count(*) n FROM newsletter_subscriptions").get()).toEqual({n:0});
  });
  it("normalizes duplicate requests without disclosing membership or email", async () => {
    up(db);
    const first=await POST(request({email:" Reader@Example.test ",consent:true}));
    const again=await POST(request({email:"reader@example.test",consent:true}));
    expect(first.status).toBe(200); expect(await first.json()).toEqual(await again.json());
    expect(db.prepare("SELECT email,consent_text FROM newsletter_subscriptions").all()).toEqual([{email:"reader@example.test",consent_text:additions.newsletter.consent_label}]);
  });
  it("blocks cross-origin submissions and disabled signup", async () => {
    up(db); expect((await POST(request({email:"a@example.test",consent:true},"https://evil.test"))).status).toBe(403);
    const content=getHomepageContent()!; saveHomepageContent({...content,newsletter:{...content.newsletter!,enabled:false}});
    expect((await POST(request({email:"a@example.test",consent:true}))).status).toBe(503);
    expect(db.prepare("SELECT count(*) n FROM newsletter_subscriptions").get()).toEqual({n:0});
  });
  it("accepts the browser host when Next uses an internal bind address", async () => {
    up(db);
    const response=await POST(new Request("http://0.0.0.0:3300/api/newsletter",{method:"POST",headers:{host:"localhost:3300",origin:"http://localhost:3300","Content-Type":"application/json"},body:JSON.stringify({email:"host@example.test",consent:true})}));
    expect(response.status).toBe(200);
  });
  it("limits bursts and returns generic storage errors", async () => {
    up(db); db.exec("DROP TABLE newsletter_subscriptions");
    const response=await POST(request({email:"a@example.test",consent:true}));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("SQLITE");
    for(let i=0;i<9;i++) await POST(request({email:"bad",consent:true}));
    expect((await POST(request({email:"a@example.test",consent:true}))).status).toBe(429);
  });
});
