import fs from "node:fs";
import path from "node:path";

const accountId = "6000000000";
const containerId = "100000000";
const publicId = "GTM-M5G27HSQ";
const ga4MeasurementId = "G-62FDHK0EQ6";
const googleAdsId = "AW-2229174178";

// 1. Built-in variables
const builtInVariables = [
  { accountId, containerId, type: "EVENT", name: "Event" },
  { accountId, containerId, type: "PAGE_URL", name: "Page URL" },
  { accountId, containerId, type: "PAGE_PATH", name: "Page Path" },
  { accountId, containerId, type: "PAGE_HOSTNAME", name: "Page Hostname" },
  { accountId, containerId, type: "REFERRER", name: "Referrer" },
];

// 2. User-defined Variables
let varCounter = 100;
const variables = [
  // Constants
  {
    name: "Const - GA4 Measurement ID",
    type: "c",
    parameter: [{ type: "TEMPLATE", key: "value", value: ga4MeasurementId }],
  },
  {
    name: "Const - Google Ads Conversion ID",
    type: "c",
    parameter: [{ type: "TEMPLATE", key: "value", value: googleAdsId }],
  },
  {
    name: "Const - Google Ads Purchase Label",
    type: "c",
    parameter: [{ type: "TEMPLATE", key: "value", value: "REPLACE_WITH_ADS_PURCHASE_LABEL" }],
  },
  {
    name: "Const - Meta Pixel ID",
    type: "c",
    parameter: [{ type: "TEMPLATE", key: "value", value: "1128432123376468" }],
  },

  // Data Layer Variables
  ...[
    "ecommerce.items",
    "ecommerce.value",
    "ecommerce.currency",
    "ecommerce.transaction_id",
    "ecommerce.shipping",
    "ecommerce.tax",
    "ecommerce.item_list_name",
    "event_id",
    "page_location",
    "page_path",
    "page_title",
    "page_referrer",
    "lead_type",
    "search_term",
    "shipping_tier",
    "payment_type",
  ].map((dlvName) => ({
    name: `DLV - ${dlvName}`,
    type: "v",
    parameter: [
      { type: "INTEGER", key: "dataLayerVersion", value: "2" },
      { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
      { type: "TEMPLATE", key: "name", value: dlvName },
    ],
  })),

  // Custom JS Variables for Remarketing & Meta extraction
  {
    name: "CJS - Item IDs Array",
    type: "jsm",
    parameter: [
      {
        type: "TEMPLATE",
        key: "javascript",
        value: `function() {
  var items = {{DLV - ecommerce.items}};
  if (!items || !items.length) return [];
  var ids = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].item_id) {
      ids.push(String(items[i].item_id));
    }
  }
  return ids;
}`,
      },
    ],
  },
  {
    name: "CJS - First Item ID",
    type: "jsm",
    parameter: [
      {
        type: "TEMPLATE",
        key: "javascript",
        value: `function() {
  var ids = {{CJS - Item IDs Array}};
  return (ids && ids.length) ? ids[0] : '';
}`,
      },
    ],
  },
  {
    name: "CJS - Meta Contents Array",
    type: "jsm",
    parameter: [
      {
        type: "TEMPLATE",
        key: "javascript",
        value: `function() {
  var items = {{DLV - ecommerce.items}};
  if (!items || !items.length) return [];
  var contents = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i]) {
      contents.push({
        id: String(items[i].item_id || ''),
        quantity: items[i].quantity || 1,
        item_price: items[i].price || 0
      });
    }
  }
  return contents;
}`,
      },
    ],
  },
  {
    name: "CJS - Meta First Item Name",
    type: "jsm",
    parameter: [
      {
        type: "TEMPLATE",
        key: "javascript",
        value: `function() {
  var items = {{DLV - ecommerce.items}};
  return (items && items.length && items[0]) ? (items[0].item_name || '') : '';
}`,
      },
    ],
  },
].map((v) => ({
  accountId,
  containerId,
  variableId: String(++varCounter),
  ...v,
}));

// 3. Triggers
let triggerCounter = 200;
const rawTriggers = [
  {
    name: "CE - page_view",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "page_view" },
        ],
      },
    ],
  },
  {
    name: "CE - All Ecommerce Events",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "MATCH_REGEX",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          {
            type: "TEMPLATE",
            key: "arg1",
            value: "^(view_item_list|select_item|view_item|add_to_cart|remove_from_cart|view_cart|begin_checkout|add_shipping_info|add_payment_info|purchase)$",
          },
        ],
      },
    ],
  },
  {
    name: "CE - view_item",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "view_item" },
        ],
      },
    ],
  },
  {
    name: "CE - add_to_cart",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "add_to_cart" },
        ],
      },
    ],
  },
  {
    name: "CE - view_cart",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "view_cart" },
        ],
      },
    ],
  },
  {
    name: "CE - begin_checkout",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "begin_checkout" },
        ],
      },
    ],
  },
  {
    name: "CE - add_payment_info",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "add_payment_info" },
        ],
      },
    ],
  },
  {
    name: "CE - purchase",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "purchase" },
        ],
      },
    ],
  },
  {
    name: "CE - generate_lead",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "generate_lead" },
        ],
      },
    ],
  },
  {
    name: "CE - search",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "search" },
        ],
      },
    ],
  },
  {
    name: "CE - consent_updated",
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [
          { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
          { type: "TEMPLATE", key: "arg1", value: "consent_updated" },
        ],
      },
    ],
  },
  {
    name: "Initialization - All Pages",
    type: "INIT_CONSENT",
  },
];

