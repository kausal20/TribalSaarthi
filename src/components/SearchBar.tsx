import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OPPORTUNITIES } from '../catalogue/data';
import { SUGGESTIONS, type Filters } from '../catalogue/filters';
import { go } from '../router';
import { ArrowIcon, SearchIcon } from './icons';
import { useT } from '../i18n/i18n';

interface Option {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);

export function SearchBar({ value, onChange, onPreset, onSubmit }: { value: string; onChange: (v: string) => void; onPreset: (p: Partial<Filters>) => void; onSubmit: () => void }) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;

  // Ctrl/⌘ + K focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options: Option[] = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return SUGGESTIONS.map((s) => ({ id: s.label, label: t(s.label), hint: t('Filter'), run: () => onPreset(s.preset) }));
    const matches = OPPORTUNITIES.filter((o) => `${o.title} ${o.tagline}`.toLowerCase().includes(q)).slice(0, 4);
    return [
      { id: '__search', label: t('Search for “{q}”', { q: value.trim() }), hint: t('Enter'), run: onSubmit },
      ...matches.map((o) => ({ id: o.id, label: o.title, hint: t('Open details'), run: () => go(`/opportunity/${o.id}`) })),
    ];
  }, [value, onPreset, onSubmit, t]);

  const open = focused;
  const choose = (o: Option) => {
    o.run();
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="search-wrap">
      <motion.div className={`search ${focused ? 'search-focus' : ''}`} animate={{ scale: focused ? 1.015 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
        <SearchIcon className="search-ic" width={22} height={22} />
        <input
          ref={inputRef}
          id="q"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && active < options.length ? `${uid}-o${active}` : undefined}
          aria-label={t('Search scholarships, fellowships, schemes')}
          placeholder={t('Search scholarships')}
          autoComplete="off"
          value={value}
          onChange={(e) => { onChange(e.target.value); setActive(-1); }}
          onFocus={() => { setFocused(true); setActive(-1); }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && options[active]) choose(options[active]); else { onSubmit(); setFocused(false); inputRef.current?.blur(); } }
            else if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
          }}
        />
        {value ? (
          <button type="button" className="search-clear" onPointerDown={e => e.preventDefault()} onClick={() => { onChange(''); setActive(-1); setFocused(true); inputRef.current?.focus(); }} aria-label={t('Clear search')}>✕</button>
        ) : (
          <kbd className="kbd" aria-hidden="true">{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        )}
        <button type="button" className="search-submit" onClick={() => { onSubmit(); setFocused(false); inputRef.current?.blur(); }}>{t('Search')}</button>
      </motion.div>
      <AnimatePresence>
        {open && (
          <motion.ul id={listId} role="listbox" aria-label={t('Search suggestions')} className="suggest" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
            <li className="suggest-h" role="presentation">{value.trim() ? t('Results') : t('Popular searches')}</li>
            {options.map((o, i) => (
              <li key={o.id} id={`${uid}-o${i}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onPointerDown={(e) => e.preventDefault()} onClick={() => choose(o)} onMouseEnter={() => setActive(i)}>
                <SearchIcon width={15} height={15} />
                <span>{o.label}</span>
                <span className="suggest-hint">{o.hint} <ArrowIcon width={12} height={12} /></span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
