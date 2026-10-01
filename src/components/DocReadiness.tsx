import { useRef, useState } from 'react';
import { buildReadiness, type ReadinessKind } from '../../extension/lib/readiness.js';
import { checkFile, isSupportedName, ACCEPT } from '../companion/files';
import type { Opportunity } from '../catalogue/types';
import { useT } from '../i18n/i18n';
import { ExternalIcon } from './icons';

type Have = 'unknown' | 'have' | 'missing';
interface Row { have: Have; checked?: { name: string; check: 'passed' | 'warning' | 'failed'; notes: string[] } }

/**
 * "Rejection risk" for one scheme: the student ticks which documents they have and can run a basic check on a file
 * (on their own device; nothing is uploaded). The result is a checklist of what an officer would likely send back.
 */
export function DocReadiness({ opp }: { opp: Opportunity }) {
  const t = useT();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const target = useRef<string>('');
  const row = (key: string): Row => rows[key] ?? { have: 'unknown' };
  const patch = (key: string, p: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...row(key), ...p } }));

  const items: { kind: ReadinessKind; text: string }[] = [];
  let unanswered = 0;
  for (const d of opp.documents) {
    const r = row(d.key);
    if (r.have === 'unknown') { unanswered++; continue; }
    if (r.have === 'missing') items.push({ kind: 'missing-doc', text: d.label });
    else if (r.checked && r.checked.check !== 'passed') items.push({ kind: 'doc-problem', text: `${d.label}: ${r.checked.notes.join(' ') || t('the check found a problem')}` });
  }
  const result = buildReadiness(items);
  const answered = opp.documents.length - unanswered;
  const n = result.blocking || result.total;
  const headline = answered === 0
    ? t('Tell me which documents you have')
    : result.level === 'high' ? (n === 1 ? t('Fix 1 thing before you apply') : t('Fix {n} things before you apply', { n }))
      : result.level === 'medium' ? (n === 1 ? t('1 thing to double-check') : t('{n} things to double-check', { n }))
        : unanswered ? t('So far nothing is missing. {n} not answered yet.', { n: unanswered }) : t('Nothing obvious is missing');
  const level = answered === 0 ? 'none' : result.level;

  const choose = (key: string) => { target.current = key; picker.current?.click(); };
  const onFile = async (file: File | undefined) => {
    const key = target.current;
    if (!file || !key) return;
    if (!isSupportedName(file.name)) { patch(key, { have: 'have', checked: { name: file.name, check: 'failed', notes: [t('Only PDF, JPG or PNG files can be checked.')] } }); return; }
    setBusy(key);
    const meta = await checkFile(file, null);
    patch(key, { have: 'have', checked: { name: meta.name, check: meta.check, notes: meta.notes } });
    setBusy(null);
  };

  return (
    <div className="dr">
      <p className="dr-lead">{t('Tick what you have. You can also check a file; it is checked on your device and never uploaded.')}</p>
      <ul className="dr-list">
        {opp.documents.map((d) => {
          const r = row(d.key);
          return (
            <li key={d.key} className={`dr-row is-${r.have}`}>
              <div className="dr-name"><strong>{d.label}</strong>{r.checked && <small className={`dr-check ${r.checked.check}`}>{r.checked.name}: {r.checked.check === 'passed' ? t('looks fine on this device') : r.checked.notes.join(' ') || t('check found a problem')}</small>}</div>
              <div className="dr-btns" role="group" aria-label={d.label}>
                <button type="button" aria-pressed={r.have === 'have'} onClick={() => patch(d.key, { have: 'have' })}>{t('I have it')}</button>
                <button type="button" aria-pressed={r.have === 'missing'} onClick={() => patch(d.key, { have: 'missing', checked: undefined })}>{t('Not yet')}</button>
                <button type="button" className="dr-file" disabled={busy === d.key} onClick={() => choose(d.key)}>{busy === d.key ? t('Checking…') : t('Check a file')}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <input ref={picker} type="file" hidden accept={ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
      <div className={`dr-risk is-${level}`} role="status">
        <span className="dr-dot" aria-hidden="true" />
        <div>
          <strong>{headline}</strong>
          {result.groups.map((g) => (
            <div key={g.kind} className="dr-group"><span>{t(g.title)}</span><ul>{g.items.map((i) => <li key={i}>{i}</li>)}</ul></div>
          ))}
          <small>{t('This is a checklist, not a decision. Only the provider decides whether an application is accepted.')}</small>
        </div>
      </div>
      {opp.official && <a className="dr-go" href={opp.official.applyUrl} target="_blank" rel="noopener noreferrer">{t('Apply on the official website')} <ExternalIcon width={14} height={14} /></a>}
    </div>
  );
}
