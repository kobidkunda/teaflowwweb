import { z } from 'zod';
import { gate, body, json, failure } from '@/lib/international/http';
import { subscriptionPolicy, subscriptionListPaginated, saveSubscriptionPolicy } from '@/lib/subscriptions/store';
import { getAdminUser } from '@/lib/adminAuth';
import { enqueue, audit } from '@/lib/international/store';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = gate(request, true); if (denied) return denied;
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
    const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const status = url.searchParams.get("status") || undefined;
    const intervalDays = parseInt(url.searchParams.get("intervalDays") || "0", 10) || undefined;
    const q = (url.searchParams.get("q") || "").slice(0, 60) || undefined;

    const result = subscriptionListPaginated({
      page,
      pageSize,
      status,
      intervalDays,
      q,
    });

    return json({
      policy: subscriptionPolicy(),
      subscriptions: result.subscriptions,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const denied = gate(request, true); if (denied) return denied;
  try {
    const input = z.object({ action: z.literal('scan') }).strict().parse(await body(request));
    enqueue('subscription_tick', {}, `subscription:manual:${crypto.randomUUID()}`);
    audit(String(getAdminUser(request)!.id), 'subscriptions.scan', input);
    return json({ queued: true });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  const denied = gate(request, true); if (denied) return denied;
  try {
    const policy = saveSubscriptionPolicy(await body(request));
    audit(String(getAdminUser(request)!.id), 'subscriptions.policy', policy);
    return json({ policy });
  } catch (error) { return failure(error); }
}
