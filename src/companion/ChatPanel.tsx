import { useEffect, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { AIHealth } from '../catalogue/aiGuide';
import { SparkleIcon } from '../components/icons';
import { DOC_LABEL, type DocType } from './bridge';
import { ACCEPT } from './files';
import { ClipIcon, CompassIcon, PencilIcon, SendIcon, ShieldIcon, SkipIcon } from './icons';

export interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  files?: { name: string; kb: number }[];
  /** "May I check this file on your device?" */
  ask?: { fileId: string; state: 'open' | 'yes' | 'no' };
  /** "Which document is this?" */
  pick?: { fileId: string; state: 'open' | DocType };
}
export interface Activity { id: number; kind: 'navigate' | 'fill' | 'file' | 'skip'; text: string }

interface Props {
  msgs: Msg[];
  activity: Activity[];
  thinking: boolean;
  busy: boolean;
  ai: AIHealth | undefined;
  suggestions: string[];
  onSend: (text: string) => void;
  onFiles: (files: File[]) => void;
  onDecide: (fileId: string, yes: boolean) => void;
  onPick: (fileId: string, doc: DocType) => void;
  /** Shows a close button (used when the panel is docked inside a simulated portal). */
  onClose?: () => void;
}

const ICON = { navigate: CompassIcon, fill: PencilIcon, file: ClipIcon, skip: SkipIcon } as const;

function Bubble({ m, onDecide, onPick }: { m: Msg; onDecide: Props['onDecide']; onPick: Props['onPick'] }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      className={`cmp-msg ${m.role}`}
      layout="position"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
    >
      {m.role === 'assistant' && <span className="cmp-avatar" aria-hidden="true"><SparkleIcon width={14} height={14} /></span>}
      <div className="cmp-bubble">
        <span className="sr-only">{m.role === 'assistant' ? 'Companion says: ' : 'You said: '}</span>
        {m.files?.map((f) => <span className="cmp-filechip" key={f.name}><ClipIcon width={14} height={14} /> {f.name} <small>{f.kb} KB</small></span>)}
        {m.text && <p>{m.text}</p>}
        {m.ask && (
          m.ask.state === 'open' ? (
            <div className="cmp-actions">
              <button type="button" className="cmp-btn primary" onClick={() => onDecide(m.ask!.fileId, true)}>Check and attach</button>
              <button type="button" className="cmp-btn" onClick={() => onDecide(m.ask!.fileId, false)}>No thanks</button>
            </div>
          ) : <span className="cmp-decided">{m.ask.state === 'yes' ? 'You allowed the check on your device' : 'You skipped this file'}</span>
        )}
        {m.pick && (
          m.pick.state === 'open' ? (
            <div className="cmp-actions">
              {(['Aadhaar', 'Income'] as DocType[]).map((d) => <button type="button" className="cmp-btn" key={d} onClick={() => onPick(m.pick!.fileId, d)}>{DOC_LABEL[d]}</button>)}
            </div>
          ) : <span className="cmp-decided">Marked as {DOC_LABEL[m.pick.state]}</span>
        )}
      </div>
    </motion.li>
  );
}

export function ChatPanel({ msgs, activity, thinking, busy, ai, suggestions, onSend, onFiles, onDecide, onPick, onClose }: Props) {
  const reduce = useReducedMotion();
  const [input, setInput] = useState('');
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [msgs.length, thinking, reduce]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    onSend(text);
  };
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setDragging(true); };
  const leave = () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); };
  const drop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files).slice(0, 2));
  };

  const status = !ai ? { cls: 'wait', text: 'Connecting…' } : ai.state === 'on' ? { cls: 'on', text: 'AI connected' } : { cls: 'off', text: 'Built-in demo brain' };
  const started = msgs.some((m) => m.role === 'user');

  return (
    <section
      className={`cmp-chat ${dragging ? 'is-dragging' : ''}`}
      aria-label="Scholarship Companion chat"
      onDragEnter={enter}
      onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
      onDragLeave={leave}
      onDrop={drop}
    >
      <header className="cmp-chat-head">
        <span className="cmp-avatar big" aria-hidden="true"><SparkleIcon width={18} height={18} /></span>
        <div>
          <h2>Scholarship Companion</h2>
          <p><span className={`cmp-dot ${status.cls}`} aria-hidden="true" /> {status.text}{ai?.state === 'off' ? ` (${ai.reason})` : ''}</p>
        </div>
        {onClose && <button type="button" className="cmp-close" onClick={onClose} aria-label="Close the guide panel">×</button>}
      </header>

      <div className="cmp-activity" aria-label="What the assistant just did to the form">
        <span className={`cmp-activity-title ${busy ? 'is-live' : ''}`}><i aria-hidden="true" /> Live automation</span>
        <ul>
          <AnimatePresence initial={false}>
            {activity.length === 0 && <li key="none" className="cmp-activity-empty">Actions on the form will appear here.</li>}
            {activity.map((a) => {
              const Icon = ICON[a.kind];
              return (
                <motion.li
                  key={a.id}
                  className={`cmp-act ${a.kind}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Icon width={14} height={14} /> {a.text}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <ol className="cmp-list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions" aria-busy={thinking}>
        {msgs.map((m) => <Bubble key={m.id} m={m} onDecide={onDecide} onPick={onPick} />)}
        {thinking && (
          <li className="cmp-msg assistant" aria-label="The companion is thinking">
            <span className="cmp-avatar" aria-hidden="true"><SparkleIcon width={14} height={14} /></span>
            <div className="cmp-bubble cmp-typing" aria-hidden="true"><i /><i /><i /></div>
          </li>
        )}
      </ol>

      {!started && (
        <div className="cmp-suggest" role="group" aria-label="Things to try">
          {suggestions.map((s) => <button type="button" key={s} onClick={() => onSend(s)} disabled={busy}>{s}</button>)}
        </div>
      )}

      <form className="cmp-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input ref={pickRef} className="sr-only" type="file" accept={ACCEPT} multiple tabIndex={-1} aria-hidden="true" onChange={(e) => { const list = Array.from(e.target.files ?? []).slice(0, 2); e.target.value = ''; if (list.length) onFiles(list); }} />
        <button type="button" className="cmp-icon-btn" onClick={() => pickRef.current?.click()} aria-label="Attach a document" title="Attach a PDF, JPG or PNG">
          <ClipIcon width={20} height={20} />
        </button>
        <label htmlFor="cmp-say" className="sr-only">Message the companion</label>
        <textarea
          id="cmp-say"
          rows={1}
          value={input}
          maxLength={1000}
          placeholder="Tell me your name and income, or drop a document…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        />
        <button type="submit" className="cmp-send" disabled={!input.trim() || busy} aria-label="Send message"><SendIcon width={18} height={18} /></button>
      </form>
      <p className="cmp-privacy"><ShieldIcon width={13} height={13} /> Files are checked on your device. The assistant sees a file’s name and the check result, never what is inside. Do not type your Aadhaar number, OTP or passwords here.</p>

      <div className="cmp-veil" aria-hidden={!dragging}>
        <ClipIcon width={30} height={30} />
        <strong>Drop your document here</strong>
        <span>PDF, JPG or PNG. You are asked before it is checked.</span>
      </div>
    </section>
  );
}
