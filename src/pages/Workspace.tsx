import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { findOpportunity } from '../catalogue/data';
import { respond } from '../catalogue/assistant';
import { aiHealth, askAI, explainShortlist, type AIContext, type AIHealth } from '../catalogue/aiGuide';
import { emptyDraft } from '../catalogue/drafts';
import { useDrafts } from '../catalogue/draftStore';
import { clearChats, deleteChat, isSensitive, redact, relativeTime, requestOpenChat, saveChat, takeOpenChat, takeSheet, useChats, type Chat, type StoredMsg } from '../catalogue/chatStore';
import type { Opportunity, SectionId } from '../catalogue/types';
import { cameFromScheme, go } from '../router';
import { Dialog } from '../components/Dialogs';
import { BackIcon, ArrowIcon, ExternalIcon } from '../components/icons';
import { SaarthiMark } from '../components/SaarthiMark';
import { DocReadiness } from '../components/DocReadiness';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { MAX_FILE_BYTES } from '../engine/files';
import { INCOME_LABEL, STAGE_LABEL, matchSchemes, officialLink, summarizeProfile, translateReason, type Income, type Profile, type Stage } from '../catalogue/matcher';
import { Typewriter, ease } from '../components/motionKit';
import { useLang, useT, type TFn } from '../i18n/i18n';
import { NotFound } from './Detail';

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></svg>
);
const ATTACH_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_ATTACH = 3;

interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `c${Date.now()}${Math.random().toString(16).slice(2)}`);

/** Scheme-page anchors the guide can point to (the scheme page has these sections). */
const DETAIL_ANCHOR: Record<SectionId, string> = { overview: 'd-overview', eligibility: 'd-eligibility', documents: 'd-documents', form: 'd-apply', status: 'd-apply' };
const CHIP_LABEL: Record<SectionId, string> = { overview: 'See the overview', eligibility: 'See eligibility', documents: 'See the document list', form: 'See how to apply', status: 'See how to apply' };

function openOnSchemePage(oppId: string, section: string) {
  go(`/opportunity/${oppId}`);
  const anchor = DETAIL_ANCHOR[section as SectionId] ?? 'd-overview';
  setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
}

const promptsFor = (o: Opportunity) =>
  o.official
    ? ['What documents do I need?', 'Who is eligible?', 'How much will I get?', 'How do I apply?']
    : ['What documents do I need?', 'Who is eligible?', 'How do I apply?'];

const SELECTS: { key: keyof Profile; label: string; options: [string, string][] }[] = [
  { key: 'living', label: 'Where do you stay while studying?', options: [['home', 'At home / day scholar'], ['hostel', 'In a hostel']] },
  { key: 'stage', label: 'What are you studying now?', options: (Object.keys(STAGE_LABEL) as Stage[]).map((k) => [k, STAGE_LABEL[k]]) },
  { key: 'studyIn', label: 'Where do you study?', options: [['india', 'In India'], ['abroad', 'Abroad']] },
  { key: 'state', label: 'Which state do you live in?', options: [['maharashtra', 'Maharashtra'], ['other', 'Another state']] },
  { key: 'income', label: 'Yearly family income', options: (Object.keys(INCOME_LABEL) as Income[]).map((k) => [k, INCOME_LABEL[k]]) },
];

/** One line that says what the student answered, in the chosen language. */
function summaryText(p: Profile, t: TFn): string {
  return [
    t('ST student'),
    t(STAGE_LABEL[p.stage]),
    p.studyIn === 'india' ? t('study in India') : t('study abroad'),
    p.state === 'maharashtra' ? t('Maharashtra') : t('another state'),
    `${t('family income')}: ${t(INCOME_LABEL[p.income])}`,
    p.living === 'hostel' ? t('stays in a hostel') : t('lives at home'),
  ].join(' · ');
}

