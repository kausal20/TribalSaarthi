import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { findOpportunity } from '../catalogue/data';
import { LEVEL_LABEL } from '../catalogue/filters';
import { acceptedLabel } from '../engine/evaluator';
import { AIGuideButton } from '../components/ScholarshipCard';
import { BackIcon, ExternalIcon } from '../components/icons';
import { Reveal } from '../components/motionKit';

export function NotFound({ what }: { what: string }) {
  return (
    <div className="empty2">
      <h2>{what} not found</h2>
      <p>That link does not match an entry in this demo catalogue.</p>
      <a className="btn-solid" href="#/">Back to opportunities</a>
    </div>
  );
}

const NAV = [
  ['overview', 'Overview'],
  ['eligibility', 'Requirements'],
  ['documents', 'Documents'],
  ['verify', 'Check official details'],
  ['apply', 'How to apply'],
] as const;

export function Detail({ id }: { id: string }) {
  const o = findOpportunity(id);
  const reduce = useReducedMotion();
  const [activeSection, setActiveSection] = useState<string>('overview');

  useEffect(() => {
    if (!o) return;
    setActiveSection('overview');
    const observer = new IntersectionObserver(
      entries => {
        const first = entries.find(entry => entry.isIntersecting);
        if (first) setActiveSection(first.target.id.replace('d-', ''));
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    for (const [key] of NAV) {
      const section = document.getElementById(`d-${key}`);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [o]);

  if (!o) return <NotFound what="Opportunity" />;
  const open = o.status === 'Open in demo';
  const off = o.official;
  // Portals where the TribalSaarthi browser guide works beside the official site.
  const guided: 'mahadbt' | 'nsp' | undefined = off?.guidedPortal ?? (o.id === 'postmatric-demo' ? 'mahadbt' : undefined);
  const guidedName = guided === 'nsp' ? 'the National Scholarship Portal' : 'MahaDBT';
  const elig = o.sections.find(s => s.id === 'eligibility')!;
  const deadline = o.deadline.set ? o.deadline.text.replace(' (illustrative)', '') : off ? 'See official notice' : 'Not confirmed';

  function jump(key: string) {
    setActiveSection(key);
    document.getElementById(`d-${key}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="detail">
      <a href="#/" className="back"><BackIcon width={16} height={16} /> Back to opportunities</a>

      <header className="d-head">
        <div className="d-head-copy">
          <div className="d-badges"><span className="d-eyebrow">Scholarship guide</span>{off ? <span className="tag tag-official">Official scheme · checked {off.checkedOn}</span> : <span className="tag tag-demo">Illustrative example</span>}</div>
          <h1>{o.title}</h1>
          <p className="d-sub">{o.tagline}</p>
          <dl className="d-facts">
            <div><dt>Study level</dt><dd>{LEVEL_LABEL[o.level]}</dd></div>
            <div><dt>Study location</dt><dd>{o.location}</dd></div>
            <div><dt>Deadline</dt><dd>{deadline}</dd><small>{o.deadline.set ? 'Demo date, verify officially' : off ? 'Dates change every year' : 'Check with the provider'}</small></div>
          </dl>
          <p className="d-disclosure">{off
            ? <>Facts from {off.sourceTitle}, checked {off.checkedOn}. Rules and amounts change every year — confirm the current notice before you apply. TribalSaarthi is independent and is not the provider.</>
            : 'This is a practice example, not a live scholarship listing. Confirm the specific scheme’s rules on its official website.'}</p>
        </div>

        <div className="d-action-panel" aria-label="Choose your next step">
          <p className="d-action-eyebrow">Your next step</p>
          <div className="d-action-group">
            <div className="d-action-copy"><span>01 · PRACTISE HERE</span><strong>Understand the process</strong><p>Explore a sample application using fictional details.</p></div>
            {open
              ? <AIGuideButton href={`#/guide/${o.id}/overview`} label="Try guided demo" full />
              : <p className="d-unavailable">Guided practice is not available for this example yet.</p>}
          </div>
          <div className="d-action-group">
            <div className="d-action-copy"><span>02 · OFFICIAL SOURCE</span><strong>{guided ? `Continue on ${guided === 'nsp' ? 'NSP' : 'MahaDBT'}` : off ? 'Apply on the official portal' : 'Check the official information'}</strong><p>{guided ? `See how to use the browser guide beside ${guidedName}.` : off ? `Apply ${off.applyVia}.` : 'Read current information from the official source.'}</p></div>
            {guided
              ? <a className="btn-outline d-official-btn" href={`#/continue/${guided}/${o.id}`}>Continue with guide</a>
              : <a className="btn-outline d-official-btn" href={o.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">Official scheme information <ExternalIcon width={15} height={15} /><span className="sr-only"> (opens in a new tab)</span></a>}
            {guided && <a className="d-direct-link" href={off?.applyUrl ?? o.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">{guided === 'nsp' ? 'Open NSP directly' : 'Open MahaDBT directly'} <ExternalIcon width={14} height={14} /><span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>
      </header>

      <div className="d-layout">
        <nav className="d-rail" aria-label="On this page">
          <span className="d-rail-label">ON THIS PAGE</span>
          {NAV.map(([key, label]) => <button key={key} type="button" aria-current={activeSection === key ? 'location' : undefined} onClick={() => jump(key)}>{label}</button>)}
        </nav>

        <div className="d-main">
          <Reveal><section id="d-overview" className="d-sec">
            <h2>Overview</h2>
            <p>{o.purpose}</p>
            <p className="d-muted">{off ? <>Provider: {o.providerName}. <a href={o.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">Official source ↗</a></> : `${o.providerName}. This description is for practice and does not describe a live scheme.`}</p>
            {off?.notes?.map(n => <p key={n} className="note">{n}</p>)}
          </section></Reveal>

          <Reveal><section id="d-eligibility" className="d-sec">
            <h2>{off ? 'Eligibility (official source)' : 'Requirements in this example'}</h2>
            <ul className="d-requirements">{elig.body.filter(b => !b.startsWith('Illustrative only')).map(b => <li key={b}>{b}</li>)}</ul>
            <p className="d-muted">The provider sets actual eligibility rules and makes the final decision.</p>
          </section></Reveal>

          <Reveal><section id="d-documents" className="d-sec">
            <div className="d-section-heading"><div><h2>{off ? 'Documents listed officially' : 'Documents to practise with'}</h2><p>{off ? 'Keep these ready. The portal shows the complete current list.' : 'Sample files only. Check the official scheme for its current document list.'}</p></div><span>{o.documents.length} {off ? 'listed' : 'in this demo'}</span></div>
            <ul className="doc-list">{o.documents.map((document, index) => (
              <li key={document.key}><span className="d-doc-index" aria-hidden="true">0{index + 1}</span><div><strong>{document.label}</strong><small>{document.note}</small></div><span className="d-doc-format">{acceptedLabel(document.acceptedTypes)}</span></li>
            ))}</ul>
          </section></Reveal>

          <Reveal><section id="d-verify" className="d-sec">
            <h2>Check official details</h2>
            <div className="d-verify-grid">
              <div><h3>Deadline</h3><p><strong>{deadline}</strong></p><small>{o.deadline.set ? 'Illustrative date only. Confirm the current closing date on the official portal.' : off ? o.deadline.text : 'Ask the provider for the current closing date.'}</small></div>
              <div><h3>Benefits</h3>{off ? <ul>{off.benefits.map(b => <li key={b}>{b}</li>)}</ul> : <p>Amounts and coverage vary by scheme.</p>}<small>{off ? `As per the official source, checked ${off.checkedOn}. Confirm current amounts.` : 'Review the exact benefits on the official scheme page before applying.'}</small></div>
            </div>
          </section></Reveal>

          <Reveal><section id="d-apply" className="d-sec">
            <h2>How to apply</h2>
            <ol className="how-list">
              <li>{open ? 'Use the guided demo to learn the sample form and document steps.' : 'Review the illustrative requirements and prepare the documents that may be relevant.'}</li>
              <li>{off ? <>Apply {off.applyVia}: <a href={off.applyUrl} target="_blank" rel="noopener noreferrer">{off.applyUrl}</a></> : 'Open the official source and choose the specific scheme that matches your situation.'}</li>
              <li>Enter your information, upload documents and submit on the provider’s website yourself.</li>
            </ol>
          </section></Reveal>
        </div>
      </div>
    </div>
  );
}
