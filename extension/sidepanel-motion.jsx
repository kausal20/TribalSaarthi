import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';

// Motion policy: with "reduce motion" on (Windows "Animation effects" off) we keep short opacity fades only,
// never slides, scales or loops. Otherwise elements rise and settle with an ease-out curve.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = [0.22, 1, 0.36, 1];
const clean = (el) => () => { el.style.transform = ''; el.style.opacity = ''; };

function enter(el, { delay = 0, y = 10 } = {}) {
  if (!el || !el.isConnected) return null;
  if (reduced()) return animate(el, { opacity: [0, 1] }, { duration: 0.22, delay, onComplete: clean(el) });
  return animate(el, { opacity: [0, 1], y: [y, 0], scale: [0.985, 1] }, { duration: 0.38, delay, ease: EASE, onComplete: clean(el) });
}

function Thinking() {
  const reduce = useReducedMotion();
  const labels = ['Waiting for the guide’s response', 'Still working on your question', 'Your answer will appear here'];
  const [label, setLabel] = useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setLabel((value) => (value + 1) % labels.length), 1900);
    return () => window.clearInterval(timer);
  }, [reduce]);
  return <motion.div className="thinking" role="status" aria-live="polite" initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.15 : 0.25 }}>
    <span className="thinking-mark" aria-hidden="true"><motion.i animate={reduce ? undefined : { scale: [1, 1.24, 1], opacity: [0.65, 1, 0.65] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }} /></span>
    <span className="thinking-copy"><strong>Working through your question</strong><small>{labels[label]}</small></span>
    <span className="thinking-dots" aria-hidden="true">{[0, 1, 2].map((i) => <motion.i key={i} animate={reduce ? undefined : { y: [0, -3, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.8, delay: i * 0.12, repeat: Infinity, ease: 'easeInOut' }} />)}</span>
  </motion.div>;
}

