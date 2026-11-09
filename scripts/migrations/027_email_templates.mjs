// 027: Transactional email templates (admin editor + MCP + test sends).
// Additive only. Creates email_templates keyed by stable template key and
// seeds defaults for every email the store sends (or will send).
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      text_body TEXT NOT NULL,
      variables_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const defaults = [
    {
      key: "admin_password_reset",
      label: "Admin password reset",
      description: "Sent from /api/admin/forgot when staff request a password reset link.",
      subject: "TeaFloww admin password reset — expires in 60 minutes",
      variables: ["reset_link", "store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '{{#logo}}<p style="text-align:center"><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>{{/logo}}' +
        "<h2 style=\"margin:0 0 8px\">Reset your admin password</h2>" +
        "<p>A password reset was requested for the TeaFloww admin console. This link expires in 60 minutes:</p>" +
        '<p><a href="{{reset_link}}">{{reset_link}}</a></p>' +
        "<p>If you did not request this, ignore this message. Contact {{support_email}} for help.</p>" +
        "<p style=\"color:#63665e;font-size:12px\">— {{store_name}}</p></div>",
      text_body:
        "Reset your TeaFloww admin password (expires in 60 minutes):\n\n{{reset_link}}\n\nIf you did not request this, ignore this message. Contact {{support_email}} for help.\n\n— {{store_name}}",
    },
    {
      key: "order_confirmation",
      label: "Order confirmation",
      description: "Customer receipt after a successful checkout / paid capture.",
      subject: "Your TeaFloww order {{order_id}} is confirmed",
      variables: ["order_id", "customer_name", "order_total", "store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '<p><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>' +
        "<h2>Thank you, {{customer_name}}</h2>" +
        "<p>Your order <strong>{{order_id}}</strong> ({{order_total}}) is confirmed and being freshly packed at our Siliguri hub.</p>" +
        "<p>Questions? Reply to {{support_email}}.</p>" +
        "<p style=\"color:#63665e;font-size:12px\">— {{store_name}}</p></div>",
      text_body:
        "Thank you, {{customer_name}}.\n\nYour order {{order_id}} ({{order_total}}) is confirmed and being freshly packed at our Siliguri hub.\n\nQuestions? Reply to {{support_email}}.\n\n— {{store_name}}",
    },
    {
      key: "order_shipped",
      label: "Order shipped / dispatch",
      description: "Dispatch notification with tracking link when an order ships.",
      subject: "Your TeaFloww order {{order_id}} has shipped",
      variables: ["order_id", "customer_name", "tracking_url", "store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '<p><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>' +
        "<h2>Your teas are on their way, {{customer_name}}</h2>" +
        "<p>Order <strong>{{order_id}}</strong> has shipped. Track it here:</p>" +
        '<p><a href="{{tracking_url}}">{{tracking_url}}</a></p>' +
        "<p>Questions? Reply to {{support_email}}.</p></div>",
      text_body:
        "Your teas are on their way, {{customer_name}}.\n\nOrder {{order_id}} has shipped. Track it here:\n{{tracking_url}}\n\nQuestions? Reply to {{support_email}}.",
    },
    {
      key: "contact_acknowledgement",
      label: "Contact inquiry acknowledgement",
      description: "Auto-reply after a /contact submission with the ticket reference.",
      subject: "We received your message {{reference_code}} — TeaFloww",
      variables: ["customer_name", "reference_code", "topic", "store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '<p><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>' +
        "<h2>Thank you, {{customer_name}}</h2>" +
        "<p>We received your {{topic}} inquiry (reference <strong>{{reference_code}}</strong>). A sommelier or support specialist will respond within 24 hours.</p>" +
        "<p>Need faster help? Reply to {{support_email}}.</p></div>",
      text_body:
        "Thank you, {{customer_name}}.\n\nWe received your {{topic}} inquiry (reference {{reference_code}}). A sommelier or support specialist will respond within 24 hours.\n\nNeed faster help? Reply to {{support_email}}.",
    },
    {
      key: "wholesale_acknowledgement",
      label: "Wholesale inquiry acknowledgement",
      description: "Auto-reply after a /wholesale submission.",
      subject: "Your wholesale inquiry is with our trade desk — TeaFloww",
      variables: ["customer_name", "business_name", "store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '<p><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>' +
        "<h2>Thank you, {{customer_name}}</h2>" +
        "<p>Your wholesale inquiry for <strong>{{business_name}}</strong> is with our trade desk. We respond within 2 business days.</p>" +
        "<p>Trade desk: {{support_email}}.</p></div>",
      text_body:
        "Thank you, {{customer_name}}.\n\nYour wholesale inquiry for {{business_name}} is with our trade desk. We respond within 2 business days.\n\nTrade desk: {{support_email}}.",
    },
    {
      key: "newsletter_welcome",
      label: "Newsletter welcome",
      description: "Welcome email after newsletter consent (requires provider send wiring).",
      subject: "Welcome to the TeaFloww tea circle",
      variables: ["store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '<p><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>' +
        "<h2>Welcome to the tea circle</h2>" +
        "<p>First-flush arrivals, cupping notes, and harvest stories — straight from Siliguri. No spam, unsubscribe anytime.</p>" +
        "<p>— {{store_name}} ({{support_email}})</p></div>",
      text_body:
        "Welcome to the tea circle.\n\nFirst-flush arrivals, cupping notes, and harvest stories — straight from Siliguri. No spam, unsubscribe anytime.\n\n— {{store_name}} ({{support_email}})",
    },
    {
      key: "abandoned_cart_recovery",
      label: "Abandoned cart recovery",
      description: "Recovery nudge with the cart recovery URL.",
      subject: "Your teas are still waiting — TeaFloww",
      variables: ["customer_name", "recovery_url", "store_name", "support_email", "logo_url"],
      html_body:
        '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">' +
        '<p><img src="{{logo_url}}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>' +
        "<h2>{{customer_name}}, your teas are still waiting</h2>" +
        '<p><a href="{{recovery_url}}">Resume your bag</a> — lots are packed fresh at origin and move quickly in season.</p>' +
        "<p>Questions? Reply to {{support_email}}.</p></div>",
      text_body:
        "{{customer_name}}, your teas are still waiting.\n\nResume your bag: {{recovery_url}}\n\nQuestions? Reply to {{support_email}}.",
    },
  ];

  const insert = db.prepare(`
    INSERT INTO email_templates (key, label, description, subject, html_body, text_body, variables_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO NOTHING
  `);
  const tx = db.transaction(() => {
    for (const d of defaults) {
      insert.run(d.key, d.label, d.description, d.subject, d.html_body, d.text_body, JSON.stringify(d.variables));
    }
  });
  tx();
}

export function down() {}