const triggers = rawTriggers.map((t) => ({
  accountId,
  containerId,
  triggerId: String(++triggerCounter),
  ...t,
}));

const triggerMap = Object.fromEntries(triggers.map((t) => [t.name, t.triggerId]));

// 4. Tags
let tagCounter = 300;
const rawTags = [
  // 1. Google Tag (GA4 Base Configuration)
  {
    name: "Google Tag (GA4 Config - G-62FDHK0EQ6)",
    type: "googtag",
    firingTriggerId: [triggerMap["Initialization - All Pages"]],
    parameter: [
      { type: "TEMPLATE", key: "tagId", value: "{{Const - GA4 Measurement ID}}" },
      {
        type: "LIST",
        key: "configSettingsTable",
        list: [
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "parameter", value: "send_page_view" },
              { type: "TEMPLATE", key: "parameterValue", value: "false" },
            ],
          },
        ],
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "analytics_storage" }],
      },
    },
  },

  // 2. GA4 - Page View Event Tag
  {
    name: "GA4 - Event - page_view",
    type: "gaawe",
    firingTriggerId: [triggerMap["CE - page_view"]],
    parameter: [
      { type: "TEMPLATE", key: "measurementId", value: "{{Const - GA4 Measurement ID}}" },
      { type: "TEMPLATE", key: "eventName", value: "page_view" },
      {
        type: "LIST",
        key: "eventParameters",
        list: [
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: "page_location" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - page_location}}" },
            ],
          },
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: "page_path" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - page_path}}" },
            ],
          },
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: "page_title" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - page_title}}" },
            ],
          },
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: "page_referrer" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - page_referrer}}" },
            ],
          },
        ],
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "analytics_storage" }],
      },
    },
  },

  // 3. GA4 - All Ecommerce Events Tag
  {
    name: "GA4 - Event - Ecommerce Funnel",
    type: "gaawe",
    firingTriggerId: [triggerMap["CE - All Ecommerce Events"]],
    parameter: [
      { type: "TEMPLATE", key: "measurementId", value: "{{Const - GA4 Measurement ID}}" },
      { type: "TEMPLATE", key: "eventName", value: "{{Event}}" },
      { type: "BOOLEAN", key: "sendEcommerceData", value: "true" },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "analytics_storage" }],
      },
    },
  },

  // 4. GA4 - Generate Lead Tag
  {
    name: "GA4 - Event - generate_lead",
    type: "gaawe",
    firingTriggerId: [triggerMap["CE - generate_lead"]],
    parameter: [
      { type: "TEMPLATE", key: "measurementId", value: "{{Const - GA4 Measurement ID}}" },
      { type: "TEMPLATE", key: "eventName", value: "generate_lead" },
      {
        type: "LIST",
        key: "eventParameters",
        list: [
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: "lead_type" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - lead_type}}" },
            ],
          },
        ],
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "analytics_storage" }],
      },
    },
  },

  // 5. GA4 - Search Tag
  {
    name: "GA4 - Event - search",
    type: "gaawe",
    firingTriggerId: [triggerMap["CE - search"]],
    parameter: [
      { type: "TEMPLATE", key: "measurementId", value: "{{Const - GA4 Measurement ID}}" },
      { type: "TEMPLATE", key: "eventName", value: "search" },
      {
        type: "LIST",
        key: "eventParameters",
        list: [
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "name", value: "search_term" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - search_term}}" },
            ],
          },
        ],
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "analytics_storage" }],
      },
    },
  },

  // 6. Conversion Linker Tag
  {
    name: "Google Ads - Conversion Linker",
    type: "gclidw",
    firingTriggerId: [triggerMap["Initialization - All Pages"]],
    parameter: [
      { type: "BOOLEAN", key: "enableCookieOverwrite", value: "false" },
    ],
  },

  // 7. Google Ads - Purchase Conversion Tag
  {
    name: "Google Ads - Conversion - Purchase",
    type: "awct",
    firingTriggerId: [triggerMap["CE - purchase"]],
    parameter: [
      { type: "TEMPLATE", key: "conversionId", value: "{{Const - Google Ads Conversion ID}}" },
      { type: "TEMPLATE", key: "conversionLabel", value: "{{Const - Google Ads Purchase Label}}" },
      { type: "TEMPLATE", key: "conversionValue", value: "{{DLV - ecommerce.value}}" },
      { type: "TEMPLATE", key: "currencyCode", value: "{{DLV - ecommerce.currency}}" },
      { type: "TEMPLATE", key: "orderId", value: "{{DLV - ecommerce.transaction_id}}" },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [
          { type: "TEMPLATE", value: "ad_storage" },
          { type: "TEMPLATE", value: "ad_user_data" },
          { type: "TEMPLATE", value: "ad_personalization" },
        ],
      },
    },
  },

  // 8. Google Ads - Dynamic Remarketing Tag (Retail)
  {
    name: "Google Ads - Dynamic Remarketing (Retail)",
    type: "sp",
    firingTriggerId: [triggerMap["CE - All Ecommerce Events"]],
    parameter: [
      { type: "TEMPLATE", key: "conversionId", value: "{{Const - Google Ads Conversion ID}}" },
      {
        type: "LIST",
        key: "customParams",
        list: [
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "key", value: "ecomm_prodid" },
              { type: "TEMPLATE", key: "value", value: "{{CJS - Item IDs Array}}" },
            ],
          },
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "key", value: "ecomm_pagetype" },
              { type: "TEMPLATE", key: "value", value: "{{Event}}" },
            ],
          },
          {
            type: "MAP",
            map: [
              { type: "TEMPLATE", key: "key", value: "ecomm_totalvalue" },
              { type: "TEMPLATE", key: "value", value: "{{DLV - ecommerce.value}}" },
            ],
          },
        ],
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [
          { type: "TEMPLATE", value: "ad_storage" },
          { type: "TEMPLATE", value: "ad_personalization" },
        ],
      },
    },
  },

  // 9. Meta Pixel - Base Script & PageView
  {
    name: "Meta Pixel - Base & PageView",
    type: "html",
    firingTriggerId: [triggerMap["CE - page_view"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  var pixelId = "{{Const - Meta Pixel ID}}";
  if (!pixelId || pixelId === "REPLACE_WITH_META_PIXEL_ID") return;
  if (!window.fbq) {
    var n = window.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    var t = document.createElement('script'); t.async = !0;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(t, s);
  }
  if (!window.__gtm_meta_init) {
    window.__gtm_meta_init = true;
    window.fbq('init', pixelId);
    window.fbq('set', 'autoConfig', false, pixelId);
  }
  window.fbq('track', 'PageView');
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },

  // 10. Meta Pixel - ViewContent
  {
    name: "Meta Pixel - Event - ViewContent",
    type: "html",
    firingTriggerId: [triggerMap["CE - view_item"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  if (window.fbq && "{{Const - Meta Pixel ID}}" !== "REPLACE_WITH_META_PIXEL_ID") {
    window.fbq('track', 'ViewContent', {
      content_name: {{CJS - Meta First Item Name}},
      content_ids: {{CJS - Item IDs Array}},
      content_type: 'product',
      value: {{DLV - ecommerce.value}} || 0,
      currency: {{DLV - ecommerce.currency}} || 'INR'
    });
  }
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },

  // 11. Meta Pixel - AddToCart
  {
    name: "Meta Pixel - Event - AddToCart",
    type: "html",
    firingTriggerId: [triggerMap["CE - add_to_cart"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  if (window.fbq && "{{Const - Meta Pixel ID}}" !== "REPLACE_WITH_META_PIXEL_ID") {
    window.fbq('track', 'AddToCart', {
      content_name: {{CJS - Meta First Item Name}},
      content_ids: {{CJS - Item IDs Array}},
      content_type: 'product',
      contents: {{CJS - Meta Contents Array}},
      value: {{DLV - ecommerce.value}} || 0,
      currency: {{DLV - ecommerce.currency}} || 'INR'
    });
  }
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },

  // 12. Meta Pixel - InitiateCheckout
  {
    name: "Meta Pixel - Event - InitiateCheckout",
    type: "html",
    firingTriggerId: [triggerMap["CE - begin_checkout"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  if (window.fbq && "{{Const - Meta Pixel ID}}" !== "REPLACE_WITH_META_PIXEL_ID") {
    var contents = {{CJS - Meta Contents Array}};
    var numItems = 0;
    for (var i = 0; i < contents.length; i++) numItems += (contents[i].quantity || 1);
    window.fbq('track', 'InitiateCheckout', {
      content_ids: {{CJS - Item IDs Array}},
      content_type: 'product',
      contents: contents,
      num_items: numItems,
      value: {{DLV - ecommerce.value}} || 0,
      currency: {{DLV - ecommerce.currency}} || 'INR'
    });
  }
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },

  // 13. Meta Pixel - AddPaymentInfo
  {
    name: "Meta Pixel - Event - AddPaymentInfo",
    type: "html",
    firingTriggerId: [triggerMap["CE - add_payment_info"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  if (window.fbq && "{{Const - Meta Pixel ID}}" !== "REPLACE_WITH_META_PIXEL_ID") {
    window.fbq('track', 'AddPaymentInfo', {
      content_ids: {{CJS - Item IDs Array}},
      content_type: 'product',
      contents: {{CJS - Meta Contents Array}},
      value: {{DLV - ecommerce.value}} || 0,
      currency: {{DLV - ecommerce.currency}} || 'INR'
    });
  }
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },

  // 14. Meta Pixel - Purchase
  {
    name: "Meta Pixel - Event - Purchase",
    type: "html",
    firingTriggerId: [triggerMap["CE - purchase"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  if (window.fbq && "{{Const - Meta Pixel ID}}" !== "REPLACE_WITH_META_PIXEL_ID") {
    var contents = {{CJS - Meta Contents Array}};
    var numItems = 0;
    for (var i = 0; i < contents.length; i++) numItems += (contents[i].quantity || 1);
    var eventId = {{DLV - event_id}} || ("purchase_" + {{DLV - ecommerce.transaction_id}});
    window.fbq('track', 'Purchase', {
      content_ids: {{CJS - Item IDs Array}},
      content_type: 'product',
      contents: contents,
      num_items: numItems,
      value: {{DLV - ecommerce.value}} || 0,
      currency: {{DLV - ecommerce.currency}} || 'INR'
    }, { eventID: eventId });
  }
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },

  // 15. Meta Pixel - Lead
  {
    name: "Meta Pixel - Event - Lead",
    type: "html",
    firingTriggerId: [triggerMap["CE - generate_lead"]],
    parameter: [
      {
        type: "TEMPLATE",
        key: "html",
        value: `<script>
(function() {
  if (window.fbq && "{{Const - Meta Pixel ID}}" !== "REPLACE_WITH_META_PIXEL_ID") {
    window.fbq('track', 'Lead', {
      content_name: {{DLV - lead_type}} || 'lead'
    });
  }
})();
</script>`,
      },
    ],
    consentSettings: {
      consentStatus: "NEEDED",
      consentType: {
        type: "LIST",
        list: [{ type: "TEMPLATE", value: "ad_storage" }],
      },
    },
  },
];

const tags = rawTags.map((t) => ({
  accountId,
  containerId,
  tagId: String(++tagCounter),
  ...t,
}));

// Build complete GTM export container
const containerExport = {
  exportFormatVersion: 2,
  exportTime: new Date().toISOString(),
  containerVersion: {
    path: `accounts/${accountId}/containers/${containerId}/versions/0`,
    accountId,
    containerId,
    container: {
      path: `accounts/${accountId}/containers/${containerId}`,
      accountId,
      containerId,
      name: "TeaFloww Production Container",
      publicId,
      usageContext: ["WEB"],
    },
    tag: tags,
    trigger: triggers,
    variable: variables,
    builtInVariable: builtInVariables,
  },
};

const outPath = path.resolve("docs/analytics/teafloww-gtm-container-export.json");
fs.writeFileSync(outPath, JSON.stringify(containerExport, null, 2), "utf8");
console.log(`Successfully generated GTM container export at: ${outPath}`);
console.log(`Total Tags: ${tags.length}`);
console.log(`Total Triggers: ${triggers.length}`);
console.log(`Total Variables: ${variables.length}`);
console.log(`Total Built-in Variables: ${builtInVariables.length}`);
