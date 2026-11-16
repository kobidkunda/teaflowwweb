import type { PropsWithChildren, ReactNode } from "react";

type Tone = "ivory" | "almond" | "forest";

type SectionProps = PropsWithChildren<{
  id?: string;
  tone?: Tone;
  eyebrow?: string;
  title?: string;
  summary?: string;
  headingSlot?: ReactNode;
}>;

export function Section({
  id,
  tone = "ivory",
  eyebrow,
  title,
  summary,
  headingSlot,
  children,
}: SectionProps) {
  const toneClass =
    tone === "almond" ? "tf-section--almond" : tone === "forest" ? "tf-section--forest" : "";

  return (
    <section id={id} className={`tf-section ${toneClass}`}>
      <div className="tf-container">
        {eyebrow && <span className="tf-eyebrow">{eyebrow}</span>}
        {title && <h2 className="tf-section-heading">{title}</h2>}
        {summary && <p className="tf-copy">{summary}</p>}
        {headingSlot}
        {children}
      </div>
    </section>
  );
}
