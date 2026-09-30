import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { go } from '../router';
import { buildCatalogueContext } from '../catalogue/aiGuide';
import { ArrowIcon, SparkleIcon } from './icons';

type Message = { id: number; role: 'assistant' | 'user'; text: string };
const KEY = 'tribalsaarthi-comet-session';
const initial: Message[] = [{ id: 1, role: 'assistant', text: 'Hi, I’m your scholarship guide. I can point you to the right page, explain requirements, and help you prepare before you apply on the official portal.' }];

function navigateTo(path: string) { if (path.startsWith('/')) go(path); }
function scrollToElement(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('comet-focus-ring');
  window.setTimeout(() => el.classList.remove('comet-focus-ring'), 3000);
  return true;
}

export function CometAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [value, setValue] = useState('');
  const [working, setWorking] = useState(false);
  const nextId = useRef(2);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved?.messages?.length) setMessages(saved.messages);
      if (saved?.open) setOpen(true);
    } catch { /* A fresh session is a safe fallback. */ }
    (window as Window & { AIBrowserAgent?: unknown }).AIBrowserAgent = { navigateTo, scrollToElement };
    return () => { delete (window as Window & { AIBrowserAgent?: unknown }).AIBrowserAgent; };
  }, []);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ messages, open })); } catch { /* Continue without persistence. */ } }, [messages, open]);

  const ask = async (text: string) => {
    const prompt = text.trim(); if (!prompt || working) return;
    setValue(''); setMessages(prev => [...prev, { id: nextId.current++, role: 'user', text: prompt }]); setWorking(true);
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [...messages, { id: 0, role: 'user' as const, text: prompt }].map(m => ({ role: m.role, content: m.text })), catalogue: buildCatalogueContext() }) });
      if (response.ok) {
        const data = await response.json() as { text?: string; actions?: { type: string; urlPath?: string; selector?: string }[] };
        data.actions?.forEach(action => action.type === 'navigateTo' && action.urlPath ? navigateTo(action.urlPath) : action.type === 'scrollToElement' && action.selector ? scrollToElement(action.selector) : undefined);
        if (data.text) { setMessages(prev => [...prev, { id: nextId.current++, role: 'assistant', text: data.text! }]); setWorking(false); return; }
      }
    } catch { /* The local guide remains available when the API is not configured. */ }
    const lower = prompt.toLowerCase();
    window.setTimeout(() => {
      let answer = 'I can help you find a scholarship, explain a requirement, or take you to a section of this demo.';
      if (lower.includes('document')) answer = 'Start with the guided demo to review the document checklist before visiting the official provider portal.';
      else if (lower.includes('apply') || lower.includes('guide')) { navigateTo('/guide/nfst-demo/overview'); answer = 'Opening the guided research fellowship workspace. I’ll keep your conversation here while you explore.'; }
      else if (lower.includes('opportunit') || lower.includes('scholarship')) { scrollToElement('#opportunities'); answer = 'I’ve brought the scholarship catalogue into view so you can compare the demo opportunities.'; }
      setMessages(prev => [...prev, { id: nextId.current++, role: 'assistant', text: answer }]); setWorking(false);
    }, 650);
  };
  return <>
    <AnimatePresence>
      {!open && <motion.button className="comet-bubble" onClick={() => setOpen(true)} aria-label="Open scholarship guide" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}><span className="comet-orbit" /><SparkleIcon width={21} height={21} /></motion.button>}
      {open && <motion.aside className="comet-panel" aria-label="TribalSaarthi guide" initial={{ opacity: 0, y: 22, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 22, scale: 0.96 }} transition={{ type: 'spring', stiffness: 260, damping: 25 }}>
        <header className="comet-head"><div className="comet-mark"><SparkleIcon width={17} height={17} /></div><div><strong>Scholarship guide</strong><span><i /> Ready to help</span></div><button className="comet-close" onClick={() => setOpen(false)} aria-label="Minimise guide">×</button></header>
        <div className="comet-body" role="log" aria-live="polite">{messages.map(m => <motion.div key={m.id} className={`comet-message ${m.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{m.text}</motion.div>)}{working && <div className="comet-typing" aria-label="Guide is working"><i /><i /><i /></div>}</div>
        <div className="comet-suggestions"><button onClick={() => ask('What documents do I need?')}>Documents needed</button><button onClick={() => ask('Take me to the guide')}>Open the guide</button><button onClick={() => ask('Show scholarships')}>Show scholarships</button></div>
        <form className="comet-compose" onSubmit={e => { e.preventDefault(); void ask(value); }}><input value={value} onChange={e => setValue(e.target.value)} placeholder="Ask your guide anything" aria-label="Ask your guide" /><button type="submit" aria-label="Send question"><ArrowIcon width={16} height={16} /></button></form>
        <p className="comet-note">A guided demo. Verify details on the official provider website.</p>
      </motion.aside>}
    </AnimatePresence>
  </>;
}
