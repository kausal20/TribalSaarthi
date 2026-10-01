import { cleanFileName, cleanFillValue, normalizeDocType, normalizeField, normalizeTarget, type CompanionTarget } from '../../server/companion.mjs';

/**
 * The bridge between the AI's JSON answer and the practice form.
 *
 * Everything the AI sends is untrusted: each action is re-checked here (known target, known field, sane value, a file
 * the student actually allowed) before the form changes. The Aadhaar number can never be filled by the assistant.
 */
export type TargetId = CompanionTarget;
export type DocType = 'Aadhaar' | 'Income';
export type FieldKey = 'name' | 'income';

export type BridgeAction =
  | { action: 'NAVIGATE'; target: TargetId }
  | { action: 'AUTO_FILL'; field: FieldKey; value: string }
  | { action: 'MAP_FILE'; documentType: DocType; fileName: string };

export interface CompanionResponse { text: string; actions?: unknown[] }
export interface ParsedResponse { text: string; actions: BridgeAction[]; refused: string[] }

const MAX_ACTIONS = 6;

function toAction(raw: unknown): BridgeAction | string {
  if (!raw || typeof raw !== 'object') return 'Ignored an action that was not an object.';
  const r = raw as Record<string, unknown>;
  switch (String(r.action ?? '').toUpperCase()) {
    case 'NAVIGATE': {
      const target = normalizeTarget(r.target);
      return target ? { action: 'NAVIGATE', target } : `Ignored a move to an unknown section (${String(r.target).slice(0, 30)}).`;
    }
    case 'AUTO_FILL': {
      const field = normalizeField(r.field);
      if (field === 'aadhaar') return 'The Aadhaar number is typed by the student only, so it was not filled.';
      if (field !== 'name' && field !== 'income') return `Ignored an unknown field (${String(r.field).slice(0, 30)}).`;
      const value = cleanFillValue(field, r.value);
      return value === null ? `Skipped a ${field === 'name' ? 'name' : 'income'} value that did not look right.` : { action: 'AUTO_FILL', field, value };
    }
    case 'MAP_FILE': {
      const documentType = normalizeDocType(r.documentType);
      const fileName = cleanFileName(r.fileName);
      return documentType && fileName ? { action: 'MAP_FILE', documentType, fileName } : 'Ignored a file action with an unknown document or file name.';
    }
    default:
      return `Ignored an unknown action (${String(r.action).slice(0, 30)}).`;
  }
}

const tryParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return undefined; } };
const actionsIn = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.actions)) return o.actions;
    if (typeof o.action === 'string') return [o];
  }
  return [];
};

/** A model sometimes writes its JSON inside the text ("```json {...}```" or the whole answer as JSON). */
function jsonInText(text: string): { actions: unknown[]; rest: string } {
  const found: unknown[] = [];
  let rest = text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (whole, body: string) => {
    const v = tryParse(body);
    const list = v === undefined ? [] : actionsIn(v);
    if (!list.length) return whole;
    found.push(...list);
    return '';
  });
  const trimmed = rest.trim();
  if (/^[[{]/.test(trimmed)) {
    const list = actionsIn(tryParse(trimmed));
    if (list.length) { found.push(...list); rest = ''; }
  }
  return { actions: found, rest: rest.trim() };
}

/** Reads a backend answer: `{ text, actions: [...] }`, a bare action object or array, or JSON written inside the text. */
export function readResponse(response: unknown): ParsedResponse {
  let text = '';
  let raw: unknown[] = [];
  if (Array.isArray(response)) raw = response;
  else if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (typeof r.text === 'string') text = r.text;
    raw = Array.isArray(r.actions) ? r.actions : typeof r.action === 'string' ? [r] : [];
  } else if (typeof response === 'string') text = response;
  const inline = jsonInText(text);
  text = inline.rest;
  raw = [...raw, ...inline.actions];
  const actions: BridgeAction[] = [];
  const refused: string[] = [];
  for (const item of raw.slice(0, MAX_ACTIONS)) {
    const parsed = toAction(item);
    if (typeof parsed === 'string') refused.push(parsed); else actions.push(parsed);
  }
  if (raw.length > MAX_ACTIONS) refused.push('Ignored extra actions.');
  return { text, actions, refused };
}

