# TeaFloww Search campaign — prepared, blocked, not created

This is a review specification, not an executable API payload or import file. No Google Ads resources, tags, website settings, orders or payments were changed.

## Ad group structure:

- Tea Stall Tea: exact and phrase keywords in campaign-review.json; one English and one Hindi RSA, all unpinned.
- Assam CTC Buying Intent: exact and phrase keywords in campaign-review.json; one English and one Hindi RSA, all unpinned.

## Negative keywords:

None. The approved plan requires observed search terms before proposing exclusions; no speculative negative list is supplied.

## Sitelinks, callouts and snippets

Sitelinks are withheld pending distinct relevant destination verification; do not manufacture four links to the same product. Suggested callouts: “100 g to 35 kg Packs”, “Choose Your Pack Size”, “Order Online”, “Milk Chai Packs”. Structured snippets are omitted. These optional assets are not uploaded.

## Campaign and economics

₹500 average daily budget, Manual CPC ₹3 ceiling, Google Search only, Hindi and English, presence targeting in GJ/RJ/UP/MP/MH. Purchase-only goal. All eight pack sizes remain available; no forced bulk minimum, coupon or price change. Keep existing Performance Max paused.

15% contribution before ads means break-even ROAS 6.67×; 10× is a planning objective, not a forecast or an initial automated target. At 10× ROAS, 5% of revenue remains after ads under the stated margin assumption. Use net realized values after discounts/refunds, with an explicitly consistent tax/shipping basis. Do not use lifetime value assumptions.

Dates remain unset because launch is blocked. When gates pass, set 14 inclusive calendar days in account timezone Asia/Calcutta. ₹7,000 is planned expenditure, not a hard cap. Do not activate now.

## Verification and blockers

- Live canonical product URL fetched successfully on 2026-11-13; title and all eight expected pack SKUs found. This was an HTTP/source check, not mobile/browser QA.
- Price snapshot comes from connected TeaFloww catalogue; revalidate prices and stock before use. No actual packaging, provenance, certification or yield evidence inferred from catalogue marketing text.
- Paid-order query returned no orders through the selected connector; no measured AOV or cross-system completeness claimed.
- Composio reported keyword mutation restricted. Do not use another route to bypass it.
- All false launch gates in campaign-review.json remain pending, including an observed genuine purchase and correct INR value/unique transaction ID; duplicate, demo, failed and unpaid events must not count.
- Check conversion receipt in destination tools; configuration alone is not proof of firing. Confirm refunds are reflected without duplicate bidding conversions.
- Verify mobile product/pack selection, keyboard checkout, address errors, serviceability and final shipping in each selected state without submitting unauthorized payments.
- After creation is permitted, create PAUSED, read back all settings/resources, deduplicate by account + campaign name, and activate only after every gate passes. On partial failure leave parent paused and retain resource IDs; never delete existing learning history.

## Review cadence and rollback

Review spend/search relevance daily during the test. Assess CPA, ROAS and contribution after observed conversion lag; purchase action currently has a 30-day click window. Do not add Google and Meta attributed conversions. Use verified paid revenue less refunds, ad spend, and the stated margin basis for contribution. Do not scale automatically. At day 14 pause and read back status for review. Rollback is pausing only the new campaign; preserve existing Performance Max and storefront settings. This document does not create a scheduled review or monitor.

## Responsive search ads

### Tea Stall Tea — English

Final URL: https://teafloww.com/tea/everyday-strong-milk-chai

Path1: milk-chai; Path2: tea-packs. Pinning: none.

Headlines:

1. TeaFloww Milk Chai (18 chars)
2. Everyday Strong Milk Chai (25 chars)
3. Tea for Your Chai Stall (23 chars)
4. CTC Tea for Milk Chai (21 chars)
5. Choose Your Tea Pack (20 chars)
6. 100 g to 35 kg Packs (20 chars)
7. 1 kg Pack at Rs 280 (19 chars)
8. 5 kg Pack at Rs 1400 (20 chars)
9. 10 kg Pack at Rs 2800 (21 chars)
10. Shop TeaFloww Online (20 chars)
11. Find Your Chai Pack (19 chars)
12. Order Tea Online (16 chars)
13. Milk Chai for Your Shop (23 chars)
14. Explore All Pack Sizes (22 chars)
15. Tea for Everyday Chai (21 chars)

Descriptions:

1. Shop Everyday Strong Milk Chai. Choose packs from 100 g to 35 kg online. (72 chars)
2. 1 kg Rs 280. 5 kg Rs 1400. 10 kg Rs 2800. Select your pack before checkout. (75 chars)
3. Explore CTC tea for your tea stall. Check delivery availability at checkout. (76 chars)
4. Choose your pack size and see the final order total before payment. (67 chars)

### Tea Stall Tea — Hindi

