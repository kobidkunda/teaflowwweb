import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { up as up061 } from "../../scripts/migrations/061_trade_channel.mjs";
import { up as up063 } from "../../scripts/migrations/063_trade_enquiries_utm.mjs";
import {
  calculateServingsPerKg,
  compareBatches,
  evaluateBatch,
  recommendPackCoverage,
} from "@/lib/trade/calculator";
import { computeParcelPacking } from "@/lib/trade/packing";
import {
  createTradeEnquiry,
  createTradeQuote,
  getTradeQuoteForSession,
  registerSharedPilotInterest,
} from "@/lib/trade/quotes";
import {
  createTradeOrderFromQuote,
  getAuthorizedTradeOrder,
  saveReorderReminder,
  TradeCheckoutError,
} from "@/lib/trade/checkout";
import {
  getTradeSettings,
  listPublicTradeProducts,
  updateTradeSettings,
  upsertTradeLane,
  upsertTradeOffer,
} from "@/lib/trade/catalogue";
import { getTradeDictionary } from "@/lib/trade/i18n";
import { dispatchToolCall } from "@/lib/mcp";

let tmpDir: string;
let prevDbPath: string | undefined;
let db: Database.Database;
let variant5Id: number;
let variant25Id: number;
let productId: number;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "teafloww-trade-"));
  const dbPath = path.join(tmpDir, "test.sqlite");
  prevDbPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = dbPath;

  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      origin TEXT NOT NULL,
      estate TEXT NOT NULL,
      flush TEXT NOT NULL,
      harvest_date TEXT NOT NULL,
      description TEXT NOT NULL,
      tasting_notes TEXT NOT NULL,
      floral INTEGER NOT NULL DEFAULT 0,
      fruity INTEGER NOT NULL DEFAULT 0,
      malty INTEGER NOT NULL DEFAULT 0,
      body INTEGER NOT NULL DEFAULT 0,
      brew_temp INTEGER NOT NULL,
      brew_seconds INTEGER NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL UNIQUE,
      grams INTEGER NOT NULL,
      price_paise INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      shipping_address TEXT NOT NULL,
      subtotal_paise INTEGER NOT NULL,
      shipping_paise INTEGER NOT NULL,
      total_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      shipping_method TEXT,
      dispatch_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id),
      variant_id INTEGER NOT NULL REFERENCES variants(id),
      quantity INTEGER NOT NULL,
      unit_price_paise INTEGER NOT NULL
    );
  `);

  const pRes = db
    .prepare(
      `INSERT INTO products (slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds, enabled)
       VALUES ('everyday-strong-milk-chai', 'Everyday Strong Milk Chai', 'CTC', 'Assam & Dooars', 'Siliguri Blend', 'Second', '2026', 'Strong chai', 'Malty', 100, 210, 1)`
    )
    .run();
  productId = Number(pRes.lastInsertRowid);

  variant5Id = Number(
    db
      .prepare(
        "INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?, 'CHAI-5KG', 5000, 130000, 20)"
      )
      .run(productId).lastInsertRowid
  );
  variant25Id = Number(
    db
      .prepare(
        "INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?, 'CHAI-25KG', 25000, 575000, 10)"
      )
      .run(productId).lastInsertRowid
  );

  // Run migration 061 twice to verify idempotency
  up061(db);
  up061(db);
  up063(db);
  up063(db);
});

afterAll(() => {
  try {
    db.close();
  } catch {}
  if (prevDbPath !== undefined) process.env.DATABASE_PATH = prevDbPath;
  else delete process.env.DATABASE_PATH;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("TeaFloww Trade calculators and packing", () => {
  it("computes leaf cost per glass and rejects invalid/fractional glasses (T23)", () => {
    const res = evaluateBatch({
      pricePerKgRupees: 280,
      teaUsedGrams: 30,
      glassesMade: 10,
    });
    expect(res).toEqual({
      valid: true,
      costPerGlassRupees: 0.84,
      costPerGlassPaise: 84,
    });

    expect(
      evaluateBatch({ pricePerKgRupees: 280, teaUsedGrams: 30, glassesMade: 10.5 })
    ).toEqual({ valid: false, reason: "fractional_glasses" });

    expect(
      evaluateBatch({ pricePerKgRupees: 0, teaUsedGrams: 30, glassesMade: 10 })
    ).toEqual({ valid: false, reason: "non_positive" });

    const cmp = compareBatches(
      { pricePerKgRupees: 280, teaUsedGrams: 30, glassesMade: 10 },
      { pricePerKgRupees: 280, teaUsedGrams: 30, glassesMade: 10 }
    );
    expect(cmp.direction).toBe("parity");
    expect(cmp.differencePaise).toBe(0);
  });

  it("computes pack coverage and servings per kg (T01, T24)", () => {
    expect(calculateServingsPerKg(3)).toBe(333);
    const rec = recommendPackCoverage({
      cupsPerDay: 150,
      doseGrams: 3,
      sellingDays: 30,
      availablePackGrams: [5000, 10000, 25000],
    });
    expect(rec.requiredKg).toBe(13.5);
    expect(rec.closestPacks[0].grams).toBe(10000);
    expect(rec.fullCoverageSuggestion?.totalKg).toBe(15);
    expect(rec.fullCoverageSuggestion?.summaryLabel).toBe("10 kg + 5 kg");
  });

  it("detects overslab on 25 + 5 kg + 0.6 kg tare = 30.6 kg", () => {
    const pack = computeParcelPacking({
      netGrams: 30000,
      tareGrams: 600,
      boxLengthCm: 40,
      boxWidthCm: 30,
      boxHeightCm: 30,
      dimDivisor: 5000,
      billingIncrementGrams: 1000,
      billedWeightRule: "max_gross_dim",
      maxNetGrams: 30000,
      maxBilledGrams: 30000,
    });
    expect(pack.grossGrams).toBe(30600);
    expect(pack.billedGrams).toBe(31000);
    expect(pack.exceedsSlab).toBe(true);
  });
});

describe("TeaFloww Trade quote engine, checkout & order lifecycle", () => {
  it("prices 5 kg vs 25 kg on Siliguri doorstep lane (734001)", () => {
    const q5 = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "bn",
        destinationPin: "734001",
        lines: [{ variantId: variant5Id, quantity: 1 }],
        payment: "prepaid",
      },
      "sess_1"
    );
    expect(q5.kind).toBe("confirmed");
    if (q5.kind === "confirmed") {
      expect(q5.goodsPaise).toBe(130000);
      expect(q5.freightPaise).toBe(90000);
      expect(q5.totalPaise).toBe(220000);
      expect(q5.handover.kind).toBe("doorstep");
    }

    const q25 = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "bn",
        destinationPin: "734001",
        lines: [{ variantId: variant25Id, quantity: 1 }],
        payment: "prepaid",
      },
      "sess_1"
    );
    expect(q25.kind).toBe("confirmed");
    if (q25.kind === "confirmed") {
      expect(q25.goodsPaise).toBe(575000);
      expect(q25.freightPaise).toBe(90000);
      expect(q25.totalPaise).toBe(665000);
      expect(q25.dueNowPaise + q25.dueLaterPaise).toBe(q25.totalPaise);
    }
  });

  it("computes freight_advance + COD fee split accurately", () => {
    const q = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "en",
        destinationPin: "734001",
        lines: [{ variantId: variant25Id, quantity: 1 }],
        payment: "freight_advance",
      },
      "sess_1"
    );
    expect(q.kind).toBe("confirmed");
    if (q.kind === "confirmed") {
      expect(q.freightPaise).toBe(99000);
      expect(q.totalPaise).toBe(674000);
      expect(q.dueNowPaise).toBe(99000);
      expect(q.dueLaterPaise).toBe(575000);
    }
  });

  it("returns depot handover and unavailable COD for Kolkata (700001)", () => {
    const qDepot = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "en",
        destinationPin: "700001",
        lines: [{ variantId: variant25Id, quantity: 1 }],
        payment: "prepaid",
      },
      "sess_1"
    );
    expect(qDepot.kind).toBe("confirmed");
    if (qDepot.kind === "confirmed") {
      expect(qDepot.handover.kind).toBe("depot");
      if (qDepot.handover.kind === "depot") {
        expect(qDepot.handover.onwardIncluded).toBe(false);
      }
    }

    const qCod = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "en",
        destinationPin: "700001",
        lines: [{ variantId: variant25Id, quantity: 1 }],
        payment: "cod",
      },
      "sess_1"
    );
    expect(qCod.kind).toBe("unavailable");
    if (qCod.kind === "unavailable") {
      expect(qCod.alternatives).toContain("prepaid");
      expect(qCod.alternatives).toContain("pickup");
    }
  });

  it("returns manual quote for overslab (25 + 5 kg) and unmapped PIN", () => {
    const over = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "en",
        destinationPin: "734001",
        lines: [
          { variantId: variant25Id, quantity: 1 },
          { variantId: variant5Id, quantity: 1 },
        ],
        payment: "prepaid",
      },
      "sess_1"
    );
    expect(over.kind).toBe("manual");
    if (over.kind === "manual") {
      expect(over.reason).toBe("overslab");
    }

    const unmapped = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "hi",
        destinationPin: "560001",
        lines: [{ variantId: variant5Id, quantity: 1 }],
        payment: "prepaid",
      },
      "sess_1"
    );
    expect(unmapped.kind).toBe("manual");
    if (unmapped.kind === "manual") {
      expect(unmapped.reason).toBe("unmapped_pin");
    }
  });

  it("enforces session ownership, stock decrement, idempotency & authorized order link", () => {
    const q = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "en",
        destinationPin: "734001",
        lines: [{ variantId: variant5Id, quantity: 2 }],
        payment: "prepaid",
      },
      "sess_owner"
    );
    expect(q.kind).toBe("confirmed");
    if (q.kind !== "confirmed") return;

    expect(() => getTradeQuoteForSession(q.id, "other_sess")).toThrow();

    expect(() =>
      createTradeOrderFromQuote(
        {
          quoteId: q.id,
          idempotencyKey: "idem_bad_sess",
          customerName: "Raju Tea Stall",
          customerPhone: "+919800000001",
          shippingAddress: "Hill Cart Road",
          paymentMode: "prepaid",
        },
        "other_sess"
      )
    ).toThrow(TradeCheckoutError);

    const order1 = createTradeOrderFromQuote(
      {
        quoteId: q.id,
        idempotencyKey: "idem_order_1",
        customerName: "Raju Tea Stall",
        customerPhone: "+919800000001",
        shippingAddress: "Hill Cart Road",
        paymentMode: "prepaid",
      },
      "sess_owner"
    );
    expect(order1.deduped).toBe(false);
    expect(order1.totalPaise).toBe(350000); // 2 * 130000 + 90000

    // Idempotent retry returns same order
    const orderDup = createTradeOrderFromQuote(
      {
        quoteId: q.id,
        idempotencyKey: "idem_order_1",
        customerName: "Raju Tea Stall",
        customerPhone: "+919800000001",
        shippingAddress: "Hill Cart Road",
        paymentMode: "prepaid",
      },
      "sess_owner"
    );
    expect(orderDup.deduped).toBe(true);
    expect(orderDup.orderId).toBe(order1.orderId);

    // Stock decremented from 20 to 18
    const vRow = db
      .prepare("SELECT stock FROM variants WHERE id = ?")
      .get(variant5Id) as { stock: number };
    expect(vRow.stock).toBe(18);

    // Authorized order retrieval works with token and fails without it
    const fetched = getAuthorizedTradeOrder(order1.orderId, order1.accessToken);
    expect(fetched?.orderId).toBe(order1.orderId);
    expect(() => getAuthorizedTradeOrder(order1.orderId, "wrong_token")).toThrow(
      TradeCheckoutError
    );

    const rem = saveReorderReminder({
      orderId: order1.orderId,
      accessToken: order1.accessToken,
      contactPhone: "+919800000001",
      locale: "bn",
      cadenceDays: 15,
      optedIn: true,
    }) as { opted_in: number };
    expect(rem.opted_in).toBe(1);
  });
});

describe("100% Trade data updates via Admin/API & MCP", () => {
  it("updates settings, offers, lanes, localized content, enquiries, pilots & orders via MCP", () => {
    // 1. Settings
    const updatedSettings = dispatchToolCall("trade.updateSettings", {
      whatsapp_number: "+917001304854",
      support_hours: "Mon-Sat 8 AM - 8 PM",
    }) as { settings: { whatsapp_number: string } };
    expect(updatedSettings.settings.whatsapp_number).toBe("+917001304854");
    expect(getTradeSettings().whatsapp_number).toBe("+917001304854");

    // 2. Offers
    upsertTradeOffer({ product_id: productId, featured_order: 2, published: true });
    expect(listPublicTradeProducts().length).toBeGreaterThanOrEqual(1);

    // 3. Versioned Lanes & toggle
    const newLane = dispatchToolCall("trade.upsertLane", {
      lane_code: "PATNA-DEPOT",
      pin_start: "800001",
      pin_end: "800099",
      service_code: "transport_depot",
      service_label: "Patna Depot",
      handover_kind: "depot",
      locality_label: "Patna",
      depot_name: "Patna Junction Depot",
      depot_address: "Station Road, Patna 800001",
      base_freight_paise: 120000,
    }) as { lane: { id: string; version: number } };
    expect(newLane.lane.version).toBe(1);

    const preview = dispatchToolCall("trade.previewQuote", {
      locale: "hi",
      destinationPin: "800001",
      quoteType: "bulk",
      lines: [{ variantId: variant25Id, quantity: 1 }],
      payment: "prepaid",
    }) as { kind: string; totalPaise?: number };
    expect(preview.kind).toBe("confirmed");
    expect(preview.totalPaise).toBe(695000);

    dispatchToolCall("trade.toggleLane", { id: newLane.lane.id, is_active: false });
    const pausedPreview = dispatchToolCall("trade.previewQuote", {
      locale: "hi",
      destinationPin: "800001",
      quoteType: "bulk",
      lines: [{ variantId: variant25Id, quantity: 1 }],
      payment: "prepaid",
    }) as { kind: string };
    expect(pausedPreview.kind).toBe("manual");

    // 4. Localised content override reflected in dictionary
    dispatchToolCall("trade.upsertContent", {
      resource_key: "hero.kicker",
      locale: "bn",
      text_value: "শিলিগুড়ি · চায়ের দোকানের জন্য",
      review_status: "reviewed",
    });
    expect(getTradeDictionary("bn")["hero.kicker"]).toBe(
      "শিলিগুড়ি · চায়ের দোকানের জন্য"
    );

    // 5. Enquiries & conversion to expiring quote
    const enq = createTradeEnquiry(
      {
        idempotencyKey: "enq_mcp_test_1",
        locale: "hi",
        destinationPin: "560001",
        enquiryType: "bulk",
        contactPhone: "+919900000001",
        consentGiven: true,
      },
      "sess_enq"
    );
    const converted = dispatchToolCall("trade.convertEnquiryToQuote", {
      enquiryId: (enq.enquiry as { id: string }).id,
      assignedOwner: "Ops Lead",
      quoteRequest: {
        quoteType: "bulk",
        locale: "hi",
        destinationPin: "734001",
        lines: [{ variantId: variant5Id, quantity: 1 }],
        payment: "prepaid",
      },
    }) as { ok: boolean; quote: { id: string } };
    expect(converted.ok).toBe(true);
    expect(converted.quote.id).toMatch(/^tq_/);

    // 6. Shared Pilots
    const pilot = dispatchToolCall("trade.upsertPilot", {
      town_name: "Jalpaiguri",
      pin_prefix: "735",
      collection_point: "Kadamtala Stand",
      collection_address: "Main Road, Jalpaiguri",
      cutoff_at: "2026-12-10T18:00:00Z",
      dispatch_partner: "Dooars Carrier",
      dispatch_schedule: "Every Friday",
      target_kg: 150,
    }) as { pilot: { id: string } };
    const interest = registerSharedPilotInterest({
      pilotId: pilot.pilot.id,
      contactName: "Suman",
      contactPhone: "+919800000099",
      requestedKg: 25,
      locale: "bn",
    });
    expect(interest).toBeTruthy();

    // Restore settings
    updateTradeSettings({ whatsapp_number: "+917001304853" });
    upsertTradeLane({
      lane_code: "PATNA-DEPOT",
      pin_start: "800001",
      pin_end: "800099",
      service_code: "transport_depot",
      service_label: "Patna Depot",
      handover_kind: "depot",
      is_active: false,
    });
  });

  it("applies one-use trial credit on qualifying bulk order and blocks double redemption (T25)", () => {
    updateTradeSettings({
      trial_credit_paise: 20000,
      trial_credit_min_qty_kg: 25,
      trial_credit_expiry_days: 30,
    });

    // Insert a synthetic prior trial order
    const trialQuoteId = "tq_trial_credit_test";
    const trialOrderId = "TRD-TRIAL-CR-1";
    db.prepare(`
      INSERT INTO trade_quotes (
        id, channel, session_id, locale, kind, quote_type, input_hash,
        destination_pin, payment_method, lines_json, net_grams, billed_grams,
        goods_paise, freight_paise, total_paise, due_now_paise, due_later_paise, expires_at
      ) VALUES (?, 'trade', 'sess_trial', 'bn', 'confirmed', 'trial', 'hash1',
        '734001', 'prepaid', '[]', 200, 500, 20000, 0, 20000, 20000, 0, '2099-01-01T00:00:00Z')
    `).run(trialQuoteId);
    db.prepare(`
      INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status)
      VALUES (?, ?, 'Trial Shop', 't@shop.in', 'Siliguri', 20000, 0, 20000, 'paid')
    `).run(trialOrderId, "idem_trial_cr_1");
    db.prepare(`
      INSERT INTO trade_orders (
        id, order_id, quote_id, access_token, locale, destination_pin,
        payment_mode, handover_json, goods_paise, freight_paise,
        extra_tax_paise, other_fees_paise, credit_paise, total_paise,
        due_now_paise, due_later_paise, remittance_status
      ) VALUES (?, ?, ?, 'tok_trial_1', 'bn', '734001', 'prepaid', '{"kind":"doorstep","locality":"Siliguri"}',
        20000, 0, 0, 0, 0, 20000, 20000, 0, 'none')
    `).run("to_trial_cr_1", trialOrderId, trialQuoteId);

    // 5 kg does not meet 25 kg minimum -> creditPaise = 0
    const qSmall = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "bn",
        destinationPin: "734001",
        lines: [{ variantId: variant5Id, quantity: 1 }],
        payment: "prepaid",
        trialOrderId,
      },
      "sess_cr"
    );
    expect(qSmall.kind).toBe("confirmed");
    if (qSmall.kind === "confirmed") {
      expect(qSmall.creditPaise).toBe(0);
    }

    // 25 kg meets minimum -> creditPaise = 20000
    const q25a = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "bn",
        destinationPin: "734001",
        lines: [{ variantId: variant25Id, quantity: 1 }],
        payment: "prepaid",
        trialOrderId,
      },
      "sess_cr"
    );
    const q25b = createTradeQuote(
      {
        channel: "trade",
        quoteType: "bulk",
        locale: "bn",
        destinationPin: "734001",
        lines: [{ variantId: variant25Id, quantity: 1 }],
        payment: "prepaid",
        trialOrderId,
      },
      "sess_cr"
    );
    expect(q25a.kind).toBe("confirmed");
    expect(q25b.kind).toBe("confirmed");
    if (q25a.kind === "confirmed" && q25b.kind === "confirmed") {
      expect(q25a.creditPaise).toBe(20000);
      expect(q25a.totalPaise).toBe(645000); // 575000 + 90000 - 20000

      // First checkout succeeds
      const ord1 = createTradeOrderFromQuote(
        {
          quoteId: q25a.id,
          idempotencyKey: "idem_cr_redeem_1",
          customerName: "Credit Shop",
          customerPhone: "+919800000002",
          shippingAddress: "Hill Cart Road",
          paymentMode: "prepaid",
        },
        "sess_cr"
      );
      expect(ord1.totalPaise).toBe(645000);

      // Second checkout with the pre-created q25b quote MUST be blocked!
      expect(() =>
        createTradeOrderFromQuote(
          {
            quoteId: q25b.id,
            idempotencyKey: "idem_cr_redeem_2",
            customerName: "Credit Shop",
            customerPhone: "+919800000002",
            shippingAddress: "Hill Cart Road",
            paymentMode: "prepaid",
          },
          "sess_cr"
        )
      ).toThrow(/already been redeemed/i);
    }

    updateTradeSettings({ trial_credit_paise: 0 });
  });

  it("persists UTM attribution and ctaSource on trade enquiries and enables all 8 locales", () => {
    for (const loc of ["en", "hi", "bn", "pa", "mr", "gu", "ta", "te"] as const) {
      const d = getTradeDictionary(loc);
      expect(d["hero.ctaTrial"]).toBeTruthy();
      expect(d["hero.ctaBulk"]).toBeTruthy();
      expect(d["enquiry.whatsappOpen"]).toBeTruthy();
    }

    const res = createTradeEnquiry(
      {
        idempotencyKey: "enq_utm_test_001",
        locale: "pa",
        destinationPin: "141001",
        enquiryType: "bulk",
        contactName: "Ludhiana Tea Point",
        contactPhone: "+919876501234",
        consentGiven: true,
        ctaSource: "hero_enquiry",
        whatsappDraft: "Need 25 kg Everyday Strong Milk Chai",
        attribution: {
          sessionId: "sess_utm_1",
          funnelName: "trade_tea_shops",
          firstTouch: {
            utm_source: "meta",
            utm_medium: "paid_social",
            utm_campaign: "chai_punjab_nov",
            utm_term: "bulk_ctc_tea",
            utm_content: "video_a",
            fbclid: "fb.1.999",
            landing_page: "/tea-shops/pa?utm_source=meta",
          },
          lastTouch: {
            utm_source: "meta",
            utm_medium: "paid_social",
            utm_campaign: "chai_punjab_nov",
            utm_term: "bulk_ctc_tea",
            utm_content: "video_a",
            fbclid: "fb.1.999",
            landing_page: "/tea-shops/pa?utm_source=meta",
          },
        },
      },
      "sess_utm_1"
    );

    const saved = res.enquiry as Record<string, unknown>;
    expect(saved.id).toMatch(/^ENQ-/);
    expect(saved.utm_source).toBe("meta");
    expect(saved.utm_medium).toBe("paid_social");
    expect(saved.utm_campaign).toBe("chai_punjab_nov");
    expect(saved.utm_term).toBe("bulk_ctc_tea");
    expect(saved.cta_source).toBe("hero_enquiry");
    expect(res.whatsappUrl).toContain("https://wa.me/");
    expect(decodeURIComponent(res.whatsappUrl)).toContain(String(saved.id));
    expect(decodeURIComponent(res.whatsappUrl)).toContain("141001");
  });
});
