import { motion } from 'framer-motion';
import type { Opportunity } from '../catalogue/types';
import { LEVEL_LABEL } from '../catalogue/filters';
import { ArrowIcon, SparkleIcon } from './icons';

/** Primary CTA: sparkle spins, arrow nudges on hover/focus. */
export function AIGuideButton({ href, label = 'Try guided demo', full }: { href: string; label?: string; full?: boolean }) {
  return (
    <motion.a href={href} className={`btn-ai ${full ? 'btn-ai-full' : ''}`} initial="rest" whileHover="hover" whileFocus="hover" whileTap={{ scale: 0.98 }}>
      <motion.span variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: 90, scale: 1.2 } }} transition={{ type: 'spring', stiffness: 300, damping: 14 }} className="btn-ai-ic">
        <SparkleIcon width={16} height={16} />
      </motion.span>
      {label}
      <motion.span variants={{ rest: { x: 0 }, hover: { x: 4 } }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="btn-ai-ar">
        <ArrowIcon width={16} height={16} />
      </motion.span>
    </motion.a>
  );
}

export function ScholarshipCard({ o, index = 0 }: { o: Opportunity; index?: number }) {
  const open = o.status === 'Open in demo';
  return (
    <motion.article
      className="s-card"
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
    >
      <div className="s-top">
        <div className="s-identity"><span className="s-category">{o.category}<small>{o.location === 'Overseas' ? 'Study abroad' : 'For eligible students'}</small></span></div>
        {o.official
          ? <span className="tag tag-official" title={`Facts from ${o.official.sourceTitle}, checked ${o.official.checkedOn}`}>Official scheme</span>
          : <span className="tag tag-demo" title="Practice example with fictional details">Practice example</span>}
      </div>
      <h3><a href={`#/opportunity/${o.id}`}>{o.title}</a></h3>
      <p className="s-line">{o.tagline}</p>
      <dl className="s-meta">
        <div><dt>Level</dt><dd>{LEVEL_LABEL[o.level]}</dd></div>
        <div><dt>Location</dt><dd>{o.location}</dd></div>
        <div><dt>Deadline</dt><dd>{o.deadline.set ? o.deadline.text.replace(' (illustrative)', '') : 'See official notice'}{o.deadline.set && <em> illustrative</em>}</dd></div>
      </dl>
      <p className="s-elig">{o.official ? `${o.official.benefits[0]}` : 'Eligibility: verify on provider portal'}</p>
      <div className="s-readiness" aria-label="Demo readiness guide"><div className="s-readiness-head"><span>Ready to explore</span><strong>{open ? '2 of 4 steps' : '1 of 4 steps'}</strong></div><div className="s-readiness-track"><span style={{ width: open ? '50%' : '25%' }} /></div></div>
      <div className="s-actions">
        <a className="btn-solid" href={`#/opportunity/${o.id}`}>View scholarship <ArrowIcon width={15} height={15} /></a>
        {open ? <a className="btn-quiet" href={`#/guide/${o.id}/overview`}>{o.official ? 'Ask the guide' : 'Try guided demo'}</a> : <span className="tag">Guide coming soon</span>}
      </div>
    </motion.article>
  );
}
