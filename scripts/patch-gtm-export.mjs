/** Preserve the supplied real container; add only the missing GA4 routing and explicit consent safeguards. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [input, output = "docs/analytics/teafloww-gtm-corrected.json"] = process.argv.slice(2);
if (!input) throw new Error("Usage: node scripts/patch-gtm-export.mjs source-export.json [output.json]");
const original = JSON.parse(fs.readFileSync(input, "utf8"));
const version = original.containerVersion;
if (version?.container?.publicId !== "GTM-M5G27HSQ") throw new Error("Expected TeaFloww container GTM-M5G27HSQ.");
const extra = JSON.parse(execFileSync(process.execPath, ["scripts/generate-gtm-ga4-events.mjs", "--stdout"], { encoding: "utf8" })).containerVersion;
for (const collection of ["tag", "trigger", "variable", "builtInVariable"]) {
  version[collection] ||= [];
  for (const item of extra[collection]) {
    const previous = version[collection].findIndex(existing => existing.name === item.name);
    const mapped = { ...item, accountId: version.accountId, containerId: version.containerId };
    if (previous >= 0) version[collection][previous] = mapped;
    else version[collection].push(mapped);
  }
}
const defaults = version.tag.find(tag => tag.type === "googtag" && tag.parameter?.some(p => p.key === "tagId" && p.value === "G-62FDHK0EQ6"));
if (!defaults) throw new Error("Matching existing Google tag not found; review configuration manually.");
defaults.parameter ||= [];
let settings = defaults.parameter.find(p => p.key === "configSettingsTable");
if (!settings) { settings = { type: "LIST", key: "configSettingsTable", list: [] }; defaults.parameter.push(settings); }
settings.list ||= [];
settings.list = settings.list.filter(row => !row.map?.some(p => p.key === "parameter" && p.value === "send_page_view"));
settings.list.push({ type: "MAP", map: [{ type: "TEMPLATE", key: "parameter", value: "send_page_view" }, { type: "TEMPLATE", key: "parameterValue", value: "false" }] });
// Supplied v7 has two purchase tags on trigger 11. The template also incorrectly uses event ID as event name.
const duplicate = version.tag.find(tag => tag.name === "mm Meta Pixel - Purchase - Teafloww");
if (duplicate) duplicate.paused = true;
const marketingConsent = { consentStatus: "NEEDED", consentType: { type: "LIST", list: ["ad_storage", "ad_user_data", "ad_personalization"].map(value => ({ type: "TEMPLATE", value })) } };
for (const tag of version.tag.filter(tag => tag.name.includes("Meta Pixel") && !tag.paused)) tag.consentSettings = marketingConsent;
// If analytics was granted first, the Meta base must be eligible when marketing consent is granted later.
const consentTrigger = { accountId: version.accountId, containerId: version.containerId, triggerId: "9400", name: "TF - Marketing consent granted", type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [{ type: "TEMPLATE", key: "arg0", value: "{{_event}}" }, { type: "TEMPLATE", key: "arg1", value: "consent_updated" }] }], filter: [{ type: "EQUALS", parameter: [{ type: "TEMPLATE", key: "arg0", value: "{{TF - marketing_consent}}" }, { type: "TEMPLATE", key: "arg1", value: "true" }] }] };
const add = (collection, item) => { const i = version[collection].findIndex(x => x.name === item.name); if (i >= 0) version[collection][i] = item; else version[collection].push(item); };
add("trigger", consentTrigger);
add("variable", { accountId: version.accountId, containerId: version.containerId, variableId: "9401", name: "TF - marketing_consent", type: "v", parameter: [{ type: "INTEGER", key: "dataLayerVersion", value: "2" }, { type: "TEMPLATE", key: "name", value: "marketing_consent" }] });
const base = version.tag.find(tag => tag.name === "Meta Pixel - Base - Teafloww");
if (base) { base.firingTriggerId = [...new Set([...(base.firingTriggerId || []), consentTrigger.triggerId])]; base.tagFiringOption = "ONCE_PER_LOAD"; }
original.exportTime = new Date().toISOString();
fs.writeFileSync(output, JSON.stringify(original, null, 2) + "\n");
console.log(`Prepared ${output}: preserved supplied tags/templates, added GA4 forwarding, paused the duplicate Meta purchase tag. Not published.`);
