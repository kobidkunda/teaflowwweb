import { z } from "zod";
import { getDb } from "@/lib/db";
import { randomUUID } from "node:crypto";
import type { GeoLocation } from "@/lib/geo";
import { cleanWhatsAppNumber } from "@/lib/wholesale";
import type Database from "better-sqlite3";

export const cartSyncFingerprintSchema = z.object({
  fingerprintHash: z.string().trim().min(1).max(128),
  canvasHash: z.string().trim().max(128).optional().default(""),
  webglRenderer: z.string().trim().max(256).optional().default(""),
  audioSignature: z.string().trim().max(128).optional().default(""),
  screenResolution: z.string().trim().max(64).optional().default(""),
  timezone: z.string().trim().max(64).optional().default("UTC"),
  deviceMemory: z.number().nullable().optional(),
  hardwareConcurrency: z.number().nullable().optional(),
});

export const cartSyncItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().positive().max(10000),
});

export const cartSyncSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  fingerprint: cartSyncFingerprintSchema.optional(),
  items: z.array(cartSyncItemSchema).max(30).default([]),
});

export type CartSyncInput = z.infer<typeof cartSyncSchema>;

export interface SyncCartParams extends CartSyncInput {
  geo: GeoLocation;
  userAgent: string;
}

export interface SyncCartResult {
  cartId: string;
  recoveryToken: string;
  status: string;
  subtotalPaise: number;
  itemCount: number;
}

