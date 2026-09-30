import { useSyncExternalStore } from 'react';
import { ok, type Result } from '../types';
import { DRAFT_KEY, emptyDraft, loadDrafts, saveDrafts, type Draft, type Drafts } from './drafts';

let drafts: Drafts = loadDrafts(localStorage);
const ls = new Set<() => void>();
export const useDrafts = () =>
  useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => void ls.delete(l);
    },
    () => drafts,
  );
export const getDrafts = () => drafts;

/** Applies a draft change; if saving fails the change is dropped and the error returned. */
export function updateDraft(oppId: string, fn: (d: Draft) => Result<Draft> | Draft): Result<null> {
  const cur = drafts[oppId] ?? emptyDraft(oppId);
  const r = fn(cur);
  const res: Result<Draft> = 'ok' in r ? (r as Result<Draft>) : ok(r as Draft);
  if (!res.ok) return res;
  const next = { ...drafts, [oppId]: res.value };
  const s = saveDrafts(localStorage, next);
  if (!s.ok) return s;
  drafts = next;
  ls.forEach((l) => l());
  return ok(null);
}

export function clearDrafts() {
  localStorage.removeItem(DRAFT_KEY);
  drafts = {};
  ls.forEach((l) => l());
}
