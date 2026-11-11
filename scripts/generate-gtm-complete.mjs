/** Combine the reviewed Google/GA4 baseline with the corrected Meta mappings. Never publishes. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const baseline = JSON.parse(fs.readFileSync("docs/analytics/teafloww-gtm-corrected.json", "utf8"));
const meta = JSON.parse(execFileSync(process.execPath, ["scripts/generate-gtm-meta-retargeting.mjs", "--stdout"], { encoding: "utf8" })).containerVersion;
const version = structuredClone(baseline.containerVersion);
if (version.container.publicId !== "GTM-M5G27HSQ" || meta.container.publicId !== version.container.publicId) throw new Error("Unexpected container.");
for (const field of ["tag", "trigger", "variable", "builtInVariable", "customTemplate"]) {
  const merged = new Map((version[field] || []).map(item => [item.name, item]));
  for (const item of meta[field] || []) merged.set(item.name, item);
  version[field] = [...merged.values()];
  const idKey = { tag: "tagId", trigger: "triggerId", variable: "variableId", customTemplate: "templateId" }[field];
  if (idKey && new Set(version[field].map(item => item[idKey])).size !== version[field].length) throw new Error(`Duplicate ${field} IDs.`);
}
const output = { exportFormatVersion: 2, exportTime: new Date().toISOString(), containerVersion: version };
if (process.argv.includes("--stdout")) process.stdout.write(JSON.stringify(output));
else {
  const file = "docs/analytics/teafloww-tracking-complete.json";
  fs.writeFileSync(file, JSON.stringify(output, null, 2) + "\n");
  console.log(`Prepared ${file}: Google base, four GA4 event tags, corrected Meta base/Purchase and six Meta funnel tags. Not published.`);
}
