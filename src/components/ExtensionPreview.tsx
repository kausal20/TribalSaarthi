import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Dialog } from './Dialogs';
import { useT } from '../i18n/i18n';

/** Scripted, illustrative walkthrough of the upcoming extension. Not a recording of a real student or portal. */
const STEPS = [
  { ask: 'Take me to All Schemes', reply: 'Opening “All Schemes” on the page.', glow: 'menu' },
  { ask: 'What documents does this page need?', reply: 'Income certificate, caste certificate and marksheet. Confirm the list on the portal.', glow: 'docs' },
  { ask: 'Check this form', reply: 'Fix 2 things before you apply: Full name is empty, Income certificate not selected.', glow: 'form' },
] as const;

export function ExtensionPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!open || !playing) return;
    const id = setTimeout(() => (i < STEPS.length - 1 ? setI(i + 1) : setPlaying(false)), 3200);
    return () => clearTimeout(id);
  }, [open, playing, i]);
  useEffect(() => { if (open) { setI(0); setPlaying(true); } }, [open]);
  const step = STEPS[i];
  return (
    <Dialog open={open} onClose={onClose} title={t('Extension preview')}>
      <p className="xp-note">{t('An illustration of how the guide will work beside the official portal. Not a recording.')}</p>
      <div className="xp">
        <div className="xp-portal" aria-hidden="true">
          <div className="xp-bar"><i /><i /><i /><span>mahadbt.maharashtra.gov.in</span></div>
          <div className="xp-nav">
            <span className={step.glow === 'menu' ? 'is-glow' : ''}>{t('All Schemes')}</span><span>{t('Profile')}</span>
          </div>
          <div className="xp-form">
            <div className={`xp-field ${step.glow === 'form' ? 'is-glow' : ''}`}><b /></div>
            <div className={`xp-field ${step.glow === 'docs' || step.glow === 'form' ? 'is-glow' : ''}`}><b className="w2" /></div>
            <div className="xp-field"><b className="w3" /></div>
          </div>
        </div>
        <div className="xp-panel" role="log" aria-live="polite">
          <AnimatePresence mode="popLayout">
            <motion.div key={`${i}-q`} className="xp-me" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{t(step.ask)}</motion.div>
            <motion.div key={`${i}-a`} className="xp-bot" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.9 }}>{t(step.reply)}</motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="xp-ctl">
        <div className="xp-dots" role="group" aria-label={t('Preview steps')}>
          {STEPS.map((_, n) => <button key={n} type="button" aria-label={`${n + 1}`} aria-current={n === i} onClick={() => { setI(n); setPlaying(false); }} />)}
        </div>
        <button type="button" className="btn-quiet" onClick={() => { setI(0); setPlaying(true); }}>↺ {t('Replay')}</button>
      </div>
    </Dialog>
  );
}
