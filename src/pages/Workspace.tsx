import { useEffect, useMemo, useRef, useState } from 'react';
import { GuideReply } from '../components/GuideReply';
import { SparkleIcon, ArrowIcon, BackIcon } from '../components/icons';
import { findOpportunity } from '../catalogue/data';
import { respond } from '../catalogue/assistant';
import { aiHealth, askAI, type AIHealth } from '../catalogue/aiGuide';
import type { OppDocument, Opportunity, SectionId } from '../catalogue/types';
import { attach, confirmDoc, draftLabel, emptyDraft, markSubmitted, removeDoc, setField, submitBlockers } from '../catalogue/drafts';
import { updateDraft, useDrafts } from '../catalogue/draftStore';
import { acceptedLabel } from '../engine/evaluator';
import { bytesToDataUrl, sanitizeFilename, sniffMatches, validateFile } from '../engine/files';
import { go } from '../router';
import { report } from '../store';
import { Dialog } from '../components/Dialogs';
import { sampleFileFor } from './StudentApplication';
import { NotFound } from './Detail';

interface Msg {
  id: number;
  who: 'guide' | 'you';
  text: string;
  source?: string;
  fieldKey?: string;
}

const QUICK: [string, string][] = [
  ['Documents needed', 'What documents do I need?'],
  ['Where to apply', 'Where do I apply?'],
  ['Check my progress', 'Check what I have completed'],
  ['Eligibility', 'Who is eligible?'],
];


function Assistant({ opp, msgs, onAsk, thinking, sectionTitle, onOpenApplication, ai }: { opp: Opportunity; msgs: Msg[]; onAsk: (t: string) => void; thinking: boolean; sectionTitle: string; onOpenApplication: () => void; ai?: AIHealth }) {
  const [q, setQ] = useState('');
  const started = msgs.length > 0;
  const logRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (started) document.getElementById('guide')?.scrollIntoView({ block: 'start' });
  }, [started]);
  useEffect(() => {
    const el = logRef.current;
    if (el && follow.current) el.scrollTo({ top: el.scrollHeight });
  }, [msgs.length, thinking]);
  const send = () => {
    if (!q.trim() || thinking) return;
    follow.current = true;
    onAsk(q.trim());
    setQ('');
    inputRef.current?.focus();
  };
  return (
    <aside id="guide" className={`guide centered-guide ${started ? 'conversation-started' : 'conversation-empty'}`} aria-label="TribalSaarthi chat guide">
      <div className="guide-inner">
        {!started && <header className="prompt-welcome"><span className="prompt-symbol"><SparkleIcon width={28} height={28} /></span><h2>What would you like<br />help with?</h2><p>Understand the requirements, prepare your documents,<br className="desktop-break" /> or get help with an application field.</p></header>}
        {started && <header className="conversation-heading"><h2>Your conversation</h2><button type="button" onClick={onOpenApplication}>View {sectionTitle.toLowerCase()} <ArrowIcon width={15} height={15} /></button></header>}
        <div className="chat" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation" tabIndex={0} onScroll={e => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
          {msgs.map((m) => <GuideReply key={m.id} text={m.text} source={m.source} who={m.who} />)}
          {thinking && <div className="bubble b-guide typing" role="status"><span /><span /><span /><span className="sr-only">Guide is preparing a reply</span></div>}
        </div>
        <form className="composer" noValidate onSubmit={e => { e.preventDefault(); send(); }}>
          <label htmlFor="ask">Ask your guide</label>
          <textarea ref={inputRef} id="ask" aria-label={`Ask your guide about ${opp.title}`} rows={2} value={q} onChange={e => setQ(e.target.value)} placeholder="What would you like help with?" autoComplete="off" aria-describedby="guide-input-help" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <div className="composer-bottom"><span id="guide-input-help">Enter to send · Shift + Enter for a new line</span><button type="submit" className="btn-solid" disabled={!q.trim() || thinking} aria-label="Send message"><ArrowIcon width={18} height={18} /><span>Send</span></button></div>
        </form>
        <div className="quick" role="group" aria-label="Suggested questions">
          {QUICK.map(([label, text]) => <button key={label} type="button" className="chip" disabled={thinking} onClick={() => { follow.current = true; onAsk(text); }}>{label}</button>)}
        </div>
        <p className={`guide-safety ai-${ai?.state ?? 'checking'}`} role="status">
          {!ai && 'Checking the AI guide… '}
          {ai?.state === 'on' && `Live AI guide (${ai.model}), limited to this scheme’s demo information. AI can make mistakes — verify on the official portal. `}
          {ai?.state === 'off' && `Live AI is off (${ai.reason}); showing built-in answers. `}
          Never share passwords or OTPs.
        </p>
      </div>
    </aside>
  );
}

