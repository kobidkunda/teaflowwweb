import net from "node:net";
import tls from "node:tls";
import { logger } from "@/lib/logger";

// Minimal stdlib SMTP sender (no new deps). Plain TCP + AUTH LOGIN, with
// TLS-on-connect on 465 (or SMTP_SECURE=1). STARTTLS is not implemented:
// port 587 is expected to accept plain AUTH (or relay without auth). Never
// the forgot flow stays generic. Missing SMTP_HOST = graceful no-email
// fallback: log info and let the operator use the documented DB drill.
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/** Redacted SMTP status shared by the admin UI and MCP (never leaks secrets). */
export function getSmtpStatus(): {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  from: string;
  hasAuth: boolean;
} {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = parseInt(process.env.SMTP_PORT || "587", 10) || 587;
  const secure = port === 465 || (process.env.SMTP_SECURE || "") === "1";
  const from = (process.env.RESET_FROM_EMAIL || "").trim() || "no-reply@localhost";
  return {
    configured: Boolean(host),
    host: host || null,
    port,
    secure,
    from,
    hasAuth: Boolean(process.env.SMTP_USER),
  };
}

type SmtpResult = { sent: boolean };

function readReply(socket: net.Socket | tls.TLSSocket, timeoutMs: number): Promise<{ code: number; lines: string[] }> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("smtp timeout")), timeoutMs);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\r\n");
      if (lines.length < 2) return;
      const last = lines[lines.length - 2];
      const match = /^(\d{3})([ -])/.exec(last);
      if (match && match[2] === " ") {
        clearTimeout(timer);
        socket.off("data", onData);
        resolve({ code: parseInt(match[1], 10), lines });
      }
    };
    socket.on("data", onData);
    socket.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function converse(
  socket: net.Socket | tls.TLSSocket,
  timeoutMs: number,
  commands: Array<{ send?: string; expect: number[]; secret?: boolean }>
): Promise<void> {
  for (const cmd of commands) {
    if (cmd.send !== undefined) {
      await new Promise<void>((resolve, reject) => {
        socket.write(cmd.send + "\r\n", (e) => (e ? reject(e) : resolve()));
      });
    }
    const reply = await readReply(socket, timeoutMs);
    if (!cmd.expect.includes(reply.code)) throw new Error("smtp reply " + reply.code);
  }
}

export async function sendMailHtml(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SmtpResult> {
  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) {
    logger.info("email skipped (SMTP not configured)", { route: "email" });
    return { sent: false };
  }
  const port = parseInt(process.env.SMTP_PORT || "587", 10) || 587;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = (process.env.RESET_FROM_EMAIL || "").trim() || "no-reply@localhost";
  const timeoutMs = 8000;
  let socket: net.Socket | tls.TLSSocket | null = null;
  try {
    const directTls = port === 465 || (process.env.SMTP_SECURE || "") === "1";
    socket = directTls
      ? tls.connect({ host, port, servername: host, timeout: timeoutMs })
      : net.createConnection({ host, port, timeout: timeoutMs });
    await new Promise<void>((resolve, reject) => {
      socket!.once("error", reject);
      socket!.once(directTls ? "secureConnect" : "connect", resolve);
    });
    await converse(socket, timeoutMs, [{ expect: [220] }]);
    const hello = "localhost";
    await converse(socket, timeoutMs, [{ send: "EHLO " + hello, expect: [250] }]);
    if (user) {
      await converse(socket, timeoutMs, [
        { send: "AUTH LOGIN", expect: [334] },
        { send: Buffer.from(user).toString("base64"), expect: [334], secret: true },
        { send: Buffer.from(pass).toString("base64"), expect: [235], secret: true },
      ]);
    }
    const boundary = "teafloww-" + Date.now().toString(36);
    await converse(socket, timeoutMs, [
      { send: "MAIL FROM:<" + from + ">", expect: [250] },
      { send: "RCPT TO:<" + input.to + ">", expect: [250, 251] },
      { send: "DATA", expect: [354] },
    ]);
    const headers = ["From: " + from, "To: " + input.to, "Subject: " + input.subject, "MIME-Version: 1.0"];
    let body: string;
    if (input.html) {
      headers.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
      body = [
        ...headers,
        "",
        "--" + boundary,
        'Content-Type: text/plain; charset="utf-8"',
        "",
        input.text,
        "--" + boundary,
        'Content-Type: text/html; charset="utf-8"',
        "",
        input.html,
        "--" + boundary + "--",
        ".",
      ].join("\r\n");
    } else {
      headers.push('Content-Type: text/plain; charset="utf-8"');
      body = [...headers, "", input.text, "."].join("\r\n");
    }
    await converse(socket, timeoutMs, [{ send: body, expect: [250] }]);
    await converse(socket, timeoutMs, [{ send: "QUIT", expect: [221, 250] }]);
    try {
      socket.end();
    } catch {
      /* ignore */
    }
    logger.info("email sent", { route: "email" });
    return { sent: true };
  } catch {
    logger.warn("email failed; content kept for retry", { route: "email" });
    try {
      socket?.destroy();
    } catch {
      /* ignore */
    }
    return { sent: false };
  }
}

