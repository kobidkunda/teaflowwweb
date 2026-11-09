import { guard } from "@/lib/adminHttp";
import { buildBulkPricingCsv, getBulkPricingDataset, getEffectiveGstRatePercent } from "@/lib/bulkPricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloadable CSV template with live variant prices, MRPs and stock. */
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const dataset = getBulkPricingDataset();
  const gstRate = getEffectiveGstRatePercent();
  const csv = buildBulkPricingCsv(dataset, gstRate);

  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "Content-Disposition": 'attachment; filename="bulk-pricing-template.csv"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
