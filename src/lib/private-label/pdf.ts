/**
 * TeaFloww Private Label Studio — Branded PDF & Printable Quotation Generator
 * Milestone M4: Branded Quotation Summary & PDF Generation
 *
 * Implements legal entity metadata, GSTIN 19CTHPK8646J2ZY, Siliguri works,
 * 14-day price lock guarantee, 50/50 payment milestone schedule, and pure
 * Node.js PDF-1.4 binary generation with zero heavy external dependencies.
 */

import type { QuoteWithItems, Project, Client } from "./types";

export const TEAFLOWW_BRAND_CONSTANTS = {
  brandName: "TeaFloww",
  entityName: "Nirva",
  domain: "TeaFloww.com",
  email: "info@teafloww.com",
  phone: "+91 7001304853",
  gstin: "19CTHPK8646J2ZY",
  officeAddress: "Shiv Shakti Kali Bari Rd Sukantapally East siliguri 734005",
  worksAddress:
    "00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri, Dist Jalpaiguri City Siliguri , West Bengal, 734015",
  termsValidityDays: 14,
  depositPercentage: 50,
  balancePercentage: 50,
};

export function formatPaiseToInr(paise: number): string {
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatCurrency(paise: number, currency = "INR"): string {
  const amount = paise / 100;
  if (currency === "USD") {
    // Standard commercial conversion indicator ($1 = ₹84)
    const usd = amount / 84;
    return (
      "$" +
      usd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  if (currency === "EUR") {
    // Standard commercial conversion indicator (€1 = ₹90)
    const eur = amount / 90;
    return (
      "€" +
      eur.toLocaleString("en-IE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return formatPaiseToInr(paise);
}

/**
 * Escapes characters for PDF stream string literal syntax: (Text \(with\) parens and \\)
 */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Generates a compliant, self-contained PDF-1.4 binary buffer for a quote summary.
 * Strictly adheres to zero heavy dependencies rule while producing valid vector PDF.
 */
export function generateQuotationPdfBuffer(
  quote: QuoteWithItems,
  project?: Project | null,
  client?: Client | null,
  currency = "INR"
): Buffer {
  const isExpired = quote.valid_until ? new Date(quote.valid_until) < new Date() : false;
  const isFirm = quote.status === "firm_issued" || quote.status === "customer_accepted";

  const lines: Array<{ font: "F1" | "F2"; size: number; text: string; x: number; y: number }> = [];

  // Watermark for expired quotes
  if (isExpired) {
    lines.push({
      font: "F1",
      size: 44,
      text: "*** EXPIRED QUOTATION — RATES SUBJECT TO RE-ISSUE ***",
      x: 35,
      y: 770,
    });
  }

  // Header
  lines.push({ font: "F1", size: 20, text: "TEAFLOWW — PRIVATE LABEL STUDIO", x: 40, y: 735 });
  lines.push({
    font: "F2",
    size: 9,
    text: `Legal Entity: ${TEAFLOWW_BRAND_CONSTANTS.entityName} | GSTIN: ${TEAFLOWW_BRAND_CONSTANTS.gstin}`,
    x: 40,
    y: 718,
  });
  lines.push({
    font: "F2",
    size: 9,
    text: `Works: ${TEAFLOWW_BRAND_CONSTANTS.worksAddress}`,
    x: 40,
    y: 705,
  });
  lines.push({
    font: "F2",
    size: 9,
    text: `Contact: ${TEAFLOWW_BRAND_CONSTANTS.email} | ${TEAFLOWW_BRAND_CONSTANTS.phone} | ${TEAFLOWW_BRAND_CONSTANTS.domain}`,
    x: 40,
    y: 692,
  });

  // Reference bar
  lines.push({
    font: "F1",
    size: 11,
    text: `COMMERCIAL QUOTATION & SPECIFICATION SUMMARY`,
    x: 40,
    y: 665,
  });
  lines.push({
    font: "F2",
    size: 10,
    text: `Quote Ref: ${quote.quote_number || quote.id} (Rev ${quote.revision || 1}) | Status: ${quote.status.toUpperCase()} (${isFirm ? "Firm Price Lock" : "Estimated"})`,
    x: 40,
    y: 650,
  });

  const issuedDate = quote.issued_at ? new Date(quote.issued_at).toLocaleDateString("en-IN") : "Today";
  const validUntilDate = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-IN")
    : "14 Days from Issue";
  lines.push({
    font: "F2",
    size: 9,
    text: `Issued: ${issuedDate} | Valid Until: ${validUntilDate} (${TEAFLOWW_BRAND_CONSTANTS.termsValidityDays}-Day Price Lock Guarantee)`,
    x: 40,
    y: 637,
  });

  // Project & Client info
  const clientName = client?.company_name || project?.title || "Valued Private Label Client";
  const contactName = client?.contact_name || "Commercial Buyer";
  lines.push({
    font: "F1",
    size: 10,
    text: `PREPARED FOR: ${clientName} (Attn: ${contactName})`,
    x: 40,
    y: 610,
  });
  lines.push({
    font: "F2",
    size: 9,
    text: `Project Title: ${project?.title || "Custom Private Label Tea Packaging"} | Target Market: ${project?.target_market || "India"}`,
    x: 40,
    y: 597,
  });

  // 12-Component Itemized Cost Table
  lines.push({ font: "F1", size: 10, text: "ITEMIZED COMMERCIAL LEDGER", x: 40, y: 570 });

  let currentY = 550;
  const items = quote.items || [];
  if (items.length > 0) {
    for (const it of items) {
      lines.push({
        font: "F2",
        size: 9,
        text: `• ${it.description} (Qty: ${it.quantity}) — ${formatCurrency(it.line_total_paise, currency)}`,
        x: 50,
        y: currentY,
      });
      currentY -= 15;
    }
  } else {
    lines.push({
      font: "F2",
      size: 9,
      text: `• Base Tea Leaf Blend Cost (with 3% loss allowance): ${formatCurrency(quote.tea_subtotal_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
    lines.push({
      font: "F2",
      size: 9,
      text: `• Primary Packaging Materials & Closures: ${formatCurrency(quote.packaging_subtotal_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
    lines.push({
      font: "F2",
      size: 9,
      text: `• Surface Printing Run Cost: ${formatCurrency(quote.printing_subtotal_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
    lines.push({
      font: "F2",
      size: 9,
      text: `• Prepress Tooling & Cylinders Setup: ${formatCurrency(quote.tooling_setup_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
    lines.push({
      font: "F2",
      size: 9,
      text: `• Cleanroom Filling & Nitrogen Labor: ${formatCurrency(quote.labor_subtotal_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
    lines.push({
      font: "F2",
      size: 9,
      text: `• Quality Assurance Cupping & Lab Testing: ${formatCurrency(quote.qc_subtotal_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
    lines.push({
      font: "F2",
      size: 9,
      text: `• Corrugated Cartons, Palletizing & Logistics: ${formatCurrency(quote.freight_paise, currency)}`,
      x: 50,
      y: currentY,
    });
    currentY -= 14;
  }

  currentY -= 10;
  lines.push({ font: "F1", size: 10, text: "STATUTORY TAXATION BREAKDOWN (DUAL-RATE GST)", x: 40, y: currentY });
  currentY -= 16;
  lines.push({
    font: "F2",
    size: 9,
    text: `• Tea Leaves (HSN 0902): 5% GST statutory rate`,
    x: 50,
    y: currentY,
  });
  currentY -= 14;
  lines.push({
    font: "F2",
    size: 9,
    text: `• Packaging & Services (SAC 9988 / HSN 4819): 18% GST statutory rate`,
    x: 50,
    y: currentY,
  });
  currentY -= 14;
  lines.push({
    font: "F1",
    size: 10,
    text: `TOTAL TAX (GST): ${formatCurrency(quote.tax_paise, currency)}`,
    x: 50,
    y: currentY,
  });
  currentY -= 20;

  lines.push({
    font: "F1",
    size: 13,
    text: `ESTIMATED GRAND TOTAL: ${formatCurrency(quote.grand_total_paise, currency)}`,
    x: 40,
    y: currentY,
  });
  currentY -= 25;

  // Milestone Payment Terms
  lines.push({ font: "F1", size: 10, text: "MILESTONE PAYMENT SCHEDULE", x: 40, y: currentY });
  currentY -= 15;
  const depositPaise = Math.round(quote.grand_total_paise * 0.5);
  const balancePaise = quote.grand_total_paise - depositPaise;
  lines.push({
    font: "F2",
    size: 9,
    text: `1. 50% Advance Deposit (${formatCurrency(depositPaise, currency)}): Payable upon digital proof sign-off to release raw materials.`,
    x: 50,
    y: currentY,
  });
  currentY -= 14;
  lines.push({
    font: "F2",
    size: 9,
    text: `2. 50% Final Balance (${formatCurrency(balancePaise, currency)}): Payable upon QC cupping & seal integrity approval prior to dispatch.`,
    x: 50,
    y: currentY,
  });
  currentY -= 25;

  // Regulatory & Statutory Compliance Notes
  lines.push({ font: "F1", size: 9, text: "STATUTORY COMPLIANCE & COMMERCIAL NOTES", x: 40, y: currentY });
  currentY -= 13;
  lines.push({
    font: "F2",
    size: 8,
    text: "• All tea leaf is 100% genuine single-estate produce processed under FSSAI Central License regulations.",
    x: 50,
    y: currentY,
  });
  currentY -= 11;
  lines.push({
    font: "F2",
    size: 8,
    text: "• Quotation rates are price-locked for 14 calendar days from date of issue. Siliguri / Jalpaiguri legal jurisdiction.",
    x: 50,
    y: currentY,
  });
  currentY -= 11;
  lines.push({
    font: "F2",
    size: 8,
    text: "• Cleanroom batch retention samples are preserved for 24 months from packaging date for full provenance trace.",
    x: 50,
    y: currentY,
  });

  // Construct standard PDF stream operators
  let streamContent = "";
  for (const item of lines) {
    const escaped = escapePdfText(item.text);
    streamContent += `BT /${item.font} ${item.size} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${escaped}) Tj ET\n`;
  }

  const streamBuf = Buffer.from(streamContent, "utf-8");
  const streamLen = streamBuf.length;

  const objects: string[] = [];
  // 1: Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  // 2: Pages
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  // 3: Page (A4: 595.28 x 841.89 pt)
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n"
  );
  // 4: Font F1 (Helvetica-Bold)
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");
  // 5: Font F2 (Helvetica)
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  // 6: Stream Contents
  objects.push(`6 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}endstream\nendobj\n`);

  // Compute byte offsets for xref table
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    const offStr = String(offsets[i]).padStart(10, "0");
    pdf += `${offStr} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf-8");
}

/**
 * Generates print-ready HTML for the `/private-label/quotes/[id]/print` route.
 */
export function generatePrintableQuotationHtml(
  quote: QuoteWithItems,
  project?: Project | null,
  client?: Client | null
): string {
  const isFirm = quote.status === "firm_issued" || quote.status === "customer_accepted";
  const isExpired = quote.valid_until ? new Date(quote.valid_until) < new Date() : false;
  const issuedDate = quote.issued_at ? new Date(quote.issued_at).toLocaleDateString("en-IN") : "Today";
  const validUntilDate = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-IN")
    : "14 Days from Issue";

  const depositPaise = Math.round(quote.grand_total_paise * 0.5);
  const balancePaise = quote.grand_total_paise - depositPaise;

  const itemsHtml = (quote.items || [])
    .map(
      (it, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 10px 12px; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-size: 13px;">
          <strong>${it.description}</strong>
        </td>
        <td style="padding: 10px 12px; font-size: 13px; text-align: right;">${it.quantity.toLocaleString("en-IN")}</td>
        <td style="padding: 10px 12px; font-size: 13px; text-align: right;">${formatPaiseToInr(it.unit_price_paise)}</td>
        <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-weight: 600;">${formatPaiseToInr(it.line_total_paise)}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TeaFloww Quote Summary — ${quote.quote_number || quote.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1A202C;
      background: #FFFFFF;
      margin: 0;
      padding: 24px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
    .header-bar {
      border-bottom: 3px solid #143C31;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge-lock {
      display: inline-block;
      background-color: #E8F5E9;
      color: #143C31;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .expired-banner {
      background-color: #FFF5F5;
      color: #C53030;
      border: 1px solid #FEB2B2;
      padding: 10px 16px;
      border-radius: 6px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    th {
      background-color: #F7FAFC;
      border-bottom: 2px solid #CBD5E0;
      padding: 10px 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
    }
  </style>
</head>
<body>
  ${
    isExpired
      ? `<div class="expired-banner">QUOTATION EXPIRED — Rates are subject to review. Contact info@teafloww.com for re-issuance.</div>`
      : ""
  }

  <div class="header-bar">
    <div>
      <h1 style="margin: 0; font-size: 26px; color: #143C31; letter-spacing: -0.5px;">TEAFLOWW</h1>
      <p style="margin: 4px 0 0; font-size: 12px; color: #4A5568;">
        <strong>${TEAFLOWW_BRAND_CONSTANTS.entityName}</strong> | GSTIN: <strong>${TEAFLOWW_BRAND_CONSTANTS.gstin}</strong><br>
        Works: ${TEAFLOWW_BRAND_CONSTANTS.worksAddress}<br>
        Email: ${TEAFLOWW_BRAND_CONSTANTS.email} | Phone: ${TEAFLOWW_BRAND_CONSTANTS.phone}
      </p>
    </div>
    <div style="text-align: right;">
      <span class="badge-lock">14-Day Price Lock Guarantee</span>
      <div style="margin-top: 8px; font-size: 12px; color: #4A5568;">
        Ref: <strong>${quote.quote_number || quote.id}</strong> (Rev ${quote.revision || 1})<br>
        Status: <strong>${quote.status.toUpperCase()}</strong> (${isFirm ? "Firm Price" : "Automated Estimate"})<br>
        Issued: <strong>${issuedDate}</strong> | Valid: <strong>${validUntilDate}</strong>
      </div>
    </div>
  </div>

  <div style="display: flex; gap: 24px; margin-bottom: 24px;">
    <div style="flex: 1; border: 1px solid #E2E8F0; padding: 12px 16px; border-radius: 6px; background-color: #FAFAFA;">
      <div style="font-size: 11px; text-transform: uppercase; color: #718096; font-weight: bold; margin-bottom: 4px;">Prepared For:</div>
      <div style="font-size: 14px; font-weight: bold;">${client?.company_name || project?.title || "Valued Private Label Client"}</div>
      <div style="font-size: 12px; color: #4A5568;">Attn: ${client?.contact_name || "Commercial Buyer"} (${client?.contact_email || "Verified Account"})</div>
    </div>
    <div style="flex: 1; border: 1px solid #E2E8F0; padding: 12px 16px; border-radius: 6px; background-color: #FAFAFA;">
      <div style="font-size: 11px; text-transform: uppercase; color: #718096; font-weight: bold; margin-bottom: 4px;">Project Dossier:</div>
      <div style="font-size: 14px; font-weight: bold;">${project?.title || "Custom Private Label Tea"}</div>
      <div style="font-size: 12px; color: #4A5568;">Target Market: <strong>${project?.target_market || "IN"}</strong> | FSSAI Compliant</div>
    </div>
  </div>

  <table style="margin-bottom: 24px;">
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Configuration / Specification</th>
        <th style="text-align: right; width: 100px;">Quantity</th>
        <th style="text-align: right; width: 120px;">Unit Price</th>
        <th style="text-align: right; width: 130px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
    <div style="width: 320px;">
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>Tea Leaf Blend Subtotal:</span>
        <span>${formatPaiseToInr(quote.tea_subtotal_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>Packaging & Closures:</span>
        <span>${formatPaiseToInr(quote.packaging_subtotal_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>Surface Printing:</span>
        <span>${formatPaiseToInr(quote.printing_subtotal_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>Prepress Tooling & Cylinders:</span>
        <span>${formatPaiseToInr(quote.tooling_setup_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>Cleanroom Filling Labor:</span>
        <span>${formatPaiseToInr(quote.labor_subtotal_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>QC Cupping & Laboratory:</span>
        <span>${formatPaiseToInr(quote.qc_subtotal_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>Corrugated Cartons & Freight:</span>
        <span>${formatPaiseToInr(quote.freight_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-top: 1px solid #CBD5E0;">
        <span>Dual-Rate Indian GST (5% & 18%):</span>
        <span>${formatPaiseToInr(quote.tax_paise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; font-weight: bold; border-top: 2px solid #143C31; color: #143C31;">
        <span>Grand Total (INR):</span>
        <span>${formatPaiseToInr(quote.grand_total_paise)}</span>
      </div>
    </div>
  </div>

  <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 24px;">
    <h3 style="font-size: 13px; text-transform: uppercase; margin: 0 0 8px; color: #143C31;">Commercial Payment Terms (50 / 50 Milestone Schedule)</h3>
    <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #4A5568; line-height: 1.6;">
      <li><strong>50% Advance Deposit (${formatPaiseToInr(depositPaise)})</strong>: Due upon digital artwork proof sign-off to allocate inventory and initiate printing.</li>
      <li><strong>50% Final Balance (${formatPaiseToInr(balancePaise)})</strong>: Due upon quality clearance and sensory tasting sign-off prior to dispatch from Siliguri.</li>
      <li>Price locked for 14 calendar days from issue date. Delivery terms: Doorstep delivery within India. Siliguri / Jalpaiguri legal jurisdiction.</li>
    </ul>
  </div>
</body>
</html>
  `.trim();
}