/** Render a stored template and send it via the configured SMTP relay. */
export async function sendTemplatedMail(input: {
  to: string;
  templateKey: string;
  locale?: string;
  vars?: Record<string, string | number | null | undefined>;
}): Promise<SmtpResult & { subject: string }> {
  const { getEmailTemplate, renderEmailTemplate } = await import("@/lib/emailTemplates");
  let template = getEmailTemplate(input.templateKey);
  if (!template) throw new Error("Email template not found.");
  if (input.locale && input.locale !== "en") {
    const { publishedTexts } = await import("@/lib/international/translations");
    const text = publishedTexts(`email:${template.key}`, input.locale);
    if (text?.text_body && text.subject) {
      const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
      template = { ...template, subject: text.subject, text_body: text.text_body, html_body: `<div lang="${/^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.locale) ? input.locale : "en"}" dir="${input.locale === "ar" ? "rtl" : "ltr"}"><h1>TeaFloww</h1><p>${escape(text.text_body).replaceAll("\n", "<br>")}</p></div>` };
    }
  }
  const rendered = renderEmailTemplate(template, input.vars ?? {});
  const sent = await sendMailHtml({ to: input.to, subject: rendered.subject, text: rendered.text, html: rendered.html });
  return { sent: sent.sent, subject: rendered.subject };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAlertValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export async function sendAdminAlertEmail(input: {
  to: string;
  eventLabel: string;
  event: string;
  summary: string;
  referenceId?: string;
  source: string;
  occurredAt: string;
  data: Record<string, unknown>;
}): Promise<SmtpResult> {
  const refBadge = input.referenceId ? ` [${input.referenceId}]` : "";
  const subject = `[TeaFloww] ${input.eventLabel}${refBadge}: ${input.summary}`.slice(0, 180);

  const entries = Object.entries(input.data);
  const textLines = [
    `TeaFloww Admin Notification`,
    `Event: ${input.eventLabel} (${input.event})`,
    `Summary: ${input.summary}`,
    input.referenceId ? `Reference: ${input.referenceId}` : null,
    `Source: ${input.source}`,
    `Time: ${input.occurredAt}`,
    "",
    "Submitted Details:",
    ...entries.map(([k, v]) => `- ${k}: ${formatAlertValue(v)}`),
  ].filter((line): line is string => line !== null);

  const { buildBrandEmailHtml } = await import("@/lib/emailLayout");
  const { defaultEmailContext } = await import("@/lib/emailTemplates");
  const ctx = defaultEmailContext();

  const rows = entries.map(([k, v]) => [
    escapeHtml(k),
    escapeHtml(formatAlertValue(v)),
  ]);

  const html = buildBrandEmailHtml({
    categoryBadge: `ADMIN ALERT · ${input.event.toUpperCase()}`,
    heading: input.eventLabel,
    leadParagraph: escapeHtml(input.summary),
    detailsBox: {
      title: "Event Metadata",
      items: [
        ...(input.referenceId ? [{ label: "Reference", value: escapeHtml(input.referenceId) }] : []),
        { label: "Event Source", value: escapeHtml(input.source) },
        { label: "Timestamp", value: escapeHtml(input.occurredAt) },
      ],
    },
    table: {
      caption: "Submitted Event Details",
      columns: ["Field", "Value"],
      rows,
    },
    secondaryNoteHtml: "This is an internal system notification dispatched to configured administrative recipients.",
  })
    .replaceAll("{{logo_url}}", ctx.logo_url)
    .replaceAll("{{store_name}}", ctx.store_name)
    .replaceAll("{{support_email}}", ctx.support_email)
    .replaceAll(/\{\{#logo\}\}([\s\S]*?)\{\{\/logo\}\}/g, "$1");

  return sendMailHtml({
    to: input.to,
    subject,
    text: textLines.join("\n"),
    html,
  });
}

export async function sendMail(input: { to: string; subject: string; text: string }): Promise<SmtpResult> {
  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) {
    logger.info("password reset email skipped (SMTP not configured)", { route: "/api/admin/forgot" });
    return { sent: false };
  }
  const port = parseInt(process.env.SMTP_PORT || "587", 10) || 587;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = (process.env.RESET_FROM_EMAIL || "").trim() || "no-reply@localhost";
  const timeoutMs = 8000;
  let socket: net.Socket | tls.TLSSocket | null = null;
  try {
    const directTls = port === 465 || (process.env.SMTP_SECURE || "") === "1";
    socket = directTls
      ? tls.connect({ host, port, servername: host, timeout: timeoutMs })
      : net.createConnection({ host, port, timeout: timeoutMs });
    await new Promise<void>((resolve, reject) => {
      socket!.once("error", reject);
      socket!.once(directTls ? "secureConnect" : "connect", resolve);
    });
    await converse(socket, timeoutMs, [{ expect: [220] }]);
    const hello = "localhost";
    await converse(socket, timeoutMs, [{ send: "EHLO " + hello, expect: [250] }]);
    if (user) {
      await converse(socket, timeoutMs, [
        { send: "AUTH LOGIN", expect: [334] },
        { send: Buffer.from(user).toString("base64"), expect: [334], secret: true },
        { send: Buffer.from(pass).toString("base64"), expect: [235], secret: true },
      ]);
    }
    await converse(socket, timeoutMs, [
      { send: "MAIL FROM:<" + from + ">", expect: [250] },
      { send: "RCPT TO:<" + input.to + ">", expect: [250, 251] },
      { send: "DATA", expect: [354] },
    ]);
    const body = ["From: " + from, "To: " + input.to, "Subject: " + input.subject, "", input.text, "."].join("\r\n");
    await converse(socket, timeoutMs, [{ send: body, expect: [250] }]);
    await converse(socket, timeoutMs, [{ send: "QUIT", expect: [221, 250] }]);
    try {
      socket.end();
    } catch {
      /* ignore */
    }
    logger.info("password reset email sent", { route: "/api/admin/forgot" });
    return { sent: true };
  } catch {
    logger.warn("password reset email failed; link kept in database for retry", { route: "/api/admin/forgot" });
    try {
      socket?.destroy();
    } catch {
      /* ignore */
    }
    return { sent: false };
  }
}

export function resetLinkFor(token: string, request?: Request): string {
  const base = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (base) return base + "/admin/reset?token=" + encodeURIComponent(token);
  if (request) {
    try {
      return new URL("/admin/reset?token=" + encodeURIComponent(token), request.url).toString();
    } catch {
      /* fall through */
    }
  }
  return "/admin/reset?token=" + encodeURIComponent(token);
}
