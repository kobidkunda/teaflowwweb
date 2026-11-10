/**
 * Migration 047: TeaFloww Private Label Artwork Assets, Design Versions, Preflight & Proof Approvals
 *
 * Implements Milestone M1 2D design studio, asset preflight, and legal approval schema:
 * 1. pl_artwork_assets - Source customer uploads, MIME verification, DPI, storage keys
 * 2. pl_design_versions - Versioned 2D mockup scene state, front/back assets, locked status
 * 3. pl_preflight_reports - Detailed preflight inspection reports (DPI, scripts, vector checks)
 * 4. pl_approval_events - Immutable customer & prepress legal sign-off audit trail
 */

export function up(db) {
  db.exec(`
    -- 1. Artwork Assets Table (Preflight verified files)
    CREATE TABLE IF NOT EXISTS pl_artwork_assets (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE CASCADE,
      original_filename TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL CHECK(file_size_bytes > 0),
      mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf')),
      storage_key TEXT NOT NULL UNIQUE,
      file_sha256 TEXT NOT NULL,
      width_px INTEGER CHECK(width_px IS NULL OR width_px > 0),
      height_px INTEGER CHECK(height_px IS NULL OR height_px > 0),
      dpi REAL CHECK(dpi IS NULL OR dpi > 0),
      color_space TEXT CHECK(color_space IN ('RGB', 'CMYK', 'GRAYSCALE')),
      rights_attestation INTEGER NOT NULL DEFAULT 0 CHECK(rights_attestation IN (0, 1)),
      preflight_status TEXT NOT NULL DEFAULT 'pending' CHECK(preflight_status IN ('pending', 'passed', 'warning', 'rejected')),
      preflight_report_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_art_storage ON pl_artwork_assets(storage_key);
    CREATE INDEX IF NOT EXISTS idx_pl_art_client ON pl_artwork_assets(client_id, preflight_status);
    CREATE INDEX IF NOT EXISTS idx_pl_art_hash ON pl_artwork_assets(file_sha256);

    -- 2. Design Versions Table (Immutable 2D scene definitions)
    CREATE TABLE IF NOT EXISTS pl_design_versions (
      id TEXT PRIMARY KEY,
      project_item_id TEXT NOT NULL REFERENCES pl_project_items(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL DEFAULT 1 CHECK(version_number >= 1),
      scene_json TEXT NOT NULL DEFAULT '{}',
      front_artwork_asset_id TEXT REFERENCES pl_artwork_assets(id) ON DELETE SET NULL,
      back_artwork_asset_id TEXT REFERENCES pl_artwork_assets(id) ON DELETE SET NULL,
      preview_render_url TEXT,
      print_ready_pdf_url TEXT,
      is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_item_id, version_number)
    );
    CREATE INDEX IF NOT EXISTS idx_pl_des_item ON pl_design_versions(project_item_id, version_number);
    CREATE INDEX IF NOT EXISTS idx_pl_des_front_art ON pl_design_versions(front_artwork_asset_id);
    CREATE INDEX IF NOT EXISTS idx_pl_des_back_art ON pl_design_versions(back_artwork_asset_id);

    -- 3. Preflight Reports Table
    CREATE TABLE IF NOT EXISTS pl_preflight_reports (
      id TEXT PRIMARY KEY,
      artwork_asset_id TEXT NOT NULL REFERENCES pl_artwork_assets(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('passed', 'warning', 'rejected')),
      dpi REAL CHECK(dpi IS NULL OR dpi > 0),
      width_px INTEGER CHECK(width_px IS NULL OR width_px > 0),
      height_px INTEGER CHECK(height_px IS NULL OR height_px > 0),
      color_space TEXT CHECK(color_space IN ('RGB', 'CMYK', 'GRAYSCALE')),
      has_transparency INTEGER NOT NULL DEFAULT 0 CHECK(has_transparency IN (0, 1)),
      is_vector INTEGER NOT NULL DEFAULT 0 CHECK(is_vector IN (0, 1)),
      prohibited_scripts_detected INTEGER NOT NULL DEFAULT 0 CHECK(prohibited_scripts_detected IN (0, 1)),
      warnings_json TEXT NOT NULL DEFAULT '[]',
      errors_json TEXT NOT NULL DEFAULT '[]',
      report_summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_preflight_art ON pl_preflight_reports(artwork_asset_id);
    CREATE INDEX IF NOT EXISTS idx_pl_preflight_status ON pl_preflight_reports(status);

    -- 4. Approval Events Table (Legal sign-off audit)
    CREATE TABLE IF NOT EXISTS pl_approval_events (
      id TEXT PRIMARY KEY,
      design_version_id TEXT NOT NULL REFERENCES pl_design_versions(id) ON DELETE RESTRICT,
      client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE RESTRICT,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('customer', 'admin', 'mcp')),
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('submitted_for_review', 'customer_approved', 'customer_rejected', 'prepress_passed', 'prepress_rejected')),
      legal_disclaimer_accepted INTEGER NOT NULL DEFAULT 0 CHECK(legal_disclaimer_accepted IN (0, 1)),
      ip_address TEXT,
      user_agent TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_appr_version ON pl_approval_events(design_version_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pl_appr_client ON pl_approval_events(client_id);
  `);
}

export function down(db) {
  if (!db) return;
  db.exec(`
    DROP TABLE IF EXISTS pl_approval_events;
    DROP TABLE IF EXISTS pl_preflight_reports;
    DROP TABLE IF EXISTS pl_design_versions;
    DROP TABLE IF EXISTS pl_artwork_assets;
  `);
}
