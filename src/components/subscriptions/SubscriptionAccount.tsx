'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { intervals, istDate, type PlanDocument } from '@/lib/subscriptions/model';
import { subscriptionRequest, openSubscriptionPayment, money, dateLabel } from './shared';
import { PriceBreakdown } from './SubscribeCheckout';
import styles from './Subscriptions.module.css';
export type CycleView = { id: string; sequence: number; due_ms: number; status: string; revision: number; method: string; paymentStatus: string; fulfillmentStatus: string; blocked_reason: string; totalPaise?: number; order_id: string | null; lines?: { name: string; grams: number; quantity: number }[]; refundMinor: number };
export type PlanView = PlanDocument & { id: string; status: string; nextMs: number; revision: number; cycles: CycleView[] };
type RenewalQuote = Parameters<typeof PriceBreakdown>[0]['quote'] & { cycleRevision: number; cycleId: string; method: string; expires: number };
export function SubscriptionAccount() {
  const [plans, setPlans] = useState<PlanView[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [auth, setAuth] = useState(false);
  const [quote, setQuote] = useState<RenewalQuote | null>(null), [edit, setEdit] = useState<string | null>(null), [cancel, setCancel] = useState<string | null>(null);
  const refresh = useCallback(async (openRenewalId?: string) => {
    const data = await subscriptionRequest('list');
    setPlans(data.subscriptions);
    setQuote(null);
    if (openRenewalId) {
      for (const p of data.subscriptions) {
        const c = p.cycles.find((cycle: CycleView) => cycle.id === openRenewalId);
        if (c && ['draft','awaiting_payment','ready','exception'].includes(c.status) && !['paid','partially_refunded'].includes(c.paymentStatus)) {
          try {
            const q = await subscriptionRequest('quote', { cycleId: c.id, method: c.method === 'cod' ? 'cod' : 'prepaid' });
            setQuote(q);
          } catch {}
          break;
        }
      }
    }
  }, []);
  useEffect(() => {
    fetch('/api/customer/me').then(r => {
      if (!r.ok) { setAuth(true); return; }
      const renewalParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('renewal') || undefined : undefined;
      return refresh(renewalParam);
    }).catch(() => setMessage('Could not load subscriptions. Try refreshing.')).finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => { if (!plans.some(p => p.cycles.some(c => ['awaiting_payment','change_pending'].includes(c.status)))) return; const timer = setInterval(() => { subscriptionRequest('list').then(r => setPlans(r.subscriptions)).catch(() => {}); }, 5000); return () => clearInterval(timer); }, [plans]);
  async function run(work: () => Promise<void>) { setBusy(true); setMessage(''); try { await work(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to complete this change.'); } finally { setBusy(false); } }
  const change = (data: unknown) => run(async () => { const result = await subscriptionRequest('change', data); await refresh(); setCancel(null); setEdit(null); setMessage(result.pending ? 'Change requested. Shipment is held while cancellation and any refund are processed.' : 'Subscription updated.'); });
  return <div className={styles.page}><Link href="/account">← Account</Link><p className="eyebrow">Your replenishment plans</p><h1>Tea on your terms.</h1><p>Review each renewal, pay online, skip a shipment or change your frequency. Dates are dispatch dates in IST; arrival depends on the carrier.</p>
    {message && <p role="status" className={styles.message}>{message}</p>}
    {loading ? <p role="status">Loading subscriptions…</p> : auth ? <p><Link className={styles.link} href="/login?redirect=/account/subscriptions">Sign in to manage subscriptions</Link></p> : <><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => void run(refresh)}>Refresh status</button><Link href="/shop">Choose more teas →</Link></div>{!plans.length && <section className={styles.card}><h2>No subscriptions yet</h2><p>Choose Subscribe on a product or subscribe to your bag to set up your first plan.</p></section>}
      {quote && <section className={styles.card} aria-label="Renewal price review"><h2>Review {quote.method === 'cod' ? 'cash on delivery' : 'prepaid'} renewal</h2><PriceBreakdown quote={quote} /><p>Switching to COD removes the extra prepaid savings. This choice applies to this renewal only. Review the new total before continuing.</p><p className={styles.note}>Valid until {new Date(quote.expires).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</p><div className={styles.actions}><button disabled={busy} onClick={() => void run(async () => { const payment = await subscriptionRequest('pay', { quoteId: quote.id, cycleRevision: quote.cycleRevision }); await openSubscriptionPayment(payment, () => { void refresh(); setMessage('Payment result is being verified. Shipping waits for the signed payment confirmation.'); }); await refresh(); })}>{quote.method === 'cod' ? 'Confirm COD order' : 'Continue to payment'}</button><button className={styles.secondary} disabled={busy} onClick={() => setQuote(null)}>Close review</button></div></section>}
      {plans.map(p => { const current = p.cycles.find(c => ['draft','awaiting_payment','ready','dispatching','change_pending','exception'].includes(c.status)); return <section className={styles.card} key={p.id}><h2>Every {p.intervalDays} days</h2><p>{p.status.replaceAll('_',' ')} · Next scheduled dispatch: {dateLabel(p.nextMs)}</p><p className={styles.note}>Subscription savings {p.policy.baseBps / 100}%; extra prepaid savings {p.policy.prepaidBps / 100}%. Default: {p.input.method === 'cod' ? 'COD' : 'prepaid'}. Shipping applies per shipment.</p>
        {p.input.items.map(i => <p key={i.trialId || i.variantId}>{current?.lines?.[p.input.items.indexOf(i)]?.name || `Pack #${i.variantId}`} × {i.quantity}</p>)}
        {current && <div className={styles.card}><h3>Renewal {current.sequence} · {dateLabel(current.due_ms)}</h3><p>{current.status.replaceAll('_',' ')}{current.paymentStatus ? ` · ${current.paymentStatus.replaceAll('_',' ')}` : ''}{current.totalPaise !== undefined ? ` · ${money(current.totalPaise)}` : ''}</p>{current.lines?.map((line, i) => <p key={i}>{line.name} · {line.grams}g × {line.quantity}</p>)}{current.blocked_reason && <p className={styles.message}>{current.blocked_reason}</p>}
          {['draft','awaiting_payment','ready','exception'].includes(current.status) && !['paid','partially_refunded'].includes(current.paymentStatus) && p.status !== 'paused' && p.status !== 'cancelled' && <div className={styles.actions}><button disabled={busy} onClick={() => void run(async () => { setQuote(await subscriptionRequest('quote', { cycleId: current.id, method: 'prepaid' })); })}>Review prepaid &amp; pay</button><button className={styles.secondary} disabled={busy} onClick={() => void run(async () => { setQuote(await subscriptionRequest('quote', { cycleId: current.id, method: 'cod' })); })}>Review COD price</button>{current.paymentStatus === 'payment_pending' && <button className={styles.secondary} disabled={busy} onClick={() => void run(async () => { const payment = await subscriptionRequest('resume-payment', { cycleId: current.id }); await openSubscriptionPayment(payment, () => { void refresh(); }); })}>Reopen payment</button>}</div>}
          {current.paymentStatus === 'paid' && <p>Payment verified. Shipment follows the scheduled date. Skipping before handover requests a refund to the original payment method.</p>}
        </div>}
        {p.status !== 'cancelled' && <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => void change({ action: 'skip', id: p.id, revision: p.revision })}>Skip next shipment</button><button className={styles.secondary} disabled={busy} onClick={() => { setEdit(p.id); setQuote(null); }}>Change schedule / resume</button>{p.status !== 'paused' && <button className={styles.secondary} disabled={busy} onClick={() => void change({ action: 'pause', id: p.id, revision: p.revision })}>Pause future renewals</button>}<button className={styles.secondary} disabled={busy} onClick={() => setCancel(p.id)}>Cancel subscription</button></div>}
        {edit === p.id && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void change({ action: 'update', id: p.id, revision: p.revision, intervalDays: Number(f.get('interval')), dispatchDate: f.get('date'), method: f.get('method') }); }}><h3>Choose your schedule</h3><p className={styles.note}>A current paid/COD renewal keeps its accepted price. Address or product changes require skipping that renewal first.</p><div className={styles.fields}><label>Frequency<select name="interval" defaultValue={p.intervalDays}>{intervals.map(n => <option key={n} value={n}>Every {n} days</option>)}</select></label><label>Next dispatch date (IST)<input type="date" name="date" required min={istDate()} defaultValue={istDate(Math.max(p.nextMs, Date.now()))} /></label><label>Future payment preference<select name="method" defaultValue={p.input.method === 'cod' ? 'cod' : 'prepaid'}><option value="prepaid">Prepaid</option><option value="cod">Cash on delivery</option></select></label></div><div className={styles.actions}><button disabled={busy} type="submit">Save schedule</button><button type="button" className={styles.secondary} onClick={() => setEdit(null)}>Close</button></div></form>}
        {cancel === p.id && <div className={styles.card}><h3>Choose what to cancel</h3><p>Cancelling future renewals leaves any accepted current order active. Cancelling the current shipment before handover also requests any prepaid refund.</p><div className={styles.actions}><button disabled={busy} onClick={() => void change({ action: 'cancel', id: p.id, revision: p.revision, cancelCurrent: false })}>Cancel future renewals only</button><button disabled={busy} onClick={() => void change({ action: 'cancel', id: p.id, revision: p.revision, cancelCurrent: true })}>Cancel future &amp; current shipment</button><button className={styles.secondary} onClick={() => setCancel(null)}>Keep subscription</button></div></div>}
        <details><summary>Renewal history</summary>{p.cycles.map(c => <p key={c.id}>#{c.sequence} · {dateLabel(c.due_ms)} · {c.status.replaceAll('_',' ')} · {c.paymentStatus.replaceAll('_',' ') || 'No payment yet'}{c.refundMinor > 0 ? ` · refunded ${money(c.refundMinor)}` : ''}</p>)}</details>
      </section>; })}</>}
  </div>;
}
