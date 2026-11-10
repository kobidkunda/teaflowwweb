import { Worker, MessageChannel, receiveMessageOnPort } from "node:worker_threads";

export interface SyncStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown | undefined;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface SyncTransaction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T>;
  immediate(...args: Parameters<T>): ReturnType<T>;
  deferred(...args: Parameters<T>): ReturnType<T>;
  exclusive(...args: Parameters<T>): ReturnType<T>;
  default(...args: Parameters<T>): ReturnType<T>;
}

export interface SyncDatabase {
  prepare(sql: string): SyncStatement;
  exec(sql: string): void;
  pragma(sql: string): unknown;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): SyncTransaction<T>;
  close(): void;
}

let syncDbInstance: SyncDatabase | undefined;

function convertPlaceholders(sql: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let paramIndex = 1;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'" && !inDoubleQuote) {
      if (sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      out += char;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      out += char;
    } else if (char === "?" && !inSingleQuote && !inDoubleQuote) {
      out += "$" + paramIndex++;
    } else {
      out += char;
    }
  }
  return out;
}

function normalizeSql(sql: string): string {
  let s = sql.trim();

  // Convert sqlite_master table lookup
  s = s.replace(
    /SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s*=/gi,
    "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename="
  );
  s = s.replace(
    /SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'/gi,
    "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'"
  );

  // Convert INSERT OR IGNORE INTO
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
    if (!/ON\s+CONFLICT/i.test(s)) {
      s = s.replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
    }
  }

  // Convert LIKE to ILIKE for case-insensitive matching outside string literals
  // Simple regex for ' LIKE ' with boundaries
  s = s.replace(/\s+LIKE\s+/gi, " ILIKE ");

  // Convert SQLite datetime('now', '<offset>') e.g. datetime('now', '-7 days').
  // Must run before the plain datetime('now') replacement.
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi, (_m, offset) => {
    const safe = String(offset).replace(/'/g, "''");
    return `TO_CHAR((CURRENT_TIMESTAMP + INTERVAL '${safe}'), 'YYYY-MM-DD HH24:MI:SS')`;
  });

  // Convert SQLite datetime('now')
  s = s.replace(/datetime\s*\(\s*'now'\s*\)/gi, "TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS')");

  // Convert PRAGMA table_info(<table>)
  const pragmaMatch = s.match(/PRAGMA\s+table_info\(([^)]+)\)/i);
  if (pragmaMatch) {
    const tbl = pragmaMatch[1].trim().replace(/['"`]/g, "");
    return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}'`;
  }

  // Preserve mixed-case aliases in SELECT expressions (e.g. AS pricePaise -> AS "pricePaise")
  s = s.replace(/\bAS\s+((?=[a-zA-Z0-9_]*[a-z])(?=[a-zA-Z0-9_]*[A-Z])[a-zA-Z0-9_]+)\b/g, 'AS "$1"');

  return convertPlaceholders(s);
}

export function wrapRow<T extends Record<string, unknown>>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const lowerMap = new Map<string, string>();
  for (const k of Object.keys(row)) {
    lowerMap.set(k.toLowerCase(), k);
  }
  return new Proxy(row, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && !(prop in target)) {
        const actualKey = lowerMap.get(prop.toLowerCase());
        if (actualKey !== undefined) {
          return (target as Record<string, unknown>)[actualKey];
        }
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (typeof prop === "string" && !(prop in target)) {
        if (lowerMap.has(prop.toLowerCase())) return true;
      }
      return Reflect.has(target, prop);
    },
  });
}

export { normalizeSql };

