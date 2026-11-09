import React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function SyntheticReportPreview() {
  return (
    <section id="sample-report" className="bl-report" aria-labelledby="report-preview-heading">
      <div className="bl-wrap bl-report-grid">
        <div className="bl-report-copy"><p className="bl-eyebrow">YOUR OUTPUT</p><h2 id="report-preview-heading">A clear report.<br />A practical next step.</h2>
          <p>Understand your tea through sensory observations, flavour notes and recommendations. Take the next step with confidence, whether that’s sourcing, adjusting a blend or developing something new.</p>
          <p className="bl-report-availability">Detailed reports are included with Tea Quality Audit and Signature Blend Lab.</p>
          <details className="bl-report-details"><summary>See an example report<ArrowRight size={16} aria-hidden="true" /></summary><div className="bl-report-example"><h3>Inside your evaluation</h3><p>Illustrative structure, not a customer’s test result.</p><ul><li>Sample reference and brewing conditions</li><li>Dry leaf and infused leaf observations</li><li>Liquor colour, aroma, body and finish</li><li>Milk response, where relevant</li><li>Recommendations and possible next steps</li></ul><p>Your report reflects your sample and selected service. No example scores or savings are presented as measured results.</p></div></details>
        </div>
        <figure className="bl-report-art"><Image src="/images/blend-lab/report-preview.webp" alt="AI-generated illustration of a TeaFloww evaluation report showing the sections covered; not an actual customer report" width={1200} height={1000} sizes="(max-width: 700px) 100vw, 55vw" /><figcaption>Illustrative report · not a real sample</figcaption></figure>
      </div>
    </section>
  );
}
