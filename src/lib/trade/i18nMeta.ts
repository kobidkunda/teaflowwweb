import type { AnyTradeLocale } from "./contracts";

export const TRADE_LANGUAGE_META: Record<
  AnyTradeLocale,
  { nativeName: string; englishName: string; bcp47: string }
> = {
  en: { nativeName: "English", englishName: "English", bcp47: "en-IN" },
  bn: { nativeName: "বাংলা", englishName: "Bengali", bcp47: "bn-IN" },
  hi: { nativeName: "हिन्दी", englishName: "Hindi", bcp47: "hi-IN" },
  gu: { nativeName: "ગુજરાતી", englishName: "Gujarati", bcp47: "gu-IN" },
  mr: { nativeName: "मराठी", englishName: "Marathi", bcp47: "mr-IN" },
  pa: { nativeName: "ਪੰਜਾਬੀ", englishName: "Punjabi", bcp47: "pa-IN" },
  ta: { nativeName: "தமிழ்", englishName: "Tamil", bcp47: "ta-IN" },
  te: { nativeName: "తెలుగు", englishName: "Telugu", bcp47: "te-IN" },
  kn: { nativeName: "ಕನ್ನಡ", englishName: "Kannada", bcp47: "kn-IN" },
};

export type TradeDictionary = {
  [key: string]: string;
  "brand.subtitle": string;
  "nav.trial": string;
  "nav.blends": string;
  "nav.bulk": string;
  "nav.cost": string;
  "nav.enquiry": string;
  "hero.kicker": string;
  "hero.title": string;
  "hero.titleEmphasis": string;
  "hero.intro": string;
  "hero.proofLine": string;
  "hero.ctaTrial": string;
  "hero.ctaBulk": string;
  "hero.ctaEnquiry": string;
  "hero.listen": string;
  "hero.pause": string;
  "hero.replay": string;
  "hero.brewGuide": string;
  "trial.kicker": string;
  "trial.title": string;
  "trial.intro": string;
  "trial.cta": string;
  "trial.unavailable": string;
  "blends.kicker": string;
  "blends.title": string;
  "blends.subtitle": string;
  "bulk.kicker": string;
  "bulk.title": string;
  "bulk.chooseTea": string;
  "bulk.packSize": string;
  "bulk.packs": string;
  "bulk.payment": string;
  "bulk.pinLabel": string;
  "bulk.checkDelivery": string;
  "payment.prepaid": string;
  "payment.cod": string;
  "payment.freight_advance": string;
  "quote.heading": string;
  "quote.tea": string;
  "quote.freight": string;
  "quote.taxes": string;
  "quote.fees": string;
  "quote.credit": string;
  "quote.total": string;
  "quote.perKg": string;
  "quote.perKgDepot": string;
  "quote.payNow": string;
  "quote.balanceAtCollection": string;
  "quote.handover.doorstep": string;
  "quote.handover.depot": string;
  "quote.reviewPack": string;
  "quote.manualTitle": string;
  "quote.manualBody": string;
  "quote.prepareEnquiry": string;
  "quote.enterPin": string;
  "calc.kicker": string;
  "calc.title": string;
  "calc.subtitle": string;
  "calc.yourTea": string;
  "calc.teafloww": string;
  "calc.pricePerKg": string;
  "calc.teaGrams": string;
  "calc.glasses": string;
  "calc.perGlass": string;
  "help.kicker": string;
  "help.title": string;
  "help.whatsappCta": string;
  "lang.chooseTitle": string;
  "checkout.title": string;
  "checkout.placeOrder": string;
  "checkout.payNow": string;
  "order.title": string;
  "enquiry.requestTransport": string;
  "enquiry.pinLabel": string;
  "enquiry.whatsappOpen": string;
};

export function formatTradeMessage(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}
