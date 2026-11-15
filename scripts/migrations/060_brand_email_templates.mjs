// 060: Comprehensive brand email templates with logo, tables, CTA buttons, and brand footer.
// Additive, versioned, idempotent for SQLite.

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildBrandEmailHtml(options) {
  const badgeHtml = options.categoryBadge
    ? `<div style="display:inline-block;padding:5px 12px;background:#eaf0ec;color:#143c31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;border-radius:20px;margin-bottom:16px;border:1px solid rgba(20,60,49,0.15);">${escapeHtml(
        options.categoryBadge
      )}</div>`
    : "";

  const leadHtml = options.leadParagraph
    ? `<p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#1d2a24;">${options.leadParagraph}</p>`
    : "";

  const extraBodyHtml = options.bodyHtml ? options.bodyHtml : "";

  let tableHtml = "";
  if (options.table && options.table.rows.length > 0) {
    const colHeaders = options.table.columns.map((c) =>
      typeof c === "string" ? { header: c, align: "left", width: undefined } : c
    );

    const theadHtml = `
      <thead>
        <tr style="background:#f4f7f4;border-bottom:2px solid #e5e7eb;">
          ${colHeaders
            .map(
              (c) =>
                `<th scope="col" style="padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#143c31;text-align:${
                  c.align || "left"
                };${c.width ? `width:${c.width};` : ""}">${escapeHtml(c.header)}</th>`
            )
            .join("")}
        </tr>
      </thead>`;

    const tbodyHtml = `
      <tbody>
        ${options.table.rows
          .map((r, rowIdx) => {
            const cells = Array.isArray(r) ? r : r.cells;
            const isHighlight = !Array.isArray(r) && r.isHighlighted;
            const bg = isHighlight ? "#fbfdfa" : rowIdx % 2 === 0 ? "#ffffff" : "#fafafa";
            return `
              <tr style="background:${bg};border-bottom:1px solid #e5e7eb;">
                ${cells
                  .map((cell, cIdx) => {
                    const align = colHeaders[cIdx]?.align || "left";
                    const isFirst = cIdx === 0;
                    return `<td style="padding:11px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:#1d2a24;text-align:${align};${
                      isFirst ? "font-weight:600;" : ""
                    }${isHighlight ? "font-weight:700;color:#143c31;" : ""}">${cell}</td>`;
                  })
                  .join("")}
              </tr>`;
          })
          .join("")}
      </tbody>`;

    tableHtml = `
      <div style="margin:20px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;">
        ${
          options.table.caption
            ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:#63665e;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(
                options.table.caption
              )}</div>`
            : ""
        }
        <table role="table" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;background:#ffffff;">
          ${theadHtml}
          ${tbodyHtml}
        </table>
      </div>`;
  }

  let ctaHtml = "";
  if (options.ctaButton && options.ctaButton.url && options.ctaButton.label) {
    ctaHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 22px 0;">
        <tr>
          <td align="center" style="border-radius:6px;background-color:#143c31;">
            <a href="${options.ctaButton.url}" target="_blank" rel="noopener noreferrer" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;display:inline-block;border:1px solid #143c31;letter-spacing:0.02em;">
              ${escapeHtml(options.ctaButton.label)} &rarr;
            </a>
          </td>
        </tr>
      </table>`;
  }

  const secondaryHtml = options.secondaryNoteHtml
    ? `<div style="margin:16px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.55;color:#63665e;">${options.secondaryNoteHtml}</div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(options.heading)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#faf8f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Outer Wrapper Table -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#faf8f5;margin:0;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Main 600px Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;text-align:left;">
          <!-- Brand Header with Logo -->
          <tr>
            <td align="center" style="padding:10px 0 20px 0;">
              {{#logo}}
              <a href="https://teafloww.com" target="_blank" style="text-decoration:none;display:inline-block;">
                <img src="{{logo_url}}" alt="{{store_name}} Logo" width="140" style="display:block;width:140px;max-width:140px;height:auto;border:0;outline:none;" />
              </a>
              {{/logo}}
            </td>
          </tr>
          <!-- Main Content Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:34px 28px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
              ${badgeHtml}
              <h1 style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;font-weight:700;color:#143c31;">${options.heading}</h1>
              ${leadHtml}
              ${extraBodyHtml}
              ${tableHtml}
              ${ctaHtml}
              ${secondaryHtml}
            </td>
          </tr>
          <!-- Standard Brand Footer -->
          <tr>
            <td style="padding:24px 12px 10px 12px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.6;color:#8c9b88;">
              <p style="margin:0 0 6px 0;font-weight:700;color:#143c31;font-size:13px;letter-spacing:0.04em;">
                {{store_name}} &middot; <span style="font-weight:500;color:#63665e;">Direct from Siliguri & Himalayan Estates</span>
              </p>
              <p style="margin:0 0 6px 0;color:#63665e;">
                A brand by Nirva &middot; GSTIN: 19CTHPK8646J2ZY
              </p>
              <p style="margin:0 0 8px 0;color:#8c9b88;font-size:11px;">
                Works: 00, Fulbari Ghoshpukur Bypass, Binnaguri, Dist Jalpaiguri, Siliguri, WB 734015<br>
                Office: Shiv Shakti Kali Bari Rd Sukantapally East Siliguri 734005
              </p>
              <p style="margin:0;color:#8c9b88;font-size:11px;">
                Support: <a href="mailto:{{support_email}}" style="color:#23483a;text-decoration:underline;">{{support_email}}</a> &middot; Phone: +91 7001304853
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildBrandEmailText(options) {
  const parts = [];

  if (options.categoryBadge) {
    parts.push(`[${options.categoryBadge.toUpperCase()}]`);
  }

  parts.push(options.heading);
  parts.push("=".repeat(Math.min(options.heading.length, 50)));

  if (options.leadParagraph) {
    parts.push(options.leadParagraph);
  }

  if (options.table && options.table.rows.length > 0) {
    parts.push("");
    parts.push(options.table.columns.join(" | "));
    parts.push("-".repeat(40));
    for (const r of options.table.rows) {
      parts.push(r.join(" | "));
    }
  }

  if (options.ctaButton && options.ctaButton.url) {
    parts.push("");
    parts.push(`${options.ctaButton.label}:`);
    parts.push(options.ctaButton.url);
  }

  if (options.secondaryNote) {
    parts.push("");
    parts.push(options.secondaryNote);
  }

  parts.push("");
  parts.push("---");
  parts.push("{{store_name}} (Nirva)");
  parts.push("Direct from Siliguri & Himalayan Estates");
  parts.push("Works: 00, Fulbari Ghoshpukur Bypass, Siliguri, WB 734015");
  parts.push("Office: Shiv Shakti Kali Bari Rd Sukantapally East Siliguri 734005");
  parts.push("Contact: {{support_email}} | Phone: +91 7001304853 | GSTIN: 19CTHPK8646J2ZY");

  return parts.join("\n\n");
}

export async function up(db) {
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

  const templates = [
    {
      key: "admin_password_reset",
      label: "Admin password reset",
      description: "Sent from /api/admin/forgot when staff request a password reset link.",
      subject: "TeaFloww admin password reset — expires in 60 minutes",
      variables: ["reset_link", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Security Notice",
        heading: "Reset your admin password",
        leadParagraph:
          "A password reset was requested for the TeaFloww admin console. This security link expires in 60 minutes:",
        table: {
          caption: "Security Specifications",
          columns: ["Detail", "Status"],
          rows: [
            ["Access Level", "Staff & Admin Console"],
            ["Link Validity", "Expires in 60 minutes"],
            ["Action Required", "One-time password update"],
          ],
        },
        ctaButton: {
          label: "Reset Admin Password",
          url: "{{reset_link}}",
        },
        secondaryNoteHtml:
          'If you did not request this, ignore this message. Contact {{support_email}} for help.<br><br>Direct link:<br><a href="{{reset_link}}" style="color:#23483a;word-break:break-all;">{{reset_link}}</a>',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Security Notice",
        heading: "Reset your admin password",
        leadParagraph:
          "A password reset was requested for the TeaFloww admin console. This security link expires in 60 minutes.\n\n{{reset_link}}",
        table: {
          columns: ["Detail", "Status"],
          rows: [
            ["Access Level", "Staff & Admin Console"],
            ["Link Validity", "Expires in 60 minutes"],
            ["Action Required", "One-time password update"],
          ],
        },
        ctaButton: {
          label: "Reset Link",
          url: "{{reset_link}}",
        },
        secondaryNote:
          "If you did not request this, ignore this message. Contact {{support_email}} for help.",
      }),
    },
    {
      key: "order_confirmation",
      label: "Order confirmation",
      description: "Customer receipt after a successful checkout / paid capture.",
      subject: "Your TeaFloww order {{order_id}} is confirmed",
      variables: ["order_id", "customer_name", "order_total", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Order Confirmed",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your order <strong>{{order_id}}</strong> ({{order_total}}) is confirmed and being freshly packed at our Siliguri hub.",
        table: {
          caption: "Order Summary",
          columns: ["Summary Item", "Details"],
          rows: [
            ["Order Reference", "<strong>{{order_id}}</strong>"],
            ["Order Total", "<strong>{{order_total}}</strong>"],
            ["Packaging Hub", "Siliguri Fresh-Pack Facility, West Bengal"],
            ["Harvest Lot", "Single-Estate Himalayan Teas"],
            ["Order Status", "Confirmed & Packing"],
          ],
        },
        secondaryNoteHtml:
          'Every order is packed at origin in nitrogen-flushed barrier pouches to protect delicate volatile aromatics.<br><br>Questions? Reply directly to this email or write to <a href="mailto:{{support_email}}" style="color:#23483a;">{{support_email}}</a>.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Order Confirmed",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your order {{order_id}} ({{order_total}}) is confirmed and being freshly packed at our Siliguri hub.",
        table: {
          columns: ["Summary Item", "Details"],
          rows: [
            ["Order Reference", "{{order_id}}"],
            ["Order Total", "{{order_total}}"],
            ["Packaging Hub", "Siliguri Fresh-Pack Facility, West Bengal"],
            ["Harvest Lot", "Single-Estate Himalayan Teas"],
            ["Order Status", "Confirmed & Packing"],
          ],
        },
        secondaryNote: "Questions? Reply to {{support_email}}.",
      }),
    },
    {
      key: "order_shipped",
      label: "Order shipped / dispatch",
      description: "Dispatch notification with tracking link when an order ships.",
      subject: "Your TeaFloww order {{order_id}} has shipped",
      variables: ["order_id", "customer_name", "tracking_url", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Dispatch Notice",
        heading: "Your teas are on their way, {{customer_name}}",
        leadParagraph:
          "Order <strong>{{order_id}}</strong> has shipped from our Siliguri facility and is traveling to your doorstep.",
        table: {
          caption: "Shipment Tracking Details",
          columns: ["Shipment Detail", "Status"],
          rows: [
            ["Order Number", "<strong>{{order_id}}</strong>"],
            ["Dispatch Origin", "Siliguri Logistics Center, West Bengal"],
            ["Fulfillment Status", "Handed to Courier Partner"],
            ["Tracking State", "Live Tracking Active"],
          ],
        },
        ctaButton: {
          label: "Track Your Shipment",
          url: "{{tracking_url}}",
        },
        secondaryNoteHtml:
          'Direct tracking link:<br><a href="{{tracking_url}}" style="color:#23483a;word-break:break-all;">{{tracking_url}}</a><br><br>Questions? Reply to {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Dispatch Notice",
        heading: "Your teas are on their way, {{customer_name}}",
        leadParagraph:
          "Order {{order_id}} has shipped from our Siliguri facility and is traveling to your doorstep.",
        table: {
          columns: ["Shipment Detail", "Status"],
          rows: [
            ["Order Number", "{{order_id}}"],
            ["Dispatch Origin", "Siliguri Logistics Center, West Bengal"],
            ["Fulfillment Status", "Handed to Courier Partner"],
            ["Tracking State", "Live Tracking Active"],
          ],
        },
        ctaButton: {
          label: "Tracking URL",
          url: "{{tracking_url}}",
        },
        secondaryNote: "Questions? Reply to {{support_email}}.",
      }),
    },
    {
      key: "contact_acknowledgement",
      label: "Contact inquiry acknowledgement",
      description: "Auto-reply after a /contact submission with the ticket reference.",
      subject: "We received your message {{reference_code}} — TeaFloww",
      variables: ["customer_name", "reference_code", "topic", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Inquiry Received",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "We received your {{topic}} inquiry (reference <strong>{{reference_code}}</strong>). A sommelier or support specialist will respond within 24 hours.",
        table: {
          caption: "Inquiry Confirmation",
          columns: ["Inquiry Field", "Details"],
          rows: [
            ["Reference Code", "<strong>{{reference_code}}</strong>"],
            ["Topic", "{{topic}}"],
            ["Turnaround SLA", "Within 24 hours (Monday – Saturday)"],
            ["Direct Desk", "{{support_email}}"],
          ],
        },
        secondaryNoteHtml:
          'Need faster help or have extra details? Reply directly to this email or contact <a href="mailto:{{support_email}}" style="color:#23483a;">{{support_email}}</a>.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Inquiry Received",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "We received your {{topic}} inquiry (reference {{reference_code}}). A sommelier or support specialist will respond within 24 hours.",
        table: {
          columns: ["Inquiry Field", "Details"],
          rows: [
            ["Reference Code", "{{reference_code}}"],
            ["Topic", "{{topic}}"],
            ["Turnaround SLA", "Within 24 hours (Monday – Saturday)"],
            ["Direct Desk", "{{support_email}}"],
          ],
        },
        secondaryNote: "Need faster help? Reply to {{support_email}}.",
      }),
    },
    {
      key: "wholesale_acknowledgement",
      label: "Wholesale inquiry acknowledgement",
      description: "Auto-reply after a /wholesale submission.",
      subject: "Your wholesale inquiry is with our trade desk — TeaFloww",
      variables: ["customer_name", "business_name", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "B2B Trade Desk",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your wholesale inquiry for <strong>{{business_name}}</strong> is with our trade desk. We respond within 2 business days.",
        table: {
          caption: "Trade Inquiry Details",
          columns: ["Trade Field", "Information"],
          rows: [
            ["Business Entity", "<strong>{{business_name}}</strong>"],
            ["Account Type", "Wholesale & Horeca Direct Sourcing"],
            ["Trade Desk Hub", "Siliguri, West Bengal"],
            ["Response Target", "Within 2 business days"],
            ["Trade Desk", "{{support_email}}"],
          ],
        },
        secondaryNoteHtml:
          'We supply premium cafes, boutique hotels, and specialty retailers with estate-direct teas, customized packaging, and batch documentation.<br><br>Trade desk: <a href="mailto:{{support_email}}" style="color:#23483a;">{{support_email}}</a>.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "B2B Trade Desk",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your wholesale inquiry for {{business_name}} is with our trade desk. We respond within 2 business days.",
        table: {
          columns: ["Trade Field", "Information"],
          rows: [
            ["Business Entity", "{{business_name}}"],
            ["Account Type", "Wholesale & Horeca Direct Sourcing"],
            ["Trade Desk Hub", "Siliguri, West Bengal"],
            ["Response Target", "Within 2 business days"],
            ["Trade Desk", "{{support_email}}"],
          ],
        },
        secondaryNote: "Trade desk: {{support_email}}.",
      }),
    },
    {
      key: "newsletter_welcome",
      label: "Newsletter welcome",
      description: "Welcome email after newsletter consent (requires provider send wiring).",
      subject: "Welcome to the TeaFloww tea circle",
      variables: ["store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Tea Circle Welcome",
        heading: "Welcome to the tea circle",
        leadParagraph:
          "First-flush arrivals, cupping notes, and harvest stories — straight from Siliguri. No spam, unsubscribe anytime.",
        table: {
          caption: "Your Circle Privileges",
          columns: ["Privilege", "Description"],
          rows: [
            ["First-Flush Drops", "Early access to limited seasonal harvest flushes"],
            ["Sommelier Cupping Notes", "Direct brewing guidance and tasting profiles"],
            ["Garden Transparency", "Elevation, invoice numbers, and harvest dates"],
            ["Origin Dispatches", "Direct sourcing from Darjeeling, Assam, and Dooars"],
          ],
        },
        ctaButton: {
          label: "Explore Fresh Harvests",
          url: "https://teafloww.com/shop",
        },
        secondaryNoteHtml: "Pure single-estate teas straight from Siliguri. &mdash; {{store_name}} ({{support_email}})",
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Tea Circle Welcome",
        heading: "Welcome to the tea circle",
        leadParagraph:
          "First-flush arrivals, cupping notes, and harvest stories — straight from Siliguri. No spam, unsubscribe anytime.",
        table: {
          columns: ["Privilege", "Description"],
          rows: [
            ["First-Flush Drops", "Early access to limited seasonal harvest flushes"],
            ["Sommelier Cupping Notes", "Direct brewing guidance and tasting profiles"],
            ["Garden Transparency", "Elevation, invoice numbers, and harvest dates"],
            ["Origin Dispatches", "Direct sourcing from Darjeeling, Assam, and Dooars"],
          ],
        },
        ctaButton: {
          label: "Explore Teas",
          url: "https://teafloww.com/shop",
        },
        secondaryNote: "— {{store_name}} ({{support_email}})",
      }),
    },
    {
      key: "abandoned_cart_recovery",
      label: "Abandoned cart recovery",
      description: "Recovery nudge with the cart recovery URL.",
      subject: "Your teas are still waiting — TeaFloww",
      variables: ["customer_name", "recovery_url", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Saved Selection",
        heading: "{{customer_name}}, your teas are still waiting",
        leadParagraph:
          "Your selected teas are still reserved in your bag. Lots are packed fresh at origin and move quickly in season.",
        table: {
          caption: "Reserved Bag Status",
          columns: ["Bag Detail", "Status"],
          rows: [
            ["Reservation State", "Saved for your checkout"],
            ["Freshness Guarantee", "Direct nitrogen-flushed packaging"],
            ["Dispatch Hub", "Dispatched fresh from Siliguri hub"],
            ["Authenticity", "100% Single-Estate Himalayan lots"],
          ],
        },
        ctaButton: {
          label: "Resume Your Bag & Checkout",
          url: "{{recovery_url}}",
        },
        secondaryNoteHtml:
          'Direct checkout link:<br><a href="{{recovery_url}}" style="color:#23483a;word-break:break-all;">{{recovery_url}}</a><br><br>Questions? Reply to {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Saved Selection",
        heading: "{{customer_name}}, your teas are still waiting",
        leadParagraph:
          "Your selected teas are still reserved in your bag. Lots are packed fresh at origin and move quickly in season.",
        table: {
          columns: ["Bag Detail", "Status"],
          rows: [
            ["Reservation State", "Saved for your checkout"],
            ["Freshness Guarantee", "Direct nitrogen-flushed packaging"],
            ["Dispatch Hub", "Dispatched fresh from Siliguri hub"],
            ["Authenticity", "100% Single-Estate Himalayan lots"],
          ],
        },
        ctaButton: {
          label: "Resume Link",
          url: "{{recovery_url}}",
        },
        secondaryNote: "Questions? Reply to {{support_email}}.",
      }),
    },
    {
      key: "commerce_order_received",
      label: "Commerce order received",
      description: "Live commerce receipt when an order is received.",
      subject: "Your TeaFloww order {{order_id}} was received",
      variables: [
        "customer_name",
        "order_id",
        "order_total",
        "payment_status",
        "tracking_url",
        "support_email",
        "store_name",
        "logo_url",
      ],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Commerce Receipt",
        heading: "We received your order, {{customer_name}}",
        leadParagraph:
          "We received your tea order <strong>{{order_id}}</strong> for <strong>{{order_total}}</strong>. Payment status: {{payment_status}}.",
        table: {
          caption: "Order Information",
          columns: ["Item", "Details"],
          rows: [
            ["Order Reference", "<strong>{{order_id}}</strong>"],
            ["Total Amount", "<strong>{{order_total}}</strong>"],
            ["Payment Status", "{{payment_status}}"],
            ["Dispatch Origin", "Siliguri Packaging Facility, West Bengal"],
          ],
        },
        ctaButton: {
          label: "View Order & Live Status",
          url: "{{tracking_url}}",
        },
        secondaryNoteHtml:
          'Delivery preparation and tracking updates will appear at your private order link:<br><a href="{{tracking_url}}" style="color:#23483a;word-break:break-all;">{{tracking_url}}</a><br><br>Questions? Contact {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Commerce Receipt",
        heading: "We received your order, {{customer_name}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nWe received your tea order {{order_id}} for {{order_total}}. Payment status: {{payment_status}}.",
        table: {
          columns: ["Item", "Details"],
          rows: [
            ["Order Reference", "{{order_id}}"],
            ["Total Amount", "{{order_total}}"],
            ["Payment Status", "{{payment_status}}"],
            ["Dispatch Origin", "Siliguri Packaging Facility, West Bengal"],
          ],
        },
        ctaButton: {
          label: "Order URL",
          url: "{{tracking_url}}",
        },
        secondaryNote:
          "Delivery preparation and tracking updates will appear at your private order link: {{tracking_url}}\n\nQuestions? Contact {{support_email}}.",
      }),
    },
    {
      key: "commerce_payment_review",
      label: "Captured payment requiring review",
      description: "Payment received for order requiring staff review.",
      subject: "Payment received for TeaFloww order {{order_id}}",
      variables: [
        "customer_name",
        "order_id",
        "order_total",
        "payment_status",
        "tracking_url",
        "support_email",
        "store_name",
        "logo_url",
      ],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Payment Review",
        heading: "Payment received for order {{order_id}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nPayment was received for order <strong>{{order_id}}</strong> ({{order_total}}). Fulfillment requires a brief review by our team. We will arrange delivery or a refund after resolving the issue.",
        table: {
          caption: "Review Details",
          columns: ["Review Item", "Status"],
          rows: [
            ["Order ID", "<strong>{{order_id}}</strong>"],
            ["Amount Paid", "<strong>{{order_total}}</strong>"],
            ["Review Status", "In Review by Operations"],
            ["Resolution Target", "Within 1 business day"],
          ],
        },
        ctaButton: {
          label: "Check Order Status",
          url: "{{tracking_url}}",
        },
        secondaryNoteHtml:
          'Your private order link:<br><a href="{{tracking_url}}" style="color:#23483a;word-break:break-all;">{{tracking_url}}</a><br><br>Questions? Contact {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Payment Review",
        heading: "Payment received for order {{order_id}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nPayment was received for order {{order_id}} ({{order_total}}). Fulfillment requires a review by our team. We will arrange delivery or a refund after resolving the issue.",
        table: {
          columns: ["Review Item", "Status"],
          rows: [
            ["Order ID", "{{order_id}}"],
            ["Amount Paid", "{{order_total}}"],
            ["Review Status", "In Review by Operations"],
            ["Resolution Target", "Within 1 business day"],
          ],
        },
        ctaButton: {
          label: "Order URL",
          url: "{{tracking_url}}",
        },
        secondaryNote:
          "Your private order link: {{tracking_url}}\n\nQuestions? Contact {{support_email}}.",
      }),
    },
    {
      key: "subscription_renewal",
      label: "Subscription renewal",
      description: "Manual-pay renewal and subscription management",
      subject: "Your TeaFloww subscription renewal",
      variables: [
        "customer_name",
        "dispatch_date",
        "renewal_url",
        "store_name",
        "support_email",
        "logo_url",
      ],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Subscription Renewal",
        heading: "Subscription renewal notice for {{customer_name}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nYour TeaFloww subscription renewal is scheduled for <strong>{{dispatch_date}}</strong>. Review the exact total, pay online, choose eligible COD, skip or manage your subscription.",
        table: {
          caption: "Renewal Schedule",
          columns: ["Cycle Detail", "Information"],
          rows: [
            ["Dispatch Date", "<strong>{{dispatch_date}}</strong>"],
            ["Payment Policy", "Manual payment / Prepaid (No auto-debit)"],
            ["Hub", "Siliguri Packaging Facility, WB"],
            ["Flexibility", "Skip, pause, or change teas anytime"],
          ],
        },
        ctaButton: {
          label: "Review, Pay or Manage Subscription",
          url: "{{renewal_url}}",
        },
        secondaryNoteHtml:
          'Prepaid renewals require payment each time; there is no automatic debit. Delivery fees apply under the current shipping policy.<br><br>Direct link:<br><a href="{{renewal_url}}" style="color:#23483a;word-break:break-all;">{{renewal_url}}</a>',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Subscription Renewal",
        heading: "Subscription renewal notice for {{customer_name}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nYour TeaFloww subscription renewal is scheduled for {{dispatch_date}}. Review the exact total, pay online, choose eligible COD, skip or manage your subscription here:\n{{renewal_url}}",
        table: {
          columns: ["Cycle Detail", "Information"],
          rows: [
            ["Dispatch Date", "{{dispatch_date}}"],
            ["Payment Policy", "Manual payment / Prepaid (No auto-debit)"],
            ["Hub", "Siliguri Packaging Facility, WB"],
            ["Flexibility", "Skip, pause, or change teas anytime"],
          ],
        },
        ctaButton: {
          label: "Manage Link",
          url: "{{renewal_url}}",
        },
        secondaryNote:
          "Prepaid renewals require payment each time; there is no automatic debit. Delivery fees apply under the current shipping policy.\n\nTeaFloww",
      }),
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO email_templates (key, label, description, subject, html_body, text_body, variables_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      label = excluded.label,
      description = excluded.description,
      subject = excluded.subject,
      html_body = excluded.html_body,
      text_body = excluded.text_body,
      variables_json = excluded.variables_json,
      updated_at = CURRENT_TIMESTAMP
  `);

  if (typeof db.transaction === "function") {
    const tx = db.transaction(() => {
      for (const t of templates) {
        stmt.run(
          t.key,
          t.label,
          t.description,
          t.subject,
          t.html_body,
          t.text_body,
          JSON.stringify(t.variables)
        );
      }
    });
    tx();
  } else {
    for (const t of templates) {
      await stmt.run(
        t.key,
        t.label,
        t.description,
        t.subject,
        t.html_body,
        t.text_body,
        JSON.stringify(t.variables)
      );
    }
  }
}

export function down() {}
