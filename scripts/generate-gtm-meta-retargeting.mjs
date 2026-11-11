/** Additive Meta mappings for the existing TeaFloww GTM container; never publishes. */
import fs from "node:fs";
const source = JSON.parse(fs.readFileSync("docs/analytics/teafloww-gtm-corrected.json", "utf8"));
const existing = source.containerVersion;
const base = existing.tag.find(t => t.name === "Meta Pixel - Base - Teafloww");
if (!base || existing.container.publicId !== "GTM-M5G27HSQ") throw new Error("Expected TeaFloww Meta base configuration");
const targetPixelId = "29619022431117471";
const oldPixelId = "1128432123376468";
const scope = { accountId: existing.accountId, containerId: existing.containerId };
const p = (key, value, type = "TEMPLATE") => ({ type, key, value });
const variableName = "TF Meta - Event properties";
export const propertiesCode = `const getType = require('getType');
const makeNumber = require('makeNumber');
const ecommerce = data.ecommerce || {};
const items = getType(ecommerce.items) === 'array' ? ecommerce.items : [];
const props = {};
const contents = [];
const ids = [];
let total = 0;
let count = 0;
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  if (!item || !item.item_id) continue;
  const id = '' + item.item_id;
  const quantity = item.quantity === undefined ? 1 : makeNumber(item.quantity);
  const price = makeNumber(item.price);
  if (!(quantity > 0) || !(price >= 0)) continue;
  contents.push({id: id, quantity: quantity, item_price: price});
  if (ids.indexOf(id) === -1) ids.push(id);
  total += price * quantity;
  count += quantity;
}
if (contents.length) {
  props.content_type = 'product';
  props.content_ids = ids;
  props.contents = contents;
  props.num_items = count;
  const value = makeNumber(ecommerce.value);
  props.value = ecommerce.value !== undefined && value >= 0 ? value : total;
  if (ecommerce.currency) props.currency = ecommerce.currency;
}
if (data.event === 'search' && data.searchTerm) props.search_string = data.searchTerm;
return props;`;
const customTemplateId = "9500";
const templateId = `cvt_${existing.containerId}_${customTemplateId}`;
const templateData = `___TERMS_OF_SERVICE___
By creating or modifying this file you agree to Google Tag Manager's Community Template Gallery Developer Terms of Service available at https://developers.google.com/tag-manager/gallery-tos (or such other URL as Google may provide), as modified from time to time.

___INFO___
${JSON.stringify({displayName:variableName,description:"Allowlisted GA4 ecommerce fields converted to Meta catalog properties. No customer data or eval.",id:"cvt_temp_public_id",version:1,type:"MACRO",containerContexts:["WEB"]},null,2)}

___TEMPLATE_PARAMETERS___
${JSON.stringify(["ecommerce","event","searchTerm"].map(name=>({type:"TEXT",name,displayName:name,simpleValueType:true})),null,2)}

___SANDBOXED_JS_FOR_WEB_TEMPLATE___
${propertiesCode}

___WEB_PERMISSIONS___
[]

___TESTS___
scenarios: []
`;
const dlvs = [["ecommerce", "ecommerce"], ["event_id", "event_id"], ["search_term", "search_term"]].map(([name,path],i)=>({...scope,variableId:String(9510+i),name:`TF Meta - ${name}`,type:"v",parameter:[p("dataLayerVersion","2","INTEGER"),p("name",path)]}));
const mapped = [["view_item","ViewContent"],["add_to_cart","AddToCart"],["begin_checkout","InitiateCheckout"],["add_payment_info","AddPaymentInfo"],["generate_lead","Lead"],["search","Search"]];
const trigger = mapped.map(([event],i)=>({...scope,triggerId:String(9520+i),name:`TF Meta - ${event}`,type:"CUSTOM_EVENT",customEventFilter:[{type:"EQUALS",parameter:[p("arg0","{{_event}}"),p("arg1",event)]}],filter:[{type:"MATCH_REGEX",parameter:[p("arg0","{{Page Hostname}}"),p("arg1","^(www\\.)?teafloww\\.com$")]}]}));
const tag = mapped.map(([,meta],i)=>({...scope,tagId:String(9530+i),name:`TF Meta - ${meta}`,type:base.type,parameter:[p("pixelId",targetPixelId),p("eventName","standard"),p("standardEventName",meta),p("eventId","{{TF Meta - event_id}}"),p("objectPropertiesFromVariable","{{TF Meta - Event properties}}"),p("useGA4Ecommerce","false","BOOLEAN"),p("enhancedEcommerce","false","BOOLEAN"),p("advancedMatching","false","BOOLEAN"),p("consent","true","BOOLEAN"),p("optInMetaCAPI","true","BOOLEAN")],firingTriggerId:[trigger[i].triggerId],tagFiringOption:"ONCE_PER_EVENT",consentSettings:structuredClone(base.consentSettings)}));
// Keep all existing Meta routes on the same destination, including the paused duplicate.
const destinationTags = existing.tag.filter(t => t.name.includes("Meta Pixel")).map(t => {
  const updated = JSON.parse(JSON.stringify(t).replaceAll(oldPixelId, targetPixelId));
  if (updated.name === "mm Meta Pixel - Purchase - Teafloww") updated.paused = true;
  return updated;
});
const output = {exportFormatVersion:2,exportTime:new Date().toISOString(),containerVersion:{...scope,container:existing.container,tag:[...destinationTags,...tag],trigger:[...existing.trigger.filter(t => ["11","9400"].includes(t.triggerId)),...trigger],variable:[...existing.variable.filter(v => ["7","8","9","10","9401"].includes(v.variableId)),...dlvs,{...scope,variableId:"9513",name:variableName,type:templateId,parameter:[p("ecommerce","{{TF Meta - ecommerce}}"),p("event","{{Event}}"),p("searchTerm","{{TF Meta - search_term}}")]}],builtInVariable:[{...scope,type:"EVENT",name:"Event"},{...scope,type:"PAGE_HOSTNAME",name:"Page Hostname"}],customTemplate:[...existing.customTemplate,{...scope,templateId:customTemplateId,name:variableName,templateData}]}};
if (process.argv.includes("--stdout")) console.log(JSON.stringify(output));
else {const path="docs/analytics/teafloww-meta-correct-dataset-29619022431117471-v3.json";fs.writeFileSync(path,JSON.stringify(output,null,2)+"\n");console.log(`Prepared ${path}. Corrected Meta destination plus six additional events; GA4 unchanged. Not published.`);}
