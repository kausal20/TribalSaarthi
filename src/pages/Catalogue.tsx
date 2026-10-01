import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OPPORTUNITIES } from '../catalogue/data';
import { DEFAULT_FILTERS, LEVEL_LABEL, applyFilters, restoreFilters, type Filters } from '../catalogue/filters';
import { Hero } from '../components/Hero';
import { SearchBar } from '../components/SearchBar';
import { PortalStrip } from '../components/PortalStrip';
import { ScholarshipCard } from '../components/ScholarshipCard';
import { HowItWorks } from '../components/HowItWorks';
import { TrustSection } from '../components/TrustSection';
import { Reveal } from '../components/motionKit';
import { useT } from '../i18n/i18n';

const LEVEL_CHIPS: [Filters['level'], string][] = [
  ['all', 'All'], ['school', LEVEL_LABEL.school], ['undergraduate', LEVEL_LABEL.undergraduate], ['postgraduate', LEVEL_LABEL.postgraduate], ['research', LEVEL_LABEL.research], ['vocational', LEVEL_LABEL.vocational],
];

export function Catalogue() {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const [f, setF] = useState<Filters>(() => {
    try { return restoreFilters(sessionStorage.getItem('tribal-catalogue-filters')); }
    catch { return DEFAULT_FILTERS; }
  });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    try { sessionStorage.setItem('tribal-catalogue-filters', JSON.stringify(f)); } catch { /* Browsing still works without storage. */ }
  }, [f]);

  const categories = useMemo(() => [...new Set(OPPORTUNITIES.map((o) => o.category))], []);
  const list = useMemo(() => applyFilters(OPPORTUNITIES, f), [f]);
  const real = list.filter((o) => o.official);
  const practice = list.filter((o) => !o.official);
  const active = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);
  const extraActive = [f.loc !== 'all', f.category !== 'all', f.openOnly].filter(Boolean).length;

  const toResults = useCallback(() => {
    setTimeout(() => document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, []);
  const preset = useCallback((p: Partial<Filters>) => {
    setF({ ...DEFAULT_FILTERS, ...p });
    toResults();
  }, [toResults]);

  return (
    <>
      <div className="home">
        <Hero>
          <SearchBar value={f.q} onChange={(v) => set('q', v)} onPreset={preset} onSubmit={toResults} />
        </Hero>
        <PortalStrip />

        <section id="opportunities" className="sec sec-first" aria-labelledby="opp-h">
          <Reveal className="sec-head">
            <h2 id="opp-h">{t('Find a scheme')}</h2>
            <p>{t('Real schemes for ST students, with the official source for each. Rules change every year, so confirm the current notice before you apply.')}</p>
          </Reveal>

          <div className="lvl-row" role="group" aria-label={t('Level of study')}>
            {LEVEL_CHIPS.map(([value, label]) => (
              <button key={value} type="button" className="lvl-chip" aria-pressed={f.level === value} onClick={() => set('level', value)}>{t(label)}</button>
            ))}
            <button type="button" className="lvl-more" aria-expanded={moreOpen} aria-controls="more-filters" onClick={() => setMoreOpen(!moreOpen)}>
              {t('More filters')}{extraActive ? ` (${extraActive})` : ''} <span aria-hidden="true">{moreOpen ? '−' : '+'}</span>
            </button>
          </div>

          {moreOpen && (
            <div id="more-filters" className="more-filters" role="group" aria-label={t('More filters')}>
              <div className="f-item"><label htmlFor="f-loc">{t('Study location')}</label>
                <select id="f-loc" value={f.loc} onChange={(e) => set('loc', e.target.value as Filters['loc'])}>
                  <option value="all">{t('India or overseas')}</option><option value="India">{t('India')}</option><option value="Overseas">{t('Overseas')}</option>
                </select></div>
              <div className="f-item"><label htmlFor="f-cat">{t('Type')}</label>
                <select id="f-cat" value={f.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="all">{t('All types')}</option>{categories.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                </select></div>
              <label className="f-toggle"><input type="checkbox" checked={f.openOnly} onChange={(e) => set('openOnly', e.target.checked)} /> {t('Guide available')}</label>
            </div>
          )}

          <p className="count" aria-live="polite">
            {real.length} {real.length === 1 ? t('scheme') : t('schemes')}{f.q.trim() ? ` ${t('for')} “${f.q.trim()}”` : ''}
            {active && <button type="button" className="btn-quiet" onClick={() => setF(DEFAULT_FILTERS)}>{t('Clear all')}</button>}
          </p>

          {real.length > 0 && (
            <motion.div className="s-grid" layout>
              <AnimatePresence mode="popLayout">{real.map((o, i) => <ScholarshipCard key={o.id} o={o} index={i} />)}</AnimatePresence>
            </motion.div>
          )}

          {list.length === 0 && (
            <motion.div className="empty2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3>{t('No schemes match')}</h3>
              <p>{f.q.trim() ? t('“{q}” is not in this catalogue.', { q: f.q.trim() }) : t('Nothing matches these filters.')} {t('Real schemes not listed here are on the official portals above.')}</p>
              <button className="btn-solid" onClick={() => setF(DEFAULT_FILTERS)}>{t('Clear search and filters')}</button>
            </motion.div>
          )}

          {practice.length > 0 && (
            <details className="practice-box" open={real.length === 0 || f.q.trim().length > 0}>
              <summary>{t('Practice with a sample application')} <span>({practice.length})</span></summary>
              <p>{t('Fictional examples for learning the form and documents step by step. They are not real scholarships.')}</p>
              <div className="s-grid">{practice.map((o, i) => <ScholarshipCard key={o.id} o={o} index={i} />)}</div>
            </details>
          )}
        </section>

        <HowItWorks />
        <TrustSection />
      </div>
    </>
  );
}
