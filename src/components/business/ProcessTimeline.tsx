import type { B2BPageStep } from "@/lib/business/repository";

export function ProcessTimeline({ steps }: { steps: B2BPageStep[] }) {
  return (
    <ol className="tf-timeline">
      {steps.map((step, index) => (
        <li key={`${step.title}-${index}`}>
          <b aria-hidden="true">{String(index + 1).padStart(2, "0")}</b>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
