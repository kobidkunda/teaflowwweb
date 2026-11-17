import { TRADE_COPY_EN } from "./copy";
import type { TradeDictionary } from "./i18nMeta";
export const TRADE_EN: TradeDictionary = {
  "brand.subtitle": "For tea shops",
  "nav.trial": "Trial kit",
  "nav.blends": "Tea blends",
  "nav.bulk": "Bulk quote",
  "nav.cost": "Cost per glass",
  "nav.enquiry": "Enquire",
  "hero.kicker": "For India's chai sellers · Siliguri supply",
  "hero.title": "Your shop's next strong chai.",
  "hero.titleEmphasis": "Before buying bulk, taste it at your counter.",
  "hero.intro":
    "Use your own milk and measure. Taste a trial at your counter, compare colour and strength, then check delivered pack prices by PIN code.",
  "hero.proofLine":
    "Siliguri-based tea supply · Test at your counter · Check freight by PIN",
  "hero.ctaTrial": "Buy a trial",
  "hero.ctaBulk": "Check bulk price",
  "hero.ctaEnquiry": "Trade enquiry",
  "hero.listen": "Listen",
  "hero.pause": "Pause",
  "hero.replay": "Replay",
  "hero.brewGuide": "See the brew guide",
  "trial.kicker": "Start small · Discovery trial kit",
  "trial.title": "Four teas. One trial.",
  "trial.intro":
    "Make one pan the way you usually do. Compare colour, strength and taste before choosing a bulk pack.",
  "trial.cta": "Buy a trial",
  "trial.unavailable":
    "Trial kit is currently paused. You can still check bulk prices or ask TeaFloww.",
  "blends.kicker": "Counter-ready tea blends",
  "blends.title": "Choose tea for your counter",
  "blends.subtitle":
    "Pack sizes grouped by restock purpose. Prices come live from the Siliguri trade catalogue.",
  "bulk.kicker": "Know your delivered price",
  "bulk.title": "What will tea cost at your shop?",
  "bulk.chooseTea": "Choose your tea",
  "bulk.packSize": "Pack size",
  "bulk.packs": "Packs",
  "bulk.payment": "Payment option",
  "bulk.pinLabel": "Shop PIN code",
  "bulk.checkDelivery": "Check delivery",
  "payment.prepaid": "Prepaid",
  "payment.cod": "Pay on delivery",
  "payment.freight_advance": "Freight advance",
  "quote.heading": "Your delivery quote",
  "quote.tea": "Tea subtotal",
  "quote.freight": "Freight & handling",
  "quote.taxes": "Additional tax",
  "quote.fees": "Other fees",
  "quote.credit": "Trial credit",
  "quote.total": "Order total",
  "quote.perKg": "{amount} / kg delivered",
  "quote.perKgDepot": "{amount} / kg to the depot",
  "quote.payNow": "Due now",
  "quote.balanceAtCollection": "Balance at handover",
  "quote.handover.doorstep": "Delivered to your shop · {locality}",
  "quote.handover.depot": "Collect at {depot} · {address}",
  "quote.reviewPack": "Continue to checkout",
  "quote.manualTitle": "Ask for a transport quote",
  "quote.manualBody":
    "Our team will confirm the exact freight and handover point for PIN {pin}.",
  "quote.prepareEnquiry": "Prepare enquiry",
  "quote.enterPin":
    "Final delivered cost is calculated only after PIN serviceability is verified.",
  "calc.kicker": "At the counter",
  "calc.title": "What does one glass cost?",
  "calc.subtitle":
    "Tea leaves only. Compare two batches you would actually serve.",
  "calc.yourTea": "Your usual tea",
  "calc.teafloww": "TeaFloww",
  "calc.pricePerKg": "Price / kg (₹)",
  "calc.teaGrams": "Tea used (g)",
  "calc.glasses": "Glasses made",
  "calc.perGlass": "/ glass",
  "help.kicker": "Shop owner support",
  "help.title": "Ask TeaFloww.",
  "help.whatsappCta": "Prepare a WhatsApp enquiry",
  "lang.chooseTitle": "Choose your language",
  "checkout.title": "Review your pack",
  "checkout.placeOrder": "Confirm order",
  "checkout.payNow": "Pay {amount}",
  "order.title": "Your trade order",
  "enquiry.requestTransport": "Request bulk or transport quote",
  "enquiry.pinLabel": "Shop 6-digit PIN code *",
  "enquiry.whatsappOpen": "Continue on WhatsApp · Send Enquiry",
};


/** English source dictionary. Other languages come from Admin → Translations (resource: trade). */
export function tradeDefaults(_locale?: string): TradeDictionary {
  void _locale;
  return { ...TRADE_COPY_EN, ...TRADE_EN };
}
