#!/usr/bin/env node
// Local, additive starter publication. Existing admin drafts/publications win.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.DATABASE_TYPE === "postgres" || process.env.DATABASE_URL?.startsWith("postgres")) throw new Error("This seed is for local SQLite only. Publish production translations through the authenticated admin/API/MCP workflow.");
const read = name => JSON.parse(fs.readFileSync(path.join(root, "src/lib/business", name), "utf8"));
const english = read("traderCopy.json"), hindi = read("traderHindi.json");
const db = new Database(process.env.DATABASE_PATH || path.join(root, "data/store.sqlite"));
db.transaction(() => {
  if (db.prepare("SELECT id FROM commerce_translations WHERE resource=? AND locale=?").get("tea-traders", "hi")) { console.log("Existing Tea Traders Hindi translation retained."); return; }
  const setting = db.prepare("SELECT value FROM store_settings WHERE key=?").get("tea_traders_presentation_v1");
  const content = setting ? JSON.parse(setting.value) : { copy: english, slides: [] };
  const source = Object.fromEntries([...Object.entries(content.copy).map(([k,v])=>[`copy.${k}`,v]), ...content.slides.flatMap((s,i)=>[[`slides.${i}.title`,s.title],[`slides.${i}.body`,s.body]])]);
  const lookup = new Map(Object.entries(english).map(([k,v])=>[v,hindi[k]]));
  const texts = Object.fromEntries(Object.entries(source).flatMap(([k,v])=>lookup.has(v)?[[k,lookup.get(v)]]:[]));
  const hash = createHash("sha256").update(JSON.stringify(source)).digest("hex");
  db.prepare("INSERT INTO commerce_translations (id,resource,locale,source_hash,source,draft,published,published_hash,revision,updated_ms) VALUES (?,?,?,?,?,?,?,?,1,?)").run(randomUUID(),"tea-traders","hi",hash,JSON.stringify(source),JSON.stringify(texts),JSON.stringify(texts),hash,Date.now());
  console.log(`Published ${Object.keys(texts).length} Tea Traders Hindi fields to local Translation Studio.`);
})();
db.close();
