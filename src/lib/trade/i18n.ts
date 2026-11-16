import type { AnyTradeLocale, TradeLocale } from "./contracts";
import { listLocalizedContent } from "./catalogue";
import { TRADE_LANGUAGE_META, type TradeDictionary } from "./i18nMeta";

export { TRADE_LANGUAGE_META, type TradeDictionary };

const EN: TradeDictionary = {
  "brand.subtitle": "For tea shops",
  "nav.trial": "Trial kit",
  "nav.bulk": "Bulk supply",
  "nav.cost": "Cost per glass",
  "hero.kicker": "Siliguri · Tea for your counter",
  "hero.title": "Try it in the chai you serve",
  "hero.titleEmphasis": "every day.",
  "hero.intro":
    "Use your own milk and measure. Taste a trial at your counter, or check what a full pack costs at your shop.",
  "hero.ctaTrial": "Try a sample",
  "hero.ctaBulk": "Check bulk price",
  "hero.listen": "Listen",
  "hero.brewGuide": "See the brew guide",
  "trial.kicker": "The trial kit",
  "trial.title": "Try it during your next tea shift.",
  "trial.intro":
    "Make one pan the way you usually do. Compare colour, strength and taste before choosing a bulk pack.",
  "trial.cta": "See trial & delivery",
  "trial.unavailable": "Trial kit is currently paused. You can still check bulk prices or ask TeaFloww.",
  "bulk.kicker": "Bulk supply",
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
  "quote.reviewPack": "Review this pack",
  "quote.manualTitle": "Ask for a transport quote",
  "quote.manualBody":
    "Our team will confirm the exact freight and handover point for PIN {pin}.",
  "quote.prepareEnquiry": "Prepare enquiry",
  "quote.enterPin": "Enter your 6-digit PIN to see freight, handover point and total.",
  "calc.kicker": "At the counter",
  "calc.title": "What goes into one glass?",
  "calc.subtitle": "Tea leaves only. Use two batches you would actually serve.",
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
  "enquiry.requestTransport": "Request transport quote",
};

const BN: TradeDictionary = {
  "brand.subtitle": "চায়ের দোকানের জন্য",
  "nav.trial": "স্যাম্পল কিট",
  "nav.bulk": "পাইকারি চা",
  "nav.cost": "প্রতি গ্লাসের খরচ",
  "hero.kicker": "শিলিগুড়ি · আপনার দোকানের চা",
  "hero.title": "রোজ দোকানে যে চা বানান,",
  "hero.titleEmphasis": "সেই চায়েই পরখ করুন।",
  "hero.intro":
    "আপনার দোকানের দুধ আর চায়ের মাপেই বানিয়ে দেখুন। স্যাম্পল নিন অথবা বড় প্যাকের দাম ও ডেলিভারি দেখুন।",
  "hero.ctaTrial": "স্যাম্পল দেখুন",
  "hero.ctaBulk": "পাইকারি দাম দেখুন",
  "hero.listen": "শুনুন",
  "hero.brewGuide": "চা বানানোর মাপ দেখুন",
  "trial.kicker": "চায়ের স্যাম্পল",
  "trial.title": "পরের বারের চায়ে পরখ করে দেখুন।",
  "trial.intro":
    "রোজ যেভাবে চা বানান, সেভাবেই একবার বানান। রং, কড়াভাব আর স্বাদ মিলিয়ে বড় প্যাক বেছে নিন।",
  "trial.cta": "স্যাম্পল ও ডেলিভারি দেখুন",
  "trial.unavailable": "স্যাম্পল কিট এখন বন্ধ আছে। আপনি পাইকারি দাম দেখতে বা যোগাযোগ করতে পারেন।",
  "bulk.kicker": "পাইকারি চা",
  "bulk.title": "আপনার দোকানে চা পৌঁছতে কত লাগবে?",
  "bulk.chooseTea": "চা বেছে নিন",
  "bulk.packSize": "প্যাকের ওজন",
  "bulk.packs": "প্যাক সংখ্যা",
  "bulk.payment": "পেমেন্ট পদ্ধতি",
  "bulk.pinLabel": "দোকানের পিনকোড",
  "bulk.checkDelivery": "ডেলিভারি দেখুন",
  "payment.prepaid": "প্রিপেইড",
  "payment.cod": "ডেলিভারির সময় টাকা",
  "payment.freight_advance": "ভাড়া অগ্রিম",
  "quote.heading": "আপনার ডেলিভারির হিসাব",
  "quote.tea": "চায়ের দাম",
  "quote.freight": "পরিবহন খরচ",
  "quote.taxes": "অতিরিক্ত কর",
  "quote.fees": "অন্যান্য খরচ",
  "quote.credit": "স্যাম্পল ক্রেডিট",
  "quote.total": "মোট দাম",
  "quote.perKg": "{amount} / কেজি দোকানে",
  "quote.perKgDepot": "{amount} / কেজি ডিপো পর্যন্ত",
  "quote.payNow": "এখন দিতে হবে",
  "quote.balanceAtCollection": "সংগ্রহের সময় বাকি",
  "quote.handover.doorstep": "দোকানে ডেলিভারি · {locality}",
  "quote.handover.depot": "ডিপো থেকে সংগ্রহ · {depot} · {address}",
  "quote.reviewPack": "প্যাকের হিসাব দেখুন",
  "quote.manualTitle": "পরিবহন খরচ জেনে নিন",
  "quote.manualBody": "পিনকোড {pin}-এর জন্য সঠিক পরিবহন খরচ ও ডেলিভারির স্থান আমাদের টিম জানাবে।",
  "quote.prepareEnquiry": "বার্তা লিখুন",
  "quote.enterPin": "পিনকোড দিয়ে পরিবহন খরচ, সংগ্রহের স্থান এবং মোট দাম দেখুন।",
  "calc.kicker": "দোকানের হিসাব",
  "calc.title": "এক গ্লাসে চায়ের খরচ কত?",
  "calc.subtitle": "শুধু চা পাতার খরচ। দোকানে বানানো দুই ব্যাচের মাপ দিন।",
  "calc.yourTea": "আপনার বর্তমান চা",
  "calc.teafloww": "TeaFloww",
  "calc.pricePerKg": "দাম / কেজি (₹)",
  "calc.teaGrams": "চা (গ্রাম)",
  "calc.glasses": "গ্লাস সংখ্যা",
  "calc.perGlass": "/ গ্লাস",
  "help.kicker": "দোকানদারদের সহায়তা",
  "help.title": "TeaFloww-কে জিজ্ঞেস করুন।",
  "help.whatsappCta": "হোয়াটসঅ্যাপ বার্তা লিখুন",
  "lang.chooseTitle": "আপনার ভাষা বেছে নিন",
  "checkout.title": "প্যাক যাচাই করুন",
  "checkout.placeOrder": "অর্ডার নিশ্চিত করুন",
  "checkout.payNow": "{amount} পেমেন্ট করুন",
  "order.title": "আপনার ট্রেড অর্ডার",
  "enquiry.requestTransport": "পরিবহন খরচ জিজ্ঞেস করুন",
};