// ---------- "how the guide is working" steps, shown live and then folded into one line ----------
function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(fn) { state = fn(state); subs.forEach((s) => s(state)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

function StepIcon({ state }) {
  const reduce = useReducedMotion();
  if (state === 'run') return <motion.span className="proc-ic run" aria-hidden="true" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} />;
  if (state === 'ok') {
    return (
      <span className="proc-ic ok" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="m5 12.5 4.5 4.5L19 7.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
        </svg>
      </span>
    );
  }
  if (state === 'fail') return <span className="proc-ic fail" aria-hidden="true">!</span>;
  return <span className="proc-ic skip" aria-hidden="true" />;
}

function Steps({ steps, reduce }) {
  return (
    <ol className="proc-steps">
      <AnimatePresence initial={false}>
        {steps.map((s) => (
          <motion.li
            key={s.key}
            className={`proc-step ${s.state}`}
            layout={reduce ? false : 'position'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <StepIcon state={s.state} />
            <span className="proc-tx"><span>{s.label}</span>{s.detail && <small>{s.detail}</small>}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function Process({ store }) {
  const reduce = useReducedMotion();
  const [s, setS] = useState(store.get());
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => store.subscribe(setS), [store]);
  useEffect(() => {
    if (s.collapsed) return undefined;
    const t = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(t);
  }, [s.collapsed]);
  const secs = (((s.ended || now) - s.started) / 1000).toFixed(1);

  if (s.collapsed) {
    return (
      <div className="proc done">
        <button type="button" className="proc-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="proc-ic ok small" aria-hidden="true">✓</span>
          <span>{s.summary || `Worked for ${secs}s · ${s.steps.length} steps`}</span>
          <motion.span className="proc-chev" aria-hidden="true" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>›</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div className="proc-fold" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0.12 : 0.25 }}>
              <Steps steps={s.steps} reduce={reduce} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  return (
    <motion.div className="proc" role="status" aria-live="polite" initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="proc-head">
        <span className="proc-orb" aria-hidden="true"><motion.i animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} /></span>
        <span className="proc-title">{s.title}</span>
        <span className="proc-time">{secs}s</span>
      </div>
      <Steps steps={s.steps} reduce={reduce} />
    </motion.div>
  );
}

/** Streams text in word by word with a caret (also with reduced motion: nothing moves, the words just appear). */
function typeText(el, text, { onProgress } = {}) {
  return new Promise((resolve) => {
    const words = String(text).split(/(\s+)/);
    const step = Math.max(1, Math.ceil(words.length / 110));
    const node = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'type-caret';
    caret.setAttribute('aria-hidden', 'true');
    // Screen readers get the whole answer once instead of every partial word.
    const full = document.createElement('span');
    full.className = 'sr';
    full.textContent = text;
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    shown.append(node, caret);
    el.replaceChildren(full, shown);
    let i = 0;
    const tick = () => {
      i = Math.min(words.length, i + step);
      node.data = words.slice(0, i).join('');
      onProgress?.();
      if (i < words.length) window.setTimeout(tick, reduced() ? 8 : 16);
      else {
        el.replaceChildren(document.createTextNode(text));
        resolve();
      }
    };
    tick();
  });
}

// Anything added to these containers animates in by itself, so the panel code does not need to call motion.
const WATCHED = ['log', 'quick', 'docs', 'slots', 'issues'];
function watchLists() {
  const seen = new WeakSet();
  const observer = new MutationObserver((records) => {
    let index = 0;
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1 || seen.has(node) || node.classList.contains('working')) continue;
        seen.add(node);
        enter(node, { delay: Math.min(index++, 6) * 0.05, y: 12 });
      }
    }
  });
  for (const id of WATCHED) { const target = document.getElementById(id); if (target) observer.observe(target, { childList: true }); }
}

function watchDialogs() {
  for (const dialog of document.querySelectorAll('dialog')) {
    new MutationObserver(() => { if (dialog.open) enter(dialog, { y: 14 }); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
}

// Buttons dip slightly while pressed and spring back.
function watchPresses() {
  const SELECTOR = 'button:not(:disabled), .document-picker';
  let pressed = null;
  const release = () => {
    if (!pressed) return;
    const el = pressed; pressed = null;
    animate(el, { scale: 1 }, { type: 'spring', stiffness: 520, damping: 22, onComplete: () => { el.style.transform = ''; } });
  };
  document.addEventListener('pointerdown', (event) => {
    if (reduced()) return;
    const el = event.target.closest?.(SELECTOR);
    if (!el || el.matches('.thinking *')) return;
    pressed = el;
    animate(el, { scale: 0.95 }, { duration: 0.09, ease: 'easeOut' });
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) document.addEventListener(type, release, true);
}

function intro() {
  const welcome = document.getElementById('welcome');
  if (welcome) [...welcome.children].forEach((child, i) => enter(child, { delay: 0.08 + i * 0.09, y: 16 }));
  const head = document.querySelector('.head');
  if (head) enter(head, { y: -8 });
  const composer = document.getElementById('composer');
  if (composer) enter(composer, { delay: 0.3, y: 14 });
}

window.TribalMotion = {
  setListening(element, enabled) {
    if (enabled && !reduced()) {
      return animate(element, { scale: [1, 1.08, 1] }, { duration: 0.9, repeat: Infinity, ease: 'easeInOut' });
    }
    return { stop() {} };
  },
  reveal(element) {
    enter(element, { y: 8 });
    if (element?.classList?.contains('tool-menu')) {
      [...element.querySelectorAll('.tool-option')].forEach((option, i) => enter(option, { delay: 0.05 + i * 0.05, y: 6 }));
    }
  },
  mountThinking(container) {
    const root = createRoot(container);
    root.render(<Thinking />);
    return () => root.unmount();
  },
  /** Live list of what the guide is doing. Returns controls: step / done / fail / title / collapse. */
  mountProcess(container, { title = 'Working on it' } = {}) {
    const store = createStore({ title, steps: [], collapsed: false, summary: '', started: performance.now(), ended: 0 });
    const root = createRoot(container);
    root.render(<Process store={store} />);
    const update = (key, patch) => store.set((s) => ({ ...s, steps: s.steps.map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
    return {
      step(key, label, detail = '') { store.set((s) => ({ ...s, steps: [...s.steps.filter((x) => x.key !== key), { key, label, detail, state: 'run' }] })); },
      done(key, detail) { update(key, detail == null ? { state: 'ok' } : { state: 'ok', detail }); },
      fail(key, detail) { update(key, detail == null ? { state: 'fail' } : { state: 'fail', detail }); },
      title(t) { store.set((s) => ({ ...s, title: t })); },
      collapse(summary) {
        store.set((s) => {
          const ended = performance.now();
          const secs = ((ended - s.started) / 1000).toFixed(1);
          return { ...s, steps: s.steps.map((x) => (x.state === 'run' ? { ...x, state: 'ok' } : x)), collapsed: true, ended, summary: summary || `Worked for ${secs}s · ${s.steps.length} step${s.steps.length === 1 ? '' : 's'}` };
        });
      },
    };
  },
  typeText,
};

const start = () => { watchLists(); watchDialogs(); watchPresses(); intro(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
