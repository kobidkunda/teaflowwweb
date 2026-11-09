/** Explicit production-only runner. Requires a verified pg_dump/restore first. */
import { Client } from 'pg';
import { up } from './migrations/038_product_subscriptions.mjs';
if (process.env.DATABASE_TYPE !== 'postgres') throw new Error('Production PostgreSQL only; use db:migrate for local SQLite.');
const pg = new Client({ connectionString: process.env.DATABASE_URL, host: process.env.PGHOST, port: Number(process.env.PGPORT || 5433), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });
await pg.connect();
try {
  await pg.query('BEGIN');
  await pg.query('SELECT pg_advisory_xact_lock(3811072026)');
  const version = '038_product_subscriptions';
  const prior = await pg.query('SELECT version FROM schema_migrations WHERE version=$1', [version]);
  if (!prior.rowCount) {
    const statements = [];
    up({ exec(sql) { statements.push([sql, []]); }, prepare(sql) { return { run(...args) { let n=0; statements.push([sql.replace(/\?/g, () => `$${++n}`),args]); } }; } });
    for (const [sql,args] of statements) await pg.query(sql,args);
    await pg.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
  }
  await pg.query('COMMIT');
  console.log('Subscription migration complete; feature remains disabled until configured.');
} catch (error) { await pg.query('ROLLBACK'); throw error; }
finally { await pg.end(); }
