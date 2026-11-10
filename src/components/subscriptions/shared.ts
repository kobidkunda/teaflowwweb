import { loadCheckout } from '@/components/checkout/razorpay';
export async function subscriptionRequest(action: string, data?: unknown) {
  const response = await fetch(`/api/subscriptions/${action}`, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to complete this request.');
  return result;
}
export type Payment = {
  orderId: string;
  token: string;
  keyId: string;
  gatewayOrderId: string | null;
  amount: number;
  currency: string;
  paymentStatus: string;
  expires: number;
  gateway?: "razorpay" | "youpi";
  checkoutUrl?: string;
};
export async function openSubscriptionPayment(p: Payment, changed: () => void) {
  if (p.paymentStatus !== 'payment_pending' || !p.gatewayOrderId) { changed(); return; }
  if (p.gateway === 'youpi' && p.checkoutUrl) {
    window.location.assign(p.checkoutUrl);
    return;
  }
  await loadCheckout();
  if (!window.Razorpay) throw new Error('Payment checkout is unavailable. Please retry.');
  const checkout = new window.Razorpay({ key: p.keyId, order_id: p.gatewayOrderId, amount: p.amount, currency: p.currency, name: 'TeaFloww', handler: () => changed(), modal: { ondismiss: changed } });
  checkout.on('payment.failed', changed);
  checkout.open();
}
export const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
export const dateLabel = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
