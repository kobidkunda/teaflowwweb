import { Button } from './Button';

interface Props { compact?: boolean; }
export function BlendLabHero({ compact = false }: Props) {
  return <section className={`tl-hero ${compact ? 'tl-hero--compact' : ''}`} aria-labelledby="tl-hero-title">
    <div className="tl-container tl-hero__grid">
      <div className="tl-hero__copy">
        <p className="tl-eyebrow tl-eyebrow--light">THE PROFESSIONAL TEA ATELIER</p>
        <h1 id="tl-hero-title">Your tea.<br /><em>Our expertise.</em><br />Better blends.</h1>
        <p>Send your reference tea for professional evaluation and discover blend-development and wholesale sourcing options built around your market.</p>
        <div className="tl-hero__actions">
          <Button href="#plans">Explore plans from ₹299</Button>
          <Button variant="quiet" href="#report-preview">See example report</Button>
        </div>
        <div className="tl-hero__facts"><span>01 / Ship a sample</span><span>02 / Professional tasting</span><span>03 / Choose your next step</span></div>
      </div>
      <div className="tl-hero__scene" role="img" aria-label="Illustrative tea cupping bowls and tasting notes">
        <div className="tl-hero__halo" /><div className="tl-hero__tea tl-hero__tea--one" />
        <div className="tl-hero__tea tl-hero__tea--two" /><div className="tl-hero__tea tl-hero__tea--three" />
        <div className="tl-hero__note"><small>LAB NOTE / 001</small><strong>Every leaf tells a story.</strong><span>Controlled tasting · Commercial thinking</span></div>
      </div>
    </div>
  </section>;
}
