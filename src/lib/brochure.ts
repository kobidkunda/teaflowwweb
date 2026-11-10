import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { getUploadsDir } from "@/lib/uploads";

export interface BrochureSettings {
  url: string | null;
  title: string;
  description: string;
  button_label: string;
  enabled: boolean;
  file_size: number | null;
  formatted_size: string | null;
  updated_at: string | null;
  file_exists: boolean;
}

export interface UpdateBrochureInput {
  url?: string | null;
  title?: string;
  description?: string;
  button_label?: string;
  enabled?: boolean;
  file_size?: number | null;
  updated_at?: string;
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Resolves safe local absolute filesystem path for an uploaded brochure URL.
 * Guarantees that the path stays strictly within the application public/uploads directory.
 */
export function getBrochureLocalPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  const clean = fileUrl.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) return null;

  const uploadsDir = path.resolve(getUploadsDir());
  const publicDir = path.resolve(process.cwd(), "public");

  if (clean.startsWith("/uploads/")) {
    const filename = clean.replace(/^\/uploads\//, "");
    const resolved = path.resolve(uploadsDir, filename);
    if (resolved.startsWith(uploadsDir)) {
      return resolved;
    }
    return null;
  }

  if (clean.startsWith("/")) {
    const rel = clean.slice(1);
    const resolved = path.resolve(publicDir, rel);
    if (resolved.startsWith(publicDir)) {
      return resolved;
    }
    return null;
  }

  return null;
}

export function getBrochureSettings(): BrochureSettings {
  const db = getDb();
  let rows: Array<{ key: string; value: string; updated_at?: string }> = [];

  try {
    rows = db
      .prepare("SELECT key, value, updated_at FROM store_settings WHERE key LIKE 'brochure_%'")
      .all() as Array<{ key: string; value: string; updated_at?: string }>;
  } catch {
    rows = [];
  }

  const map = new Map(rows.map((r) => [r.key, r.value]));
  const updatedRow = rows.find((r) => r.key === "brochure_url" || r.key === "brochure_updated_at");

  const rawUrl = map.get("brochure_url")?.trim() || null;
  const title =
    map.get("brochure_title")?.trim() ||
    "TeaFloww Sourcing & Product Brochure Catalogue 2026";
  const description =
    map.get("brochure_description")?.trim() ||
    "Direct-from-origin single-estate orthodox teas, harvest profiles, wholesale packaging specifications, and procurement guide.";
  const buttonLabel = map.get("brochure_button_label")?.trim() || "Download Brochure";
  const enabled = map.get("brochure_enabled") !== "0";

  let fileSize: number | null = null;
  const rawSize = map.get("brochure_file_size");
  if (rawSize && !isNaN(Number(rawSize))) {
    fileSize = Number(rawSize);
  }

  let fileExists = false;
  if (rawUrl) {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      fileExists = true;
    } else {
      const localPath = getBrochureLocalPath(rawUrl);
      if (localPath && fs.existsSync(localPath)) {
        fileExists = true;
        try {
          const stat = fs.statSync(localPath);
          fileSize = stat.size;
        } catch {
          // ignore stat error
        }
      }
    }
  }

  const updatedAt = map.get("brochure_updated_at") || updatedRow?.updated_at || null;

  return {
    url: rawUrl,
    title,
    description,
    button_label: buttonLabel,
    enabled,
    file_size: fileSize,
    formatted_size: formatBytes(fileSize),
    updated_at: updatedAt,
    file_exists: fileExists,
  };
}

export function updateBrochureSettings(input: UpdateBrochureInput): BrochureSettings {
  const db = getDb();
  const current = getBrochureSettings();

  const newUrl = input.url !== undefined ? (input.url ? input.url.trim() : null) : current.url;
  const newTitle = input.title !== undefined ? input.title.trim() : current.title;
  const newDesc = input.description !== undefined ? input.description.trim() : current.description;
  const newButtonLabel = input.button_label !== undefined ? input.button_label.trim() : current.button_label;
  const newEnabled = input.enabled !== undefined ? Boolean(input.enabled) : current.enabled;
  const newTimestamp = input.updated_at || new Date().toISOString();

  let finalSize = input.file_size !== undefined ? input.file_size : current.file_size;
  if (newUrl && (!finalSize || input.url !== undefined)) {
    const local = getBrochureLocalPath(newUrl);
    if (local && fs.existsSync(local)) {
      try {
        finalSize = fs.statSync(local).size;
      } catch {
        // ignore
      }
    }
  }

  const upsertStmt = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const runUpserts = () => {
    upsertStmt.run("brochure_url", newUrl || "");
    upsertStmt.run("brochure_title", newTitle);
    upsertStmt.run("brochure_description", newDesc);
    upsertStmt.run("brochure_button_label", newButtonLabel);
    upsertStmt.run("brochure_enabled", newEnabled ? "1" : "0");
    upsertStmt.run("brochure_file_size", finalSize !== null && finalSize !== undefined ? String(finalSize) : "");
    upsertStmt.run("brochure_updated_at", newTimestamp);
  };

  if (typeof db.transaction === "function") {
    db.transaction(runUpserts)();
  } else {
    runUpserts();
  }

  return getBrochureSettings();
}
