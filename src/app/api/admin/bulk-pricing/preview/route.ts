import { NextResponse } from "next/server";
import { guard, invalid } from "@/lib/adminHttp";
import { MAX_CSV_BYTES, previewBulkPricing } from "@/lib/bulkPricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies an uploaded pricing CSV without changing anything.
 * Accepts JSON { csv: string } or multipart form-data with a `file` field.
 * Always returns the structured preview (errors included) so the form can
 * render row-level messages; 400 only for an unreadable/oversized payload.
 */
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let csvText: string | null = null;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file instanceof File) {
        if (file.size > MAX_CSV_BYTES) {
          return invalid({ file: [`File is too large (${Math.round(file.size / 1024)} KB). Limit is ${Math.round(MAX_CSV_BYTES / 1024)} KB.`] });
        }
        csvText = await file.text();
      } else if (typeof file === "string") {
        csvText = file;
      }
    } else {
      const body: unknown = await request.json().catch(() => null);
      if (body && typeof body === "object" && "csv" in body) {
        const raw = (body as { csv?: unknown }).csv;
        if (typeof raw === "string") csvText = raw;
      }
    }
  } catch {
    return invalid({ file: ["Could not read the uploaded file. Try again."] });
  }

  if (csvText == null) {
    return invalid({ file: ["No CSV received. Attach a .csv file or paste CSV text."] });
  }
  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
    return invalid({ file: ["File is too large. Limit is 1024 KB."] });
  }

  const preview = previewBulkPricing(csvText);
  return NextResponse.json({ preview });
}
