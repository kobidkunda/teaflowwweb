import { z } from "zod";
import { getDb } from "@/lib/db";
import { liveOrder } from "@/lib/international/orders";
import { shipment } from "@/lib/international/fulfillment";
import { bookingPayload } from "@/lib/international/providers";
import { enqueue, audit } from "@/lib/international/store";
import type { Quote } from "@/lib/international/models";
import { getActiveShiprocketCredentials, type ShippingSettings } from "@/lib/shippingSettings";

const SHIPROCKET_ORIGIN = "https://apiv2.shiprocket.in/v1/external";

export type ShiprocketCredentials = {
  mode: "test" | "production";
  orderCreationMode: "manual" | "auto";
  email: string;
  password: string;
  pickupLocation: string;
  pickupPostcode: string;
  defaultLength: number;
  defaultBreadth: number;
  defaultHeight: number;
  defaultTareGrams: number;
  defaultHsn: string;
};

export function getShiprocketConfig(): ShiprocketCredentials {
  return getActiveShiprocketCredentials();
}

export function isMockMode(config?: ShiprocketCredentials): boolean {
  const c = config || getShiprocketConfig();
  if (process.env.COMMERCE_MOCK_PROVIDERS === "1") return true;
  if (c.mode === "test") {
    if (!c.email || !c.password || c.email.includes("mock") || c.email.includes("test")) return true;
  }
  return false;
}

let cachedToken: { value: string; until: number } | undefined;

export async function getShiprocketToken(forceRefresh = false): Promise<string> {
  const config = getShiprocketConfig();

  if (isMockMode(config)) {
    return "mock_shiprocket_token_test";
  }

  if (!config.email || !config.password) {
    throw new Error("Shiprocket credentials are not configured. Please set them in Shipping Settings.");
  }

  if (!forceRefresh && cachedToken && cachedToken.until > Date.now()) {
    return cachedToken.value;
  }

  const res = await fetch(`${SHIPROCKET_ORIGIN}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message || "Shiprocket authentication failed. Please check your credentials.");
  }

  const data = (await res.json()) as { token: string };
  cachedToken = { value: data.token, until: Date.now() + 12 * 3600000 };
  return data.token;
}

export async function testShiprocketConnection(email?: string, password?: string): Promise<{ success: boolean; message: string }> {
  const config = getShiprocketConfig();
  const targetEmail = email || config.email;
  const targetPassword = password || config.password;

  if (!targetEmail || !targetPassword) {
    return { success: false, message: "Please provide both Shiprocket email and password." };
  }

  if (isMockMode(config) || (config.mode === "test" && (targetEmail.includes("test") || targetEmail.includes("mock")))) {
    return { success: true, message: `Connected to Shiprocket (${config.mode === "test" ? "Test Sandbox Mode" : "Mock Mode"} verified).` };
  }

  try {
    const res = await fetch(`${SHIPROCKET_ORIGIN}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      return { success: false, message: errorBody?.message || "Invalid credentials or unauthorized." };
    }

    const data = (await res.json()) as { token: string };
    if (data.token) {
      cachedToken = { value: data.token, until: Date.now() + 12 * 3600000 };
      return { success: true, message: "Successfully connected to Shiprocket API!" };
    }
    return { success: false, message: "No authentication token returned by Shiprocket." };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : "Connection failed." };
  }
}

export async function shiprocketFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getShiprocketToken();
  const res = await fetch(`${SHIPROCKET_ORIGIN}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `Shiprocket API error: ${res.statusText}`);
  }

  return res.json();
}

export async function checkPincodeServiceability(
  deliveryPincode: string,
  weightKg = 0.5,
  cod = false
): Promise<{ serviceable: boolean; couriers: Array<{ id: number; name: string; rate: number; cod: boolean; etd: string }> }> {
  const config = getShiprocketConfig();
  if (isMockMode(config)) {
    return {
      serviceable: true,
      couriers: [
        { id: 10, name: "Delhivery Air", rate: 75, cod: true, etd: "2-3 days" },
        { id: 12, name: "BlueDart Express", rate: 95, cod: true, etd: "1-2 days" },
        { id: 14, name: "DTDC Priority", rate: 70, cod: false, etd: "3-4 days" },
      ],
    };
  }

  const query = new URLSearchParams({
    pickup_postcode: config.pickupPostcode,
    delivery_postcode: deliveryPincode,
    weight: String(weightKg),
    cod: cod ? "1" : "0",
  });

  const raw = (await shiprocketFetch(`courier/serviceability/?${query}`)) as {
    data?: {
      available_courier_companies?: Array<{
        courier_company_id: number;
        courier_name: string;
        rate: number;
        cod: number | boolean;
        etd?: string;
      }>;
    };
  };

  const companies = raw?.data?.available_courier_companies || [];
  return {
    serviceable: companies.length > 0,
    couriers: companies.map((c) => ({
      id: c.courier_company_id,
      name: c.courier_name,
      rate: Number(c.rate),
      cod: Boolean(c.cod),
      etd: c.etd || "2-4 days",
    })),
  };
}

export type PreparedShipmentDetails = {
  orderId: string;
  shiprocketOrderId: number | string;
  shipmentId: number | string;
  courierId?: string | number;
  courierName?: string;
  awbCode?: string;
  labelUrl?: string;
  pickupToken?: string;
  pickupDate?: string;
  status: string;
  publicTracking?: {
    code: string;
    status: string;
  };
};

export async function generateShippingLabel(shipmentId: number): Promise<{ label_created: number; label_url: string }> {
  if (isMockMode()) {
    return {
      label_created: 1,
      label_url: `https://kr-shipmultichannel.s3.ap-southeast-1.amazonaws.com/labels/${shipmentId}_mock_label.pdf`,
    };
  }
  const res = (await shiprocketFetch("courier/generate/label", {
    method: "POST",
    body: JSON.stringify({ shipment_id: [shipmentId] }),
  })) as { label_created?: number; label_url?: string };
  return {
    label_created: res.label_created || 1,
    label_url: res.label_url || "",
  };
}

