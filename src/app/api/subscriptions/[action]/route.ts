import { z } from 'zod';
import { gate, body, json, failure } from '@/lib/international/http';
import { getCustomerSession } from '@/lib/customerSessions';
import { previewSubscription, enrollSubscription, previewCycle, commitCycle, existingPayment, changeSubscription } from '@/lib/subscriptions/service';
import { subscriptionList, subscriptionPolicy } from '@/lib/subscriptions/store';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request); if (denied) return denied;
  try {
    const { action } = await params;
    if (action === 'policy') return json({ policy: subscriptionPolicy() });
    const customer = getCustomerSession(request);
    if (!customer) return Response.json({ error: 'Sign in to manage subscriptions.' }, { status: 401 });
    if (action === 'list') return json({ subscriptions: subscriptionList(customer.id) });
    return new Response(null, { status: 404 });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request); if (denied) return denied;
  const customer = getCustomerSession(request);
  if (!customer) return Response.json({ error: 'Sign in to manage subscriptions.' }, { status: 401 });
  try {
    const { action } = await params, input = await body(request);
    if (action === 'preview') return json(await previewSubscription(input, customer.id));
    if (action === 'enroll') return json(enrollSubscription(input, customer.id));
    if (action === 'quote') return json(await previewCycle(input, customer.id));
    if (action === 'pay') return json(await commitCycle(input, customer.id));
    if (action === 'resume-payment') { const p = z.object({ cycleId: z.string().uuid() }).strict().parse(input); return json(await existingPayment(p.cycleId, customer.id)); }
    if (action === 'change') return json(await changeSubscription(input, customer.id));
    return new Response(null, { status: 404 });
  } catch (error) { return failure(error); }
}
