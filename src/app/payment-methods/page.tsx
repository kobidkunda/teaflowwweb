import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { getShippingSettings } from "@/lib/shippingSettings";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { PaymentMethodsInteractiveHub, type PaymentMethodsData } from "@/components/payment-methods/PaymentMethodsInteractiveHub";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: `Payment Methods & Prepaid Discounts · UPI, Cards & COD · ${siteConfig.name}`,
    description: `Explore all accepted payment methods on TeaFloww. Enjoy instant 2% discount on UPI, 1% on Cards, and free delivery on orders above ₹599. Safe, 256-bit encrypted checkout.`,
    path: "/payment-methods",
  });
}

export default async function PaymentMethodsPage() {
  const p = getPaymentSettings();
  const s = getShippingSettings();

  const data: PaymentMethodsData = {
    onlinePaymentEnabled: p.online_payment_enabled,
    discounts: {
      upi: {
        enabled: p.upi_discount_enabled,
        type: p.upi_discount_type,
        value: p.upi_discount_value,
        maxRupees: p.upi_discount_max_rupees,
      },
      card: {
        enabled: p.card_discount_enabled,
        type: p.card_discount_type,
        value: p.card_discount_value,
        maxRupees: p.card_discount_max_rupees,
      },
      netbanking: {
        enabled: p.netbanking_discount_enabled,
        type: p.netbanking_discount_type,
        value: p.netbanking_discount_value,
        maxRupees: p.netbanking_discount_max_rupees,
      },
      cod: {
        enabled: p.cod_enabled,
        feePaise: p.cod_fee_paise,
      },
      minOrderRupees: p.min_order_for_discount_rupees,
      badgeText: p.payment_discount_badge_text,
    },
    shipping: {
      freeShippingThresholdRupees: s.free_shipping_threshold_rupees,
      freeShippingThresholdPaise: s.free_shipping_threshold_paise,
      shippingFlatFeeRupees: s.shipping_flat_fee_rupees,
      shippingFlatFeePaise: s.shipping_flat_fee_paise,
      freeShippingEnabled: s.free_shipping_enabled,
      dispatchCommitment: s.dispatch_commitment,
    },
  };

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Payment Methods & Discounts", url: "/payment-methods" },
  ]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How is the UPI / prepaid discount applied at checkout?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `When you select UPI or Credit/Debit Card during checkout, an instant discount (${p.upi_discount_value}% for UPI, ${p.card_discount_value}% for Cards) is automatically deducted from your merchandise total.`,
        },
      },
      {
        "@type": "Question",
        name: "Is payment secure on TeaFloww?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, 100%. All transactions are processed through Razorpay's RBI-authorized 256-bit AES encrypted gateway with two-factor authentication.",
        },
      },
      {
        "@type": "Question",
        name: "What are the shipping charges?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Orders of ₹${s.free_shipping_threshold_rupees} or more qualify for FREE delivery across India. Orders below this threshold incur a flat ₹${s.shipping_flat_fee_rupees} transit fee.`,
        },
      },
    ],
  };

  return (
    <div className="container page-shell max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Breadcrumbs */}
      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors">
          Home
        </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold">
          Payment Methods &amp; Discounts
        </span>
      </nav>

      {/* Page Header */}
      <header className="page-header mb-12 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4f7f2] border border-[#dce3d8] text-[#23483a] text-xs font-semibold mb-3">
          <Zap className="w-3.5 h-3.5 text-[#b39156]" />
          <span>{p.payment_discount_badge_text || "⚡ Instant 2% Off with UPI · 1% Off on Cards"}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#171713] font-normal leading-tight">
          Pay Smarter. Save More on Every Harvest.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#46524a] leading-relaxed">
          Why pay extra for Cash on Delivery? Choose instant UPI, QR code, or secure card checkout to claim upfront discounts, priority origin packaging, and free courier delivery on orders above ₹{s.free_shipping_threshold_rupees}.
        </p>
      </header>

      {/* Main Interactive Hub */}
      <PaymentMethodsInteractiveHub data={data} />
    </div>
  );
}
