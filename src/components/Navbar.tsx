import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PERSONAS, setPersona, useUI, type Persona } from '../store';
import { go } from '../router';
import { LogoMark, SparkleIcon } from './icons';
import { ease } from './motionKit';

/** Scrolls to a home-page section, navigating home first when needed. */
export function scrollToSection(id: string) {
  const run = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const onHome = (window.location.hash || '#/') === '#/';
  if (onHome) run();
  else {
    go('/');
    setTimeout(run, 350);
  }
}

export function Navbar({ onAbout, onReset }: { onAbout: () => void; onReset: () => void }) {
  const ui = useUI();
  const [scrolled, setScrolled] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const hash = window.location.hash || '#/';

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (mobileMenu.current?.open && !mobileMenu.current.contains(e.target as Node)) mobileMenu.current.removeAttribute('open');
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.removeAttribute('open');
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const closeMenu = () => menu.current?.removeAttribute('open');
  const isHome = hash === '#/' || hash === '' || hash.startsWith('#/opportunity');

  return (
    <motion.header className={`site-nav ${scrolled ? 'site-nav-scrolled' : ''}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      <div className="nav-proto">Demo only · Use fictional data · Apply on official portals</div>
      <div className="nav-row wrap2">
        <a href="#/" className="brand" aria-label="TribalSaarthi home">
          <LogoMark />
          <span>Tribal<b>Saarthi</b></span>
        </a>
        <nav aria-label="Main" className="nav-links">
          <a href="#/" aria-current={isHome ? 'page' : undefined}>Opportunities</a>
          <a href="#/applications" aria-current={hash.startsWith('#/applications') ? 'page' : undefined}>My Applications</a>
          <button type="button" onClick={() => scrollToSection('how')}>How it Works</button>
          <button type="button" onClick={onAbout}>Help</button>
        </nav>
        <div className="nav-right">
          <a className="ai-pill" href="#/guide/nfst-demo/overview" title="Try the research fellowship guided demo">
            <SparkleIcon width={14} height={14} /> Try guide demo
          </a>
          <details className="mobile-nav" ref={mobileMenu} onKeyDown={e => { if (e.key === 'Escape') { mobileMenu.current?.removeAttribute('open'); mobileMenu.current?.querySelector('summary')?.focus(); } }}>
            <summary aria-label="Main menu"><span aria-hidden="true">☰</span><span>Menu</span></summary>
            <nav className="mobile-nav-panel" aria-label="Mobile navigation">
              <a href="#/" onClick={() => mobileMenu.current?.removeAttribute('open')}>Scholarships</a>
              <a href="#/applications" onClick={() => mobileMenu.current?.removeAttribute('open')}>My Applications</a>
              <button type="button" onClick={() => { mobileMenu.current?.removeAttribute('open'); scrollToSection('how'); }}>How it works</button>
              <button type="button" onClick={() => { mobileMenu.current?.removeAttribute('open'); onAbout(); }}>Help &amp; about</button>
              <a href="#/guide/nfst-demo/overview" onClick={() => mobileMenu.current?.removeAttribute('open')}>Try research fellowship demo</a>
            </nav>
          </details>
          <details className="menu" ref={menu}>
            <summary aria-label="Profile and demo menu"><span className="avatar" aria-hidden="true">D</span><span className="menu-txt">Demo</span></summary>
            <div className="menu-pop">
              <div className="field inline persona-field">
                <span className="persona-label">Demo role <span>(not authentication)</span></span>
                <div className="persona-select">
                  <button type="button" className="persona-trigger" aria-haspopup="listbox" aria-expanded={personaOpen} onClick={() => setPersonaOpen(open => !open)}>
                    <span>{PERSONAS[ui.persona].label}</span><span className="persona-chevron" aria-hidden="true">⌄</span>
                  </button>
                  {personaOpen && <div className="persona-options" role="listbox" aria-label="Choose demo role">
                    {Object.entries(PERSONAS).map(([k, v]) => <button type="button" role="option" aria-selected={ui.persona === k} className={ui.persona === k ? 'is-selected' : ''} key={k} onClick={() => { setPersona(k as Persona); setPersonaOpen(false); }}>
                      <span>{v.label}</span>{ui.persona === k && <span className="persona-check" aria-hidden="true">✓</span>}
                    </button>)}
                  </div>}
                </div>
              </div>
              <p className="tiny">Workflow prototype tools (earlier build)</p>
              <a href="#/tools" onClick={closeMenu}>Workflow tools home</a>
              <a href="#/officer" onClick={closeMenu}>Officer review desk</a>
              <a href="#/schemes" onClick={closeMenu}>Scheme configurations</a>
              <a href="#/analytics" onClick={closeMenu}>Demo analytics</a>
              <hr />
              <button type="button" onClick={() => { closeMenu(); onAbout(); }}>About &amp; safety</button>
              <button type="button" className="danger-text" onClick={() => { closeMenu(); onReset(); }}>Reset demo…</button>
            </div>
          </details>
        </div>
      </div>
    </motion.header>
  );
}
