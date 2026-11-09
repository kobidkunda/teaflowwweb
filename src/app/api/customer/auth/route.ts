import { NextResponse } from "next/server";
import {
  registerCustomer,
  authenticateCustomer,
  quickDemoCustomerLogin,
  CustomerAuthError,
} from "@/lib/customerAuth";
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_TTL_MS } from "@/lib/customerSessions";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "login";

    let authResult;
    if (action === "register") {
      authResult = registerCustomer({
        email: body.email,
        password: body.password,
        name: body.name,
        phone: body.phone,
      });
    } else if (action === "demo") {
      authResult = quickDemoCustomerLogin();
    } else {
      authResult = authenticateCustomer({
        identifier: body.identifier || body.email,
        password: body.password,
      });
    }

    const response = NextResponse.json({
      success: true,
      customer: authResult.customer,
    });

    const isHttps =
      request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https:");
    const host = request.headers.get("host") || "";
    const isLocal =
      host.includes("localhost") || host.includes("127.0.0.1") || host.startsWith("192.168.");
    const secureCookie = isHttps || (process.env.NODE_ENV === "production" && !isLocal);

    response.cookies.set(CUSTOMER_SESSION_COOKIE, authResult.cookieValue, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(CUSTOMER_SESSION_TTL_MS / 1000),
    });

    return response;
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.code });
    }
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