function flattenParams(params: unknown[]): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export function getPostgresDb(): SyncDatabase {
  if (syncDbInstance) {
    return syncDbInstance;
  }

  const sab = new SharedArrayBuffer(4);
  const signal = new Int32Array(sab);
  const { port1, port2 } = new MessageChannel();

  const pgConfig = {
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5433", 10),
    user: process.env.PGUSER || "teafloww",
    password: process.env.PGPASSWORD || "teafloww",
    database: process.env.PGDATABASE || "teafloww",
    max: 10,
    idleTimeoutMillis: 30000,
  };

  const workerCode = `
    const { parentPort, workerData } = require('worker_threads');
    const { Client } = require('pg');

    const signal = new Int32Array(workerData.sab);
    const port = workerData.port;

    // Parse int8 (BIGINT) as integer numbers in JS
    const types = require('pg').types;
    types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

    let client = null;
    async function getClient() {
      if (!client) {
        client = new Client(workerData.config);
        await client.connect();
        client.on('error', () => {
          client = null;
        });
      }
      return client;
    }

    const tablesWithSerialId = new Set([
      'admin_users',
      'media_uploads',
      'categories',
      'products',
      'variants',
      'product_images',
      'sliders',
      'order_items',
      'payment_events',
      'blog_posts',
      'analytics_events',
      'mcp_logs',
      'newsletter_subscriptions',
      'wholesale_inquiries',
      'visitor_fingerprints',
      'cart_items',
      'captured_leads',
      'coupon_redemptions',
      'site_pages',
    ]);

    port.on('message', async (msg) => {
      try {
        const c = await getClient();
        if (msg.type === 'exec') {
          await c.query(msg.sql);
          port.postMessage({ id: msg.id, ok: true });
        } else if (msg.type === 'query') {
          let sql = msg.sql;
          const isInsert = /^INSERT\\s+INTO/i.test(sql.trim());
          const hasReturning = /RETURNING/i.test(sql);
          
          if (isInsert && !hasReturning) {
            const tableMatch = sql.trim().match(/^INSERT\\s+INTO\\s+["\\\`]?([a-zA-Z0-9_]+)["\\\`]?/i);
            const tableName = tableMatch ? tableMatch[1].toLowerCase() : '';
            if (tablesWithSerialId.has(tableName)) {
              // Append RETURNING id to capture lastInsertRowid only for serial id tables
              const returningSql = sql.replace(/;?\\s*$/, ' RETURNING id');
              try {
                const res = await c.query(returningSql, msg.params);
                const lastId = res.rows && res.rows[0] && res.rows[0].id != null ? res.rows[0].id : 0;
                port.postMessage({ id: msg.id, ok: true, rows: res.rows, rowCount: res.rowCount, lastId });
                Atomics.store(signal, 0, 1);
                Atomics.notify(signal, 0, 1);
                return;
              } catch {
                // If RETURNING id fails, fall back to original query
              }
            }
          }

          const res = await c.query(sql, msg.params);
          port.postMessage({ id: msg.id, ok: true, rows: res.rows, rowCount: res.rowCount, lastId: 0 });
        }
      } catch (err) {
        port.postMessage({ id: msg.id, ok: false, error: err.message, stack: err.stack });
      } finally {
        Atomics.store(signal, 0, 1);
        Atomics.notify(signal, 0, 1);
      }
    });
  `;

  const worker = new Worker(workerCode, {
    eval: true,
    workerData: { sab, port: port2, config: pgConfig },
    transferList: [port2],
  });

  let nextId = 1;

  function sendSync(type: "exec" | "query", sql: string, params: unknown[] = []) {
    const id = nextId++;
    Atomics.store(signal, 0, 0);
    port1.postMessage({ id, type, sql, params });
    Atomics.wait(signal, 0, 0);

    const msg = receiveMessageOnPort(port1);
    if (!msg || !msg.message) {
      throw new Error("PostgreSQL sync bridge received null response");
    }
    const res = msg.message;
    if (!res.ok) {
      throw new Error(`PostgreSQL query error: ${res.error}\nSQL: ${sql}`);
    }
    return res;
  }

  syncDbInstance = {
    prepare(sql: string): SyncStatement {
      const normalized = normalizeSql(sql);
      return {
        all(...params: unknown[]) {
          const flat = flattenParams(params);
          const res = sendSync("query", normalized, flat);
          const rows = (res.rows || []) as Record<string, unknown>[];
          return rows.map((r) => wrapRow(r));
        },
        get(...params: unknown[]) {
          const flat = flattenParams(params);
          const res = sendSync("query", normalized, flat);
          return res.rows && res.rows.length > 0 ? wrapRow(res.rows[0] as Record<string, unknown>) : undefined;
        },
        run(...params: unknown[]) {
          const flat = flattenParams(params);
          const res = sendSync("query", normalized, flat);
          return {
            changes: res.rowCount || 0,
            lastInsertRowid: res.lastId || 0,
          };
        },
      };
    },
    exec(sql: string) {
      sendSync("exec", sql);
    },
    pragma() {
      // Pragmas are no-ops on PostgreSQL
      return undefined;
    },
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): SyncTransaction<T> {
      let txDepth = 0;
      const tx = ((...args: Parameters<T>): ReturnType<T> => {
        if (txDepth === 0) {
          sendSync("exec", "BEGIN");
        } else {
          sendSync("exec", `SAVEPOINT sp_${txDepth}`);
        }
        txDepth++;
        try {
          const result = fn(...args);
          txDepth--;
          if (txDepth === 0) {
            sendSync("exec", "COMMIT");
          } else {
            sendSync("exec", `RELEASE SAVEPOINT sp_${txDepth}`);
          }
          return result as ReturnType<T>;
        } catch (err) {
          txDepth--;
          if (txDepth === 0) {
            sendSync("exec", "ROLLBACK");
          } else {
            sendSync("exec", `ROLLBACK TO SAVEPOINT sp_${txDepth}`);
          }
          throw err;
        }
      }) as SyncTransaction<T>;

      tx.immediate = tx;
      tx.deferred = tx;
      tx.exclusive = tx;
      tx.default = tx;

      return tx;
    },
    close() {
      worker.terminate();
      syncDbInstance = undefined;
    },
  };

  return syncDbInstance;
}
