import { fail, ok, type Result } from '../types';
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from '../engine/files';
import type { Opportunity } from './types';

export const DRAFT_KEY = 'tribalsaarthi.drafts.v1';

export interface DraftDoc {
  key: string;
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
  attachedAt: string;
  /** true after the student clicks "Confirm upload" on the simulated provider page */
  confirmed: boolean;
}

export interface Draft {
  oppId: string;
  fields: Record<string, string>;
  docs: DraftDoc[];
  updatedAt: string;
  submittedAt?: string;
}

export type Drafts = Record<string, Draft>;
export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadDrafts(storage: KV): Drafts {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

export function saveDrafts(storage: KV, d: Drafts): Result<null> {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(d));
    return ok(null);
  } catch {
    return fail('Browser storage is full or blocked. Your last change was NOT saved.');
  }
}

export const emptyDraft = (oppId: string): Draft => ({ oppId, fields: {}, docs: [], updatedAt: new Date().toISOString() });
const now = () => new Date().toISOString();

export function setField(d: Draft, key: string, value: string): Draft {
  return { ...d, fields: { ...d.fields, [key]: value }, updatedAt: now() };
}

export function attach(d: Draft, opp: Opportunity, input: Omit<DraftDoc, 'attachedAt' | 'confirmed'>): Result<Draft> {
  const def = opp.documents.find((x) => x.key === input.key);
  if (!def) return fail('Unknown document slot.');
  if (!def.acceptedTypes.includes(input.mime)) return fail(`"${def.label}" does not accept this file type.`);
  if (input.size > MAX_FILE_BYTES) return fail('File is over the size limit.');
  const others = d.docs.filter((x) => x.key !== input.key).reduce((n, x) => n + x.size, 0);
  if (others + input.size > MAX_TOTAL_BYTES) return fail('Total attachment size limit exceeded.');
  const doc: DraftDoc = { ...input, attachedAt: now(), confirmed: false };
  return ok({ ...d, docs: [...d.docs.filter((x) => x.key !== input.key), doc], submittedAt: undefined, updatedAt: now() });
}

export const removeDoc = (d: Draft, key: string): Draft => ({ ...d, docs: d.docs.filter((x) => x.key !== key), submittedAt: undefined, updatedAt: now() });

export const confirmDoc = (d: Draft, key: string): Draft => ({
  ...d,
  docs: d.docs.map((x) => (x.key === key ? { ...x, confirmed: true } : x)),
  updatedAt: now(),
});

/** Missing required fields / unconfirmed documents that block the simulated submit. */
export function submitBlockers(d: Draft, opp: Opportunity): string[] {
  const out: string[] = [];
  for (const f of opp.fields) if (f.required && !(d.fields[f.key] ?? '').trim()) out.push(`${f.label} is empty`);
  for (const doc of opp.documents) {
    const a = d.docs.find((x) => x.key === doc.key);
    if (!a) out.push(`${doc.label} is not attached`);
    else if (!a.confirmed) out.push(`${doc.label} upload is not confirmed`);
  }
  return out;
}

export function markSubmitted(d: Draft, opp: Opportunity): Result<Draft> {
  const b = submitBlockers(d, opp);
  if (b.length) return fail(`Cannot submit yet: ${b.join('; ')}.`);
  return ok({ ...d, submittedAt: now(), updatedAt: now() });
}

export function draftLabel(d: Draft, opp: Opportunity): string {
  if (d.submittedAt) return 'Marked submitted on the simulated provider page (demo only)';
  const attached = d.docs.length;
  return `Draft — ${attached} of ${opp.documents.length} document(s) attached, not verified`;
}

