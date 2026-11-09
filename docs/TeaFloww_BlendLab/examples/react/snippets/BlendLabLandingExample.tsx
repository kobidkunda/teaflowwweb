/** Reference composition only. NOT a page/router entry point or complete product. */
import { BlendLabHero } from '../components/BlendLabHero';
import { SectionHeading } from '../components/SectionHeading';
import { ProcessSteps } from '../components/ProcessSteps';
import { ReportTeaser } from '../components/ReportTeaser';
import { PlanCard } from '../components/PlanCard';
import { orderedPlans } from '../domain/plans';
import '../styles/tokens.css';

export function BlendLabLandingExample() {
  return <>
    <BlendLabHero />
    <section className="tl-section tl-container" aria-labelledby="tl-work-title">
      <SectionHeading id="tl-work-title" eyebrow="THE PROCESS" title="From your sample to an informed decision."
        description="Every step is traceable. The deliverables depend on the service you choose." />
      <ProcessSteps />
    </section>
    <section className="tl-section tl-section--sage" id="report-preview">
      <div className="tl-container tl-split">
        <SectionHeading eyebrow="WHAT YOU GET" title="Know what your tea is doing in the cup."
          description="Professional observations, methods, and clear next actions — not vague assurances." />
        <ReportTeaser />
      </div>
    </section>
    <section className="tl-section tl-container" id="plans">
      <SectionHeading eyebrow="SELECT YOUR SERVICE" title="Start small, develop with confidence."
        description="Courier policy and detailed service limits must be approved before enabling purchase." center />
      <div className="tl-plan-grid">{orderedPlans.map(plan => <PlanCard key={plan.code} plan={plan} />)}</div>
      <p className="tl-center tl-fine-print">* Demo design only. Checkout buttons are intentionally disabled. Final GST and courier terms require approval.</p>
    </section>
  </>;
}
