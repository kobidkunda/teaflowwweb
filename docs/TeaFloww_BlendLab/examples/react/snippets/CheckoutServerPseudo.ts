/** DESIGN-LEVEL PSEUDOCODE — not runnable and intentionally not wired to payment. */
import type { PlanCode } from '../domain/types';

type Intake = { planCode: PlanCode; pincode: string; goals: string[]; acceptedTermsVersion: string };

export async function createProjectAndPayment(/* request: authenticated request */) {
  // 1. Identify the customer through the REAL store auth/session (never trust customerId from body).
  // 2. Parse and validate Intake on server. Resolve plan and approved version from DB.
  // 3. Check courier coverage, limits and published refund terms; fail closed if unavailable.
  // 4. Compute FINANCE-APPROVED inclusive GST server-side; ignore browser provided total.
  // 5. DB transaction: idempotency key + immutable price/terms snapshot + draft order.
  // 6. Request provider payment intent with exact amount and project reference.
  // 7. Return only provider-safe checkout token; DO NOT mark payment as paid.
  // 8. Provider signed webhook verifies raw body signature & amount, then in a transaction:
  //    deduplicate event, update payment state once, enqueue courier/sample project outbox task.
  // 9. Worker submits carrier pickup request with its OWN idempotency key.
  // 10. API read serializer returns customer-safe status only, no supplier costs/recipe ratios.
  throw new Error('Example only: integrate existing billing/auth/courier APIs before use');
}
