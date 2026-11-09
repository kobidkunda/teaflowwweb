"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const goals = [
  { id: "understand", label: "Understand my tea", description: "Get a deeper understanding of your existing tea. We evaluate leaf, infusion and flavour profile, and share practical insights to help you make sourcing or blending decisions.", audience: "Cafés refining their current brew, tea brands assessing quality, and bulk buyers comparing samples before purchase.", plan: "QUALITY_AUDIT" },
  { id: "chai", label: "Improve my chai", description: "Explore how your tea performs with milk. Look at strength, colour, aroma and balance using your preferred brewing method, then discuss where your cup could improve.", audience: "Chai businesses, hospitality teams and cafés looking for a fuller, more balanced everyday cup.", plan: "QUALITY_AUDIT" },
  { id: "signature", label: "Develop a signature blend", description: "Turn your taste brief into a blend-development project. Share your reference tea, brewing method and commercial goals so we can explore trial formulations with you.", audience: "Tea brands and businesses developing a distinctive blend, with physical trials included in the Signature plan.", plan: "SIGNATURE" },
] as const;

export function GoalExplorer() {
  const [selected, setSelected] = useState(0);
  const goal = goals[selected];
  return (
    <section className="bl-goals bl-wrap" aria-labelledby="goal-explorer-title">
      <div className="bl-goal-copy">
        <p className="bl-eyebrow">WHAT BRINGS YOU HERE?</p>
        <h2 id="goal-explorer-title">Choose your goal.</h2>
        <div aria-live="polite" aria-atomic="true"><p>{goal.description}</p></div>
        <Link className="bl-button" href={`/blend-lab/start?plan=${goal.plan}`}>Choose this goal<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="bl-goal-controls">
        <div className="bl-goal-options" role="group" aria-label="Your tea goal">
          {goals.map((item, index) => <button key={item.id} type="button" aria-pressed={index === selected} aria-controls="bl-goal-audience" onClick={() => setSelected(index)}>{item.label}</button>)}
        </div>
        <div id="bl-goal-audience" className="bl-goal-audience" aria-live="polite" aria-atomic="true"><p className="bl-eyebrow">WHO IS THIS FOR?</p><p>{goal.audience}</p></div>
      </div>
    </section>
  );
}
