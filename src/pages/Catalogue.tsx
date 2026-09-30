import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OPPORTUNITIES } from '../catalogue/data';
import { DEFAULT_FILTERS, LEVEL_LABEL, applyFilters, restoreFilters, type Filters } from '../catalogue/filters';
import { Hero } from '../components/Hero';
import { SearchBar } from '../components/SearchBar';
import { ExploreSection } from '../components/ExploreMarquees';
import { MatchFinder } from '../components/MatchFinder';
import { ScholarshipCard } from '../components/ScholarshipCard';
import { HowItWorks } from '../components/HowItWorks';
import { AIGuidePreview } from '../components/AIGuidePreview';
import { TrustSection } from '../components/TrustSection';
import { Reveal } from '../components/motionKit';

export function Catalogue() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f, setF] = useState<Filters>(() => {
    try { return restoreFilters(sessionStorage.getItem('tribal-catalogue-filters'));  }
    catch { return DEFAULT_FILTERS; }
  });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    try { sessionStorage.setItem('tribal-catalogue-filters', JSON.stringify(f)); } catch { /* Browsing still works without storage. */ }
  }, [f]);

  const categories = useMemo(() => [...new Set(OPPORTUNITIES.map((o) => o.category))], []);
  const list = useMemo(() => applyFilters(OPPORTUNITIES, f), [f]);
  const active = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);

  const selected = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).filter(key => f[key] !== DEFAULT_FILTERS[key]);
  const filterLabel = (key: keyof Filters) => key === 'q' ? `Search: ${f.q}` : key === 'level' ? LEVEL_LABEL[f.level as keyof typeof LEVEL_LABEL] : key === 'openOnly' ? 'Guided demos' : key === 'deadline' ? (f.deadline === 'set' ? 'Date listed' : 'Date unconfirmed') : String(f[key]);
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
      </div>
      <ExploreSection onPick={preset} />
      <div className="home"><MatchFinder onMatch={preset} /></div>

      <div className="home">
      <section id="opportunities" className="sec sec-first" aria-labelledby="opp-h">
        <Reveal className="sec-head">
          <h2 id="opp-h">Scholarships to explore</h2>
          <p>Browse the demo catalogue. Verify current requirements and dates on the official provider website.</p>
        </Reveal>
        <button className="filter-toggle btn-outline" type="button" aria-expanded={filtersOpen} aria-controls="catalogue-filters" onClick={() => setFiltersOpen(!filtersOpen)}>Filters{selected.length ? ` (${selected.length})` : ''} <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span></button>
        <div id="catalogue-filters" className={`filters2 ${filtersOpen ? 'filters-open' : ''}`} role="group" aria-label="Filters">
          <div className="f-item"><label htmlFor="f-level">Level</label>
            <select id="f-level" value={f.level} onChange={(e) => set('level', e.target.value as Filters['level'])}>
              <option value="all">All levels</option><option value="school">School</option><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option><option value="research">Research</option><option value="vocational">Vocational / ITI</option>
            </select></div>
          <div className="f-item"><label htmlFor="f-loc">Study location</label>
            <select id="f-loc" value={f.loc} onChange={(e) => set('loc', e.target.value as Filters['loc'])}>
              <option value="all">India or overseas</option><option value="India">India</option><option value="Overseas">Overseas</option>
            </select></div>
          <div className="f-item"><label htmlFor="f-dl">Deadline</label>
            <select id="f-dl" value={f.deadline} onChange={(e) => set('deadline', e.target.value as Filters['deadline'])}>
              <option value="all">Any</option><option value="set">Illustrative date listed</option><option value="tbc">To be confirmed</option>
            </select></div>
          <div className="f-item"><label htmlFor="f-cat">Category</label>
            <select id="f-cat" value={f.category} onChange={(e) => set('category', e.target.value)}>
              <option value="all">All</option>{categories.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <label className="f-toggle"><input type="checkbox" checked={f.openOnly} onChange={(e) => set('openOnly', e.target.checked)} /> Guided demo available</label>
          {active && <button type="button" className="btn-quiet" onClick={() => setF(DEFAULT_FILTERS)}>Clear all</button>}
        </div>

        {selected.length > 0 && <div className="active-filters" aria-label="Active filters">{selected.map(key => <button type="button" key={key} onClick={() => setF(current => ({ ...current, [key]: DEFAULT_FILTERS[key] }))} aria-label={`Remove ${filterLabel(key)} filter`}>{filterLabel(key)} <span aria-hidden="true">×</span></button>)}</div>}
        <p className="count" aria-live="polite">{`${list.length} of ${OPPORTUNITIES.length} opportunities${f.q.trim() ? ` for “${f.q.trim()}”` : ''}`}</p>
        {list.length === 0 ? (
          <motion.div className="empty2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3>No opportunities match</h3>
            <p>{f.q.trim() ? `“${f.q.trim()}” is not in the demo catalogue.` : 'Nothing matches these filters.'} This demo has {OPPORTUNITIES.length} entries; real schemes are on the official portal.</p>
            <button className="btn-solid" onClick={() => setF(DEFAULT_FILTERS)}>Clear search and filters</button>
          </motion.div>
        ) : (
          <motion.div className="s-grid" layout>
            <AnimatePresence mode="popLayout">{list.map((o, i) => <ScholarshipCard key={o.id} o={o} index={i} />)}</AnimatePresence>
          </motion.div>
        )}
      </section>

      <HowItWorks />
      <AIGuidePreview />
      <TrustSection />
      </div>
    </>
  );
}
