import { getDb } from "@/lib/db";

export interface StoreSettings {
  store_name: string;
  currency: string;
  currency_code: string;
  tax_rate_percent: number;
  gst_tax_rate_percent: number;
  shipping_flat_fee_paise: number;
  shipping_fee_paise: number;
  shipping_flat_paise: number;
  free_shipping_threshold_paise: number;
  min_delivery_order_paise: number;
  wholesale_moq: number;
  wholesale_advance_percent: number;
  wholesale_bank_beneficiary: string;
  wholesale_bank_name: string;
  wholesale_bank_account_number: string;
  wholesale_bank_ifsc: string;
  wholesale_bank_branch: string;
  wholesale_bank_upi_id: string;
  contact_email: string;
  whatsapp_number: string;
  // Extended branding & identity
  brand_name: string;
  brand_tagline: string;
  brand_description: string;
  legal_name: string;
  address_street: string;
  address_city: string;
  address_region: string;
  address_postal_code: string;
  address_country: string;
  telephone: string;
  opening_hours: string;
  dispatch_commitment: string;
  return_window_days: number;
  guarantee_description: string;
  social_instagram: string;
  social_twitter: string;
  social_facebook: string;
  social_youtube: string;
  announcement_text: string;
  announcement_highlight: string;
  announcement_link: string;
  announcement_enabled: boolean;
}

export interface UpdateStoreSettingsInput {
  store_name?: string;
  "store-name"?: string;
  storeName?: string;
  currency?: string;
  currency_code?: string;
  currencyCode?: string;
  tax_rate_percent?: number;
  gst_tax_rate_percent?: number;
  taxRate?: number;
  shipping_flat_fee_paise?: number;
  shipping_fee_paise?: number;
  shipping_flat_paise?: number;
  shippingFlatFeePaise?: number;
  free_shipping_threshold_paise?: number;
  freeShippingThresholdPaise?: number;
  wholesale_moq?: number;
  wholesaleMoq?: number;
  wholesale_advance_percent?: number;
  wholesaleAdvancePercent?: number;
  wholesale_bank_beneficiary?: string;
  wholesaleBankBeneficiary?: string;
  wholesale_bank_name?: string;
  wholesaleBankName?: string;
  wholesale_bank_account_number?: string;
  wholesaleBankAccountNumber?: string;
  wholesale_bank_ifsc?: string;
  wholesaleBankIfsc?: string;
  wholesale_bank_branch?: string;
  wholesaleBankBranch?: string;
  wholesale_bank_upi_id?: string;
  wholesaleBankUpiId?: string;
  contact_email?: string;
  contactEmail?: string;
  whatsapp_number?: string;
  whatsappNumber?: string;
  // Extended inputs
  brand_name?: string;
  brandName?: string;
  brand_tagline?: string;
  brandTagline?: string;
  brand_description?: string;
  brandDescription?: string;
  legal_name?: string;
  legalName?: string;
  address_street?: string;
  addressStreet?: string;
  address_city?: string;
  addressCity?: string;
  address_region?: string;
  addressRegion?: string;
  address_postal_code?: string;
  addressPostalCode?: string;
  address_country?: string;
  addressCountry?: string;
  telephone?: string;
  contactPhone?: string;
  opening_hours?: string;
  openingHours?: string;
  dispatch_commitment?: string;
  dispatchCommitment?: string;
  return_window_days?: number;
  returnWindowDays?: number;
  guarantee_description?: string;
  guaranteeDescription?: string;
  social_instagram?: string;
  socialInstagram?: string;
  social_twitter?: string;
  socialTwitter?: string;
  social_facebook?: string;
  socialFacebook?: string;
  social_youtube?: string;
  socialYoutube?: string;
  announcement_text?: string;
  announcementText?: string;
  announcement_highlight?: string;
  announcementHighlight?: string;
  announcement_link?: string;
  announcementLink?: string;
  announcement_enabled?: boolean;
  announcementEnabled?: boolean;
}

