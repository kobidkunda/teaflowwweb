import Link from 'next/link';
import { getDb } from '@/lib/db';
import { enabledProductCondition } from '@/lib/productAvailability';
import { SubscribeCheckout } from '@/components/subscriptions/SubscribeCheckout';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscribe to tea · TeaFloww', robots: { index: false, follow: false } };
export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ variant?: string; trial?: string; quantity?: string }> }) {
  const p = await searchParams, id = Number(p.variant);
  let initialItem: { trialId?: string; variantId: number; quantity: number; name: string; grams: number } | undefined;
  if (p.variant) {
    const row = Number.isSafeInteger(id) && id > 0 ? getDb().prepare(`SELECT v.id AS variantId,p.name,v.grams FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND p.status='published' AND ${enabledProductCondition('p')}`).get(id) as Omit<NonNullable<typeof initialItem>, 'quantity'> | undefined : undefined;
    if (!row) return <div className="container page-shell"><h1>This tea is unavailable</h1><Link href="/shop">Choose another product</Link></div>;
    initialItem = { ...row, quantity: Math.min(20, Math.max(1, Math.floor(Number(p.quantity) || 1))) };
  }
  if (p.trial) {
    const trial = getDb().prepare("SELECT id,title,net_weight_g FROM trials WHERE id=? AND status='published'").get(p.trial) as { id: string; title: string; net_weight_g: number } | undefined;
    if (!trial) return <div className="container page-shell"><h1>This kit is unavailable</h1><Link href="/trials">Choose another kit</Link></div>;
    initialItem = { variantId: 0, trialId: trial.id, quantity: Math.min(20, Math.max(1, Math.floor(Number(p.quantity) || 1))), name: trial.title, grams: trial.net_weight_g };
  }
  return <SubscribeCheckout initialItem={initialItem} />;
}
