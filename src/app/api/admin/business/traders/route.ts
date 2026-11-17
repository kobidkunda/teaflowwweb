import { NextResponse } from "next/server";
import { guard, invalid } from "@/lib/adminHttp";
import { getTraderPresentation, getTraderCatalogue, saveTraderPresentation } from "@/lib/business/traderRepository";
import { traderPresentationSchema } from "@/lib/business/traderPresentation";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request); if (denied) return denied;
  return NextResponse.json({ content: getTraderPresentation(), products: getTraderCatalogue().map(p => ({id:p.id,name:p.name,imageUrl:p.primary_image_url || p.primary_image?.url || null})) });
}
export async function PUT(request: Request) {
  const denied = guard(request); if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin) {
    let source: URL;
    try { source = new URL(origin); } catch { return NextResponse.json({error:"Request origin is not allowed."},{status:403}); }
    const host = request.headers.get("host") || new URL(request.url).host;
    if (!["http:", "https:"].includes(source.protocol) || source.host !== host) return NextResponse.json({error:"Request origin is not allowed."},{status:403});
  } else if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({error:"Request origin is not allowed."},{status:403});
  }
  if (Number(request.headers.get("content-length") || 0) > 100000) return NextResponse.json({error:"Request too large."},{status:413});
  const raw = await request.text();
  if (raw.length > 100000) return NextResponse.json({error:"Request too large."},{status:413});
  let body: unknown; try { body = JSON.parse(raw); } catch { return invalid("Invalid JSON."); }
  const parsed = traderPresentationSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message || "Invalid content.");
  try { return NextResponse.json({content:saveTraderPresentation(parsed.data)}); }
  catch { return invalid("Unable to save. Check that selected products are published and enabled."); }
}