// ---------- the form ----------
export type Tab = 'instructions' | 'form';
export type SlotStatus = 'empty' | 'checking' | 'attached' | 'verified';
export interface FileSlot { status: SlotStatus; fileName?: string }
export interface FormState {
  tab: Tab;
  values: { name: string; aadhaar: string; income: string };
  files: Record<DocType, FileSlot>;
  /** Names of files the student allowed to be checked and whose on-device check did not fail. */
  checked: string[];
  /** Fields the assistant filled and the student has not edited since. */
  aiFilled: FieldKey[];
  /** Bumped on every NAVIGATE so the page scrolls even when the target repeats. */
  focus: { target: TargetId; n: number } | null;
}

export const initialForm: FormState = {
  tab: 'instructions',
  values: { name: '', aadhaar: '', income: '' },
  files: { Aadhaar: { status: 'empty' }, Income: { status: 'empty' } },
  checked: [],
  aiFilled: [],
  focus: null,
};

export const TARGET_LABEL: Record<TargetId, string> = {
  instructions: 'Instructions',
  form_section: 'Application form',
  personal_details: 'Personal details',
  income_details: 'Income details',
  documents: 'Documents',
};
export const FIELD_LABEL: Record<FieldKey, string> = { name: 'Full Name', income: 'Income Amount' };
export const DOC_LABEL: Record<DocType, string> = { Aadhaar: 'Aadhaar Card', Income: 'Income Certificate' };

export interface Applied { state: FormState; ok: boolean; note: string }

/** Applies one validated action. The AI may replace its own earlier fill, never what the student typed. */
export function applyAction(state: FormState, a: BridgeAction): Applied {
  switch (a.action) {
    case 'NAVIGATE': {
      const tab: Tab = a.target === 'instructions' ? 'instructions' : 'form';
      return { ok: true, note: `Opened ${TARGET_LABEL[a.target]}`, state: { ...state, tab, focus: { target: a.target, n: (state.focus?.n ?? 0) + 1 } } };
    }
    case 'AUTO_FILL': {
      const current = state.values[a.field];
      if (current === a.value) return { ok: true, note: `${FIELD_LABEL[a.field]} already matched`, state };
      if (current && !state.aiFilled.includes(a.field)) return { ok: false, note: `Kept the ${FIELD_LABEL[a.field]} you typed`, state };
      return {
        ok: true,
        note: `Filled ${FIELD_LABEL[a.field]}`,
        state: { ...state, values: { ...state.values, [a.field]: a.value }, aiFilled: state.aiFilled.includes(a.field) ? state.aiFilled : [...state.aiFilled, a.field] },
      };
    }
    case 'MAP_FILE': {
      if (!state.checked.includes(a.fileName)) return { ok: false, note: `Skipped “${a.fileName}”: it was not checked on your device`, state };
      return {
        ok: true,
        note: `Attached ${a.fileName} to ${DOC_LABEL[a.documentType]}`,
        state: { ...state, files: { ...state.files, [a.documentType]: { status: 'verified', fileName: a.fileName } } },
      };
    }
  }
}

/** The student typed in a field: it is theirs again. */
export function typeInto(state: FormState, field: 'name' | 'aadhaar' | 'income', value: string): FormState {
  return { ...state, values: { ...state.values, [field]: value }, aiFilled: state.aiFilled.filter((f) => f !== field) };
}

export const aadhaarDigits = (v: string) => v.replace(/\D/g, '').slice(0, 12);
export const formatAadhaar = (v: string) => aadhaarDigits(v).replace(/(\d{4})(?=\d)/g, '$1 ');
export const aadhaarComplete = (v: string) => aadhaarDigits(v).length === 12;

export const PROGRESS_TOTAL = 5;
/** How many of the five things on the form are done (Aadhaar only counts when all 12 digits are there). */
export function progress(s: FormState): number {
  return [
    s.values.name.trim().length >= 2,
    aadhaarComplete(s.values.aadhaar),
    Number(s.values.income) > 0,
    s.files.Aadhaar.status === 'verified' || s.files.Aadhaar.status === 'attached',
    s.files.Income.status === 'verified' || s.files.Income.status === 'attached',
  ].filter(Boolean).length;
}
