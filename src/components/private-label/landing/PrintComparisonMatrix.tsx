import React from "react";
import styles from "../styles/PrivateLabel.module.css";
import { SectionHeading } from "../shared/StudioPrimitives";

export function PrintComparisonMatrix() {
  return (
    <section
      data-testid="print-comparison"
      className={`${styles.comparisonSection} print-comparison`}
      aria-label="Print Process Comparison"
    >
      <div className={styles.contentContainer}>
        <SectionHeading
          title="Choose How You Print: The 3-Way Printing Matrix"
          subtitle="Compare minimum order quantities, cylinder tooling requirements, and finish capabilities across our print technologies."
          align="center"
        />

        <div className={styles.comparisonTableWrapper} role="region" tabIndex={0} aria-label="Print Comparison Table">
          <table className={styles.comparisonTable}>
            <caption style={{ textAlign: "left", padding: "12px 20px", fontSize: "0.875rem", color: "#65746D", fontStyle: "italic" }}>
              Technical comparison of Label, Digital Roll-Fed, and Gravure printing methods.
            </caption>
            <thead>
              <tr>
                <th scope="col">Feature / Parameter</th>
                <th scope="col">Precision Label (BOPP / Paper)</th>
                <th scope="col">Short-Run Direct Digital Print</th>
                <th scope="col">Industrial Rotogravure Cylinder</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Ideal For</th>
                <td>Boutique trial batches, popups, limited seasonal single-cask lots</td>
                <td>Growing direct-to-consumer tea brands & retail rollouts</td>
                <td>High-volume wholesale retail distribution & export containers</td>
              </tr>
              <tr>
                <th scope="row">Minimum Order Quantity (MOQ)</th>
                <td><strong>100 units</strong></td>
                <td><strong>500 units</strong></td>
                <td><strong>5,000 units</strong></td>
              </tr>
              <tr>
                <th scope="row">Tooling & Cylinder Setup Fee</th>
                <td><strong>&#8377;0</strong> (Zero plate or cylinder fee)</td>
                <td><strong>&#8377;0</strong> (Direct digital prepress)</td>
                <td>&#8377;8,000 per color engraved steel cylinder</td>
              </tr>
              <tr>
                <th scope="row">Color Model & Palette</th>
                <td>CMYK + Spot Varnishes</td>
                <td>High-DPI CMYK + White Understrike</td>
                <td>Up to 10 Spot Pantone (PMS) Colors</td>
              </tr>
              <tr>
                <th scope="row">Coverage Area</th>
                <td>Label Safe Zone on front and back</td>
                <td>Full-bleed edge-to-edge printing</td>
                <td>Seamless 360&deg; full roll-fed envelope</td>
              </tr>
              <tr>
                <th scope="row">Finishing Options</th>
                <td>Matte, Gloss, Cold Foil Stamp</td>
                <td>Soft-Touch Matte, Spot Gloss UV</td>
                <td>Matte Lacquer, Metallic Inks, Window Cutouts</td>
              </tr>
              <tr>
                <th scope="row">Production Lead Time</th>
                <td>7–10 business days</td>
                <td>14–18 business days</td>
                <td>25–35 business days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
