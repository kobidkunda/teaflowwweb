"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Why does my milk curdle when I add fresh ginger or jaggery?",
    answer:
      "Raw fresh ginger contains an active proteolytic enzyme called zingipain, while desi jaggery contains natural plant acids and mineral salts. If you add cold milk to raw ginger or boil jaggery directly on high flame, the milk proteins (casein) will immediately coagulate. Always boil crushed ginger in water for 2–3 minutes FIRST (heat deactivates the enzyme), then add warm milk. For jaggery, stir it in after removing the saucepan from direct heat.",
  },
  {
    question: "What is the ideal water-to-milk ratio for classic Kadak Chai?",
    answer:
      "The undisputed gold standard is 1:1 (equal parts spring water and whole milk) for standard morning tea. If using rich buffalo milk or crafting street-style 'cutting' chai, use 40% water to 60% milk. For a lighter afternoon cup, use 60% water to 40% milk. Never use 100% milk from the start, as milk fats trap tea leaves and prevent proper tannin release.",
  },
  {
    question: "Can CTC tea be brewed in a French press or teapot infuser basket?",
    answer:
      "Yes, but only for lighter black styles like Sulaimani or lemon iced tea. When making milky chai, the physical action of a rolling boil on a stove burner is required to emulsify milk fats with tea polyphenols. A passive steep in a French press will yield hot milk with floating tea flavor rather than integrated, velvety chai.",
  },
  {
    question: "How do street-side chaiwallahs achieve that signature thick frothy crema?",
    answer:
      "They use two key techniques: full-fat dairy (buffalo or unhomogenized milk) and the 'cutting' aeration lift. By ladling hot chai high into the air and dropping it back into the pot, air is whipped into the boiling milk lipids, creating tiny micro-bubbles and breaking down harsh astringency into sweet caramel notes.",
  },
  {
    question: "How many times can CTC tea granules be steeped?",
    answer:
      "Unlike whole-leaf orthodox Darjeeling teas which can be re-steeped 3 to 4 times, CTC granules release roughly 90% of their total caffeine and soluble solids during the initial rolling boil. Re-boiling used CTC granules results in flat, bitter, and washed-out liquor. We strongly recommend fresh granules for each brew.",
  },
  {
    question: "How does the caffeine content of CTC black tea compare to coffee or green tea?",
    answer:
      "Because CTC granules are crushed into tiny particles with massive surface exposure, they extract caffeine rapidly. An 8oz cup of CTC Kadak Chai contains approximately 60–80mg of caffeine — higher than green tea (25–35mg) and comparable to a standard shot of espresso, but moderated by natural L-theanine for jitter-free, sustained focus.",
  },
];

export function CtcFrequentlyAsked() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-[#ded9cb]"
      aria-labelledby="faq-heading"
    >
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ede8dc] text-[#2c4e38] text-xs font-bold uppercase tracking-[0.2em] mb-3">
          <HelpCircle size={14} className="text-[#a47148]" />
          <span>Troubleshooting &amp; Technique</span>
        </div>
        <h2
          id="faq-heading"
          className="font-serif text-3xl sm:text-4xl text-[#18231c] tracking-tight mb-3"
        > <StorefrontText id="copy_a43c4829fed75cfa" fallback="Frequently Asked Brewing Questions" /> </h2>
        <p className="text-sm sm:text-base text-[#5c685b]"> <StorefrontText id="copy_deb847ed37831b8f" fallback="Master the nuance of heat, milk chemistry, and botanical extraction." /> </p>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-[#ded9cb] overflow-hidden transition-all shadow-xs"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-serif text-base sm:text-lg text-[#18231c] hover:text-[#2c4e38] transition-colors"
              >
                <span className="font-medium">{item.question}</span>
                <ChevronDown
                  size={18}
                  className={`text-[#727a6f] shrink-0 transition-transform duration-300 ${
                    isOpen ? "rotate-180 text-[#2c4e38]" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-[#52594e] leading-relaxed border-t border-[#f2ede2] pt-3">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
