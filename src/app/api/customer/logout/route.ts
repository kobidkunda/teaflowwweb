import { NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  parseCustomerSessionCookie,
  revokeCustomerSession,
} from "@/lib/customerSessions";

export async function POST(request: Request) {
  const cookieValue = parseCustomerSessionCookie(request);
  if (cookieValue) {
    revokeCustomerSession(cookieValue);
  }

  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https:");
  const host = request.headers.get("host") || "";
  const isLocal =
    host.includes("localhost") || host.includes("127.0.0.1") || host.startsWith("192.168.");
  const secureCookie = isHttps || (process.env.NODE_ENV === "production" && !isLocal);

  const response = NextResponse.json({ success: true, message: "Logged out successfully." });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
