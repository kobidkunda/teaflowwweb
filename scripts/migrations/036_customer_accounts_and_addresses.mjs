/**
 * Migration 036: Customer Accounts, Sessions, and Saved Addresses
 * Introduces customer identity, cryptographic session management,
 * customer address books, and customer_id foreign key linkage on orders.
 */
export function up(db) {
  // 1. Customers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT NULL,
      name TEXT DEFAULT NULL,
      password_hash TEXT DEFAULT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `);

  // 2. Customer Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      token_hash TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires ON customer_sessions(expires_at);
  `);

  // 3. Customer Saved Addresses Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT DEFAULT '',
      landmark TEXT DEFAULT '',
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'IN',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
  `);

  // 4. Add customer_id to orders table if missing
  try {
    const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
    if (!cols.includes("customer_id")) {
      db.exec("ALTER TABLE orders ADD COLUMN customer_id TEXT DEFAULT NULL;");
      db.exec("CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);");
    }
  } catch {
    // orders table might not exist in early mock tests
  }
}