function MatchForm({ onSubmit }: { onSubmit: (p: Profile) => void }) {
  const t = useT();
  const [p, setP] = useState<Profile>({ living: 'home', stage: 'ug', studyIn: 'india', state: 'maharashtra', income: 'unsure', topInstitute: 'no' });
  const showTop = (p.stage === 'ug' || p.stage === 'pg') && p.studyIn === 'india';
  return (
    <form className="gp-sheet" onSubmit={(e) => { e.preventDefault(); onSubmit(p); }}>
      {SELECTS.map((s) => (
        <label key={s.key}>
          <span>{t(s.label)}</span>
          <select value={p[s.key]} onChange={(e) => setP({ ...p, [s.key]: e.target.value } as Profile)}>
            {s.options.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
        </label>
      ))}
      {showTop && (
        <label>
          <span>{t('Admitted to an IIT, AIIMS, IIM, NIT or similar?')}</span>
          <select value={p.topInstitute} onChange={(e) => setP({ ...p, topInstitute: e.target.value as Profile['topInstitute'] })}>
            <option value="no">{t('No')}</option><option value="yes">{t('Yes')}</option>
          </select>
        </label>
      )}
      <p className="gp-sheet-note">{t('Only these answers are used. Do not add your name, Aadhaar or any number.')}</p>
      <button type="submit" className="gp-send">{t('Find my scholarships')} <ArrowIcon width={16} height={16} /></button>
    </form>
  );
}

export function MatchResults({ m, grid }: { m: StoredMsg; grid?: boolean }) {
  const t = useT();
  const groups: [string, 'central' | 'state'][] = [['Central schemes (Government of India)', 'central'], ['State schemes', 'state']];
  return (
    <div className={`gp-results ${grid ? 'is-grid' : ''}`}>
      {groups.map(([title, level]) => {
        const items = (m.matches ?? []).filter((x) => x.level === level);
        if (!items.length) return null;
        return (
          <section key={level} aria-label={t(title)}>
            <h3>{t(title)}</h3>
            <ul>
              {items.map((x) => {
                const o = findOpportunity(x.id);
                if (!o) return null;
                return (
                  <li key={x.id} className="gp-match">
                    <div className="gp-match-head"><strong>{o.title}</strong><span className={`gp-fit ${x.fit}`}>{x.fit === 'likely' ? t('May fit you') : t('Check details')}</span></div>
                    <ul className="gp-why">{x.reasons.map((r) => <li key={r}>{translateReason(t, r)}</li>)}</ul>
                    <div className="gp-match-links">
                      <a className="gp-go" href={officialLink(o)} target="_blank" rel="noopener noreferrer">{t('Apply on official website')} <ExternalIcon width={14} height={14} /></a>
                      <a className="gp-more" href={`#/opportunity/${o.id}`}>{t('Scheme details')}</a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {(m.matchNotes ?? []).map((n) => <p key={n} className="gp-sheet-note">{t(n)}</p>)}
      <p className="gp-sheet-note">{t('These are pointers, not decisions. Only the provider decides who is eligible. Confirm the current notice on the official website.')}</p>
      <div className="gp-portals">
        <a href="https://scholarships.gov.in/" target="_blank" rel="noopener noreferrer">{t('National Scholarship Portal')} ↗</a>
        <a href="https://mahadbt.maharashtra.gov.in/" target="_blank" rel="noopener noreferrer">MahaDBT ↗</a>
      </div>
    </div>
  );
}

function Bubble({ m, latest, oppId, onProfile }: { m: StoredMsg; latest: boolean; oppId: string; onProfile: (p: Profile) => void }) {
  const reduce = useReducedMotion();
  const t = useT();
  const [done, setDone] = useState(!(latest && m.who === 'guide'));
  const isGuide = m.who === 'guide';
  const opp = m.docs ? findOpportunity(oppId) : undefined;
  return (
    <motion.li
      className={`gp-msg ${isGuide ? 'gp-guide' : 'gp-you'}`}
      initial={reduce ? false : isGuide ? { opacity: 0, x: -18, y: 8, filter: 'blur(4px)' } : { opacity: 0, x: 28, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {isGuide && <span className="gp-avatar" aria-hidden="true"><SaarthiMark size={30} /></span>}
      <div className="gp-bubble">
        <span className="sr-only">{isGuide ? t('Saarthi AI says: ') : t('You said: ')}</span>
        <div className="gp-text">{isGuide && latest ? <Typewriter text={m.text} speed={10} onDone={() => setDone(true)} /> : m.text}</div>
        {isGuide && m.form && <MatchForm onSubmit={onProfile} />}
        {isGuide && m.docs && opp && <DocReadiness opp={opp} />}
        {isGuide && done && m.matches && <MatchResults m={m} />}
        {isGuide && done && m.chip && (
          <button type="button" className="gp-chip-link" onClick={() => openOnSchemePage(oppId, m.chip!.section)}>{t(m.chip.label)} <ArrowIcon width={13} height={13} /></button>
        )}
        {isGuide && done && m.source && <details className="gp-src"><summary>{t('Source')}</summary>{m.source}</details>}
      </div>
    </motion.li>
  );
}

function History({ open, onClose, chats, currentId, onPick }: { open: boolean; onClose: () => void; chats: Chat[]; currentId: string; onPick: (c: Chat) => void }) {
  const t = useT();
  const students = [...new Set(chats.map((c) => c.student).filter((s): s is string => !!s))];
  const [only, setOnly] = useState<string | null>(null);
  const shown = only ? chats.filter((c) => c.student === only) : chats;
  return (
    <Dialog open={open} onClose={onClose} title={t('Recent chats')} side left>
      {chats.length === 0 ? (
        <p className="gp-empty-hist">{t('No saved chats yet. Your conversations with the guide appear here.')}</p>
      ) : (
        <>
          {students.length > 0 && (
            <div className="gp-students" role="group" aria-label={t('Show chats for')}>
              <button type="button" aria-pressed={only === null} onClick={() => setOnly(null)}>{t('All students')}</button>
              {students.map((s) => <button type="button" key={s} aria-pressed={only === s} onClick={() => setOnly(s)}>{s}</button>)}
            </div>
          )}
          <ul className="gp-hist">
            {shown.map((c) => {
              const opp = findOpportunity(c.oppId);
              return (
                <li key={c.id} className={c.id === currentId ? 'is-current' : ''}>
                  <button type="button" className="gp-hist-open" onClick={() => onPick(c)}>
                    <strong>{c.student && <em className="gp-who">{c.student}</em>}{c.title}</strong>
                    <span>{opp?.title ?? t('Scholarship')} · {relativeTime(c.updatedAt)} · {t('{n} messages', { n: c.messages.length })}</span>
                  </button>
                  <button type="button" className="gp-hist-del" onClick={() => deleteChat(c.id)} aria-label={`${t('Delete chat')}: ${c.title}`}>{t('Delete')}</button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-quiet gp-clear" onClick={() => { if (window.confirm(t('Delete all saved chats from this browser?'))) clearChats(); }}>{t('Clear all history')}</button>
        </>
      )}
      <p className="gp-hist-note">{t('Saved only in this browser. Messages that look like passwords, OTPs or ID numbers are never saved.')}</p>
    </Dialog>
  );
}

export function Workspace({ id }: { id: string; section?: SectionId }) {
  const opp = findOpportunity(id);
  const reduce = useReducedMotion();
  const t = useT();
  const lang = useLang();
  const drafts = useDrafts();
  const draft = opp ? drafts[opp.id] ?? emptyDraft(opp.id) : undefined;
  const chats = useChats();
  const [fromScheme] = useState(cameFromScheme);
  const aiContext: AIContext = { language: lang };

  const [chatId, setChatId] = useState<string>(uid);
  const [msgs, setMsgs] = useState<StoredMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [q, setQ] = useState('');
  const [, setAi] = useState<AIHealth | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const sheetRef = useRef<(() => void) | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState('');
  const recRef = useRef<SpeechRec | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const nextId = useRef(1);
  const pending = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const createdAt = useRef(new Date().toISOString());

  const loadChat = useCallback((c: Chat) => {
    setChatId(c.id);
    setMsgs(c.messages);
    setFresh(null);
    createdAt.current = c.createdAt;
    nextId.current = Math.max(0, ...c.messages.map((m) => m.id)) + 1;
    setHistoryOpen(false);
  }, []);

  const newChat = useCallback(() => {
    setChatId(uid());
    setMsgs([]);
    setFresh(null);
    setQ('');
    setFiles([]);
    setFileNote('');
    createdAt.current = new Date().toISOString();
    nextId.current = 1;
    setHistoryOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // The browser tab is named after the page.
  useEffect(() => {
    const before = document.title;
    document.title = 'Saarthi AI · TribalSaarthi';
    return () => { document.title = before; };
  }, []);

  // Fresh page per scheme; open a saved chat if the history drawer asked for one.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const wanted = takeOpenChat();
    const saved = wanted ? chats.find((c) => c.id === wanted && c.oppId === id) : undefined;
    if (saved) loadChat(saved);
    else {
      newChat();
      if (takeSheet()) setTimeout(() => sheetRef.current?.(), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let live = true;
    aiHealth().then((h) => live && setAi(h));
    return () => { live = false; };
  }, []);

  // Save after every change; empty chats are dropped by the store.
  useEffect(() => {
    if (!opp || msgs.length === 0) return;
    saveChat({ id: chatId, oppId: opp.id, title: '', createdAt: createdAt.current, updatedAt: '', messages: msgs });
  }, [msgs, chatId, opp]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [msgs.length, thinking, reduce]);

  const attachedKeys = useMemo(() => draft?.docs.map((d) => d.key) ?? [], [draft]);
  const filledFieldKeys = useMemo(() => Object.entries(draft?.fields ?? {}).filter(([, v]) => v.trim()).map(([k]) => k), [draft]);

  if (!opp) return <NotFound what="Opportunity" />;
  if (opp.status !== 'Open in demo') {
    return <div className="empty2"><h2>{t('No guide for this one yet')}</h2><p>{t('{title} is a catalogue-only entry.', { title: opp.title })}</p><a className="btn-solid" href={`#/opportunity/${opp.id}`}>{t('Back to details')}</a></div>;
  }

  const started = msgs.length > 0;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    const issues: string[] = [];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_ATTACH) { issues.push(t('Up to {n} files at a time.', { n: MAX_ATTACH })); break; }
      if (!ATTACH_TYPES.includes(f.type)) issues.push(`${f.name}: ${t('only PDF, JPG or PNG.')}`);
      else if (f.size > MAX_FILE_BYTES) issues.push(`${f.name}: ${t('over 1 MB.')}`);
      else next.push(f);
    }
    setFiles(next);
    setFileNote(issues.join(' '));
    if (fileRef.current) fileRef.current.value = '';
  };

  /** `shown` is what the student sees (and what the AI receives); `plain` is the English used by the built-in fallback rules. */
  const ask = async (raw: string, plain = raw) => {
    const text = raw.trim();
    if ((!text && files.length === 0) || pending.current) return;
    pending.current = true;
    const names = files.map((f) => f.name);
    setQ('');
    setFiles([]);
    setFileNote('');
    const secret = isSensitive(text);
    const rule = respond(opp, plain.trim() || 'documents', { attachedKeys, filledFieldKeys });
    const history = [...msgs.map((m) => ({ role: m.who === 'you' ? ('user' as const) : ('assistant' as const), content: m.text })), { role: 'user' as const, content: text }];
    setMsgs((m) => [...m, { id: nextId.current++, who: 'you', text: [redact(text), ...names.map((n) => `📎 ${n}`)].filter(Boolean).join('\n') }]);
    setThinking(true);

    let reply: { text: string; source?: string; section?: SectionId };
    if (!text) {
      reply = { text: t('I kept your file(s) on this device only. I cannot read attachments here, and nothing was uploaded. To check a document on the official portal, use the TribalSaarthi browser extension, which asks your permission each time. Ask me which documents this scheme needs.') };
    } else if (secret || rule.kind === 'safety') {
      // Secrets never leave the browser: the safety reply is built in and the AI is not called.
      reply = { text: t('Please do not share passwords, OTPs, PINs or ID/bank numbers with me. I never need them.') };
    } else {
      const answer = await askAI(opp, draft, 'overview', history, aiContext);
      if (answer) {
        reply = { text: answer.text, source: t('AI guide ({kind}) for {title}. Confirm the current notice on the official portal.', { kind: opp.official ? t('official scheme facts') : t('practice example'), title: opp.title }), section: answer.section };
        setAi((cur) => (cur?.state === 'on' ? cur : { state: 'on', model: 'AI' }));
      } else {
        reply = { text: rule.text, source: rule.source, section: rule.navigate?.section };
        setAi((cur) => (cur?.state === 'off' ? cur : { state: 'off', reason: 'the AI service did not respond' }));
      }
    }
    pending.current = false;
    setThinking(false);
    const replyId = nextId.current++;
    setFresh(replyId);
    setMsgs((m) => [...m, { id: replyId, who: 'guide', text: reply.text, source: reply.source, chip: reply.section && reply.section !== 'status' ? { label: CHIP_LABEL[reply.section], section: reply.section } : undefined }]);
    inputRef.current?.focus();
  };

  /** Voice input with the browser's speech recognition; Chrome may send the audio to its speech service. */
  const toggleMic = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) { setMicNote(t('Voice input is not available in this browser. You can type your question.')); return; }
    if (recRef.current) { recRef.current.stop(); return; }
    const base = q.trim();
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += `${r[0].transcript} `; else interim += r[0].transcript;
      }
      setQ([base, `${finalText}${interim}`.trim()].filter(Boolean).join(' '));
    };
    rec.onerror = (e) => setMicNote(e.error === 'not-allowed' ? t('Microphone is blocked. Allow it in the browser address bar, or type your question.') : e.error === 'no-speech' ? t('No speech heard. Try again.') : t('Voice input stopped. You can type your question.'));
    rec.onend = () => { recRef.current = null; setListening(false); };
    recRef.current = rec;
    setMicNote('');
    setListening(true);
    try { rec.start(); } catch { recRef.current = null; setListening(false); }
  };

  const startSheet = () => {
    if (pending.current) return;
    setMsgs((m) => [
      ...m.map((x) => (x.form ? { ...x, form: false } : x)),
      { id: nextId.current++, who: 'you', text: t('I don’t know which scholarship I qualify for.') },
      { id: nextId.current++, who: 'guide', text: t('Fill this short sheet and I will shortlist the schemes that may fit you. Nothing personal is needed.'), form: true },
    ]);
  };

  sheetRef.current = startSheet;

  const submitSheet = async (profile: Profile) => {
    if (pending.current) return;
    pending.current = true;
    const { matches, notes } = matchSchemes(profile);
    const summary = summaryText(profile, t);
    setMsgs((m) => [...m.map((x) => (x.form ? { ...x, form: false, text: t('Sheet submitted.') } : x)), { id: nextId.current++, who: 'you', text: summary }]);
    setThinking(true);
    const titles = matches.map((x) => findOpportunity(x.id)?.title ?? x.id);
    const ai = await explainShortlist(summarizeProfile(profile), titles, aiContext);
    const intro = ai ?? (matches.length ? t('Based on the answers, {n} scheme(s) may fit. Central and state schemes are listed separately.', { n: matches.length }) : t('I could not shortlist a scheme from these answers.'));
    pending.current = false;
    setThinking(false);
    const replyId = nextId.current++;
    setFresh(replyId);
    setMsgs((m) => [...m, { id: replyId, who: 'guide', text: intro, matches, matchNotes: notes, source: ai ? t('AI explanation of a checklist shortlist built from the official scheme facts in this catalogue.') : t('Checklist shortlist built from the official scheme facts in this catalogue.') }]);
  };

  const pickFromHistory = (c: Chat) => {
    if (c.oppId === opp.id) return loadChat(c);
    requestOpenChat(c.id);
    setHistoryOpen(false);
    go(`/guide/${c.oppId}/overview`);
  };

  return (
    <motion.div className="gp" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="gp-glow" aria-hidden="true" />
      <div className="gp-bar">
        <div className="gp-actions">
          <a className="gp-btn" href="#/"><HomeIcon /> {t('Home')}</a>
          <button type="button" className="gp-btn gp-btn-recent" onClick={() => setHistoryOpen(true)}>
            <span aria-hidden="true">↺</span> {t('Recent chats')}{chats.length > 0 && <span className="gp-count" aria-label={t('{n} saved', { n: chats.length })}>{chats.length}</span>}
          </button>
        </div>
        <h2 className="gp-brand"><SaarthiMark size={26} /> Saarthi AI</h2>
        <div className="gp-actions">
          <LanguageSwitch />
          {fromScheme && <a className="gp-back" href={`#/opportunity/${opp.id}`}><BackIcon width={16} height={16} /> {t('Scholarship details')}</a>}
          <button type="button" className="gp-btn" onClick={newChat} disabled={!started}><span aria-hidden="true">＋</span> {t('New chat')}</button>
        </div>
      </div>
      <div className={`gp-main ${started ? 'is-started' : ''}`} id="guide">
        <AnimatePresence initial={false} mode="wait">
          {!started ? (
            <motion.section key="welcome" className="gp-welcome" aria-labelledby="gp-h" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5, ease }}>
              <div className="gp-orb" aria-hidden="true">
                {!reduce && <motion.span className="gp-ring" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }} />}
                <motion.span className="gp-orb-core" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}><SaarthiMark size={72} /></motion.span>
              </div>
              <h1 id="gp-h">{t('What would you like help with?')}</h1>
              <p>{t('Ask about eligibility, documents, benefits or how to apply.')}</p>
            </motion.section>
          ) : (
            <motion.section key="thread" className="gp-thread" aria-label={t('Conversation')} initial={false}>
              <ol className="gp-list" role="log" aria-live="polite" aria-relevant="additions">
                {msgs.map((m) => <Bubble key={m.id} m={m} latest={m.id === fresh} oppId={opp.id} onProfile={(p) => void submitSheet(p)} />)}
              </ol>
              {thinking && (
                <div className="gp-typing" role="status"><span className="gp-avatar is-busy" aria-hidden="true"><SaarthiMark size={30} /></span><span className="gp-dots" aria-hidden="true"><i /><i /><i /></span><span className="gp-think" aria-hidden="true">{t('Thinking…')}</span><span className="sr-only">{t('The guide is thinking')}</span></div>
              )}
              <div ref={endRef} />
            </motion.section>
          )}
        </AnimatePresence>

        <div className="gp-dock">
          <form className="gp-composer" onSubmit={(e) => { e.preventDefault(); void ask(q); }} noValidate>
            <textarea
              ref={inputRef}
              id="gp-ask"
              aria-label={t('Ask about {title}', { title: opp.title })}
              rows={2}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('Type your question…')}
              autoComplete="off"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(q); } }}
            />
            {files.length > 0 && (
              <ul className="gp-files" aria-label={t('Attached files')}>
                {files.map((f, i) => (
                  <li key={`${f.name}${i}`}><span>📎 {f.name}</span><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`${t('Remove')} ${f.name}`}>×</button></li>
                ))}
              </ul>
            )}
            {fileNote && <p className="gp-file-note" role="alert">{fileNote}</p>}
            {micNote && <p className="gp-file-note" role="status">{micNote}</p>}
            <div className="gp-composer-row">
              <input ref={fileRef} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => addFiles(e.target.files)} />
              <button type="button" className="gp-plus" onClick={() => fileRef.current?.click()} aria-label={t('Attach documents or images')} title={t('Attach a PDF, JPG or PNG (kept on this device)')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <button type="button" className={`gp-plus gp-mic ${listening ? 'is-on' : ''}`} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? t('Stop listening') : t('Speak your question')} title={listening ? t('Stop listening') : t('Speak your question')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></svg>
              </button>
              <motion.button type="submit" className="gp-send" disabled={(!q.trim() && files.length === 0) || thinking} whileTap={{ scale: 0.95 }} aria-label={t('Send message')}><ArrowIcon width={18} height={18} /> {t('Send')}</motion.button>
            </div>
          </form>

          <div className="gp-finds">
            <button type="button" className="gp-find" onClick={startSheet} disabled={thinking}>
              <span className="gp-find-ic" aria-hidden="true"><SaarthiMark size={34} /></span>
              <span><strong>{t('Don’t know which scholarship you qualify for?')}</strong><small>{t('Fill a 1-minute sheet and get a shortlist with official links')}</small></span>
              <ArrowIcon width={16} height={16} />
            </button>
          </div>

          {!started && (
            <motion.div className="gp-prompts" role="group" aria-label={t('Suggested questions')} initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}>
              {promptsFor(opp).map((p) => (
                <motion.button key={p} type="button" variants={{ hide: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={reduce ? undefined : { y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => void ask(t(p), p)}>{t(p)}</motion.button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <History open={historyOpen} onClose={() => setHistoryOpen(false)} chats={chats} currentId={chatId} onPick={pickFromHistory} />
    </motion.div>
  );
}
