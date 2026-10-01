import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { findOpportunity } from '../catalogue/data';
import { LEVEL_LABEL } from '../catalogue/filters';
import { acceptedLabel } from '../engine/evaluator';
import { AIGuideButton } from '../components/ScholarshipCard';
import { BackIcon, ExternalIcon } from '../components/icons';
import { Reveal } from '../components/motionKit';
import { useLang, useT } from '../i18n/i18n';

export function NotFound({ what }: { what: string }) {
  const t = useT();
  return (
    <div className="empty2">
      <h2>{t('{what} not found', { what: t(what) })}</h2>
      <p>{t('That link does not match an entry in this catalogue.')}</p>
      <a className="btn-solid" href="#/">{t('Back to opportunities')}</a>
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
  const t = useT();
  const lang = useLang();
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
  const guidedName = guided === 'nsp' ? t('the National Scholarship Portal') : 'MahaDBT';
  const elig = o.sections.find(s => s.id === 'eligibility')!;
  const deadline = o.deadline.set ? o.deadline.text.replace(' (illustrative)', '') : off ? t('See official notice') : t('Not confirmed');

  function jump(key: string) {
    setActiveSection(key);
    document.getElementById(`d-${key}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="detail">
      <a href="#/" className="back"><BackIcon width={16} height={16} /> {t('Back to opportunities')}</a>

      <header className="d-head">
        <div className="d-head-copy">
          <div className="d-badges"><span className="d-eyebrow">{t('Scholarship guide')}</span>{off ? <span className="tag tag-official">{t('Official scheme · checked {date}', { date: off.checkedOn })}</span> : <span className="tag tag-demo">{t('Illustrative example')}</span>}</div>
          <h1>{o.title}</h1>
          <p className="d-sub">{o.tagline}</p>
          <dl className="d-facts">
            <div><dt>{t('Study level')}</dt><dd>{t(LEVEL_LABEL[o.level])}</dd></div>
            <div><dt>{t('Study location')}</dt><dd>{t(o.location)}</dd></div>
            <div><dt>{t('Deadline')}</dt><dd>{deadline}</dd><small>{o.deadline.set ? t('Demo date, verify officially') : off ? t('Dates change every year') : t('Check with the provider')}</small></div>
          </dl>
          <p className="d-disclosure">{off
            ? <>{t('Facts from {source}, checked {date}', { source: off.sourceTitle, date: off.checkedOn })}. {t('Rules and amounts change every year. Confirm the current notice before you apply. TribalSaarthi is independent and is not the provider.')}</>
            : t('This is a practice example, not a live scholarship listing. Confirm the specific scheme’s rules on its official website.')}</p>
        </div>

        <div className="d-action-panel" aria-label={t('Choose your next step')}>
          <p className="d-action-eyebrow">{t('Your next step')}</p>
          <div className="d-action-group">
            <div className="d-action-copy"><span>{t('01 · PRACTISE HERE')}</span><strong>{t('Understand the process')}</strong><p>{t('Explore a sample application using fictional details.')}</p></div>
            {open
              ? <AIGuideButton href={`#/guide/${o.id}/overview`} label={t('Open Saarthi AI')} full />
              : <p className="d-unavailable">{t('Guided practice is not available for this example yet.')}</p>}
          </div>
          <div className="d-action-group">
            <div className="d-action-copy"><span>{t('02 · OFFICIAL SOURCE')}</span><strong>{guided ? t('Continue on {portal}', { portal: guided === 'nsp' ? 'NSP' : 'MahaDBT' }) : off ? t('Apply on the official portal') : t('Check the official information')}</strong><p>{guided ? t('See how to use the browser guide beside {portal}.', { portal: guidedName }) : off ? `${t('Apply')} ${off.applyVia}.` : t('Read current information from the official source.')}</p></div>
            {guided
              ? <a className="btn-outline d-official-btn" href={`#/continue/${guided}/${o.id}`}>{t('Continue with guide')}</a>
              : <a className="btn-outline d-official-btn" href={o.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">{t('Official scheme information ↗')}<span className="sr-only"> {t('(opens in a new tab)')}</span></a>}
            {guided && <a className="d-direct-link" href={off?.applyUrl ?? o.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">{guided === 'nsp' ? t('Open NSP directly') : t('Open MahaDBT directly')} <ExternalIcon width={14} height={14} /><span className="sr-only"> {t('(opens in a new tab)')}</span></a>}
          </div>
        </div>
      </header>

      <div className="d-layout">
        <nav className="d-rail" aria-label={t('On this page')}>
          <span className="d-rail-label">{t('ON THIS PAGE')}</span>
          {NAV.map(([key, label]) => <button key={key} type="button" aria-current={activeSection === key ? 'location' : undefined} onClick={() => jump(key)}>{t(label)}</button>)}
        </nav>

        <div className="d-main">
          <Reveal><section id="d-overview" className="d-sec">
            <h2>{t('Overview')}</h2>
            <p>{o.purpose}</p>
            <p className="d-muted">{off ? <>{t('Provider')}: {o.providerName}. <a href={o.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">{t('Official source ↗')}</a></> : `${o.providerName}. ${t('This description is for practice and does not describe a live scheme.')}`}</p>
            {off?.notes?.map(n => <p key={n} className="note">{n}</p>)}
          </section></Reveal>

          <Reveal><section id="d-eligibility" className="d-sec">
            <h2>{off ? t('Eligibility (official source)') : t('Requirements in this example')}</h2>
            <ul className="d-requirements">{elig.body.filter(b => !b.startsWith('Illustrative only')).map(b => <li key={b}>{b}</li>)}</ul>
            <p className="d-muted">{t('The provider sets actual eligibility rules and makes the final decision.')}</p>
            {lang !== 'en' && <p className="d-muted">{t('Scheme details are shown in English, exactly as the official source publishes them.')}</p>}
          </section></Reveal>

          <Reveal><section id="d-documents" className="d-sec">
            <div className="d-section-heading"><div><h2>{off ? t('Documents listed officially') : t('Documents to practise with')}</h2><p>{off ? t('Keep these ready. The portal shows the complete current list.') : t('Sample files only. Check the official scheme for its current document list.')}</p></div><span>{o.documents.length} {off ? t('listed') : t('in this demo')}</span></div>
            <ul className="doc-list">{o.documents.map((document, index) => (
              <li key={document.key}><span className="d-doc-index" aria-hidden="true">0{index + 1}</span><div><strong>{document.label}</strong><small>{document.note}</small></div><span className="d-doc-format">{acceptedLabel(document.acceptedTypes)}</span></li>
            ))}</ul>
          </section></Reveal>

          <Reveal><section id="d-verify" className="d-sec">
            <h2>{t('Check official details')}</h2>
            <div className="d-verify-grid">
              <div><h3>{t('Deadline')}</h3><p><strong>{deadline}</strong></p><small>{o.deadline.set ? t('Illustrative date only. Confirm the current closing date on the official portal.') : off ? o.deadline.text : t('Ask the provider for the current closing date.')}</small></div>
              <div><h3>{t('Benefits')}</h3>{off ? <ul>{off.benefits.map(b => <li key={b}>{b}</li>)}</ul> : <p>{t('Amounts and coverage vary by scheme.')}</p>}<small>{off ? t('As per the official source, checked {date}. Confirm current amounts.', { date: off.checkedOn }) : t('Review the exact benefits on the official scheme page before applying.')}</small></div>
            </div>
          </section></Reveal>

          <Reveal><section id="d-apply" className="d-sec">
            <h2>{t('How to apply')}</h2>
            <ol className="how-list">
              <li>{open ? t('Use Saarthi AI to learn the sample form and document steps.') : t('Review the illustrative requirements and prepare the documents that may be relevant.')}</li>
              <li>{off ? <>{t('Apply')} {off.applyVia}: <a href={off.applyUrl} target="_blank" rel="noopener noreferrer">{off.applyUrl}</a></> : t('Open the official source and choose the specific scheme that matches your situation.')}</li>
              <li>{t('Enter your information, upload documents and submit on the provider’s website yourself.')}</li>
            </ol>
          </section></Reveal>
        </div>
      </div>
    </div>
  );
}
