import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { forgotSchema } from "@/lib/validation";
import { invalid } from "@/lib/adminHttp";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { getUserByEmail } from "@/lib/adminUsers";
import { resetLinkFor, sendTemplatedMail, sendMail } from "@/lib/email";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const RESET_TTL_MS = 60 * 60 * 1000;

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// POST /api/admin/forgot { email } → always 200 { ok:true }. Creates a
// single-use reset token for a matching active account and emails the link;
// without SMTP configured the token stays in the DB and the event is logged
// (operator drill in OPERATIONS). Never reveals whether the email exists.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "login", RATE_LIMITS.login);
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const user = getUserByEmail(email);
    if (user && user.is_active === 1) {
      const raw = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
      getDb()
        .prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?,?,?)")
        .run(sha256hex(raw), user.id, expiresAt);
      const link = resetLinkFor(raw, request);
      // All sends go through the admin-editable email template when present,
      // falling back to the legacy inline copy when the table is unmigrated.
      let emailed = false;
      try {
        const result = await sendTemplatedMail({ to: email, templateKey: "admin_password_reset", vars: { reset_link: link } });
        emailed = result.sent;
      } catch {
        const sent = await sendMail({
          to: email,
          subject: "Admin password reset",
          text: "A password reset was requested for the store admin console. It expires in 60 minutes:\n\n" + link + "\n\nIf you did not request this, ignore this message.",
        });
        emailed = sent.sent;
      }
      logger.info("password reset requested", { route: "/api/admin/forgot", emailed });
    } else {
      logger.info("password reset requested", { route: "/api/admin/forgot" });
    }
  } catch {
    logger.warn("password reset request failed", { route: "/api/admin/forgot" });
  }
  return NextResponse.json({ ok: true });
}
