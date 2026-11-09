import { verifySignature } from "@/lib/international/providers";
import { createHmac } from "node:crypto";
import { processOneJob, scheduleMaintenance } from "@/lib/international/jobs";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const key = process.env.COMMERCE_WORKER_SECRET || "", auth = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!key || !verifySignature("worker", createHmac("sha256", auth).update("worker").digest("hex"), key)) return new Response(null, { status: 401 });
  try { scheduleMaintenance(); return Response.json({ worked: await processOneJob() }); }
  catch { return Response.json({ error: "Worker unavailable." }, { status: 503 }); }
}
