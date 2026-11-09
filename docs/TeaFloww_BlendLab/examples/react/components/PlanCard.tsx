import type { ServicePlan } from '../domain/types';
import { formatInr } from '../domain/money';
import { Button } from './Button';

interface Props {
  plan: ServicePlan;
  selected?: boolean;
  onSelect?: (planCode: ServicePlan['code']) => void;
  checkoutEnabled?: boolean;
}

export function PlanCard({ plan, selected = false, onSelect, checkoutEnabled = false }: Props) {
  return <article className={`tl-plan ${plan.highlighted ? 'tl-plan--featured' : ''} ${selected ? 'tl-plan--selected' : ''}`}
    aria-label={`${plan.title} plan`}>
    {plan.highlighted && <div className="tl-plan__ribbon">Most complete</div>}
    <p className="tl-eyebrow">{plan.eyebrow}</p>
    <h3>{plan.title}</h3>
    <p className="tl-plan__description">{plan.description}</p>
    <div className="tl-plan__price"><strong>{formatInr(plan.totalPaise).replace('.00', '')}</strong><span>inclusive target price*</span></div>
    <ul className="tl-plan__features">{plan.features.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
    <div className="tl-plan__grow" />
    <Button variant={plan.highlighted ? 'primary' : 'secondary'}
      onClick={() => onSelect?.(plan.code)} disabled={!checkoutEnabled || !onSelect}>
      {checkoutEnabled ? plan.buttonLabel : 'Preview — checkout not connected'}
    </Button>
    <p className="tl-plan__footnote">{plan.exclusions.join(' · ')}</p>
  </article>;
}
