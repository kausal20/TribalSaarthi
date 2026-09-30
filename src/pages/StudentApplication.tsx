import { useMemo, useRef, useState } from 'react';
import type { Application, DocDef } from '../types';
import { evaluate } from '../engine/evaluator';
import { acceptedLabel } from '../engine/evaluator';
import { EDITABLE } from '../engine/workflow';
import { attachDocument, removeDocument, saveDraft, submit } from '../engine/workflow';
import { bytesToDataUrl, makeSamplePdf, sanitizeFilename, sniffMatches, validateFile } from '../engine/files';
import { currentSchemes } from '../engine/storage';
import { report, updateApp, useDemoState } from '../store';
import { Assistant, CheckList, FormFields, Progress, StatusBadge, Timeline, fmt } from '../components/shared';

export async function sampleFileFor(def: Pick<DocDef, 'key' | 'label' | 'acceptedTypes'>): Promise<File> {
  const label = `${def.label} (${def.key})`;
  if (def.acceptedTypes.includes('application/pdf')) {
    return new File([makeSamplePdf(label) as BlobPart], `sample_${def.key}.pdf`, { type: 'application/pdf' });
  }
  const c = document.createElement('canvas');
  c.width = 420;
  c.height = 200;
  const g = c.getContext('2d')!;
  g.fillStyle = '#F8FAF8';
  g.fillRect(0, 0, 420, 200);
  g.fillStyle = '#14243A';
  g.font = '18px sans-serif';
  g.fillText('SAMPLE - FICTIONAL DOCUMENT', 20, 70);
  g.fillText(label.slice(0, 40), 20, 110);
  g.fillText('No real person. Not verified.', 20, 150);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
  return new File([blob], `sample_${def.key}.png`, { type: 'image/png' });
}

