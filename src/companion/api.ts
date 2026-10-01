import { aadhaarComplete, type CompanionResponse, type DocType, type FormState } from './bridge';
import type { FileMeta } from './files';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

/**
 * What the AI service is told about the form. Only which things are filled in: never the typed values
 * (name, Aadhaar number, income) and never file contents.
 */
export function buildContext(form: FormState, pending: FileMeta[]) {
  return {
    step: form.tab,
    fields: [
      { key: 'name', filled: form.values.name.trim().length >= 2 },
      { key: 'aadhaar', filled: aadhaarComplete(form.values.aadhaar) },
      { key: 'income', filled: Number(form.values.income) > 0 },
    ],
    files: (['Aadhaar', 'Income'] as DocType[]).map((documentType) => ({ documentType, status: form.files[documentType].status, fileName: form.files[documentType].fileName })),
    pending: pending.map((p) => ({ name: p.name, kb: p.kb, guess: p.guess, check: p.check, notes: p.notes })),
  };
}

/** Asks the backend (Gemini wrapper). Returns null on ANY failure so the built-in brain can answer instead. */
export async function askCompanion(messages: ChatTurn[], context: ReturnType<typeof buildContext>): Promise<CompanionResponse | null> {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(-10), companion: context }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || typeof (data as { text?: unknown }).text !== 'string') return null;
    return data as CompanionResponse;
  } catch {
    return null;
  }
}
