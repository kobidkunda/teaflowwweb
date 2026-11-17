/** Additive Google Ads conversion tracking & Conversion Linker for the TeaFloww GTM container; never publishes. */
import fs from "node:fs";

const source = JSON.parse(fs.readFileSync("docs/analytics/teafloww-gtm-corrected.json", "utf8"));
const existing = source.containerVersion;
if (existing.container.publicId !== "GTM-M5G27HSQ") {
  throw new Error("Expected TeaFloww GTM-M5G27HSQ container.");
}

const scope = { accountId: existing.accountId, containerId: existing.containerId };
const p = (key, value, type = "TEMPLATE") => ({ type, key, value });
const adsConsent = {
  consentStatus: "NEEDED",
  consentType: {
    type: "LIST",
    list: [p(undefined, "ad_storage"), p(undefined, "ad_user_data"), p(undefined, "ad_personalization")].map(
      ({ type, value }) => ({ type, value })
    ),
  },
};
const hostFilter = {
  type: "MATCH_REGEX",
  parameter: [p("arg0", "{{Page Hostname}}"), p("arg1", "^(www\\.)?teafloww\\.com$")],
};

const variable = [
  {
    ...scope,
    variableId: "9600",
    name: "Const - Google Ads Conversion ID",
    type: "c",
    parameter: [p("value", "18566488412")],
  },
  {
    ...scope,
    variableId: "9601",
    name: "Const - Google Ads Purchase Label",
    type: "c",
    parameter: [p("value", "spfzCJDFu7UdENzCmJVF")],
  },
  {
    ...scope,
    variableId: "9602",
    name: "DLV - ecommerce.value",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "ecommerce.value")],
  },
  {
    ...scope,
    variableId: "9603",
    name: "DLV - ecommerce.currency",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "ecommerce.currency")],
  },
  {
    ...scope,
    variableId: "9604",
    name: "DLV - ecommerce.transaction_id",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "ecommerce.transaction_id")],
  },
  {
    ...scope,
    variableId: "9605",
    name: "DLV - TF Conversion Label",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "tf_conversion_label")],
  },
  {
    ...scope,
    variableId: "9606",
    name: "DLV - TF Conversion Target Numeric",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "tf_target_id_numeric")],
  },
  {
    ...scope,
    variableId: "9607",
    name: "DLV - TF Conversion Value",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "value")],
  },
  {
    ...scope,
    variableId: "9608",
    name: "DLV - TF Conversion Currency",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "currency")],
  },
  {
    ...scope,
    variableId: "9609",
    name: "DLV - TF Conversion Transaction ID",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "transaction_id")],
  },
  {
    ...scope,
    variableId: "9610",
    name: "DLV - TF Conversion Platform",
    type: "v",
    parameter: [p("dataLayerVersion", "2", "INTEGER"), p("name", "tf_conversion_platform")],
  },
];

const trigger = [
  {
    ...scope,
    triggerId: "9620",
    name: "CE - Google Ads Purchase",
    type: "CUSTOM_EVENT",
    customEventFilter: [{ type: "EQUALS", parameter: [p("arg0", "{{_event}}"), p("arg1", "purchase")] }],
    filter: [hostFilter],
  },
  {
    ...scope,
    triggerId: "9621",
    name: "CE - Admin Google Ads Conversion",
    type: "CUSTOM_EVENT",
    customEventFilter: [{ type: "EQUALS", parameter: [p("arg0", "{{_event}}"), p("arg1", "tf_conversion")] }],
    filter: [
      hostFilter,
      { type: "EQUALS", parameter: [p("arg0", "{{DLV - TF Conversion Platform}}"), p("arg1", "google_ads")] },
    ],
  },
];

const tag = [
  {
    ...scope,
    tagId: "9630",
    name: "Google Ads - Conversion Linker",
    type: "gclidw",
    parameter: [p("enableCookieOverwrite", "false", "BOOLEAN")],
    firingTriggerId: ["2147479573"],
    tagFiringOption: "ONCE_PER_EVENT",
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: { type: "LIST", list: [{ type: "TEMPLATE", value: "ad_storage" }] },
    },
  },
  {
    ...scope,
    tagId: "9631",
    name: "Google Ads - Conversion - Purchase",
    type: "awct",
    parameter: [
      p("conversionId", "{{Const - Google Ads Conversion ID}}"),
      p("conversionLabel", "{{Const - Google Ads Purchase Label}}"),
      p("conversionValue", "{{DLV - ecommerce.value}}"),
      p("currencyCode", "{{DLV - ecommerce.currency}}"),
      p("orderId", "{{DLV - ecommerce.transaction_id}}"),
    ],
    firingTriggerId: ["9620"],
    tagFiringOption: "ONCE_PER_EVENT",
    consentSettings: structuredClone(adsConsent),
  },
  {
    ...scope,
    tagId: "9632",
    name: "Google Ads - Custom Conversion (Admin DataLayer)",
    type: "awct",
    parameter: [
      p("conversionId", "{{DLV - TF Conversion Target Numeric}}"),
      p("conversionLabel", "{{DLV - TF Conversion Label}}"),
      p("conversionValue", "{{DLV - TF Conversion Value}}"),
      p("currencyCode", "{{DLV - TF Conversion Currency}}"),
      p("orderId", "{{DLV - TF Conversion Transaction ID}}"),
    ],
    firingTriggerId: ["9621"],
    tagFiringOption: "ONCE_PER_EVENT",
    consentSettings: structuredClone(adsConsent),
  },
];

const output = {
  exportFormatVersion: 2,
  exportTime: new Date().toISOString(),
  containerVersion: {
    ...scope,
    container: existing.container,
    tag,
    trigger,
    variable,
    builtInVariable: [
      { ...scope, type: "EVENT", name: "Event" },
      { ...scope, type: "PAGE_HOSTNAME", name: "Page Hostname" },
    ],
  },
};

if (process.argv.includes("--stdout")) {
  process.stdout.write(JSON.stringify(output));
} else {
  const outPath = "docs/analytics/teafloww-gtm-google-ads.json";
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Prepared ${outPath}: Conversion Linker + Google Ads Purchase + Admin DataLayer Google Ads conversion tags. Not published.`);
}