function DocPanel({ opp }: { opp: Opportunity }) {
  const drafts = useDrafts();
  const draft = drafts[opp.id] ?? emptyDraft(opp.id);
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function add(def: OppDocument, file: File) {
    setErrs((e) => ({ ...e, [def.key]: '' }));
    const others = draft.docs.filter((d) => d.key !== def.key).reduce((n, d) => n + d.size, 0);
    const v = validateFile({ name: file.name, type: file.type, size: file.size }, def.acceptedTypes, others);
    const fail = (msg: string) => {
      setErrs((e) => ({ ...e, [def.key]: msg }));
      report({ ok: false, error: msg }, '');
    };
    if (!v.ok) return fail(v.error);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!sniffMatches(bytes, file.type)) return fail(`"${sanitizeFilename(file.name)}" looks corrupt or is not really a ${acceptedLabel([file.type])} file.`);
    const r = updateDraft(opp.id, (d) => attach(d, opp, { key: def.key, name: sanitizeFilename(file.name), mime: file.type, size: file.size, dataUrl: bytesToDataUrl(bytes, file.type) }));
    if (!r.ok) return fail(r.error);
    report(r, `Attached “${sanitizeFilename(file.name)}”. Not verified — confirm the upload on this page when ready.`);
  }

  return (
    <div className="stack">
      <p className="muted small">Accepted types are shown per document; max 1 MB each. Use fictional sample files only. Files stay in this browser.</p>
      {opp.documents.map((def) => {
        const d = draft.docs.find((x) => x.key === def.key);
        return (
          <div key={def.key} className="up">
            <div className="row between wrap gap">
              <strong>{def.label}</strong>
              <span className={`badge ${d ? (d.confirmed ? 'doc-human_reviewed' : 'doc-present_unverified') : 'doc-missing'}`}>
                {!d && 'Not attached'}
                {d && !d.confirmed && '📎 Attached — not verified'}
                {d && d.confirmed && '✔ Upload confirmed — not verified'}
              </span>
            </div>
            <div className="muted small">{acceptedLabel(def.acceptedTypes)} · {def.note}</div>
            {d && <div className="small">File: {d.name} · {(d.size / 1000).toFixed(1)} KB</div>}
            <div className="row wrap gap">
              <label className="btn-outline file-btn">
                {d ? 'Replace file' : 'Choose file'}
                <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void add(def, f); e.target.value = ''; }} />
              </label>
              <button type="button" className="btn-outline" onClick={async () => void add(def, await sampleFileFor(def))}>Use fictional sample file</button>
              {d && !d.confirmed && <button type="button" className="btn-solid" onClick={() => report(updateDraft(opp.id, (x) => confirmDoc(x, def.key)), 'Upload confirmed on the simulated portal (still not verified).')}>Confirm upload</button>}
              {d && <button type="button" className="btn-quiet" onClick={() => report(updateDraft(opp.id, (x) => removeDoc(x, def.key)), 'Attachment removed.')}>Remove</button>}
            </div>
            {errs[def.key] && <div className="err" role="alert">⚠ {errs[def.key]}</div>}
          </div>
        );
      })}
      <details className="helpers">
        <summary>Try bad files (demo)</summary>
        <div className="row wrap gap">
          {(() => {
            const def = opp.documents[0];
            return (
              <>
                <button type="button" className="btn-outline" onClick={() => void add(def, new File(['hello'], 'notes.txt', { type: 'text/plain' }))}>Wrong type (.txt)</button>
                <button type="button" className="btn-outline" onClick={() => void add(def, new File([new Uint8Array(1_200_000)], 'huge.pdf', { type: 'application/pdf' }))}>Oversized</button>
                <button type="button" className="btn-outline" onClick={() => void add(def, new File(['not a real pdf'], 'fake.pdf', { type: 'application/pdf' }))}>Corrupt</button>
              </>
            );
          })()}
        </div>
      </details>
    </div>
  );
}

