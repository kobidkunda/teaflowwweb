import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { Suspense } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { LiveCheckout } from "@/components/international/LiveCheckout";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { WhatsAppIcon } from "@/components/wholesale/WholesaleForm";
import { getStoreSettings } from "@/lib/storeSettings";

export const metadata = {
  title: "Checkout · Teafloww",
  description: "Complete your single-estate Himalayan tea order. Guest checkout with destination-specific delivery quotes.",
};

export default function CheckoutPage() {
  const settings = getStoreSettings();
  const whatsappRaw = settings.whatsapp_number || "+91 7001304853";
  const whatsappDigits = whatsappRaw.replace(/\D/g, "") || "917001304853";
  const whatsappDisplay = whatsappRaw.trim() || "+91 7001304853";

  return (
    <div className="container page-shell checkout-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/"> <StorefrontText id="copy_9b6432cc6a0e89e7" fallback="Teafloww" /> </Link> / <Link href="/cart"> <StorefrontText id="copy_b053c961f2acb0b9" fallback="Bag" /> </Link> /{" "}
        <span aria-current="page"> <StorefrontText id="copy_45989de49fb7f66d" fallback="Details" /> </span>
      </nav>

      <CheckoutSteps currentStep={2} />

      <div className="checkout-page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <p className="eyebrow mb-0"> <StorefrontText id="copy_f49dadfbd77b18e2" fallback="Guest checkout · No account needed" /> </p>
          <a
            href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent("🌿 Hi TeaFloww! I am at the checkout page and need help with my order.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0f9f4] hover:bg-[#e1f5eb] text-[#128c7e] border border-[#c3ead4] text-xs font-semibold transition-colors shadow-2xs self-start sm:self-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
            aria-label="Stuck on checkout? Open WhatsApp chat for live assistance (opens in a new tab)"
          >
            <WhatsAppIcon size={15} color="#25D366" />
            <span>Stuck? Chat on WhatsApp</span>
            <span className="text-[#63756c] font-normal text-[11px]">({whatsappDisplay})</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
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
