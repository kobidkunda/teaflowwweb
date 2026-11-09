const steps = [
  { title: 'Choose your service', detail: 'Select matching, detailed evaluation or complete development.' },
  { title: 'Share your sample', detail: 'Enter the goal and follow the confirmed courier instructions.' },
  { title: 'Professional tasting', detail: 'Our team records real observations using a defined method.' },
  { title: 'Review your result', detail: 'Receive the deliverables included in your selected plan.' },
  { title: 'Move into wholesale', detail: 'Approve a suitable formula and request a valid bulk quotation.' },
];
export function ProcessSteps() {
  return <ol className="tl-steps">
    {steps.map((step, index) => <li key={step.title} className="tl-steps__item">
      <span className="tl-steps__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div><h3>{step.title}</h3><p>{step.detail}</p></div>
    </li>)}
  </ol>;
}
