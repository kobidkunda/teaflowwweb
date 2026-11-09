import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { applySecurityHeaders } from "@/lib/security";

export const dynamic = "force-static";

export function GET() {
  const filePath = path.join(process.cwd(), "public", "llms-full.txt");
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    content = "# TeaFloww — Full Documentation\n\n> Direct-from-origin single-estate orthodox teas.\n";
  }

  const response = new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });

  return applySecurityHeaders(response);
}
