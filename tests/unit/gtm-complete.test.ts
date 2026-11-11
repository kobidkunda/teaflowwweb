import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const version = JSON.parse(execFileSync(process.execPath, ["scripts/generate-gtm-complete.mjs", "--stdout"], { encoding: "utf8" })).containerVersion;
type Entity = { name: string; type: string; firingTriggerId?: string[]; triggerId?: string; paused?: boolean; parameter?: { key: string; value: string }[] };
describe("Combined Google and Meta import", () => {
  it("preserves the saved baseline Google tags exactly while adding SKU properties to Purchase", () => {
    const baseline = JSON.parse(readFileSync("docs/analytics/teafloww-gtm-corrected.json", "utf8")).containerVersion;
    const googleTags = (tags: Entity[]) => tags.filter(tag => ["googtag", "gaawe"].includes(tag.type));
    expect(googleTags(version.tag)).toEqual(googleTags(baseline.tag));
    const purchase = version.tag.find((tag: Entity) => tag.name === "Meta Pixel - Purchase - Teafloww");
    expect(purchase.parameter.find((p: { key: string }) => p.key === "html").value).toContain("{{TF Meta - Event properties}}");
  });
  it("retains the Google base and all four GA4 tags alongside six Meta funnel mappings", () => {
    expect(version.tag.filter((tag: Entity) => tag.type === "googtag")).toHaveLength(1);
    expect(version.tag.filter((tag: Entity) => tag.type === "gaawe")).toHaveLength(4);
    expect(version.tag.filter((tag: Entity) => tag.name.startsWith("TF Meta - "))).toHaveLength(6);
    expect(JSON.stringify(version.tag)).not.toContain("1128432123376468");
    expect(version.tag.find((tag: Entity) => tag.name === "mm Meta Pixel - Purchase - Teafloww").paused).toBe(true);
  });
  it("resolves triggers, variables and local template types without duplicate names", () => {
    const variables = new Set([...version.variable, ...version.builtInVariable].map((v: Entity) => v.name));
    variables.add("_event");
    for (const match of JSON.stringify(version).matchAll(/\{\{([^}]+)\}\}/g)) expect(variables.has(match[1]), match[1]).toBe(true);
    for (const tag of version.tag as Entity[]) for (const id of tag.firingTriggerId || []) {
      expect(["2147479553", "2147479573"].includes(id) || version.trigger.some((t: Entity) => t.triggerId === id), id).toBe(true);
    }
    for (const field of ["tag", "trigger", "variable", "customTemplate"]) {
      expect(new Set(version[field].map((v: Entity) => v.name)).size).toBe(version[field].length);
    }
    const variable = version.variable.find((v: Entity) => v.name === "TF Meta - Event properties");
    expect(version.customTemplate.some((t: { containerId: string; templateId: string }) => variable.type === `cvt_${t.containerId}_${t.templateId}`)).toBe(true);
  });
});
