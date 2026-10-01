import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { aiHealth, type AIHealth } from '../catalogue/aiGuide';
import { HIDDEN_TEXT, asksToHandleSecret, sharesSecret } from '../../extension/lib/sensitive.js';
import { DOC_LABEL, applyAction, initialForm, readResponse, typeInto, type BridgeAction, type CompanionResponse, type DocType, type FormState, type Tab, type TargetId } from './bridge';
import { askCompanion, buildContext, type ChatTurn } from './api';
import type { Activity, Msg } from './ChatPanel';
import { checkFile, guessDocType, isSupportedName, MAX_CHECK_BYTES, type FileMeta } from './files';
import { SECRET_REPLY, docFromText, localReply } from './localBrain';

/**
 * The Scholarship Companion controller: form state, chat, the bridge that performs the AI's actions on the form,
 * and the consent-first document flow. Shared by the practice page and the simulated-portal demo.
 */
const WELCOME: Msg = {
  id: 0,
  role: 'assistant',
  text: 'Hi! I am your Scholarship Companion. Tell me your name and your family’s yearly income and I will fill in the form. Drop your Aadhaar card and income certificate here and I will check them on your device and attach them. You type your Aadhaar number yourself.',
};

interface Held { file: File; forced?: DocType; meta?: FileMeta }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface CompanionHooks {
  /** The assistant changed the form (used to flag an unseen update on phones). */
  onChange?: () => void;
  /** A file was added, so the chat should be in view. */
  onFile?: () => void;
}

