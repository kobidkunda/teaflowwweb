import { buildOpenAiFeedResponse } from "@/lib/feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  return buildOpenAiFeedResponse(request);
}
