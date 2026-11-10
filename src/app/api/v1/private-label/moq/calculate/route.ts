import { NextResponse } from "next/server";
import { PrivateLabelService } from "@/lib/private-label/service";
import { liveMoqCalculateSchema } from "@/lib/private-label/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? (body as Record<string, unknown>).data
      : body;

  const parseResult = liveMoqCalculateSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  try {
    const result = PrivateLabelService.calculateLiveMoq(parseResult.data as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate MOQ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
