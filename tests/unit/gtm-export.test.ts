import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
const exported = JSON.parse(execFileSync(process.execPath, ["scripts/generate-gtm-ga4-events.mjs", "--stdout"], { encoding: "utf8" }));
const version = exported.containerVersion;
const param = (tag: { parameter: Array<{ key: string; value?: string }> }, key: string) => tag.parameter.find(p => p.key === key)?.value;
describe("GA4 merge export integration contract", () => {
  it("adds only four native GA4 event tags with real measurement destination and supported parameter names", () => {
    expect(version.tag).toHaveLength(4);
    for (const tag of version.tag) {
      expect(tag.type).toBe("gaawe");
      expect(param(tag, "measurementIdOverride")).toBe("G-62FDHK0EQ6");
      expect(param(tag, "measurementId")).toBeUndefined();
      expect(tag.parameter.some((p: { key: string }) => p.key === "eventSettingsTable")).toBe(true);
      expect(tag.parameter.some((p: { key: string }) => p.key === "eventParameters")).toBe(false);
      expect(tag.consentSettings.consentType.list[0].value).toBe("analytics_storage");
    }
  });
  it("forwards the complete standard ecommerce funnel from the data layer, excluding the legacy Meta alias", () => {
    const tag = version.tag.find((t: { name: string }) => t.name.endsWith("Ecommerce"));
    expect(param(tag, "sendEcommerceData")).toBe("true");
    expect(param(tag, "getEcommerceDataFrom")).toBe("dataLayer");
    expect(param(tag, "eventName")).toBe("{{Event}}");
    const trigger = version.trigger.find((t: { triggerId: string }) => t.triggerId === tag.firingTriggerId[0]);
    const regex = new RegExp(trigger.customEventFilter[0].parameter[1].value);
    for (const event of ["view_item_list", "select_item", "view_item", "add_to_cart", "remove_from_cart", "view_cart", "begin_checkout", "add_shipping_info", "add_payment_info", "purchase"]) expect(regex.test(event)).toBe(true);
    for (const event of ["teafloww_purchase", "gtm.js", "purchase_again", "form_start"]) expect(regex.test(event)).toBe(false);
  });
  it("resolves every variable and trigger reference and restricts production hosts", () => {
    const variables = new Set([...version.variable, ...version.builtInVariable].map(v => v.name)); variables.add("_event");
    for (const match of JSON.stringify(version).matchAll(/\{\{([^}]+)\}\}/g)) expect(variables.has(match[1]), match[1]).toBe(true);
    for (const tag of version.tag) for (const id of tag.firingTriggerId) expect(version.trigger.some((t: { triggerId: string }) => t.triggerId === id)).toBe(true);
    const hostRegex = new RegExp(version.trigger[0].filter[0].parameter[1].value);
    expect(hostRegex.test("teafloww.com")).toBe(true); expect(hostRegex.test("www.teafloww.com")).toBe(true);
    for (const host of ["localhost", "preview.teafloww.com", "teafloww.com.attacker.test"]) expect(hostRegex.test(host)).toBe(false);
  });
});
