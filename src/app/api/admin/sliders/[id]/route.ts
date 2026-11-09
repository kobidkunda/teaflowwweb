import { NextResponse } from "next/server";
import { getSlider, updateSlider, deleteSlider } from "@/lib/sliders";
import { sliderUpdateSchema } from "@/lib/validation";
import { guard, invalid, notFound } from "@/lib/adminHttp";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const slider = getSlider(Number(id));
  return slider ? NextResponse.json({ slider }) : notFound("Slider not found.");
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = sliderUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  const slider = updateSlider(Number(id), parsed.data);
  return slider ? NextResponse.json({ slider }) : notFound("Slider not found.");
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  return deleteSlider(Number(id)) ? new NextResponse(null, { status: 204 }) : notFound("Slider not found.");
}
