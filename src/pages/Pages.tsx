import { useState } from 'react';
import type { Scheme, Status } from '../types';
import { acceptedLabel } from '../engine/evaluator';
import { computeAnalytics } from '../engine/analytics';
import { createApplication, OFFICER_STATUS_ORDER, PENDING_REVIEW, STATUS_LABEL } from '../engine/workflow';
import { currentSchemes, publishVersion, schemeHistory } from '../engine/storage';
import { addApp, mutate, PERSONAS, report, useDemoState, useUI } from '../store';
import { go } from '../router';
import { StatusBadge, fmt } from '../components/shared';
import { StudentApplication } from './StudentApplication';
import { OfficerApplication } from './OfficerApplication';

// ---------- Home ----------
export function Home() {
  const state = useDemoState();
  const { persona } = useUI();
  const p = PERSONAS[persona];
  const mine = p.applicantId ? state.applications.filter((a) => a.applicantId === p.applicantId) : [];
  return (
    <div className="stack">
      <section className="card hero">
        <h2>One configurable workflow, two illustrative schemes</h2>
        <p>
          SchemePath Demo shows how a single application form and a single deterministic checker can serve different scholarship configurations, with a person making every decision. Built for a national-screening prototype (SIH26239).
        </p>
        <div className="grid3">
          <div><h4>Working</h4><p className="small">Application form, document attach, rule checks, correction loop, timeline, officer queue, versioned scheme data, counts from real records.</p></div>
          <div><h4>Simulated</h4><p className="small">Role switch (no login), post-selection follow-up event, all applicants and documents.</p></div>
          <div><h4>Future scope</h4><p className="small">Authentication, secure storage, OCR, official integrations. Not built; subject to approvals.</p></div>
        </div>
        <p className="row wrap gap">
          {p.role === 'STUDENT' && <button className="btn primary" onClick={() => go('/apply')}>Start demo application</button>}
          {p.role === 'OFFICER' && <button className="btn primary" onClick={() => go('/officer')}>Open review queue</button>}
          {p.role === 'ADMIN' && <button className="btn primary" onClick={() => go('/schemes')}>Open scheme configuration</button>}
          <a className="btn secondary" href="https://tribal.nic.in/ScholarshiP.aspx" target="_blank" rel="noreferrer">Official scheme information ↗</a>
        </p>
        <p className="muted small">Scheme rules may change; always consult current official guidelines. Nothing here reflects an official Ministry system.</p>
      </section>
      {p.role === 'STUDENT' && (
        <section className="card">
          <h3>My applications ({p.name})</h3>
          {mine.length === 0 ? (
            <p className="muted">None yet. Start a demo application.</p>
          ) : (
            <ul className="list">
              {mine.map((a) => (
                <li key={a.id}>
                  <a href={`#/application/${a.id}`}><strong>{a.id}</strong> — {a.schemeSnapshot.name} v{a.schemeVersion}</a> <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ---------- Apply (scheme choice) ----------
export function Apply() {
  const state = useDemoState();
  const { persona } = useUI();
  const p = PERSONAS[persona];
  if (p.role !== 'STUDENT') return <div className="card"><p>Switch to a student persona (Demo role switch) to start an application.</p></div>;
  const start = (s: Scheme) => {
    const app = createApplication(s, p.applicantId!, p.name!);
    if (report(addApp(app), `Draft created with stable ID ${app.id}.`)) go(`/application/${app.id}`);
  };
  return (
    <div className="stack">
      <h2>Choose a scheme</h2>
      <p className="muted">Both cards use the same form component and checker. Differences come only from configuration data. Requirements are illustrative — consult current official guidelines.</p>
      <div className="grid2">
        {currentSchemes(state).map((s) => (
          <article key={s.id} className="card scheme-card">
            <h3>{s.name}</h3>
            <p className="demo-tag">{s.demoDisclaimer}</p>
            <p>{s.description}</p>
            <h4>Demo requirements (v{s.version})</h4>
            <ul>
              {s.requiredDocuments.map((d) => <li key={d.key}>{d.label} <span className="muted">({acceptedLabel(d.acceptedTypes)})</span></li>)}
            </ul>
            <button className="btn primary" onClick={() => start(s)}>Start demo application</button>
          </article>
        ))}
      </div>
    </div>
  );
}

// ---------- Application (routes to student or officer view) ----------
export function ApplicationPage({ id }: { id: string }) {
  const state = useDemoState();
  const { persona } = useUI();
  const p = PERSONAS[persona];
  const app = state.applications.find((a) => a.id === id);
  if (!app) return <div className="card"><h2>Application not found</h2><p>No application {id} in this browser's demo data (it may have been reset).</p><a href="#/">Home</a></div>;
  if (p.role === 'STUDENT') {
    if (app.applicantId !== p.applicantId) return <div className="card"><h2>Not available</h2><p>This application belongs to another demo applicant. Switch the demo role to view it.</p></div>;
    return <StudentApplication key={app.id} app={app} />;
  }
  if (p.role === 'ADMIN') return <div className="card"><p>Admins see aggregate counts only. Switch to Scrutiny officer to review cases.</p></div>;
  return <OfficerApplication key={app.id} app={app} />;
}

// ---------- Officer queue ----------
export function Officer() {
  const state = useDemoState();
  const { persona } = useUI();
  const [status, setStatus] = useState<Status | 'ALL'>('ALL');
  const [scheme, setScheme] = useState('ALL');
  if (PERSONAS[persona].role !== 'OFFICER') return <div className="card"><p>Switch to “Scrutiny officer (demo)” in the Demo role switch to see the queue.</p></div>;
  const list = state.applications
    .filter((a) => a.status !== 'DRAFT')
    .filter((a) => (status === 'ALL' ? true : a.status === status))
    .filter((a) => (scheme === 'ALL' ? true : a.schemeId === scheme))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="stack">
      <h2>Review queue</h2>
      <div className="row wrap gap">
        <div className="field inline"><label htmlFor="fs">Status</label>
          <select id="fs" value={status} onChange={(e) => setStatus(e.target.value as Status | 'ALL')}>
            <option value="ALL">All (excluding drafts)</option>
            {OFFICER_STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select></div>
        <div className="field inline"><label htmlFor="fc">Scheme</label>
          <select id="fc" value={scheme} onChange={(e) => setScheme(e.target.value)}>
            <option value="ALL">All</option>
            {currentSchemes(state).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
      </div>
      {list.length === 0 ? <p className="card muted">No submitted applications match. Submit one as a student first.</p> : (
        <div className="grid2">
          {list.map((a) => (
            <article key={a.id} className="card">
              <div className="row between wrap"><strong className="mono">{a.id}</strong><StatusBadge status={a.status} /></div>
              <p>{a.applicantName} — {a.schemeSnapshot.name} <span className="muted">v{a.schemeVersion}</span></p>
              <p className="muted small">Updated {fmt(a.updatedAt)}</p>
              <a className="btn primary" href={`#/application/${a.id}`}>Open for review</a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Schemes: compare + edit ----------
function Editor({ scheme, onDone }: { scheme: Scheme; onDone: () => void }) {
  const [draft, setDraft] = useState<Scheme>(structuredClone(scheme));
  const [newDoc, setNewDoc] = useState({ key: '', label: '' });
  const upd = (fn: (d: Scheme) => void) => setDraft((d) => { const c = structuredClone(d); fn(c); return c; });
  const publish = () => {
    let saved = false;
    const r = mutate((s) => {
      const p = publishVersion(s, draft);
      saved = p.ok;
      return p;
    });
    if (report(r, `Published as v${scheme.version + 1}. New applications use it; existing ones keep their snapshot.`) && saved) onDone();
  };
  const TYPES: [string, string][] = [['application/pdf', 'PDF'], ['image/png', 'PNG'], ['image/jpeg', 'JPG']];
  return (
    <div className="card editor">
      <h3>Edit → publish new version (v{scheme.version + 1})</h3>
      <p className="muted small">Publishing never edits old versions. Submitted applications keep the snapshot they were created with.</p>
      <div className="field"><label htmlFor="en">Scheme name</label><input id="en" value={draft.name} onChange={(e) => upd((d) => { d.name = e.target.value; })} /></div>
      <h4>Fields</h4>
      {draft.fields.map((f, i) => (
        <div key={f.key} className="row wrap gap edit-row">
          <span className="mono small">{f.key}</span>
          <input aria-label={`Label for ${f.key}`} value={f.label} onChange={(e) => upd((d) => { d.fields[i].label = e.target.value; })} />
          <label className="check-inline"><input type="checkbox" checked={f.required} onChange={(e) => upd((d) => { d.fields[i].required = e.target.checked; })} /> required</label>
        </div>
      ))}
      <h4>Required documents</h4>
      {draft.requiredDocuments.map((d, i) => (
        <div key={d.key} className="edit-doc">
          <div className="row wrap gap"><span className="mono small">DOC_{d.key}</span>
            <input aria-label={`Label for ${d.key}`} value={d.label} onChange={(e) => upd((x) => { x.requiredDocuments[i].label = e.target.value; })} />
            <button type="button" className="btn ghost" onClick={() => upd((x) => { x.requiredDocuments.splice(i, 1); })}>Remove requirement</button></div>
          <input aria-label={`Why we need ${d.key}`} value={d.why} onChange={(e) => upd((x) => { x.requiredDocuments[i].why = e.target.value; })} />
          <div className="row wrap gap">{TYPES.map(([m, l]) => (
            <label key={m} className="check-inline"><input type="checkbox" checked={d.acceptedTypes.includes(m)}
              onChange={(e) => upd((x) => { const a = x.requiredDocuments[i].acceptedTypes; x.requiredDocuments[i].acceptedTypes = e.target.checked ? [...a, m] : a.filter((t) => t !== m); })} /> {l}</label>
          ))}</div>
        </div>
      ))}
      <div className="row wrap gap">
        <input aria-label="New document key" placeholder="new_doc_key" value={newDoc.key} onChange={(e) => setNewDoc({ ...newDoc, key: e.target.value })} />
        <input aria-label="New document label" placeholder="Label" value={newDoc.label} onChange={(e) => setNewDoc({ ...newDoc, label: e.target.value })} />
        <button type="button" className="btn secondary" onClick={() => { upd((d) => { d.requiredDocuments.push({ key: newDoc.key.trim(), label: newDoc.label.trim(), acceptedTypes: ['application/pdf', 'image/png', 'image/jpeg'], why: 'Demo rule added by admin.' }); }); setNewDoc({ key: '', label: '' }); }}>Add required document</button>
      </div>
      <div className="row wrap gap"><button type="button" className="btn primary" onClick={publish}>Publish new version</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
    </div>
  );
}

export function Schemes() {
  const state = useDemoState();
  const { persona } = useUI();
  const [editing, setEditing] = useState<string | null>(null);
  const cur = currentSchemes(state);
  const canEdit = PERSONAS[persona].role === 'ADMIN';
  const allFields = [...new Set(cur.flatMap((s) => s.fields.map((f) => f.key)))];
  const allDocs = [...new Set(cur.flatMap((s) => s.requiredDocuments.map((d) => d.key)))];
  return (
    <div className="stack">
      <h2>Scheme configurations</h2>
      <p className="callout info-callout">ILLUSTRATIVE — consult current official guidelines. These demo rules are data, stored versioned in this browser.</p>
      <div className="card scroll-x">
        <h3>Side-by-side comparison (current versions)</h3>
        <table>
          <thead><tr><th>Item</th>{cur.map((s) => <th key={s.id}>{s.name}<br /><span className="muted">v{s.version}</span></th>)}</tr></thead>
          <tbody>
            {allFields.map((k) => (
              <tr key={k}><th scope="row">Field <span className="mono">FIELD_{k}</span></th>{cur.map((s) => { const f = s.fields.find((x) => x.key === k); return <td key={s.id}>{f ? `${f.label}${f.required ? ' (required)' : ' (optional)'}` : '—'}</td>; })}</tr>
            ))}
            {allDocs.map((k) => (
              <tr key={k}><th scope="row">Document <span className="mono">DOC_{k}</span></th>{cur.map((s) => { const d = s.requiredDocuments.find((x) => x.key === k); return <td key={s.id}>{d ? `${d.label} — ${acceptedLabel(d.acceptedTypes)}` : '—'}</td>; })}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {cur.map((s) => {
        const hist = schemeHistory(state, s.id);
        const onOld = state.applications.filter((a) => a.schemeId === s.id && a.schemeVersion < s.version).length;
        return (
          <div key={s.id} className="stack">
            <div className="card">
              <div className="row between wrap"><h3>{s.name}</h3>
                {canEdit ? <button className="btn secondary" onClick={() => setEditing(s.id)}>Edit / publish new version</button> : <span className="muted small">Switch to Scheme admin to edit</span>}</div>
              <p className="small">Version history: {hist.map((h) => `v${h.version} (${fmt(h.publishedAt)})`).join(' → ')}</p>
              <p className="small muted">{onOld} application(s) still on an older version and unaffected by later edits.</p>
            </div>
            {editing === s.id && canEdit && <Editor scheme={s} onDone={() => setEditing(null)} />}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Analytics ----------
export function Analytics() {
  const state = useDemoState();
  const a = computeAnalytics(state);
  return (
    <div className="stack">
      <h2>Demo analytics</h2>
      <p className="muted">Counts are computed live from the fictional applications stored in this browser. No national figures, no rates, no processing-time claims.</p>
      <div className="grid3">
        <div className="card stat"><div className="num">{a.total}</div>Applications in demo data</div>
        <div className="card stat"><div className="num">{a.pending}</div>Pending officer review</div>
        <div className="card stat"><div className="num">{a.followups}</div>Simulated follow-up events</div>
      </div>
      <div className="card scroll-x">
        <h3>Per scheme, by status</h3>
        {a.perScheme.length === 0 ? <p className="muted">No applications yet.</p> : (
          <table><thead><tr><th>Scheme</th>{OFFICER_STATUS_ORDER.concat('DRAFT').map((s) => <th key={s}>{STATUS_LABEL[s]}</th>)}<th>Total</th></tr></thead>
            <tbody>{a.perScheme.map((r) => <tr key={r.schemeId}><th scope="row">{r.name}</th>{OFFICER_STATUS_ORDER.concat('DRAFT').map((s) => <td key={s}>{r.counts[s] ?? 0}</td>)}<td>{r.total}</td></tr>)}</tbody></table>
        )}
      </div>
      <div className="card">
        <h3>Open deficiencies (submitted, not yet ready)</h3>
        {a.deficiencyCounts.length === 0 ? <p className="muted">None.</p> : (
          <ul className="list">{a.deficiencyCounts.map((d) => <li key={d.ruleId}><span className="mono">{d.ruleId}</span> — {d.count} application(s)</li>)}</ul>
        )}
        <p className="muted small">Pending review means status: {PENDING_REVIEW.map((s) => STATUS_LABEL[s]).join(', ')}.</p>
      </div>
    </div>
  );
}
