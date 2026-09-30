import { useSyncExternalStore } from 'react';
import { fail, ok, type Application, type Result } from './types';
import { loadState, resetState, saveState, STORAGE_KEY, type DemoState } from './engine/storage';

// ---------- demo data store (localStorage, fictional data only) ----------
const initial = loadState(localStorage);
let state: DemoState = initial.state;
let loadWarning: string | undefined = initial.warning;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const getState = () => state;
export const useDemoState = () => useSyncExternalStore(subscribe, getState);
export const getLoadWarning = () => loadWarning;
export const dismissLoadWarning = () => {
  loadWarning = undefined;
  emit();
};

/** Applies a change and persists it. If saving fails the change is NOT kept and the error is returned. */
export function mutate(fn: (s: DemoState) => Result<DemoState>): Result<null> {
  const r = fn(state);
  if (!r.ok) return r;
  const saved = saveState(localStorage, r.value);
  if (!saved.ok) return saved;
  state = r.value;
  emit();
  return ok(null);
}

export function updateApp(id: string, fn: (a: Application) => Result<Application>): Result<null> {
  return mutate((s) => {
    const cur = s.applications.find((a) => a.id === id);
    if (!cur) return fail('Application not found.');
    const r = fn(cur);
    if (!r.ok) return r;
    return ok({ ...s, applications: s.applications.map((a) => (a.id === id ? r.value : a)) });
  });
}

export function addApp(app: Application): Result<null> {
  return mutate((s) => ok({ ...s, applications: [...s.applications, app] }));
}

export function doReset() {
  state = resetState(localStorage);
  emit();
}

// Keep two tabs (student / officer) in sync.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY || e.key === null) {
    state = loadState(localStorage).state;
    emit();
  }
});

// ---------- UI prefs: demo role switch + toast ----------
export type Persona = 'asha' | 'ravi' | 'officer' | 'admin';
export const PERSONAS: Record<Persona, { label: string; role: 'STUDENT' | 'OFFICER' | 'ADMIN'; applicantId?: string; name?: string }> = {
  asha: { label: 'Student — Asha Demo', role: 'STUDENT', applicantId: 'demo-asha', name: 'Asha Demo' },
  ravi: { label: 'Student — Ravi Demo', role: 'STUDENT', applicantId: 'demo-ravi', name: 'Ravi Demo' },
  officer: { label: 'Scrutiny officer (demo)', role: 'OFFICER' },
  admin: { label: 'Scheme admin (demo)', role: 'ADMIN' },
};

const PREF_KEY = 'schemepath.demo.ui';
const readPersona = (): Persona => {
  try {
    const v = localStorage.getItem(PREF_KEY) as Persona | null;
    if (v && v in PERSONAS) return v;
  } catch {
    /* prefs are optional */
  }
  return 'asha';
};

interface UI {
  persona: Persona;
  toast?: { kind: 'ok' | 'error'; text: string; n: number };
}
let ui: UI = { persona: readPersona() };
const uiListeners = new Set<() => void>();
const uiEmit = () => uiListeners.forEach((l) => l());
export const useUI = () =>
  useSyncExternalStore(
    (l) => {
      uiListeners.add(l);
      return () => void uiListeners.delete(l);
    },
    () => ui,
  );

export function setPersona(p: Persona) {
  ui = { ...ui, persona: p };
  try {
    localStorage.setItem(PREF_KEY, p);
  } catch {
    /* ignore */
  }
  uiEmit();
}

let toastN = 0;
export function toast(kind: 'ok' | 'error', text: string) {
  ui = { ...ui, toast: { kind, text, n: ++toastN } };
  uiEmit();
}
export function clearToast() {
  ui = { ...ui, toast: undefined };
  uiEmit();
}

/** Runs a store operation and shows a visible outcome. Returns true on real success. */
export function report(r: Result<unknown>, success: string): boolean {
  if (r.ok) toast('ok', success);
  else toast('error', r.error);
  return r.ok;
}
