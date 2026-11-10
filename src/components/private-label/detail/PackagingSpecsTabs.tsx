"use client";

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
        >
          Compatible Print Methods
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
                <th scope="row">Exterior Dimensions</th>
                <td>
                  {variant.dimensions_mm?.width || 0}mm (W) &times; {variant.dimensions_mm?.height || 0}mm (H)
                  {variant.dimensions_mm?.depth ? ` \u00D7 ${variant.dimensions_mm.depth}mm (D)` : ""}
                </td>
              </tr>
              <tr>
                <th scope="row">Label Safe Area</th>
                <td>
                  {variant.label_safe_area_mm?.width || 0}mm (W) &times; {variant.label_safe_area_mm?.height || 0}mm (H)
                </td>
              </tr>
              <tr>
                <th scope="row">Net Capacity</th>
                <td>
                  {variant.capacity_description || `${variant.net_weight_capacity_grams}g`} (~{variant.net_weight_capacity_grams}g leaf)
                </td>
              </tr>
              <tr>
                <th scope="row">Substrate Material</th>
                <td>{variant.material}</td>
              </tr>
              <tr>
                <th scope="row">Surface Finish</th>
                <td>{variant.finish}</td>
              </tr>
              <tr>
                <th scope="row">Closure Type</th>
                <td>{variant.closure_type || "Heat Seal"}</td>
              </tr>
              <tr>
                <th scope="row">Barrier Properties</th>
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
            <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "#65746D" }}>
              Verified prepress print processes certified for this substrate and geometry:
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
              <p style={{ color: "#65746D", fontStyle: "italic", margin: 0 }}>
                Direct digital printing and custom adhesive labels supported.
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
                <th scope="row">Packaging Minimum Order (MOQ)</th>
                <td><strong>{(variant.moq_units || 500).toLocaleString("en-IN")} units</strong></td>
              </tr>
              <tr>
                <th scope="row">Order Multiple Increments</th>
                <td>In steps of {variant.order_multiple || 50} units</td>
              </tr>
              <tr>
                <th scope="row">Minimum Tea Batch Weight</th>
                <td>
                  {Math.max(5, Math.ceil(((variant.net_weight_capacity_grams || 100) * (variant.moq_units || 500)) / 1000))} kg
                  {" "}(Calculated to satisfy single-garden blend minimums)
                </td>
              </tr>
              <tr>
                <th scope="row">Standard Production Lead Time</th>
                <td>{variant.lead_time_days || 14} business days from proof approval</td>
              </tr>
              <tr>
                <th scope="row">Packing Documentation</th>
                <td>Confirm applicable facility and compliance documents with our team.</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