export function StudentApplication({ app }: { app: Application }) {
  const state = useDemoState();
  const [values, setValues] = useState<Record<string, string>>(app.studentFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);

  const editable = EDITABLE.includes(app.status);
  const live = useMemo(() => evaluate(app.schemeSnapshot, { studentFields: values, documents: app.documents }), [app, values]);
  const latest = currentSchemes(state).find((s) => s.id === app.schemeId);
  const newerExists = latest && latest.version > app.schemeVersion;
  const lastCorrection = [...app.events].reverse().find((e) => e.type === 'CORRECTION_REQUESTED');
  const needsAction = app.status === 'NEEDS_CORRECTION';
  const isResubmit = app.status !== 'DRAFT';

  const setField = (k: string, v: string) => {
    setValues((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  async function attach(def: DocDef, file: File) {
    setDocErrors((e) => ({ ...e, [def.key]: '' }));
    const others = app.documents.filter((d) => d.key !== def.key).reduce((n, d) => n + d.size, 0);
    const v = validateFile({ name: file.name, type: file.type, size: file.size }, def.acceptedTypes, others);
    if (!v.ok) {
      setDocErrors((e) => ({ ...e, [def.key]: v.error }));
      report(v, '');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!sniffMatches(bytes, file.type)) {
      const msg = `"${sanitizeFilename(file.name)}" looks corrupt or is not really a ${acceptedLabel([file.type])} file. Please choose a valid file.`;
      setDocErrors((e) => ({ ...e, [def.key]: msg }));
      report({ ok: false, error: msg }, '');
      return;
    }
    const r = updateApp(app.id, (a) =>
      attachDocument(a, { key: def.key, name: sanitizeFilename(file.name), mime: file.type, size: file.size, dataUrl: bytesToDataUrl(bytes, file.type) }),
    );
    if (!r.ok) setDocErrors((e) => ({ ...e, [def.key]: r.error }));
    report(r, `Attached "${sanitizeFilename(file.name)}". Saved in this browser; authenticity not verified.`);
  }

  function doSubmit() {
    const gaps = live.filter((r) => r.kind === 'FIELD' && r.severity === 'MISSING');
    if (gaps.length) {
      const errs: Record<string, string> = {};
      gaps.forEach((g) => (errs[g.key] = g.explanation));
      setErrors(errs);
      setSummary(gaps.map((g) => g.explanation));
      setTimeout(() => summaryRef.current?.focus(), 0);
      report({ ok: false, error: 'Please fix the highlighted fields before submitting.' }, '');
      return;
    }
    setSummary([]);
    const r = updateApp(app.id, (a) => submit(a, values, note));
    if (r.ok) setNote('');
    report(r, isResubmit ? 'Resubmitted. Same application ID; history kept.' : 'Submitted. Any missing documents are listed below.');
  }

  return (
    <div className="two-col">
      <div className="stack">
        <section className="card">
          <div className="row between wrap">
            <div>
              <h2>Your application</h2>
              <p className="mono">
                ID: <strong>{app.id}</strong>
              </p>
            </div>
            <StatusBadge status={app.status} />
          </div>
          <p>{app.schemeSnapshot.name} — v{app.schemeVersion}</p>
          <p className="demo-tag">{app.schemeSnapshot.demoDisclaimer}</p>
          {newerExists && (
            <p className="callout info-callout">
              This application is checked under the rules that applied when it was created (v{app.schemeVersion}). A newer configuration (v{latest!.version}) exists and applies only to new applications.
            </p>
          )}
          {needsAction && lastCorrection && (
            <div className="callout action-callout" role="alert">
              <strong>Officer asked for a correction</strong> ({fmt(lastCorrection.timestamp)}):
              <blockquote>{lastCorrection.message}</blockquote>
              Update your details or documents below, add an optional note, then resubmit.
            </div>
          )}
          {app.status === 'READY_FOR_SELECTION_REVIEW' && (
            <p className="callout ok-callout">An officer has marked this application ready for selection review. This is not an award; selection decisions are outside this prototype.</p>
          )}
          {!editable && app.status !== 'READY_FOR_SELECTION_REVIEW' && (
            <p className="callout info-callout">Locked while an officer handles it. You will see any correction request here.</p>
          )}
          <Progress results={live} />
        </section>

        <section className="card" aria-labelledby="form-h">
          <h3 id="form-h">Details</h3>
          {summary.length > 0 && (
            <div ref={summaryRef} tabIndex={-1} className="error-summary" role="alert">
              <strong>Please fix {summary.length} problem{summary.length > 1 ? 's' : ''}:</strong>
              <ul>{summary.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          <FormFields fields={app.schemeSnapshot.fields} values={values} onChange={setField} errors={errors} disabled={!editable} />
        </section>

        <section className="card" aria-labelledby="docs-h">
          <h3 id="docs-h">Documents</h3>
          <p className="muted small">Accepted: PDF, PNG, JPG (as configured per document), max 1 MB each, 3 MB total. Use fictional sample files only.</p>
          <ul className="docs">
            {app.schemeSnapshot.requiredDocuments.map((def) => {
              const d = app.documents.find((x) => x.key === def.key);
              const res = live.find((r) => r.ruleId === `DOC_${def.key}`)!;
              return (
                <li key={def.key} className="doc">
                  <div className="row between wrap">
                    <strong>{def.label}</strong>
                    <span className={`badge doc-${res.state}`}>
                      {res.state === 'missing' && '⚠ Missing'}
                      {res.state === 'wrong_type' && '⚠ Wrong type'}
                      {res.state === 'present_unverified' && '📎 Attached — authenticity not verified'}
                      {res.state === 'human_reviewed' && '✔ Officer-reviewed'}
                    </span>
                  </div>
                  <div className="muted small">{acceptedLabel(def.acceptedTypes)} · <span className="mono">{`DOC_${def.key}`}</span></div>
                  {d && <div className="small">File: {d.name} · {(d.size / 1000).toFixed(1)} KB · attached {fmt(d.attachedAt)}</div>}
                  {editable && (
                    <div className="row wrap gap">
                      <label className="btn secondary file-btn">
                        {d ? 'Replace file' : 'Choose file'}
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void attach(def, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button type="button" className="btn secondary" onClick={async () => void attach(def, await sampleFileFor(def))}>
                        Attach fictional sample
                      </button>
                      {d && (
                        <button type="button" className="btn ghost" onClick={() => report(updateApp(app.id, (a) => removeDocument(a, def.key)), 'Attachment removed.')}>
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                  {docErrors[def.key] && <div className="err" role="alert">⚠ {docErrors[def.key]}</div>}
                </li>
              );
            })}
          </ul>
          {editable && (
            <details className="helpers">
              <summary>Demo helpers: try bad files</summary>
              <p className="muted small">Attach a deliberately bad file to see the guardrails.</p>
              <div className="row wrap gap">
                {app.schemeSnapshot.requiredDocuments.slice(0, 1).map((def) => (
                  <span key={def.key} className="row wrap gap">
                    <button type="button" className="btn secondary" onClick={() => void attach(def, new File(['hello'], 'notes.txt', { type: 'text/plain' }))}>
                      Wrong type (.txt)
                    </button>
                    <button type="button" className="btn secondary" onClick={() => void attach(def, new File([new Uint8Array(1_200_000)], 'huge.pdf', { type: 'application/pdf' }))}>
                      Oversized (1.2 MB)
                    </button>
                    <button type="button" className="btn secondary" onClick={() => void attach(def, new File(['this is not a real pdf'], 'fake.pdf', { type: 'application/pdf' }))}>
                      Corrupt (fake .pdf)
                    </button>
                    <button type="button" className="btn secondary" onClick={() => void attach(def, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))}>
                      SVG (blocked)
                    </button>
                  </span>
                ))}
              </div>
            </details>
          )}
        </section>

        <CheckList results={live} audience="student" />

        {editable && (
          <section className="card">
            {isResubmit && (
              <div className="field">
                <label htmlFor="note">Note to officer (optional)</label>
                <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            )}
            <div className="row wrap gap">
              {app.status === 'DRAFT' && (
                <button type="button" className="btn secondary" onClick={() => report(updateApp(app.id, (a) => saveDraft(a, values)), 'Draft saved in this browser.')}>
                  Save draft
                </button>
              )}
              <button type="button" className="btn primary" onClick={doSubmit}>
                {isResubmit ? 'Upload and resubmit' : 'Review & submit'}
              </button>
            </div>
            <p className="muted small">Submitting with missing documents is allowed so you can see exactly what is needed; empty required fields block submission.</p>
          </section>
        )}
        <Timeline events={app.events} />
      </div>
      <div className="stack sticky">
        <Assistant scheme={app.schemeSnapshot} app={{ ...app, studentFields: values }} />
      </div>
    </div>
  );
}
