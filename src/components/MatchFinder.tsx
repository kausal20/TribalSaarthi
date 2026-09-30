import { useMemo, useState } from 'react';
import { OPPORTUNITIES } from '../catalogue/data';
import { type Filters } from '../catalogue/filters';

type Step = 'level' | 'location' | 'stage';
const STEPS: { id: Step; label: string; options: { label: string; value: string }[] }[] = [
  { id: 'level', label: 'What are you studying?', options: [{ label: 'School', value: 'school' }, { label: 'Undergraduate', value: 'undergraduate' }, { label: 'Postgraduate', value: 'postgraduate' }, { label: 'Research', value: 'research' }] },
  { id: 'location', label: 'Where do you want to study?', options: [{ label: 'In India', value: 'India' }, { label: 'Outside India', value: 'Overseas' }, { label: 'Either is fine', value: 'all' }] },
  { id: 'stage', label: 'Where are you in the process?', options: [{ label: 'Just exploring', value: 'exploring' }, { label: 'Preparing documents', value: 'preparing' }, { label: 'Ready to apply', value: 'ready' }] },
];

export function MatchFinder({ onMatch }: { onMatch: (filters: Partial<Filters>) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<Step, string>>({ level: '', location: '', stage: '' });
  const current = STEPS[step];
  const matched = useMemo(() => OPPORTUNITIES.filter(o => (!answers.level || o.level === answers.level) && (!answers.location || answers.location === 'all' || o.location === answers.location)), [answers]);
  const choose = (value: string) => {
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) setStep(step + 1);
    else onMatch({ level: next.level as Filters['level'], loc: next.location as Filters['loc'] });
  };
  return (
    <section className="match-finder" aria-labelledby="match-h">
      <div className="match-copy"><span className="match-kicker">A quick place to start</span><h2 id="match-h">Find your best starting points.</h2><p>Answer three small questions and we’ll narrow the demo catalogue around your goals.</p></div>
      <div className="match-panel">
        <div className="match-progress" aria-label={`Question ${step + 1} of ${STEPS.length}`}><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <p className="match-step">Question {step + 1} of {STEPS.length}</p><h3>{current.label}</h3>
        <div className="match-options">{current.options.map(option => <button type="button" key={option.value} onClick={() => choose(option.value)}>{option.label}<span aria-hidden="true">→</span></button>)}</div>
        <p className="match-result" aria-live="polite">{answers.level || answers.location ? `${matched.length} possible ${matched.length === 1 ? 'match' : 'matches'} in this demo` : 'No eligibility decision is made here. Providers decide.'}</p>
      </div>
    </section>
  );
}
