import { useSyncExternalStore } from 'react';

/** Saved guide conversations. Stored only in this browser (localStorage); never sent anywhere by this module. */
export interface StoredMsg {
  id: number;
  who: 'guide' | 'you';
  text: string;
  source?: string;
  /** Optional "see this on the scheme page" shortcut shown under a reply */
  chip?: { label: string; section: string };
  /** Interactive "find my scholarship" sheet; shown as a form only while still unanswered */
  form?: boolean;
  /** Shortlist produced by the sheet (rendered from the catalogue, so links always match the official data) */
  matches?: { id: string; level: 'central' | 'state'; fit: 'likely' | 'check'; reasons: string[] }[];
  matchNotes?: string[];
  /** A documents checklist card ("rejection risk") for the scheme being discussed. */
  docs?: boolean;
}

export interface Chat {
  id: string;
  oppId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMsg[];
  /** Helper mode: the first name the helper gave this student (a local label only, never sent to the AI). */
  student?: string;
}

export const CHAT_KEY = 'tribalsaarthi.chats.v1';
export const MAX_CHATS = 30;
export const MAX_MESSAGES = 60;
export const HIDDEN_TEXT = 'Message hidden: it looked like a password, OTP or ID number.';

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SENSITIVE = /\b(password|passcode|otp|pin|cvv|aadhaar|aadhar|bank account|card number)\b/i;

/** Sensitive-looking user text is replaced before it is displayed or saved. */
export const isSensitive = (text: string) => SENSITIVE.test(text);
export const redact = (text: string) => (isSensitive(text) ? HIDDEN_TEXT : text);

export function titleFrom(messages: StoredMsg[]): string {
  const first = messages.find((m) => m.who === 'you' && m.text !== HIDDEN_TEXT)?.text.trim();
  if (!first) return 'New chat';
  return first.length > 52 ? `${first.slice(0, 50).trimEnd()}…` : first;
}

export function loadChats(storage: KV): Chat[] {
  try {
    const raw = storage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.id === 'string' && typeof c.oppId === 'string' && Array.isArray(c.messages))
      .map((c) => ({ ...c, messages: c.messages.filter((m: StoredMsg) => m && typeof m.text === 'string' && (m.who === 'you' || m.who === 'guide')).slice(-MAX_MESSAGES) }))
      .slice(0, MAX_CHATS);
  } catch {
    return [];
  }
}

export function saveChats(storage: KV, chats: Chat[]): boolean {
  try {
    storage.setItem(CHAT_KEY, JSON.stringify(chats));
    return true;
  } catch {
    return false;
  }
}

/** Insert or update a chat; newest first, capped. Empty chats are dropped. */
export function upsertChat(chats: Chat[], chat: Chat): Chat[] {
  const rest = chats.filter((c) => c.id !== chat.id);
  if (chat.messages.length === 0) return rest;
  const next: Chat = { ...chat, title: titleFrom(chat.messages), messages: chat.messages.slice(-MAX_MESSAGES), updatedAt: new Date().toISOString() };
  return [next, ...rest].slice(0, MAX_CHATS);
}

export const removeChat = (chats: Chat[], id: string) => chats.filter((c) => c.id !== id);

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ---------- store ----------
let chats: Chat[] = typeof localStorage === 'undefined' ? [] : loadChats(localStorage);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const persist = () => { try { saveChats(localStorage, chats); } catch { /* history is optional */ } };

export const useChats = () =>
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => void listeners.delete(l); },
    () => chats,
  );

export function saveChat(chat: Chat) {
  chats = upsertChat(chats, chat);
  persist();
  emit();
}
export function deleteChat(id: string) {
  chats = removeChat(chats, id);
  persist();
  emit();
}
export function clearChats() {
  chats = [];
  try { localStorage.removeItem(CHAT_KEY); } catch { /* ignore */ }
  emit();
}

/** Lets the history drawer ask the guide page (possibly of another scheme) to open a saved chat. */
let pendingOpen: string | null = null;
export const requestOpenChat = (id: string) => { pendingOpen = id; };
export const takeOpenChat = (): string | null => { const id = pendingOpen; pendingOpen = null; return id; };

/** Lets other pages open the guide with the "find my scholarship" sheet already showing. */
let pendingSheet = false;
export const requestSheet = () => { pendingSheet = true; };
export const takeSheet = (): boolean => { const v = pendingSheet; pendingSheet = false; return v; };
