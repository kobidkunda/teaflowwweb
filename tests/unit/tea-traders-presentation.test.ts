import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
const testDb = join(tmpdir(), `tea-traders-${randomUUID()}.sqlite`);
process.env.DATABASE_PATH = testDb;
process.env.ADMIN_TEST_TOKEN = "tea-traders-isolated-admin-test";
import { getDb } from "@/lib/db";
import { getTraderPresentation, saveTraderPresentation, getTraderCatalogue } from "@/lib/business/traderRepository";
import { traderDefaultTexts } from "@/lib/business/traderTranslations";
import { TRADER_DEFAULTS, traderPresentationSchema } from "@/lib/business/traderPresentation";
import { dispatchToolCall, listToolDefinitions } from "@/lib/mcp";
import { sourceFor, localize, editTranslation, resourceList, validateTexts } from "@/lib/international/translations";
import { createBusinessLeadWithOutbox } from "@/lib/business/repository";
import { businessLeadSchema } from "@/lib/business/schema";
import { listAdminResponses, getAdminResponseDetail } from "@/lib/admin/responses";
import { GET, PUT } from "@/app/api/admin/business/traders/route";

describe("Tea Traders production presentation contracts",()=>{
  beforeAll(()=>{
    execFileSync(process.execPath,["scripts/migrate.mjs"],{env:{...process.env,DATABASE_PATH:testDb},stdio:"ignore"});
    const db=getDb();
    db.prepare("INSERT INTO products (slug,name,category,origin,estate,flush,harvest_date,description,tasting_notes,brew_temp,brew_seconds,status,is_enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run("trader-contract-tea","Contract Tea","Black","India","","","","Tea","",95,180,"published",1);
    const row=db.prepare("SELECT id FROM products WHERE slug=?").get("trader-contract-tea") as {id:number};
    db.prepare("INSERT INTO variants (product_id,sku,grams,price_paise,stock) VALUES (?,?,?,?,?)").run(row.id,"TFW-CONTRACT-250G",250,12345,4);
    db.prepare("INSERT INTO product_images (product_id,url,alt_text,sort_order,is_primary) VALUES (?,?,?,?,?)").run(row.id,"/uploads/backend-contract.webp","Backend product image",0,1);
  },30000);
  afterAll(()=>{for(const suffix of ["","-wal","-shm"])rmSync(testDb+suffix,{force:true});});
  it("reads images, stock and prices from the live backend and resolves later photo changes",()=>{
    const p=getTraderCatalogue().find(p=>p.slug==="trader-contract-tea")!;
    expect(p.primary_image_url).toBe("/uploads/backend-contract.webp");expect(p.variants[0].price_paise).toBe(12345);
    const content=getTraderPresentation();content.slides=[{id:"hero",productId:p.id,title:content.copy.headline,body:content.copy.intro}];content.productIds=[p.id];saveTraderPresentation(content);
    getDb().prepare("UPDATE product_images SET url=? WHERE product_id=?").run("/uploads/changed-backend.webp",p.id);
    expect(getTraderCatalogue().find(x=>x.id===p.id)?.primary_image_url).toBe("/uploads/changed-backend.webp");
    expect(getTraderPresentation().slides[0]).not.toHaveProperty("imageUrl");
  });
  it("API and MCP read/save the same slider and selected products",async()=>{
    expect(listToolDefinitions().map(t=>t.name)).toContain("business.saveTradersPage");
    const before=dispatchToolCall("business.getTradersPage",{}) as {content:ReturnType<typeof getTraderPresentation>};
    const content={...before.content,copy:{...before.content.copy,headline:"Tea for your shelves."}};
    dispatchToolCall("business.saveTradersPage",{content});
    const response=GET(new Request("http://localhost/api/admin/business/traders",{headers:{"x-admin-test-token":process.env.ADMIN_TEST_TOKEN!}}));
    expect(response.status).toBe(200);expect((await response.json()).content.copy.headline).toBe("Tea for your shelves.");
    const changed={...content,slides:[]};
    const saved=await PUT(new Request("http://localhost/api/admin/business/traders",{method:"PUT",headers:{"x-admin-test-token":process.env.ADMIN_TEST_TOKEN!,origin:"http://localhost"},body:JSON.stringify(changed)}));
    expect(saved.status).toBe(200);expect(getTraderPresentation().slides).toEqual([]);
  });
  it("accepts the browser Host when Next uses an internal bind origin",async()=>{
    const response=await PUT(new Request("http://localhost:3017/api/admin/business/traders",{method:"PUT",headers:{"x-admin-test-token":process.env.ADMIN_TEST_TOKEN!,origin:"http://127.0.0.1:3017",host:"127.0.0.1:3017"},body:JSON.stringify(getTraderPresentation())}));
    expect(response.status).toBe(200);
  });
  it("rejects unauthorized writes, cross-origin writes, malformed documents and unpublished products",async()=>{
    expect(GET(new Request("http://localhost/api/admin/business/traders")).status).toBe(401);
    const r=await PUT(new Request("http://localhost/api/admin/business/traders",{method:"PUT",headers:{"x-admin-test-token":process.env.ADMIN_TEST_TOKEN!,origin:"https://other.example"},body:"{}"}));expect(r.status).toBe(403);
    expect(traderPresentationSchema.safeParse({...getTraderPresentation(),imageUrl:"https://unapproved.example/image.png"}).success).toBe(false);
    const p=getTraderCatalogue().find(p=>p.slug==="trader-contract-tea")!;
    getDb().prepare("UPDATE products SET status='draft' WHERE id=?").run(p.id);
    expect(()=>saveTraderPresentation({...getTraderPresentation(),productIds:[p.id]})).toThrow("published");
    expect(getTraderCatalogue().some(x=>x.id===p.id)).toBe(false);
    getDb().prepare("UPDATE products SET status='published' WHERE id=?").run(p.id);
  });
  it("exposes page and slide copy in Translation Studio, publishes via MCP, falls back when source changes",()=>{
    expect(resourceList().some(r=>r.resource==="tea-traders")).toBe(true);
    expect(sourceFor("tea-traders")["copy.headline"]).toBe("Tea for your shelves.");
    editTranslation("tea-traders",{"copy.headline":"आपके व्यापार के लिए चाय।"},"draft","hi");
    dispatchToolCall("translations.publish",{resource:"tea-traders",locale:"hi"});
    expect(localize(getTraderPresentation(),"tea-traders","hi").copy.headline).toBe("आपके व्यापार के लिए चाय।");
    saveTraderPresentation({...getTraderPresentation(),copy:{...getTraderPresentation().copy,headline:"Choose your tea."}});
    expect(localize(getTraderPresentation(),"tea-traders","hi").copy.headline).toBe("Choose your tea.");
  });
  it("saves translated trader leads idempotently and exposes their details in /admin/responses",()=>{
    const payload=businessLeadSchema.parse({segment:"trader",interest:"bulk_supply",quantityBand:"50-99",pincode:"734001",name:"Test buyer",phone:"9876543210",contactConsent:true,locale:"bn"});
    const key=randomUUID();const first=createBusinessLeadWithOutbox(payload,key);const replay=createBusinessLeadWithOutbox(payload,key);
    expect(replay.leadId).toBe(first.leadId);expect(replay.duplicate).toBe(true);
    const rows=listAdminResponses({type:"bulk_order",q:first.reference});expect(rows.items).toHaveLength(1);expect(rows.items[0].id).toBe(`business:${first.leadId}`);
    const detail=getAdminResponseDetail("bulk_order",rows.items[0].id);expect(detail.item?.phone).toBe("9876543210");expect(detail.item?.deepLink).toBe("/admin/business");
  });
  it("provides complete Hindi starter copy, respects admin publication and custom-source changes",()=>{
    const before=getTraderPresentation();
    try {
      saveTraderPresentation(TRADER_DEFAULTS);
      const source=sourceFor("tea-traders");
      const defaults=traderDefaultTexts("hi",source);
      expect(Object.keys(defaults).sort()).toEqual(Object.keys(source).sort());
      expect(()=>validateTexts(source,defaults)).not.toThrow();
      expect(localize(getTraderPresentation(),"tea-traders","hi").copy.navShop).toBe("चाय खरीदें");
      editTranslation("tea-traders",{"copy.headline":"आपके व्यापार के लिए चाय।"},"publish","hi");
      expect(localize(getTraderPresentation(),"tea-traders","hi").copy.headline).toBe("आपके व्यापार के लिए चाय।");
      expect(localize(getTraderPresentation(),"tea-traders","hi").copy.buyNow).toBe("अभी खरीदें");
      saveTraderPresentation({...TRADER_DEFAULTS,copy:{...TRADER_DEFAULTS.copy,headline:"Custom campaign headline"},slides:[{id:"localized",productId:getTraderCatalogue()[0].id,title:TRADER_DEFAULTS.copy.headline,body:TRADER_DEFAULTS.copy.intro}]});
      const rendered=localize(getTraderPresentation(),"tea-traders","hi");
      expect(rendered.copy.headline).toBe("Custom campaign headline");
      expect(rendered.slides[0].title).toMatch(/बेहतर चाय/);
      expect(traderDefaultTexts("bn",source)).toEqual({});
    } finally { saveTraderPresentation(before); }
  });

});
