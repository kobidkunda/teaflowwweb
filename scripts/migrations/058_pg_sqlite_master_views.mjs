// 058: PostgreSQL compatibility views for sqlite_master, sqlite_schema, and content_blocks.
// Additive, versioned, and idempotent.

export function up(db) {
  // If running against PostgreSQL via driver, ensure compatibility views exist
  if (process.env.DATABASE_TYPE === "postgres") {
    db.exec(`
      CREATE OR REPLACE VIEW sqlite_master AS
        SELECT 'table'::text AS type, tablename::text AS name, tablename::text AS tbl_name, 0::integer AS rootpage, ''::text AS sql
        FROM pg_tables WHERE schemaname='public';
      CREATE OR REPLACE VIEW sqlite_schema AS SELECT * FROM sqlite_master;
      CREATE OR REPLACE VIEW content_blocks AS SELECT * FROM site_content_blocks;
    `);
  }
}

export function down() {
  // Additive migration; no destructive down step.
}
