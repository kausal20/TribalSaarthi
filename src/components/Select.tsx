import { useEffect, useId, useRef, useState } from 'react';

export interface Option { value: string; label: string }

/** A drop-down in the site's own style (the browser's built-in list cannot be styled). Keyboard and screen-reader friendly. */
export function Select({ value, options, onChange, placeholder, label }: { value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const selected = options.findIndex((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => { setActive(Math.max(0, selected)); setOpen(true); };
  const choose = (i: number) => { onChange(options[i].value); setOpen(false); root.current?.querySelector('button')?.focus(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); return; }
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Home' || e.key === 'End') {
      if (open) { e.preventDefault(); setActive(e.key === 'Home' ? 0 : options.length - 1); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (open) { e.preventDefault(); choose(active); } else if (e.key === 'Enter') { e.preventDefault(); show(); }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // type-ahead: jump to the option that starts with what was typed
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 700 ? e.key : typed.current.text + e.key, at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text.toLowerCase()));
      if (hit >= 0) { if (!open) setOpen(true); setActive(hit); }
    }
  };

  return (
    <div className="sel" ref={root} onKeyDown={onKey}>
      <button
        type="button"
        className={`sel-btn ${selected < 0 ? 'is-empty' : ''}`}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-l`}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span>{selected >= 0 ? options[selected].label : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul id={`${id}-l`} ref={list} role="listbox" aria-label={label} className="sel-list">
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === selected}
              className={`${i === active ? 'is-active' : ''} ${i === selected ? 'is-selected' : ''}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.label}</span>
              {i === selected && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
