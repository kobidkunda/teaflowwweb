import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { HelpCircle, ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "Can I visit your Siliguri facility for a private tea tasting or cupping flight?",
    a: "Yes! We welcome tea enthusiasts, connoisseurs, and hospitality partners to our tasting facility at Fulbari, Siliguri. Because our tasters grade fresh garden lots throughout the morning, all private cupping flights must be scheduled in advance. Please submit an inquiry with your preferred dates, party size, and areas of interest (e.g. Darjeeling flushes, artisanal greens, or high-grown oolongs).",
  },
  {
    q: "How quickly do your tea sommeliers respond to customer inquiries?",
    a: "Our customer care and sensory desk responds to all inquiries within 24 hours from Monday through Saturday (09:00 to 18:00 IST). For immediate order status updates or time-sensitive dispatch notes, our WhatsApp concierge (+91 7001304853) provides real-time support during working hours.",
  },
  {
    q: "Where are TeaFloww harvest lots packaged and dispatched from?",
    a: "Every orthodox leaf and specialty lot is brought directly from tea gardens in Darjeeling, Assam, Dooars, Kangra, and Nilgiri to our central works at 00, Fulbari Ghoshpukur Bypass, Siliguri. Here, lots are sensory cupped, vacuum sealed or nitrogen-flushed, packed in food-safe aroma-lock tins, and dispatched directly across India and international destinations.",
  },
  {
    q: "How do I check the live tracking status of my tea shipment?",
    a: "Upon dispatch from our Siliguri hub, you receive an automated SMS and email containing your consignment tracking link. You can also enter your order reference or mobile number directly on our dedicated Track Order portal at /track for real-time Blue Dart, Delhivery, or India Post milestone tracking.",
    link: { text: "Visit Track Order Portal", href: "/track" },
  },
  {
    q: "Do you supply wholesale quantities and tasting kits to cafes, restaurants, and hotels?",
    a: "Yes. TeaFloww partners with boutique specialty cafes, five-star hospitality properties, and corporate clients globally. We offer curated 5-grade sample tasting kits, custom garden blending, and bulk master cases (5 kg to 500+ kg). You can submit a trade request on our Wholesale Portal or select the Wholesale topic on this page.",
    link: { text: "Review Wholesale Offerings", href: "/wholesale" },
  },
  {
    q: "Which regional languages are supported on your helpline?",
    a: "Our Siliguri-based team is fluent in English, Hindi, Bengali, and Nepali, allowing seamless, culturally rich communication for our patrons across North Bengal, Northeast India, pan-India, and global tea lovers.",
  },
];

export function ContactFaq({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-[#e4ded0] bg-[#fbf9f4] p-6 sm:p-8 lg:p-10 ${className}`}
      aria-labelledby="contact-faq-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-5 border-b border-[#ece7dc]">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] flex items-center gap-1.5 mb-1.5">
            <HelpCircle size={14} /> <StorefrontText id="copy_a3d458e1bd1eda06" fallback="Frequently Asked Questions" /> </span>
          <h2 id="contact-faq-heading" className="font-serif text-2xl sm:text-3xl text-[#18231c]">
            Visiting &amp; Inquiry Guide
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[#52594e] max-w-sm"> <StorefrontText id="copy_752d86f63efdf90a" fallback="Quick clarity on tastings, dispatch tracking, garden sourcing, and customer care." /> </p>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, idx) => (
          <details
            key={idx}
            className="group rounded-xl border border-[#dfd8cb] bg-white transition-colors open:bg-[#fcfbf7] open:border-[#23483a]/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 sm:p-5 text-sm sm:text-base font-semibold text-[#18231c] transition-colors hover:text-[#23483a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23483a]/30">
              <span className="pr-4">{item.q}</span>
              <span className="shrink-0 rounded-full bg-[#f4efe4] p-1 text-[#23483a] transition-transform duration-200 group-open:rotate-180">
                <ChevronDown size={16} />
              </span>
            </summary>
            <div className="px-4 pb-5 pt-1 sm:px-5 text-xs sm:text-sm text-[#52594e] leading-relaxed border-t border-[#f4efe4] mt-1 space-y-2">
              <p>{item.a}</p>
              {item.link && (
                <div>
                  <Link
                    href={item.link.href}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#23483a] hover:underline"
                  >
                    {item.link.text} →
                  </Link>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
