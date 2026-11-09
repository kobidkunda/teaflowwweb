// Local-only browser fixture. Never run against a production connection.
import Database from "better-sqlite3";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

if (process.env.DATABASE_TYPE === "postgres" || process.env.PGHOST || process.env.DATABASE_URL) {
  throw new Error("Preview accepts local SQLite only.");
}
const directory = mkdtempSync(path.join(tmpdir(), "tea-moments-preview-"));
const database = path.join(directory, "preview.sqlite");
const source = new Database(path.resolve(process.env.DATABASE_PATH || "data/store.sqlite"), { readonly: true });
await source.backup(database);
source.close();
execFileSync(process.execPath, ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_PATH: database }, stdio: "ignore" });
const db = new Database(database);
const product = db.prepare("SELECT id, slug FROM products WHERE status='published' ORDER BY id LIMIT 1").get();
const user = db.prepare("SELECT id FROM admin_users WHERE role='root' AND is_active=1 LIMIT 1").get();
if (!product || !user) throw new Error("Preview needs a published local product and an active local root user.");
const content = {
  headline: "Make it your moment.", introduction: "Set aside the rush. Pour a cup, find a comfortable corner, and make a little room for yourself.",
  occasion: "A quiet afternoon, a favourite book, a little time of your own.", serving_suggestion: "Enjoy in your favourite cup. Follow the brewing guide and adjust to your taste.",
  food_pairing: "Bring your favourite biscuit to the table.", image_url: "/uploads/darjeeling-spring-liquor-v2.webp",
  image_alt: "AI-created cup illustration. Browser-test fixture, not product photography or a product recommendation.",
};
db.prepare("UPDATE products SET tea_moments=? WHERE id=?").run(JSON.stringify(content), product.id);
const secret = randomBytes(32).toString("hex");
const sid = randomBytes(32).toString("hex");
const cookie = sid + "." + createHmac("sha256", secret).update(sid).digest("hex");
db.prepare("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(createHash("sha256").update(sid).digest("hex"), user.id, new Date(Date.now() + 3600000).toISOString());
db.close();
const fixture = path.join(directory, "fixture.json");
writeFileSync(fixture, JSON.stringify({ ...product, cookie, content }), { mode: 0o600 });
writeFileSync(path.join(directory, "preview.env"), `DATABASE_PATH=${database}\nSESSION_SECRET=${secret}\nTEA_MOMENTS_FIXTURE=${fixture}\n`, { mode: 0o600 });
console.log(directory);
