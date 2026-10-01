import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { go } from '../router';
import { LogoMark } from './icons';
import { ease } from './motionKit';
import { useT } from '../i18n/i18n';
import { LanguageSwitch } from './LanguageSwitch';

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

export function Navbar({ onAbout }: { onAbout: () => void; onReset?: () => void }) {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const mobileMenu = useRef<HTMLDetailsElement>(null);
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
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const isHome = hash === '#/' || hash === '' || hash.startsWith('#/opportunity');

  return (
    <motion.header className={`site-nav ${scrolled ? 'site-nav-scrolled' : ''}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      <div className="nav-proto">{t('Independent guide · Apply on the official portals')}</div>
      <div className="nav-row wrap2">
        <a href="#/" className="brand" aria-label={t('TribalSaarthi home')}>
          <LogoMark />
          <span>Tribal<b>Saarthi</b></span>
        </a>
        <nav aria-label={t('Main')} className="nav-links">
          <a href="#/" aria-current={isHome ? 'page' : undefined}>{t('Opportunities')}</a>
          <a href="#/applications" aria-current={hash.startsWith('#/applications') ? 'page' : undefined}>{t('My Saved')}</a>
          <button type="button" onClick={() => scrollToSection('how')}>{t('How it Works')}</button>
          <button type="button" onClick={onAbout}>{t('Help')}</button>
        </nav>
        <div className="nav-right">
          <a className="ai-pill" href="#/guide/nfst-demo/overview" title={t('Open Saarthi AI, the scholarship guide')}>
            Saarthi AI
          </a>
          <LanguageSwitch />
          <details className="mobile-nav" ref={mobileMenu} onKeyDown={e => { if (e.key === 'Escape') { mobileMenu.current?.removeAttribute('open'); mobileMenu.current?.querySelector('summary')?.focus(); } }}>
            <summary aria-label={t('Main menu')}><span aria-hidden="true">☰</span><span>{t('Menu')}</span></summary>
            <nav className="mobile-nav-panel" aria-label={t('Mobile navigation')}>
              <a href="#/" onClick={() => mobileMenu.current?.removeAttribute('open')}>{t('Scholarships')}</a>
              <a href="#/applications" onClick={() => mobileMenu.current?.removeAttribute('open')}>{t('My Saved')}</a>
              <button type="button" onClick={() => { mobileMenu.current?.removeAttribute('open'); scrollToSection('how'); }}>{t('How it works')}</button>
              <button type="button" onClick={() => { mobileMenu.current?.removeAttribute('open'); onAbout(); }}>{t('Help & about')}</button>
              <a href="#/guide/nfst-demo/overview" onClick={() => mobileMenu.current?.removeAttribute('open')}>Saarthi AI</a>
            </nav>
          </details>
        </div>
      </div>
    </motion.header>
  );
}
