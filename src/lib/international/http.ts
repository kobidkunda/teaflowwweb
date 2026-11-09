import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/adminHttp";
import { rateLimitResponse } from "@/lib/rateLimit";
import { publishedTexts, UI_SOURCE } from "./translations";
import { CommerceError } from "./models";
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;
  try { return new URL(origin).host === (request.headers.get("host") || new URL(request.url).host); } catch { return false; }
}
export function gate(request: Request, admin = false) {
  if (admin) { const denied = guard(request); if (denied) return denied; }
  else { const denied = rateLimitResponse(request, "international", 30); if (denied) return denied; }
  if (request.method !== "GET" && !sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  return null;
}
export async function readBoundedText(request: Request, max = 128000) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > max) { await reader.cancel(); throw new CommerceError("Request is too large."); }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function body(request: Request) {
  const text = await readBoundedText(request);
  try { return JSON.parse(text); } catch { throw new CommerceError("Invalid request body."); }
}
export function owner(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith("tf_commerce="))?.slice("tf_commerce=".length);
  return z.string().uuid().safeParse(cookie).success ? cookie! : randomUUID();
}
export function json(value: unknown, session?: string) {
  const response = NextResponse.json(value, { headers: { "Cache-Control": "private, no-store" } });
  if (session) response.cookies.set("tf_commerce", session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return response;
}
export function failure(e: unknown, request?: Request) {
  let message =
    e instanceof CommerceError
      ? e.message
      : e instanceof z.ZodError
      ? (e.issues[0]?.message && !/invalid uuid/i.test(e.issues[0].message) ? e.issues[0].message : "Please check the submitted fields.")
      : "Unable to complete the request. Please try again.";
  if (request) {
    try {
      const raw = request.headers.get("cookie")?.split(";").find(c => c.trim().startsWith("tf_preferences="))?.split("=").slice(1).join("=") || "{}";
      const prefs = JSON.parse(decodeURIComponent(raw));
      const key = Object.keys(UI_SOURCE).find(k => UI_SOURCE[k] === message);
      const translated = key && publishedTexts("interface", prefs?.locale || "en")?.[key];
      if (translated) message = translated;
    } catch {}
  }
  return NextResponse.json(
    {
      error: message,
      detail: e instanceof z.ZodError ? e.issues.map(i => ({ path: i.path.join("."), message: i.message })) : undefined,
    },
    {
      status: e instanceof CommerceError ? 409 : e instanceof z.ZodError ? 400 : 503,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
