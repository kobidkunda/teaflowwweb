import { z } from "zod";
import { getDb } from "@/lib/db";
import { cleanWhatsAppNumber } from "@/lib/wholesale";
import type Database from "better-sqlite3";

export const leadCaptureSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  phoneNumber: z
    .string()
    .trim()
    .refine(
      (v) => {
        const digits = v.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      },
      { message: "Please provide a valid 10-15 digit mobile number." }
    ),
  customerName: z.string().trim().max(100).optional(),
  cartId: z.string().trim().max(128).optional(),
  source: z.enum(["exit_intent", "cart_incentive", "manual"]).default("exit_intent"),
});

export type LeadCaptureInput = z.input<typeof leadCaptureSchema>;

export interface LeadCaptureResult {
  success: boolean;
  leadId: number;
  couponCode: string;
  discountPercent: number;
  message: string;
  cartId?: string;
}

export interface RecoveredCartItem {
  variantId: number;
  slug: string;
  name: string;
  grams: number;
  pricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface RecoveredCart {
  id: string;
  sessionId: string;
  status: string;
  subtotalPaise: number;
  itemCount: number;
  appliedCouponCode: string | null;
  customerPhone: string | null;
  customerName: string | null;
  customerEmail: string | null;
  recoveryToken: string;
  items: RecoveredCartItem[];
}

/**
 * Provisions the lead incentive coupon (default COMEBACK10) in coupons table idempotently.
 */
export function provisionLeadCoupon(
  code = "COMEBACK10",
  discountPercent = 10,
  database?: InstanceType<typeof Database>
): { code: string; percent: number } {
  const db = database ?? getDb();
  const upperCode = code.trim().toUpperCase();

  db.prepare(`
    INSERT INTO coupons (
      code, kind, value, min_subtotal_paise, max_uses, used_count,
      is_active, max_discount_paise, per_user_limit, single_use_per_customer, rule_type
    ) VALUES (
      ?, 'percent', ?, 0, NULL, 0,
      1, 50000, 1, 1, 'lead_incentive'
    )
    ON CONFLICT(code) DO NOTHING
  `).run(upperCode, discountPercent);

  return { code: upperCode, percent: discountPercent };
}

/**
 * Saves a high-intent visitor lead into captured_leads, links phone to active cart
 * in abandoned_carts and visitor_fingerprints, and provisions an incentive coupon.
 */
export function captureLead(
  input: LeadCaptureInput,
  database?: InstanceType<typeof Database>
): LeadCaptureResult {
  const db = database ?? getDb();

  const rawDigits = (input.phoneNumber || "").replace(/\D/g, "");
  if (rawDigits.length < 10 || rawDigits.length > 15) {
    throw new Error("Invalid phone number: Must be 10-15 digits.");
  }

  const cleanPhone = cleanWhatsAppNumber(input.phoneNumber);
  const cleanName = (input.customerName || "").trim().slice(0, 100);
  const source = input.source || "exit_intent";

  // Check store settings for configured lead coupon code and percent
  let couponCode = "COMEBACK10";
  let discountPercent = 10;

  try {
    const codeSetting = db
      .prepare("SELECT value FROM store_settings WHERE key = 'abandoned_lead_coupon_code'")
      .get() as { value?: string } | undefined;
    if (codeSetting?.value?.trim()) {
      couponCode = codeSetting.value.trim().toUpperCase();
    }

    const percentSetting = db
      .prepare("SELECT value FROM store_settings WHERE key = 'abandoned_lead_discount_percent'")
      .get() as { value?: string } | undefined;
    if (percentSetting?.value) {
      const parsedPercent = parseInt(percentSetting.value, 10);
      if (!isNaN(parsedPercent) && parsedPercent > 0 && parsedPercent <= 50) {
        discountPercent = parsedPercent;
      }
    }
  } catch {
    // If store_settings table not yet available, fallback to defaults
  }

  // Ensure coupon exists in database
  provisionLeadCoupon(couponCode, discountPercent, db);

  // Locate matching active cart (by specified cartId or active session)
  let cart: { id: string; applied_coupon_code?: string } | undefined;
  if (input.cartId) {
    cart = db
      .prepare("SELECT id, applied_coupon_code FROM abandoned_carts WHERE id = ? AND status != 'converted'")
      .get(input.cartId) as { id: string; applied_coupon_code?: string } | undefined;
  }

  if (!cart) {
    cart = db
      .prepare(
        "SELECT id, applied_coupon_code FROM abandoned_carts WHERE session_id = ? AND status != 'converted' ORDER BY last_active_at DESC LIMIT 1"
      )
      .get(input.sessionId) as { id: string; applied_coupon_code?: string } | undefined;
  }

  return db.transaction(() => {
    // 1. Record captured lead
    const leadInsert = db
      .prepare(`
        INSERT INTO captured_leads (
          phone_number, customer_name, session_id, cart_id, provisioned_coupon, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .run(cleanPhone, cleanName, input.sessionId, cart?.id ?? null, couponCode, source);

    const leadId = Number(leadInsert.lastInsertRowid);

    // 2. Link phone and name to active cart in abandoned_carts
    if (cart) {
      db.prepare(`
        UPDATE abandoned_carts
        SET customer_phone = ?,
            customer_name = CASE WHEN ? != '' THEN ? ELSE customer_name END,
            applied_coupon_code = COALESCE(applied_coupon_code, ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanPhone, cleanName, cleanName, couponCode, cart.id);
    }

    // 3. Link phone and name to visitor_fingerprints
    db.prepare(`
      INSERT INTO visitor_fingerprints (
        session_id, fingerprint_hash, phone_number, customer_name,
        ip_address, user_agent, created_at, updated_at
      ) VALUES (?, 'fp_lead', ?, ?, '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET
        phone_number = excluded.phone_number,
        customer_name = CASE WHEN excluded.customer_name != '' THEN excluded.customer_name ELSE visitor_fingerprints.customer_name END,
        updated_at = CURRENT_TIMESTAMP
    `).run(input.sessionId, cleanPhone, cleanName);

    return {
      success: true,
      leadId,
      couponCode,
      discountPercent,
      message: `Special ${discountPercent}% discount unlocked with code ${couponCode}!`,
      cartId: cart?.id,
    };
  })();
}

/**
 * Retrieves an abandoned/active cart by its unique recovery token, including line items.
 */
type RawCartRow = {
  id: string;
  session_id: string;
  status: string;
  subtotal_paise: number;
  item_count: number;
  applied_coupon_code: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  customer_email: string | null;
  recovery_token: string;
};

type RawItemRow = {
  variantId: number;
  quantity: number;
  unit_price_paise: number | null;
  variantName: string | null;
  grams: number | null;
  currentPricePaise: number | null;
  productName: string | null;
  slug: string;
};

export function getCartByRecoveryToken(
  recoveryToken: string,
  database?: InstanceType<typeof Database>
): RecoveredCart | null {
  const db = database ?? getDb();

  const cart = db
    .prepare("SELECT * FROM abandoned_carts WHERE recovery_token = ?")
    .get(recoveryToken) as RawCartRow | undefined;

  if (!cart) return null;

  const rawItems = db
    .prepare(`
      SELECT 
        ci.variant_id AS variantId,
        ci.quantity,
        ci.unit_price_paise,
        v.name AS variantName,
        v.grams,
        v.price_paise AS currentPricePaise,
        p.name AS productName,
        p.slug
      FROM cart_items ci
      JOIN variants v ON ci.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      WHERE ci.cart_id = ?
      ORDER BY ci.id ASC
    `)
    .all(cart.id) as RawItemRow[];

  const items: RecoveredCartItem[] = rawItems.map((item) => {
    const pricePaise = Number(item.unit_price_paise || item.currentPricePaise || 0);
    return {
      variantId: Number(item.variantId),
      slug: String(item.slug),
      name: String(item.productName || item.variantName || "Himalayan Tea"),
      grams: Number(item.grams || 100),
      pricePaise,
      quantity: Number(item.quantity),
      lineTotalPaise: pricePaise * Number(item.quantity),
    };
  });

  return {
    id: cart.id,
    sessionId: cart.session_id,
    status: cart.status,
    subtotalPaise: cart.subtotal_paise,
    itemCount: cart.item_count,
    appliedCouponCode: cart.applied_coupon_code,
    customerPhone: cart.customer_phone,
    customerName: cart.customer_name,
    customerEmail: cart.customer_email,
    recoveryToken: cart.recovery_token,
    items,
  };
}

/**
 * Retrieves captured lead records for a given phone number.
 */
export function getLeadByPhone(
  phoneNumber: string,
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const cleanPhone = cleanWhatsAppNumber(phoneNumber);
  return db
    .prepare("SELECT * FROM captured_leads WHERE phone_number = ? ORDER BY created_at DESC")
    .all(cleanPhone);
}

/**
 * Retrieves captured lead records for a given session ID.
 */
export function getLeadBySession(
  sessionId: string,
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  return db
    .prepare("SELECT * FROM captured_leads WHERE session_id = ? ORDER BY created_at DESC")
    .all(sessionId);
}

/**
 * Lists captured leads with pagination.
 */
export function listCapturedLeads(
  options: { limit?: number; offset?: number } = {},
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);

  return db
    .prepare("SELECT * FROM captured_leads ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(limit, offset);
}
