import { getDb } from '@/lib/db';
import { CommerceError, type QuoteLine } from '@/lib/international/models';
/** Kits have their own packed-kit inventory; component catalog stock is independent. */
export function reserveTrialLine(line: QuoteLine) {
  const changed = getDb().prepare("UPDATE trials SET inventory_quantity=inventory_quantity-?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='published' AND price_paise=? AND inventory_policy=? AND (inventory_policy!='track' OR inventory_quantity>=?) AND (SELECT COUNT(*) FROM trial_components WHERE trial_id=trials.id)=4").run(line.trialTracked ? line.quantity : 0, line.trialId!, line.pricePaise, line.trialTracked ? 'track' : 'continue', line.quantity);
  if (changed.changes !== 1) throw new CommerceError('A tasting kit price or availability changed. Review a fresh quote.');
}
/** Called only after the order's inventory release claim succeeds. */
export function releaseTrialReservations(orderId: string) {
  const db = getDb();
  const rows = db.prepare('SELECT trial_id,quantity FROM tea_trial_reservations WHERE order_id=?').all(orderId) as { trial_id: string; quantity: number }[];
  for (const r of rows) db.prepare('UPDATE trials SET inventory_quantity=inventory_quantity+?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(r.quantity, r.trial_id);
}
