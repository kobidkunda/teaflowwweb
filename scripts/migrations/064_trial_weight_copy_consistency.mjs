// 064: Align trial kit 4-x-25-gm copy with the Trials v3 4x50g = 200g DB invariant
// so pouch weights (50g x 4 = 200g) and title/description never conflict on /tea-shops.

export function up(db) {
  try {
    const row = db
      .prepare(
        "SELECT id, title, tagline, description, net_weight_g FROM trials WHERE slug = '4-x-25-gm' OR sku = 'KIT-4-X-25-GM' LIMIT 1"
      )
      .get();
    if (!row?.id || Number(row.net_weight_g) !== 200) return;

    const cleanTitle = String(row.title || "")
      .replace(/4\s*[×x]\s*25\s*g\s*\(100\s*g\)/gi, "4 × 50 g (200 g)")
      .replace(/4\s*[×x]\s*25\s*g/gi, "4 × 50 g");
    const cleanTagline = row.tagline
      ? String(row.tagline)
          .replace(/25\s*g\s*each/gi, "50 g each")
          .replace(/100\s*g\s*trial\s*pack/gi, "200 g trial pack")
      : null;
    const cleanDesc = row.description
      ? String(row.description)
          .replace(/25\s*g\s*pouch/gi, "50 g pouch")
          .replace(/100\s*g\s*total/gi, "200 g total")
          .replace(/—\s*25\s*g/gi, "— 50 g")
      : null;

    db.prepare(
      `UPDATE trials
       SET title = ?, tagline = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(cleanTitle, cleanTagline, cleanDesc, row.id);
  } catch {
    // Non-fatal in minimal test schemas
  }
}

export function down() {
  // Additive-only policy
}