function FormPanel({ opp, onFieldFocus }: { opp: Opportunity; onFieldFocus: (key: string) => void }) {
  const drafts = useDrafts();
  const draft = drafts[opp.id] ?? emptyDraft(opp.id);
  const [review, setReview] = useState(false);
  const blockers = submitBlockers(draft, opp);
  return (
    <div className="stack">
      <div className="fields">
        {opp.fields.map((f) => {
          const id = `pf-${f.key}`;
          const val = draft.fields[f.key] ?? '';
          const change = (v: string) => { const r = updateDraft(opp.id, (d) => setField(d, f.key, v)); if (!r.ok) report(r, ''); };
          return (
            <div className="field" key={f.key}>
              <label htmlFor={id}>{f.label} {f.required && <span className="req">(required)</span>}</label>
              {f.type === 'select' ? (
                <select id={id} value={val} onFocus={() => onFieldFocus(f.key)} onChange={(e) => change(e.target.value)} aria-describedby={`${id}-h`}>
                  <option value="">Choose…</option>
                  {f.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input id={id} type="text" value={val} onFocus={() => onFieldFocus(f.key)} onChange={(e) => change(e.target.value)} aria-describedby={`${id}-h`} />
              )}
              <div id={`${id}-h`} className="muted small">{f.help}</div>
            </div>
          );
        })}
      </div>
      <p className="muted small">Progress is saved automatically in this browser (fictional data only). Last saved {new Date(draft.updatedAt).toLocaleTimeString()}.</p>
      <div className="row wrap gap">
        <button type="button" className="btn-solid" onClick={() => setReview(true)}>Review and submit (simulated)</button>
      </div>
      <Dialog open={review} onClose={() => setReview(false)} title="Review before submitting">
        <p>This is a simulated submission. Nothing is sent anywhere.</p>
        <dl className="dl">
          {opp.fields.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{draft.fields[f.key] || <em className="muted">empty</em>}</dd></div>)}
          {opp.documents.map((d) => { const a = draft.docs.find((x) => x.key === d.key); return <div key={d.key}><dt>{d.label}</dt><dd>{a ? `${a.name} (${a.confirmed ? 'upload confirmed' : 'upload NOT confirmed'}; not verified)` : <em className="muted">not attached</em>}</dd></div>; })}
        </dl>
        {blockers.length > 0 && <div className="error-summary" role="alert"><strong>Not ready:</strong><ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>}
        <div className="row gap wrap">
          <button type="button" className="btn-solid" disabled={blockers.length > 0} onClick={() => { if (report(updateDraft(opp.id, (d) => markSubmitted(d, opp)), 'Marked as submitted on the simulated provider page (demo only).')) { setReview(false); go(`/guide/${opp.id}/status`); } }}>I have reviewed this — submit (simulated)</button>
          <button type="button" className="btn-outline" onClick={() => setReview(false)}>Keep editing</button>
        </div>
      </Dialog>
    </div>
  );
}

function StatusPanel({ opp }: { opp: Opportunity }) {
  const drafts = useDrafts();
  const draft = drafts[opp.id] ?? emptyDraft(opp.id);
  const filled = opp.fields.filter((f) => (draft.fields[f.key] ?? '').trim()).length;
  return (
    <div className="stack">
      <ul className="check-list">
        <li>Fields filled: <strong>{filled} of {opp.fields.length}</strong></li>
        <li>Documents attached: <strong>{draft.docs.length} of {opp.documents.length}</strong> (none verified)</li>
        <li>Uploads confirmed by you: <strong>{draft.docs.filter((d) => d.confirmed).length}</strong></li>
        <li>State: <strong>{draftLabel(draft, opp)}</strong></li>
      </ul>
      <div className="callout info-callout">
        <strong>Next step:</strong> the real application happens on the official provider site. It opens in a new tab and is view-only from here.
        <p className="row gap wrap"><a className="btn-solid" href={`#/continue/mahadbt/${opp.id}`}>Continue on MahaDBT with guide</a><a className="btn-outline" href={opp.verifiedSourceUrl} target="_blank" rel="noopener noreferrer">Continue on official website ↗ <span className="sr-only">(opens in a new tab)</span></a></p>
        <p className="small">Safety reminder: never share your password or OTP with this guide or anyone who asks for it.</p>
      </div>
    </div>
  );
}

