#!/usr/bin/env node
/**
 * TeaFloww Live Translation Records Generator & Publisher
 *
 * Populates and publishes verified multilingual translation records into
 * commerce_translations across Pan-India languages (hi, bn, pa, mr, gu, ta, te).
 *
 * Supports:
 * - Local SQLite: node scripts/publish-live-translations.mjs
 * - Production PostgreSQL: DATABASE_TYPE=postgres node scripts/publish-live-translations.mjs
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function hash(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

const isPostgres =
  process.env.DATABASE_TYPE === "postgres" ||
  Boolean(process.env.PGHOST) ||
  Boolean(process.env.DATABASE_URL?.startsWith("postgres"));

// Storefront copy & Pan-India items
const storefrontCopy = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src/lib/international/storefrontCopy.json"), "utf8")
);
const { PAN_INDIA_ITEMS, getLocaleDictionary } = await import(
  "../src/lib/international/panIndiaDictionary.mjs"
);

const UI_SOURCE = {
  ...storefrontCopy,
  nav_shop: "Shop Tea",
  nav_leaf: "Leaf to Cup",
  nav_black: "Black Teas",
  nav_blend_lab: "Blend Lab",
  nav_finder: "Tea Finder",
  nav_trials: "Trials & Samples",
  nav_wholesale: "Wholesale & Bulk",
  invalid_fields: "Please check the submitted fields.",
  deliver: "Deliver to",
  currency: "Currency",
  language: "Language",
  save: "Save preferences",
  close: "Close",
  search: "Search countries",
  unavailable: "Browsing is available. Checkout is not yet available for this destination.",
  shop: "Shop",
  bag: "Bag",
  checkout: "Checkout",
  name: "Full name",
  email: "Email",
  phone: "Phone",
  line1: "Street address",
  line2: "Apartment or building (optional)",
  city: "City",
  state: "State or region",
  postcode: "Postal code",
  country: "Country",
  prepaid: "Pay online",
  cod: "Cash on delivery (India)",
  quote: "Calculate delivery and total",
  pay: "Continue to payment",
  placeCod: "Place cash on delivery order",
  shipping: "Delivery",
  merchandise: "Teas after discounts",
  duties: "Import charges",
  tax: "Additional tax",
  codFee: "Cash on delivery fee",
  paymentDiscount: "Prepaid Instant Discount",
  total: "Total",
  recipient: "Import duties and local taxes may be collected on arrival and are payable by the recipient.",
  included: "Calculated import duties are included in this total.",
  pending: "Payment verification pending",
  review: "Review your delivery details and final total before payment.",
  coupon: "Offer code",
  loading: "Loading…",
  expired: "Your quote expired. Calculate a new total.",
  inrAcceptance:
    "I accept that my payment will be charged in INR (Indian Rupees) and my bank may apply foreign exchange or conversion fees.",
};

for (const item of PAN_INDIA_ITEMS) {
  UI_SOURCE[item.id] = item.en;
  UI_SOURCE[item.en] = item.en;
}

const UI_SOURCE_HASH = hash(UI_SOURCE);

// Curated shell translations
const SHELL_TRANSLATIONS = {
  hi: {
    "announcement.text": "₹499 से अधिक के ऑर्डर पर मुफ़्त डिलीवरी",
    "announcement.highlight": "✨ ₹499 से अधिक के ऑर्डर पर मुफ़्त डिलीवरी",
    "announcement.link_label": "चाय खरीदें",
    "announcement.wholesale_label": "🌿 थोक व व्यावसायिक ऑर्डर",
    "navigation.tagline": "हिमालयी सिंगल-एस्टेट चाय",
    "navigation.header_links.0.label": "चाय खरीदें",
    "navigation.header_links.1.label": "पत्ती से प्याला",
    "navigation.header_links.2.label": "थोक व व्यावसायिक ऑर्डर",
    "navigation.header_links.3.label": "प्राइवेट लेबल",
    "navigation.header_links.4.label": "ब्लेंड लैब",
    "navigation.header_links.5.label": "ट्रायल व सैम्पल्स",
    "navigation.footer_links.0.label": "चाय खरीदें",
    "navigation.footer_links.1.label": "ब्लॉग व टी जर्नल",
    "navigation.footer_links.2.label": "थोक व व्यावसायिक ऑर्डर",
    "navigation.footer_links.3.label": "प्राइवेट लेबल",
    "navigation.footer_links.4.label": "प्रोडक्ट फ़ीड्स",
    "navigation.footer_links.5.label": "साइटमैप",
    "navigation.footer_links.6.label": "ब्रांड सामग्री",
    "navigation.footer_links.7.label": "शिपिंग नीति",
    "navigation.footer_links.8.label": "रिटर्न व रिफ़ंड",
    "navigation.footer_links.9.label": "गोपनीयता नीति",
    "navigation.footer_links.10.label": "सेवा की शर्तें",
    "navigation.footer_links.11.label": "संपर्क करें",
  },
  bn: {
    "announcement.text": "₹499-এর বেশি অর্ডারে বিনামূল্যে ডেলিভারি",
    "announcement.highlight": "✨ ₹499-এর বেশি অর্ডারে বিনামূল্যে ডেলিভারি",
    "announcement.link_label": "চা কিনুন",
    "announcement.wholesale_label": "🌿 পাইকারি ও বাল্ক অর্ডার",
    "navigation.tagline": "হিমালয়ান সিঙ্গেল-এস্টেট চা",
    "navigation.header_links.0.label": "চা কিনুন",
    "navigation.header_links.1.label": "পাতা থেকে পেয়ালা",
    "navigation.header_links.2.label": "পাইকারি ও বাল্ক অর্ডার",
    "navigation.header_links.3.label": "প্রাইভেট লেবেল",
    "navigation.header_links.4.label": "ব্লেন্ড ল্যাব",
    "navigation.header_links.5.label": "ট্রায়াল ও নমুনা",
    "navigation.footer_links.0.label": "চা কিনুন",
    "navigation.footer_links.1.label": "ব্লগ ও টি জার্নাল",
    "navigation.footer_links.2.label": "পাইকারি ও বাল্ক অর্ডার",
    "navigation.footer_links.3.label": "প্রাইভেট লেবেল",
    "navigation.footer_links.4.label": "প্রোডাক্ট ফিডস",
    "navigation.footer_links.5.label": "সাইটম্যাপ",
    "navigation.footer_links.6.label": "ব্র্যান্ড অ্যাসেট",
    "navigation.footer_links.7.label": "শিপিং নীতি",
    "navigation.footer_links.8.label": "রিটার্ন নীতি",
    "navigation.footer_links.9.label": "গোপনীয়তা নীতি",
    "navigation.footer_links.10.label": "পরিষেবার শর্তাবলী",
    "navigation.footer_links.11.label": "যোগাযোগ করুন",
  },
  pa: {
    "announcement.text": "₹499 ਤੋਂ ਵੱਧ ਦੇ ਆਰਡਰਾਂ 'ਤੇ ਮੁਫ਼ਤ ਡਿਲਿਵਰੀ",
    "announcement.highlight": "✨ ₹499 ਤੋਂ ਵੱਧ ਦੇ ਆਰਡਰਾਂ 'ਤੇ ਮੁਫ਼ਤ ਡਿਲਿਵਰੀ",
    "announcement.link_label": "ਚਾਹ ਖਰੀਦੋ",
    "announcement.wholesale_label": "🌿 ਥੋਕ ਅਤੇ ਬਲਕ ਆਰਡਰ",
    "navigation.tagline": "ਹਿਮਾਲੀਅਨ ਸਿੰਗਲ-ਅਸਟੇਟ ਚਾਹ",
    "navigation.header_links.0.label": "ਚਾਹ ਖਰੀਦੋ",
    "navigation.header_links.1.label": "ਪੱਤੀ ਤੋਂ ਪਿਆਲੇ ਤੱਕ",
    "navigation.header_links.2.label": "ਥੋਕ ਅਤੇ ਬਲਕ ਆਰਡਰ",
    "navigation.header_links.3.label": "ਪ੍ਰਾਈਵੇਟ ਲੇਬਲ",
    "navigation.header_links.4.label": "ਬਲੈਂਡ ਲੈਬ",
    "navigation.header_links.5.label": "ਟ੍ਰਾਇਲ ਅਤੇ ਨਮੂਨੇ",
  },
  mr: {
    "announcement.text": "₹499 पेक्षा जास्त किमतीच्या ऑर्डर्सवर मोफत वितरण",
    "announcement.highlight": "✨ ₹499 पेक्षा जास्त किमतीच्या ऑर्डर्सवर मोफत वितरण",
    "announcement.link_label": "चहा खरेदी करा",
    "announcement.wholesale_label": "🌿 घाऊक आणि मोठ्या ऑर्डर्स",
    "navigation.tagline": "हिमालयीन सिंगल-इस्टेट चहा",
    "navigation.header_links.0.label": "चहा खरेदी करा",
    "navigation.header_links.1.label": "पानापासून कपापर्यंत",
    "navigation.header_links.2.label": "घाऊक आणि मोठ्या ऑर्डर्स",
    "navigation.header_links.3.label": "प्रायव्हेट लेबल",
    "navigation.header_links.4.label": "ब्लेंड लॅब",
    "navigation.header_links.5.label": "चाचण्या आणि नमुने",
  },
  gu: {
    "announcement.text": "₹499 થી વધુના ઓર્ડર પર મફત ડિલિવરી",
    "announcement.highlight": "✨ ₹499 થી વધુના ઓર્ડર પર મફત ડિલિવરી",
    "announcement.link_label": "ચા ખરીદો",
    "announcement.wholesale_label": "🌿 જથ્થાબંધ અને બલ્ક ઓર્ડર",
    "navigation.tagline": "હિમાલયન સિંગલ-એસ્ટેટ ચા",
    "navigation.header_links.0.label": "ચા ખરીદો",
    "navigation.header_links.1.label": "પાંદડાથી કપ સુધી",
    "navigation.header_links.2.label": "જથ્થાબંધ અને બલ્ક ઓર્ડર",
  },
  ta: {
    "announcement.text": "₹499க்கு மேல் ஆர்டர்களுக்கு இலவச டெலிவரி",
    "announcement.highlight": "✨ ₹499க்கு மேல் ஆர்டர்களுக்கு இலவச டெலிவரி",
    "announcement.link_label": "தேநீர் வாங்கவும்",
    "announcement.wholesale_label": "🌿 மொத்த மற்றும் மொத்த ஆர்டர்கள்",
    "navigation.tagline": "இமயமலை ஒற்றை எஸ்டேட் தேநீர்",
  },
  te: {
    "announcement.text": "₹499 కంటే ఎక్కువ ఆర్డర్‌లకు ఉచిత డెలివరీ",
    "announcement.highlight": "✨ ₹499 కంటే ఎక్కువ ఆర్డర్‌లకు ఉచిత డెలివరీ",
    "announcement.link_label": "టీ కొనండి",
    "announcement.wholesale_label": "🌿 టోకు & బల్క్ ఆర్డర్లు",
    "navigation.tagline": "హిమాలయన్ సింగిల్-ఎస్టేట్ టీ",
  },
};

// Curated Category Translations
const CATEGORY_TRANSLATIONS = {
  1: {
    hi: { name: "काली चाय", title: "काली चाय" },
    bn: { name: "ব্ল্যাক টি", title: "ব্ল্যাক টি" },
  },
  75: {
    hi: { name: "बंगाल सिग्नेचर ब्लेंड्स", title: "बंगाल सिग्नेचर ब्लेंड्स" },
    bn: { name: "বেঙ্গল সিগনেচার ব্লেন্ডস", title: "বেঙ্গল সিগনেচার ব্লেন্ডস" },
  },
  76: {
    hi: { name: "रोज़ाना कड़क दूध वाली चाय", title: "रोज़ाना कड़क दूध वाली चाय" },
    bn: { name: "রোজকার দুধ চা", title: "রোজকার দুধ চা" },
  },
  77: {
    hi: { name: "क्षेत्रीय चाय स्रोत", title: "क्षेत्रीय चाय स्रोत" },
    bn: { name: "আঞ্চলিক চায়ের উৎস", title: "আঞ্চলিক চায়ের উৎস" },
  },
  80: {
    hi: { name: "चाय ट्रायल्स व सैम्पल पैक", title: "चाय ट्रायल्स व सैम्पल पैक" },
    bn: { name: "টি ট্রায়াল ও স্যাম্পল প্যাক", title: "টি ট্রায়াল ও স্যাম্পল প্যাক" },
  },
};

// Curated Product Translations
const PRODUCT_TRANSLATIONS = {
  1: {
    hi: {
      name: "दार्जिलिंग स्प्रिंग क्लोनल फर्स्ट फ्लश",
      description:
        "कुर्सियांग घाटी की धुंध भरी ऊँचाइयों में वसंत ऋतु के पहले प्रहर में हाथ से तोड़ी गई कोमल पत्तियाँ। हल्की सुनहरी चाय, ताज़े फूलों और हरे फलों की मनमोहक सुगंध के साथ।",
      tasting_notes: "जंगली शहद, मस्कटेल अंगूर, हरा आड़ू, चीड़ की खुशबू",
      dry_leaf_appearance: "सफेद सिल्वर टिप्स युक्त मुड़ी हुई गहरे हरे रंग की पत्तियाँ",
      dry_leaf_aroma: "पहाड़ी ताज़ा हवा, ऑर्किड पुष्प और ताज़ी कटी घास",
      liquor_hue_name: "सुनहरा एम्बर",
      liquor_clarity: "पारदर्शी सुनहरी चमक",
      liquor_body: "शैंपेन जैसी हल्की और ताज़गी भरी चाय",
      wet_leaf_aroma: "मीठे ताज़े फल, गेंदे के फूल और देवदार",
      wet_leaf_oxidation: "हल्का 15–20% ऑक्सीकरण",
      steep_instructions: "85°C पर ताज़ा पानी गर्म करें। 2.5g चाय 200ml पानी में 3 मिनट तक उबालें।",
      estate_story: "दार्जिलिंग के ऋषिहाट एस्टेट से, जो 6,000 फीट की ऊँचाई पर स्थित है।",
      seo_title: "दार्जिलिंग स्प्रिंग फर्स्ट फ्लश — ऋषिहाट क्लोनल ऑर्थोडॉक्स चाय | TeaFloww",
      seo_description:
        "कुर्सियांग की घाटी से वसंत का पहला फ्लश। हाथ से चुनी गई क्लोनल पत्तियां जो सुनहरी रंगत और मस्कटेल स्वाद प्रदान करती हैं।",
    },
    bn: {
      name: "দার্জিলিং স্প্রিং ক্লোনাল ফার্স্ট ফ্লাশ",
      description:
        "কার্শিয়াং উপত্যকার কুয়াশাচ্ছন্ন উচ্চতায় বসন্তের শুরুতে হাতে তোলা কচি পাতা। উজ্জ্বল সোনালী রঙ ও সুগন্ধি চায়ের সেরা অভিজ্ঞতা।",
      tasting_notes: "বুনো মধু, মাসকাটেল আঙুর, সবুজ পিচ",
      dry_leaf_appearance: "রূপোলি টিপস যুক্ত বাঁকানো সবুজ পাতা",
      dry_leaf_aroma: "পাহাড়ের টাটকা বাতাস ও তাজা অর্কিডের গন্ধ",
      liquor_hue_name: "উজ্জ্বল সোনালী অ্যাম্বার",
      liquor_clarity: "স্ফটিকের মতো স্বচ্ছ সোনালী আভা",
      liquor_body: "শ্যাম্পেনের মতো তরতাজা ও প্রফুল্ল স্বাদ",
      wet_leaf_aroma: "মিষ্টি ফল ও পাইন ফুলের সুবাস",
      wet_leaf_oxidation: "হালকা 15–20% জারণ",
      steep_instructions: "85°C তাপমাত্রায় জল গরম করুন। 2.5g পাতা 200ml জলে 3 মিনিট ভিজিয়ে রাখুন।",
      estate_story: "দার্জিলিং-এর 6,000 ফুটেরও বেশি উঁচুতে অবস্থিত ঋষিহাট চা বাগান থেকে সংগৃহীত।",
      seo_title: "দার্জিলিং স্প্রিং ফার্স্ট ফ্লাশ — ঋষিহাট অর্থোডক্স চা | TeaFloww",
      seo_description:
        "কার্শিয়াং ইস্টের খাঁটি বসন্তকালীন প্রথম ফ্লাশ চা। উজ্জ্বল সোনালী পানীয় ও মাসকাটেল সুবাস।",
    },
  },
  47: {
    hi: {
      name: "रोज़ाना कड़क दूध वाली चाय",
      description:
        "सुबह की ताज़गी के लिए चुनी गई कड़क असम सीटीसी चाय, जो दूध के साथ गाढ़ी और स्वादिष्ट चाय बनाती है।",
      tasting_notes: "माल्ट, कड़क चाय, समृद्ध स्वाद",
      dry_leaf_appearance: "दानेदार गहरी काली सीटीसी पत्तियाँ",
      dry_leaf_aroma: "ताज़ा माल्ट और चाय पत्ती की खुशबू",
      liquor_hue_name: "गाढ़ा महोगनी भूरा",
      liquor_clarity: "गाढ़ा और समृद्ध",
      liquor_body: "कड़क और भरपूर",
      wet_leaf_aroma: "उबले हुए माल्ट की खुशबू",
      wet_leaf_oxidation: "100% पूर्ण ऑक्सीकरण",
      steep_instructions: "दूध और पानी के साथ 100°C पर 3-4 मिनट तक उबालें।",
      estate_story: "असम के सर्वोत्तम बागानों से चुनी गई सीटीसी चाय।",
      seo_title: "रोज़ाना कड़क दूध वाली चाय | TeaFloww",
      seo_description: "असम सीटीसी से बनी रोज़ाना की कड़क दूध चाय।",
    },
    bn: {
      name: "রোজকার কড়া দুধ চা",
      description:
        "সকালের সতেজতার জন্য নির্বাচিত কড়া আসাম সিটিসি চা, যা দুধের সাথে দারুণ স্বাদের হয়।",
      tasting_notes: "মল্ট, কড়া স্বাদ, সমৃদ্ধ লিকার",
      dry_leaf_appearance: "দানাদার কালো সিটিসি পাতা",
      dry_leaf_aroma: "তাজা মল্ট ও চায়ের ঘ্রাণ",
      liquor_hue_name: "গাঢ় মেহগনি বাদামি",
      liquor_clarity: "ঘন ও সমৃদ্ধ লিকার",
      liquor_body: "কড়া ও তৃপ্তিদায়ক",
      wet_leaf_aroma: "তাজা ফোটানো চায়ের সুবাস",
      wet_leaf_oxidation: "100% সম্পূর্ণ জারণ",
      steep_instructions: "দুধ ও জলের সাথে 100°C এ 3-4 মিনিট ফোটান।",
      estate_story: "আসামের সেরা বাগান থেকে নির্বাচিত খাঁটি সিটিসি চা।",
      seo_title: "রোজকার কড়া দুধ চা | TeaFloww",
      seo_description: "আসাম সিটিসি দিয়ে তৈরি রোজকার খাঁটি দুধ চা।",
    },
  },
  48: {
    hi: {
      name: "इलायची कड़क चाय",
      description: "हरी इलायची के दानों से भरपूर असली कड़क चाय।",
      tasting_notes: "हरी इलायची, माल्ट, मीठी महक",
      dry_leaf_appearance: "काली चाय पत्ती कुचली हुई हरी इलायची के साथ",
      dry_leaf_aroma: "ताज़ी इलायची की मीठी खुशबू",
      liquor_hue_name: "सुनहरा भूरा",
      liquor_clarity: "समृद्ध व गहरा",
      liquor_body: "मसालेदार और सुगंधित",
      wet_leaf_aroma: "इलायची और ताज़ी चाय",
      wet_leaf_oxidation: "100% पूर्ण ऑक्सीकरण",
      steep_instructions: "दूध के साथ 100°C पर 3 मिनट तक उबालें।",
      estate_story: "केरल की इलायची और असम चाय का संगम।",
      seo_title: "इलायची कड़क चाय | TeaFloww",
      seo_description: "कुचली हुई हरी इलायची के साथ कड़क असम चाय।",
    },
    bn: {
      name: "এলাচ কড়া দুধ চা",
      description: "সবুজ এলাচের দানায় ভরপুর সেরা দুধ চা।",
      tasting_notes: "সবুজ এলাচ, মল্ট, মিষ্টি সুবাস",
      dry_leaf_appearance: "কালো চায়ের সাথে ফাটিয়ে নেওয়া এলাচ",
      dry_leaf_aroma: "তাজা এলাচের সুবাস",
      liquor_hue_name: "সোনালী বাদামী",
      liquor_clarity: "ঘন ও সুন্দর",
      liquor_body: "সুগন্ধযুক্ত ও কড়া",
      wet_leaf_aroma: "এলাচ ও কড়া চা",
      wet_leaf_oxidation: "100% সম্পূর্ণ জারণ",
      steep_instructions: "দুধের সাথে 100°C এ 3 মিনিট ফোটান।",
      estate_story: "কেরালার এলাচ ও আসামের সিটিসি চায়ের মেলবন্ধন।",
      seo_title: "এলাচ দুধ চা | TeaFloww",
      seo_description: "খাঁটি সবুজ এলাচ দিয়ে তৈরি স্পেশাল দুধ চা।",
    },
  },
  49: {
    hi: {
      name: "अदरक कड़क चाय",
      description: "ताज़े कुचले हुए अदरक के अर्क के साथ असम की कड़क चाय।",
      tasting_notes: "तीखा अदरक, माल्ट, गर्माहट",
      dry_leaf_appearance: "सीटीसी चाय के दाने सूखे अदरक के टुकड़ों के साथ",
      dry_leaf_aroma: "तीखा और ताज़ा अदरक",
      liquor_hue_name: "गहरा एम्बर भूरा",
      liquor_clarity: "गाढ़ा",
      liquor_body: "गर्माहट भरा कड़क स्वाद",
      wet_leaf_aroma: "अदरक की ताज़गी",
      wet_leaf_oxidation: "100% पूर्ण ऑक्सीकरण",
      steep_instructions: "दूध और पानी के साथ 100°C पर उबालें।",
      estate_story: "पूर्वोत्तर भारत के पहाड़ी अदरक और असम चाय का संयोजन।",
      seo_title: "अदरक कड़क चाय | TeaFloww",
      seo_description: "ताज़ी अदरक के साथ बनी कड़क चाय।",
    },
    bn: {
      name: "আদা কড়া দুধ চা",
      description: "তাজা আদার ঝাঁঝ ও আসামের কড়া চায়ের সুষম মেলবন্ধন।",
      tasting_notes: "ঝাঁঝালো আদা, মল্ট, আরামদায়ক স্বাদ",
      dry_leaf_appearance: "সিটিসি পাতা আদার দানার সাথে",
      dry_leaf_aroma: "তাজা আদার ঝাঁঝ",
      liquor_hue_name: "গাঢ় সোনালী বাদামি",
      liquor_clarity: "ঘন লিকার",
      liquor_body: "আরামদায়ক ও কড়া",
      wet_leaf_aroma: "আদা ও ফোটানো চা",
      wet_leaf_oxidation: "100% সম্পূর্ণ জারণ",
      steep_instructions: "দুধ ও জলের সাথে 100°C এ ফোটান।",
      estate_story: "পাহাড়ি খাঁটি আদা ও আসাম চায়ের অসাধারণ স্বাদ।",
      seo_title: "আদা চা | TeaFloww",
      seo_description: "ঝাঁঝালো তাজা আদার সাথে খাঁটি দুধ চা।",
    },
  },
  50: {
    hi: {
      name: "मसाला कड़क चाय",
      description:
        "इलायची, दालचीनी, लौंग, काली मिर्च और सोंठ का पारंपरिक भारतीय मसाला ब्लेंड।",
      tasting_notes: "इलायची, दालचीनी, अदरक, लौंग",
      dry_leaf_appearance: "सीटीसी चाय साबुत मसालों के मिश्रण के साथ",
      dry_leaf_aroma: "समृद्ध भारतीय मसालों की सुगंध",
      liquor_hue_name: "गहरा महोगनी",
      liquor_clarity: "गाढ़ा और खुशबूदार",
      liquor_body: "मसालेदार और संतुष्टिदायक",
      wet_leaf_aroma: "खड़े मसालों की महक",
      wet_leaf_oxidation: "100% पूर्ण ऑक्सीकरण",
      steep_instructions: "दूध और पानी में 100°C पर 3-4 मिनट धीमी आंच पर पकाएं।",
      estate_story: "पारंपरिक भारतीय चाय की प्रामाणिक रेसिपी।",
      seo_title: "मसाला कड़क चाय — स्पेशल ब्लेंड | TeaFloww",
      seo_description: "असली भारतीय मसालों से बनी कड़क मसाला चाय।",
    },
    bn: {
      name: "মশলা কড়া দুধ চা",
      description:
        "এলাচ, দারুচিনি, লবঙ্গ, গোলমরিচ ও আদার ঐতিহ্যবাহী মিশ্রণে তৈরি সুস্বাদু চা।",
      tasting_notes: "এলাচ, দারুচিনি, আদা, লবঙ্গ",
      dry_leaf_appearance: "আস্ত মশলার দানার সাথে কালো চা",
      dry_leaf_aroma: "ভারতীয় খাঁটি মশলার সুবাস",
      liquor_hue_name: "গাঢ় মেহগনি",
      liquor_clarity: "ঘন ও সুবাসিত লিকার",
      liquor_body: "মশলাদার ও তৃপ্তিদায়ক",
      wet_leaf_aroma: "তাজা মশলা ও চায়ের সৌরভ",
      wet_leaf_oxidation: "100% সম্পূর্ণ জারণ",
      steep_instructions: "দুধ ও জলের সাথে 100°C এ 3-4 মিনিট ফুটিয়ে নিন।",
      estate_story: "খাঁটি ভারতীয় ঘরোয়া চায়ের ঐতিহ্যবাহী মশলা ব্লেন্ড।",
      seo_title: "মশলা দুধ চা — স্পেশাল ব্লেন্ড | TeaFloww",
      seo_description: "খাঁটি ভারতীয় মশলা দিয়ে তৈরি স্পেশাল মসলা চা।",
    },
  },
};

// Curated Page Translations
const PAGE_TRANSLATIONS = {
  1: {
    hi: {
      title: "TeaFloww के बारे में",
      eyebrow: "स्रोत · शुद्धता · सिलीगुड़ी उत्पत्ति",
      headline: "ऊँचे हिमालय से सीधे आपके कप तक",
      subtitle:
        "उच्च पर्वतीय चाय कारीगरों और चाय प्रेमियों को ताजगी और पूर्ण पारदर्शिता के साथ जोड़ना।",
      body_markdown:
        "TeaFloww की स्थापना एक दृढ़ विश्वास के साथ हुई थी: चाय का स्वाद तब सबसे असाधारण होता है जब इसे बागान से सीधे ताजा पिया जाए।",
      meta_title: "TeaFloww के बारे में — हिमालयी सिंगल-एस्टेट चाय और स्रोत",
      meta_description:
        "दार्जिलिंग, असम, कांगड़ा और नीलगिरी से सीधे ताज़ा सिंगल-एस्टेट चाय की खोज करें। सिलीगुड़ी में पैक की गई।",
      "sections.0.heading": "हमारी चाय चयन नीति",
      "sections.0.body":
        "TeaFloww की स्थापना एक सरल सिद्धांत पर हुई: चाय सबसे बेहतरीन तब लगती है जब उसे बागान से तोड़े जाने के तुरंत बाद पिया जाए। हम मध्यस्थों के बिना दार्जिलिंग, असम, कांगड़ा और नीलगिरी के ऐतिहासिक चाय बागानों के साथ सीधे काम करते हैं।",
      "sections.1.heading": "सिलीगुड़ी सोर्सिंग व पूर्ति केंद्र",
      "sections.1.body":
        "पूर्वी हिमालय के ऐतिहासिक चौराहे सिलीगुड़ी, पश्चिम बंगाल (फुलबाड़ी घोषपुकुर बाईपास) में स्थित हमारा केंद्र चाय बागानों के बिल्कुल करीब है। ताजी तोड़ी गई चाय कुछ ही घंटों में यहाँ पहुँचती है और उसकी सुगंध को सुरक्षित रखने के लिए तुरंत पैक की जाती है।",
      "sections.2.heading": "हमारे चार अटल मानक",
      "sections.3.heading": "बंगाल की चाय संस्कृति से जुड़ाव",
      "sections.3.body":
        "दार्जिलिंग के सुबह के कोहरे से लेकर दोपहर की गरमा-गरम चाय की चुस्कियों तक, बंगाल में चाय जीवन का एक अभिन्न हिस्सा है। TeaFloww इस जीवंत विरासत का सम्मान करता है।",
    },
    bn: {
      title: "TeaFloww সম্পর্কে",
      eyebrow: "উৎপত্তি · বিশুদ্ধতা · শিলিগুড়ির ঐতিহ্য",
      headline: "উঁচু হিমালয় থেকে সরাসরি আপনার কাপে",
      subtitle:
        "পাহাড়ের চা শিল্পী ও চা প্রেমীদের তাজা ও বিশ্বস্ত চা পৌঁছে দেওয়ার অঙ্গীকার।",
      body_markdown:
        "TeaFloww একটি দৃঢ় প্রত্যয় নিয়ে প্রতিষ্ঠিত: চা সরাসরি বাগান থেকে যত তাজা খাওয়া যায়, এর স্বাদ ততটাই অপূর্ব হয়।",
      meta_title: "TeaFloww সম্পর্কে — হিমালয়ের সিঙ্গেল-এস্টেট চা",
      meta_description:
        "দার্জিলিং, আসাম, কাংড়া ও নীলগিরি থেকে সরাসরি খাঁটি সিঙ্গেল-এস্টেট চা। শিলিগুড়ি হাবে মোড়কজাত।",
      "sections.0.heading": "আমাদের সোর্সিং দর্শন",
      "sections.0.body":
        "TeaFloww প্রতিষ্ঠিত হয়েছে একটি সহজ বিশ্বাসে: চা সবচেয়ে ভালো স্বাদের হয় যখন এটি বাগানের তাজা অবস্থায় পান করা হয়। আমরা মধ্যস্বত্বভোগী ছাড়া দার্জিলিং, আসাম, কাংড়া এবং নীলগিরির ঐতিহ্যবাহী চা বাগানের সাথে সরাসরি কাজ করি।",
      "sections.1.heading": "শিলিগুড়ি সোর্সিং ও ডেলিভারি হাব",
      "sections.1.body":
        "পূর্ব হিমালয়ের ঐতিহাসিক সংযোগস্থল শিলিগুড়ি, পশ্চিমবঙ্গে (ফুলবাড়ি ঘোষপুকুর বাইপাস) অবস্থিত আমাদের কেন্দ্র চা বাগানের খুব কাছে। তাজা তোলা পাতা ঘণ্টার মধ্যেই পৌঁছায় এবং সুগন্ধ ধরে রাখতে এয়ারটাইট প্যাকেজিং করা হয়।",
      "sections.2.heading": "আমাদের চারটি মৌলিক মানদণ্ড",
      "sections.3.heading": "বাংলার চা সংস্কৃতির সাথে গভীর যোগসূত্র",
      "sections.3.body":
        "দার্জিলিং-এর কুয়াশাচ্ছন্ন ভোর থেকে আড্ডার চায়ের কাপ পর্যন্ত, বাংলায় চা এক নিত্যদিনের সুর। TeaFloww এই ঐতিহ্যকে শ্রদ্ধা জানায়।",
    },
  },
  2: {
    hi: {
      title: "हमसे संपर्क करें",
      eyebrow: "ग्राहक सेवा एवं मुख्यालय",
      headline: "हमारे चाय विशेषज्ञों से जुड़ें",
      subtitle:
        "चाय बनाने की विधि, ऑर्डर की स्थिति या थोक साझेदारी संबंधी किसी भी प्रश्न के लिए हम सदैव उपलब्ध हैं।",
      meta_title: "हमसे संपर्क करें — सिलीगुड़ी मुख्यालय · TeaFloww",
      meta_description:
        "TeaFloww (Nirva) सिलीगुड़ी से संपर्क करें। ग्राहक सहायता, चाय परामर्श और थोक साझेदारी।",
    },
    bn: {
      title: "যোগাযোগ করুন",
      eyebrow: "গ্রাহক সহায়তা ও প্রধান কার্যালয়",
      headline: "আমাদের চা বিশেষজ্ঞদের সাথে যোগাযোগ করুন",
      subtitle:
        "চা বানানোর সঠিক নিয়ম, অর্ডারের তথ্য বা হোলসেল পার্টনারশিপের জন্য আমরা সদা প্রস্তুত।",
      meta_title: "যোগাযোগ করুন — শিলিগুড়ি কার্যালয় · TeaFloww",
      meta_description:
        "TeaFloww (Nirva) শিলিগুড়ির সাথে যোগাযোগ করুন। গ্রাহক পরিষেবা ও পাইকারি কেনাকাটার সহায়তা।",
    },
  },
  3: {
    hi: {
      title: "शिपिंग नीति",
      eyebrow: "लॉजिस्टिक्स एवं डिलीवरी",
      headline: "सीधे उत्पत्ति स्थल से शिपिंग नीति",
      subtitle:
        "ताजगी बनाए रखने के लिए सिलीगुड़ी केंद्र से 24 से 48 घंटों के भीतर डिस्पैच किया जाता है।",
      meta_title: "शिपिंग नीति — TeaFloww सिलीगुड़ी",
      meta_description:
        "पैन-इंडिया एवं अंतरराष्ट्रीय डिलीवरी की समयसीमा और वैक्यूम पैकेजिंग के मानक।",
    },
    bn: {
      title: "শিপিং নীতি",
      eyebrow: "লজিস্টিকস ও ডেলিভারি",
      headline: "উৎস থেকে সরাসরি ডেলিভারি নীতি",
      subtitle:
        "খাঁটি সতেজতা নিশ্চিত করতে শিলিগুড়ি থেকে 24 থেকে 48 ঘণ্টার মধ্যে পাঠানো হয়।",
      meta_title: "শিপিং নীতি — TeaFloww শিলিগুড়ি",
      meta_description:
        "প্যান-ইন্ডিয়া এবং আন্তর্জাতিক ডেলিভারির শর্তাবলী ও প্যাকেজিং নিয়মাবলী।",
    },
  },
  4: {
    hi: {
      title: "रिटर्न एवं ताज़गी की गारंटी",
      eyebrow: "ग्राहक सुरक्षा",
      headline: "14-दिवसीय ताज़गी की गारंटी",
      subtitle:
        "हम अपनी बागान की चाय की गुणवत्ता पर गर्व करते हैं। किसी भी असंतोष की स्थिति में हम तुरंत समाधान करते हैं।",
      meta_title: "रिटर्न एवं ताज़गी की गारंटी नीति — TeaFloww",
      meta_description:
        "हमारी 14-दिवसीय ताज़गी गारंटी नीति और आसान रिप्लेसमेंट की शर्तें।",
    },
    bn: {
      title: "রিটার্ন ও ফ্রেশনেস গ্যারান্টি",
      eyebrow: "গ্রাহকের নিশ্চয়তা",
      headline: "14-দিনের ফ্রেশনেস গ্যারান্টি",
      subtitle:
        "আমরা আমাদের চায়ের খাঁটি মানে বিশ্বাসী। যেকোনো সমস্যায় দ্রুত সহায়তা নিশ্চিত।",
      meta_title: "রিটার্ন ও ফ্রেশনেস গ্যারান্টি পলিসি — TeaFloww",
      meta_description:
        "আমাদের 14-দিনের ফ্রেশনেস গ্যারান্টি ও সহজ পরিবর্তনের নিয়ম জানুন।",
    },
  },
  5: {
    hi: {
      title: "गोपनीयता नीति",
      eyebrow: "डेटा सुरक्षा और नैतिकता",
      headline: "गोपनीयता एवं डेटा सुरक्षा नीति",
      subtitle:
        "हम आपकी व्यक्तिगत गोपनीयता का पूरा सम्मान करते हैं और आपके डेटा की सुरक्षा के प्रति प्रतिबद्ध हैं।",
      meta_title: "गोपनीयता नीति — TeaFloww",
      meta_description:
        "TeaFloww आपकी व्यक्तिगत जानकारी की सुरक्षा और गोपनीयता कैसे सुनिश्चित करता है।",
    },
    bn: {
      title: "গোপনীয়তা নীতি",
      eyebrow: "তথ্য সুরক্ষা ও নৈতিকতা",
      headline: "গোপনীয়তা ও ডেটা সুরক্ষা নীতি",
      subtitle:
        "আমরা আপনার তথ্যের সম্পূর্ণ নিরাপত্তা ও গোপনীয়তা বজায় রাখতে প্রতিশ্রুতিবদ্ধ।",
      meta_title: "গোপনীয়তা নীতি — TeaFloww",
      meta_description:
        "TeaFloww আপনার তথ্যের সুরক্ষা কীভাবে করে তা বিস্তারিত জেনে নিন।",
    },
  },
};

const approved =
  /^(name|title|subtitle|description|body_markdown|content|eyebrow|headline|heading|subheading|body|label|text|tagline|emphasis|image_alt|alt_text|cta_label|caption|quote|author|role|tasting_notes|steep_instructions|estate_story|dry_leaf_appearance|dry_leaf_aroma|liquor_hue_name|liquor_clarity|liquor_body|wet_leaf_aroma|wet_leaf_oxidation|seo_title|seo_description|meta_title|meta_description|subject|text_body|summary|excerpt|heroTitle|heroDescription|announcement)$/;

function extractApproved(obj, prefix = "") {
  const result = {};
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => Object.assign(result, extractApproved(v, `${prefix}${i}.`)));
  } else if (obj && typeof obj === "object") {
    for (const [key, v] of Object.entries(obj)) {
      if (typeof v === "string" && approved.test(key) && v.trim() && !/[<>]/.test(v)) {
        result[`${prefix}${key}`] = v;
      } else if (typeof v === "object") {
        Object.assign(result, extractApproved(v, `${prefix}${key}.`));
      }
    }
  }
  return result;
}

async function run() {
  console.log(`Starting Live Translation Records Generation & Publishing...`);
  console.log(`Target Backend: ${isPostgres ? "PostgreSQL (Production)" : "SQLite (Local)"}`);

  let db;
  let pgClient;

  if (isPostgres) {
    const pg = (await import("pg")).default;
    const { Client } = pg;
    pgClient = new Client({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5433),
      user: process.env.PGUSER || "teafloww",
      password: process.env.PGPASSWORD || "teafloww",
      database: process.env.PGDATABASE || "teafloww",
    });
    await pgClient.connect();
    console.log("Connected to PostgreSQL successfully.");
  } else {
    const Database = (await import("better-sqlite3")).default;
    const dbPath = process.env.DATABASE_PATH || path.join(rootDir, "data", "store.sqlite");
    db = new Database(dbPath);
    console.log(`Connected to SQLite at ${dbPath}`);
  }

  // Unified helper to execute parameterized query
  async function query(sql, params = []) {
    if (isPostgres) {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      const res = await pgClient.query(pgSql, params);
      return res.rows;
    } else {
      const stmt = db.prepare(sql);
      if (sql.trim().toUpperCase().startsWith("SELECT")) {
        return stmt.all(...params);
      }
      return stmt.run(...params);
    }
  }

  async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows && rows.length ? rows[0] : null;
  }

  async function upsertTranslation(resource, locale, source, texts) {
    const sourceHash = hash(source);
    const sourceJson = JSON.stringify(source);
    const dictJson = JSON.stringify(texts);
    const now = Date.now();

    const existing = await queryOne(
      "SELECT id, revision FROM commerce_translations WHERE resource=? AND locale=?",
      [resource, locale]
    );

    if (existing) {
      const newRevision = (existing.revision || 1) + 1;
      await query(
        `UPDATE commerce_translations
         SET draft=?, published=?, published_hash=?, source_hash=?, source=?, revision=?, updated_ms=?
         WHERE id=?`,
        [dictJson, dictJson, sourceHash, sourceHash, sourceJson, newRevision, now, existing.id]
      );
      // Record history
      await query(
        `INSERT INTO commerce_translation_history (id, translation_id, document, created_ms)
         VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), existing.id, JSON.stringify({ resource, locale, texts }), now]
      );
      return { action: "updated", resource, locale };
    } else {
      const newId = crypto.randomUUID();
      await query(
        `INSERT INTO commerce_translations
         (id, resource, locale, source_hash, source, draft, published, published_hash, revision, updated_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [newId, resource, locale, sourceHash, sourceJson, dictJson, dictJson, sourceHash, now]
      );
      return { action: "inserted", resource, locale };
    }
  }

  const results = [];

  // 1. Publish Pan-India Storefront Interface (7 languages)
  const PAN_INDIA_LOCALES = ["hi", "bn", "pa", "mr", "gu", "ta", "te"];
  console.log(`\n1. Publishing Pan-India storefront interface translations for: ${PAN_INDIA_LOCALES.join(", ")}`);
  for (const loc of PAN_INDIA_LOCALES) {
    const dict = getLocaleDictionary(loc);
    const res = await upsertTranslation("interface", loc, UI_SOURCE, dict);
    results.push(res);
    console.log(`  ✓ Published interface [${loc}]`);
  }

  // 2. Publish Shell Translations (announcement & header links)
  console.log(`\n2. Publishing shell navigation and announcement translations...`);
  // Derive shell source from content blocks
  const announcementTextRow = await queryOne("SELECT content FROM site_content_blocks WHERE key='announcement.text'");
  const announcementText = announcementTextRow?.content || "FREE SHIPPING ON ORDERS ABOVE ₹499";
  const taglineRow = await queryOne("SELECT content FROM site_content_blocks WHERE key='brand.tagline'");
  const tagline = taglineRow?.content || "Orthodox & CTC Teas from Origin";
  const shellSource = {
    "navigation.tagline": tagline,
    "navigation.header_links.0.label": "Shop Tea",
    "navigation.header_links.1.label": "Leaf to Cup",
    "navigation.header_links.2.label": "Wholesale & Bulk",
    "navigation.header_links.3.label": "Private Label",
    "navigation.header_links.4.label": "Blend Lab",
    "navigation.header_links.5.label": "Trials & Samples",
    "navigation.footer_links.0.label": "Shop Tea",
    "navigation.footer_links.1.label": "Blog & Tea Journal",
    "navigation.footer_links.2.label": "Wholesale & Bulk",
    "navigation.footer_links.3.label": "Private Label",
    "navigation.footer_links.4.label": "Product Feeds",
    "navigation.footer_links.5.label": "Sitemap",
    "navigation.footer_links.6.label": "Brand Assets",
    "navigation.footer_links.7.label": "Shipping",
    "navigation.footer_links.8.label": "Returns",
    "navigation.footer_links.9.label": "Privacy Policy",
    "navigation.footer_links.10.label": "Terms of Service",
    "navigation.footer_links.11.label": "Contact Us",
    "announcement.text": announcementText,
  };

  for (const [loc, shellTrans] of Object.entries(SHELL_TRANSLATIONS)) {
    const merged = { ...shellSource, ...shellTrans };
    const res = await upsertTranslation("shell", loc, shellSource, merged);
    results.push(res);
    console.log(`  ✓ Published shell [${loc}]`);
  }

  // 3. Publish Categories
  console.log(`\n3. Publishing category translations...`);
  const categories = await query("SELECT id, name, description FROM categories ORDER BY id");
  for (const cat of categories) {
    const catSource = extractApproved(cat);
    const trans = CATEGORY_TRANSLATIONS[cat.id];
    if (trans) {
      for (const [loc, texts] of Object.entries(trans)) {
        const merged = { ...catSource, ...texts };
        const res = await upsertTranslation(`category:${cat.id}`, loc, catSource, merged);
        results.push(res);
        console.log(`  ✓ Published category:${cat.id} (${cat.name}) [${loc}]`);
      }
    }
  }

  // 4. Publish Products
  console.log(`\n4. Publishing product translations...`);
  const products = await query("SELECT * FROM products ORDER BY id");
  for (const p of products) {
    const prodSource = extractApproved(p);
    const trans = PRODUCT_TRANSLATIONS[p.id];
    if (trans) {
      for (const [loc, texts] of Object.entries(trans)) {
        const merged = { ...prodSource, ...texts };
        const res = await upsertTranslation(`product:${p.id}`, loc, prodSource, merged);
        results.push(res);
        console.log(`  ✓ Published product:${p.id} (${p.name}) [${loc}]`);
      }
    }
  }

  // 5. Publish Site Pages
  console.log(`\n5. Publishing site pages translations...`);
  const pages = await query("SELECT * FROM site_pages ORDER BY id");
  for (const page of pages) {
    if (typeof page.sections_json === "string") {
      try { page.sections = JSON.parse(page.sections_json); } catch {}
    }
    const pageSource = extractApproved(page);
    const trans = PAGE_TRANSLATIONS[page.id];
    if (trans) {
      for (const [loc, texts] of Object.entries(trans)) {
        const merged = { ...pageSource, ...texts };
        const res = await upsertTranslation(`page:${page.id}`, loc, pageSource, merged);
        results.push(res);
        console.log(`  ✓ Published page:${page.id} (${page.title}) [${loc}]`);
      }
    }
  }

  if (isPostgres) {
    await pgClient.end();
  } else {
    db.close();
  }

  console.log(`\n✅ Successfully published ${results.length} live translation records!`);
}

run().catch((err) => {
  console.error("Failed publishing live translations:", err);
  process.exit(1);
});
