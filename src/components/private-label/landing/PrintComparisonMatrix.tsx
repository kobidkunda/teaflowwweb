import { Text as StorefrontText } from "@/components/international/InternationalProvider";
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
            <caption style={{ textAlign: "left", padding: "12px 20px", fontSize: "0.875rem", color: "#65746D", fontStyle: "italic" }}><StorefrontText id="copy_736e585f926cd459" fallback="Technical comparison of Label, Digital Roll-Fed, and Gravure printing methods." />
            </caption>
            <thead>
              <tr>
                <th scope="col"><StorefrontText id="copy_32edd610ccc5e993" fallback="Feature / Parameter" /></th>
                <th scope="col"><StorefrontText id="copy_2c5a3ede1f67b1d2" fallback="Precision Label (BOPP / Paper)" /></th>
                <th scope="col"><StorefrontText id="copy_ff0b0f15bbf90d1f" fallback="Short-Run Direct Digital Print" /></th>
                <th scope="col"><StorefrontText id="copy_576878d240a1d54d" fallback="Industrial Rotogravure Cylinder" /></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row"><StorefrontText id="copy_6cb0c4dae1f6e11d" fallback="Ideal For" /></th>
                <td><StorefrontText id="copy_2630abf24ac8cbe5" fallback="Boutique trial batches, popups, limited seasonal single-cask lots" /></td>
                <td>Growing direct-to-consumer tea brands & retail rollouts</td>
                <td>High-volume wholesale retail distribution & export containers</td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_8fa1d75fc4fee1f1" fallback="Minimum Order Quantity (MOQ)" /></th>
                <td><strong><StorefrontText id="copy_3e589980c9996db4" fallback="100 units" /></strong></td>
                <td><strong><StorefrontText id="copy_e65e63a520807a03" fallback="500 units" /></strong></td>
                <td><strong><StorefrontText id="copy_7ba4534ea30fd72c" fallback="5,000 units" /></strong></td>
              </tr>
              <tr>
                <th scope="row">Tooling & Cylinder Setup Fee</th>
                <td><strong>&#8377;0</strong><StorefrontText id="copy_4de544edba8db98d" fallback="(Zero plate or cylinder fee)" /></td>
                <td><strong>&#8377;0</strong><StorefrontText id="copy_c33f7a616c36e4d9" fallback="(Direct digital prepress)" /></td>
                <td>&#8377;8,000 per color engraved steel cylinder</td>
              </tr>
              <tr>
                <th scope="row">Color Model & Palette</th>
                <td><StorefrontText id="copy_7773fe37ff22e756" fallback="CMYK + Spot Varnishes" /></td>
                <td><StorefrontText id="copy_291ed138b97e545c" fallback="High-DPI CMYK + White Understrike" /></td>
                <td><StorefrontText id="copy_c2dae654f91a32fb" fallback="Up to 10 Spot Pantone (PMS) Colors" /></td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_658a48ddb51683f1" fallback="Coverage Area" /></th>
                <td><StorefrontText id="copy_58d0801f61dbfb9f" fallback="Label Safe Zone on front and back" /></td>
                <td><StorefrontText id="copy_b3ec55053d51442f" fallback="Full-bleed edge-to-edge printing" /></td>
                <td>Seamless 360&deg; full roll-fed envelope</td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_98be6f6dce868bd9" fallback="Finishing Options" /></th>
                <td><StorefrontText id="copy_15e0ad353d748d76" fallback="Matte, Gloss, Cold Foil Stamp" /></td>
                <td><StorefrontText id="copy_677d9de66aeb590f" fallback="Soft-Touch Matte, Spot Gloss UV" /></td>
                <td><StorefrontText id="copy_996caaf7bff82372" fallback="Matte Lacquer, Metallic Inks, Window Cutouts" /></td>
              </tr>
              <tr>
                <th scope="row"><StorefrontText id="copy_15090ace9b9f1d36" fallback="Production Lead Time" /></th>
                <td><StorefrontText id="copy_e7c1ca8d2ee3930b" fallback="7–10 business days" /></td>
                <td><StorefrontText id="copy_53640f7a3fde38cd" fallback="14–18 business days" /></td>
                <td><StorefrontText id="copy_cd096db0a12de8f8" fallback="25–35 business days" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
