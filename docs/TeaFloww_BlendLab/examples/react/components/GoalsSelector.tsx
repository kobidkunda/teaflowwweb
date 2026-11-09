'use client';

const goals = [
  { value: 'lower_cost', label: 'Lower sourcing cost', hint: 'Explore available lower-cost alternatives.' },
  { value: 'stronger_chai', label: 'Stronger milk chai', hint: 'Prioritize body and retained strength in milk.' },
  { value: 'consistent_cup', label: 'More consistent cup', hint: 'Reduce variability with repeatable lot specifications.' },
  { value: 'new_signature', label: 'New signature blend', hint: 'Develop something new for your market.' },
] as const;
export type Goal = (typeof goals)[number]['value'];

export function GoalsSelector({ value, onChange }: { value: Goal[]; onChange: (next: Goal[]) => void }) {
  return <fieldset className="tl-goal-picker">
    <legend className="tl-goal-picker__title">What do you want to achieve?</legend>
    <p id="tl-goals-help">Choose as many as apply. These are objectives, not guaranteed outcomes.</p>
    <div className="tl-goal-picker__grid">{goals.map(goal => {
      const checked = value.includes(goal.value);
      return <label key={goal.value} className={`tl-goal-picker__option ${checked ? 'is-selected' : ''}`}>
        <input type="checkbox" checked={checked} aria-describedby="tl-goals-help"
          onChange={() => onChange(checked ? value.filter(v => v !== goal.value) : [...value, goal.value])} />
        <span><strong>{goal.label}</strong><small>{goal.hint}</small></span>
      </label>;
    })}</div>
  </fieldset>;
}
