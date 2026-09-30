import { useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const STEPS = [
  {
    label: 'Discover',
    title: 'Find options that fit',
    summary: 'Explore scholarships by study level, location and area of support.',
    detail: 'Start with the catalogue filters to narrow your search. Each listing explains what is known and links you to the provider for current details.',
    note: 'A few details about your study plans are enough to begin.',
  },
  {
    label: 'Prepare',
    title: 'Understand what comes next',
    summary: 'Review requirements and make unfamiliar steps easier to follow.',
    detail: 'Use the scholarship guide to understand page labels, prepare a document checklist and practise common form steps before you apply.',
    note: 'Always confirm requirements and deadlines with the provider.',
  },
  {
    label: 'Continue',
    title: 'Apply on the official portal',
    summary: 'Move to the provider’s website when you are ready to apply.',
    detail: 'TribalSaarthi helps you find your way. You enter your details, upload files and submit your application directly on the official provider portal.',
    note: 'The provider makes all official eligibility and award decisions.',
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % STEPS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + STEPS.length - 1) % STEPS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = STEPS.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  function advance() {
    if (active < STEPS.length - 1) setActive(active + 1);
    else document.getElementById('opportunities')?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
  }

  const step = STEPS[active];
  return (
    <section id="how" className="sec application-steps" aria-labelledby="how-h">
      <header className="how-heading">
        <p className="how-eyebrow"><span aria-hidden="true" /> A clearer way forward</p>
        <h2 id="how-h">Scholarship guidance, made easier</h2>
        <p>Move from exploring options to preparing with confidence, then continue on the provider’s official website.</p>
      </header>

      <div className="how-journey">
        <div className="how-step-list" role="tablist" aria-label="Your scholarship journey" aria-orientation="vertical">
          {STEPS.map((item, index) => (
            <button
              key={item.label}
              ref={node => { tabs.current[index] = node; }}
              id={`how-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-controls="how-panel"
              tabIndex={active === index ? 0 : -1}
              className={`how-step ${active === index ? 'is-active' : ''}`}
              onClick={() => setActive(index)}
              onKeyDown={event => onTabKeyDown(event, index)}
            >
              <span className="how-step-number" aria-hidden="true">0{index + 1}</span>
              <span className="how-step-copy"><strong>{item.label}</strong><span>{item.title}</span><small>{item.summary}</small></span>
              <span className="how-step-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
          <p className="how-step-footnote">A guide for every student. You stay in control at every step.</p>
        </div>

        <div
          id="how-panel"
          className="how-detail"
          role="tabpanel"
          aria-labelledby={`how-tab-${active}`}
          tabIndex={0}
        >
          <div className="how-detail-topline"><span>YOUR JOURNEY</span><span>0{active + 1} <i>/</i> 03</span></div>
          <div className="how-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / STEPS.length})` }} /></div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.label}
              className="how-detail-content"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -5 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="how-detail-label">{step.label}</p>
              <h3>{step.title}</h3>
              <p className="how-detail-description">{step.detail}</p>
              <div className="how-note"><span aria-hidden="true">✓</span>{step.note}</div>
            </motion.div>
          </AnimatePresence>
          <div className="how-detail-actions">
            {active > 0 ? <button type="button" className="how-back" onClick={() => setActive(active - 1)}>Previous</button> : <span />}
            <button type="button" className="how-next" onClick={advance}>
              {active === STEPS.length - 1 ? 'Explore opportunities' : 'Next step'}
              <span aria-hidden="true">{active === STEPS.length - 1 ? '↗' : '→'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