export function useCompanion(hooks: CompanionHooks = {}) {
  const reduce = useReducedMotion();
  const [form, setForm] = useState<FormState>(initialForm);
  const formRef = useRef(form);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [thinking, setThinking] = useState(false);
  const [running, setRunning] = useState(false);
  const [lit, setLit] = useState<TargetId | null>(null);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const [ai, setAi] = useState<AIHealth>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const held = useRef(new Map<string, Held>());
  const convo = useRef<ChatTurn[]>([]);
  const ids = useRef({ msg: 1, act: 1, file: 1 });
  const busyRef = useRef(false);
  const [busy, setBusyState] = useState(false);
  const setBusy = useCallback((v: boolean) => { busyRef.current = v; setBusyState(v); }, []);
  const hooksRef = useRef(hooks);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { hooksRef.current = hooks; });
  useEffect(() => {
    let live = true;
    aiHealth().then((h) => { if (live) setAi(h); });
    return () => { live = false; };
  }, []);

  const commit = useCallback((next: FormState) => { formRef.current = next; setForm(next); }, []);
  const push = useCallback((m: Omit<Msg, 'id'>) => {
    const id = ids.current.msg++;
    setMsgs((list) => [...list, { ...m, id }]);
    return id;
  }, []);
  const patchMsg = useCallback((id: number, patch: Partial<Msg>) => setMsgs((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m))), []);
  const log = useCallback((kind: Activity['kind'], text: string) => setActivity((list) => [{ id: ids.current.act++, kind, text }, ...list].slice(0, 4)), []);

  // Bring the section the assistant points at into view and light it up.
  useEffect(() => {
    const focus = form.focus;
    if (!focus) return;
    const id = focus.target === 'instructions' ? 'cmp-instructions' : `cmp-${focus.target}`;
    const top = focus.target === 'instructions' || focus.target === 'form_section';
    const go = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: top ? 'start' : 'center' }), 80);
    setLit(focus.target);
    const t = setTimeout(() => setLit(null), 2600);
    return () => { clearTimeout(go); clearTimeout(t); };
  }, [form.focus, reduce]);

  const blink = useCallback((key: string) => {
    setFlash((f) => ({ ...f, [key]: true }));
    setTimeout(() => setFlash((f) => ({ ...f, [key]: false })), 2200);
  }, []);

  /** The bridge controller: reads the backend's JSON answer and performs each action on the form, one after another. */
  const runActions = useCallback(async (response: CompanionResponse | unknown) => {
    const { actions, refused } = readResponse(response);
    for (const why of refused) log('skip', why);
    if (!actions.length) return;
    setRunning(true);
    for (const action of actions as BridgeAction[]) {
      await wait(reduce ? 120 : 520);
      const result = applyAction(formRef.current, action);
      commit(result.state);
      log(!result.ok ? 'skip' : action.action === 'NAVIGATE' ? 'navigate' : action.action === 'AUTO_FILL' ? 'fill' : 'file', result.note);
      if (!result.ok) continue;
      if (action.action === 'AUTO_FILL') blink(action.field);
      if (action.action === 'MAP_FILE') blink(action.documentType);
      hooksRef.current.onChange?.();
    }
    setRunning(false);
  }, [blink, commit, log, reduce]);

  /** Sends a turn to the AI service; if it is unreachable the built-in brain answers in the same JSON shape. */
  const respond = useCallback(async (text: string, files?: FileMeta[]) => {
    setBusy(true);
    setThinking(true);
    const turn: ChatTurn = { role: 'user', content: text };
    const fromAi = await askCompanion([...convo.current, turn], buildContext(formRef.current, files ?? []));
    setAi((cur) => (fromAi ? (cur?.state === 'on' ? cur : { state: 'on', model: 'AI' }) : { state: 'off', reason: 'the AI service did not respond' }));
    const answer: CompanionResponse = fromAi ?? localReply({ text, state: formRef.current, files });
    const parsed = readResponse(answer);
    setThinking(false);
    convo.current = [...convo.current, turn, { role: 'assistant' as const, content: parsed.text || 'Done.' }].slice(-12);
    if (parsed.text) push({ role: 'assistant', text: parsed.text });
    await runActions(answer);
    setBusy(false);
  }, [push, runActions, setBusy]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    const secret = sharesSecret(text);
    if (secret || asksToHandleSecret(text)) {
      push({ role: 'user', text: secret ? HIDDEN_TEXT : text });
      push({ role: 'assistant', text: SECRET_REPLY });
      return;
    }
    push({ role: 'user', text });
    // "Which document is this?" can be answered by typing it.
    const waiting = [...msgs].reverse().find((m) => m.pick?.state === 'open');
    const doc = waiting?.pick ? docFromText(text) : null;
    if (waiting?.pick && doc) { await choose(waiting.id, waiting.pick.fileId, doc); return; }
    await respond(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, push, respond]);

  // ----- documents -----
  const enqueue = useCallback((file: File, forced?: DocType) => {
    if (!isSupportedName(file.name)) {
      push({ role: 'assistant', text: `I can check PDF, JPG or PNG files. “${file.name}” is a different kind of file.` });
      return;
    }
    if (file.size > MAX_CHECK_BYTES) {
      push({ role: 'assistant', text: `“${file.name}” is over 10 MB, which is too large for this practice form. Try a smaller scan.` });
      return;
    }
    const fileId = `f${ids.current.file++}`;
    held.current.set(fileId, { file, forced });
    if (forced) commit({ ...formRef.current, files: { ...formRef.current.files, [forced]: { status: 'attached', fileName: file.name } } });
    push({ role: 'user', text: '', files: [{ name: file.name, kb: Math.max(1, Math.round(file.size / 1000)) }] });
    push({ role: 'assistant', text: `You added “${file.name}”. I can check it on this device, and I never see what is inside it, then attach it to the right box. Go ahead?`, ask: { fileId, state: 'open' } });
    hooksRef.current.onFile?.();
  }, [commit, push]);

  const onFiles = useCallback((files: File[]) => files.forEach((f) => enqueue(f)), [enqueue]);
  const onManualFile = useCallback((doc: DocType, file: File) => enqueue(file, doc), [enqueue]);

  const setSlot = (doc: DocType, slot: FormState['files'][DocType]) => commit({ ...formRef.current, files: { ...formRef.current.files, [doc]: slot } });
  const resetSlotIfWaiting = (doc: DocType | null | undefined) => {
    if (doc && formRef.current.files[doc].status !== 'verified') setSlot(doc, { status: 'empty' });
  };

  const afterCheck = async (entry: Held, meta: FileMeta) => {
    entry.meta = meta;
    if (meta.check === 'failed') resetSlotIfWaiting(entry.forced ?? meta.guess);
    else if (!formRef.current.checked.includes(meta.name)) commit({ ...formRef.current, checked: [...formRef.current.checked, meta.name] });
    const said = `I attached my file "${meta.name}" (${meta.kb} KB). The check on my own device: ${meta.check}${meta.notes.length ? ` (${meta.notes.join(' ')})` : ''}.${meta.guess ? ` It is my ${DOC_LABEL[meta.guess]}.` : ''}`;
    await respond(said, [meta]);
  };

  async function choose(msgId: number, fileId: string, doc: DocType) {
    const entry = held.current.get(fileId);
    if (!entry?.meta) return;
    patchMsg(msgId, { pick: { fileId, state: doc } });
    const meta = { ...entry.meta, guess: doc };
    entry.meta = meta;
    setSlot(doc, { status: 'checking', fileName: meta.name });
    await wait(reduce ? 100 : 450);
    await afterCheck(entry, meta);
  }

  const onPick = useCallback((fileId: string, doc: DocType) => {
    const m = msgs.find((x) => x.pick?.fileId === fileId);
    if (m) void choose(m.id, fileId, doc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs]);

  const onDecide = useCallback(async (fileId: string, yes: boolean) => {
    const entry = held.current.get(fileId);
    const ask = msgs.find((m) => m.ask?.fileId === fileId);
    if (!entry || !ask || busyRef.current) return;
    patchMsg(ask.id, { ask: { fileId, state: yes ? 'yes' : 'no' } });
    if (!yes) {
      resetSlotIfWaiting(entry.forced);
      held.current.delete(fileId);
      push({ role: 'assistant', text: `No problem. I have not opened “${entry.file.name}”.` });
      return;
    }
    const guess = entry.forced ?? guessDocType(entry.file.name);
    if (guess) setSlot(guess, { status: 'checking', fileName: entry.file.name });
    setBusy(true);
    const [meta] = await Promise.all([checkFile(entry.file, guess), wait(reduce ? 100 : 700)]);
    setBusy(false);
    if (meta.check !== 'failed' && !meta.guess) {
      // The file name does not say which document it is: ask, instead of guessing.
      entry.meta = meta;
      if (!formRef.current.checked.includes(meta.name)) commit({ ...formRef.current, checked: [...formRef.current.checked, meta.name] });
      push({ role: 'assistant', text: `“${meta.name}” passed the check on your device. Which document is it?`, pick: { fileId, state: 'open' } });
      return;
    }
    await afterCheck(entry, meta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, push, reduce]);

  const onClearFile = useCallback((doc: DocType) => {
    const name = formRef.current.files[doc].fileName;
    commit({ ...formRef.current, files: { ...formRef.current.files, [doc]: { status: 'empty' } }, checked: formRef.current.checked.filter((n) => n !== name) });
    log('skip', `Removed ${DOC_LABEL[doc]} file`);
  }, [commit, log]);

  const onTab = useCallback((tab: Tab) => commit({ ...formRef.current, tab }), [commit]);
  const onType = useCallback((field: 'name' | 'aadhaar' | 'income', value: string) => commit(typeInto(formRef.current, field, value)), [commit]);

  return { form, msgs, activity, thinking, busy: busy || running, ai, lit, flash, scrollRef, send, onFiles, onDecide, onPick, onTab, onType, onManualFile, onClearFile };
}
