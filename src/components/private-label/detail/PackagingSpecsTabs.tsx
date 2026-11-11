"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import styles from "../styles/PrivateLabel.module.css";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";
import type { PublicPackagingDetailResponse } from "@/lib/private-label/schemas";

export interface PackagingSpecsTabsProps {
  variant: PublicPackagingVariantDto | PublicPackagingDetailResponse;
}

export function PackagingSpecsTabs({ variant }: PackagingSpecsTabsProps) {
  const [activeTab, setActiveTab] = useState<"specs" | "print" | "moq">("specs");

  const barrierText = Array.isArray(variant.barrier_properties)
    ? variant.barrier_properties.join(", ")
    : variant.barrier_properties || "Food-grade multi-layer barrier lining";

  const printMethods = variant.supported_print_methods || variant.compatible_print_method_codes || [];

  return (
    <div>
      {/* Accessible Tab Navigation */}
      <div
        className={styles.pdpTabsHeader}
        role="tablist"
        aria-label="Packaging Specifications and Technical Details"
        onKeyDown={event => {
          const tabs = ["specs", "print", "moq"] as const;
          if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const index = tabs.indexOf(activeTab);
            const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
            setActiveTab(tabs[next]);
            document.getElementById(`tab-${tabs[next]}`)?.focus();
          }
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-specs"
          aria-selected={activeTab === "specs"}
          aria-controls="panel-specs"
          tabIndex={activeTab === "specs" ? 0 : -1}
          onClick={() => setActiveTab("specs")}
          className={`${styles.pdpTabBtn} ${activeTab === "specs" ? styles.pdpTabBtnActive : ""}`}
        >
          Technical Specs & Dimensions
        </button>
        <button
          type="button"
          role="tab"
          id="tab-print"
          aria-selected={activeTab === "print"}
          aria-controls="panel-print"
          tabIndex={activeTab === "print" ? 0 : -1}
          onClick={() => setActiveTab("print")}
          className={`${styles.pdpTabBtn} ${activeTab === "print" ? styles.pdpTabBtnActive : ""}`}
        ><StorefrontText id="copy_66a9ece3e18ee056" fallback="Compatible Print Methods" />
        </button>
        <button
          type="button"
          role="tab"
          id="tab-moq"
          aria-selected={activeTab === "moq"}
          aria-controls="panel-moq"
          tabIndex={activeTab === "moq" ? 0 : -1}
          onClick={() => setActiveTab("moq")}
          className={`${styles.pdpTabBtn} ${activeTab === "moq" ? styles.pdpTabBtnActive : ""}`}
        >
          MOQ & Production Info
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "specs" && (
        <div
          id="panel-specs"
          role="tabpanel"
          aria-labelledby="tab-specs"
          data-testid="specs-panel"
        >
          <table className={styles.specsTable}>
            <tbody>
              <tr>
                <th scope="row"><StorefrontText id="copy_9616f646cfb5b898" fallback="Exterior Dimensions" /></th>
                <td>
                  {variant.dimensions_mm?.width || 0}mm (W) &times; {variant.dimensions_mm?.height || 0}<StorefrontText id="copy_4af5442ba9d8754a" fallback="mm (H)" />
                  {variant.dimensions_mm?.depth ? ` \u00D7 ${variant.dimensions_mm.depth}mm (D)` : ""}
                </td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_f571ad7d245172e8" fallback="Label Safe Area" /></th>
                <td>
                  {variant.label_safe_area_mm?.width || 0}mm (W) &times; {variant.label_safe_area_mm?.height || 0}<StorefrontText id="copy_4af5442ba9d8754a" fallback="mm (H)" />
                </td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_730f51f917a543aa" fallback="Net Capacity" /></th>
                <td>
                  {variant.capacity_description || `${variant.net_weight_capacity_grams}g`} (~{variant.net_weight_capacity_grams}<StorefrontText id="copy_095850d63276a091" fallback="g leaf)" />
                </td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_55f6a26f46a761d9" fallback="Substrate Material" /></th>
                <td>{variant.material}</td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_224fb136cbd71fe6" fallback="Surface Finish" /></th>
                <td>{variant.finish}</td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_00c1ad9282a6e2db" fallback="Closure Type" /></th>
                <td>{variant.closure_type || "Heat Seal"}</td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_6beb172dea9e48c1" fallback="Barrier Properties" /></th>
                <td>{barrierText}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "print" && (
        <div
          id="panel-print"
          role="tabpanel"
          aria-labelledby="tab-print"
          data-testid="print-methods-panel"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "#65746D" }}><StorefrontText id="copy_fef722e7275da414" fallback="Verified prepress print processes certified for this substrate and geometry:" />
            </p>
            {printMethods.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {printMethods.map((code) => {
                  const labelMap: Record<string, { name: string; desc: string }> = {
                    direct_digital: {
                      name: "Direct Digital Print (Roll-Fed)",
                      desc: "High-resolution CMYK + White ink printing with zero cylinder tooling fees. MOQ: 500 units.",
                    },
                    paper_label: {
                      name: "Textured Paper Label",
                      desc: "Uncoated natural matte paper label with strong adhesion. MOQ: 100 units.",
                    },
                    bopp_label: {
                      name: "Waterproof BOPP Synthetic Label",
                      desc: "Oil, moisture and tear-resistant polypropylene film. MOQ: 250 units.",
                    },
                    gravure: {
                      name: "Rotogravure Cylinder Print",
                      desc: "High-speed industrial printing up to 10 PMS colors for large commercial runs. MOQ: 5,000 units.",
                    },
                    screen_print: {
                      name: "Rotary Screen Printing",
                      desc: "Direct-to-metal and direct-to-glass spot color application with tactile relief. MOQ: 1,000 units.",
                    },
                    sleeve: {
                      name: "Contour Shrink Sleeve",
                      desc: "Full 360-degree wrap shrink film. MOQ: 1,000 units.",
                    },
                  };
                  const method = labelMap[code] || { name: code, desc: "Certified production method." };
                  return (
                    <li key={code} style={{ fontSize: "0.9375rem" }}>
                      <strong style={{ color: "#143C31" }}>{method.name}: </strong>
                      <span style={{ color: "#4A5650" }}>{method.desc}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ color: "#65746D", fontStyle: "italic", margin: 0 }}><StorefrontText id="copy_2fffe25b73908b36" fallback="Direct digital printing and custom adhesive labels supported." />
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "moq" && (
        <div
          id="panel-moq"
          role="tabpanel"
          aria-labelledby="tab-moq"
          data-testid="moq-info"
          className="moq-breakdown"
        >
          <table className={styles.specsTable}>
            <tbody>
              <tr>
                <th scope="row"><StorefrontText id="copy_64e45d48ec6415b1" fallback="Packaging Minimum Order (MOQ)" /></th>
                <td><strong>{(variant.moq_units || 500).toLocaleString("en-IN")}<StorefrontText id="copy_c981a30c0e7b420b" fallback="units" /></strong></td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_b65c287a02d1594f" fallback="Order Multiple Increments" /></th>
                <td><StorefrontText id="copy_3f9304ab868853ba" fallback="In steps of" /> {variant.order_multiple || 50}<StorefrontText id="copy_c981a30c0e7b420b" fallback="units" /></td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_edb3579d0cacf9d4" fallback="Minimum Tea Batch Weight" /></th>
                <td>
                  {Math.max(5, Math.ceil(((variant.net_weight_capacity_grams || 100) * (variant.moq_units || 500)) / 1000))} kg
                  {" "}<StorefrontText id="copy_5bea1a489e00857d" fallback="(Calculated to satisfy single-garden blend minimums)" />
                </td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_61338b75679a4dbc" fallback="Standard Production Lead Time" /></th>
                <td>{variant.lead_time_days || 14}<StorefrontText id="copy_297324278b06174e" fallback="business days from proof approval" /></td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_2f88d1aa801f8635" fallback="Packing Documentation" /></th>
                <td><StorefrontText id="copy_23a4dc5451653f25" fallback="Confirm applicable facility and compliance documents with our team." /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
