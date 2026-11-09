export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Keys whose VALUES must never reach logs (case-insensitive, substring match).
// Covers customer PII (name/email/address), credentials, and payment secrets.
const SENSITIVE_KEY = new RegExp(
  "name|email|address|phone|pin.?code|password|secret|token|authorization|" +
    "cookie|set-cookie|card|cvv|cvc|upi|otp|session",
  "i"
);

// Email addresses that slip into free-text messages are redacted too.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  return redactUnknown(value);
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }
  return value;
}

export function redactText(text: string): string {
  return text.replace(EMAIL_RE, "[redacted-email]");
}

function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function emit(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: redactText(message),
  };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      entry[k] = redactValue(k, v);
    }
  }
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

/**
 * Structured JSON logger. NEVER pass customer PII (name, email, address),
 * tokens, or secrets as fields — keys matching the sensitive list are replaced
 * with "[redacted]" and emails in text are masked. Log identifiers that are
 * safe: orderId, status transitions, route, latency_ms, error codes.
 */
export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) =>
    emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) =>
    emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) =>
    emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) =>
    emit("error", message, fields),
};
