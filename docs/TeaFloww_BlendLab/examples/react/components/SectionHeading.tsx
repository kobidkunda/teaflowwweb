interface Props { eyebrow?: string; title: string; description?: string; center?: boolean; id?: string; }
export function SectionHeading({ eyebrow, title, description, center = false, id }: Props) {
  return <div className={`tl-section-heading ${center ? 'tl-center' : ''}`}>
    {eyebrow && <p className="tl-eyebrow">{eyebrow}</p>}
    <h2 id={id}>{title}</h2>
    {description && <p className="tl-lede">{description}</p>}
  </div>;
}
