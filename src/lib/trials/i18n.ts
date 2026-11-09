/**
 * TeaFloww Trials v3 — Bilingual Translation Dictionary (English / Reviewed Hindi)
 *
 * Professional, authentic culinary and tea-trade terminology:
 * - चाय (Chai)
 * - नमूना किट / ट्रायल्स (Sample kit / Discovery flights)
 * - परख (Sensory evaluation / Verdict)
 * - प्याला (Tea cup / Cutting)
 * - पत्ती (Tea leaf / Leaf dose)
 * - कड़क / इलायची / अदरक / मसाला (Kadak / Elaichi / Ginger / Masala)
 */

export type TrialLocale = "en" | "hi";

export interface TrialTranslationEntry {
  en: string;
  hi: string;
}

export const TRIAL_DICTIONARY: Record<string, TrialTranslationEntry> = {
  // Brand & Header
  brand_tagline: {
    en: "The Art of Everyday Chai",
    hi: "हर दिन की बेहतरीन चाय की कला",
  },
  top_announcement: {
    en: "Crafted in Siliguri · Compare teas in your own kettle",
    hi: "सिलीगुड़ी में निर्मित · अपनी ही केतली में चाय की परख करें",
  },
  introducing_eyebrow: {
    en: "INTRODUCING TEAFLOWW TRIALS — THE CHAI STALL EDITION",
    hi: "प्रस्तुत है टीफ़्लो ट्रायल्स — चाय स्टॉल संस्करण",
  },
  hero_title_prefix: {
    en: "Great chai begins with",
    hi: "बेहतरीन चाय की शुरुआत होती है",
  },
  hero_title_highlight: {
    en: "one good trial.",
    hi: "एक सच्ची परख से।",
  },
  hero_subtitle: {
    en: "Four expressions of milk chai. One discovery kit. Brew in your own kettle, judge the colour and taste for yourself, then choose what works for your stall.",
    hi: "दूध वाली चाय के चार अनोखे रूप। एक मुकम्मल नमूना किट। अपनी केतली में उबालें, रंग और स्वाद स्वयं परखें, फिर अपनी दुकान के लिए सही चाय चुनें।",
  },
  explore_kit_cta: {
    en: "Explore Discovery Kits ↗",
    hi: "नमूना किट देखें ↗",
  },
  how_it_works_cta: {
    en: "How Testing Works ↗",
    hi: "परखने का तरीका ↗",
  },
  stat_styles: {
    en: "Tea Styles",
    hi: "चाय की किस्में",
  },
  stat_sachet: {
    en: "Each Sachet",
    hi: "प्रत्येक पाउच",
  },
  stat_net_weight: {
    en: "Total Net Weight",
    hi: "कुल शुद्ध वजन",
  },

  // Trust Strip
  trust_milk_chai_title: {
    en: "Made for milk chai",
    hi: "दूध वाली चाय के लिए खास",
  },
  trust_milk_chai_desc: {
    en: "Explore body, liquor, and briskness formulated specifically for kettle boiling.",
    hi: "केतली में तेज़ उबाल के लिए विशेष रूप से तैयार कड़क रंग, गाढ़ापन और ताज़गी।",
  },
  trust_provenance_title: {
    en: "Direct garden provenance",
    hi: "सीधे चाय बागानों से",
  },
  trust_provenance_desc: {
    en: "Single-estate lots from Siliguri, Assam, Darjeeling & Dooars with verified invoice traceability.",
    hi: "सिलीगुड़ी, असम, दार्जिलिंग और डुआर्स के बागानों से सीधे बिल प्रमाण के साथ।",
  },
  trust_guarantee_title: {
    en: "4×50g = 200g net guarantee",
    hi: "4×50 ग्राम = 200 ग्राम पक्की गारंटी",
  },
  trust_guarantee_desc: {
    en: "Zero artificial flavouring chemicals. Pure teas tested under authentic roadside conditions.",
    hi: "बिना किसी बनावटी खुशबू या केमिकल के। शुद्ध पत्ती, सड़क किनारे स्टॉल की कसौटी पर परखी हुई।",
  },

  // Optical Studio Stages
  stage_packaging: {
    en: "Packaging",
    hi: "पैकेजिंग",
  },
  stage_dry_leaf: {
    en: "Dry Leaf",
    hi: "सूखी पत्ती",
  },
  stage_infused_leaf: {
    en: "Wet Leaf",
    hi: "भीगी पत्ती",
  },
  stage_liquor: {
    en: "Raw Liquor",
    hi: "लिकर",
  },
  stage_milk_tea: {
    en: "Milk Tea",
    hi: "दूध चाय",
  },

  // Pouch Names
  pouch_strong: {
    en: "Strong Milk Chai",
    hi: "कड़क चाय",
  },
  pouch_elaichi: {
    en: "Elaichi Milk Chai",
    hi: "इलायची चाय",
  },
  pouch_ginger: {
    en: "Ginger Milk Chai",
    hi: "अदरक चाय",
  },
  pouch_masala: {
    en: "Masala Milk Chai",
    hi: "मसाला चाय",
  },

  // Sensory Bento
  sensory_title: {
    en: "SENSORY ASSESSMENT & TERROIR",
    hi: "संवेदी परीक्षण एवं बागान प्रमाण",
  },
  aroma_heading: {
    en: "Aroma Notes",
    hi: "सुगंध एवं महक",
  },
  liquor_heading: {
    en: "Liquor Body & Tone",
    hi: "लिकर का गाढ़ापन एवं रंग",
  },
  flavor_heading: {
    en: "Flavor Profile",
    hi: "स्वाद की बनावट",
  },
  mouthfeel_heading: {
    en: "Mouthfeel & Cream Lacing",
    hi: "मुंह में गाढ़ापन एवं मलाईदार झाग",
  },
  provenance_heading: {
    en: "Estate Provenance",
    hi: "बागान एवं कटाई का विवरण",
  },

  // Calculator
  calc_heading: {
    en: "WORK OUT YOUR REAL COST PER CUP",
    hi: "प्रति प्याला वास्तविक लागत जानें",
  },
  calc_subhead: {
    en: "Numbers you can actually verify. Enter the doses and real delivered rate measured for your stall.",
    hi: "आंकड़े जिन्हें आप खुद जांच सकते हैं। अपनी दुकान का असली पत्ती माप और भाव दर्ज करें।",
  },
  calc_old_price: {
    en: "Your current tea ₹/kg",
    hi: "आपकी वर्तमान चाय ₹/किलो",
  },
  calc_old_dose: {
    en: "Your current dose g/cup",
    hi: "वर्तमान पत्ती माप ग्राम/प्याला",
  },
  calc_new_price: {
    en: "TeaFloww landed ₹/kg",
    hi: "टीफ़्लो कुल दर ₹/किलो",
  },
  calc_new_dose: {
    en: "TeaFloww tested dose g/cup",
    hi: "टीफ़्लो जांची हुई पत्ती ग्राम/प्याला",
  },
  calc_current_cost: {
    en: "Current tea cost / cup",
    hi: "वर्तमान खर्च / प्याला",
  },
  calc_trial_cost: {
    en: "TeaFloww cost / cup",
    hi: "टीफ़्लो खर्च / प्याला",
  },
  calc_difference: {
    en: "Actual difference / cup",
    hi: "लागत में अंतर / प्याला",
  },
  calc_total_brews: {
    en: "Total brews from 200g kit",
    hi: "200 ग्राम किट से कुल प्याले",
  },

  // Brewing Protocol
  kettle_guide_title: {
    en: "THREE-STEP KETTLE TESTING PROTOCOL",
    hi: "तीन चरणों में केतली पर चाय परखने का तरीका",
  },
  step_1_title: {
    en: "Measure leaf dose",
    hi: "पत्ती का सही माप",
  },
  step_1_desc: {
    en: "Weigh exactly 2.5g of tea into 100ml water and 100ml fresh milk.",
    hi: "100 मिली पानी और 100 मिली ताज़ा दूध के लिए ठीक 2.5 ग्राम पत्ती नापें।",
  },
  step_2_title: {
    en: "Rolling boil temperature",
    hi: "खौलता हुआ तापमान",
  },
  step_2_desc: {
    en: "Heat water to 95°C and bring milk to a double-rising foam boil.",
    hi: "पानी को 95°C तक उबालें और दूध में दो बार उफान आने तक पकाएं।",
  },
  step_3_title: {
    en: "Steeping & strain",
    hi: "पकाव एवं छानना",
  },
  step_3_desc: {
    en: "Simmer for 180 to 240 seconds for optimal tannin and malty extraction.",
    hi: "गहरे रंग और कड़क स्वाद के लिए 180 से 240 सेकंड तक धीमी आंच पर पकाकर छानें।",
  },

  // Actions
  add_to_cart: {
    en: "Order Discovery Kit (₹200)",
    hi: "नमूना किट ऑर्डर करें (₹200)",
  },
  added_to_cart: {
    en: "Added to Cart ✓",
    hi: "कार्ट में जोड़ी गई ✓",
  },
  in_stock: {
    en: "In Stock",
    hi: "उपलब्ध है",
  },
  out_of_stock: {
    en: "Out of Stock",
    hi: "समाप्त",
  },
  check_pincode: {
    en: "Check Pincode",
    hi: "पिनकोड जांचें",
  },
  kit_exclusive: {
    en: "Kit Exclusive",
    hi: "केवल किट में उपलब्ध",
  },
};

/**
 * Retrieves the localized string for a dictionary key.
 * Falls back to English if the key or locale is missing.
 */
export function getTrialText(key: string, locale: TrialLocale = "en"): string {
  const entry = TRIAL_DICTIONARY[key];
  if (!entry) return key;
  return entry[locale] || entry.en || key;
}
