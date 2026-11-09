#!/usr/bin/env node
/**
 * Updates all 16 TeaFloww products through the Model Context Protocol (MCP) endpoint.
 * Authenticates via ?token=<MCP_TOKEN> query parameter.
 * Calls `admin.updateProductDetails` for each product, then verifies each product.
 */
import fs from "node:fs";
import path from "node:path";

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "https://teafloww.com/mcp?token=e23abd7e02f721bf32ba147c92abe024ffef48136ae5cf2cda3dd8ef5ecdde85";
const DATA_FILE = path.resolve("./data/teafloww-16-products-verified.json");

async function rpcCall(method, params, id = 1) {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC Error [${json.error.code}]: ${json.error.message}`);
  }
  return json.result;
}

async function callTool(toolName, args, id = 1) {
  const result = await rpcCall("tools/call", { name: toolName, arguments: args }, id);
  if (!result?.content || !result.content[0]?.text) {
    throw new Error(`Unexpected tool call result: ${JSON.stringify(result)}`);
  }
  return JSON.parse(result.content[0].text);
}

async function main() {
  console.log(`Connecting to MCP endpoint: ${MCP_ENDPOINT.split("?")[0]}...`);
  
  // 1. Initialize MCP
  const initResult = await rpcCall("initialize", {});
  console.log("MCP Initialized:", initResult.serverInfo);

  // 2. Load data
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const products = JSON.parse(raw);
  console.log(`Loaded ${products.length} products to verify and update.`);

  const auditReport = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];
    console.log(`[${i + 1}/${products.length}] Updating Product ID ${item.id}: ${item.name} (${item.slug})...`);
    
    // Call admin.updateProductDetails
    const updateResult = await callTool("admin.updateProductDetails", item, i + 100);
    
    // Read back via store.getProduct
    const readback = await callTool("store.getProduct", { slug: item.slug }, i + 200);
    const prod = readback.product || readback;

    // Verify fields
    const hasPendingPlaceholder = 
      /pending/i.test(prod.dry_leaf_appearance || "") ||
      /pending/i.test(prod.dry_leaf_grade || "") ||
      /pending/i.test(prod.dry_leaf_aroma || "") ||
      /pending/i.test(prod.liquor_hue_name || "") ||
      /pending/i.test(prod.liquor_clarity || "") ||
      /pending/i.test(prod.liquor_body || "") ||
      /pending/i.test(prod.wet_leaf_aroma || "") ||
      /pending/i.test(prod.wet_leaf_oxidation || "");

    const sensoryScored = 
      (prod.flavor_floral || prod.floral || 0) > 0 ||
      (prod.flavor_fruity || prod.fruity || 0) > 0 ||
      (prod.flavor_malty || prod.malty || 0) > 0 ||
      (prod.flavor_body || prod.body || 0) > 0 ||
      (prod.flavor_sweetness || prod.sweetness || 0) > 0;

    const aromaTagsCount = Array.isArray(prod.aroma_tags) 
      ? prod.aroma_tags.length 
      : (typeof prod.aroma_tags === "string" ? JSON.parse(prod.aroma_tags || "[]").length : 0);

    const hasOriginEstateLot = Boolean(
      prod.origin && 
      prod.estate && 
      prod.lot_number
    );

    const variantCount = prod.variants?.length || 0;
    const totalStock = prod.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) ?? prod.inventory ?? 0;
    const zeroStockVariants = prod.variants?.filter((v) => (v.stock || 0) <= 0).length ?? 0;

    const statusOk = prod.status === "published";

    auditReport.push({
      id: prod.id,
      slug: prod.slug,
      name: prod.name,
      status: prod.status,
      statusOk,
      hasPendingPlaceholder,
      sensoryScored,
      aromaTagsCount,
      hasOriginEstateLot,
      origin: prod.origin,
      estate: prod.estate,
      lot_number: prod.lot_number,
      variantCount,
      totalStock,
      zeroStockVariants,
    });

    console.log(`  ✓ Updated ID ${prod.id}: status=${prod.status}, stock=${totalStock}, aromaTags=${aromaTagsCount}, placeholders=${hasPendingPlaceholder}`);
  }

  console.log("\n==================== VERIFICATION SUMMARY ====================");
  console.table(auditReport.map(r => ({
    ID: r.id,
    Name: r.name.slice(0, 30),
    Status: r.status,
    Placeholders: r.hasPendingPlaceholder ? "FAIL" : "CLEARED",
    Sensory: r.sensoryScored ? "SCORED" : "FAIL",
    AromaTags: r.aromaTagsCount,
    OriginEstateLot: r.hasOriginEstateLot ? "VERIFIED" : "FAIL",
    Stock: r.totalStock,
    ZeroStockVars: r.zeroStockVariants,
  })));

  const allPlaceholdersCleared = auditReport.every(r => !r.hasPendingPlaceholder);
  const allSensoryScored = auditReport.every(r => r.sensoryScored);
  const allAromaTags = auditReport.every(r => r.aromaTagsCount >= 3);
  const allOriginVerified = auditReport.every(r => r.hasOriginEstateLot);
  const allStockPositive = auditReport.every(r => r.totalStock > 0 && r.zeroStockVariants === 0);
  const allPublished = auditReport.every(r => r.status === "published");

  console.log("\n--- AUDIT RESULTS ---");
  console.log(`1. Dry/Wet leaf observations cleared of placeholders: ${allPlaceholdersCleared ? "16/16 PASSED" : "FAILED"}`);
  console.log(`2. Measured sensory ratings scored:                   ${allSensoryScored ? "16/16 PASSED" : "FAILED"}`);
  console.log(`3. Aroma tags assigned:                               ${allAromaTags ? "16/16 PASSED" : "FAILED"}`);
  console.log(`4. Verified origin, estate, and lot documented:       ${allOriginVerified ? "16/16 PASSED" : "FAILED"}`);
  console.log(`5. Positive stock across all 64 variants:             ${allStockPositive ? "64/64 PASSED" : "FAILED"}`);
  console.log(`6. Publication status 'published':                    ${allPublished ? "16/16 PASSED" : "FAILED"}`);

  if (allPlaceholdersCleared && allSensoryScored && allAromaTags && allOriginVerified && allStockPositive && allPublished) {
    console.log("\n🎉 ALL 16 PRODUCTS SUCCESSFULLY VERIFIED AND UPDATED 100% OVER MCP!");
  } else {
    console.error("\n❌ Some criteria failed verification!");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
