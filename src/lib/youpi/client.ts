import crypto from "node:crypto";

export interface YoupiClientOptions {
  apiUrl?: string;
  checkoutUrl?: string;
  adminUrl?: string;
  merchantId?: string;
  apiKey?: string;
  webhookSecret?: string;
  timeoutMs?: number;
}

export interface CreatePaymentParams {
  orderId: string;
  amount: string | number; // in Rupees (e.g. "499.00") or numeric rupees
  currency?: string;
  returnUrl?: string;
  customer?: {
    name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
  };
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  autoActivate?: boolean;
}

export interface PaymentSessionResponse {
  paymentId: string;
  orderId: string;
  amount: string;
  amountPaise: string;
  currency: string;
  status: string;
  checkoutUrl: string;
  queuePosition?: number;
  activeSessionDetected?: boolean;
}

export interface PaymentDetailsResponse {
  paymentId: string;
  orderId: string;
  amount: string;
  amountPaise: string;
  currency: string;
  status: "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED" | "ACTIVE" | "INITIATED" | string;
  method?: string;
  completedAt?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface YoupiWebhookEvent {
  event: "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED" | string;
  deliveryId: string;
  timestamp: number;
  paymentId: string;
  orderId: string;
  attemptId?: string;
  amount: string;
  amountPaise: number;
  currency: string;
  method?: string;
  utr?: string;
  verificationTag?: string;
  verificationLevel?: number;
  completedAt?: string;
  metadata?: Record<string, unknown>;
  settlementState?: string;
}

export class YoupiPaymentClient {
  public readonly apiUrl: string;
  public readonly checkoutUrl: string;
  public readonly adminUrl: string;
  public readonly merchantId: string;
  public readonly apiKey: string;
  public readonly webhookSecret: string;
  public readonly timeoutMs: number;

  constructor(options: YoupiClientOptions = {}) {
    const rawApiUrl =
      options.apiUrl ||
      process.env.YOUPI_API_URL ||
      process.env.BASE_PAYMENT_API_URL ||
      "https://pay-api.biolastic.co.in";
    const rawCheckoutUrl =
      options.checkoutUrl ||
      process.env.YOUPI_CHECKOUT_URL ||
      process.env.BASE_CHECKOUT_URL ||
      "https://pay.biolastic.co.in";
    const rawAdminUrl =
      options.adminUrl ||
      process.env.YOUPI_ADMIN_URL ||
      process.env.BASE_ADMIN_URL ||
      "https://pay-admin.biolastic.co.in";

    this.apiUrl = rawApiUrl.replace(/\/+$/, "");
    this.checkoutUrl = rawCheckoutUrl.replace(/\/+$/, "");
    this.adminUrl = rawAdminUrl.replace(/\/+$/, "");
    this.merchantId =
      options.merchantId ||
      process.env.YOUPI_MERCHANT_ID ||
      "00000000-0000-0000-0000-000000000001";
    this.apiKey =
      options.apiKey ||
      process.env.YOUPI_API_TOKEN ||
      process.env.ADMIN_API_TOKEN ||
      "";
    this.webhookSecret =
      options.webhookSecret ||
      process.env.YOUPI_WEBHOOK_SECRET ||
      "";
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return res;
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        throw new Error(`YouPI request timed out after ${this.timeoutMs}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Health check on YouPI Payment API
   */
  async checkHealth(): Promise<{ status: string; service: string; timestamp: string }> {
    const url = `${this.apiUrl}/api/v1/health`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Health check failed [HTTP ${res.status}]: ${text}`);
    }
    return (await res.json()) as { status: string; service: string; timestamp: string };
  }