export function getStoreSettings(): StoreSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM store_settings").all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const currencyVal = map.get("currency") || map.get("currency_code") || "INR";
  const taxRate = Number(map.get("tax_rate_percent") || map.get("gst_tax_rate_percent") || "5");
  const shippingPaise = Number(
    map.get("shipping_flat_fee_paise") || map.get("shipping_fee_paise") || map.get("shipping_flat_paise") || "9900"
  );
  const freeThreshold = Number(map.get("free_shipping_threshold_paise") || "59900");
  const minDeliveryPaise = Number(map.get("min_delivery_order_paise") || "0");
  const wholesaleMoq = Math.max(1, Number(map.get("wholesale_moq") || "50"));
  const wholesaleAdvancePercent = Math.min(100, Math.max(0, Number(map.get("wholesale_advance_percent") || "0")));
  const wholesaleBankBeneficiary = map.get("wholesale_bank_beneficiary") || "Nirva";
  const wholesaleBankName = map.get("wholesale_bank_name") || "HDFC Bank";
  const wholesaleBankAccountNumber = map.get("wholesale_bank_account_number") || "";
  const wholesaleBankIfsc = map.get("wholesale_bank_ifsc") || "";
  const wholesaleBankBranch = map.get("wholesale_bank_branch") || "Siliguri";
  const wholesaleBankUpiId = map.get("wholesale_bank_upi_id") || "";
  const email = map.get("contact_email") || "support@himalayantea.com";
  const storeName = map.get("store_name") || "Himalayan Tea House";
  const whatsapp = map.get("whatsapp_number") || "+91 98320 12345";

  const brandName = map.get("brand_name") || "TEAFLOWW";
  const brandTagline = map.get("brand_tagline") || "Orthodox & CTC Teas from Origin";
  const brandDesc = map.get("brand_description") ||
    "Direct-from-origin single-estate orthodox teas harvested in Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and packaged at origin in Siliguri.";
  const legalName = map.get("legal_name") || "Himalayan Tea House Private Limited";
  const street = map.get("address_street") || "Hill Cart Road, Near Tea Auction Centre, Matigara";
  const city = map.get("address_city") || "Siliguri";
  const region = map.get("address_region") || "West Bengal";
  const postalCode = map.get("address_postal_code") || "734010";
  const country = map.get("address_country") || "India";
  const phone = map.get("telephone") || "+91-353-2570112";
  const hours = map.get("opening_hours") || "Monday – Saturday, 09:00 to 18:00 IST";
  const dispatchCommitment = map.get("dispatch_commitment") || "24-48 hours from Siliguri hub";
  const returnDays = Number(map.get("return_window_days") || "14");
  const guaranteeDesc = map.get("guarantee_description") ||
    "14-day freshness and transit resolution guarantee. Unopened tins or items damaged in transit are replaced or refunded upon inspection.";
  const instagram = map.get("social_instagram") || "https://www.instagram.com/himalayanteahouse";
  const twitter = map.get("social_twitter") || "https://twitter.com/himalayantea";
  const facebook = map.get("social_facebook") || "https://www.facebook.com/himalayanteahouse";
  const youtube = map.get("social_youtube") || "https://www.youtube.com/@himalayanteahouse";
  const annText = map.get("announcement_text") || "FREE SHIPPING ON ORDERS ABOVE ₹999";
  const annHighlight = map.get("announcement_highlight") || "✨ FREE SHIPPING ON ORDERS ABOVE ₹999";
  const annLink = map.get("announcement_link") || "/shop";
  const annEnabled = map.get("announcement_enabled") !== "0";

  return {
    store_name: storeName,
    currency: currencyVal,
    currency_code: currencyVal,
    tax_rate_percent: taxRate,
    gst_tax_rate_percent: taxRate,
    shipping_flat_fee_paise: shippingPaise,
    shipping_fee_paise: shippingPaise,
    shipping_flat_paise: shippingPaise,
    free_shipping_threshold_paise: freeThreshold,
    min_delivery_order_paise: minDeliveryPaise,
    wholesale_moq: wholesaleMoq,
    wholesale_advance_percent: wholesaleAdvancePercent,
    wholesale_bank_beneficiary: wholesaleBankBeneficiary,
    wholesale_bank_name: wholesaleBankName,
    wholesale_bank_account_number: wholesaleBankAccountNumber,
    wholesale_bank_ifsc: wholesaleBankIfsc,
    wholesale_bank_branch: wholesaleBankBranch,
    wholesale_bank_upi_id: wholesaleBankUpiId,
    contact_email: email,
    whatsapp_number: whatsapp,
    brand_name: brandName,
    brand_tagline: brandTagline,
    brand_description: brandDesc,
    legal_name: legalName,
    address_street: street,
    address_city: city,
    address_region: region,
    address_postal_code: postalCode,
    address_country: country,
    telephone: phone,
    opening_hours: hours,
    dispatch_commitment: dispatchCommitment,
    return_window_days: returnDays,
    guarantee_description: guaranteeDesc,
    social_instagram: instagram,
    social_twitter: twitter,
    social_facebook: facebook,
    social_youtube: youtube,
    announcement_text: annText,
    announcement_highlight: annHighlight,
    announcement_link: annLink,
    announcement_enabled: annEnabled,
  };
}

