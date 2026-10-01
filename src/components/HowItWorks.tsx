import { useT } from '../i18n/i18n';

const STEPS = [
  ['1', 'Find a scheme', 'Filter by your level of study and where you study. Every real scheme shows its official source and the date it was checked.'],
  ['2', 'Ask the guide', 'Get answers about eligibility, documents and benefits, taken from the official facts. It never decides eligibility for you.'],
  ['3', 'Apply officially', 'Go to the official portal with the guide beside you. You upload and submit yourself.'],
] as const;

export function HowItWorks() {
  const t = useT();
  return (
    <section id="how" className="sec how" aria-labelledby="how-h">
      <h2 id="how-h">{t('How it works')}</h2>
      <ol className="how-steps">
        {STEPS.map(([n, title, text]) => (
          <li key={n}><span className="how-n" aria-hidden="true">{n}</span><h3>{t(title)}</h3><p>{t(text)}</p></li>
        ))}
      </ol>
    </section>
  );
}