export function syncAbandonedCart(
  params: SyncCartParams,
  database?: InstanceType<typeof Database>
): SyncCartResult {
  const db = database ?? getDb();

  return db.transaction(() => {
    // 1. Upsert visitor_fingerprints
    const fp = params.fingerprint;
    const fpHash = fp?.fingerprintHash ?? "fp_anonymous";
    const canvasHash = fp?.canvasHash ?? "";
    const webglRenderer = fp?.webglRenderer ?? "";
    const audioSignature = fp?.audioSignature ?? "";
    const screenRes = fp?.screenResolution ?? "";
    const tz = fp?.timezone ?? "UTC";
    const devMem = fp?.deviceMemory ?? null;
    const hwConc = fp?.hardwareConcurrency ?? null;

    db.prepare(`
      INSERT INTO visitor_fingerprints (
        session_id, fingerprint_hash, canvas_hash, webgl_renderer, audio_signature,
        screen_resolution, timezone, device_memory, hardware_concurrency,
        ip_address, ip_country, ip_region, ip_city, user_agent, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET
        fingerprint_hash = CASE WHEN excluded.fingerprint_hash != '' THEN excluded.fingerprint_hash ELSE visitor_fingerprints.fingerprint_hash END,
        canvas_hash = CASE WHEN excluded.canvas_hash != '' THEN excluded.canvas_hash ELSE visitor_fingerprints.canvas_hash END,
        webgl_renderer = CASE WHEN excluded.webgl_renderer != '' THEN excluded.webgl_renderer ELSE visitor_fingerprints.webgl_renderer END,
        audio_signature = CASE WHEN excluded.audio_signature != '' THEN excluded.audio_signature ELSE visitor_fingerprints.audio_signature END,
        screen_resolution = CASE WHEN excluded.screen_resolution != '' THEN excluded.screen_resolution ELSE visitor_fingerprints.screen_resolution END,
        timezone = CASE WHEN excluded.timezone != '' THEN excluded.timezone ELSE visitor_fingerprints.timezone END,
        device_memory = COALESCE(excluded.device_memory, visitor_fingerprints.device_memory),
        hardware_concurrency = COALESCE(excluded.hardware_concurrency, visitor_fingerprints.hardware_concurrency),
        ip_address = excluded.ip_address,
        ip_country = excluded.ip_country,
        ip_region = excluded.ip_region,
        ip_city = excluded.ip_city,
        user_agent = excluded.user_agent,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      params.sessionId,
      fpHash,
      canvasHash,
      webglRenderer,
      audioSignature,
      screenRes,
      tz,
      devMem,
      hwConc,
      params.geo.ip,
      params.geo.country,
      params.geo.region,
      params.geo.city,
      params.userAgent
    );

    // 2. Look up existing lead information for this session
    const knownLead = db.prepare(
      "SELECT phone_number, customer_name FROM visitor_fingerprints WHERE session_id = ?"
    ).get(params.sessionId) as { phone_number?: string; customer_name?: string } | undefined;

    // 3. Verify variant prices against the database and calculate totals
    const lookupVariant = db.prepare("SELECT id, price_paise, stock FROM variants WHERE id = ?");
    let subtotalPaise = 0;
    let itemCount = 0;
    const validatedLines: Array<{ variantId: number; quantity: number; unitPrice: number }> = [];

    // Deduplicate items by variantId
    const combined = new Map<number, number>();
    for (const item of params.items) {
      combined.set(item.variantId, (combined.get(item.variantId) || 0) + item.quantity);
    }

    for (const [variantId, quantity] of combined) {
      const variant = lookupVariant.get(variantId) as
        | { id: number; price_paise: number; stock: number }
        | undefined;
      if (!variant) continue; // Skip unknown variants
      let unitPrice = variant.price_paise;
      try {
        const slabRows = db.prepare("SELECT min_qty, price_paise FROM wholesale_slabs WHERE variant_id=? ORDER BY min_qty DESC").all(variantId) as Array<{ min_qty: number; price_paise: number }>;
        const activeSlab = slabRows.find((s) => quantity >= s.min_qty);
        if (activeSlab) {
          unitPrice = activeSlab.price_paise;
        }
      } catch {}
      subtotalPaise += unitPrice * quantity;
      itemCount += quantity;
      validatedLines.push({ variantId, quantity, unitPrice });
    }

    // 4. Find or create abandoned_carts record
    const existingCart = db.prepare(`
      SELECT id, recovery_token, customer_phone, customer_name, customer_email, status
      FROM abandoned_carts
      WHERE session_id = ? AND status IN ('active', 'abandoned', 'contacted')
      ORDER BY created_at DESC LIMIT 1
    `).get(params.sessionId) as {
      id: string;
      recovery_token: string;
      customer_phone?: string;
      customer_name?: string;
      customer_email?: string;
      status: string;
    } | undefined;

    let cartId: string;
    let recoveryToken: string;

    if (existingCart) {
      cartId = existingCart.id;
      recoveryToken = existingCart.recovery_token;
      const phone = existingCart.customer_phone || knownLead?.phone_number || null;
      const name = existingCart.customer_name || knownLead?.customer_name || null;

      db.prepare(`
        UPDATE abandoned_carts
        SET status = 'active',
            subtotal_paise = ?,
            item_count = ?,
            customer_phone = ?,
            customer_name = ?,
            last_active_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(subtotalPaise, itemCount, phone, name, cartId);
    } else {
      cartId = "cart_" + randomUUID().replace(/-/g, "").slice(0, 16);
      recoveryToken = "rec_" + randomUUID().replace(/-/g, "");
      const phone = knownLead?.phone_number || null;
      const name = knownLead?.customer_name || null;

      db.prepare(`
        INSERT INTO abandoned_carts (
          id, session_id, customer_phone, customer_name, customer_email,
          status, subtotal_paise, item_count, recovery_token, recovery_channel,
          admin_notes, last_active_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, NULL,
          'active', ?, ?, ?, 'whatsapp',
          '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(cartId, params.sessionId, phone, name, subtotalPaise, itemCount, recoveryToken);
    }

    // 5. Replace cart_items lines atomically
    db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
    const insertItem = db.prepare(`
      INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    for (const line of validatedLines) {
      insertItem.run(cartId, line.variantId, line.quantity, line.unitPrice);
    }

    return {
      cartId,
      recoveryToken,
      status: "active",
      subtotalPaise,
      itemCount,
    };
  })();
}

export function markCartConverted(
  db: InstanceType<typeof Database>,
  params: {
    orderId: string;
    sessionId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  }
): boolean {
  try {
    const hasTable = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='abandoned_carts'").get()
    );
    if (!hasTable) return false;

    let cart: { id: string } | undefined;

    if (params.sessionId) {
      cart = db.prepare(`
        SELECT id FROM abandoned_carts
        WHERE session_id = ? AND status IN ('active', 'abandoned', 'contacted')
        ORDER BY last_active_at DESC LIMIT 1
      `).get(params.sessionId) as { id: string } | undefined;
    }

    if (!cart && params.customerPhone) {
      cart = db.prepare(`
        SELECT id FROM abandoned_carts
        WHERE customer_phone = ? AND status IN ('active', 'abandoned', 'contacted')
        ORDER BY last_active_at DESC LIMIT 1
      `).get(params.customerPhone) as { id: string } | undefined;
    }

    if (!cart && params.customerEmail) {
      cart = db.prepare(`
        SELECT id FROM abandoned_carts
        WHERE customer_email = ? AND status IN ('active', 'abandoned', 'contacted')
        ORDER BY last_active_at DESC LIMIT 1
      `).get(params.customerEmail) as { id: string } | undefined;
    }

    if (cart) {
      db.prepare(`
        UPDATE abandoned_carts
        SET status = 'converted',
            converted_order_id = ?,
            customer_name = COALESCE(customer_name, ?),
            customer_email = COALESCE(customer_email, ?),
            customer_phone = COALESCE(customer_phone, ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        params.orderId,
        params.customerName ?? null,
        params.customerEmail ?? null,
        params.customerPhone ?? null,
        cart.id
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getCartBySession(
  sessionId: string,
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const cart = db.prepare(
    "SELECT * FROM abandoned_carts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(sessionId) as Record<string, unknown> | undefined;

  if (!cart) return null;

  const items = db.prepare(
    "SELECT * FROM cart_items WHERE cart_id = ?"
  ).all(cart.id as string) as Record<string, unknown>[];

  return { cart, items };
}

export function getCartById(
  cartId: string,
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const cart = db.prepare(
    "SELECT * FROM abandoned_carts WHERE id = ?"
  ).get(cartId) as Record<string, unknown> | undefined;

  if (!cart) return null;

  const items = db.prepare(
    "SELECT * FROM cart_items WHERE cart_id = ?"
  ).all(cartId) as Record<string, unknown>[];

  return { cart, items };
}

export interface ListAbandonedCartsOptions {
  status?: string;
  has_phone?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  cursor?: string;
}

export function buildWhatsAppRecoveryMessage(params: {
  customerName?: string | null;
  items?: Array<{ product_name?: string; name?: string }>;
  recoveryUrl: string;
  couponCode?: string | null;
}): string {
  const name = params.customerName ? `Namaste ${params.customerName}!` : "Namaste!";
  const discount = params.couponCode ? ` Use coupon *${params.couponCode}* for 10% off.` : "";
  return `${name} You left some fresh Himalayan teas in your bag.${discount} Complete your harvest selection here: ${params.recoveryUrl}`;
}

export function listAbandonedCarts(
  options: ListAbandonedCartsOptions = {},
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const status = options.status ?? "all";
  const hasPhone = options.has_phone;
  const search = options.search?.trim();

  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];

  if (status && status !== "all") {
    whereClause += " AND ac.status = ?";
    params.push(status);
  }

  if (hasPhone === true) {
    whereClause += " AND ac.customer_phone IS NOT NULL AND ac.customer_phone != ''";
  }

  if (search) {
    whereClause += " AND (ac.customer_phone LIKE ? OR ac.customer_name LIKE ? OR ac.customer_email LIKE ? OR vf.ip_city LIKE ? OR ac.session_id LIKE ?)";
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
  }

  const countQuery = `
    SELECT COUNT(*) as cnt
    FROM abandoned_carts ac
    LEFT JOIN visitor_fingerprints vf ON ac.session_id = vf.session_id
    ${whereClause}
  `;
  const totalRow = db.prepare(countQuery).get(...params) as { cnt: number } | undefined;
  const total = totalRow?.cnt ?? 0;

  const dataQuery = `
    SELECT ac.*,
           vf.ip_address, vf.ip_country, vf.ip_region, vf.ip_city,
           vf.user_agent, vf.fingerprint_hash, vf.screen_resolution, vf.timezone
    FROM abandoned_carts ac
    LEFT JOIN visitor_fingerprints vf ON ac.session_id = vf.session_id
    ${whereClause}
    ORDER BY ac.last_active_at DESC
    LIMIT ? OFFSET ?
  `;
  const cartRows = db.prepare(dataQuery).all(...params, limit, offset) as Array<Record<string, unknown>>;

  const itemLookup = db.prepare(`
    SELECT ci.variant_id, ci.quantity, ci.unit_price_paise,
           v.grams, v.sku, p.name as product_name, p.slug as product_slug
    FROM cart_items ci
    JOIN variants v ON ci.variant_id = v.id
    JOIN products p ON v.product_id = p.id
    WHERE ci.cart_id = ?
  `);

  const carts = cartRows.map((c) => {
    const cartId = String(c.id);
    const phone = (c.customer_phone as string) || null;
    const name = (c.customer_name as string) || null;
    const recToken = String(c.recovery_token || "");
    const recoveryUrl = `https://teafloww.com/cart?recovery=${recToken}`;
    const cleanPhone = phone ? cleanWhatsAppNumber(phone) : null;
    const items = itemLookup.all(cartId) as Array<{
      variant_id: number;
      quantity: number;
      unit_price_paise: number;
      grams: number;
      sku: string;
      product_name: string;
      product_slug: string;
    }>;
    const message = buildWhatsAppRecoveryMessage({
      customerName: name,
      items,
      recoveryUrl,
      couponCode: (c.applied_coupon_code as string) || "COMEBACK10",
    });

    return {
      id: cartId,
      session_id: String(c.session_id),
      status: String(c.status),
      customer_name: name,
      customer_phone: phone,
      customer_email: (c.customer_email as string) || null,
      item_count: Number(c.item_count || 0),
      subtotal_paise: Number(c.subtotal_paise || 0),
      applied_coupon_code: (c.applied_coupon_code as string) || null,
      recovery_token: recToken,
      recovery_url: recoveryUrl,
      whatsapp_url: cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}` : null,
      admin_notes: String(c.admin_notes || ""),
      last_active_at: String(c.last_active_at || ""),
      created_at: String(c.created_at || ""),
      ip_address: (c.ip_address as string) || "",
      ip_city: (c.ip_city as string) || "Siliguri",
      ip_region: (c.ip_region as string) || "",
      ip_country: (c.ip_country as string) || "India",
      user_agent: (c.user_agent as string) || "",
      fingerprint_hash: (c.fingerprint_hash as string) || "",
      screen_resolution: (c.screen_resolution as string) || "",
      timezone: (c.timezone as string) || "Asia/Kolkata",
      items,
    };
  });

  // Calculate high-level summary metrics
  const metricsRow = db.prepare(`
    SELECT
      COUNT(*) as total_carts,
      SUM(CASE WHEN status IN ('active', 'abandoned') THEN 1 ELSE 0 END) as total_abandoned,
      SUM(CASE WHEN status IN ('active', 'abandoned', 'contacted') THEN subtotal_paise ELSE 0 END) as total_recoverable_revenue_paise,
      SUM(CASE WHEN customer_phone IS NOT NULL AND customer_phone != '' THEN 1 ELSE 0 END) as total_leads_with_phone,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as total_converted
    FROM abandoned_carts
  `).get() as {
    total_carts: number;
    total_abandoned: number | null;
    total_recoverable_revenue_paise: number | null;
    total_leads_with_phone: number | null;
    total_converted: number | null;
  } | undefined;

  const totalCarts = metricsRow?.total_carts ?? 0;
  const totalConverted = metricsRow?.total_converted ?? 0;
  const recoveryRate = totalCarts > 0 ? Number(((totalConverted / totalCarts) * 100).toFixed(1)) : 0;

  return {
    carts,
    total,
    hasMore: offset + carts.length < total,
    metrics: {
      total_carts: totalCarts,
      total_abandoned: metricsRow?.total_abandoned ?? 0,
      total_recoverable_revenue_paise: metricsRow?.total_recoverable_revenue_paise ?? 0,
      total_leads_with_phone: metricsRow?.total_leads_with_phone ?? 0,
      total_converted: totalConverted,
      recovery_rate_percent: recoveryRate,
    },
  };
}

export function getAbandonedCartDetails(
  cartId: string,
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const cart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as Record<string, unknown> | undefined;
  if (!cart) return null;

  const items = db.prepare(`
    SELECT ci.*, v.sku, p.name as product_name, p.slug as product_slug, v.grams, v.packaging_format
    FROM cart_items ci
    JOIN variants v ON ci.variant_id = v.id
    JOIN products p ON v.product_id = p.id
    WHERE ci.cart_id = ?
  `).all(cartId) as Array<Record<string, unknown>>;

  const visitor = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(cart.session_id) as Record<string, unknown> | undefined;

  const phone = (cart.customer_phone as string) || null;
  const name = (cart.customer_name as string) || null;
  const recoveryUrl = `https://teafloww.com/cart?recovery=${cart.recovery_token}`;
  const cleanPhone = phone ? cleanWhatsAppNumber(phone) : null;
  const preview = buildWhatsAppRecoveryMessage({
    customerName: name,
    items: items.map((i) => ({ product_name: String(i.product_name), quantity: Number(i.quantity) })),
    recoveryUrl,
    couponCode: (cart.applied_coupon_code as string) || "COMEBACK10",
  });

  return {
    cart: {
      id: String(cart.id),
      status: String(cart.status),
      subtotal_paise: Number(cart.subtotal_paise || 0),
      item_count: Number(cart.item_count || 0),
      customer_name: name,
      customer_phone: phone,
      customer_email: (cart.customer_email as string) || null,
      recovery_token: String(cart.recovery_token),
      recovery_url: recoveryUrl,
      whatsapp_url: cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(preview)}` : null,
      whatsapp_message_preview: preview,
      admin_notes: String(cart.admin_notes || ""),
      last_active_at: String(cart.last_active_at),
      created_at: String(cart.created_at),
    },
    items: items.map((i) => ({
      variant_id: Number(i.variant_id),
      sku: String(i.sku),
      product_name: String(i.product_name),
      product_slug: String(i.product_slug),
      grams: Number(i.grams),
      quantity: Number(i.quantity),
      unit_price_paise: Number(i.unit_price_paise),
    })),
    visitor: visitor
      ? {
          session_id: String(visitor.session_id),
          fingerprint_hash: String(visitor.fingerprint_hash),
          ip_address: String(visitor.ip_address),
          ip_city: String(visitor.ip_city),
          ip_country: String(visitor.ip_country),
          user_agent: String(visitor.user_agent),
          screen_resolution: String(visitor.screen_resolution),
          timezone: String(visitor.timezone),
          device_memory: visitor.device_memory ? Number(visitor.device_memory) : null,
          hardware_concurrency: visitor.hardware_concurrency ? Number(visitor.hardware_concurrency) : null,
        }
      : null,
  };
}

export function updateAbandonedCartStatus(
  params: {
    cart_id: string;
    status: string;
    notes?: string;
    idempotencyKey?: string;
  },
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const cart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(params.cart_id) as Record<string, unknown> | undefined;
  if (!cart) return null;

  let updatedNotes = String(cart.admin_notes || "");
  if (params.notes?.trim()) {
    const timestamp = new Date().toISOString();
    updatedNotes = updatedNotes ? `${updatedNotes}\n[${timestamp}] ${params.notes.trim()}` : `[${timestamp}] ${params.notes.trim()}`;
  }

  db.prepare(`
    UPDATE abandoned_carts
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(params.status, updatedNotes, params.cart_id);

  const updated = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(params.cart_id) as Record<string, unknown>;

  return {
    success: true,
    cart: {
      id: String(updated.id),
      status: String(updated.status),
      admin_notes: String(updated.admin_notes || ""),
      updated_at: String(updated.updated_at),
    },
  };
}

export function getAbandonedCartsResourceSummary(database?: InstanceType<typeof Database>) {
  const db = database ?? getDb();
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_carts,
      SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned_carts,
      SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_carts,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_carts,
      SUM(CASE WHEN status = 'abandoned' THEN subtotal_paise ELSE 0 END) as total_abandoned_paise,
      SUM(CASE WHEN status = 'converted' THEN subtotal_paise ELSE 0 END) as recovered_revenue_paise,
      SUM(CASE WHEN customer_phone IS NOT NULL AND customer_phone != '' THEN 1 ELSE 0 END) as captured_leads_count
    FROM abandoned_carts
  `).get() as Record<string, unknown>;

  return {
    metrics: summary,
    generated_at: new Date().toISOString(),
  };
}
