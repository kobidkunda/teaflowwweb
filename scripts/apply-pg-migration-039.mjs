/**
 * Postgres companion script for Migration 039
 * India Market Activation & Package Configuration Parity
 */
export async function upPg(sql) {
  // 1. Ensure package config in commerce_config is valid
  const pkgRows = await sql`SELECT document FROM commerce_config WHERE key = 'package'`;
  let pkg = {
    pickupPostcode: "734015",
    pickupLocation: "Siliguri Main Hub",
    length: 12,
    breadth: 12,
    height: 12,
    tareGrams: 120,
    maxGrams: 50000,
    hsn: "090230",
    origin: "IN",
  };
  if (pkgRows && pkgRows.length > 0 && pkgRows[0].document) {
    try {
      const existing = typeof pkgRows[0].document === "string" ? JSON.parse(pkgRows[0].document) : pkgRows[0].document;
      pkg = {
        ...pkg,
        ...existing,
        maxGrams: existing.maxGrams || 50000,
        origin: "IN",
      };
    } catch {}
  }
  await sql`
    INSERT INTO commerce_config (key, document)
    VALUES ('package', ${JSON.stringify(pkg)})
    ON CONFLICT (key) DO UPDATE SET document = EXCLUDED.document
  `;

  // 2. Activate and approve India (IN) market
  const inRows = await sql`SELECT document FROM commerce_markets WHERE code = 'IN'`;
  if (inRows && inRows.length > 0 && inRows[0].document) {
    const doc = typeof inRows[0].document === "string" ? JSON.parse(inRows[0].document) : inRows[0].document;
    doc.covered = true;
    doc.enabled = true;
    doc.taxApproved = true;
    doc.exportApproved = true;
    doc.taxPercent = doc.taxPercent || 5;
    doc.taxInclusive = true;
    doc.shipping = doc.shipping || "flat";
    doc.flatPaise = doc.flatPaise || 9900;
    doc.freeAbovePaise = doc.freeAbovePaise || 59900;
    if (!doc.cod) {
      doc.cod = {
        enabled: true,
        postcodes: [],
        minPaise: 0,
        maxPaise: 500000,
        feePaise: 5000,
        blockedSkus: [],
      };
    } else {
      doc.cod.enabled = true;
      doc.cod.minPaise = doc.cod.minPaise || 0;
      doc.cod.maxPaise = doc.cod.maxPaise || 500000;
      doc.cod.feePaise = doc.cod.feePaise ?? 5000;
    }
    await sql`
      UPDATE commerce_markets
      SET document = ${JSON.stringify(doc)}, version = version + 1
      WHERE code = 'IN'
    `;
  } else {
    const defaultIndia = {
      code: "IN",
      name: "India",
      covered: true,
      enabled: true,
      currency: "INR",
      language: "en",
      approvedCurrencies: ["INR"],
      taxApproved: true,
      taxPercent: 5,
      taxInclusive: true,
      exportApproved: true,
      duties: "recipient",
      shipping: "flat",
      flatPaise: 9900,
      freeAbovePaise: 59900,
      handlingPaise: 0,
      subsidyPaise: 0,
      fxMarkupBps: 0,
      roundingMinor: 1,
      blockedPostcodes: [],
      blockedStates: [],
      blockedSkus: [],
      cod: {
        enabled: true,
        postcodes: [],
        minPaise: 0,
        maxPaise: 500000,
        feePaise: 5000,
        blockedSkus: [],
      },
    };
    await sql`
      INSERT INTO commerce_markets (code, document, version)
      VALUES ('IN', ${JSON.stringify(defaultIndia)}, 1)
      ON CONFLICT (code) DO NOTHING
    `;
  }
}
