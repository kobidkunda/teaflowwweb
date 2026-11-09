/** Additive and dialect-neutral. Back up and restore-check before applying. */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tea_subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      enrollment_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      document TEXT NOT NULL,
      next_ms BIGINT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      created_ms BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tea_subscriptions_due ON tea_subscriptions(status,next_ms);
    CREATE INDEX IF NOT EXISTS tea_subscriptions_customer ON tea_subscriptions(customer_id);
    CREATE TABLE IF NOT EXISTS tea_subscription_cycles (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES tea_subscriptions(id),
      sequence INTEGER NOT NULL,
      due_ms BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      method TEXT NOT NULL,
      order_id TEXT UNIQUE REFERENCES commerce_orders(id),
      quote_id TEXT REFERENCES commerce_quotes(id),
      generation INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      lease_ms BIGINT NOT NULL DEFAULT 0,
      blocked_reason TEXT NOT NULL DEFAULT '',
      created_ms BIGINT NOT NULL,
      UNIQUE(subscription_id,sequence)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tea_subscription_one_open ON tea_subscription_cycles(subscription_id)
      WHERE status IN ('draft','awaiting_payment','ready','dispatching','change_pending','exception');
    CREATE TABLE IF NOT EXISTS tea_trial_reservations (
      order_id TEXT NOT NULL REFERENCES commerce_orders(id),
      trial_id TEXT NOT NULL REFERENCES trials(id),
      quantity INTEGER NOT NULL,
      PRIMARY KEY(order_id,trial_id)
    );
    CREATE TABLE IF NOT EXISTS tea_subscription_events (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES tea_subscriptions(id),
      action TEXT NOT NULL,
      document TEXT NOT NULL,
      created_ms BIGINT NOT NULL
    );
  `);
  db.prepare("INSERT INTO commerce_config (key,document) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run('subscriptions', JSON.stringify({ enabled: false, renewalsEnabled: true, baseBps: 0, prepaidBps: 0, version: 1 }));
  const text = 'Hello {{customer_name}},\n\nYour TeaFloww subscription renewal is scheduled for {{dispatch_date}}. Review the exact total, pay online, choose eligible COD, skip or manage your subscription here:\n{{renewal_url}}\n\nPrepaid renewals require payment each time; there is no automatic debit. Delivery fees apply under the current shipping policy.\n\nTeaFloww';
  db.prepare('INSERT INTO email_templates(key,label,description,subject,html_body,text_body,variables_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING').run('subscription_renewal', 'Subscription renewal', 'Manual-pay renewal and subscription management', 'Your TeaFloww subscription renewal', '<p>Hello {{customer_name}},</p><p>Your renewal is scheduled for {{dispatch_date}}.</p><p><a href="{{renewal_url}}">Review, pay or manage your subscription</a></p><p>No automatic debit. Shipping fees apply.</p>', text, JSON.stringify(['customer_name','dispatch_date','renewal_url']));
}
export function down() {}
