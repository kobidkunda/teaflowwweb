/** GA4-only merge supplement: does not install another Google base tag, Meta, or Ads. */
import fs from "node:fs";
const source = { accountId: "6382131376", containerId: "266900144" };
const template = (key, value) => ({ type: "TEMPLATE", key, value });
const fields = ["event_id", "page_location", "page_path", "page_title", "page_referrer", "lead_type", "search_term", "ecommerce.shipping_tier", "ecommerce.payment_type"];
const variableName = field => `TF GA4 - ${field}`;
const variables = fields.map((field, i) => ({ ...source, variableId: String(9100 + i), name: variableName(field), type: "v", parameter: [{ type: "INTEGER", key: "dataLayerVersion", value: "2" }, template("name", field), { type: "BOOLEAN", key: "setDefaultValue", value: "false" }] }));
const rows = fields => ({ type: "LIST", key: "eventSettingsTable", list: fields.map(([parameter, field]) => ({ type: "MAP", map: [template("parameter", parameter), template("parameterValue", `{{${variableName(field)}}}`)] })) });
const common = [["event_id", "event_id"], ["page_location", "page_location"], ["page_referrer", "page_referrer"]];
const specs = [
  { name: "Page view", event: "page_view", fields: [...common, ["page_path", "page_path"], ["page_title", "page_title"]] },
  { name: "Ecommerce", event: "{{Event}}", regex: "^(view_item_list|select_item|view_item|add_to_cart|remove_from_cart|view_cart|begin_checkout|add_shipping_info|add_payment_info|purchase)$", fields: [...common, ["shipping_tier", "ecommerce.shipping_tier"], ["payment_type", "ecommerce.payment_type"]], ecommerce: true },
  { name: "Successful lead", event: "generate_lead", fields: [...common, ["lead_type", "lead_type"]] },
  { name: "Search", event: "search", fields: [...common, ["search_term", "search_term"]] },
];
const triggers = specs.map((spec, i) => ({ ...source, triggerId: String(9200 + i), name: `TF GA4 - ${spec.name}`, type: "CUSTOM_EVENT", customEventFilter: [{ type: spec.regex ? "MATCH_REGEX" : "EQUALS", parameter: [template("arg0", "{{_event}}"), template("arg1", spec.regex || spec.event)] }], filter: [{ type: "MATCH_REGEX", parameter: [template("arg0", "{{Page Hostname}}"), template("arg1", "^(www\\.)?teafloww\\.com$")] }] }));
const tags = specs.map((spec, i) => ({ ...source, tagId: String(9300 + i), name: `TF GA4 - ${spec.name}`, type: "gaawe", tagFiringOption: "ONCE_PER_EVENT", firingTriggerId: [triggers[i].triggerId], parameter: [
  template("measurementIdOverride", "G-62FDHK0EQ6"), template("eventName", spec.event),
  ...(spec.ecommerce ? [{ type: "BOOLEAN", key: "sendEcommerceData", value: "true" }, template("getEcommerceDataFrom", "dataLayer")] : []), rows(spec.fields),
], consentSettings: { consentStatus: "NEEDED", consentType: { type: "LIST", list: [{ type: "TEMPLATE", value: "analytics_storage" }] } } }));
const result = { exportFormatVersion: 2, exportTime: new Date().toISOString(), containerVersion: { ...source, container: { ...source, name: "TeaFloww GA4 event forwarding — merge supplement", publicId: "GTM-M5G27HSQ", usageContext: ["WEB"] }, tag: tags, trigger: triggers, variable: variables, builtInVariable: [{ ...source, type: "EVENT", name: "Event" }, { ...source, type: "PAGE_HOSTNAME", name: "Page Hostname" }] } };
// Source identifiers match the v7 container supplied by the user.
const json = JSON.stringify(result, null, 2) + "\n";
if (process.argv.includes("--stdout")) process.stdout.write(json);
else { const file = "docs/analytics/teafloww-ga4-events-merge.json"; fs.writeFileSync(file, json); console.log(`Generated ${file}: ${tags.length} GA4 event tags. Import with Merge, then Preview before publishing.`); }