export async function requestCourierPickup(shipmentId: number): Promise<{ pickup_status: number; pickup_token_number?: string; pickup_scheduled_date?: string }> {
  if (isMockMode()) {
    return {
      pickup_status: 1,
      pickup_token_number: `PU-${Math.floor(100000 + Math.random() * 900000)}`,
      pickup_scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    };
  }
  const res = (await shiprocketFetch("courier/generate/pickup", {
    method: "POST",
    body: JSON.stringify({ shipment_id: [shipmentId] }),
  })) as {
    pickup_status?: number;
    response?: { pickup_token_number?: string; pickup_scheduled_date?: string };
  };
  return {
    pickup_status: res.pickup_status || 1,
    pickup_token_number: res.response?.pickup_token_number,
    pickup_scheduled_date: res.response?.pickup_scheduled_date,
  };
}

export async function trackShipment(shipmentId: number | string): Promise<{ awb?: string; status?: string; raw?: unknown }> {
  if (isMockMode()) {
    return {
      awb: "AWB9876543210",
      status: "In Transit",
      raw: { tracking_data: { shipment_status: 6 } },
    };
  }
  const res = await shiprocketFetch(`courier/track/shipment/${shipmentId}`);
  return { status: "Active", raw: res };
}

/**
 * 1-Click Master Preparation:
 * 1. Creates order in Shiprocket -> order_id, shipment_id
 * 2. Assigns Courier & AWB -> awb_code, courier_name
 * 3. Generates Official Printable Shipping Label -> label_url (PDF)
 * 4. Schedules Courier Pickup -> pickup_token_number, pickup_scheduled_date
 * 5. Saves state, updates dispatch status, and enqueues customer tracking notification
 */
