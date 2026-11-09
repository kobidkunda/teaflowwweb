// 008: env-root + DB staff auth (additive, backfill-safe).
// admin_users holds staff logins (root bootstrapped from env on first login,
// never seeded). admin_sessions holds SHA-256 hashes of the random session id
// (the cookie carries <id>.<hmac>, the raw id never touches the DB).
// password_reset_tokens holds SHA-256 hashes of single-use reset tokens.
// Old ADMIN_TOKEN bearer code reads no table here; rollback = previous build,
// which ignores these tables.
export function up(db) {
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS admin_users (",
      "id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "username TEXT NOT NULL UNIQUE,",
      "email TEXT UNIQUE,",
      "password_hash TEXT NOT NULL,",
      "role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('root','admin')),",
      "is_active INTEGER NOT NULL DEFAULT 1,",
      "failed_attempts INTEGER NOT NULL DEFAULT 0,",
      "locked_until TEXT,",
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);",
      "CREATE TABLE IF NOT EXISTS admin_sessions (",
      "token_hash TEXT PRIMARY KEY,",
      "user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,",
      "expires_at TEXT NOT NULL,",
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);",
      "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);",
      "CREATE TABLE IF NOT EXISTS password_reset_tokens (",
      "token_hash TEXT PRIMARY KEY,",
      "user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,",
      "expires_at TEXT NOT NULL,",
      "used_at TEXT,",
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);",
    ].join("\n")
  );
}
export function down() {}
