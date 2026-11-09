import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { Suspense } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { LiveCheckout } from "@/components/international/LiveCheckout";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";

export const metadata = {
  title: "Checkout · Teafloww",
  description: "Complete your single-estate Himalayan tea order. Guest checkout with destination-specific delivery quotes.",
};

export default function CheckoutPage() {
  return (
    <div className="container page-shell checkout-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/"> <StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" /> </Link> / <Link href="/cart"> <StorefrontText id="copy_b053c961f2acb0b9" fallback="Bag" /> </Link> /{" "}
        <span aria-current="page"> <StorefrontText id="copy_45989de49fb7f66d" fallback="Details" /> </span>
      </nav>

      <CheckoutSteps currentStep={2} />

      <div className="checkout-page-header">
        <p className="eyebrow"> <StorefrontText id="copy_f49dadfbd77b18e2" fallback="Guest checkout · No account needed" /> </p>
        <h1> <StorefrontText id="copy_699e9d88f7f8d2b9" fallback="Almost there." /> </h1>
        <p className="page-intro"> <StorefrontText id="copy_9ffca733836e9d8e" fallback="Review your teas and delivery details, then confirm your final total before payment." /> </p>
      </div>

      <Suspense fallback={<p role="status" className="checkout-loading-state"> <StorefrontText id="copy_59e8f11478028e3d" fallback="Loading checkout…" /> </p>}>
        <LiveCheckout />
      </Suspense>

      <div className="checkout-bottom-track">
        <Link href="/track" className="back-link"> <StorefrontText id="copy_e046d92f0e1fec87" fallback="Already placed an order? Track it →" /> </Link>
      </div>
    </div>
  );
}
