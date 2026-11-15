/**
 * Core brand email layout engine for TeaFloww (Nirva).
 * Generates universal, responsive, client-compatible HTML emails and
 * matching formatted plain-text emails.
 *
 * Adheres to modern web accessibility, table semantics, and email client
 * standards (Gmail, Apple Mail, Outlook MSO, Yahoo, mobile webviews).
 */

export interface EmailTableColumn {
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface EmailTableRow {
  cells: string[];
  isHighlighted?: boolean;
}

export interface BrandEmailOptions {
  categoryBadge?: string;
  heading: string;
  leadParagraph?: string;
  bodyHtml?: string;
  table?: {
    caption?: string;
    columns: Array<string | EmailTableColumn>;
    rows: Array<Array<string> | EmailTableRow>;
  };
  detailsBox?: {
    title: string;
    items: Array<{ label: string; value: string }>;
  };
  ctaButton?: {
    label: string;
    url: string;
  };
  secondaryNoteHtml?: string;
}

export interface BrandEmailTextOptions {
  categoryBadge?: string;
  heading: string;
  leadParagraph?: string;
  table?: {
    columns: string[];
    rows: string[][];
  };
  details?: Array<{ label: string; value: string }>;
  ctaButton?: {
    label: string;
    url: string;
  };
  secondaryNote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Builds the complete outer HTML email template with logo, header badge,
 * styled content card, responsive data/key-value tables, CTA button, and official brand footer.
 */
export function buildBrandEmailHtml(options: BrandEmailOptions): string {
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
      typeof c === "string" ? { header: c, align: "left" as const, width: undefined } : c
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

  let detailsHtml = "";
  if (options.detailsBox && options.detailsBox.items.length > 0) {
    detailsHtml = `
      <div style="margin:20px 0;padding:16px 18px;background:#f9f8f5;border:1px solid #e8e4db;border-radius:6px;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#143c31;margin-bottom:10px;">${escapeHtml(
          options.detailsBox.title
        )}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          ${options.detailsBox.items
            .map(
              (item) => `
            <tr>
              <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#63665e;width:38%;vertical-align:top;">${escapeHtml(
                item.label
              )}</td>
              <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#1d2a24;font-weight:600;vertical-align:top;">${
                item.value
              }</td>
            </tr>`
            )
            .join("")}
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
              ${detailsHtml}
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

/**
 * Builds matching well-formatted plain-text version for any email.
 */
export function buildBrandEmailText(options: BrandEmailTextOptions): string {
  const parts: string[] = [];

  if (options.categoryBadge) {
    parts.push(`[${options.categoryBadge.toUpperCase()}]`);
  }

  parts.push(options.heading);
  parts.push("=".repeat(Math.min(options.heading.length, 50)));

  if (options.leadParagraph) {
    parts.push(options.leadParagraph);
  }

  if (options.details && options.details.length > 0) {
    parts.push("");
    parts.push("Details:");
    for (const d of options.details) {
      parts.push(`- ${d.label}: ${d.value}`);
    }
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
