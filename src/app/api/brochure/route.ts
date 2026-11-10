import { NextResponse } from "next/server";
import { getBrochureSettings } from "@/lib/brochure";

export const runtime = "nodejs";

export async function GET() {
  try {
    const s = getBrochureSettings();
    return NextResponse.json(
      {
        enabled: s.enabled && Boolean(s.url) && s.file_exists,
        title: s.title,
        description: s.description,
        button_label: s.button_label,
        download_url: "/api/brochure/download",
        file_url: s.url,
        file_size: s.file_size,
        formatted_size: s.formatted_size,
        updated_at: s.updated_at,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve brochure catalogue information." },
      { status: 500 }
    );
  }
}