const HI: TradeDictionary = {
  ...EN,
  "brand.subtitle": "चाय की दुकानों के लिए",
  "nav.trial": "ट्रायल किट",
  "nav.bulk": "थोक सप्लाई",
  "nav.cost": "प्रति गिलास खर्च",
  "hero.kicker": "सिलीगुड़ी · आपकी दुकान की चाय",
  "hero.title": "जो चाय आप रोज़ बनाते हैं,",
  "hero.titleEmphasis": "उसी में परखें।",
  "hero.intro":
    "अपने दूध और अपने माप से बनाकर देखें। काउंटर पर ट्रायल आज़माएँ या थोक पैक की कुल कीमत जानें।",
  "hero.ctaTrial": "ट्रायल देखें",
  "hero.ctaBulk": "थोक भाव देखें",
  "hero.listen": "सुनें",
  "hero.brewGuide": "बनाने का तरीका देखें",
  "trial.kicker": "ट्रायल किट",
  "trial.title": "अगली शिफ्ट की चाय में आज़माएँ।",
  "trial.cta": "ट्रायल और डिलीवरी देखें",
  "bulk.kicker": "थोक सप्लाई",
  "bulk.title": "आपकी दुकान पर चाय कितने की पड़ेगी?",
  "bulk.chooseTea": "चाय चुनें",
  "bulk.packSize": "पैक का वज़न",
  "bulk.packs": "पैक संख्या",
  "bulk.payment": "भुगतान का तरीका",
  "bulk.pinLabel": "दुकान का पिनकोड",
  "bulk.checkDelivery": "डिलीवरी देखें",
  "payment.prepaid": "प्रीपेड",
  "payment.cod": "डिलीवरी पर भुगतान",
  "payment.freight_advance": "भाड़ा अग्रिम",
  "quote.heading": "आपका डिलीवरी कोट",
  "quote.tea": "चाय की कीमत",
  "quote.freight": "भाड़ा और हैंडलिंग",
  "quote.total": "कुल राशि",
  "quote.perKg": "{amount} / किग्रा दुकान तक",
  "quote.perKgDepot": "{amount} / किग्रा डिपो तक",
  "quote.payNow": "अभी देय",
  "quote.balanceAtCollection": "डिलीवरी पर शेष",
  "quote.reviewPack": "पैक की समीक्षा करें",
  "quote.prepareEnquiry": "पूछताछ भेजें",
  "calc.kicker": "काउंटर का हिसाब",
  "calc.title": "एक गिलास में चाय का खर्च कितना?",
  "calc.yourTea": "आपकी मौजूदा चाय",
  "calc.pricePerKg": "भाव / किग्रा (₹)",
  "calc.teaGrams": "चाय (ग्राम)",
  "calc.glasses": "बने गिलास",
  "calc.perGlass": "/ गिलास",
  "help.kicker": "दुकानदार सहायता",
  "help.title": "TeaFloww से पूछें।",
  "help.whatsappCta": "व्हाट्सएप संदेश तैयार करें",
  "lang.chooseTitle": "अपनी भाषा चुनें",
  "checkout.title": "अपना पैक जांचें",
  "checkout.placeOrder": "ऑर्डर पक्का करें",
  "checkout.payNow": "{amount} भुगतान करें",
  "order.title": "आपका ट्रेड ऑर्डर",
};

