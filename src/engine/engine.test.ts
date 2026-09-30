import { describe, expect, it } from 'vitest';
import { evaluate, deficiencies } from './evaluator';
import { SEED_SCHEMES } from './seed';
import {
  attachDocument,
  checkTransition,
  createApplication,
  markDocumentReviewed,
  markReadyForSelectionReview,
  recordFollowup,
  removeDocument,
  requestCorrection,
  startReview,
  submit,
} from './workflow';
import { STORAGE_KEY, currentSchemes, loadState, publishVersion, resetState, saveState, seedState, type KV } from './storage';
import { MAX_FILE_BYTES, makeSamplePdf, sanitizeFilename, sniffMatches, validateFile } from './files';
import { computeAnalytics } from './analytics';
import { answer } from './assistant';
import type { Application } from '../types';

const [A, B] = SEED_SCHEMES;
const PDF = 'application/pdf';

const fields = { full_name: 'Asha Demo', institution: 'Demo University', study_type: 'PhD', research_topic: 'Demo topic' };
const doc = (key: string, mime = PDF) => ({ key, name: `${key}.pdf`, mime, size: 500, dataUrl: 'data:application/pdf;base64,AA==' });
const must = <T,>(r: { ok: boolean; value?: T; error?: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value as T;
};

function memoryStorage(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function submittedA(): Application {
  const app = createApplication(A, 'demo-asha', 'Asha Demo');
  return must(submit(app, fields));
}

describe('1. Scheme A and B give different DOC failures on same data', () => {
  it('reports different rule IDs from the same evaluator', () => {
    const data = { studentFields: { ...fields, destination_country: 'X', course_name: 'Y' }, documents: [] };
    const a = deficiencies(evaluate(A, data)).map((r) => r.ruleId);
    const b = deficiencies(evaluate(B, data)).map((r) => r.ruleId);
    expect(a).toContain('DOC_study_proof');
    expect(a).not.toContain('DOC_overseas_admission_proof');
    expect(b).toContain('DOC_overseas_admission_proof');
    expect(b).not.toContain('DOC_study_proof');
  });
});

describe('2. Attaching a document resolves MISSING but stays UNVERIFIED', () => {
  it('moves to present-unverified, never verified', () => {
    let app = submittedA();
    expect(deficiencies(evaluate(app.schemeSnapshot, app)).map((r) => r.ruleId)).toContain('DOC_study_proof');
    app = must(attachDocument(app, doc('study_proof')));
    const r = evaluate(app.schemeSnapshot, app).find((x) => x.ruleId === 'DOC_study_proof')!;
    expect(r.severity).toBe('NEEDS_REVIEW');
    expect(r.state).toBe('present_unverified');
    expect(app.documents[0].verification).toBe('UNVERIFIED');
  });
  it('evaluate() does not mutate documents', () => {
    const app = must(attachDocument(submittedA(), doc('study_proof')));
    evaluate(app.schemeSnapshot, app);
    expect(app.documents[0].verification).toBe('UNVERIFIED');
  });
});

describe('3. Scheme edits do not change in-flight snapshots', () => {
  it('new version applies to new applications only', () => {
    const state = seedState();
    const app = createApplication(A, 'demo-asha', 'Asha Demo');
    const edited = structuredClone(A);
    edited.requiredDocuments.push({ key: 'extra_doc', label: 'Extra', acceptedTypes: [PDF], why: 'x' });
    const next = must(publishVersion(state, edited));
    const cur = currentSchemes(next).find((s) => s.id === A.id)!;
    expect(cur.version).toBe(2);
    expect(next.schemes.filter((s) => s.id === A.id)).toHaveLength(2); // old version kept
    expect(app.schemeVersion).toBe(1);
    expect(app.schemeSnapshot.requiredDocuments).toHaveLength(2);
    expect(evaluate(app.schemeSnapshot, app).some((r) => r.ruleId === 'DOC_extra_doc')).toBe(false);
    const fresh = createApplication(cur, 'demo-ravi', 'Ravi Demo');
    expect(evaluate(fresh.schemeSnapshot, fresh).some((r) => r.ruleId === 'DOC_extra_doc')).toBe(true);
  });
  it('rejects duplicate keys', () => {
    const edited = structuredClone(A);
    edited.fields.push({ ...edited.fields[0] });
    expect(publishVersion(seedState(), edited).ok).toBe(false);
  });
});

describe('4. Submit/resubmit keeps ID and log; reload keeps events', () => {
  it('stable ID, append-only events, persisted through storage', () => {
    let app = submittedA();
    const id = app.id;
    const firstEvents = app.events.map((e) => e.id);
    expect(app.status).toBe('SUBMITTED');
    app = must(attachDocument(app, doc('study_proof')));
    app = must(submit(app, fields, 'added proof'));
    expect(app.status).toBe('RESUBMITTED');
    expect(app.id).toBe(id);
    expect(app.events.slice(0, firstEvents.length).map((e) => e.id)).toEqual(firstEvents);

    const store = memoryStorage();
    const state = { ...seedState(), applications: [app] };
    expect(saveState(store, state).ok).toBe(true);
    const loaded = loadState(store).state.applications[0];
    expect(loaded.id).toBe(id);
    expect(loaded.events).toHaveLength(app.events.length);
  });
  it('blocks submit on empty mandatory field; allows missing documents', () => {
    const app = createApplication(A, 'demo-asha', 'Asha Demo');
    const bad = submit(app, { ...fields, institution: '' });
    expect(bad.ok).toBe(false);
    expect(submit(app, fields).ok).toBe(true);
  });
});

describe('5. Officer reason propagates to applicant timeline', () => {
  it('correction reason is stored verbatim as an event', () => {
    let app = submittedA();
    app = must(startReview(app));
    app = must(requestCorrection(app, 'Proof is cropped; please re-attach full page.'));
    expect(app.status).toBe('NEEDS_CORRECTION');
    const ev = app.events.at(-1)!;
    expect(ev.type).toBe('CORRECTION_REQUESTED');
    expect(ev.actorRole).toBe('OFFICER');
    expect(ev.message).toBe('Proof is cropped; please re-attach full page.');
  });
  it('requires a reason', () => {
    expect(requestCorrection(must(startReview(submittedA())), '  ').ok).toBe(false);
  });
});

describe('6. Invalid transitions rejected; award cannot be automatic', () => {
  it('rejects skipping states and wrong roles', () => {
    const app = submittedA();
    expect(markReadyForSelectionReview(app, 'skip attempt').ok).toBe(false);
    expect(checkTransition(app, 'READY_FOR_SELECTION_REVIEW', 'OFFICER').ok).toBe(false);
    expect(checkTransition(app, 'UNDER_REVIEW', 'STUDENT').ok).toBe(false);
    expect(checkTransition(app, 'AWARDED', 'OFFICER').ok).toBe(false);
    expect(checkTransition(app, 'AWARDED', 'SYSTEM').ok).toBe(false);
  });
  it('ready requires no missing items and human-reviewed documents', () => {
    let app = must(startReview(must(attachDocument(submittedA(), doc('study_proof')))));
    expect(markReadyForSelectionReview(app, 'looks fine').ok).toBe(false); // academic_record missing
    expect(attachDocument(app, doc('academic_record')).ok).toBe(false); // locked while under review
  });
  it('full path to ready needs human review; follow-up is event-only', () => {
    let app = submittedA();
    app = must(attachDocument(app, doc('study_proof')));
    app = must(attachDocument(app, doc('academic_record')));
    app = must(submit(app, fields));
    app = must(startReview(app));
    expect(markReadyForSelectionReview(app, 'ready now').ok).toBe(false); // unreviewed
    app = must(markDocumentReviewed(app, 'study_proof'));
    app = must(markDocumentReviewed(app, 'academic_record'));
    expect(recordFollowup(app, 'Progress check recorded').ok).toBe(false); // not ready yet
    app = must(markReadyForSelectionReview(app, 'all reviewed by officer'));
    expect(app.status).toBe('READY_FOR_SELECTION_REVIEW');
    const after = must(recordFollowup(app, 'Progress check recorded'));
    expect(after.status).toBe('READY_FOR_SELECTION_REVIEW');
    expect(after.events.at(-1)!.type).toBe('POST_SELECTION_FOLLOWUP_DEMO');
    expect(after.events.at(-1)!.message).toMatch(/SIMULATED/);
    expect(checkTransition(after, 'UNDER_REVIEW', 'OFFICER').ok).toBe(false); // terminal
  });
  it('replacing a reviewed file resets it to unverified; removal logs an event', () => {
    let app = must(attachDocument(createApplication(A, 'x', 'X'), doc('study_proof')));
    app.documents[0].verification = 'HUMAN_REVIEWED';
    app = must(attachDocument(app, doc('study_proof')));
    expect(app.documents[0].verification).toBe('UNVERIFIED');
    app = must(removeDocument(app, 'study_proof'));
    expect(app.events.at(-1)!.type).toBe('DOCUMENT_REMOVED');
  });
});

describe('7. Bad files produce visible errors', () => {
  const accepted = [PDF, 'image/png'];
  it('wrong type, svg, exe, oversized, empty, total cap', () => {
    expect(validateFile({ name: 'a.txt', type: 'text/plain', size: 10 }, accepted)).toMatchObject({ ok: false });
    expect(validateFile({ name: 'a.svg', type: 'image/svg+xml', size: 10 }, accepted)).toMatchObject({ ok: false });
    expect(validateFile({ name: 'a.exe', type: 'application/octet-stream', size: 10 }, accepted)).toMatchObject({ ok: false });
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }, accepted)).toMatchObject({ ok: false }); // not accepted for slot
    const big = validateFile({ name: 'a.pdf', type: PDF, size: MAX_FILE_BYTES + 1 }, accepted);
    expect(big).toMatchObject({ ok: false });
    expect(validateFile({ name: 'a.pdf', type: PDF, size: 0 }, accepted)).toMatchObject({ ok: false });
    expect(validateFile({ name: 'a.pdf', type: PDF, size: 900_000 }, accepted, 2_500_000)).toMatchObject({ ok: false });
    expect(validateFile({ name: 'a.pdf', type: PDF, size: 900 }, accepted)).toMatchObject({ ok: true });
  });
  it('content sniffing catches renamed/corrupt files and accepts the generated sample PDF', () => {
    expect(sniffMatches(new TextEncoder().encode('not a pdf at all'), PDF)).toBe(false);
    expect(sniffMatches(makeSamplePdf('test'), PDF)).toBe(true);
  });
  it('sanitizes file names', () => {
    expect(sanitizeFilename('..\\..\\<script>alert(1).pdf')).not.toMatch(/[<>\\/]/);
  });
  it('corrupt storage falls back to seed with a warning and keeps a backup', () => {
    const store = memoryStorage();
    store.setItem(STORAGE_KEY, '{not json');
    const { state, warning } = loadState(store);
    expect(warning).toBeTruthy();
    expect(state.schemes.length).toBeGreaterThan(0);
    expect(store.data.get(`${STORAGE_KEY}.corrupt-backup`)).toBe('{not json');
  });
  it('storage quota failure is reported, not swallowed', () => {
    const full: KV = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    const r = saveState(full, seedState());
    expect(r.ok).toBe(false);
  });
});

