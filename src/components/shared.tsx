import { useEffect, useMemo, useState } from 'react';
import type { AppEvent, Application, CheckResult, DocDef, FieldDef, Scheme, Status } from '../types';
import { STATUS_LABEL } from '../engine/workflow';
import { completeness } from '../engine/evaluator';
import { dataUrlToBlobUrl } from '../engine/files';
import { ASSISTANT_LABEL, SUGGESTIONS, answer } from '../engine/assistant';

export const fmt = (iso: string) => new Date(iso).toLocaleString();

const STATUS_ICON: Record<Status, string> = {
  DRAFT: '✎',
  SUBMITTED: '➤',
  NEEDS_CORRECTION: '⚑',
  RESUBMITTED: '↻',
  UNDER_REVIEW: '👁',
  READY_FOR_SELECTION_REVIEW: '✔',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span> {STATUS_LABEL[status]}
    </span>
  );
}

export function Progress({ results }: { results: CheckResult[] }) {
  const { done, total } = completeness(results);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        Items complete under demo rules: {done} of {total}{' '}
        <span className="muted">(a UI convenience, not an eligibility score)</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Completeness">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STATE_TEXT: Record<CheckResult['state'], { icon: string; text: string; cls: string }> = {
  missing: { icon: '⚠', text: 'Missing', cls: 'missing' },
  wrong_type: { icon: '⚠', text: 'Wrong file type', cls: 'missing' },
  present_unverified: { icon: '📎', text: 'Attached — unverified (needs human review)', cls: 'review' },
  human_reviewed: { icon: '✔', text: 'Officer-reviewed', cls: 'ok' },
  field_supplied: { icon: '✓', text: 'Supplied (self-declared)', cls: 'ok' },
};

export function CheckList({ results, audience }: { results: CheckResult[]; audience: 'student' | 'officer' }) {
  const gaps = results.filter((r) => r.severity === 'MISSING');
  return (
    <section aria-labelledby="checks-h" className="card">
      <h3 id="checks-h">Rule results</h3>
      <p className="muted small">Same checker for every scheme. It checks completeness only — it does not verify documents or decide eligibility.</p>
      {gaps.length === 0 ? (
        <p className="callout ok-callout">Potentially complete under demo rules; pending officer verification.</p>
      ) : (
        <p className="callout action-callout">
          {audience === 'student' ? 'Needs your action: ' : 'Open items: '}
          {gaps.map((g) => g.label).join('; ')}
        </p>
      )}
      <ul className="checks">
        {results.map((r) => {
          const s = STATE_TEXT[r.state];
          return (
            <li key={r.ruleId} className={`check ${s.cls}`}>
              <div className="check-head">
                <span aria-hidden="true">{s.icon}</span> <strong>{r.label}</strong>
                <span className="rule-id">{r.ruleId}</span>
              </div>
              <div className="check-state">{s.text}</div>
              {r.severity !== 'INFO' && (
                <>
                  <div>{r.explanation}</div>
                  <div>
                    <strong>{r.severity === 'MISSING' ? 'What to do:' : 'Next:'}</strong> {r.remedy}
                  </div>
                </>
              )}
              {r.why && r.severity === 'MISSING' && (
                <div className="muted small">
                  <strong>Why we need this:</strong> {r.why}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const EVENT_LABEL: Record<AppEvent['actorRole'], string> = {
  STUDENT: 'Applicant',
  OFFICER: 'Officer',
  ADMIN: 'Admin',
  SYSTEM: 'Rule checker (automatic)',
};

export function Timeline({ events }: { events: AppEvent[] }) {
  return (
    <section aria-labelledby="tl-h" className="card">
      <h3 id="tl-h">Activity timeline</h3>
      <p className="muted small">Append-only in this prototype. Stored in this browser only.</p>
      <ol className="timeline">
        {[...events].reverse().map((e) => (
          <li key={e.id} className={`ev ev-${e.type}`}>
            <div className="ev-meta">
              <time dateTime={e.timestamp}>{fmt(e.timestamp)}</time> · {EVENT_LABEL[e.actorRole]}
              {e.ruleId && <span className="rule-id">{e.ruleId}</span>}
            </div>
            <div className="ev-type">{e.type.replace(/_/g, ' ').toLowerCase()}</div>
            <div className="ev-msg">{e.message}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FormFields({
  fields,
  values,
  onChange,
  errors,
  disabled,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <div className="fields">
      {fields.map((f) => {
        const id = `f-${f.key}`;
        const err = errors[f.key];
        const common = {
          id,
          disabled,
          value: values[f.key] ?? '',
          'aria-invalid': err ? true : undefined,
          'aria-describedby': err ? `${id}-err` : undefined,
          'aria-required': f.required || undefined,
        };
        return (
          <div key={f.key} className={`field ${err ? 'has-error' : ''}`}>
            <label htmlFor={id}>
              {f.label} {f.required && <span className="req">(required)</span>}
            </label>
            {f.type === 'select' ? (
              <select {...common} onChange={(e) => onChange(f.key, e.target.value)}>
                <option value="">Choose…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea {...common} rows={3} onChange={(e) => onChange(f.key, e.target.value)} />
            ) : (
              <input type="text" {...common} onChange={(e) => onChange(f.key, e.target.value)} />
            )}
            {err && (
              <div id={`${id}-err`} className="err" role="alert">
                ⚠ {err}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Renders the original attached file (image or PDF) from its stored data. */
export function EvidencePreview({ doc }: { doc: { name: string; mime: string; dataUrl: string } }) {
  const url = useMemo(() => {
    try {
      return dataUrlToBlobUrl(doc.dataUrl);
    } catch {
      return null;
    }
  }, [doc.dataUrl]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  if (!url) return <p className="err">⚠ Stored file could not be decoded.</p>;
  return doc.mime === 'application/pdf' ? (
    <iframe className="preview" src={url} title={`Preview of ${doc.name}`} />
  ) : (
    <img className="preview" src={url} alt={`Attached file ${doc.name}`} />
  );
}

export function Assistant({ scheme, app }: { scheme: Scheme; app?: Application }) {
  const [q, setQ] = useState('');
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    setLog((l) => [...l, { q: text, a: answer(text, scheme, app) }]);
    setQ('');
  };
  return (
    <aside className="card assistant" aria-labelledby="as-h">
      <h3 id="as-h">{ASSISTANT_LABEL}</h3>
      <p className="muted small">Guided demo assistant — not connected to external portals. Answers come only from the configured demo requirements.</p>
      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="as-log" aria-live="polite">
        {log.map((m, i) => (
          <div key={i}>
            <div className="as-q">You: {m.q}</div>
            <div className="as-a">{m.a}</div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="as-form"
      >
        <label htmlFor="as-in" className="sr-only">
          Ask about requirements
        </label>
        <input id="as-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about requirements…" />
        <button type="submit" className="btn secondary">
          Ask
        </button>
      </form>
    </aside>
  );
}

export function docDef(app: Application, key: string): DocDef | undefined {
  return app.schemeSnapshot.requiredDocuments.find((d) => d.key === key);
}
