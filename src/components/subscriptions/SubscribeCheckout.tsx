'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { intervals, istDate, CONSENT, type Policy } from '@/lib/subscriptions/model';
import type { QuoteLine } from '@/lib/international/models';
import { subscriptionRequest, money, dateLabel } from './shared';
import { generateUUID } from '@/lib/uuid';
import styles from './Subscriptions.module.css';
type InitialItem = { trialId?: string; variantId: number; quantity: number; name: string; grams: number };
type Preview = { id: string; totalPaise: number; subtotalPaise: number; shippingPaise: number; subscriptionDiscountPaise: number; paymentDiscountPaise: number; lines: QuoteLine[]; dueMs: number; expires: number; policy: Policy };
export function PriceBreakdown({ quote }: { quote: Omit<Preview, 'policy' | 'dueMs' | 'expires'> }) {
  return <><dl className={styles.breakdown}><dt>Products</dt><dd>{money(quote.subtotalPaise)}</dd><dt>Subscription savings</dt><dd>−{money(quote.subscriptionDiscountPaise)}</dd><dt>Extra prepaid savings</dt><dd>−{money(quote.paymentDiscountPaise)}</dd><dt>Delivery</dt><dd>{money(quote.shippingPaise)}</dd><dt><strong>Total including applicable fees/taxes</strong></dt><dd><strong>{money(quote.totalPaise)}</strong></dd></dl><p className={styles.note}>Savings apply to products. Delivery is calculated after discounts; COD fees may apply. Coupons and other prepaid offers cannot be combined.</p></>;
}
export function SubscribeCheckout({ initialItem }: { initialItem?: InitialItem }) {
  const cart = useCart(), key = useRef('');
  const [customer, setCustomer] = useState<{ name: string | null; email: string; phone: string | null } | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null), [created, setCreated] = useState('');
  const items = initialItem ? [initialItem] : cart.items;
  useEffect(() => { let active = true; Promise.all([fetch('/api/customer/me').then(r => r.ok ? r.json() : null), subscriptionRequest('policy')]).then(([me, p]) => { if (active) { setCustomer(me?.customer || null); setPolicy(p.policy); } }).catch(() => { if (active) setError('Could not load subscription settings. Reload to retry.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const address = Object.fromEntries(['name','email','phone','line1','line2','city','state','postcode','country'].map(k => [k, f.get(k) || '']));
      const input = { address, currency: 'INR', locale: 'en', method: f.get('method'), items: items.map(i => ({ variantId: i.variantId, ...(i.trialId ? { trialId: i.trialId } : {}), quantity: i.quantity })) };
      const q = await subscriptionRequest('preview', { input, intervalDays: Number(f.get('interval')), dispatchDate: f.get('date') });
      key.current = generateUUID(); setPreview(q);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to review subscription.'); } finally { setBusy(false); }
  }
  async function enroll() { if (!preview) return; setBusy(true); setError(''); if (!key.current) key.current = generateUUID(); try { const result = await subscriptionRequest('enroll', { quoteId: preview.id, idempotencyKey: key.current, consent: true }); setCreated(result.subscriptionId); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create subscription.'); } finally { setBusy(false); } }
  if (loading) return <div className={styles.page}><p role="status">Loading subscription options…</p></div>;
  return <div className={styles.page}><Link href="/shop">← Shop teas</Link><p className="eyebrow">TeaFloww replenishment</p><h1>Your tea, on your schedule.</h1><p>Choose a shipment every 3, 7, 14, 30 or 60 days. Pay each prepaid renewal manually or authorize scheduled COD orders.</p>
    {error && <p role="alert" className={styles.message}>{error}</p>}
    {created ? <section className={styles.card}><h2>Subscription created</h2><p>Your first renewal is ready to review. Prepaid orders wait for verified payment; COD renewals follow your schedule.</p><Link className={styles.link} href="/account/subscriptions">Manage subscription &amp; pay →</Link></section> : !customer ? <section className={styles.card}><h2>Sign in to subscribe</h2><p>Your account keeps your schedule, payment links and cancellation controls together.</p><Link className={styles.link} href={`/login?redirect=${encodeURIComponent(initialItem ? `/subscribe?${initialItem.trialId ? `trial=${initialItem.trialId}` : `variant=${initialItem.variantId}`}&quantity=${initialItem.quantity}` : '/subscribe')}`}>Sign in or create an account</Link></section> : !policy?.enabled ? <p className={styles.message}>Subscriptions are awaiting store configuration. You can still make a one-time purchase.</p> : !items.length ? <section className={styles.card}><h2>Choose your teas first</h2><Link href="/shop">Browse products →</Link></section> : <div className={styles.grid}>
      <form className={styles.card} onSubmit={review} onChange={() => setPreview(null)}><h2>Set up your subscription</h2>
        {items.map(i => <p key={i.trialId || i.variantId}>{i.name} · {i.grams}g × {i.quantity}</p>)}
        <p className={styles.note}>This creates a separate subscription order. Your one-time bag remains available.</p>
        <div className={styles.fields}><label>Ship every<select name="interval" defaultValue="30">{intervals.map(n => <option value={n} key={n}>{n} days</option>)}</select></label><label>First dispatch date (IST)<input type="date" name="date" min={istDate()} defaultValue={istDate()} required /></label><label>Payment preference<select name="method"><option value="prepaid">Prepaid — pay each renewal</option><option value="cod">Cash on delivery</option></select></label><label>Delivery country<select name="country" defaultValue="IN"><option value="IN">India</option></select></label></div>
        <p>Save {policy.baseBps / 100}% on products, plus {policy.prepaidBps / 100}% extra when prepaid.</p>
        <div className={styles.fields}>{([['name','Full name',customer.name || ''],['email','Email',customer.email],['phone','Phone',customer.phone || ''],['line1','Address',''],['line2','Address line 2 (optional)',''],['city','City',''],['state','State',''],['postcode','PIN code','']] as const).map(([name,label,value]) => <label key={name}>{label}<input name={name} type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} defaultValue={value} required={name !== 'line2'} maxLength={name === 'email' ? 254 : 180} autoComplete={name === 'name' ? 'name' : name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'off'} /></label>)}</div>
        <button disabled={busy} type="submit">{busy ? 'Checking availability…' : 'Review exact price & schedule'}</button>
      </form>
      <section className={styles.card} aria-live="polite"><h2>Review before subscribing</h2>{preview ? <><p>First scheduled dispatch: {dateLabel(preview.dueMs)}</p><PriceBreakdown quote={preview} /><p className={styles.note}>Quote expires at {new Date(preview.expires).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Payment and stock are checked again at renewal.</p><form onSubmit={e => { e.preventDefault(); void enroll(); }}><label className={styles.check}><input type="checkbox" required /> <span>{CONSENT}</span></label><div className={styles.actions}><button disabled={busy} type="submit">{busy ? 'Saving…' : 'Create subscription'}</button></div></form></> : <p>Enter your delivery details to see stock-checked prices, savings and delivery charges. No payment is taken when creating the plan.</p>}</section>
    </div>}
  </div>;
}
