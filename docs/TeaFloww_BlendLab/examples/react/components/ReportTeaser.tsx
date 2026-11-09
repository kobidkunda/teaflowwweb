/** Marketing teaser ONLY. Synthetic values and demo-only label intentionally explicit. */
const demo = [
  { label: 'Perceived strength', score: 7 },
  { label: 'Body', score: 6 },
  { label: 'Aroma', score: 8 },
  { label: 'Finish', score: 7 },
];
export function ReportTeaser() {
  return <div className="tl-report-teaser" aria-label="Illustrative sample report">
    <header><span className="tl-eyebrow">BLEND LAB · EXAMPLE ONLY</span><span>DEMO-TL-001</span></header>
    <h3>A clearer picture of your tea.</h3>
    <p>Real reports combine a controlled tasting method, expert remarks, traceable findings and commercial recommendations.</p>
    <div className="tl-demo-scores">
      {demo.map(({ label, score }) => <div className="tl-demo-score" key={label}>
        <span>{label}</span><div className="tl-demo-meter" role="img" aria-label={`${label}, illustrative ${score} out of 10`}>
          <span style={{ width: `${score * 10}%` }} /></div><strong>{score}/10</strong>
      </div>)}
    </div>
    <small>All values shown are fabricated for layout demonstration and do not represent a tested tea.</small>
  </div>;
}