export function updateStoreSettings(input: UpdateStoreSettingsInput): StoreSettings {
  const db = getDb();
  const current = getStoreSettings();

  const rawStoreName = input.store_name ?? input["store-name"] ?? input.storeName;
  const storeName = (rawStoreName !== undefined ? rawStoreName : current.store_name).trim();
  const rawCurrency = input.currency || input.currency_code || input.currencyCode;
  const currency = (rawCurrency ? rawCurrency : current.currency).trim().toUpperCase();
  const rawTaxRate = input.tax_rate_percent ?? input.gst_tax_rate_percent ?? input.taxRate;
  const taxRate = String(rawTaxRate ?? current.tax_rate_percent);
  const rawShipping = input.shipping_flat_fee_paise ?? input.shipping_fee_paise ?? input.shipping_flat_paise ?? input.shippingFlatFeePaise;
  const shippingPaise = String(rawShipping ?? current.shipping_flat_fee_paise);
  const rawFreeThreshold = input.free_shipping_threshold_paise ?? input.freeShippingThresholdPaise;
  const freeThreshold = String(rawFreeThreshold ?? current.free_shipping_threshold_paise);
  const rawEmail = input.contact_email ?? input.contactEmail;
  const contactEmail = (rawEmail ? rawEmail : current.contact_email).trim().toLowerCase();
  const rawWhatsapp = input.whatsapp_number ?? input.whatsappNumber;
  const whatsappNumber = (rawWhatsapp ? rawWhatsapp : current.whatsapp_number).trim();

  const brandName = (input.brand_name ?? input.brandName ?? current.brand_name).trim();
  const brandTagline = (input.brand_tagline ?? input.brandTagline ?? current.brand_tagline).trim();
  const brandDesc = (input.brand_description ?? input.brandDescription ?? current.brand_description).trim();
  const legalName = (input.legal_name ?? input.legalName ?? current.legal_name).trim();
  const street = (input.address_street ?? input.addressStreet ?? current.address_street).trim();
  const city = (input.address_city ?? input.addressCity ?? current.address_city).trim();
  const region = (input.address_region ?? input.addressRegion ?? current.address_region).trim();
  const postalCode = (input.address_postal_code ?? input.addressPostalCode ?? current.address_postal_code).trim();
  const country = (input.address_country ?? input.addressCountry ?? current.address_country).trim();
  const phone = (input.telephone ?? input.contactPhone ?? current.telephone).trim();
  const hours = (input.opening_hours ?? input.openingHours ?? current.opening_hours).trim();
  const dispatchCommitment = (input.dispatch_commitment ?? input.dispatchCommitment ?? current.dispatch_commitment).trim();
  const returnDays = String(input.return_window_days ?? input.returnWindowDays ?? current.return_window_days);
  const guaranteeDesc = (input.guarantee_description ?? input.guaranteeDescription ?? current.guarantee_description).trim();
  const instagram = (input.social_instagram ?? input.socialInstagram ?? current.social_instagram).trim();
  const twitter = (input.social_twitter ?? input.socialTwitter ?? current.social_twitter).trim();
  const facebook = (input.social_facebook ?? input.socialFacebook ?? current.social_facebook).trim();
  const youtube = (input.social_youtube ?? input.socialYoutube ?? current.social_youtube).trim();
  const annText = (input.announcement_text ?? input.announcementText ?? current.announcement_text).trim();
  const annHighlight = (input.announcement_highlight ?? input.announcementHighlight ?? current.announcement_highlight).trim();
  const annLink = (input.announcement_link ?? input.announcementLink ?? current.announcement_link).trim();
  const annEnabled = input.announcement_enabled ?? input.announcementEnabled ?? current.announcement_enabled;

  const upsertStmt = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    upsertStmt.run("store_name", storeName);
    upsertStmt.run("currency", currency);
    upsertStmt.run("currency_code", currency);
    upsertStmt.run("tax_rate_percent", taxRate);
    upsertStmt.run("gst_tax_rate_percent", taxRate);
    if (rawShipping !== undefined) {
      upsertStmt.run("shipping_flat_fee_paise", shippingPaise);
      upsertStmt.run("shipping_fee_paise", shippingPaise);
      upsertStmt.run("shipping_flat_paise", shippingPaise);
    }
    if (rawFreeThreshold !== undefined) {
      upsertStmt.run("free_shipping_threshold_paise", freeThreshold);
    }
    const rawWholesaleMoq = input.wholesale_moq ?? input.wholesaleMoq;
    if (rawWholesaleMoq !== undefined) {
      const wMoq = String(Math.max(1, Number(rawWholesaleMoq) || 50));
      upsertStmt.run("wholesale_moq", wMoq);
    }
    const rawWholesaleAdvance = input.wholesale_advance_percent ?? input.wholesaleAdvancePercent;
    if (rawWholesaleAdvance !== undefined) {
      const wAdv = String(Math.min(100, Math.max(0, Math.round(Number(rawWholesaleAdvance)) || 0)));
      upsertStmt.run("wholesale_advance_percent", wAdv);
    }
    const rawBankBeneficiary = input.wholesale_bank_beneficiary ?? input.wholesaleBankBeneficiary;
    if (rawBankBeneficiary !== undefined) {
      upsertStmt.run("wholesale_bank_beneficiary", rawBankBeneficiary.trim());
    }
    const rawBankName = input.wholesale_bank_name ?? input.wholesaleBankName;
    if (rawBankName !== undefined) {
      upsertStmt.run("wholesale_bank_name", rawBankName.trim());
    }
    const rawBankAccount = input.wholesale_bank_account_number ?? input.wholesaleBankAccountNumber;
    if (rawBankAccount !== undefined) {
      upsertStmt.run("wholesale_bank_account_number", rawBankAccount.trim());
    }
    const rawBankIfsc = input.wholesale_bank_ifsc ?? input.wholesaleBankIfsc;
    if (rawBankIfsc !== undefined) {
      upsertStmt.run("wholesale_bank_ifsc", rawBankIfsc.trim().toUpperCase());
    }
    const rawBankBranch = input.wholesale_bank_branch ?? input.wholesaleBankBranch;
    if (rawBankBranch !== undefined) {
      upsertStmt.run("wholesale_bank_branch", rawBankBranch.trim());
    }
    const rawBankUpi = input.wholesale_bank_upi_id ?? input.wholesaleBankUpiId;
    if (rawBankUpi !== undefined) {
      upsertStmt.run("wholesale_bank_upi_id", rawBankUpi.trim());
    }
    upsertStmt.run("contact_email", contactEmail);
    upsertStmt.run("whatsapp_number", whatsappNumber);
    upsertStmt.run("brand_name", brandName);
    upsertStmt.run("brand_tagline", brandTagline);
    upsertStmt.run("brand_description", brandDesc);
    upsertStmt.run("legal_name", legalName);
    upsertStmt.run("address_street", street);
    upsertStmt.run("address_city", city);
    upsertStmt.run("address_region", region);
    upsertStmt.run("address_postal_code", postalCode);
    upsertStmt.run("address_country", country);
    upsertStmt.run("telephone", phone);
    upsertStmt.run("opening_hours", hours);
    upsertStmt.run("dispatch_commitment", dispatchCommitment);
    upsertStmt.run("return_window_days", returnDays);
    upsertStmt.run("guarantee_description", guaranteeDesc);
    upsertStmt.run("social_instagram", instagram);
    upsertStmt.run("social_twitter", twitter);
    upsertStmt.run("social_facebook", facebook);
    upsertStmt.run("social_youtube", youtube);
    upsertStmt.run("announcement_text", annText);
    upsertStmt.run("announcement_highlight", annHighlight);
    upsertStmt.run("announcement_link", annLink);
    upsertStmt.run("announcement_enabled", annEnabled ? "1" : "0");

    try {
      const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get() as { document: string } | undefined;
      if (inRow && inRow.document) {
        const doc = JSON.parse(inRow.document);
        doc.freeAbovePaise = Number(freeThreshold);
        doc.flatPaise = Number(shippingPaise);
        db.prepare("UPDATE commerce_markets SET document = ?, version = version + 1 WHERE code = 'IN'").run(JSON.stringify(doc));
      }
    } catch {}
  })();

  return getStoreSettings();
}
