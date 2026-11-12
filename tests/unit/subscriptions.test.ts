import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { discounts, intervals, dispatchDate, nextDispatch, DAY, istDate, policySchema } from '@/lib/subscriptions/model';
const dir = mkdtempSync(path.join(tmpdir(), 'teafloww-subscriptions-'));
process.env.DATABASE_PATH = path.join(dir, 'store.sqlite');
process.env.ORDER_ACCESS_SECRET = 'isolated-subscription-order-secret';
process.env.SESSION_SECRET = 'isolated-subscription-session-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_subscription';
process.env.RAZORPAY_KEY_SECRET = 'test-only';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-only';
process.env.SHIPROCKET_EMAIL = 'test@example.invalid';
process.env.SHIPROCKET_PASSWORD = 'test-only';
process.env.COMMERCE_WORKER_SECRET = 'test-only';
let db: Database.Database;
let variantId: number;
const trialId = randomUUID();
let service: typeof import('@/lib/subscriptions/service');
let store: typeof import('@/lib/subscriptions/store');
let orders: typeof import('@/lib/international/orders');
let providers: typeof import('@/lib/international/providers');
const customerId = randomUUID(), otherId = randomUUID();
const input = () => ({ address: { name: 'Test Customer', email: 'customer@example.invalid', phone: '+919999999999', line1: '123 Test Street', line2: '', city: 'Siliguri', state: 'West Bengal', postcode: '734005', country: 'IN' }, currency: 'INR', locale: 'en', method: 'prepaid', items: [{ variantId, quantity: 1 }] });
async function enroll(method = 'prepaid') {
  const q = await service.previewSubscription({ input: { ...input(), method }, intervalDays: 7, dispatchDate: istDate() }, customerId);
  const result = service.enrollSubscription({ quoteId: q.id, idempotencyKey: randomUUID(), consent: true }, customerId);
  return { id: result.subscriptionId, c: store.openCycle(result.subscriptionId)!, q };
}
async function pay(id: string, method = 'prepaid') {
  const q = await service.previewCycle({ cycleId: id, method }, customerId);
  const p = await service.commitCycle({ quoteId: q.id, cycleRevision: q.cycleRevision }, customerId);
  return { q, p };
}
function capture(p: Awaited<ReturnType<typeof pay>>['p'], eventId = randomUUID()) {
  orders.applyPaymentEvent(eventId, { event: 'payment.captured', payload: { payment: { entity: { id: `pay_${p.orderId.replaceAll('-','')}`, order_id: p.gatewayOrderId!, amount: p.amount, currency: p.currency, status: 'captured' } } } });
}
beforeAll(async () => {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: { ...process.env }, stdio: 'ignore' });
  db = (await import('@/lib/db')).getDb();
  const { upsertProduct, upsertVariant } = await import('@/lib/products');
  const p = upsertProduct({ slug: 'subscription-test', name: 'Subscription Tea', category: 'Black Tea', origin: '', estate: '', flush: '', harvest_date: '', description: 'Synthetic test tea', tasting_notes: '', brew_temp: 90, brew_seconds: 180 });
  db.prepare("UPDATE products SET status='published',is_enabled=1 WHERE id=?").run(p.id);
  variantId = upsertVariant({ product_id: p.id, sku: 'SUB-TEST', grams: 100, price_paise: 100000, stock: 100 }).id;
  db.prepare(`INSERT INTO trials (id, slug, title, status, price_paise, sku, inventory_quantity, inventory_policy, net_weight_g) VALUES (?, 'sub-trial-kit', 'Sub Tasting Kit', 'draft', 80000, 'KIT-SUB-01', 50, 'track', 200)`).run(trialId);
  for (let i = 0; i < 4; i++) {
    db.prepare(`INSERT INTO trial_components (id, trial_id, slot_index, name) VALUES (?, ?, ?, ?)`).run(`comp_${i}`, trialId, i, `Component ${i}`);
  }
  db.prepare("UPDATE trials SET status='published' WHERE id=?").run(trialId);
  for (const id of [customerId,otherId]) db.prepare('INSERT INTO customers(id,email) VALUES (?,?)').run(id, `${id}@example.invalid`);
  const { saveConfig, saveMarket } = await import('@/lib/international/store');
  saveConfig('package', { pickupPostcode: '734005', pickupLocation: 'Test', length: 10, breadth: 10, height: 10, tareGrams: 100, maxGrams: 5000, hsn: '090230', origin: 'IN' });
  saveMarket({ code: 'IN', name: 'India', covered: true, enabled: true, taxApproved: true, taxInclusive: true, taxPercent: 5, shipping: 'flat', cod: { enabled: true, postcodes: ['734005'], minPaise: 0, maxPaise: 500000, feePaise: 5000, blockedSkus: [] } }, 'test');
  service = await import('@/lib/subscriptions/service'); store = await import('@/lib/subscriptions/store'); orders = await import('@/lib/international/orders'); providers = await import('@/lib/international/providers');
});
beforeEach(() => {
  vi.restoreAllMocks();
  for (const table of ['tea_subscription_events','tea_subscription_cycles','tea_subscriptions','tea_trial_reservations','commerce_shipments','commerce_coupon_holds','commerce_reservations','commerce_orders','commerce_quotes','commerce_events','commerce_jobs']) db.prepare(`DELETE FROM ${table}`).run();
  db.prepare('UPDATE variants SET price_paise=100000,stock=100 WHERE id=?').run(variantId);
  db.prepare("UPDATE trials SET inventory_quantity=50,price_paise=80000,status='published' WHERE id=?").run(trialId);
  db.prepare("UPDATE products SET is_enabled=1,status='published' WHERE id=(SELECT product_id FROM variants WHERE id=?)").run(variantId);
  db.prepare('UPDATE commerce_config SET document=? WHERE key=?').run(JSON.stringify({ enabled: true, renewalsEnabled: true, baseBps: 1000, prepaidBps: 500, version: 1 }), 'subscriptions');
  for (const [k,v] of [['free_shipping_enabled','1'],['free_shipping_threshold_paise','90000'],['shipping_flat_fee_paise','9900'],['upi_discount_enabled','1'],['upi_discount_value','50'],['shiprocket_order_creation_mode','manual']]) db.prepare('INSERT INTO store_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v);
  vi.spyOn(providers,'shippingRate').mockResolvedValue({ id: 'test-courier', costPaise: 9900, expires: Date.now() + 900000, cod: true, ddp: false, dutiesPaise: 0 });
  vi.spyOn(providers,'razorpay').mockImplementation(async (path, raw) => {
    if (path.endsWith('/refund')) return { id: `rfnd_${randomUUID()}` };
    const value = raw as { amount: number; currency: string };
    return { id: `order_${randomUUID().replaceAll('-','')}`, amount: value.amount, currency: value.currency };
  });
});
afterAll(() => { vi.restoreAllMocks(); db?.close(); rmSync(dir, { recursive: true, force: true }); });

describe('subscription pricing and dates', () => {
  it('adds percentages on product value and uses integer rounding', () => {
    expect(discounts(100000,1000,500,true)).toEqual({ base:10000,extra:5000,net:85000 });
    expect(discounts(19901,1000,500,false)).toEqual({ base:1990,extra:0,net:17911 });
    expect(() => discounts(100,9000,1000,true)).toThrow();
    expect(policySchema.safeParse({ enabled:true,renewalsEnabled:true,baseBps:-1,prepaidBps:0,version:1 }).success).toBe(false);
  });
  it.each(intervals)('supports an exact %i-day cadence across year boundaries', days => {
    const start = dispatchDate('2026-12-30'); expect(nextDispatch(start,days)).toBe(start + days * DAY);
  });
  it('handles leap days and reanchors a delayed dispatch', () => {
    expect(istDate(dispatchDate('2028-02-29'))).toBe('2028-02-29');
    expect(() => dispatchDate('2026-02-29')).toThrow();
    expect(nextDispatch(1000,3,5000)).toBe(5000+3*DAY);
  });
  it('prices prepaid vs COD, shipping after both discounts, without standard payment stacking', async () => {
    const prepaid = await service.previewSubscription({ input: { ...input(), method:'upi' }, intervalDays:3,dispatchDate:istDate() },customerId);
    expect(prepaid.subscriptionDiscountPaise).toBe(10000); expect(prepaid.paymentDiscountPaise).toBe(5000); expect(prepaid.shippingPaise).toBe(9900); expect(prepaid.totalPaise).toBe(94900);
    const cod = await service.previewSubscription({ input: { ...input(), method:'cod' },intervalDays:60,dispatchDate:istDate() },customerId);
    expect(cod.shippingPaise).toBe(0); expect(cod.paymentDiscountPaise).toBe(0); expect(cod.totalPaise).toBe(95000);
  });
  it('rejects coupons and client price fields', async () => {
    await expect(service.previewSubscription({ input:{ ...input(),coupon:'TEA10' },intervalDays:7,dispatchDate:istDate() },customerId)).rejects.toThrow('Coupons');
    await expect(service.previewSubscription({ input:{ ...input(),price:1 },intervalDays:7,dispatchDate:istDate() },customerId)).rejects.toThrow();
  });
  it('requires active configuration and an allowed interval', async () => {
    db.prepare('UPDATE commerce_config SET document=? WHERE key=?').run(JSON.stringify({...store.subscriptionPolicy(),enabled:false}), 'subscriptions');
    await expect(enroll()).rejects.toThrow('not enabled');
    await expect(service.previewSubscription({ input:input(),intervalDays:5,dispatchDate:istDate() },customerId)).rejects.toThrow();
  });
});

describe('renewal correctness', () => {
  it('enrolls once, snapshots consent/rates and prevents foreign-account access', async () => {
    const e = await enroll(); expect(store.subscriptionList(customerId)).toHaveLength(1); expect(store.subscriptionList(otherId)).toHaveLength(0);
    expect(() => store.plan(e.id,otherId)).toThrow('not found');
    const p = store.plan(e.id); expect(JSON.parse(p.document).consent).toContain('COD');
    store.saveSubscriptionPolicy({...store.subscriptionPolicy(),baseBps:2000});
    expect(JSON.parse(store.plan(e.id).document).policy.baseBps).toBe(1000);
    await expect(service.previewCycle({cycleId:e.c.id,method:'prepaid'},otherId)).rejects.toThrow();
    expect(() => service.enrollSubscription({quoteId:e.q.id,idempotencyKey:randomUUID(),consent:true},customerId)).toThrow();
  });
  it('replays enrollment and payment without duplicate stock or orders', async () => {
    const q=await service.previewSubscription({input:input(),intervalDays:7,dispatchDate:istDate()},customerId), key=randomUUID();
    const a=service.enrollSubscription({quoteId:q.id,idempotencyKey:key,consent:true},customerId), b=service.enrollSubscription({quoteId:q.id,idempotencyKey:key,consent:true},customerId); expect(a).toEqual(b);
    const c=store.openCycle(a.subscriptionId)!, first=await pay(c.id);
    const replay=await service.commitCycle({quoteId:first.q.id,cycleRevision:first.q.cycleRevision},customerId);
    expect(replay.orderId).toBe(first.p.orderId); expect(db.prepare('SELECT stock FROM variants WHERE id=?').get(variantId)).toEqual({stock:99});
  });
  it('creates automatic COD renewals once and preserves COD liability', async () => {
    const e=await enroll('cod'); db.prepare('UPDATE tea_subscription_cycles SET due_ms=? WHERE id=?').run(Date.now()-1000,e.c.id);
    await Promise.all([service.subscriptionTick(),service.subscriptionTick()]);
    const c=store.cycle(e.c.id); expect(c.status).toBe('ready'); expect(orders.liveOrder(c.order_id!).payment_status).toBe('cod_due');
    expect(db.prepare('SELECT COUNT(*) AS n FROM commerce_orders').get()).toEqual({n:1});
  });
  it('does not create future COD orders early or catch-up bursts', async () => {
    const e=await enroll('cod'); db.prepare('UPDATE tea_subscription_cycles SET due_ms=? WHERE id=?').run(Date.now()+DAY,e.c.id);
    await service.subscriptionTick(); expect(store.cycle(e.c.id).order_id).toBeNull();
    db.prepare('UPDATE tea_subscription_cycles SET due_ms=? WHERE id=?').run(Date.now()-30*DAY,e.c.id);
    await service.subscriptionTick(); await service.subscriptionTick(); expect(db.prepare('SELECT COUNT(*) AS n FROM tea_subscription_cycles').get()).toEqual({n:1});
  });
  it('holds a COD price increase for customer acceptance', async () => {
    const e=await enroll('cod'); db.prepare('UPDATE variants SET price_paise=150000 WHERE id=?').run(variantId);
    db.prepare('UPDATE tea_subscription_cycles SET due_ms=? WHERE id=?').run(Date.now()-1000,e.c.id);
    await service.subscriptionTick(); expect(store.plan(e.id).status).toBe('action_required'); expect(store.cycle(e.c.id).order_id).toBeNull();
  });
  it('switches to COD with a fresh total and refunds any old late capture without second fulfillment', async () => {
    const e=await enroll(), old=await pay(e.c.id), cod=await pay(e.c.id,'cod');
    expect(cod.p.amount).toBe(95000); expect(orders.liveOrder(old.p.orderId).payment_status).toBe('cancelled');
    capture(old.p); expect(orders.liveOrder(old.p.orderId).payment_status).toBe('paid_exception');
    expect(orders.liveOrder(cod.p.orderId).payment_status).toBe('cod_due');
    expect(store.cycle(e.c.id).order_id).toBe(cod.p.orderId);
    expect(db.prepare("SELECT COUNT(*) AS n FROM commerce_jobs WHERE kind='subscription_refund'").get()).toEqual({n:1});
    expect(db.prepare('SELECT stock FROM variants WHERE id=?').get(variantId)).toEqual({stock:99});
  });
  it('cannot switch a renewal whose payment was already captured', async () => {
    const e=await enroll(), paid=await pay(e.c.id); capture(paid.p);
    await expect(pay(e.c.id,'cod')).rejects.toThrow('already received');
    capture(paid.p); expect(store.cycle(e.c.id).status).toBe('ready');
  });
  it('invalidates an expired stock hold and supports a fresh payment generation', async () => {
    const e=await enroll(), old=await pay(e.c.id);
    db.prepare('UPDATE commerce_orders SET reserved_until=0 WHERE id=?').run(old.p.orderId); orders.releaseExpired();
    await expect(service.existingPayment(e.c.id,customerId)).rejects.toThrow('expired');
    const fresh=await pay(e.c.id); expect(fresh.p.orderId).not.toBe(old.p.orderId); expect(store.cycle(e.c.id).generation).toBe(2);
    capture(old.p); expect(orders.liveOrder(old.p.orderId).payment_status).toBe('paid_exception');
  });
  it('requires a valid capture amount and ignores redirects as payment authority', async () => {
    const e=await enroll(), paid=await pay(e.c.id); expect(store.cycle(e.c.id).status).toBe('awaiting_payment');
    expect(() => orders.applyPaymentEvent(randomUUID(),{event:'payment.captured',payload:{payment:{entity:{id:'pay_forged',order_id:paid.p.gatewayOrderId,amount:1,currency:'INR',status:'captured'}}}})).toThrow('amount');
    expect(store.cycle(e.c.id).status).toBe('awaiting_payment');
  });
  it('rejects unavailable products and stock contention', async () => {
    const e=await enroll(); db.prepare('UPDATE variants SET stock=0 WHERE id=?').run(variantId); await expect(pay(e.c.id)).rejects.toThrow('unavailable');
    db.prepare('UPDATE variants SET stock=1 WHERE id=?').run(variantId); const q=await service.previewCycle({cycleId:e.c.id,method:'prepaid'},customerId); db.prepare('UPDATE variants SET stock=0 WHERE id=?').run(variantId);
    await expect(service.commitCycle({quoteId:q.id,cycleRevision:q.cycleRevision},customerId)).rejects.toThrow('availability changed');
  });
  it('stops scheduled generation with the global renewal control', async () => {
    const e=await enroll('cod'); db.prepare('UPDATE tea_subscription_cycles SET due_ms=0 WHERE id=?').run(e.c.id); store.saveSubscriptionPolicy({...store.subscriptionPolicy(),renewalsEnabled:false}); await service.subscriptionTick(); expect(store.cycle(e.c.id).order_id).toBeNull();
  });
});

describe('customer changes and dispatch', () => {
  it('skips exactly once, releases stock and advances one interval', async () => {
    const e=await enroll(), paid=await pay(e.c.id), p=store.plan(e.id);
    await service.changeSubscription({action:'skip',id:e.id,revision:p.revision},customerId); expect(store.cycle(e.c.id).status).toBe('change_pending');
    await service.finishCycleChange(e.c.id,'skip'); await service.finishCycleChange(e.c.id,'skip');
    expect(store.cycle(e.c.id).status).toBe('skipped'); expect(store.plan(e.id).next_ms).toBe(e.c.due_ms+7*DAY); expect(orders.liveOrder(paid.p.orderId).payment_status).toBe('cancelled'); expect(db.prepare('SELECT stock FROM variants WHERE id=?').get(variantId)).toEqual({stock:100});
  });
  it('holds paid cancellations, requests one refund and waits for refund webhook', async () => {
    const e=await enroll(), paid=await pay(e.c.id); capture(paid.p);
    await service.changeSubscription({action:'cancel',id:e.id,revision:store.plan(e.id).revision,cancelCurrent:true},customerId); await service.finishCycleChange(e.c.id,'cancel');
    expect(orders.liveOrder(paid.p.orderId).fulfillment_status).toBe('cancelled');
    await service.refundSubscriptionOrder(paid.p.orderId); await service.refundSubscriptionOrder(paid.p.orderId);
    expect(providers.razorpay).toHaveBeenCalledTimes(2); expect(orders.liveOrder(paid.p.orderId).payment_status).toBe('paid');
    orders.applyPaymentEvent(randomUUID(),{event:'refund.processed',payload:{refund:{entity:{id:'rfnd_verified',payment_id:orders.liveOrder(paid.p.orderId).gateway_payment_id,amount:paid.p.amount,status:'processed'}}}});
    expect(orders.liveOrder(paid.p.orderId).payment_status).toBe('refunded');
  });
  it('cancels future renewals while preserving an accepted current shipment', async () => {
    const e=await enroll('cod'), accepted=await pay(e.c.id,'cod');
    await service.changeSubscription({action:'cancel',id:e.id,revision:store.plan(e.id).revision,cancelCurrent:false},customerId);
    expect(store.plan(e.id).status).toBe('cancelled'); expect(store.cycle(e.c.id).status).toBe('ready'); expect(orders.liveOrder(accepted.p.orderId).payment_status).toBe('cod_due');
  });
  it('changes frequency and dispatch date without mutating an accepted current total', async () => {
    const e=await enroll('cod'), accepted=await pay(e.c.id,'cod');
    await service.changeSubscription({action:'update',id:e.id,revision:store.plan(e.id).revision,intervalDays:14,dispatchDate:istDate(Date.now()+2*DAY),method:'cod'},customerId);
    expect(JSON.parse(store.plan(e.id).document).intervalDays).toBe(14); expect(orders.liveOrder(accepted.p.orderId).document).toContain('95000');
    const guards=await import('@/lib/subscriptions/guards'); expect(() => guards.subscriptionFulfillmentGate(JSON.parse(orders.liveOrder(accepted.p.orderId).document),accepted.p.orderId)).toThrow('not ready');
  });
  it('pauses/resumes with a new date and rejects stale revisions', async () => {
    const e=await enroll(), p=store.plan(e.id);
    await service.changeSubscription({action:'pause',id:e.id,revision:p.revision},customerId);
    await expect(service.changeSubscription({action:'skip',id:e.id,revision:p.revision},customerId)).rejects.toThrow('changed');
    await service.changeSubscription({action:'update',id:e.id,revision:store.plan(e.id).revision,intervalDays:30,dispatchDate:istDate(Date.now()+DAY),method:'prepaid'},customerId); expect(store.plan(e.id).status).toBe('active');
  });
  it('serializes changes against shipment claims and closes only at handover', async () => {
    const e=await enroll('cod'), accepted=await pay(e.c.id,'cod'); db.prepare('UPDATE tea_subscription_cycles SET due_ms=0 WHERE id=?').run(e.c.id);
    const guards=await import('@/lib/subscriptions/guards'), q=JSON.parse(orders.liveOrder(accepted.p.orderId).document);
    guards.claimSubscriptionFulfillment(q,accepted.p.orderId); await expect(service.changeSubscription({action:'skip',id:e.id,revision:store.plan(e.id).revision},customerId)).rejects.toThrow('operation');
    guards.releaseSubscriptionFulfillment(q); guards.subscriptionHandover(q,accepted.p.orderId); expect(store.cycle(e.c.id).status).toBe('dispatched');
    expect(store.plan(e.id).next_ms).toBeGreaterThan(Date.now()+6*DAY);
  });
  it('cancels a booked carrier shipment before releasing inventory', async () => {
    const e=await enroll('cod'), accepted=await pay(e.c.id,'cod'); db.prepare("INSERT INTO commerce_shipments(order_id,document,status,updated_ms) VALUES (?,?,'booked',?)").run(accepted.p.orderId,JSON.stringify({order_id:123,shipment_id:456}),Date.now());
    const call=vi.spyOn(providers,'shippingRequest').mockRejectedValueOnce(new Error('timeout'));
    await service.changeSubscription({action:'skip',id:e.id,revision:store.plan(e.id).revision},customerId);
    await expect(service.finishCycleChange(e.c.id,'skip')).rejects.toThrow(); expect(store.cycle(e.c.id).status).toBe('change_pending'); expect(orders.liveOrder(accepted.p.orderId).inventory_status).toBe('reserved');
    call.mockResolvedValueOnce(null); await service.finishCycleChange(e.c.id,'skip'); expect(orders.liveOrder(accepted.p.orderId).inventory_status).toBe('released');
  });
  it('includes renewal orders in authenticated account history only', async () => {
    const e=await enroll(), accepted=await pay(e.c.id); expect(service.subscriptionOrderHistory(customerId)).toHaveLength(1); expect(service.subscriptionOrderDetails(otherId,accepted.p.orderId)).toBeNull();
    const history=await import('@/lib/customerOrders'); expect(history.listCustomerOrders(customerId,'customer@example.invalid',null).some(o=>o.id===accepted.p.orderId)).toBe(true);
  });
});

describe('subscription API authorization', () => {
  it('requires authentication, blocks cross-origin writes and rejects forged ownership', async () => {
    const routes=await import('@/app/api/subscriptions/[action]/route');
    const r=await routes.GET(new Request('http://localhost/api/subscriptions/list'),{params:Promise.resolve({action:'list'})}); expect(r.status).toBe(401);
    const post=await routes.POST(new Request('http://localhost/api/subscriptions/enroll',{method:'POST',headers:{origin:'https://attacker.invalid'},body:'{}'}),{params:Promise.resolve({action:'enroll'})}); expect(post.status).toBe(403);
    const {createCustomerSession}=await import('@/lib/customerSessions'), session=createCustomerSession(otherId), e=await enroll();
    const wrong=await routes.POST(new Request('http://localhost/api/subscriptions/quote',{method:'POST',headers:{cookie:`tf_customer_session=${session.cookieValue}`,'content-type':'application/json'},body:JSON.stringify({cycleId:e.c.id,method:'prepaid'})}),{params:Promise.resolve({action:'quote'})}); expect(wrong.status).toBe(409); expect(await wrong.text()).not.toContain('customer@example');
  });
  it('protects admin settings and exposes only public policy data', async () => {
    const routes=await import('@/app/api/subscriptions/[action]/route'), admin=await import('@/app/api/admin/subscriptions/route');
    const policy=await routes.GET(new Request('http://localhost/api/subscriptions/policy'),{params:Promise.resolve({action:'policy'})}); expect(policy.status).toBe(200); expect(await policy.text()).not.toContain('customer');
    expect((await admin.GET(new Request('http://localhost/api/admin/subscriptions'))).status).toBe(401);
  });
  it('supports subscriptionListPaginated with status and cadence filters', async () => {
    const list = store.subscriptionListPaginated({ page: 1, pageSize: 5 });
    expect(list.pagination).toBeDefined();
    expect(list.pagination.page).toBe(1);
    expect(list.pagination.pageSize).toBe(5);
    expect(Array.isArray(list.subscriptions)).toBe(true);

    const filtered = store.subscriptionListPaginated({ status: 'active', intervalDays: 7 });
    expect(filtered.pagination.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(filtered.subscriptions)).toBe(true);
  });
});

describe('all products: tasting kits and edge cases', () => {
  const trialInput = (method = 'prepaid') => ({
    address: { name: 'Test Customer', email: 'customer@example.invalid', phone: '+919999999999', line1: '123 Test Street', line2: '', city: 'Siliguri', state: 'West Bengal', postcode: '734005', country: 'IN' },
    currency: 'INR', locale: 'en', method,
    items: [{ variantId: 0, trialId, quantity: 1 }],
  });

  it('allows customers to subscribe to tasting kits with subscription and prepaid discounts', async () => {
    const preview = await service.previewSubscription({ input: trialInput('upi'), intervalDays: 14, dispatchDate: istDate() }, customerId);
    expect(preview.subscriptionDiscountPaise).toBe(8000);
    expect(preview.paymentDiscountPaise).toBe(4000);
    expect(preview.shippingPaise).toBe(9900);
    expect(preview.totalPaise).toBe(77900);

    const enrollment = service.enrollSubscription({ quoteId: preview.id, idempotencyKey: randomUUID(), consent: true }, customerId);
    const plan = store.plan(enrollment.subscriptionId);
    expect(plan.id).toBe(enrollment.subscriptionId);

    const c = store.openCycle(plan.id)!;
    const payment = await pay(c.id, 'prepaid');
    expect(payment.p.orderId).toBeDefined();
    expect(db.prepare("SELECT inventory_quantity FROM trials WHERE id=?").get(trialId)).toEqual({ inventory_quantity: 49 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM tea_trial_reservations WHERE trial_id=?").get(trialId)).toEqual({ n: 1 });

    const cod = await pay(c.id, 'cod');
    // COD: 80000 - 8000 base discount = 72000 merchandise + 9900 shipping + 5000 COD fee = 86900
    expect(cod.p.amount).toBe(86900);
    expect(db.prepare("SELECT inventory_quantity FROM trials WHERE id=?").get(trialId)).toEqual({ inventory_quantity: 49 });

    await service.changeSubscription({ action: 'skip', id: plan.id, revision: store.plan(plan.id).revision }, customerId);
    await service.finishCycleChange(c.id, 'skip');
    expect(db.prepare("SELECT inventory_quantity FROM trials WHERE id=?").get(trialId)).toEqual({ inventory_quantity: 50 });
  });

  it('rejects subscription for tasting kit if kit is out of stock', async () => {
    db.prepare("UPDATE trials SET inventory_quantity=0 WHERE id=?").run(trialId);
    await expect(service.previewSubscription({ input: trialInput('prepaid'), intervalDays: 30, dispatchDate: istDate() }, customerId)).rejects.toThrow('unavailable');
  });
});
