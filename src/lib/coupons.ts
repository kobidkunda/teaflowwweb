import { getDb } from "@/lib/db";
import type { CouponInput } from "@/lib/validation";
export type Coupon = {
  code: string;
  kind: string;
  value: number;
  min_subtotal_paise: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  max_discount_paise?: number | null;
  per_user_limit?: number;
  single_use_per_customer?: number;
  rule_type?: string;
  created_at: string;
};
export class CouponError extends Error {}
export function listCoupons(): Coupon[] {
  return getDb().prepare("SELECT * FROM coupons ORDER BY code ASC LIMIT 200").all() as Coupon[];
}
export function getCoupon(code: string): Coupon | null {
  return (getDb().prepare("SELECT * FROM coupons WHERE code=?").get(code.toUpperCase()) as Coupon | undefined) ?? null;
}
// Pure validation + math: active window, min subtotal, usage cap, percent ≤ 50, discount ≤ subtotal, max discount cap, per-customer cap.
export function quoteCoupon(
  code: string,
  subtotalPaise: number,
  customerIdentifier?: { phone?: string; email?: string }
): { valid: boolean; discountPaise: number; reason?: string } {
  const c = getCoupon(code);
  if (!c) return { valid: false, discountPaise: 0, reason: "Unknown coupon code." };
  const now = new Date().toISOString();
  if (!c.is_active) return { valid: false, discountPaise: 0, reason: "Coupon is inactive." };
  if (c.starts_at && c.starts_at > now) return { valid: false, discountPaise: 0, reason: "Coupon is not yet active." };
  if (c.ends_at && c.ends_at < now) return { valid: false, discountPaise: 0, reason: "Coupon has expired." };
  if (subtotalPaise < c.min_subtotal_paise) return { valid: false, discountPaise: 0, reason: "Order subtotal is below the coupon minimum." };
  if (c.max_uses != null && c.used_count >= c.max_uses) return { valid: false, discountPaise: 0, reason: "Coupon usage limit reached." };

  // Check single-use per customer redemption constraint if customer info provided
  if (c.single_use_per_customer === 1 && customerIdentifier) {
    const db = getDb();
    const hasRedemptionsTable = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='coupon_redemptions'").get()
    );
    if (hasRedemptionsTable) {
      const phone = customerIdentifier.phone?.trim();
      const email = customerIdentifier.email?.trim().toLowerCase();
      if (phone || email) {
        let redeemedCount = 0;
        if (phone && email) {
          const row = db.prepare("SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_code = ? AND (customer_phone = ? OR customer_email = ?)").get(c.code, phone, email) as { count: number } | undefined;
          redeemedCount = row?.count ?? 0;
        } else if (phone) {
          const row = db.prepare("SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_code = ? AND customer_phone = ?").get(c.code, phone) as { count: number } | undefined;
          redeemedCount = row?.count ?? 0;
        } else if (email) {
          const row = db.prepare("SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_code = ? AND customer_email = ?").get(c.code, email) as { count: number } | undefined;
          redeemedCount = row?.count ?? 0;
        }
        const limit = c.per_user_limit ?? 1;
        if (redeemedCount >= limit) {
          return { valid: false, discountPaise: 0, reason: "Coupon limit reached for this customer." };
        }
      }
    }
  }

  let discount = c.kind === "percent" ? Math.floor((subtotalPaise * Math.min(c.value, 50)) / 100) : Math.min(c.value, subtotalPaise);
  if (c.max_discount_paise != null && c.max_discount_paise > 0) {
    discount = Math.min(discount, c.max_discount_paise);
  }
  return { valid: true, discountPaise: discount };
}
export function upsertCoupon(input: CouponInput): Coupon {
  const db = getDb();
  const cols = new Set(
    (db.prepare("PRAGMA table_info(coupons)").all() as { name: string }[]).map((c) => c.name)
  );
  if (cols.has("max_discount_paise") && cols.has("single_use_per_customer")) {
    db.prepare([
      "INSERT INTO coupons (code, kind, value, min_subtotal_paise, max_uses, starts_at, ends_at, is_active, max_discount_paise, per_user_limit, single_use_per_customer, rule_type)",
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      "ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value,",
      "min_subtotal_paise=excluded.min_subtotal_paise, max_uses=excluded.max_uses,",
      "starts_at=excluded.starts_at, ends_at=excluded.ends_at, is_active=excluded.is_active,",
      "max_discount_paise=excluded.max_discount_paise, per_user_limit=excluded.per_user_limit,",
      "single_use_per_customer=excluded.single_use_per_customer, rule_type=excluded.rule_type",
    ].join(" ")).run(
      input.code.toUpperCase(),
      input.kind,
      input.value,
      input.min_subtotal_paise,
      input.max_uses ?? null,
      input.starts_at ?? null,
      input.ends_at ?? null,
      input.is_active,
      input.max_discount_paise ?? null,
      input.per_user_limit ?? 1,
      input.single_use_per_customer ?? 0,
      input.rule_type ?? "standard"
    );
  } else {
    db.prepare([
      "INSERT INTO coupons (code, kind, value, min_subtotal_paise, max_uses, starts_at, ends_at, is_active)",
      "VALUES (?,?,?,?,?,?,?,?)",
      "ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value,",
      "min_subtotal_paise=excluded.min_subtotal_paise, max_uses=excluded.max_uses,",
      "starts_at=excluded.starts_at, ends_at=excluded.ends_at, is_active=excluded.is_active",
    ].join(" ")).run(input.code.toUpperCase(), input.kind, input.value, input.min_subtotal_paise,
      input.max_uses ?? null, input.starts_at ?? null, input.ends_at ?? null, input.is_active);
  }
  return getCoupon(input.code)!;
}
export function recordCouponRedemption(params: {
  couponCode: string;
  orderId?: string;
  phone?: string;
  email?: string;
  fingerprint?: string;
  discountPaise: number;
}): void {
  try {
    const db = getDb();
    const hasTable = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='coupon_redemptions'").get()
    );
    if (!hasTable) return;
    db.prepare(`
      INSERT INTO coupon_redemptions (coupon_code, order_id, customer_phone, customer_email, customer_fingerprint, discount_paise, redeemed_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      params.couponCode.toUpperCase(),
      params.orderId ?? null,
      params.phone ?? null,
      params.email ?? null,
      params.fingerprint ?? null,
      params.discountPaise
    );
  } catch {
    // Non-fatal
  }
}
export function deleteCoupon(code: string): boolean {
  const used = getDb().prepare("SELECT COUNT(*) AS n FROM orders WHERE coupon_code=?").get(code.toUpperCase()) as { n: number };
  if (used.n > 0) throw new Error("Coupon was used by orders and cannot be deleted; deactivate it instead.");
  return getDb().prepare("DELETE FROM coupons WHERE code=?").run(code.toUpperCase()).changes > 0;
}
