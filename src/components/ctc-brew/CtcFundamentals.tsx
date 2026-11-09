import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Sparkles, ArrowRight } from "lucide-react";

export function CtcFundamentals() {
  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-[#ded9cb]"
      aria-labelledby="fundamentals-heading"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#2c4e38] mb-3">
            <Sparkles size={14} className="text-[#a47148]" />
            <span> <StorefrontText id="copy_0852f64e19946a71" fallback="Master Brewer Science" /> </span>
          </div>
          <h2
            id="fundamentals-heading"
            className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] tracking-tight mb-4"
          > <StorefrontText id="copy_3928f5d2fdec4bf8" fallback="The Science Behind CTC Granules" /> </h2>
          <p className="text-base text-[#52594e] leading-relaxed"> <StorefrontText id="copy_382f8f058902b02d" fallback="CTC stands for" /> <em> <StorefrontText id="copy_d62589bb038621bf" fallback="Crush, Tear, Curl" /> </em> <StorefrontText id="copy_2659718bdcaf4b43" fallback=". Unlike delicate whole-leaf orthodox teas that demand gentle 90°C steeping, CTC granules are engineered for intense, rapid decoction and rich emulsion with milk." /> </p>
        </div>

        <Link
          href="/leaf-to-cup"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#18231c] hover:text-[#a47148] border-b border-current pb-1 transition-colors self-start md:self-end"
        >
          <span> <StorefrontText id="copy_c93423006514d596" fallback="Compare with Leaf-to-Cup Orthodox Journey" /> </span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <div className="bg-[#f0ece1] rounded-2xl p-6 border border-[#ded8c8] flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#254636] text-[#eedcb8] flex items-center justify-center font-mono font-bold text-sm mb-4">
              01
            </div>
            <h3 className="font-serif text-xl text-[#18231c] mb-2"> <StorefrontText id="copy_77d5e6755108ce89" fallback="Water First, Milk Second" /> </h3>
            <p className="text-xs sm:text-[13px] text-[#555d51] leading-relaxed"> <StorefrontText id="copy_fcf2033e76955309" fallback="Tea polyphenols and thearubigins extract 40% faster in boiling water than in milk. Never boil raw tea directly in cold milk — water extraction unlocks the full aromatic malty core first." /> </p>
          </div>
          <div className="pt-4 border-t border-[#ded8c8] text-[11px] font-semibold text-[#2c4e38] mt-4"> <StorefrontText id="copy_16c0c641133c8c1e" fallback="Prevents milk scorching" /> </div>
        </div>

        <div className="bg-[#f0ece1] rounded-2xl p-6 border border-[#ded8c8] flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#254636] text-[#eedcb8] flex items-center justify-center font-mono font-bold text-sm mb-4">
              02
            </div>
            <h3 className="font-serif text-xl text-[#18231c] mb-2"> <StorefrontText id="copy_84a7c2b24f60f505" fallback="The Aeration Lift Pour" /> </h3>
            <p className="text-xs sm:text-[13px] text-[#555d51] leading-relaxed"> <StorefrontText id="copy_3515c28cb1485dd9" fallback="Why do roadside chaiwallahs ladle chai high above the pan? High-velocity oxygenation whips air into milk fats, transforming astringent tannins into a velvety, creamy microfoam emulsion." /> </p>
          </div>
          <div className="pt-4 border-t border-[#ded8c8] text-[11px] font-semibold text-[#2c4e38] mt-4"> <StorefrontText id="copy_1a07731eda21988a" fallback="Creates silky barista mouthfeel" /> </div>
        </div>

        <div className="bg-[#f0ece1] rounded-2xl p-6 border border-[#ded8c8] flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#254636] text-[#eedcb8] flex items-center justify-center font-mono font-bold text-sm mb-4">
              03
            </div>
            <h3 className="font-serif text-xl text-[#18231c] mb-2"> <StorefrontText id="copy_cd674b93f593be56" fallback="Bruised, Not Powdered Spices" /> </h3>
            <p className="text-xs sm:text-[13px] text-[#555d51] leading-relaxed"> <StorefrontText id="copy_f67dd3d1f6c0ef65" fallback="Fine spice powders create a muddy, gritty residue that clouds your liquor. Coarsely crack green cardamom, cinnamon, and ginger in a mortar to release essential botanical oils cleanly." /> </p>
          </div>
          <div className="pt-4 border-t border-[#ded8c8] text-[11px] font-semibold text-[#2c4e38] mt-4"> <StorefrontText id="copy_bcb8de9a0b1170de" fallback="Zero silt or grit" /> </div>
        </div>

        <div className="bg-[#f0ece1] rounded-2xl p-6 border border-[#ded8c8] flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#254636] text-[#eedcb8] flex items-center justify-center font-mono font-bold text-sm mb-4">
              04
            </div>
            <h3 className="font-serif text-xl text-[#18231c] mb-2"> <StorefrontText id="copy_3bb24e5d32ca50ef" fallback="Terracotta Clay Neutralization" /> </h3>
            <p className="text-xs sm:text-[13px] text-[#555d51] leading-relaxed"> <StorefrontText id="copy_30321fc404124b84" fallback="Porous unglazed earthenware (Kulhads) absorbs bitter volatile compounds while lending gentle mineral sweetness and petrichor aroma that transforms ordinary tea into an earthen masterpiece." /> </p>
          </div>
          <div className="pt-4 border-t border-[#ded8c8] text-[11px] font-semibold text-[#2c4e38] mt-4"> <StorefrontText id="copy_e6b882f324a8371e" fallback="Authentic Kolkata petrichor" /> </div>
        </div>
      </div>

      {/* Side-by-Side Comparison: Orthodox vs CTC */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#ded9cb] shadow-sm">
        <h3 className="font-serif text-2xl sm:text-3xl text-[#18231c] mb-6 text-center"> <StorefrontText id="copy_5860280dec2c48b5" fallback="Orthodox Whole Leaf vs. CTC Granules" /> </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#ded9cb] text-[#18231c]">
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px] text-[#6b7567]"> <StorefrontText id="copy_dd066ec1bf1d4485" fallback="Parameter" /> </th>
                <th className="py-3 px-4 font-bold text-[#142d24] bg-[#f7f5ef] rounded-t-xl"> <StorefrontText id="copy_45c610e862d32bc1" fallback="CTC Black Tea Granules" /> </th>
                <th className="py-3 px-4 font-bold text-[#2c4e38]"> <StorefrontText id="copy_1408aac0123fa1a9" fallback="Orthodox Whole Leaf (Darjeeling / Single-Estate)" /> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee9de]">
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#18231c]"> <StorefrontText id="copy_3ee48d6794be7fbc" fallback="Physical Form" /> </td>
                <td className="py-3.5 px-4 bg-[#fbf9f4] font-semibold text-[#18231c]"> <StorefrontText id="copy_5832d3fb15e53916" fallback="Tight, dense spherical black granules" /> </td>
                <td className="py-3.5 px-4 text-[#52594e]"> <StorefrontText id="copy_15b79c617304f356" fallback="Long wiry twisted leaves with golden or silver tips" /> </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#18231c]"> <StorefrontText id="copy_46c16c76bf8f7f1d" fallback="Extraction Speed" /> </td>
                <td className="py-3.5 px-4 bg-[#fbf9f4] font-semibold text-[#18231c]"> <StorefrontText id="copy_3c171c29f473af0b" fallback="Rapid: 90% soluble solids released in 2–3 minutes" /> </td>
                <td className="py-3.5 px-4 text-[#52594e]"> <StorefrontText id="copy_294b103f84ce23c8" fallback="Gradual: leaves slowly unfurl over 3 to 5 minutes" /> </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#18231c]"> <StorefrontText id="copy_7c946ca2d951aba5" fallback="Liquor Character" /> </td>
                <td className="py-3.5 px-4 bg-[#fbf9f4] font-semibold text-[#18231c]"> <StorefrontText id="copy_5464aa21efb1a141" fallback="Deep coppery mahogany, bold, malty, brisk astringency" /> </td>
                <td className="py-3.5 px-4 text-[#52594e]"> <StorefrontText id="copy_0a79ecc954ee1048" fallback="Golden amber to pale champagne, floral, muscatel, stone fruit" /> </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#18231c]"> <StorefrontText id="copy_0fde12587574e604" fallback="Milk Compatibility" /> </td>
                <td className="py-3.5 px-4 bg-[#fbf9f4] font-semibold text-[#18231c]"> <StorefrontText id="copy_742c9b46503dd080" fallback="Supreme — built to emulsify with dairy or plant milk fats" /> </td>
                <td className="py-3.5 px-4 text-[#52594e]"> <StorefrontText id="copy_cd5cf6f892adfb1e" fallback="Best enjoyed without milk to appreciate delicate floral terroir" /> </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#18231c]"> <StorefrontText id="copy_5da7470d2105b6a1" fallback="Best Preparation" /> </td>
                <td className="py-3.5 px-4 bg-[#fbf9f4] font-semibold text-[#18231c]"> <StorefrontText id="copy_123ed48af56d51e4" fallback="100°C rolling boil saucepan decoction, aeration pour" /> </td>
                <td className="py-3.5 px-4 text-[#52594e]"> <StorefrontText id="copy_911bc7b6dae78eaa" fallback="85°C–90°C gentle steep in porcelain gaiwan or glass teapot" /> </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#18231c]"> <StorefrontText id="copy_78f80937d37073f0" fallback="Number of Steeps" /> </td>
                <td className="py-3.5 px-4 bg-[#fbf9f4] font-semibold text-[#18231c]"> <StorefrontText id="copy_f77f1f5bfdaac4fd" fallback="Single-infusion powerhouse brew" /> </td>
                <td className="py-3.5 px-4 text-[#52594e]"> <StorefrontText id="copy_ecd54b5d00b54842" fallback="3 to 4 sequential infusions with evolving flavor layers" /> </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