const GU: TradeDictionary = {
  ...EN,
  "brand.subtitle": "ચાની દુકાનો માટે",
  "nav.trial": "ટ્રાયલ કિટ",
  "nav.bulk": "જથ્થાબંધ ચા",
  "nav.cost": "ગ્લાસ દીઠ ખર્ચ",
  "hero.kicker": "સિલિગુડી · તમારા કાઉન્ટર માટે ચા",
  "hero.title": "તમે રોજ જે ચા બનાવો છો,",
  "hero.titleEmphasis": "તેમાં જ ચકાસો.",
  "hero.intro":
    "તમારા દૂધ અને માપથી બનાવીને જુઓ. ટ્રાયલ કિટ મંગાવો અથવા તમારી દુકાને આખા પેકનો ખર્ચ જાણો.",
  "hero.ctaTrial": "સેમ્પલ જુઓ",
  "hero.ctaBulk": "જથ્થાબંધ ભાવ જુઓ",
  "hero.listen": "સાંભળો",
  "hero.brewGuide": "બનાવવાની રીત જુઓ",
  "bulk.chooseTea": "ચા પસંદ કરો",
  "bulk.packSize": "પેકનું વજન",
  "bulk.packs": "પેકની સંખ્યા",
  "bulk.pinLabel": "દુકાનનો પિનકોડ",
  "bulk.checkDelivery": "ડિલિવરી જુઓ",
  "quote.total": "કુલ રકમ",
  "lang.chooseTitle": "તમારી ભાષા પસંદ કરો",
  "help.whatsappCta": "વોટ્સએપ પૂછપરછ તૈયાર કરો",
};

const MR: TradeDictionary = {
  ...EN,
  "brand.subtitle": "चहाच्या दुकानांसाठी",
  "nav.trial": "ट्रायल किट",
  "nav.bulk": "घाऊक पुरवठा",
  "nav.cost": "प्रति ग्लास खर्च",
  "hero.kicker": "सिलीगुडी · तुमच्या दुकानासाठी चहा",
  "hero.title": "तुम्ही रोज जो चहा बनवता,",
  "hero.titleEmphasis": "त्यातच तपासून पहा.",
  "hero.intro":
    "तुमच्या दुधात आणि मापात बनवून पहा. सॅम्पल घ्या किंवा पूर्ण पॅक तुमच्या दुकानापर्यंत कितीला पडेल ते तपासा.",
  "hero.ctaTrial": "सॅम्पल पहा",
  "hero.ctaBulk": "घाऊक दर पहा",
  "hero.listen": "ऐका",
  "hero.brewGuide": "चहा बनवण्याचे माप पहा",
  "bulk.chooseTea": "चहा निवडा",
  "bulk.packSize": "पॅकचे वजन",
  "bulk.packs": "पॅक संख्या",
  "bulk.pinLabel": "दुकानाचा पिनकोड",
  "bulk.checkDelivery": "डिलिव्हरी पहा",
  "quote.total": "एकूण रक्कम",
  "lang.chooseTitle": "तुमची भाषा निवडा",
  "help.whatsappCta": "व्हॉट्सॲप चौकशी तयार करा",
};

const BASE_DICTIONARIES: Record<TradeLocale, TradeDictionary> = {
  en: EN,
  bn: BN,
  hi: HI,
  gu: GU,
  mr: MR,
};

export function getTradeDictionary(locale: AnyTradeLocale): TradeDictionary {
  const base =
    locale in BASE_DICTIONARIES
      ? BASE_DICTIONARIES[locale as TradeLocale]
      : BASE_DICTIONARIES.en;

  const merged: TradeDictionary = { ...base };
  try {
    const overrides = listLocalizedContent(locale);
    for (const row of overrides) {
      if (row.resource_key in merged && row.review_status === "reviewed") {
        (merged as Record<string, string>)[row.resource_key] = row.text_value;
      }
    }
  } catch {
    // Fallback gracefully to base dictionary if DB not initialized
  }
  return merged;
}

export function formatTradeMessage(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}
