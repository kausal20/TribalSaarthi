import { useSyncExternalStore } from 'react';

/**
 * Helper mode: a teacher, school clerk or NGO volunteer using TribalSaarthi on behalf of a student.
 * The student's first name is only a label for the helper's own saved chats in this browser; it is never sent to the AI
 * (the AI is told only that a helper is present).
 */
export interface HelperState { on: boolean; student: string }

const KEY = 'tribalsaarthi.helper.v1';
const OFF: HelperState = { on: false, student: '' };

export const cleanStudent = (v: string) => v.replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s+/g, ' ').trimStart().slice(0, 24);

function load(): HelperState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v === 'object' ? { on: v.on === true, student: cleanStudent(String(v.student ?? '')) } : OFF;
  } catch { return OFF; }
}

let state: HelperState = typeof localStorage === 'undefined' ? OFF : load();
const subs = new Set<() => void>();

export function setHelper(patch: Partial<HelperState>) {
  state = { ...state, ...patch, student: patch.student !== undefined ? cleanStudent(patch.student) : state.student };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* helper mode just will not be remembered */ }
  subs.forEach((s) => s());
}
export const useHelper = (): HelperState => useSyncExternalStore((cb) => { subs.add(cb); return () => void subs.delete(cb); }, () => state);