  /**
   * Admin credentials check on YouPI Payment API
   */
  async checkAdminSettings(): Promise<Record<string, unknown>> {
    const url = `${this.apiUrl}/api/v1/admin/merchant-settings`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      headers["X-Admin-Token"] = this.apiKey;
    }
    const res = await this.fetchWithTimeout(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Admin check failed [HTTP ${res.status}]: ${text}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Create a new payment session on YouPI gateway
   */
  async createPaymentSession(params: CreatePaymentParams): Promise<PaymentSessionResponse> {
    const url = `${this.apiUrl}/api/v1/payments`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Merchant-Id": this.merchantId,
    };

    if (this.apiKey) {
      headers["X-Merchant-Key"] = this.apiKey;
    }
    if (params.idempotencyKey) {
      headers["Idempotency-Key"] = params.idempotencyKey;
    }

    // Format amount: Ensure it is a string representation of Rupees (e.g. "250.00")
    const formattedAmount =
      typeof params.amount === "number"
        ? params.amount.toFixed(2)
        : String(params.amount);

    const customerObj = params.customer
      ? {
          phoneNumber: params.customer.phoneNumber || params.customer.phone || undefined,
          fullName: params.customer.fullName || params.customer.name || undefined,
          email: params.customer.email || undefined,
        }
      : undefined;

    const payload: Record<string, unknown> = {
      orderId: params.orderId,
      amount: formattedAmount,
      currency: (params.currency || "INR").toUpperCase(),
      returnUrl: params.returnUrl,
      customer: customerObj,
      metadata: params.metadata || {},
    };

    if (params.autoActivate) {
      payload.autoActivate = true;
    }

    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Create payment failed [HTTP ${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as PaymentSessionResponse;

    // Ensure checkoutUrl points to the configured checkout domain if returned relative
    if (data.checkoutUrl && !data.checkoutUrl.startsWith("http")) {
      data.checkoutUrl = `${this.checkoutUrl}${data.checkoutUrl.startsWith("/") ? "" : "/"}${data.checkoutUrl}`;
    }

    return data;
  }

  /**
   * Queries payment status and details by payment session ID.
   */
  async getPaymentSession(paymentId: string): Promise<PaymentDetailsResponse> {
    const url = `${this.apiUrl}/api/v1/payments/${encodeURIComponent(paymentId)}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["X-Merchant-Key"] = this.apiKey;
    }

    const res = await this.fetchWithTimeout(url, { headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Get payment failed [HTTP ${res.status}]: ${errText}`);
    }

    return (await res.json()) as PaymentDetailsResponse;
  }

  /**
   * Verifies HMAC-SHA256 signature and timestamp freshness on incoming webhooks.
   */
  verifyWebhook(
    rawPayload: string,
    signatureHeader: string | null,
    secretOverride?: string,
    options: {
      timestampHeader?: string | null;
      deliveryIdHeader?: string | null;
      toleranceMs?: number;
    } = {}
  ): YoupiWebhookEvent {
    const secret = secretOverride || this.webhookSecret || this.apiKey;
    if (!secret) {
      throw new Error("Webhook verification failed: YouPI webhookSecret is not configured.");
    }

    if (!signatureHeader) {
      throw new Error("Webhook verification failed: Missing X-Gateway-Signature header.");
    }

    // Normalize signature header: remove 'sha256=' prefix if present
    const actualSignature = signatureHeader.replace(/^sha256=/i, "").trim();

    const toleranceMs =
      Number.isFinite(options.toleranceMs) && (options.toleranceMs as number) > 0
        ? (options.toleranceMs as number)
        : 2 * 60 * 60 * 1000; // 2 hour window for retry tolerance

    // Check raw body HMAC
    const hmacRaw = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    let matches = crypto.timingSafeEqual(
      Buffer.from(hmacRaw, "hex"),
      Buffer.from(actualSignature, "hex")
    );

    // If timestamp header present and raw didn't match, test timestamp.rawPayload
    const tsHeader = options.timestampHeader;
    if (!matches && tsHeader) {
      const hmacTs = crypto
        .createHmac("sha256", secret)
        .update(`${tsHeader}.${rawPayload}`)
        .digest("hex");
      matches = crypto.timingSafeEqual(
        Buffer.from(hmacTs, "hex"),
        Buffer.from(actualSignature, "hex")
      );
    }

    if (!matches) {
      throw new Error("Webhook verification failed: Invalid HMAC-SHA256 signature.");
    }

    let parsed: YoupiWebhookEvent;
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      throw new Error("Webhook verification failed: Payload is not valid JSON.");
    }

    // Validate timestamp freshness if present in payload or header
    const timestamp = parsed.timestamp ?? (tsHeader ? Number(tsHeader) : undefined);
    if (timestamp !== undefined && Number.isFinite(Number(timestamp))) {
      const diff = Math.abs(Date.now() - Number(timestamp));
      if (diff > toleranceMs) {
        throw new Error("Webhook verification failed: Timestamp outside acceptable tolerance window.");
      }
    }

    return parsed;
  }
}
