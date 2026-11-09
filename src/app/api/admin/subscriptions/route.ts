import { z } from 'zod';
import { gate, body, json, failure } from '@/lib/international/http';
import { subscriptionPolicy, subscriptionList, saveSubscriptionPolicy } from '@/lib/subscriptions/store';
import { getAdminUser } from '@/lib/adminAuth';
import { enqueue, audit } from '@/lib/international/store';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = gate(request, true); if (denied) return denied;
  try { return json({ policy: subscriptionPolicy(), subscriptions: subscriptionList() }); } catch (error) { return failure(error); }
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
