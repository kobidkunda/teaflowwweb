import { cookies } from "next/headers";
import Link from "next/link";
import { quoteAnalytics } from "@/lib/international/analytics";
import { notFound } from "next/navigation";
import { liveOrder, validGuestToken } from "@/lib/international/orders";
import { convertPaise, currencyDigits, formatMoney } from "@/lib/international/money";
import type { Quote } from "@/lib/international/models";
import { PurchaseStatus } from "@/components/international/PurchaseStatus";
import { OrderPurchaseTracker } from "@/components/analytics/OrderPurchaseTracker";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import {
  CheckCircle2,
  Package,
  MapPin,
  Truck,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Order Confirmed · TeaFloww",
  description: "Your Himalayan orthodox tea order has been confirmed.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: "no-referrer" as const,
};

export default async function PurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const token = query.token || (await cookies()).get("tf_order_access")?.value || "";

  if (!validGuestToken(id, token)) notFound();

  let order;
  try {
    order = liveOrder(id);
  } catch {
    notFound();
  }

  const q = JSON.parse(order.document) as Quote;
  const isConfirmed = order.payment_status === "paid" || order.payment_status === "cod_due";
  const divisor = 10 ** currencyDigits(q.currency);

  const items = (q.lines || []).map((line) => ({
    item_id: line.sku || String(line.variantId),
    item_name: line.name,
    price: convertPaise(line.pricePaise, q.rate, q.currency) / divisor,
    quantity: line.quantity,
  }));

  const reference = id.slice(0, 8).toUpperCase();
  const formatCur = (minor: number) => formatMoney(minor, q.currency, q.input.locale);
  const addr = q.input.address;

  const paymentMethodLabel: Record<string, string> = {
    cod: "Cash on Delivery",
    upi: "UPI / QR Payment",
    card: "Credit / Debit Card",
    netbanking: "NetBanking",
    prepaid: "Online Prepaid",
  };

  return (
    <div className="container page-shell py-8 sm:py-12 max-w-5xl mx-auto px-4 sm:px-6">
      {isConfirmed && (
        <OrderPurchaseTracker
          orderId={id}
          totalMinor={q.totalMinor}
          shippingMinor={q.components.shipping}
          taxMinor={q.components.tax + q.components.duties}
          currency={q.currency}
          items={items}
        />
      )}

      {/* Breadcrumb Navigation */}
      <nav className="breadcrumbs mb-4 text-xs text-[#737067]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#171713] transition-colors">
          Teafloww
        </Link>{" "}
        /{" "}
        <Link href="/cart" className="hover:text-[#171713] transition-colors">
          Bag
        </Link>{" "}
        /{" "}
        <Link href="/checkout" className="hover:text-[#171713] transition-colors">
          Checkout
        </Link>{" "}
        / <span className="text-[#171713] font-bold" aria-current="page">Confirmation</span>
      </nav>

      {/* Checkout Progress Stepper */}
      <div className="mb-8">
        <CheckoutSteps currentStep={3} />
      </div>

      {/* Hero Success Confirmation Card */}
      <div className="p-6 sm:p-8 rounded-2xl border border-[#ded7cb] bg-white shadow-sm mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="w-16 h-16 rounded-full bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center flex-shrink-0 shadow-xs ring-8 ring-[#f1f8f3]">
          <CheckCircle2 size={36} strokeWidth={2.4} aria-hidden="true" />
        </div>

        <div className="flex-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#b39156] mb-1">
            TeaFloww · Direct-from-Origin Harvest
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-[#171713] font-normal leading-tight">
            {order.payment_status === "cod_due"
              ? "Your order is confirmed."
              : "Thank you for your order."}
          </h1>
          <p className="text-sm text-[#5c6659] mt-2 max-w-2xl">
            {order.payment_status === "cod_due"
              ? `We have received your cash-on-delivery order. Please keep the exact amount ready upon delivery.`
              : `Payment received. Our tea masters at our Siliguri estate hub are preparing your freshly harvested orthodox teas for dispatch within 24–48 hours.`}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4 pt-4 border-t border-[#f0ede6]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f6f1e7] border border-[#ded7cb] text-xs font-mono font-bold text-[#171713]">
              <span>Reference:</span>
              <span className="text-[#23483a]">TF-{reference}</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                order.payment_status === "paid"
                  ? "bg-[#e8f5e9] text-[#2e7d32]"
                  : order.payment_status === "cod_due"
                  ? "bg-[#fff8e1] text-[#b39156]"
                  : "bg-[#e8f0fe] text-[#1565c0]"
              }`}
            >
              {order.payment_status === "paid"
                ? "Paid"
                : order.payment_status === "cod_due"
                ? "Payment Due on Delivery"
                : "Payment Processing"}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Order Status & Tracking Banner */}
      <PurchaseStatus
        id={id}
        token={token}
        initial={order.payment_status}
        analytics={quoteAnalytics(q)}
      />

      {/* Two Column Order Details Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Tea Items & Destination */}
        <div className="lg:col-span-7 space-y-6">
          {/* Ordered Items List */}
          <section
            className="p-6 rounded-2xl border border-[#ded7cb] bg-white shadow-sm"
            aria-label="Ordered teas"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ede6] mb-4">
              <h2 className="text-lg font-serif text-[#171713] flex items-center gap-2">
                <Package size={18} className="text-[#23483a]" aria-hidden="true" />
                <span>Teas in this shipment ({q.lines.length})</span>
              </h2>
            </div>

            <ul className="divide-y divide-[#f0ede6]" role="list">
              {q.lines.map((line, idx) => {
                const lineTotalMinor = convertPaise(
                  line.pricePaise * line.quantity,
                  q.rate,
                  q.currency
                );

                return (
                  <li key={line.variantId || idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-semibold text-[#171713]">
                          {line.name}
                        </strong>
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#f6f1e7] text-[#5c6659] border border-[#ded7cb]">
                          {line.grams}g
                        </span>
                      </div>
                      <p className="text-xs text-[#737067] mt-0.5">
                        Quantity: <span className="font-semibold text-[#171713]">{line.quantity}</span>
                        {line.sku ? ` · SKU: ${line.sku}` : ""}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#171713]">
                        {formatCur(lineTotalMinor)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Delivery Address Destination Card */}
          <section
            className="p-6 rounded-2xl border border-[#ded7cb] bg-white shadow-sm"
            aria-label="Delivery destination"
          >
            <div className="flex items-center gap-2 pb-4 border-b border-[#f0ede6] mb-4">
              <MapPin size={18} className="text-[#23483a]" aria-hidden="true" />
              <h2 className="text-lg font-serif text-[#171713]">Delivery Destination</h2>
            </div>

            <div className="text-sm text-[#171713] leading-relaxed">
              <p className="font-bold">{addr.name}</p>
              <p className="text-[#5c6659]">{addr.line1}</p>
              {addr.line2 ? <p className="text-[#5c6659]">{addr.line2}</p> : null}
              <p className="text-[#5c6659]">
                {addr.city}, {addr.state} — <strong className="text-[#171713]">{addr.postcode}</strong>
              </p>
              <p className="text-[#737067] text-xs mt-1 uppercase font-semibold">
                {addr.country === "IN" ? "India" : addr.country}
              </p>

              <div className="mt-4 pt-3 border-t border-[#f0ede6] flex flex-wrap gap-4 text-xs text-[#5c6659]">
                {addr.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-[#b39156]" aria-hidden="true" />
                    <span>{addr.phone}</span>
                  </span>
                )}
                {addr.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-[#b39156]" aria-hidden="true" />
                    <span>{addr.email}</span>
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Sourcing & Provenance Guarantee */}
          <div className="p-5 rounded-2xl border border-[#ded7cb] bg-[#faf7f2] flex items-start gap-4">
            <Sparkles size={20} className="text-[#b39156] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-[#5c6659] leading-relaxed">
              <strong className="text-[#171713] block mb-1">
                Direct Single-Estate Provenance Guarantee
              </strong>
              Your tea is packed at origin in airtight, nitrogen-flushed barrier pouches to preserve volatile mountain aromatics, direct from our Siliguri processing works.
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Receipt & Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Summary Receipt Card */}
          <div className="p-6 rounded-2xl border border-[#ded7cb] bg-white shadow-sm">
            <h2 className="text-lg font-serif text-[#171713] pb-4 border-b border-[#f0ede6] mb-4">
              Payment & Receipt
            </h2>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between text-[#5c6659]">
                <dt>Merchandise Subtotal</dt>
                <dd className="font-medium text-[#171713]">{formatCur(q.components.merchandise)}</dd>
              </div>

              <div className="flex justify-between text-[#5c6659]">
                <dt>Express Delivery</dt>
                <dd className="font-medium text-[#171713]">
                  {q.components.shipping === 0 ? (
                    <span className="text-[#2e7d32] font-semibold">Free Delivery</span>
                  ) : (
                    formatCur(q.components.shipping)
                  )}
                </dd>
              </div>

              {q.components.paymentDiscount ? (
                <div className="flex justify-between text-[#2e7d32]">
                  <dt>Payment Savings</dt>
                  <dd className="font-medium">−{formatCur(q.components.paymentDiscount)}</dd>
                </div>
              ) : null}

              {q.components.tax > 0 ? (
                <div className="flex justify-between text-xs text-[#737067]">
                  <dt>Includes GST (5%)</dt>
                  <dd>{formatCur(q.components.tax)}</dd>
                </div>
              ) : null}

              <div className="pt-3 border-t border-[#f0ede6] flex justify-between items-baseline">
                <dt className="text-base font-bold text-[#171713]">
                  {order.payment_status === "cod_due" ? "Total Due on Delivery" : "Total Amount Paid"}
                </dt>
                <dd className="text-xl font-bold text-[#23483a]">
                  {formatCur(q.totalMinor)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 pt-4 border-t border-[#f0ede6] flex items-center justify-between text-xs text-[#5c6659]">
              <span className="flex items-center gap-1.5">
                <CreditCard size={14} className="text-[#b39156]" aria-hidden="true" />
                <span>Method:</span>
              </span>
              <strong className="text-[#171713]">
                {paymentMethodLabel[q.input.method] || q.input.method}
              </strong>
            </div>
          </div>

          {/* Action Center Buttons */}
          <div className="p-6 rounded-2xl border border-[#ded7cb] bg-[#faf7f2] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#737067] mb-2">
              Next Steps
            </h3>

            <Link
              href={`/track?id=${id}`}
              className="w-full py-3 px-4 rounded-xl bg-[#23483a] text-white font-bold text-sm text-center flex items-center justify-center gap-2 hover:bg-[#1a362b] transition-colors shadow-xs"
            >
              <Truck size={16} aria-hidden="true" />
              <span>Track Live Shipment</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>

            <Link
              href="/account/orders"
              className="w-full py-2.5 px-4 rounded-xl border border-[#ded7cb] bg-white text-[#171713] font-semibold text-xs text-center flex items-center justify-center gap-1.5 hover:bg-[#f6f1e7] transition-colors"
            >
              <Package size={14} aria-hidden="true" />
              <span>View in My Orders</span>
            </Link>

            <Link
              href="/shop"
              className="w-full py-2 px-4 rounded-xl text-[#5c6659] text-xs text-center block hover:text-[#171713] transition-colors"
            >
              Continue Exploring Teas →
            </Link>
          </div>

          {/* Customer Care Guarantee */}
          <div className="p-5 rounded-xl border border-[#ded7cb] bg-white text-xs text-[#737067] space-y-2">
            <div className="flex items-center gap-2 text-[#171713] font-semibold">
              <ShieldCheck size={16} className="text-[#2e7d32]" aria-hidden="true" />
              <span>Need help with your order?</span>
            </div>
            <p className="leading-relaxed">
              Our customer care team is available to assist with inquiries, address changes, or special dispatch requests.
            </p>
            <p className="text-[#171713] pt-1">
              Email: <a href="mailto:info@teafloww.com" className="text-[#23483a] underline">info@teafloww.com</a> · Call: <a href="tel:+917001304853" className="text-[#23483a] underline">+91 7001304853</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
