import type { BusinessInterest, BusinessLocale, Segment } from "./schema";

export function buildWhatsAppLink(
  e164WithoutPlus: string | null | undefined,
  details: {
    segment: Segment;
    interest: BusinessInterest;
    reference?: string;
    locale?: BusinessLocale;
  }
): string | null {
  if (!e164WithoutPlus) return null;
  const cleanDigits = e164WithoutPlus.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(cleanDigits)) return null;

  const isHi = details.locale === "hi";
  const stage =
    details.segment === "starter"
      ? isHi
        ? "नया चाय बिज़नेस"
        : "new tea business"
      : isHi
        ? "मौजूदा चाय व्यापारी"
        : "existing tea trader";

  const interestLabel = details.interest.replaceAll("_", " ");
  const lines = isHi
    ? [
        "नमस्ते TeaFloww, मुझे बिज़नेस कोटेशन के बारे में बात करनी है।",
        `श्रेणी: ${stage}।`,
        `रुचि: ${interestLabel}।`,
        details.reference ? `संदर्भ संख्या: ${details.reference}।` : "",
        "कृपया MOQ, सैंपल और भाड़े की जानकारी साझा करें।",
      ]
    : [
        "Hello TeaFloww, I would like to discuss a business quotation.",
        `I am a ${stage}.`,
        `Interest: ${interestLabel}.`,
        details.reference ? `Reference: ${details.reference}.` : "",
        "Please share MOQ, sample and freight details.",
      ];

  const message = lines.filter(Boolean).join("\n");
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}