export async function prepareFullShiprocketShipment(
  orderId: string,
  actor = "admin"
): Promise<PreparedShipmentDetails> {
  const db = getDb();

  // 1. Identify order (either from commerce_orders or legacy orders)
  let quote: Quote | null = null;
  let orderPaymentStatus = "paid";
  const existingShipment = shipment(orderId);

  try {
    const live = liveOrder(orderId);
    quote = JSON.parse(live.document) as Quote;
    orderPaymentStatus = live.payment_status;
  } catch {
    // Check in legacy orders table
    const legacy = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId) as Record<string, unknown> | undefined;
    if (!legacy) throw new Error("Order not found.");
    orderPaymentStatus = String(legacy.payment_status || "unpaid");

    const items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(orderId) as Array<{
      variant_id: number;
      quantity: number;
      unit_price_paise: number;
      sku?: string;
    }>;

    const config = getShiprocketConfig();
    const addressRaw = String(legacy.shipping_address || "");
    const parts = addressRaw.split(",").map((s) => s.trim());
    const line1 = parts[0] || "Address line 1";
    const city = parts[1] || "City";
    const state = parts[2] || "State";
    const postcode = parts[parts.length - 1]?.match(/\d{6}/)?.[0] || "734001";

    quote = {
      id: orderId,
      owner: "legacy",
      fingerprint: "legacy",
      input: {
        address: {
          name: String(legacy.customer_name || "Customer"),
          email: String(legacy.customer_email || "customer@example.com"),
          phone: "9876543210",
          line1,
          line2: "",
          city,
          state,
          postcode,
          country: "IN",
        },
        currency: "INR",
        locale: "en",
        method: legacy.payment_status === "cod" ? "cod" : "prepaid",
        coupon: String(legacy.coupon_code || ""),
        items: items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })),
      },
      lines: items.map((i) => ({
        variantId: i.variant_id,
        quantity: i.quantity,
        pricePaise: i.unit_price_paise,
        grams: 100,
        sku: i.sku || `SKU-${i.variant_id}`,
        name: `Tea Item #${i.variant_id}`,
      })),
      marketVersion: 1,
      currency: "INR",
      rate: "1",
      rateId: null,
      expires: Date.now() + 86400000,
      created: Date.now(),
      carrier: "shiprocket",
      carrierCostPaise: Number(legacy.shipping_paise || 0),
      dutiesPaise: 0,
      subtotalPaise: Number(legacy.subtotal_paise || 0),
      discountPaise: Number(legacy.discount_paise || 0),
      shippingPaise: Number(legacy.shipping_paise || 0),
      taxPaise: 0,
      totalPaise: Number(legacy.total_paise || 0),
      components: {
        merchandise: Number(legacy.subtotal_paise || 0),
        shipping: Number(legacy.shipping_paise || 0),
        duties: 0,
        tax: 0,
        cod: 0,
      },
      totalMinor: Number(legacy.total_paise || 0),
      package: {
        pickupPostcode: config.pickupPostcode,
        pickupLocation: config.pickupLocation,
        length: config.defaultLength,
        breadth: config.defaultBreadth,
        height: config.defaultHeight,
        tareGrams: config.defaultTareGrams,
        maxGrams: 5000,
        hsn: config.defaultHsn,
        origin: "IN",
      },
    };

    try {
      db.prepare(`
        INSERT INTO commerce_quotes (id, owner, document, expires_ms)
        VALUES (?, 'legacy', ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(orderId, JSON.stringify(quote), Date.now() + 86400000);

      db.prepare(`
        INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, created_ms)
        VALUES (?, 'legacy', ?, ?, ?, ?, 'unfulfilled', 0, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(orderId, String(legacy.idempotency_key || orderId), orderId, JSON.stringify(quote), orderPaymentStatus, Date.now());
    } catch {
      // Ignore if already present
    }
  }

  if (quote?.subscription) {
    // Subscription preparation uses the shared cycle claims and handover semantics.
    const { bookShipment, shipmentAction } = await import("./international/fulfillment");
    await bookShipment(orderId, actor);
    await shipmentAction(orderId, "awb", actor);
    await shipmentAction(orderId, "label", actor);
    await shipmentAction(orderId, "pickup", actor);
    const data = JSON.parse(shipment(orderId)!.document);
    return { orderId, shiprocketOrderId: data.order_id, shipmentId: data.shipment_id, courierId: data.courierId, courierName: data.awb?.response?.data?.courier_name, awbCode: data.awb?.response?.data?.awb_code, labelUrl: data.label?.label_url, pickupDate: data.pickup?.response?.pickup_scheduled_date, status: data.status || (data.label?.label_url ? "Ready to Print & Dispatch" : "Booked & AWB Assigned") };
  }

  if (
    !["paid", "partially_refunded", "cod_due", "cod_collected", "cod_remitted"].includes(
      orderPaymentStatus
    )
  ) {
    throw new Error(
      `Order cannot be dispatched: Payment status is '${orderPaymentStatus}'. Only paid or approved COD orders can be prepared in Shiprocket.`
    );
  }

  let docData: Record<string, unknown> = {};
  if (existingShipment?.document && existingShipment.document !== "{}") {
    try {
      docData = JSON.parse(existingShipment.document);
    } catch {
      docData = {};
    }
  }

  const isMock = isMockMode();

  // Stage 1: Order Creation in Shiprocket
  let shiprocketOrderId = docData.order_id as number | string | undefined;
  let shipmentId = docData.shipment_id as number | string | undefined;

  if (!shiprocketOrderId || !shipmentId) {
    if (isMock) {
      shiprocketOrderId = Math.floor(1000000 + Math.random() * 9000000);
      shipmentId = Math.floor(7000000 + Math.random() * 9000000);
      docData.order_id = shiprocketOrderId;
      docData.shipment_id = shipmentId;
      docData.courierId = "10";
    } else {
      const payload = bookingPayload(orderId, quote);
      const res = (await shiprocketFetch("orders/create/adhoc", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as { order_id?: number | string; shipment_id?: number | string };

      if (!res.order_id || !res.shipment_id) {
        throw new Error("Shiprocket did not return order or shipment ID.");
      }
      shiprocketOrderId = res.order_id;
      shipmentId = res.shipment_id;
      docData.order_id = shiprocketOrderId;
      docData.shipment_id = shipmentId;
      docData.courierId = quote.carrier || "10";
    }
  }

  // Stage 2: Courier & AWB Assignment
  let awbCode = (docData.awb as Record<string, unknown> | undefined)?.awb_code as string | undefined;
  let courierName = (docData.awb as Record<string, unknown> | undefined)?.courier_name as string | undefined;

  if (!awbCode) {
    if (isMock) {
      awbCode = `AWB${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      courierName = "Delhivery Surface";
      docData.awb = {
        awb_code: awbCode,
        courier_name: courierName,
        courier_company_id: 10,
        shipment_id: shipmentId,
      };
    } else {
      try {
        const awbRes = (await shiprocketFetch("courier/assign/awb", {
          method: "POST",
          body: JSON.stringify({
            shipment_id: shipmentId,
            courier_id: docData.courierId,
          }),
        })) as {
          response?: {
            data?: {
              awb_code?: string;
              courier_name?: string;
              courier_company_id?: number;
            };
          };
        };

        const awbData = awbRes?.response?.data;
        if (awbData?.awb_code) {
          awbCode = awbData.awb_code;
          courierName = awbData.courier_name || "Delhivery";
          docData.awb = awbData;
        }
      } catch {
        // Fallback if already assigned
      }
    }
  }

  // Stage 3: Official Carrier Shipping Label Generation (Printable PDF URL)
  let labelUrl = (docData.label as Record<string, unknown> | undefined)?.label_url as string | undefined;

  if (!labelUrl) {
    if (isMock) {
      labelUrl = `https://kr-shipmultichannel.s3.ap-southeast-1.amazonaws.com/labels/${shipmentId}_mock_label.pdf`;
      docData.label = { label_created: 1, label_url: labelUrl };
    } else {
      try {
        const labelRes = (await shiprocketFetch("courier/generate/label", {
          method: "POST",
          body: JSON.stringify({ shipment_id: [shipmentId] }),
        })) as { label_created?: number; label_url?: string };

        if (labelRes?.label_url) {
          labelUrl = labelRes.label_url;
          docData.label = labelRes;
        }
      } catch {
        // Continue if label generation is pending or delayed
      }
    }
  }

  // Stage 4: Courier Pickup Scheduling
  let pickupToken = (docData.pickup as Record<string, unknown> | undefined)?.pickup_token_number as string | undefined;
  let pickupDate = (docData.pickup as Record<string, unknown> | undefined)?.pickup_scheduled_date as string | undefined;

  if (!pickupToken) {
    if (isMock) {
      pickupToken = `PU-${Math.floor(100000 + Math.random() * 900000)}`;
      pickupDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      docData.pickup = {
        pickup_status: 1,
        pickup_token_number: pickupToken,
        pickup_scheduled_date: pickupDate,
      };
    } else {
      try {
        const pickupRes = (await shiprocketFetch("courier/generate/pickup", {
          method: "POST",
          body: JSON.stringify({ shipment_id: [shipmentId] }),
        })) as {
          pickup_status?: number;
          response?: { pickup_token_number?: string; pickup_scheduled_date?: string };
        };

        if (pickupRes?.response?.pickup_token_number) {
          pickupToken = pickupRes.response.pickup_token_number;
          pickupDate = pickupRes.response.pickup_scheduled_date;
          docData.pickup = pickupRes.response;
        }
      } catch {
        // Pickup scheduling may be subject to carrier business hours
      }
    }
  }

  // Projection for customer tracking
  if (awbCode) {
    docData.publicTracking = {
      code: awbCode,
      status: "Dispatched · In Transit",
    };
  }

  // 5. Persist to commerce_shipments
  const now = Date.now();
  db.prepare(`
    INSERT INTO commerce_shipments (order_id, document, status, updated_ms)
    VALUES (?, ?, 'booked', ?)
    ON CONFLICT(order_id) DO UPDATE SET
      document = excluded.document,
      status = 'booked',
      updated_ms = excluded.updated_ms
  `).run(orderId, JSON.stringify(docData), now);

  // Update order dispatch status in commerce_orders if present
  try {
    db.prepare("UPDATE commerce_orders SET fulfillment_status='dispatched' WHERE id=?").run(orderId);
  } catch {}

  // Update legacy orders table if present
  try {
    db.prepare("UPDATE orders SET dispatch_status='shipped' WHERE id=?").run(orderId);
  } catch {}

  // Audit record
  audit(actor, "shipment.full_preparation", {
    orderId,
    shiprocketOrderId,
    shipmentId,
    awbCode,
    labelUrl,
    courierName,
  });

  // Enqueue dispatch email notification to customer
  enqueue("email", { orderId, template: "order_shipped" }, `email:shipped:${orderId}`);

  return {
    orderId,
    shiprocketOrderId: shiprocketOrderId!,
    shipmentId: shipmentId!,
    courierId: docData.courierId as string | number,
    courierName,
    awbCode,
    labelUrl,
    pickupToken,
    pickupDate,
    status: labelUrl ? "Ready to Print & Dispatch" : "Booked & AWB Assigned",
    publicTracking: docData.publicTracking as { code: string; status: string } | undefined,
  };
}
