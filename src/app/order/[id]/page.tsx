import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { notFound } from "next/navigation";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { getPublicOrder, getPublicOrderTrackingItems } from "@/lib/storefront";
import { formatINR } from "@/lib/money";
import { OrderPurchaseTracker } from "@/components/analytics/OrderPurchaseTracker";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
export const dynamic = "force-dynamic";

const DISPATCH_STEPS = ["unfulfilled", "preparing", "shipped", "delivered"] as const;

function dispatchStepIndex(status: string | null): number {
  const i = DISPATCH_STEPS.indexOf(status as (typeof DISPATCH_STEPS)[number]);
  return i < 0 ? 0 : i;
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getPublicOrder(id);
  if (!order) notFound();
  const trackingItems = getPublicOrderTrackingItems(order.id);
  const reference = order.id.slice(0, 8).toUpperCase();
  const step = dispatchStepIndex(order.dispatch_status);
  const cancelled = order.dispatch_status === "cancelled" || order.dispatch_status === "returned";
  return <div className="container page-shell order-page">
    <OrderPurchaseTracker
      orderId={order.id}
      totalPaise={order.total_paise}
      shippingPaise={order.shipping_paise}
      taxPaise={order.tax_paise}
      items={trackingItems}
    />
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <BrandLogo variant="symbol" size={16} aria-hidden={true} />
        <span> <StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" /> </span>
      </Link> <StorefrontText id="copy_971514f7e8109f50" fallback="/ Order /" /> <span aria-current="page">{reference}</span>
    </nav>
    <CheckoutSteps currentStep={3} />
    <p className="eyebrow"> <StorefrontText id="copy_7a604f08af1a4fed" fallback="Demo order recorded" /> </p><h1> <StorefrontText id="copy_3c472af9d4791f1b" fallback="Thank you for exploring." /> </h1>
    <div className="order-success" role="status">
      <CheckCircle2 size={30} aria-hidden="true" />
      <div>
        <strong> <StorefrontText id="copy_42bcdf5003c8ff18" fallback="Your demo order is confirmed." /> </strong>
        <p> <StorefrontText id="copy_71bf90935fc231d2" fallback="Reference" /> <strong>{reference}</strong> <StorefrontText id="copy_ffcfbba40b9f1adb" fallback="— keep it to track this order. No payment was taken and no delivery will be arranged." /> </p>
      </div>
    </div>
    <div className="order-card" aria-label="Order summary">
      <p> <StorefrontText id="copy_04db5ae332e5dc58" fallback="Order reference" /> </p><strong>{reference}</strong>
      <p> <StorefrontText id="copy_755c8b2a9fb11446" fallback="Status:" /> {order.status}{order.payment_status ? ` · Payment: ${order.payment_status}` : ""}</p>
      {order.discount_paise ? <p> <StorefrontText id="copy_8d06326227308793" fallback="Coupon savings: −" /> {formatINR(order.discount_paise)}</p> : null}
      {order.tax_paise ? <p> <StorefrontText id="copy_5efcbea1ebc2e3f6" fallback="Includes GST:" /> {formatINR(order.tax_paise)}</p> : null}
      <p> <StorefrontText id="copy_321d8f967b7634ba" fallback="Demo total:" /> {formatINR(order.total_paise)} · {order.item_count} {order.item_count === 1 ? "item" : "items"}</p>
      <p> <StorefrontText id="copy_22d435a3711855db" fallback="Created:" /> {order.created_at}</p>
    </div>
    {order.dispatch_status ? (
      <section className="dispatch-tracker" aria-label="Dispatch progress">
        <h2> <StorefrontText id="copy_bfad28ea77684f6c" fallback="Where is your order?" /> </h2>
        {cancelled ? (
          <p role="status"> <StorefrontText id="copy_c2fbdb9001df93dc" fallback="This order is" /> <strong>{order.dispatch_status}</strong> <StorefrontText id="copy_1dc6b70948890635" fallback=". No delivery will be arranged for demo orders." /> </p>
        ) : (
          <ol className="dispatch-steps">
            {DISPATCH_STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined} className={i <= step ? "done" : ""}>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="micro-note"> <StorefrontText id="copy_7af109ab0606b793" fallback="Dispatch updates appear here after the store prepares your teas. Demo orders stay unfulfilled." /> </p>
      </section>
    ) : null}
    <div className="button-row">
      <Link href="/account/orders" className="button button-primary">
        View in My Orders
      </Link>
      <Link href="/shop" className="button button-outline"> <StorefrontText id="copy_ba12ecefbd575a06" fallback="Continue exploring" /> </Link>
      <Link href={`/track?id=${order.id}`} className="text-link"> <StorefrontText id="copy_496c012c7161db22" fallback="Track order ↗" /> </Link>
    </div>
  </div>;
}
