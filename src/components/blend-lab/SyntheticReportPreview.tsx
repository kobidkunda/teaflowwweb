import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function SyntheticReportPreview() {
  return (
    <section id="sample-report" className="bl-report" aria-labelledby="report-preview-heading">
      <div className="bl-wrap bl-report-grid">
        <div className="bl-report-copy"><p className="bl-eyebrow"><StorefrontText id="copy_4edd0c49e3f9c980" fallback="YOUR OUTPUT" /></p><h2 id="report-preview-heading"><StorefrontText id="copy_126f54594a078147" fallback="A clear report." /><br /><StorefrontText id="copy_cc2ff4f17e33cd13" fallback="A practical next step." /></h2>
          <p><StorefrontText id="copy_f8224ef3cc09d023" fallback="Understand your tea through sensory observations, flavour notes and recommendations. Take the next step with confidence, whether that’s sourcing, adjusting a blend or developing something new." /></p>
          <p className="bl-report-availability"><StorefrontText id="copy_fc31920160a7a142" fallback="Detailed reports are included with Tea Quality Audit and Signature Blend Lab." /></p>
          <details className="bl-report-details"><summary><StorefrontText id="copy_7c44d9aee3c89d72" fallback="See an example report" /><ArrowRight size={16} aria-hidden="true" /></summary><div className="bl-report-example"><h3><StorefrontText id="copy_f61930f96b48f91e" fallback="Inside your evaluation" /></h3><p><StorefrontText id="copy_1b4e8c918836eff9" fallback="Illustrative structure, not a customer’s test result." /></p><ul><li><StorefrontText id="copy_c60a2da8cbe763f7" fallback="Sample reference and brewing conditions" /></li><li><StorefrontText id="copy_48805751320f285e" fallback="Dry leaf and infused leaf observations" /></li><li><StorefrontText id="copy_509310ac1b6a40e1" fallback="Liquor colour, aroma, body and finish" /></li><li><StorefrontText id="copy_ae577de4aad6539c" fallback="Milk response, where relevant" /></li><li><StorefrontText id="copy_2b0e9731eb83fd31" fallback="Recommendations and possible next steps" /></li></ul><p><StorefrontText id="copy_6d7731fea10de085" fallback="Your report reflects your sample and selected service. No example scores or savings are presented as measured results." /></p></div></details>
        </div>
        <figure className="bl-report-art"><Image src="/images/blend-lab/report-preview.webp" alt="AI-generated illustration of a TeaFloww evaluation report showing the sections covered; not an actual customer report" width={1200} height={1000} sizes="(max-width: 700px) 100vw, 55vw" /><figcaption><StorefrontText id="copy_e245a037b86845f7" fallback="Illustrative report · not a real sample" /></figcaption></figure>
      </div>
    </section>
  );
}