Final URL: https://teafloww.com/tea/everyday-strong-milk-chai

Path1: milk-chai; Path2: tea-packs. Pinning: none.

Headlines:

1. TeaFloww दूध वाली चाय (21 chars)
2. रोजाना दूध वाली चाय (19 chars)
3. अपनी दुकान के लिए चाय (21 chars)
4. चाय स्टॉल के लिए चाय (20 chars)
5. दूध वाली CTC चाय (16 chars)
6. अपना पैक चुनें (14 chars)
7. 100 ग्राम से 35 किलो (20 chars)
8. 1 किलो पैक ₹280 (15 chars)
9. 5 किलो पैक ₹1400 (16 chars)
10. 10 किलो पैक ₹2800 (17 chars)
11. TeaFloww से ऑनलाइन खरीदें (25 chars)
12. चाय के सभी पैक देखें (20 chars)
13. चाय ऑनलाइन मंगाएं (17 chars)
14. अपनी पसंद की चाय चुनें (22 chars)
15. रोज की चाय के लिए (17 chars)

Descriptions:

1. Everyday Strong Milk Chai के 100 ग्राम से 35 किलो तक के पैक ऑनलाइन देखें। (73 chars)
2. 1 किलो ₹280, 5 किलो ₹1400, 10 किलो ₹2800। खरीदने से पहले अपना पैक चुनें। (72 chars)
3. अपने चाय स्टॉल के लिए CTC चाय देखें। डिलीवरी की उपलब्धता चेकआउट पर जांचें। (74 chars)
4. पैक चुनें और भुगतान से पहले ऑर्डर की अंतिम राशि देखें। (54 chars)

### Assam CTC Buying Intent — English

Final URL: https://teafloww.com/tea/everyday-strong-milk-chai

Path1: milk-chai; Path2: tea-packs. Pinning: none.

Headlines:

1. TeaFloww Milk Chai (18 chars)
2. Everyday Strong Milk Chai (25 chars)
3. Buy Assam CTC Tea (17 chars)
4. CTC Tea for Milk Chai (21 chars)
5. Choose Your Tea Pack (20 chars)
6. 100 g to 35 kg Packs (20 chars)
7. 1 kg Pack at Rs 280 (19 chars)
8. 5 kg Pack at Rs 1400 (20 chars)
9. 10 kg Pack at Rs 2800 (21 chars)
10. Shop TeaFloww Online (20 chars)
11. Find Your Chai Pack (19 chars)
12. Order Tea Online (16 chars)
13. Milk Chai for Your Shop (23 chars)
14. Explore All Pack Sizes (22 chars)
15. Tea for Everyday Chai (21 chars)

Descriptions:

1. Shop Everyday Strong Milk Chai. Choose packs from 100 g to 35 kg online. (72 chars)
2. 1 kg Rs 280. 5 kg Rs 1400. 10 kg Rs 2800. Select your pack before checkout. (75 chars)
3. Explore CTC tea for your tea stall. Check delivery availability at checkout. (76 chars)
4. Choose your pack size and see the final order total before payment. (67 chars)

### Assam CTC Buying Intent — Hindi

Final URL: https://teafloww.com/tea/everyday-strong-milk-chai

Path1: milk-chai; Path2: tea-packs. Pinning: none.

Headlines:

1. TeaFloww दूध वाली चाय (21 chars)
2. रोजाना दूध वाली चाय (19 chars)
3. असम CTC चाय ऑनलाइन (18 chars)
4. चाय स्टॉल के लिए चाय (20 chars)
5. दूध वाली CTC चाय (16 chars)
6. अपना पैक चुनें (14 chars)
7. 100 ग्राम से 35 किलो (20 chars)
8. 1 किलो पैक ₹280 (15 chars)
9. 5 किलो पैक ₹1400 (16 chars)
10. 10 किलो पैक ₹2800 (17 chars)
11. TeaFloww से ऑनलाइन खरीदें (25 chars)
12. चाय के सभी पैक देखें (20 chars)
13. चाय ऑनलाइन मंगाएं (17 chars)
14. अपनी पसंद की चाय चुनें (22 chars)
15. रोज की चाय के लिए (17 chars)

Descriptions:

1. Everyday Strong Milk Chai के 100 ग्राम से 35 किलो तक के पैक ऑनलाइन देखें। (73 chars)
2. 1 किलो ₹280, 5 किलो ₹1400, 10 किलो ₹2800। खरीदने से पहले अपना पैक चुनें। (72 chars)
3. अपने चाय स्टॉल के लिए CTC चाय देखें। डिलीवरी की उपलब्धता चेकआउट पर जांचें। (74 chars)
4. पैक चुनें और भुगतान से पहले ऑर्डर की अंतिम राशि देखें। (54 chars)
