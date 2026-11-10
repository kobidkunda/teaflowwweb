import { NextResponse } from "next/server";
import fs from "node:fs";
import { getBrochureSettings, getBrochureLocalPath } from "@/lib/brochure";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const s = getBrochureSettings();

    if (!s.enabled || !s.url) {
      return NextResponse.json(
        { error: "Brochure catalogue is currently not published or unavailable." },
        { status: 404 }
      );
    }

    // Remote file (S3 / CDN)
    if (s.url.startsWith("http://") || s.url.startsWith("https://")) {
      return NextResponse.redirect(s.url, 302);
    }

    const localPath = getBrochureLocalPath(s.url);
    if (!localPath || !fs.existsSync(localPath)) {
      return NextResponse.json(
        { error: "Brochure file could not be located on the server." },
        { status: 404 }
      );
    }

    const buffer = await fs.promises.readFile(localPath);
    const url = new URL(request.url);
    const inline = url.searchParams.get("view") === "1" || url.searchParams.get("inline") === "1";

    const baseName = (s.title || "TeaFloww-Brochure-Catalog")
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);

    const filename = `${baseName || "TeaFloww-Brochure-Catalog"}.pdf`;
    const disposition = inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred while preparing your brochure download." },
      { status: 500 }
    );
  }
}