export function Workspace({ id, section }: { id: string; section: SectionId }) {
  const opp = findOpportunity(id);
  const drafts = useDrafts();
  const draft = opp ? drafts[opp.id] ?? emptyDraft(opp.id) : undefined;
  const nextId = useRef(1);
  const replyPending = useRef(false);
  const chatNavigation = useRef(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [ai, setAi] = useState<AIHealth | undefined>();
  const [mobilePanel, setMobilePanel] = useState<'application' | 'chat'>(section === 'overview' ? 'chat' : 'application');
  const [activeField, setActiveField] = useState<string | undefined>();
  const pendingField = useRef<string | undefined>(undefined);
  const lastSection = useRef(`${id}/${section}`);
  const headRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [id]);

  useEffect(() => {
    const currentSection = `${id}/${section}`;
    if (lastSection.current === currentSection) return;
    lastSection.current = currentSection;
    if (chatNavigation.current) { chatNavigation.current = false; pendingField.current = undefined; return; }
    headRef.current?.focus({ preventScroll: true });
    headRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (pendingField.current) {
      const el = document.getElementById(`pf-${pendingField.current}`);
      pendingField.current = undefined;
      el?.focus();
    }
  }, [section, id]);

  useEffect(() => {
    let live = true;
    aiHealth().then((h) => live && setAi(h));
    return () => { live = false; };
  }, []);

  const attachedKeys = useMemo(() => draft?.docs.map((d) => d.key) ?? [], [draft]);
  const filledFieldKeys = useMemo(() => Object.entries(draft?.fields ?? {}).filter(([, v]) => v.trim()).map(([k]) => k), [draft]);

  if (!opp) return <NotFound what="Opportunity" />;
  if (opp.status !== 'Open in demo') {
    return <div className="empty2"><h2>No guided workspace yet</h2><p>{opp.title} is a catalogue-only entry.</p><a className="btn-solid" href={`#/opportunity/${opp.id}`}>Back to details</a></div>;
  }

  const sec = opp.sections.find((s) => s.id === section)!;

  const ask = async (text: string) => {
    if (!text.trim() || replyPending.current) return;
    replyPending.current = true;
    const rule = respond(opp, text, { activeField, attachedKeys, filledFieldKeys });
    const history = [...msgs.map((m) => ({ role: m.who === 'you' ? ('user' as const) : ('assistant' as const), content: m.text })), { role: 'user' as const, content: text }];
    setMsgs((m) => [...m, { id: nextId.current++, who: 'you', text }]);
    setThinking(true);

    let reply: { text: string; source?: string; section?: SectionId; field?: string };
    if (rule.kind === 'safety') {
      // Secrets never leave the browser: safety replies are built in and skip the AI call entirely.
      reply = { text: rule.text };
    } else {
      const answer = await askAI(opp, draft, section, history);
      if (answer) {
        reply = { text: answer.text, source: `AI guide using only this scheme’s demo information (${opp.title}). Verify on the official provider portal.`, section: answer.section };
        setAi((cur) => (cur?.state === 'on' ? cur : { state: 'on', model: 'AI' }));
      } else {
        reply = { text: rule.text, source: rule.source, section: rule.navigate?.section, field: rule.navigate?.field };
        setAi((cur) => (cur?.state === 'off' ? cur : { state: 'off', reason: 'the AI service did not respond' }));
      }
    }

    replyPending.current = false;
    setThinking(false);
    const moved = reply.section && reply.section !== section;
    const title = reply.section ? opp.sections.find((x) => x.id === reply.section)!.title : '';
    setMsgs((m) => [...m, { id: nextId.current++, who: 'guide', source: reply.source, text: moved ? `${reply.text}

You can review “${title}” in Application sections.` : reply.text }]);
    if (reply.section) {
      pendingField.current = reply.field;
      if (moved) { chatNavigation.current = true; go(`/guide/${opp.id}/${reply.section}`); }
      else if (reply.field) document.getElementById(`pf-${reply.field}`)?.focus();
    }
  };

  const onFieldFocus = (key: string) => {
    setActiveField(key);
    const f = opp.fields.find((x) => x.key === key)!;
    setMsgs((m) => (m.at(-1)?.fieldKey === key ? m : [...m, { id: nextId.current++, who: 'guide', text: `${f.label}: ${f.help}`, source: 'Configured field help for this scheme.', fieldKey: key }]));
  };

  return (
    <div className="ws chat-first-workspace" data-mobile-panel={mobilePanel}>
      <header className="workspace-heading">
        <a className="back" href={`#/opportunity/${opp.id}`}><BackIcon width={16} height={16} /> Back to scholarship</a>
        <div className="workspace-title"><div><p className="workspace-eyebrow">Your selected scholarship</p><h1>{opp.title}</h1></div><span className="tag">Demo</span></div>
      </header>
      <div className="workspace-switch" role="group" aria-label="Workspace view"><button type="button" aria-pressed={mobilePanel === 'chat'} onClick={() => setMobilePanel('chat')}><SparkleIcon width={16} height={16} /> Chat with guide</button><button type="button" aria-pressed={mobilePanel === 'application'} onClick={() => setMobilePanel('application')}>Application sections</button></div>
      <div className="ws-main">
        <div className="prov">
          <div className="prov-label">Practice only — nothing is sent to a provider</div>
          <div className="prov-bar">
            <strong>Application workspace</strong>
            <span>{sec.title}</span>
          </div>
          <nav className="crumbs pad" aria-label="Breadcrumb">
            <a href="#/">Opportunities</a> / <a href={`#/opportunity/${opp.id}`}>{opp.title}</a> / <span>{sec.title}</span>
          </nav>
          <div className="prov-body">
            <nav className="prov-nav" aria-label="Provider sections">
              {opp.sections.map((s) => (
                <a key={s.id} href={`#/guide/${opp.id}/${s.id}`} aria-current={s.id === section ? 'page' : undefined}>{s.title}</a>
              ))}
            </nav>
            <section className="prov-content" aria-labelledby="prov-h">
              <h2 id="prov-h" ref={headRef} tabIndex={-1}>{sec.title}</h2>
              {section !== 'documents' && section !== 'form' && section !== 'status' && sec.body.map((p, i) => <p key={i}>{p}</p>)}
              {section === 'overview' && <div className="workspace-next"><p className="workspace-eyebrow">Start with the essentials</p><a href={`#/guide/${opp.id}/eligibility`}><span><strong>Understand the requirements</strong><small>Review who this demo is designed for</small></span><ArrowIcon /></a><a href={`#/guide/${opp.id}/documents`}><span><strong>Prepare your documents</strong><small>{opp.documents.length} document types in this walkthrough</small></span><ArrowIcon /></a><a href={`#/guide/${opp.id}/form`}><span><strong>Practise the application</strong><small>Use fictional details; drafts save in this browser</small></span><ArrowIcon /></a></div>}
              {section === 'documents' && (<>{sec.body.map((p, i) => <p key={i} className={i === 0 ? '' : 'indent'}>{p}</p>)}<DocPanel opp={opp} /></>)}
              {section === 'form' && (<><p>{sec.body[0]}</p><FormPanel opp={opp} onFieldFocus={onFieldFocus} /></>)}
              {section === 'status' && (<><p>{sec.body[0]}</p><StatusPanel opp={opp} /></>)}
            </section>
          </div>
        </div>
      </div>
      <Assistant opp={opp} msgs={msgs} onAsk={ask} thinking={thinking} sectionTitle={sec.title} onOpenApplication={() => setMobilePanel('application')} ai={ai} />

    </div>
  );
}
