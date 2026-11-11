import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
const version = JSON.parse(execFileSync(process.execPath,["scripts/generate-gtm-meta-retargeting.mjs","--stdout"],{encoding:"utf8"})).containerVersion;
const code = version.customTemplate.find((t: {name:string})=>t.name==="TF Meta - Event properties").templateData.split("___SANDBOXED_JS_FOR_WEB_TEMPLATE___")[1].split("___WEB_PERMISSIONS___")[0];
const evaluate = (data: unknown) => new Function("data","require",code)(data,(name:string)=>({getType:(v:unknown)=>Array.isArray(v)?"array":typeof v,makeNumber:Number})[name as "getType"|"makeNumber"]);
describe("Meta retargeting merge",()=>{
 it("adds exact funnel mappings without duplicating existing PageView or Purchase",()=>{
  expect(version.tag.filter((t:{name:string})=>t.name.startsWith("TF Meta - ")).map((t:{name:string})=>t.name)).toEqual(["TF Meta - ViewContent","TF Meta - AddToCart","TF Meta - InitiateCheckout","TF Meta - AddPaymentInfo","TF Meta - Lead","TF Meta - Search"]);
  expect(version.trigger.filter((t:{name:string})=>t.name.startsWith("TF Meta - ")).map((t:{customEventFilter:Array<{parameter:Array<{value:string}>}>})=>t.customEventFilter[0].parameter[1].value)).toEqual(["view_item","add_to_cart","begin_checkout","add_payment_info","generate_lead","search"]);
  for(const tag of version.tag.filter((t:{name:string})=>t.name.startsWith("TF Meta - "))){
   expect(tag.consentSettings.consentType.list.map((p:{value:string})=>p.value)).toEqual(["ad_storage","ad_user_data","ad_personalization"]);
   expect(tag.parameter.find((p:{key:string})=>p.key==="eventId").value).toBe("{{TF Meta - event_id}}");
   expect(version.trigger.some((t:{triggerId:string})=>t.triggerId===tag.firingTriggerId[0])).toBe(true);
  }
 });
 it("repoints the base and purchase along with all funnel events, keeping duplicate paused",()=>{
  expect(JSON.stringify(version.tag)).not.toContain("1128432123376468");
  expect(version.tag.find((t:{name:string})=>t.name==="Meta Pixel - Base - Teafloww").parameter.find((p:{key:string})=>p.key==="pixelId").value).toBe("29619022431117471");
  expect(JSON.stringify(version.tag.find((t:{name:string})=>t.name==="Meta Pixel - Purchase - Teafloww"))).toContain("29619022431117471");
  expect(version.tag.find((t:{name:string})=>t.name==="mm Meta Pixel - Purchase - Teafloww").paused).toBe(true);
 });
 it("maps catalog SKU, actual quantity and value without forwarding customer fields",()=>{
  expect(evaluate({event:"add_to_cart",ecommerce:{currency:"INR",value:90,email:"private@example.test",items:[{item_id:"TFW-006-100G",price:30,quantity:3,email:"private@example.test"}]}})).toEqual({content_type:"product",content_ids:["TFW-006-100G"],contents:[{id:"TFW-006-100G",quantity:3,item_price:30}],num_items:3,value:90,currency:"INR"});
  expect(evaluate({event:"view_item",ecommerce:{currency:"INR",items:[{item_id:"SKU",price:30}]}}).value).toBe(30);
  expect(evaluate({event:"generate_lead",email:"private@example.test"})).toEqual({});
 });
 it("rejects malformed items, preserves zero, and sends search terms only on search",()=>{
  expect(evaluate({event:"add_to_cart",ecommerce:{value:0,currency:"INR",items:[{item_id:"FREE",price:0},{item_id:"BAD",price:-1},{item_id:"BADQ",price:30,quantity:0}]}})).toEqual({content_type:"product",content_ids:["FREE"],contents:[{id:"FREE",quantity:1,item_price:0}],num_items:1,value:0,currency:"INR"});
  expect(evaluate({event:"search",searchTerm:"chai"})).toEqual({search_string:"chai"});
  expect(evaluate({event:"generate_lead",searchTerm:"stale"})).toEqual({});
 });
 it("resolves local custom variable types through containerId and templateId",()=>{
  const variable=version.variable.find((v:{name:string})=>v.name==="TF Meta - Event properties");
  const template=version.customTemplate.find((t:{name:string})=>t.name===variable.name);
  expect(variable.type).toBe(`cvt_${template.containerId}_${template.templateId}`);
  const info=JSON.parse(template.templateData.split("___INFO___")[1].split("___TEMPLATE_PARAMETERS___")[0]);
  expect(info.id).toBe("cvt_temp_public_id");
  expect(JSON.stringify(version)).not.toContain("cvt_TFMetaProperties");
 });
 it("includes the numeric template version required by GTM imports",()=>{
  for(const template of version.customTemplate){
   const info=JSON.parse(template.templateData.split("___INFO___")[1].split("___TEMPLATE_PARAMETERS___")[0]);
   expect(Number.isInteger(info.version)).toBe(true);
   expect(info.version).toBeGreaterThan(0);
  }
 });
 it("uses sandboxed templates instead of eval-dependent custom JS variables",()=>{
  expect(version.variable.some((v:{type:string})=>v.type==="jsm")).toBe(false);
  const names=new Set([...version.variable,...version.builtInVariable].map((v:{name:string})=>v.name));names.add("_event");
  for(const match of JSON.stringify(version).matchAll(/\{\{([^}]+)\}\}/g))expect(names.has(match[1]),match[1]).toBe(true);
 });
});
