import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { FUNNEL_STAGE_LABELS, FUNNEL_STAGE_RANK, type FunnelStage } from "./types";
import { toDbTimestamp } from "./server";

export type TouchModel = "last" | "first";
export type BreakdownDimension =
  | "campaign"
  | "source_medium"
  | "keyword"
  | "content"
  | "landing_page"
  | "funnel";

export type RemarketingSegment =
  | "abandoned_carts_unconverted"
  | "leads_unconverted"
  | "whatsapp_no_order"
  | "b2b_wholesale_prospects"
  | "all_purchasers"
  | "high_value_repeat_buyers"
  | "newsletter_non_buyers";

export type AudienceExportFormat = "meta_hashed" | "google_customer_match" | "crm_plain";

export interface FunnelAnalyticsQuery {
  period?: string;
  funnelName?: string;
  touch?: TouchModel;
  dimension?: BreakdownDimension;
  utmSource?: string;
  utmCampaign?: string;
  utmTerm?: string;
}

function cutoffForPeriod(period = "30d"): string | null {
  const DAY_MS = 24 * 3600 * 1000;
  const now = Date.now();
  if (period === "7d") return toDbTimestamp(new Date(now - 7 * DAY_MS));
  if (period === "30d") return toDbTimestamp(new Date(now - 30 * DAY_MS));
  if (period === "90d") return toDbTimestamp(new Date(now - 90 * DAY_MS));
  return null;
}

const ORDERED_FUNNEL_STAGES: FunnelStage[] = [
  "visit",
  "product_view",
  "add_to_cart",
  "lead_capture",
  "form_submit",
  "conversation",
  "cart_abandoned",
  "checkout_start",
  "payment_info",
  "order_placed",
  "order_paid",
];

