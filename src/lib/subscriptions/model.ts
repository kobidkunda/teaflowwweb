import { z } from 'zod';
import { quoteSchema } from '@/lib/international/models';
export const intervals = [3, 7, 14, 30, 60] as const;
export const intervalSchema = z.union([z.literal(3), z.literal(7), z.literal(14), z.literal(30), z.literal(60)]);
export const policySchema = z.object({ enabled: z.boolean(), renewalsEnabled: z.boolean(), baseBps: z.number().int().min(0).max(9900), prepaidBps: z.number().int().min(0).max(9900), version: z.number().int().positive() }).strict().refine(p => p.baseBps + p.prepaidBps < 10000, 'Combined discounts must be below 100%.');
export type Policy = z.infer<typeof policySchema>;
export const DAY = 86400000;
/** A dispatch date at 10:00 IST. Delivery arrival dates are not promised. */
export function dispatchDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid dispatch date.');
  const ms = Date.parse(`${date}T10:00:00+05:30`);
  if (!Number.isFinite(ms) || new Date(ms + 330 * 60000).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid dispatch date.');
  return ms;
}
export function istDate(ms = Date.now()) { return new Date(ms + 330 * 60000).toISOString().slice(0, 10); }
export function nextDispatch(due: number, days: number, dispatched = due) { return Math.max(due, dispatched) + intervalSchema.parse(days) * DAY; }
export function discounts(subtotal: number, baseBps: number, prepaidBps: number, prepaid: boolean) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new Error('Invalid subtotal.');
  const p = policySchema.parse({ enabled: true, renewalsEnabled: true, baseBps, prepaidBps, version: 1 });
  const base = Number((BigInt(subtotal) * BigInt(p.baseBps) + 5000n) / 10000n);
  const extra = prepaid ? Number((BigInt(subtotal) * BigInt(p.prepaidBps) + 5000n) / 10000n) : 0;
  return { base, extra, net: Math.max(0, subtotal - base - extra) };
}
export const previewSchema = z.object({ input: quoteSchema, intervalDays: intervalSchema, dispatchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
export type SubscriptionQuote = { customerId: string; policy: Policy; intervalDays: z.infer<typeof intervalSchema>; dueMs: number; cycleId?: string; generation?: number };
export type PlanDocument = { input: z.infer<typeof quoteSchema>; policy: Policy; intervalDays: z.infer<typeof intervalSchema>; acceptedTotal: number; consent: string };
export type Plan = { id: string; customer_id: string; enrollment_key: string; status: string; document: string; next_ms: number; revision: number; created_ms: number };
export type Cycle = { id: string; subscription_id: string; sequence: number; due_ms: number; status: string; method: string; order_id: string | null; quote_id: string | null; generation: number; revision: number; lease_ms: number; blocked_reason: string; created_ms: number };
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('skip'), id: z.string().uuid(), revision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('cancel'), id: z.string().uuid(), revision: z.number().int().positive(), cancelCurrent: z.boolean() }).strict(),
  z.object({ action: z.literal('pause'), id: z.string().uuid(), revision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('update'), id: z.string().uuid(), revision: z.number().int().positive(), intervalDays: intervalSchema, dispatchDate: z.string(), method: z.enum(['prepaid','cod']), address: quoteSchema.shape.address.optional(), items: quoteSchema.shape.items.optional() }).strict(),
]);
export const CONSENT = 'Subscription v1: repeat shipments at the selected interval; COD renewals are automatic at accepted prices. Prepaid requires payment each cycle. Shipping/COD fees apply. Coupons and other prepaid offers do not stack. Skip, change or cancel before handover; paid cancellations are refunded to the original method.';
