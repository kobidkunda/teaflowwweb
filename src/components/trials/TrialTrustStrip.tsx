import React from "react";

export function TrialTrustStrip() {
  const pillars = [
    {
      icon: "❖",
      title: "Made for milk chai",
      desc: "Explore body, liquor, and briskness formulated specifically for kettle boiling.",
    },
    {
      icon: "⌑",
      title: "Four expressions",
      desc: "Strong, Elaichi, Ginger, and Masala single-garden lots with verified invoice traceability.",
    },
    {
      icon: "✧",
      title: "Your kettle, your verdict",
      desc: "Make a fair comparison in your own vessel without marketing exaggeration.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-[#d9d9d2]">
      {pillars.map((p, idx) => (
        <div key={idx} className="flex items-start gap-3.5 text-[13px] text-[#3a4d42]">
          <span
            className="text-[#ba8745] text-[24px] leading-none select-none font-serif"
            aria-hidden="true"
          >
            {p.icon}
          </span>
          <div>
            <strong className="block text-[#143b2f] font-bold text-[14px] mb-0.5">
              {p.title}
            </strong>
            <span className="text-[#64716b] text-[12px] leading-relaxed">
              {p.desc}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
