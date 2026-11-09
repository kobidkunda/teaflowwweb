import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation";
import { quoteTotals, SHIPPING_METHOD } from "@/lib/money";
import { validateCouponServer } from "@/lib/storefront";
import { markCartConverted } from "@/lib/abandonedCarts";
export { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, GST_RATE_PERCENT, calculateShipping, calculateTaxPaise, quoteTotals } from "@/lib/money";
import { randomUUID } from "node:crypto";
export class CheckoutError extends Error {}
type StockRow = { id: number; price_paise: number; stock: number };
type ExistingOrder = { id: string; total_paise: number };

export type DemoOrderInput = CheckoutInput & {
  phone?: string;
  sessionId?: string;
  customerId?: string;
};

export function createDemoOrder(raw: DemoOrderInput): { orderId: string; totalPaise: number; discountPaise: number; taxPaise: number; deduped: boolean } {
  const input = checkoutSchema.parse(raw);
  const phone = typeof raw.phone === "string" ? raw.phone.trim().slice(0, 30) : undefined;
  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId.trim().slice(0, 128) : undefined;

  const db = getDb();
  return db.transaction(() => {
    const cols = (() => {
      try {
        return (db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name);
      } catch {
        return [] as string[];
      }
    })();
    const hasCouponCols = cols.includes("coupon_code") && cols.includes("discount_paise");
    const hasTaxCols = cols.includes("tax_paise") && cols.includes("shipping_method");
    const hasPhoneCol = cols.includes("customer_phone");
    const hasCustomerCol = cols.includes("customer_id");

    const existing = (hasCouponCols
      ? db.prepare("SELECT id,total_paise,discount_paise FROM orders WHERE idempotency_key=?")
      : db.prepare("SELECT id,total_paise FROM orders WHERE idempotency_key=?")
    ).get(input.idempotencyKey) as (ExistingOrder & { discount_paise?: number }) | undefined;
    if (existing) {
      const row = hasTaxCols
        ? (db.prepare("SELECT tax_paise FROM orders WHERE id=?").get(existing.id) as { tax_paise?: number } | undefined)
        : undefined;
      return { orderId: existing.id, totalPaise: existing.total_paise, discountPaise: existing.discount_paise ?? 0, taxPaise: Number(row?.tax_paise ?? 0), deduped: true };
    }
    const combined = new Map<number, number>();
    for (const item of input.items) {
      combined.set(item.variantId, (combined.get(item.variantId) || 0) + item.quantity);
    }
    if (combined.size > 30) throw new CheckoutError("Too many line items.");
    const lines: { variantId: number; quantity: number; unitPrice: number }[] = [];
    let subtotal = 0;
    const lookup = db.prepare(`SELECT v.id,v.price_paise,v.stock FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND ${enabledProductCondition("p")}`);
    for (const [variantId, quantity] of combined) {
      if (quantity > 20) throw new CheckoutError("Maximum quantity is 20 per variant.");
      const variant = lookup.get(variantId) as StockRow | undefined;
      if (!variant || variant.stock < quantity) throw new CheckoutError("A selected tea is unavailable or exceeds available stock.");
      subtotal += variant.price_paise * quantity;
      lines.push({ variantId, quantity, unitPrice: variant.price_paise });
    }
    // Server-side coupon: client math is ignored; unknown/inapplicable codes
    // are rejected here (never silently dropped when a code was supplied).
    let discount = 0;
    let couponCode: string | null = null;
    const supplied = (input.couponCode ?? "").trim().toUpperCase();
    if (supplied) {
      const check = validateCouponServer(supplied, subtotal);
      if (!check.valid) throw new CheckoutError(check.reason);
      discount = check.discountPaise;
      couponCode = supplied;
    }
    if (!hasCouponCols && couponCode) {
      throw new CheckoutError("Coupon codes are not available right now.");
    }

    // Single totals owner: GST-inclusive breakout, total unchanged by tax.
    const { shippingPaise: shipping, taxPaise: tax, totalPaise: total } = quoteTotals(subtotal, discount);
    const id = randomUUID();

    const orderCols = [
      "id",
      "idempotency_key",
      "customer_name",
      "customer_email",
      "shipping_address",
      "subtotal_paise",
      "shipping_paise",
      "total_paise",
      "status",
    ];
    const orderVals: unknown[] = [
      id,
      input.idempotencyKey,
      input.name,
      input.email,
      input.address,
      subtotal,
      shipping,
      total,
      "demo_unpaid",
    ];

    if (hasCouponCols) {
      orderCols.push("coupon_code", "discount_paise");
      orderVals.push(couponCode, discount);
    }
    if (hasTaxCols) {
      orderCols.push("tax_paise", "shipping_method");
      orderVals.push(tax, SHIPPING_METHOD);
    }
    if (hasPhoneCol) {
      orderCols.push("customer_phone");
      orderVals.push(phone ?? null);
    }
    if (hasCustomerCol) {
      let resolvedCustomerId = raw.customerId || null;
      if (!resolvedCustomerId) {
        try {
          const cust = db.prepare("SELECT id FROM customers WHERE email = ?").get(input.email.trim().toLowerCase()) as { id: string } | undefined;
          if (cust) resolvedCustomerId = cust.id;
        } catch {}
      }
      orderCols.push("customer_id");
      orderVals.push(resolvedCustomerId);
    }

    const placeholders = orderCols.map(() => "?").join(",");
    db.prepare(`INSERT INTO orders (${orderCols.join(",")}) VALUES (${placeholders})`).run(...orderVals);

    const insert = db.prepare("INSERT INTO order_items (order_id,variant_id,quantity,unit_price_paise) VALUES (?,?,?,?)");
    for (const line of lines) insert.run(id, line.variantId, line.quantity, line.unitPrice);

    // Atomically transition cart session state to 'converted'
    markCartConverted(db, {
      orderId: id,
      sessionId,
      customerName: input.name,
      customerEmail: input.email,
      customerPhone: phone,
    });

    // Demo-only: do NOT decrement stock until a verified payment capture exists.
    return { orderId: id, totalPaise: total, discountPaise: discount, taxPaise: tax, deduped: false };
  })();
}
