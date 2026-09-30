import { motion } from 'framer-motion';
import type { Opportunity } from '../catalogue/types';
import type { Draft } from '../catalogue/drafts';
import { ArrowIcon } from './icons';

/** Progress = filled fields + confirmed uploads, out of all fields + documents. Derived from the local draft only. */
export function draftProgress(d: Draft, o: Opportunity): number {
  const total = o.fields.length + o.documents.length;
  const done = o.fields.filter((f) => (d.fields[f.key] ?? '').trim()).length + d.docs.filter((x) => x.confirmed).length;
  return d.submittedAt ? 100 : Math.round((done / total) * 100);
}

function status(d: Draft, o: Opportunity): { pill: string; tone: 'ok' | 'warn' | 'info'; next: string; to: string } {
  if (d.submittedAt) return { pill: 'Marked submitted (simulated)', tone: 'ok', next: 'Continue on the official website to apply for real', to: 'status' };
  const emptyF = o.fields.filter((f) => !(d.fields[f.key] ?? '').trim()).length;
  const attached = d.docs.length;
  const unconfirmed = d.docs.filter((x) => !x.confirmed).length;
  if (emptyF) return { pill: 'Form incomplete', tone: 'warn', next: `Fill ${emptyF} remaining field${emptyF > 1 ? 's' : ''}`, to: 'form' };
  if (attached < o.documents.length) return { pill: 'Documents required', tone: 'warn', next: `Attach ${o.documents.length - attached} document(s)`, to: 'documents' };
  if (unconfirmed) return { pill: 'Uploads to confirm', tone: 'info', next: 'Confirm your uploads', to: 'documents' };
  return { pill: 'Ready for your review', tone: 'ok', next: 'Review and submit (simulated)', to: 'form' };
}

export function ApplicationCard({ d, o }: { d: Draft; o: Opportunity }) {
  const pct = draftProgress(d, o);
  const s = status(d, o);
  return (
    <motion.li className="a-card" layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
      <div className="a-head">
        <h3>{o.title}</h3>
        <span className={`pillx pillx-${s.tone}`}>{s.pill}</span>
      </div>
      <div className="a-prog" aria-label={`Progress ${pct} percent`}>
        <div className="a-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <strong>{pct}%</strong>
      </div>
      <p className="a-next"><span>Next step</span> {s.next}</p>
      <div className="a-foot">
        <small>Fictional draft · updated {new Date(d.updatedAt).toLocaleString()}</small>
        <a className="btn-solid" href={`#/guide/${d.oppId}/${s.to}`}>Continue application <ArrowIcon width={15} height={15} /></a>
      </div>
    </motion.li>
  );
}
