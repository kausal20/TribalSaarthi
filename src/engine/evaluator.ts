import type { Application, CheckResult, Scheme } from '../types';

type Evaluable = Pick<Application, 'studentFields' | 'documents'>;

/**
 * Pure, deterministic completeness checker. Used unchanged for every scheme.
 * It never marks a document verified and never decides eligibility or selection.
 */
export function evaluate(scheme: Scheme, app: Evaluable): CheckResult[] {
  const results: CheckResult[] = [];

  for (const f of scheme.fields) {
    if (!f.required) continue;
    const value = (app.studentFields[f.key] ?? '').trim();
    const invalidOption = f.type === 'select' && value !== '' && !(f.options ?? []).includes(value);
    if (value === '' || invalidOption) {
      results.push({
        ruleId: `FIELD_${f.key}`,
        kind: 'FIELD',
        key: f.key,
        label: f.label,
        severity: 'MISSING',
        state: 'missing',
        explanation: invalidOption
          ? `"${f.label}" holds a value that is not one of the configured options.`
          : `"${f.label}" is a required field and is empty.`,
        remedy: f.type === 'select' ? `Choose an option for "${f.label}".` : `Fill in "${f.label}".`,
      });
    } else {
      results.push({
        ruleId: `FIELD_${f.key}`,
        kind: 'FIELD',
        key: f.key,
        label: f.label,
        severity: 'INFO',
        state: 'field_supplied',
        explanation: `"${f.label}" supplied. Content is self-declared and not verified.`,
        remedy: 'No action needed.',
      });
    }
  }

  for (const d of scheme.requiredDocuments) {
    const doc = app.documents.find((x) => x.key === d.key);
    const base = { ruleId: `DOC_${d.key}`, kind: 'DOC' as const, key: d.key, label: d.label, why: d.why };
    if (!doc) {
      results.push({
        ...base,
        severity: 'MISSING',
        state: 'missing',
        explanation: `Required document "${d.label}" has not been attached.`,
        remedy: `Attach "${d.label}" (${acceptedLabel(d.acceptedTypes)}) and resubmit.`,
      });
    } else if (!d.acceptedTypes.includes(doc.mime)) {
      results.push({
        ...base,
        severity: 'MISSING',
        state: 'wrong_type',
        explanation: `The attached file for "${d.label}" is ${doc.mime}, but this scheme accepts ${acceptedLabel(d.acceptedTypes)}.`,
        remedy: `Replace it with a ${acceptedLabel(d.acceptedTypes)} file.`,
      });
    } else if (doc.verification === 'HUMAN_REVIEWED') {
      results.push({
        ...base,
        severity: 'INFO',
        state: 'human_reviewed',
        explanation: `"${d.label}" was reviewed by a human officer.`,
        remedy: 'No action needed.',
      });
    } else {
      results.push({
        ...base,
        severity: 'NEEDS_REVIEW',
        state: 'present_unverified',
        explanation: `"${d.label}" is attached; authenticity not verified. Needs human review.`,
        remedy: 'Waiting for officer review.',
      });
    }
  }

  return results;
}

export const deficiencies = (results: CheckResult[]) => results.filter((r) => r.severity === 'MISSING');

export function acceptedLabel(mimes: string[]): string {
  const map: Record<string, string> = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG' };
  return mimes.map((m) => map[m] ?? m).join(' / ');
}

/** Share of required items complete. UI convenience only, not an eligibility score. */
export function completeness(results: CheckResult[]): { done: number; total: number } {
  return { done: results.filter((r) => r.severity !== 'MISSING').length, total: results.length };
}
