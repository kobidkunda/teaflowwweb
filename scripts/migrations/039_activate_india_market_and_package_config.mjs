/** Additive and dialect-neutral. Activates India market and ensures valid package config. */
export function up(db) {
  // 1. Ensure package config in commerce_config is valid with origin and maxGrams
  try {
    const pkgRow = db.prepare("SELECT document FROM commerce_config WHERE key = 'package'").get();
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
    if (pkgRow && pkgRow.document) {
      try {
        const existing = JSON.parse(pkgRow.document);
        pkg = {
          ...pkg,
          ...existing,
          maxGrams: existing.maxGrams || 50000,
          origin: "IN",
        };
      } catch {}
    }
    db.prepare(`
      INSERT INTO commerce_config (key, document)
      VALUES ('package', ?)
      ON CONFLICT(key) DO UPDATE SET document = excluded.document
    `).run(JSON.stringify(pkg));
  } catch {}

  // 2. Activate and approve India (IN) market
  try {
    const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get();
    if (inRow && inRow.document) {
      const doc = JSON.parse(inRow.document);
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
      db.prepare(
        "UPDATE commerce_markets SET document = ?, version = version + 1 WHERE code = 'IN'"
      ).run(JSON.stringify(doc));
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
      db.prepare("INSERT INTO commerce_markets (code, document, version) VALUES ('IN', ?, 1)").run(
        JSON.stringify(defaultIndia)
      );
    }
  } catch {}
}

export function down() {}