function buildSessionFilter(query: FunnelAnalyticsQuery): { whereSql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const cutoff = cutoffForPeriod(query.period || "30d");
  const prefix = query.touch === "first" ? "first" : "last";

  if (cutoff) {
    clauses.push("updated_at >= ?");
    params.push(cutoff);
  }
  if (query.funnelName && query.funnelName !== "all") {
    clauses.push("funnel_name = ?");
    params.push(query.funnelName);
  }
  if (query.utmSource) {
    clauses.push(`LOWER(${prefix}_utm_source) = LOWER(?)`);
    params.push(query.utmSource.trim());
  }
  if (query.utmCampaign) {
    clauses.push(`LOWER(${prefix}_utm_campaign) = LOWER(?)`);
    params.push(query.utmCampaign.trim());
  }
  if (query.utmTerm) {
    clauses.push(`LOWER(${prefix}_utm_term) LIKE LOWER(?)`);
    params.push(`%${query.utmTerm.trim()}%`);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function getFunnelAnalytics(
  query: FunnelAnalyticsQuery = {},
  database?: InstanceType<typeof Database>
) {
  const db = database ?? getDb();
  const period = query.period || "30d";
  const touch: TouchModel = query.touch === "first" ? "first" : "last";
  const dimension: BreakdownDimension = query.dimension || "campaign";
  const prefix = touch === "first" ? "first" : "last";

  const { whereSql, params } = buildSessionFilter({ ...query, period, touch });

  // 1. Session-level funnel KPI summary
  const summaryRow = db
    .prepare(`
      SELECT
        COUNT(*) AS total_sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.product_view} THEN 1 ELSE 0 END) AS product_view_sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.add_to_cart} THEN 1 ELSE 0 END) AS add_to_cart_sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.lead_capture} AND stage_rank < ${FUNNEL_STAGE_RANK.order_placed} THEN 1 ELSE 0 END) AS lead_only_sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.checkout_start} THEN 1 ELSE 0 END) AS checkout_sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.order_placed} THEN 1 ELSE 0 END) AS order_placed_sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.order_paid} THEN 1 ELSE 0 END) AS order_paid_sessions,
        COALESCE(SUM(converted_revenue_paise), 0) AS paid_revenue_paise
      FROM visitor_sessions
      ${whereSql}
    `)
    .get(...params) as Record<string, unknown> | undefined;

  const totalSessions = Number(summaryRow?.total_sessions || 0);
  const orderPlacedSessions = Number(summaryRow?.order_placed_sessions || 0);
  const orderPaidSessions = Number(summaryRow?.order_paid_sessions || 0);
  const paidRevenuePaise = Number(summaryRow?.paid_revenue_paise || 0);

  // 2. Exact event counts per stage (from funnel_events filtered by matching sessions)
  const cutoff = cutoffForPeriod(period);
  const eventClauses: string[] = [];
  const eventParams: unknown[] = [];
  if (cutoff) {
    eventClauses.push("fe.created_at >= ?");
    eventParams.push(cutoff);
  }
  if (query.funnelName && query.funnelName !== "all") {
    eventClauses.push("fe.funnel_name = ?");
    eventParams.push(query.funnelName);
  }
  if (query.utmSource) {
    eventClauses.push(`LOWER(COALESCE(NULLIF(vs.${prefix}_utm_source, ''), fe.utm_source)) = LOWER(?)`);
    eventParams.push(query.utmSource.trim());
  }
  if (query.utmCampaign) {
    eventClauses.push(`LOWER(COALESCE(NULLIF(vs.${prefix}_utm_campaign, ''), fe.utm_campaign)) = LOWER(?)`);
    eventParams.push(query.utmCampaign.trim());
  }
  if (query.utmTerm) {
    eventClauses.push(`LOWER(COALESCE(NULLIF(vs.${prefix}_utm_term, ''), fe.utm_term)) LIKE LOWER(?)`);
    eventParams.push(`%${query.utmTerm.trim()}%`);
  }
  const eventWhere = eventClauses.length > 0 ? `WHERE ${eventClauses.join(" AND ")}` : "";

  const stageRows = db
    .prepare(`
      SELECT
        fe.funnel_stage AS stage,
        COUNT(*) AS event_count,
        COUNT(DISTINCT fe.session_id) AS session_count,
        COALESCE(SUM(fe.value_paise), 0) AS total_value_paise
      FROM funnel_events fe
      LEFT JOIN visitor_sessions vs ON vs.session_id = fe.session_id
      ${eventWhere}
      GROUP BY fe.funnel_stage
    `)
    .all(...eventParams) as Array<{
      stage: string;
      event_count: number;
      session_count: number;
      total_value_paise: number;
    }>;

  const stageMap = new Map(stageRows.map((r) => [r.stage, r]));
  const baseSessions = Math.max(totalSessions, Number(stageMap.get("visit")?.session_count || 0));

  const stages = ORDERED_FUNNEL_STAGES.map((stage) => {
    const row = stageMap.get(stage);
    const sessions =
      stage === "visit"
        ? baseSessions
        : Number(row?.session_count || 0);
    const events = Number(row?.event_count || 0);
    const valuePaise = Number(row?.total_value_paise || 0);
    const conversionPct = baseSessions > 0 ? Number(((sessions / baseSessions) * 100).toFixed(2)) : 0;
    return {
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      rank: FUNNEL_STAGE_RANK[stage],
      sessions,
      events,
      valuePaise,
      conversionPct,
    };
  });

  // 3. Conversations & Abandoned Carts summary
  const convWhereClauses: string[] = [];
  const convParams: unknown[] = [];
  if (cutoff) {
    convWhereClauses.push("fc.created_at >= ?");
    convParams.push(cutoff);
  }
  if (query.utmSource) {
    convWhereClauses.push(`LOWER(COALESCE(NULLIF(vs.${prefix}_utm_source, ''), fc.utm_source)) = LOWER(?)`);
    convParams.push(query.utmSource.trim());
  }
  if (query.utmCampaign) {
    convWhereClauses.push(`LOWER(COALESCE(NULLIF(vs.${prefix}_utm_campaign, ''), fc.utm_campaign)) = LOWER(?)`);
    convParams.push(query.utmCampaign.trim());
  }
  if (query.utmTerm) {
    convWhereClauses.push(`LOWER(COALESCE(NULLIF(vs.${prefix}_utm_term, ''), fc.utm_term)) LIKE LOWER(?)`);
    convParams.push(`%${query.utmTerm.trim()}%`);
  }
  const convWhere = convWhereClauses.length > 0 ? `WHERE ${convWhereClauses.join(" AND ")}` : "";

  const conversationCountRow = db
    .prepare(`
      SELECT COUNT(*) AS total_conversations
      FROM funnel_conversations fc
      LEFT JOIN visitor_sessions vs ON vs.session_id = fc.session_id
      ${convWhere}
    `)
    .get(...convParams) as { total_conversations: number } | undefined;

  const abandonedCountRow = db
    .prepare(`
      SELECT
        COUNT(*) AS total_abandoned_carts,
        COALESCE(SUM(CASE WHEN status IN ('active', 'abandoned', 'contacted') THEN subtotal_paise ELSE 0 END), 0) AS recoverable_paise
      FROM abandoned_carts
      ${cutoff ? "WHERE created_at >= ?" : ""}
    `)
    .get(...(cutoff ? [cutoff] : [])) as { total_abandoned_carts: number; recoverable_paise: number } | undefined;

  // 4. Dimension Breakdown (Campaign / Source & Medium / Keywords / Content / Landing Page / Funnel)
  let dimExpr = `COALESCE(NULLIF(${prefix}_utm_campaign, ''), '(none)')`;
  let secondaryExpr = `COALESCE(NULLIF(${prefix}_utm_source, ''), 'direct')`;
  if (dimension === "source_medium") {
    dimExpr = `COALESCE(NULLIF(${prefix}_utm_source, ''), 'direct')`;
    secondaryExpr = `COALESCE(NULLIF(${prefix}_utm_medium, ''), '(none)')`;
  } else if (dimension === "keyword") {
    dimExpr = `COALESCE(NULLIF(${prefix}_utm_term, ''), '(not provided)')`;
    secondaryExpr = `COALESCE(NULLIF(${prefix}_utm_campaign, ''), '(none)')`;
  } else if (dimension === "content") {
    dimExpr = `COALESCE(NULLIF(${prefix}_utm_content, ''), '(none)')`;
    secondaryExpr = `COALESCE(NULLIF(${prefix}_utm_campaign, ''), '(none)')`;
  } else if (dimension === "landing_page") {
    dimExpr = `COALESCE(NULLIF(${prefix}_landing_page, ''), '/')`;
    secondaryExpr = `COALESCE(NULLIF(${prefix}_utm_source, ''), 'direct')`;
  } else if (dimension === "funnel") {
    dimExpr = `COALESCE(NULLIF(funnel_name, ''), 'retail_storefront')`;
    secondaryExpr = `COALESCE(NULLIF(${prefix}_utm_source, ''), 'direct')`;
  }

  const breakdownRows = db
    .prepare(`
      SELECT
        ${dimExpr} AS primary_key,
        ${secondaryExpr} AS secondary_key,
        COUNT(*) AS sessions,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.product_view} THEN 1 ELSE 0 END) AS product_views,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.add_to_cart} THEN 1 ELSE 0 END) AS add_to_carts,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.lead_capture} THEN 1 ELSE 0 END) AS leads_and_forms,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.conversation} THEN 1 ELSE 0 END) AS conversations,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.checkout_start} THEN 1 ELSE 0 END) AS checkout_starts,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.order_placed} THEN 1 ELSE 0 END) AS orders,
        SUM(CASE WHEN stage_rank >= ${FUNNEL_STAGE_RANK.order_paid} THEN 1 ELSE 0 END) AS paid_orders,
        COALESCE(SUM(converted_revenue_paise), 0) AS revenue_paise
      FROM visitor_sessions
      ${whereSql}
      GROUP BY primary_key, secondary_key
      ORDER BY sessions DESC, revenue_paise DESC
      LIMIT 50
    `)
    .all(...params) as Array<Record<string, unknown>>;

  const breakdown = breakdownRows.map((r) => {
    const sessions = Number(r.sessions || 0);
    const orders = Number(r.orders || 0);
    const paidOrders = Number(r.paid_orders || 0);
    const revenuePaise = Number(r.revenue_paise || 0);
    return {
      primaryKey: String(r.primary_key || "(none)"),
      secondaryKey: String(r.secondary_key || ""),
      sessions,
      productViews: Number(r.product_views || 0),
      addToCarts: Number(r.add_to_carts || 0),
      leadsAndForms: Number(r.leads_and_forms || 0),
      conversations: Number(r.conversations || 0),
      checkoutStarts: Number(r.checkout_starts || 0),
      orders,
      paidOrders,
      revenuePaise,
      conversionRatePct: sessions > 0 ? Number(((orders / sessions) * 100).toFixed(2)) : 0,
      aovPaise: paidOrders > 0 ? Math.round(revenuePaise / paidOrders) : 0,
    };
  });

  // 5. Filter options (distinct sources & campaigns for UI dropdowns)
  const distinctSources = (
    db
      .prepare(
        `SELECT DISTINCT ${prefix}_utm_source AS val FROM visitor_sessions WHERE ${prefix}_utm_source != '' ORDER BY val ASC LIMIT 50`
      )
      .all() as Array<{ val: string }>
  ).map((r) => r.val);

  const distinctCampaigns = (
    db
      .prepare(
        `SELECT DISTINCT ${prefix}_utm_campaign AS val FROM visitor_sessions WHERE ${prefix}_utm_campaign != '' ORDER BY val ASC LIMIT 50`
      )
      .all() as Array<{ val: string }>
  ).map((r) => r.val);

  // 6. Recent unified activity feed (leads, conversations, forms, carts, orders)
  const recentEvents = db
    .prepare(`
      SELECT
        fe.id,
        fe.session_id,
        fe.funnel_name,
        fe.funnel_stage,
        fe.event_name,
        fe.entity_type,
        fe.entity_id,
        fe.path,
        fe.value_paise,
        fe.currency,
        COALESCE(NULLIF(vs.${prefix}_utm_source, ''), fe.utm_source) AS utm_source,
        COALESCE(NULLIF(vs.${prefix}_utm_medium, ''), fe.utm_medium) AS utm_medium,
        COALESCE(NULLIF(vs.${prefix}_utm_campaign, ''), fe.utm_campaign) AS utm_campaign,
        COALESCE(NULLIF(vs.${prefix}_utm_term, ''), fe.utm_term) AS utm_term,
        COALESCE(NULLIF(vs.${prefix}_utm_content, ''), fe.utm_content) AS utm_content,
        COALESCE(NULLIF(vs.${prefix}_gclid, ''), fe.gclid) AS gclid,
        COALESCE(NULLIF(vs.${prefix}_fbclid, ''), fe.fbclid) AS fbclid,
        vs.customer_name,
        vs.customer_email,
        vs.customer_phone,
        fe.created_at
      FROM funnel_events fe
      LEFT JOIN visitor_sessions vs ON vs.session_id = fe.session_id
      ${eventWhere}
      ORDER BY fe.created_at DESC
      LIMIT 100
    `)
    .all(...eventParams) as Array<Record<string, unknown>>;

  const recentConversations = db
    .prepare(`
      SELECT
        fc.*,
        COALESCE(NULLIF(vs.${prefix}_utm_source, ''), fc.utm_source) AS resolved_utm_source,
        COALESCE(NULLIF(vs.${prefix}_utm_campaign, ''), fc.utm_campaign) AS resolved_utm_campaign,
        COALESCE(NULLIF(vs.${prefix}_utm_term, ''), fc.utm_term) AS resolved_utm_term
      FROM funnel_conversations fc
      LEFT JOIN visitor_sessions vs ON vs.session_id = fc.session_id
      ${convWhere}
      ORDER BY fc.created_at DESC
      LIMIT 50
    `)
    .all(...convParams) as Array<Record<string, unknown>>;

  const totalLeadsAndForms =
    Number(stageMap.get("lead_capture")?.event_count || 0) +
    Number(stageMap.get("form_submit")?.event_count || 0);

  return {
    period,
    touchModel: touch,
    dimension,
    kpis: {
      totalSessions,
      totalLeadsAndForms,
      totalConversations: Number(conversationCountRow?.total_conversations || 0),
      totalAbandonedCarts: Number(abandonedCountRow?.total_abandoned_carts || 0),
      recoverableCartValuePaise: Number(abandonedCountRow?.recoverable_paise || 0),
      checkoutStarts: Number(summaryRow?.checkout_sessions || 0),
      ordersPlaced: orderPlacedSessions,
      paidOrders: orderPaidSessions,
      paidRevenuePaise,
      overallConversionPct:
        totalSessions > 0 ? Number(((orderPlacedSessions / totalSessions) * 100).toFixed(2)) : 0,
    },
    stages,
    breakdown,
    filters: {
      sources: distinctSources,
      campaigns: distinctCampaigns,
    },
    recentEvents,
    recentConversations,
  };
}

export interface AudienceRecord {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  valueRupees: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  funnelName: string;
  segment: RemarketingSegment;
  lastActivityAt: string;
}

export interface AudienceFilter {
  segment: RemarketingSegment;
  period?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmTerm?: string;
  funnelName?: string;
}

function splitNameParts(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const clean = (fullName || "").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizePhoneDigits(raw: string | null | undefined): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 7) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

function sha256Norm(val: string): string {
  const clean = val.trim().toLowerCase();
  if (!clean) return "";
  return createHash("sha256").update(clean).digest("hex");
}

function getPaidBuyerKeys(db: InstanceType<typeof Database>): {
  emails: Set<string>;
  phones: Set<string>;
  sessionIds: Set<string>;
} {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const sessionIds = new Set<string>();

  try {
    const coRows = db
      .prepare(
        "SELECT id, document FROM commerce_orders WHERE payment_status IN ('paid', 'cod_due', 'cod_remitted', 'advance_paid', 'pending_bank_transfer')"
      )
      .all() as Array<{ id: string; document: string }>;
    for (const r of coRows) {
      try {
        const doc = JSON.parse(r.document) as {
          input?: { address?: { email?: string; phone?: string } };
          attribution?: { sessionId?: string };
        };
        const em = doc.input?.address?.email?.trim().toLowerCase();
        const ph = normalizePhoneDigits(doc.input?.address?.phone);
        if (em) emails.add(em);
        if (ph) phones.add(ph);
        if (doc.attribution?.sessionId) sessionIds.add(doc.attribution.sessionId);
      } catch {}
    }
  } catch {}

  try {
    const ordRows = db
      .prepare("SELECT customer_email, customer_phone, session_id FROM orders WHERE status != 'cancelled'")
      .all() as Array<{ customer_email?: string; customer_phone?: string; session_id?: string }>;
    for (const r of ordRows) {
      const em = r.customer_email?.trim().toLowerCase();
      const ph = normalizePhoneDigits(r.customer_phone);
      if (em) emails.add(em);
      if (ph) phones.add(ph);
      if (r.session_id) sessionIds.add(r.session_id);
    }
  } catch {}

  try {
    const sessRows = db
      .prepare("SELECT session_id, customer_email, customer_phone FROM visitor_sessions WHERE stage_rank >= ?")
      .all(FUNNEL_STAGE_RANK.order_placed) as Array<{
        session_id?: string;
        customer_email?: string;
        customer_phone?: string;
      }>;
    for (const r of sessRows) {
      if (r.session_id) sessionIds.add(r.session_id);
      if (r.customer_email) emails.add(r.customer_email.trim().toLowerCase());
      const ph = normalizePhoneDigits(r.customer_phone);
      if (ph) phones.add(ph);
    }
  } catch {}

  return { emails, phones, sessionIds };
}

function matchesAudienceFilters(rec: AudienceRecord, filter: AudienceFilter): boolean {
  if (filter.utmSource && rec.utmSource.toLowerCase() !== filter.utmSource.trim().toLowerCase()) {
    return false;
  }
  if (filter.utmCampaign && rec.utmCampaign.toLowerCase() !== filter.utmCampaign.trim().toLowerCase()) {
    return false;
  }
  if (filter.utmTerm && !rec.utmTerm.toLowerCase().includes(filter.utmTerm.trim().toLowerCase())) {
    return false;
  }
  if (filter.funnelName && filter.funnelName !== "all" && rec.funnelName !== filter.funnelName) {
    return false;
  }
  return true;
}

export function queryRemarketingAudience(
  filter: AudienceFilter,
  database?: InstanceType<typeof Database>
): { segment: RemarketingSegment; totalMatched: number; records: AudienceRecord[] } {
  const db = database ?? getDb();
  const cutoff = cutoffForPeriod(filter.period || "90d");
  const buyers = getPaidBuyerKeys(db);

  const dedup = new Map<string, AudienceRecord>();
  const pushUnique = (
    keySource: { email?: string; phone?: string; sessionId?: string },
    rec: AudienceRecord,
    excludeBuyers: boolean
  ) => {
    const em = rec.email.trim().toLowerCase();
    const ph = normalizePhoneDigits(rec.phone);
    if (!em && !ph) return;
    if (excludeBuyers) {
      if (em && buyers.emails.has(em)) return;
      if (ph && buyers.phones.has(ph)) return;
      if (keySource.sessionId && buyers.sessionIds.has(keySource.sessionId)) return;
    }
    if (!matchesAudienceFilters(rec, filter)) return;
    const dedupKey = em ? `e:${em}` : `p:${ph}`;
    const existing = dedup.get(dedupKey);
    if (!existing) {
      dedup.set(dedupKey, rec);
    } else {
      dedup.set(dedupKey, {
        ...existing,
        email: existing.email || rec.email,
        phone: existing.phone || rec.phone,
        firstName: existing.firstName || rec.firstName,
        lastName: existing.lastName || rec.lastName,
        valueRupees: Math.max(existing.valueRupees, rec.valueRupees),
        utmSource: existing.utmSource || rec.utmSource,
        utmMedium: existing.utmMedium || rec.utmMedium,
        utmCampaign: existing.utmCampaign || rec.utmCampaign,
        utmTerm: existing.utmTerm || rec.utmTerm,
      });
    }
  };

  if (filter.segment === "abandoned_carts_unconverted") {
    const rows = db
      .prepare(`
        SELECT ac.*, vs.last_utm_source AS vs_source, vs.last_utm_medium AS vs_medium,
               vs.last_utm_campaign AS vs_campaign, vs.last_utm_term AS vs_term, vs.funnel_name AS vs_funnel
        FROM abandoned_carts ac
        LEFT JOIN visitor_sessions vs ON vs.session_id = ac.session_id
        WHERE ac.status IN ('active', 'abandoned', 'contacted')
          ${cutoff ? "AND ac.updated_at >= ?" : ""}
        ORDER BY ac.updated_at DESC
        LIMIT 2000
      `)
      .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;

    for (const r of rows) {
      const { firstName, lastName } = splitNameParts(r.customer_name as string);
      pushUnique(
        { sessionId: String(r.session_id || "") },
        {
          email: String(r.customer_email || "").trim().toLowerCase(),
          phone: normalizePhoneDigits(r.customer_phone as string),
          firstName,
          lastName,
          city: String(r.shipping_city || ""),
          state: String(r.shipping_state || ""),
          postcode: String(r.shipping_postcode || ""),
          country: "IN",
          valueRupees: Math.round(Number(r.subtotal_paise || 0) / 100),
          utmSource: String(r.utm_source || r.vs_source || ""),
          utmMedium: String(r.utm_medium || r.vs_medium || ""),
          utmCampaign: String(r.utm_campaign || r.vs_campaign || ""),
          utmTerm: String(r.utm_term || r.vs_term || ""),
          funnelName: String(r.funnel_name || r.vs_funnel || "retail_storefront"),
          segment: filter.segment,
          lastActivityAt: String(r.updated_at || r.last_active_at || ""),
        },
        true
      );
    }
  } else if (filter.segment === "leads_unconverted" || filter.segment === "b2b_wholesale_prospects") {
    const isB2B = filter.segment === "b2b_wholesale_prospects";

    if (!isB2B) {
      const leadRows = db
        .prepare(`
          SELECT cl.*, vs.last_utm_source AS vs_source, vs.last_utm_medium AS vs_medium,
                 vs.last_utm_campaign AS vs_campaign, vs.last_utm_term AS vs_term, vs.funnel_name AS vs_funnel
          FROM captured_leads cl
          LEFT JOIN visitor_sessions vs ON vs.session_id = cl.session_id
          ${cutoff ? "WHERE cl.created_at >= ?" : ""}
          ORDER BY cl.created_at DESC
          LIMIT 2000
        `)
        .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;

      for (const r of leadRows) {
        const { firstName, lastName } = splitNameParts(r.customer_name as string);
        pushUnique(
          { sessionId: String(r.session_id || "") },
          {
            email: "",
            phone: normalizePhoneDigits(r.phone_number as string),
            firstName,
            lastName,
            city: "",
            state: "",
            postcode: "",
            country: "IN",
            valueRupees: 0,
            utmSource: String(r.utm_source || r.vs_source || ""),
            utmMedium: String(r.utm_medium || r.vs_medium || ""),
            utmCampaign: String(r.utm_campaign || r.vs_campaign || ""),
            utmTerm: String(r.utm_term || r.vs_term || ""),
            funnelName: String(r.funnel_name || r.vs_funnel || "retail_storefront"),
            segment: filter.segment,
            lastActivityAt: String(r.created_at || ""),
          },
          true
        );
      }

      const contactRows = db
        .prepare(`
          SELECT * FROM contact_inquiries
          ${cutoff ? "WHERE created_at >= ?" : ""}
          ORDER BY created_at DESC LIMIT 2000
        `)
        .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;

      for (const r of contactRows) {
        const { firstName, lastName } = splitNameParts(r.name as string);
        pushUnique(
          { sessionId: String(r.session_id || "") },
          {
            email: String(r.email || "").trim().toLowerCase(),
            phone: normalizePhoneDigits(r.phone as string),
            firstName,
            lastName,
            city: "",
            state: "",
            postcode: "",
            country: "IN",
            valueRupees: 0,
            utmSource: String(r.utm_source || ""),
            utmMedium: String(r.utm_medium || ""),
            utmCampaign: String(r.utm_campaign || ""),
            utmTerm: String(r.utm_term || ""),
            funnelName: String(r.funnel_name || "retail_storefront"),
            segment: filter.segment,
            lastActivityAt: String(r.created_at || ""),
          },
          true
        );
      }
    }

    const wholesaleRows = db
      .prepare(`
        SELECT * FROM wholesale_inquiries
        ${cutoff ? "WHERE created_at >= ?" : ""}
        ORDER BY created_at DESC LIMIT 2000
      `)
      .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;

    for (const r of wholesaleRows) {
      const { firstName, lastName } = splitNameParts(r.name as string);
      pushUnique(
        { sessionId: String(r.session_id || "") },
        {
          email: String(r.email || "").trim().toLowerCase(),
          phone: normalizePhoneDigits(r.phone as string),
          firstName,
          lastName,
          city: String(r.location || ""),
          state: "",
          postcode: "",
          country: "IN",
          valueRupees: 0,
          utmSource: String(r.utm_source || ""),
          utmMedium: String(r.utm_medium || ""),
          utmCampaign: String(r.utm_campaign || ""),
          utmTerm: String(r.utm_term || ""),
          funnelName: String(r.funnel_name || "wholesale_b2b"),
          segment: filter.segment,
          lastActivityAt: String(r.created_at || ""),
        },
        !isB2B
      );
    }

    if (isB2B) {
      try {
        const blendRows = db
          .prepare(`
            SELECT bp.*, ea.utm_source, ea.utm_medium, ea.utm_campaign, ea.utm_term, ea.funnel_name, ea.session_id
            FROM bl_projects bp
            LEFT JOIN entity_attributions ea ON ea.entity_type = 'blend_lab' AND ea.entity_id = bp.public_id
            ${cutoff ? "WHERE bp.created_at >= ?" : ""}
            ORDER BY bp.created_at DESC LIMIT 1000
          `)
          .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;
        for (const r of blendRows) {
          const { firstName, lastName } = splitNameParts(r.contact_name as string);
          pushUnique(
            { sessionId: String(r.session_id || "") },
            {
              email: String(r.contact_email || "").trim().toLowerCase(),
              phone: normalizePhoneDigits(r.contact_phone as string),
              firstName,
              lastName,
              city: "",
              state: "",
              postcode: String(r.pickup_pincode || ""),
              country: "IN",
              valueRupees: Math.round(Number(r.total_paise || 0) / 100),
              utmSource: String(r.utm_source || ""),
              utmMedium: String(r.utm_medium || ""),
              utmCampaign: String(r.utm_campaign || ""),
              utmTerm: String(r.utm_term || ""),
              funnelName: String(r.funnel_name || "blend_lab"),
              segment: filter.segment,
              lastActivityAt: String(r.created_at || ""),
            },
            false
          );
        }
      } catch {}
    }
  } else if (filter.segment === "whatsapp_no_order") {
    const convRows = db
      .prepare(`
        SELECT fc.*, vs.customer_name AS vs_name, vs.customer_email AS vs_email, vs.customer_phone AS vs_phone,
               vs.last_utm_source AS vs_source, vs.last_utm_medium AS vs_medium,
               vs.last_utm_campaign AS vs_campaign, vs.last_utm_term AS vs_term, vs.funnel_name AS vs_funnel
        FROM funnel_conversations fc
        LEFT JOIN visitor_sessions vs ON vs.session_id = fc.session_id
        ${cutoff ? "WHERE fc.created_at >= ?" : ""}
        ORDER BY fc.created_at DESC LIMIT 2000
      `)
      .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;

    for (const r of convRows) {
      const { firstName, lastName } = splitNameParts(String(r.customer_name || r.vs_name || ""));
      pushUnique(
        { sessionId: String(r.session_id || "") },
        {
          email: String(r.customer_email || r.vs_email || "").trim().toLowerCase(),
          phone: normalizePhoneDigits(String(r.customer_phone || r.vs_phone || "")),
          firstName,
          lastName,
          city: "",
          state: "",
          postcode: "",
          country: "IN",
          valueRupees: 0,
          utmSource: String(r.utm_source || r.vs_source || ""),
          utmMedium: String(r.utm_medium || r.vs_medium || ""),
          utmCampaign: String(r.utm_campaign || r.vs_campaign || ""),
          utmTerm: String(r.utm_term || r.vs_term || ""),
          funnelName: String(r.vs_funnel || "retail_storefront"),
          segment: filter.segment,
          lastActivityAt: String(r.created_at || ""),
        },
        true
      );
    }
  } else if (filter.segment === "newsletter_non_buyers") {
    const nlRows = db
      .prepare(`
        SELECT * FROM newsletter_subscriptions
        ${cutoff ? "WHERE created_at >= ?" : ""}
        ORDER BY created_at DESC LIMIT 3000
      `)
      .all(...(cutoff ? [cutoff] : [])) as Array<Record<string, unknown>>;
    for (const r of nlRows) {
      pushUnique(
        { sessionId: String(r.session_id || "") },
        {
          email: String(r.email || "").trim().toLowerCase(),
          phone: "",
          firstName: "",
          lastName: "",
          city: "",
          state: "",
          postcode: "",
          country: "IN",
          valueRupees: 0,
          utmSource: String(r.utm_source || ""),
          utmMedium: String(r.utm_medium || ""),
          utmCampaign: String(r.utm_campaign || ""),
          utmTerm: String(r.utm_term || ""),
          funnelName: String(r.funnel_name || "retail_storefront"),
          segment: filter.segment,
          lastActivityAt: String(r.created_at || ""),
        },
        true
      );
    }
  } else if (filter.segment === "all_purchasers" || filter.segment === "high_value_repeat_buyers") {
    const buyerAgg = new Map<
      string,
      { rec: AudienceRecord; ordersCount: number; totalRupees: number }
    >();

    const coRows = db
      .prepare(`
        SELECT co.id, co.document, co.created_ms, ea.utm_source, ea.utm_medium, ea.utm_campaign, ea.utm_term, ea.funnel_name
        FROM commerce_orders co
        LEFT JOIN entity_attributions ea ON ea.entity_type = 'order' AND ea.entity_id = co.id
        WHERE co.payment_status IN ('paid', 'cod_due', 'cod_remitted', 'advance_paid', 'pending_bank_transfer')
        ORDER BY co.created_ms DESC
        LIMIT 3000
      `)
      .all() as Array<Record<string, unknown>>;

    for (const r of coRows) {
      try {
        const doc = JSON.parse(String(r.document || "{}")) as {
          totalPaise?: number;
          input?: {
            address?: {
              name?: string;
              email?: string;
              phone?: string;
              city?: string;
              state?: string;
              postcode?: string;
              country?: string;
            };
          };
        };
        const addr = doc.input?.address;
        if (!addr) continue;
        const email = (addr.email || "").trim().toLowerCase();
        const phone = normalizePhoneDigits(addr.phone);
        if (!email && !phone) continue;
        const key = email ? `e:${email}` : `p:${phone}`;
        const { firstName, lastName } = splitNameParts(addr.name);
        const orderRupees = Math.round(Number(doc.totalPaise || 0) / 100);
        const existing = buyerAgg.get(key);
        const createdIso = new Date(Number(r.created_ms || Date.now())).toISOString().slice(0, 19).replace("T", " ");
        if (!existing) {
          buyerAgg.set(key, {
            ordersCount: 1,
            totalRupees: orderRupees,
            rec: {
              email,
              phone,
              firstName,
              lastName,
              city: addr.city || "",
              state: addr.state || "",
              postcode: addr.postcode || "",
              country: addr.country || "IN",
              valueRupees: orderRupees,
              utmSource: String(r.utm_source || ""),
              utmMedium: String(r.utm_medium || ""),
              utmCampaign: String(r.utm_campaign || ""),
              utmTerm: String(r.utm_term || ""),
              funnelName: String(r.funnel_name || "retail_storefront"),
              segment: filter.segment,
              lastActivityAt: createdIso,
            },
          });
        } else {
          existing.ordersCount += 1;
          existing.totalRupees += orderRupees;
          existing.rec.valueRupees = existing.totalRupees;
        }
      } catch {}
    }

    for (const entry of buyerAgg.values()) {
      if (
        filter.segment === "high_value_repeat_buyers" &&
        entry.ordersCount < 2 &&
        entry.totalRupees < 2000
      ) {
        continue;
      }
      if (!matchesAudienceFilters(entry.rec, filter)) continue;
      dedup.set(entry.rec.email ? `e:${entry.rec.email}` : `p:${entry.rec.phone}`, entry.rec);
    }
  }

  const records = Array.from(dedup.values());
  return {
    segment: filter.segment,
    totalMatched: records.length,
    records,
  };
}

function escapeCsvCell(raw: string | number): string {
  let s = String(raw ?? "");
  // Prevent CSV spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportRemarketingCsv(
  filter: AudienceFilter,
  format: AudienceExportFormat = "meta_hashed",
  database?: InstanceType<typeof Database>
): { filename: string; csv: string; count: number } {
  const { records } = queryRemarketingAudience(filter, database);
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `teafloww-${filter.segment}-${format}-${datePart}.csv`;

  if (format === "meta_hashed") {
    const header = ["email", "phone", "fn", "ln", "ct", "st", "zip", "country", "value"].join(",");
    const lines = records.map((r) =>
      [
        sha256Norm(r.email),
        sha256Norm(r.phone),
        sha256Norm(r.firstName),
        sha256Norm(r.lastName),
        sha256Norm(r.city.replace(/[^a-zA-Z0-9]/g, "")),
        sha256Norm(r.state.replace(/[^a-zA-Z0-9]/g, "")),
        sha256Norm(r.postcode.replace(/\s+/g, "")),
        sha256Norm(r.country),
        r.valueRupees,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
    return { filename, csv: [header, ...lines].join("\r\n"), count: records.length };
  }

  if (format === "google_customer_match") {
    const header = ["Email", "Phone", "First Name", "Last Name", "Country", "Zip"].join(",");
    const lines = records.map((r) =>
      [
        sha256Norm(r.email),
        sha256Norm(r.phone ? `+${r.phone}` : ""),
        sha256Norm(r.firstName),
        sha256Norm(r.lastName),
        r.country,
        r.postcode,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
    return { filename, csv: [header, ...lines].join("\r\n"), count: records.length };
  }

  // crm_plain
  const header = [
    "email",
    "phone",
    "first_name",
    "last_name",
    "city",
    "state",
    "postcode",
    "country",
    "value_inr",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "funnel_name",
    "last_activity_at",
  ].join(",");

  const lines = records.map((r) =>
    [
      r.email,
      r.phone,
      r.firstName,
      r.lastName,
      r.city,
      r.state,
      r.postcode,
      r.country,
      r.valueRupees,
      r.utmSource,
      r.utmMedium,
      r.utmCampaign,
      r.utmTerm,
      r.funnelName,
      r.lastActivityAt,
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return { filename, csv: [header, ...lines].join("\r\n"), count: records.length };
}
