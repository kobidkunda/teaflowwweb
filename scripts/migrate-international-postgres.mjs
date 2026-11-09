/** Production-only additive migration; invoke explicitly after pg_dump/restore verification. */
import { Client } from 'pg';
import { up } from './migrations/031_international_commerce.mjs';
import { up as receiptTemplates } from './migrations/032_commerce_receipt_templates.mjs';
if (process.env.DATABASE_TYPE !== 'postgres') throw new Error('Production PostgreSQL environment required. Use db:migrate locally.');
const pg = new Client({ connectionString: process.env.DATABASE_URL, host: process.env.PGHOST, port: Number(process.env.PGPORT || 5433), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });
await pg.connect();
try {
  await pg.query('BEGIN');
  await pg.query("SELECT pg_advisory_xact_lock(3103162026)");
  const settings = await pg.query('SELECT key,value FROM store_settings');
  const values = new Map(settings.rows.map(r=>[r.key,r.value]));
  for (const [version,migrate] of [['031_international_commerce',up],['032_commerce_receipt_templates',receiptTemplates]]) {
    const existing=await pg.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
    if (existing.rowCount) continue;
    const statements=[];
    migrate({exec(sql){statements.push([sql,[]]);},prepare(sql){return {get(key){return values.has(key)?{value:values.get(key)}:undefined;},run(...args){let index=0;statements.push([sql.replace(/\?/g,()=>`$${++index}`),args]);}};}});
    for (const [sql,args] of statements) await pg.query(sql,args);
    await pg.query('INSERT INTO schema_migrations (version) VALUES ($1)',[version]);
  }
  await pg.query('COMMIT');
  console.log('International commerce migration verified. No live market was enabled.');
} catch(e) { await pg.query('ROLLBACK'); throw e; }
finally { await pg.end(); }
