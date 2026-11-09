import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { ArrowRight, Leaf, Mountain, Coffee, Heart, Quote } from "lucide-react";
import type { HomepageContent } from "@/lib/homepageSchema";
import { RitualNewsletter } from "./RitualNewsletter";
const icons = { leaf: Leaf, mountain: Mountain, cup: Coffee, heart: Heart };
export function RitualEditorial({ content }: { content: HomepageContent }) {
  const { story, benefits, reviews, newsletter } = content;
  const approved = reviews?.entries.filter((entry) => entry.approved) ?? [];
  return <>
    {story && <section className="ritual-story" aria-labelledby="story-heading">
      <div className="ritual-story-visual story-art" data-testid="story-art" style={{ position: "relative", minHeight: "280px" }}>
        {story.image_url ? (
          <Image src={story.image_url} alt={story.image_alt || "Direct from single estate tea harvest"} fill sizes="(max-width: 700px) 100vw, 50vw"/>
        ) : (
          <svg
            role="img"
            aria-label={story.image_alt || "Direct from single estate tea harvest"}
            viewBox="0 0 600 400"
            style={{ width: "100%", height: "100%", minHeight: "280px", display: "block" }}
          >
            <title>Tea harvest story</title>
            <desc>Single estate artisan story</desc>
            <rect width="600" height="400" fill="#dfe5dc" />
          </svg>
        )}
        <p>{story.caption}</p>
      </div>
      <div className="ritual-story-copy"><Leaf className="ritual-story-leaf" size={170} strokeWidth={.7} aria-hidden="true"/><p className="ritual-eyebrow">{story.eyebrow}</p><h2 id="story-heading">{story.title}<em>{story.emphasis}</em></h2><p className="ritual-story-description">{story.description}</p>{story.cta.href && <Link className="button button-primary" href={story.cta.href}>{story.cta.label}<ArrowRight size={17} aria-hidden="true"/></Link>}</div>
    </section>}
    {benefits && benefits.length > 0 && <div className="ritual-benefits ritual-container">{benefits.map((item, index) => { const Icon = icons[item.icon]; return <div key={index}><Icon size={34} strokeWidth={1} aria-hidden="true"/><div><h3>{item.title}</h3><p>{item.description}</p></div></div>; })}</div>}
    {reviews && <section className="ritual-community ritual-container" aria-labelledby="community-heading"><div className="ritual-section-heading"><div><p className="ritual-eyebrow">{reviews.eyebrow}</p><h2 id="community-heading">{reviews.title} <em>{reviews.emphasis}</em></h2></div>{reviews.cta.href && <Link className="ritual-text-link" href={reviews.cta.href}>{reviews.cta.label}<ArrowRight size={17} aria-hidden="true"/></Link>}</div>
      {approved.length ? <div className="ritual-review-grid">{approved.map((entry, i) => <figure key={i}><Quote size={24} strokeWidth={1} aria-hidden="true"/><blockquote>{entry.quote}</blockquote><figcaption>{entry.attribution}</figcaption></figure>)}</div> : <div className="ritual-community-empty"><Coffee size={42} strokeWidth={1} aria-hidden="true"/><div><h3>{reviews.empty_title}</h3><p>{reviews.empty_description}</p></div><Leaf size={70} strokeWidth={.7} aria-hidden="true"/></div>}
    </section>}
    {newsletter?.enabled && <section className="ritual-newsletter" aria-labelledby="newsletter-heading">{newsletter.image_url && <Image src={newsletter.image_url} alt={newsletter.image_alt} fill sizes="100vw"/>}<div className="ritual-container ritual-newsletter-inner"><div><p className="ritual-eyebrow">{newsletter.eyebrow}</p><h2 id="newsletter-heading">{newsletter.title}</h2><p>{newsletter.description}</p></div><RitualNewsletter content={newsletter}/></div></section>}
  </>;
}
