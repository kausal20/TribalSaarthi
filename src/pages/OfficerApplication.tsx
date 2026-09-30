import { useState } from 'react';
import type { Application } from '../types';
import { evaluate } from '../engine/evaluator';
import { FOLLOWUP_OPTIONS, markDocumentReviewed, markReadyForSelectionReview, recordFollowup, requestCorrection, startReview } from '../engine/workflow';
import { report, updateApp } from '../store';
import { CheckList, EvidencePreview, StatusBadge, Timeline, fmt } from '../components/shared';

export function OfficerApplication({ app }: { app: Application }) {
  const [reason, setReason] = useState('');
  const [readyReason, setReadyReason] = useState('');
  const [followup, setFollowup] = useState(FOLLOWUP_OPTIONS[0]);
  const [followNote, setFollowNote] = useState('');
  const results = evaluate(app.schemeSnapshot, app);
  const s = app.status;

  return (
    <div className="two-col officer">
      <div className="stack">
        <section className="card">
          <div className="row between wrap">
            <div>
              <h2>Review: {app.applicantName}</h2>
              <p className="mono">
                ID: <strong>{app.id}</strong>
              </p>
            </div>
            <StatusBadge status={s} />
          </div>
          <p>{app.schemeSnapshot.name} — v{app.schemeVersion} (snapshot taken at creation)</p>
          <p className="demo-tag">{app.schemeSnapshot.demoDisclaimer}</p>
          <p className="muted small">Created {fmt(app.createdAt)} · updated {fmt(app.updatedAt)}</p>
        </section>

        <section className="card">
          <h3>Applicant-supplied fields</h3>
          <p className="muted small">Field supplied ≠ verified. These values are self-declared demo text.</p>
          <dl className="dl">
            {app.schemeSnapshot.fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{app.studentFields[f.key] || <em className="muted">empty</em>}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card">
          <h3>Original evidence</h3>
          <p className="muted small">Attached documents are shown exactly as uploaded. “Reviewed” records a human look, not proof of authenticity.</p>
          {app.schemeSnapshot.requiredDocuments.map((def) => {
            const d = app.documents.find((x) => x.key === def.key);
            return (
              <div key={def.key} className="doc">
                <div className="row between wrap">
                  <strong>{def.label}</strong>
                  <span className="mono small">DOC_{def.key}</span>
                </div>
                {!d ? (
                  <p className="err">⚠ Missing — nothing attached.</p>
                ) : (
                  <>
                    <p className="small">
                      {d.name} · {d.mime} · {(d.size / 1000).toFixed(1)} KB · attached {fmt(d.attachedAt)}
                    </p>
                    <p>
                      <span className={`badge ${d.verification === 'HUMAN_REVIEWED' ? 'doc-human_reviewed' : 'doc-present_unverified'}`}>
                        {d.verification === 'HUMAN_REVIEWED' ? '✔ Officer-reviewed' : '📎 Attached — authenticity not verified'}
                      </span>
                    </p>
                    <EvidencePreview doc={d} />
                    {s === 'UNDER_REVIEW' && d.verification !== 'HUMAN_REVIEWED' && (
                      <button type="button" className="btn secondary" onClick={() => report(updateApp(app.id, (a) => markDocumentReviewed(a, def.key)), 'Marked as reviewed by a human.')}>
                        I reviewed this original file
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>

        <CheckList results={results} audience="officer" />

        <section className="card" aria-labelledby="act-h">
          <h3 id="act-h">Officer actions</h3>
          <p className="muted small">No automatic decision exists. Only a person on this screen moves the case, and every move needs your click.</p>
          {(s === 'SUBMITTED' || s === 'RESUBMITTED') && (
            <button type="button" className="btn primary" onClick={() => report(updateApp(app.id, startReview), 'Review started.')}>
              Start review
            </button>
          )}
          {(s === 'SUBMITTED' || s === 'RESUBMITTED' || s === 'UNDER_REVIEW') && (
            <div className="field">
              <label htmlFor="reason">Request correction — reason shown to the applicant (required)</label>
              <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The enrolment proof is cropped; please attach the full page." />
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  if (report(updateApp(app.id, (a) => requestCorrection(a, reason)), 'Correction requested. The applicant will see your reason.')) setReason('');
                }}
              >
                Request correction
              </button>
            </div>
          )}
          {s === 'UNDER_REVIEW' && (
            <div className="field">
              <label htmlFor="ready">Reason for moving to selection review (required)</label>
              <textarea id="ready" rows={2} value={readyReason} onChange={(e) => setReadyReason(e.target.value)} />
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  if (report(updateApp(app.id, (a) => markReadyForSelectionReview(a, readyReason)), 'Marked ready for selection review (not an award).')) setReadyReason('');
                }}
              >
                Mark ready for selection review
              </button>
              <p className="muted small">Requires every required field filled and every attached required document marked as reviewed by you.</p>
            </div>
          )}
          {s === 'NEEDS_CORRECTION' && <p className="callout info-callout">Waiting for the applicant to respond.</p>}
          {s === 'DRAFT' && <p className="callout info-callout">Still a draft; not yet in the queue.</p>}
          {s === 'READY_FOR_SELECTION_REVIEW' && (
            <div className="field">
              <label htmlFor="fu">Record a <em>simulated</em> follow-up event</label>
              <select id="fu" value={followup} onChange={(e) => setFollowup(e.target.value)}>
                {FOLLOWUP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
              <label htmlFor="fun">Note (optional)</label>
              <input id="fun" value={followNote} onChange={(e) => setFollowNote(e.target.value)} />
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  if (report(updateApp(app.id, (a) => recordFollowup(a, followup, followNote)), 'Simulated follow-up recorded. Not an award or payment.')) setFollowNote('');
                }}
              >
                Record simulated follow-up
              </button>
              <p className="muted small">Event only. Does not change status and is not an award, selection or payment.</p>
            </div>
          )}
        </section>
      </div>
      <div className="stack">
        <Timeline events={app.events} />
      </div>
    </div>
  );
}
