import { describe, expect, it } from 'vitest';
import { CHAT_KEY, HIDDEN_TEXT, MAX_CHATS, MAX_MESSAGES, loadChats, redact, removeChat, saveChats, titleFrom, upsertChat, type Chat, type KV, type StoredMsg } from './chatStore';

const mem = (): KV & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};
const msg = (id: number, who: 'you' | 'guide', text: string): StoredMsg => ({ id, who, text });
const chat = (id: string, messages: StoredMsg[]): Chat => ({ id, oppId: 'x', title: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages });

describe('chatStore', () => {
  it('redacts sensitive text', () => {
    expect(redact('my OTP is 123456')).toBe(HIDDEN_TEXT);
    expect(redact('what documents do I need')).toBe('what documents do I need');
  });

  it('titles from first visible user message, truncated', () => {
    expect(titleFrom([])).toBe('New chat');
    expect(titleFrom([msg(1, 'you', HIDDEN_TEXT), msg(2, 'you', 'hello')])).toBe('hello');
    expect(titleFrom([msg(1, 'you', 'a'.repeat(80))]).length).toBeLessThanOrEqual(51);
  });

  it('upsert: newest first, replaces by id, drops empty, caps', () => {
    let list: Chat[] = [];
    list = upsertChat(list, chat('a', [msg(1, 'you', 'one')]));
    list = upsertChat(list, chat('b', [msg(1, 'you', 'two')]));
    expect(list.map((c) => c.id)).toEqual(['b', 'a']);
    list = upsertChat(list, chat('a', [msg(1, 'you', 'one'), msg(2, 'guide', 'r')]));
    expect(list.map((c) => c.id)).toEqual(['a', 'b']);
    expect(upsertChat(list, chat('a', [])).map((c) => c.id)).toEqual(['b']);
    for (let i = 0; i < MAX_CHATS + 5; i++) list = upsertChat(list, chat(`n${i}`, [msg(1, 'you', 'q')]));
    expect(list).toHaveLength(MAX_CHATS);
    const long = upsertChat([], chat('l', Array.from({ length: MAX_MESSAGES + 10 }, (_, i) => msg(i, 'you', 'q'))));
    expect(long[0].messages).toHaveLength(MAX_MESSAGES);
  });

  it('round-trips and survives corrupt storage', () => {
    const s = mem();
    const list = upsertChat([], chat('a', [msg(1, 'you', 'hi')]));
    expect(saveChats(s, list)).toBe(true);
    expect(loadChats(s)[0].id).toBe('a');
    s.data[CHAT_KEY] = '{not json';
    expect(loadChats(s)).toEqual([]);
    s.data[CHAT_KEY] = JSON.stringify([{ id: 1 }, null, { id: 'ok', oppId: 'x', messages: [{ who: 'you', text: 'a' }, { who: 'bad', text: 'b' }] }]);
    const out = loadChats(s);
    expect(out).toHaveLength(1);
    expect(out[0].messages).toHaveLength(1);
  });

  it('removeChat', () => {
    expect(removeChat([chat('a', []), chat('b', [])], 'a').map((c) => c.id)).toEqual(['b']);
  });
});
