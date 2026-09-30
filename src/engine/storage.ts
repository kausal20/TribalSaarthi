import { fail, ok, type Application, type Result, type Scheme } from '../types';
import { SEED_SCHEMES } from './seed';

export const STORAGE_KEY = 'schemepath.demo.v1';
export const SCHEMA_VERSION = 1;

export interface DemoState {
  schemaVersion: number;
  schemes: Scheme[]; // every published version of every scheme
  applications: Application[];
}

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const seedState = (): DemoState => ({
  schemaVersion: SCHEMA_VERSION,
  schemes: structuredClone(SEED_SCHEMES),
  applications: [],
});

function looksValid(x: unknown): x is DemoState {
  const s = x as DemoState;
  return (
    !!s &&
    s.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(s.schemes) &&
    s.schemes.length > 0 &&
    Array.isArray(s.applications) &&
    s.applications.every((a) => a && a.id && a.schemeSnapshot && Array.isArray(a.events) && Array.isArray(a.documents))
  );
}

/** Loads state. On corrupt/mismatched data, keeps a backup copy, falls back to seed and returns a visible warning. */
export function loadState(storage: KV): { state: DemoState; warning?: string } {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { state: seedState() };
  try {
    const parsed = JSON.parse(raw);
    if (looksValid(parsed)) return { state: parsed };
    throw new Error('schema mismatch');
  } catch {
    try {
      storage.setItem(`${STORAGE_KEY}.corrupt-backup`, raw);
    } catch {
      /* backup is best effort */
    }
    return {
      state: seedState(),
      warning:
        'Saved demo data was unreadable or from another version. Started from fresh seed data (the old copy was kept as a backup key).',
    };
  }
}

export function saveState(storage: KV, state: DemoState): Result<null> {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return ok(null);
  } catch {
    return fail(
      'Browser storage is full or blocked. Your last change was NOT saved; existing records are unchanged. Remove an attachment or reset the demo.',
    );
  }
}

export function resetState(storage: KV): DemoState {
  const s = seedState();
  storage.removeItem(STORAGE_KEY);
  saveState(storage, s);
  return s;
}

/** Latest published version of each scheme. */
export function currentSchemes(state: DemoState): Scheme[] {
  const byId = new Map<string, Scheme>();
  for (const s of state.schemes) {
    const cur = byId.get(s.id);
    if (!cur || s.version > cur.version) byId.set(s.id, s);
  }
  return [...byId.values()];
}

export const schemeHistory = (state: DemoState, id: string) =>
  state.schemes.filter((s) => s.id === id).sort((a, b) => a.version - b.version);

const KEY_RE = /^[a-z][a-z0-9_]*$/;

/** Publishes an edited scheme as a NEW version; prior versions are never modified. */
export function publishVersion(state: DemoState, edited: Scheme, now = new Date().toISOString()): Result<DemoState> {
  if (!edited.name.trim()) return fail('Scheme name is required.');
  if (edited.fields.length === 0) return fail('A scheme needs at least one field.');
  const seen = new Set<string>();
  for (const k of [...edited.fields.map((f) => f.key), ...edited.requiredDocuments.map((d) => `doc:${d.key}`)]) {
    if (seen.has(k)) return fail(`Duplicate key "${k}".`);
    seen.add(k);
  }
  for (const f of edited.fields) {
    if (!KEY_RE.test(f.key) || !f.label.trim()) return fail(`Field "${f.key}" needs a lowercase key and a label.`);
  }
  for (const d of edited.requiredDocuments) {
    if (!KEY_RE.test(d.key) || !d.label.trim()) return fail(`Document "${d.key}" needs a lowercase key and a label.`);
    if (d.acceptedTypes.length === 0) return fail(`Document "${d.label}" must accept at least one file type.`);
  }
  const latest = Math.max(...state.schemes.filter((s) => s.id === edited.id).map((s) => s.version), 0);
  if (latest === 0) return fail('Unknown scheme.');
  const next: Scheme = { ...structuredClone(edited), version: latest + 1, publishedAt: now };
  return ok({ ...state, schemes: [...state.schemes, next] });
}