describe('8. Reset restores seed schemes and clears applications', () => {
  it('removes applications and scheme edits', () => {
    const store = memoryStorage();
    const edited = structuredClone(A);
    edited.name = 'Edited';
    const dirty = { ...must(publishVersion(seedState(), edited)), applications: [submittedA()] };
    saveState(store, dirty);
    expect(loadState(store).state.applications).toHaveLength(1);
    const fresh = resetState(store);
    expect(fresh.applications).toHaveLength(0);
    expect(fresh.schemes).toHaveLength(SEED_SCHEMES.length);
    expect(loadState(store).state.applications).toHaveLength(0);
  });
});

describe('extras', () => {
  it('analytics are computed from records', () => {
    const state = { ...seedState(), applications: [submittedA()] };
    const a = computeAnalytics(state);
    expect(a.total).toBe(1);
    expect(a.pending).toBe(1);
    expect(a.deficiencyCounts.map((d) => d.ruleId)).toContain('DOC_study_proof');
  });
  it('assistant answers only from configuration', () => {
    expect(answer('What documents do I need?', A)).toContain('Proof of enrolment');
    expect(answer('Who decides selection?', A)).toMatch(/Nothing in this prototype/);
    expect(answer('write me a poem', A)).toMatch(/only answer/);
  });
});
