import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Mountain, Navigation, Compass, Sparkles } from "lucide-react";

const GATEWAY_HUBS = [
  {
    region: "Darjeeling Hills",
    distance: "~65 km",
    travelTime: "2.5 hrs via Hill Cart Rd / Rohini",
    elevation: "1,200m – 2,200m ASL",
    description: "Muscatel first & second flush gardens perched on high misty mountain spurs.",
    tag: "Alpine Terroir",
  },
  {
    region: "Dooars Valley",
    distance: "~45 km",
    travelTime: "1.2 hrs via NH 27 / Teesta Bridge",
    elevation: "150m – 300m ASL",
    description: "Lush gardens bordering Jaldapara and Gorumara with rich, malty orthodox cups.",
    tag: "Sub-Himalayan Basin",
  },
  {
    region: "Terai Foothills",
    distance: "~20 km",
    travelTime: "30 mins direct from Fulbari",
    elevation: "80m – 150m ASL",
    description: "Alluvial soil gardens known for robust amber infusions and golden leaf tips.",
    tag: "Foothill Alluvium",
  },
  {
    region: "Transit Hubs (IXB / NJP)",
    distance: "~12 – 14 km",
    travelTime: "20–25 mins to Bagdogra Airport",
    elevation: "120m ASL",
    description: "Direct air & rail freight connecting Siliguri to metropolitan distribution networks.",
    tag: "Express Dispatch",
  },
];

export function TransitHeritageMap({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-[#e4ded0] bg-white p-6 sm:p-8 lg:p-10 shadow-sm ${className}`}
      aria-labelledby="transit-heritage-heading"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-5 border-b border-[#ece7dc]">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] flex items-center gap-1.5 mb-1.5">
            <Compass size={14} /> <StorefrontText id="copy_3aac4626200ff6b8" fallback="The Himalayan Crossroads" /> </span>
          <h2 id="transit-heritage-heading" className="font-serif text-2xl sm:text-3xl text-[#18231c]"> <StorefrontText id="copy_9799d981387d1386" fallback="Why Siliguri is Our Sourcing Epicenter" /> </h2>
        </div>
        <p className="text-xs sm:text-sm text-[#52594e] max-w-md"> <StorefrontText id="copy_ce41393e2c484f1d" fallback="Situated at the foothills where the plains meet the Eastern Himalayas, our Fulbari works receives freshly fired leaf batches directly from hill gardens within hours of manufacture." /> </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {GATEWAY_HUBS.map((hub, idx) => (
          <div
            key={idx}
            className="flex flex-col justify-between rounded-xl border border-[#ece7dc] bg-[#fbf9f4] p-4 sm:p-5 transition-all hover:border-[#23483a]/40 hover:bg-[#f6f2e8]"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="rounded bg-[#23483a]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#23483a]">
                  {hub.tag}
                </span>
                <span className="font-mono text-xs font-bold text-[#18231c]">{hub.distance}</span>
              </div>
              <h3 className="font-serif text-base font-bold text-[#18231c] mb-1">{hub.region}</h3>
              <p className="text-xs text-[#52594e] leading-relaxed mb-3">{hub.description}</p>
            </div>

            <div className="pt-3 border-t border-[#ece7dc] text-[11px] text-[#6e746a] space-y-0.5">
              <div className="flex items-center gap-1">
                <Mountain size={11} className="text-[#23483a]" />
                <span> <StorefrontText id="copy_0e425cc4de2ca3e1" fallback="Elevation:" /> {hub.elevation}</span>
              </div>
              <div className="flex items-center gap-1">
                <Navigation size={11} className="text-[#23483a]" />
                <span> <StorefrontText id="copy_74254b275edd7678" fallback="Transit:" /> {hub.travelTime}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-[#dce6dd] bg-[#f3f8f4] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#23483a] text-white">
            <Sparkles size={18} />
          </div>
          <div className="text-xs sm:text-sm text-[#18231c]">
            <strong className="block font-semibold"> <StorefrontText id="copy_a37ca655f7bb00aa" fallback="Origin Vacuum Packaging Standard" /> </strong>
            <span className="text-[#4a5047]"> <StorefrontText id="copy_241001705bca40a1" fallback="Leaves never sit in high-humidity open warehouses. Vacuum sealed within 24h of lot arrival." /> </span>
          </div>
        </div>
        <Link
          href="/about"
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-[#c4d7c7] px-3.5 py-2 text-xs font-bold text-[#23483a] hover:bg-[#ebf4ec] transition-colors"
        > <StorefrontText id="copy_55057231b53d5716" fallback="Read Our Origin Story →" /> </Link>
      </div>
    </section>
  );
}
