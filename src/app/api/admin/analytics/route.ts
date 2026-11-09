import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { guard, invalid, conflict } from "@/lib/adminHttp";

export const runtime = "nodejs";

const eventSchema = z.object({
  session_id: z.string().trim().min(1).max(128),
  event_type: z.enum(["pageview", "product_view", "checkout_start", "order_complete", "custom"]).default("pageview"),
  path: z.string().trim().min(1).max(500),
  referrer: z.string().trim().max(500).optional().default(""),
  user_agent: z.string().trim().max(500).optional().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

// created_at is TEXT ("YYYY-MM-DD HH:MM:SS") on both SQLite and PostgreSQL,
// so compare against a JS-computed cutoff string instead of DB-specific
// date functions (datetime('now', ...) is SQLite-only and the
// visitor_events view does not exist on fresh PostgreSQL mirrors).
function toDbTimestamp(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function cutoffForPeriod(period: string): string | null {
  const DAY_MS = 24 * 3600 * 1000;
  const now = Date.now();
  if (period === "7d") return toDbTimestamp(new Date(now - 7 * DAY_MS));
  if (period === "30d") return toDbTimestamp(new Date(now - 30 * DAY_MS));
  if (period === "90d") return toDbTimestamp(new Date(now - 90 * DAY_MS));
  return null;
}

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d";

  const cutoff = cutoffForPeriod(period);
  const dateFilter = cutoff ? " WHERE created_at >= ?" : "";
  const dateParams: string[] = cutoff ? [cutoff] : [];

  const db = getDb();

  try {
    // 1. Traffic overview (analytics_events is the source table; the
    // visitor_events view is just a projection of it and is absent on PG).
    const trafficRow = db
      .prepare(`
        SELECT 
          COUNT(DISTINCT session_id) AS total_visitors,
          COUNT(*) AS total_pageviews
        FROM analytics_events
        ${dateFilter}
      `)
      .get(...dateParams) as { total_visitors: number; total_pageviews: number } | undefined;

    const total_visitors = trafficRow?.total_visitors ?? 0;
    const total_pageviews = trafficRow?.total_pageviews ?? 0;

    // 2. Top tea products
    const topTeaWhere = cutoff
      ? " WHERE path LIKE '/tea/%' AND created_at >= ?"
      : " WHERE path LIKE '/tea/%'";
    const topTeaParams: string[] = cutoff ? [cutoff] : [];
    const top_products = db
      .prepare(`
        SELECT path, COUNT(*) as views
        FROM analytics_events
        ${topTeaWhere}
        GROUP BY path
        ORDER BY views DESC
        LIMIT 10
      `)
      .all(...topTeaParams) as Array<{ path: string; views: number }>;

    // 3. Top pages overall
    const top_pages = db
      .prepare(`
        SELECT path, COUNT(*) as views
        FROM analytics_events
        ${dateFilter}
        GROUP BY path
        ORDER BY views DESC
        LIMIT 10
      `)
      .all(...dateParams) as Array<{ path: string; views: number }>;

    // 4. Referral sources
    const referral_sources = db
      .prepare(`
        SELECT 
          COALESCE(NULLIF(referrer, ''), 'Direct') as source,
          COUNT(*) as count
        FROM analytics_events
        ${dateFilter}
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10
      `)
      .all(...dateParams) as Array<{ source: string; count: number }>;

    // 5. Daily traffic trend (SUBSTR works on TEXT timestamps on both DBs;
    // DATE(created_at) fails on PostgreSQL where created_at is TEXT).
    const daily_traffic = db
      .prepare(`
        SELECT 
          SUBSTR(created_at, 1, 10) as date,
          COUNT(DISTINCT session_id) as visitors,
          COUNT(*) as pageviews
        FROM analytics_events
        ${dateFilter}
        GROUP BY SUBSTR(created_at, 1, 10)
        ORDER BY date ASC
        LIMIT 30
      `)
      .all(...dateParams) as Array<{ date: string; visitors: number; pageviews: number }>;

    // 6. Conversion funnel from analytics_events
    const funnelRow = db
      .prepare(`
        SELECT
          COUNT(DISTINCT session_id) AS total_sessions,
          COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN session_id END) AS viewed_products,
          COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN session_id END) AS started_checkout,
          COUNT(DISTINCT CASE WHEN event_type = 'order_complete' THEN session_id END) AS completed_orders
        FROM analytics_events
        ${dateFilter}
      `)
      .get(...dateParams) as {
        total_sessions: number;
        viewed_products: number;
        started_checkout: number;
        completed_orders: number;
      } | undefined;

    const funnelVisitors = funnelRow?.total_sessions ?? 0;
    const funnelProductViews = funnelRow?.viewed_products ?? 0;
    const funnelCheckoutStarts = funnelRow?.started_checkout ?? 0;
    const funnelCompletedOrders = funnelRow?.completed_orders ?? 0;

    // Safe zero-division handling for conversion percentage
    const conversion_rate_percent =
      funnelVisitors > 0
        ? Number(((funnelCompletedOrders / funnelVisitors) * 100).toFixed(2))
        : 0;

    // 7. Orders overview
    let total_orders = 0;
    let total_revenue_paise = 0;
    try {
      const orderStats = db
        .prepare(`
          SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_paise ELSE 0 END), 0) as total_revenue
          FROM orders
        `)
        .get() as { total_orders: number; total_revenue: number } | undefined;
      total_orders = orderStats?.total_orders ?? 0;
      total_revenue_paise = orderStats?.total_revenue ?? 0;
    } catch {
      // Graceful fallback if orders table structure differs
    }

    return NextResponse.json({
      period,
      total_visitors,
      total_pageviews,
      total_orders,
      total_revenue_paise,
      top_products,
      top_pages,
      referral_sources,
      daily_traffic,
      conversion_funnel: {
        visitors: funnelVisitors,
        product_views: funnelProductViews,
        checkout_attempts: funnelCheckoutStarts,
        completed_orders: funnelCompletedOrders,
        conversion_rate_percent,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to retrieve analytics.";
    return conflict(msg);
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const { session_id, event_type, path, referrer, user_agent, metadata } = parsed.data;
  const db = getDb();

  try {
    const insert = db.prepare(`
      INSERT INTO analytics_events (session_id, event_type, path, referrer, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = insert.run(
      session_id,
      event_type,
      path,
      referrer,
      user_agent,
      JSON.stringify(metadata)
    );

    return NextResponse.json({ success: true, id: Number(info.lastInsertRowid) }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to record analytics event.";
    return conflict(msg);
  }
}
