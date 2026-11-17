/** Flat, shared source for the Tea shops resource in Translation Studio. */
const pairs: Record<string, [string, string]> = {
  "hero.title": [
    "Your shop's next strong chai.",
    "आपकी दुकान की अगली कड़क चाय।",
  ],
  "hero.titleEmphasis": [
    "Before buying bulk, taste it at your counter.",
    "थोक खरीदने से पहले, अपने काउंटर पर परखें।",
  ],
  "hero.ctaTrial": ["Buy a trial", "ट्रायल खरीदें"],
  "trial.title": ["Four teas. One trial.", "चार चाय। एक ट्रायल।"],
  "trial.cta": ["Buy a trial", "ट्रायल खरीदें"],
  "quote.reviewPack": ["Continue to checkout", "खरीदारी आगे बढ़ाएँ"],
  "ui.illustration": [
    "AI illustration · packaging concept",
    "एआई से बना सांकेतिक चित्र · पैकेजिंग अवधारणा",
  ],
  "ui.heroAlt": [
    "Steaming milk chai poured from a steel pan into a glass",
    "स्टील के बर्तन से गिलास में डाली जा रही गरम दूध वाली चाय",
  ],
  "ui.pouchesAlt": [
    "Four illustrative kraft tea pouches, each bearing the TeaFloww logo",
    "TeaFloww लोगो वाले चार सांकेतिक चाय के पाउच",
  ],
  "ui.paymentDiscount": ["Payment discount", "भुगतान पर छूट"],
  "ui.increase": ["Increase", "बढ़ाएँ"],
  "ui.decrease": ["Decrease", "घटाएँ"],
  "ui.net": ["Net weight", "कुल वज़न"],
  "ui.contents": ["What's inside", "पैक में क्या है"],
  "ui.deliveryNote": [
    "Enter your PIN to check availability and delivery. Review the final payable total at checkout.",
    "पिनकोड से उपलब्धता और डिलीवरी देखें। भुगतान से पहले चेकआउट में अंतिम कुल राशि जाँचें।",
  ],
  "ui.help": ["A question? Ask us", "सवाल है? हमसे पूछें"],
  "ui.taste": ["Taste it", "परखें"],
  "ui.tasteBody": [
    "Brew with your usual milk and measure.",
    "अपने दूध और अपने माप से बनाकर देखें।",
  ],
  "ui.compare": ["Compare the cost", "हिसाब देखें"],
  "ui.compareBody": [
    "Work out the tea leaf cost per glass.",
    "प्रति गिलास चाय पत्ती का खर्च समझें।",
  ],
  "ui.order": ["Order your supply", "थोक मंगाएँ"],
  "ui.orderBody": [
    "Check delivery, then buy online.",
    "डिलीवरी जाँचें, फिर सीधे ऑनलाइन खरीदें।",
  ],
  "ui.shopName": ["Your name / shop name", "आपका नाम / दुकान का नाम"],
  "ui.phone": ["Phone / WhatsApp number", "मोबाइल / व्हाट्सएप नंबर"],
  "ui.hours": [
    "Preferred callback hours (optional)",
    "कॉल का पसंदीदा समय (वैकल्पिक)",
  ],
  "ui.message": ["Tea and quantity details", "चाय और मात्रा का विवरण"],
  "ui.consent": [
    "I agree to be contacted by TeaFloww about this enquiry.",
    "मैं इस पूछताछ के बारे में TeaFloww द्वारा संपर्क किए जाने के लिए सहमत हूँ।",
  ],
  "ui.saveEnquiry": ["Send enquiry", "पूछताछ भेजें"],
  "ui.saved": ["Your enquiry is saved", "आपकी पूछताछ दर्ज हो गई है"],
  "ui.savedBody": [
    "Keep your reference below. You can also continue on WhatsApp.",
    "नीचे दिया संदर्भ नंबर सँभालकर रखें। आप व्हाट्सएप पर भी बात कर सकते हैं।",
  ],
  "ui.enquiryTitle": [
    "Let's find tea for your shop.",
    "आपकी दुकान के लिए सही चाय चुनें।",
  ],
  "ui.enquiryBody": [
    "Need help choosing a blend or a transport quote? Tell us about your shop.",
    "चाय चुनने या ट्रांसपोर्ट भाव में मदद चाहिए? अपनी दुकान के बारे में बताएँ।",
  ],
  "ui.enquiryDraft": [
    "Please share tea and delivery details for my shop.",
    "कृपया मेरी दुकान के लिए चाय और डिलीवरी का विवरण बताएँ।",
  ],
  "ui.error": [
    "We couldn't complete that request. Please retry.",
    "अनुरोध पूरा नहीं हो सका। कृपया फिर कोशिश करें।",
  ],
  "ui.pinError": [
    "Enter a valid 6-digit Indian PIN code.",
    "भारत का सही 6-अंकीय पिनकोड दर्ज करें।",
  ],
  "ui.retry": ["Try again", "फिर कोशिश करें"],
  "ui.choose": ["Choose a pack", "पैक चुनें"],
  "ui.out": ["Unavailable", "अभी उपलब्ध नहीं"],
  "ui.from": ["From", "शुरुआती भाव"],
  "ui.freightExcluded": [
    "Tea price · delivery extra",
    "चाय का भाव · डिलीवरी अलग",
  ],
  "ui.buyBulk": ["Check price & buy", "भाव देखें और खरीदें"],
  "ui.checking": ["Checking…", "जाँच जारी है…"],
  "ui.choosePayment": [
    "Payment availability depends on PIN and total.",
    "भुगतान के विकल्प पिनकोड और कुल राशि पर निर्भर हैं।",
  ],
  "ui.noProducts": [
    "No teas are available to order right now.",
    "अभी ऑर्डर के लिए चाय उपलब्ध नहीं है।",
  ],
  "ui.quoteUnavailable": [
    "That payment or delivery option is unavailable. Try prepaid or ask us.",
    "यह भुगतान या डिलीवरी विकल्प उपलब्ध नहीं है। प्रीपेड चुनें या हमसे पूछें।",
  ],
  "ui.finalTotal": ["Final payable total", "भुगतान की अंतिम कुल राशि"],
  "ui.previewTotal": ["Delivery estimate", "डिलीवरी का अनुमान"],
  "ui.reviewPayable": [
    "Review the total before confirming payment. Payment is confirmed only after verification.",
    "भुगतान पक्का करने से पहले कुल राशि जाँचें। सत्यापन के बाद ही भुगतान की पुष्टि होगी।",
  ],
  "ui.brewKicker": ["Taste it your way", "आपका काउंटर · आपका स्वाद"],
  "ui.brewTitle": [
    "One test pan. A clearer decision.",
    "एक बार बनाकर परखें। फिर फैसला लें।",
  ],
  "ui.brewBody": [
    "An illustrative starting recipe. Adjust for your glass, milk and customers.",
    "यह शुरुआती माप का उदाहरण है। अपने गिलास, दूध और ग्राहकों के अनुसार बदलें।",
  ],
  "ui.measure": ["Measure", "मापें"],
  "ui.measureBody": [
    "Start with 3 g tea for one test serving.",
    "एक टेस्ट सर्विंग के लिए 3 g चाय से शुरुआत करें।",
  ],
  "ui.boil": ["Brew", "पकाएँ"],
  "ui.boilBody": [
    "Try 120 ml water + 80 ml milk. Simmer for 3–4 minutes.",
    "120 ml पानी + 80 ml दूध से शुरू करें। 3–4 मिनट पकाएँ।",
  ],
  "ui.liquor": ["Compare", "तुलना करें"],
  "ui.liquorBody": [
    "Use the same dose and milk to compare colour, body and taste.",
    "समान चाय और दूध के माप से रंग, गाढ़ापन और स्वाद की तुलना करें।",
  ],
  "ui.serve": ["Strain & taste", "छानें और चखें"],
  "ui.serveBody": [
    "Taste at your counter before choosing a bulk pack.",
    "थोक पैक चुनने से पहले अपने काउंटर पर चखें।",
  ],
  "ui.compareTitle": ["Compare two blends", "दो चाय की तुलना करें"],
  "ui.blendA": ["First tea", "पहली चाय"],
  "ui.blendB": ["Second tea", "दूसरी चाय"],
  "ui.notes": ["Tasting notes", "स्वाद का विवरण"],
  "ui.brewSpec": ["Brewing", "बनाने का माप"],
  "ui.faqTitle": ["Before you order", "ऑर्डर से पहले जानें"],
  "ui.faq1": [
    "Can I buy directly online?",
    "क्या मैं सीधे ऑनलाइन खरीद सकता हूँ?",
  ],
  "ui.faq1Body": [
    "Yes. Choose your trial or tea pack, check your PIN, then continue to checkout. WhatsApp is optional.",
    "हाँ। ट्रायल या चाय का पैक चुनें, पिनकोड जाँचें और चेकआउट पर खरीदें। व्हाट्सएप वैकल्पिक है।",
  ],
  "ui.faq2": ["Will tea reach my shop?", "क्या चाय मेरी दुकान तक आएगी?"],
  "ui.faq2Body": [
    "The PIN check identifies doorstep delivery or a named depot. Confirm the final delivery terms at checkout.",
    "पिनकोड जाँच से दुकान तक डिलीवरी या तय डिपो का पता चलेगा। चेकआउट में अंतिम डिलीवरी शर्तें जाँचें।",
  ],
  "ui.faq3": ["Can I pay on delivery?", "क्या डिलीवरी पर भुगतान कर सकता हूँ?"],
  "ui.faq3Body": [
    "COD depends on your route and order total. For freight advance or depot booking, ask our trade desk.",
    "यह आपकी डिलीवरी के रास्ते और कुल राशि पर निर्भर है। भाड़ा अग्रिम या डिपो बुकिंग के लिए पूछताछ करें।",
  ],
  "ui.faq4": ["How do I reorder?", "दोबारा ऑर्डर कैसे करें?"],
  "ui.faq4Body": [
    "Revisit this page to check current prices, stock and delivery before buying again.",
    "दोबारा खरीदने से पहले इसी पेज पर मौजूदा भाव, स्टॉक और डिलीवरी जाँचें।",
  ],
  "ui.privacy": ["Privacy", "गोपनीयता"],
  "ui.terms": ["Terms", "नियम व शर्तें"],
  "ui.close": ["Close", "बंद करें"],
  "ui.skip": ["Skip to content", "मुख्य सामग्री पर जाएँ"],
  "ui.direct": [
    "Buy online · WhatsApp help is optional",
    "सीधे ऑनलाइन खरीदें · व्हाट्सएप मदद वैकल्पिक है",
  ],
  "ui.email": ["Email", "ईमेल"],
  "ui.address": ["Shop delivery address", "दुकान का डिलीवरी पता"],
  "ui.city": ["City", "शहर"],
  "ui.state": ["State", "राज्य"],
  "ui.finalReview": [
    "Review delivery and final total",
    "डिलीवरी और अंतिम कुल राशि जाँचें",
  ],
  "ui.finalReviewBody": [
    "Checkout rechecks stock, delivery and payment availability. Your final amount may differ from the trade estimate; review it before paying.",
    "चेकआउट में स्टॉक, डिलीवरी और भुगतान की फिर जाँच होगी। अंतिम राशि ट्रेड अनुमान से अलग हो सकती है; भुगतान से पहले जाँचें।",
  ],
  "ui.calculate": ["Calculate final total", "अंतिम कुल राशि देखें"],
  "ui.pay": ["Continue to payment", "भुगतान आगे बढ़ाएँ"],
  "ui.edit": ["Change details", "विवरण बदलें"],
  "ui.paymentPending": [
    "Payment submitted. Confirmation awaits gateway verification.",
    "भुगतान भेजा गया। पुष्टि के लिए गेटवे सत्यापन की प्रतीक्षा है।",
  ],
  "ui.expired": [
    "This quote expired. Check delivery again.",
    "इस भाव की समय सीमा समाप्त हो गई। डिलीवरी फिर जाँचें।",
  ],
  "ui.back": ["Back to tea shop supply", "चाय सप्लाई पेज पर लौटें"],
  "ui.product.everyday-strong-milk-chai": [
    "Everyday Strong Milk Chai",
    "रोज़ाना कड़क दूध चाय",
  ],
  "ui.product.elaichi-milk-chai": ["Elaichi Tea", "इलायची चाय"],
  "ui.product.ginger-milk-chai": ["Ginger Tea", "अदरक चाय"],
  "ui.product.balanced-masala-milk-chai": ["Masala Tea", "मसाला चाय"],
  "quote.taxes": ["Additional tax", "अतिरिक्त कर"],
  "quote.fees": ["Other fees", "अन्य शुल्क"],
  "quote.credit": ["Trial credit", "ट्रायल क्रेडिट"],
  "quote.handover.doorstep": [
    "Delivered to your shop · {locality}",
    "दुकान तक डिलीवरी · {locality}",
  ],
  "quote.handover.depot": [
    "Collect at {depot} · {address}",
    "{depot} से लें · {address}",
  ],
  "quote.manualTitle": ["Ask for a transport quote", "ट्रांसपोर्ट भाव पूछें"],
  "quote.manualBody": [
    "Our team will confirm freight and handover for PIN {pin}.",
    "हमारी टीम पिनकोड {pin} के लिए भाड़ा और डिलीवरी स्थान बताएगी।",
  ],
  "quote.enterPin": [
    "The delivered estimate appears after PIN verification.",
    "पिनकोड की जाँच के बाद डिलीवरी का अनुमान दिखेगा।",
  ],
  "calc.subtitle": [
    "Tea leaves only. Compare two batches you would actually serve.",
    "यह केवल चाय पत्ती का खर्च है। अपनी दुकान पर बनने वाले दो बैच की तुलना करें।",
  ],
  "ui.depot": ["Transport depot", "ट्रांसपोर्ट डिपो"],
  "ui.doorstep": ["Doorstep", "दुकान तक"],
  "ui.onward": [
    "The buyer arranges onward transport from the depot.",
    "डिपो से आगे का ट्रांसपोर्ट खरीदार को तय करना होगा।",
  ],
  "calc.whole": [
    "Enter whole glasses (e.g. 10)",
    "गिलास की पूरी संख्या दर्ज करें (जैसे 10)",
  ],
  "calc.positive": [
    "Enter values greater than zero",
    "शून्य से अधिक माप दर्ज करें",
  ],
  "calc.delivered": [
    "Delivered rate ({price}/kg)",
    "डिलीवरी सहित भाव ({price}/kg)",
  ],
  "calc.exworks": [
    "{name} · {price}/kg, excluding delivery",
    "{name} · {price}/kg, डिलीवरी अलग",
  ],
  "calc.example": [
    "Illustrative example at {price}/kg, excluding delivery",
    "उदाहरण: {price}/kg, डिलीवरी अलग",
  ],
  "calc.basis": [
    "Based on {dose} g tea per glass and {cups} glasses/day.",
    "प्रति गिलास {dose} g चाय और रोज़ {cups} गिलास के आधार पर।",
  ],
  "calc.per": ["Tea / glass", "पत्ती / गिलास"],
  "calc.month": ["Tea / {days} days", "{days} दिन की चाय"],
  "calc.daily": ["Leaf cost / day", "पत्ती का खर्च / दिन"],
  "calc.parity": [
    "Both batches cost the same per glass in tea leaves.",
    "दोनों बैच में प्रति गिलास चाय पत्ती का खर्च बराबर है।",
  ],
  "calc.saves": [
    "TeaFloww saves {amount} per glass in tea leaves.",
    "TeaFloww में प्रति गिलास पत्ती का खर्च {amount} कम है।",
  ],
  "calc.more": [
    "TeaFloww costs {amount} more per glass in tea leaves.",
    "TeaFloww में प्रति गिलास पत्ती का खर्च {amount} अधिक है।",
  ],
  "calc.demand": ["How much tea do you need?", "कितनी चाय की ज़रूरत पड़ेगी?"],
  "calc.demandBody": [
    "Estimate your stall's leaf demand and pack combination.",
    "अपनी दुकान की चाय पत्ती की ज़रूरत और पैक का संयोजन समझें।",
  ],
  "calc.enquire": ["Enquire for {packs}", "{packs} के लिए पूछताछ करें"],
  "calc.cups": ["Cups / day", "गिलास / दिन"],
  "calc.dose": ["Dose per cup (g)", "प्रति गिलास पत्ती (g)"],
  "calc.days": ["Selling days", "बिक्री के दिन"],
  "calc.need": ["Estimated need: {kg} kg", "अनुमानित ज़रूरत: {kg} kg"],
  "calc.closest": [
    "Closest pack: {kg} kg (covers ~{days} days)",
    "नज़दीकी पैक: {kg} kg (लगभग {days} दिन)",
  ],
  "calc.coverage": ["Full {days}-day coverage", "पूरे {days} दिन के लिए"],
  "calc.total": [
    "{kg} kg total · covers ~{days} days",
    "कुल {kg} kg · लगभग {days} दिन",
  ],
  "ui.trialName1": ["Rozana Kadak", "रोज़ाना कड़क"],
  "ui.trialName2": ["Elaichi Tea", "इलायची चाय"],
  "ui.trialName3": ["Masala Tea", "मसाला चाय"],
  "ui.trialName4": ["Ginger Tea", "अदरक चाय"],
};
export const TRADE_COPY_EN: Record<string, string> = Object.fromEntries(
  Object.entries(pairs).map(([key, value]) => [key, value[0]]),
);
export const TRADE_COPY_HI: Record<string, string> = Object.fromEntries(
  Object.entries(pairs).map(([key, value]) => [key, value[1]]),
);
export function tradeText(
  dict: Record<string, string>,
  key: string,
  vars: Record<string, string | number> = {},
) {
  return (dict[key] || TRADE_COPY_EN[key] || key).replace(
    /\{([\w]+)\}/g,
    (token, name) => (vars[name] === undefined ? token : String(vars[name])),
  );
}
