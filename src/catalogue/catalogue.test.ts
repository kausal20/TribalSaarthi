import { DEFAULT_FILTERS, applyFilters, restoreFilters } from './filters';
import { describe, expect, it } from 'vitest';
import { OPPORTUNITIES } from './data';
import { FALLBACK, respond } from './assistant';
import { attach, confirmDoc, emptyDraft, loadDrafts, markSubmitted, removeDoc, saveDrafts, setField, submitBlockers, type KV } from './drafts';

const nfst = OPPORTUNITIES.find((o) => o.id === 'nfst-demo')!;
const nos = OPPORTUNITIES.find((o) => o.id === 'nos-demo')!;
const ctx = { attachedKeys: [] as string[] };
const pdf = { key: 'study_proof', name: 's.pdf', mime: 'application/pdf', size: 500, dataUrl: 'data:application/pdf;base64,AA==' };

describe('catalogue data', () => {
  it('real schemes carry their official source; practice examples are marked demo', () => {
    const real = OPPORTUNITIES.filter((o) => !o.demoOnly);
    expect(real.length).toBeGreaterThanOrEqual(8);
    for (const o of real) {
      expect(o.official, o.id).toBeDefined();
      expect(o.official!.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.official!.applyUrl).toMatch(/^https:\/\/[a-z0-9.-]+\.(gov\.in|nic\.in)\//);
      expect(o.verifiedSourceUrl).toMatch(/^https:\/\/[a-z0-9.-]+\.(gov\.in|nic\.in)\//);
      expect(o.official!.benefits.length).toBeGreaterThan(0);
      expect(JSON.stringify(o), `${o.id} must not use demo wording`).not.toMatch(/illustrative/i);
      expect(o.deadline.set, 'no unverified deadline dates').toBe(false);
    }
    for (const o of OPPORTUNITIES.filter((x) => x.demoOnly)) expect(o.official).toBeUndefined();
    expect(new Set(OPPORTUNITIES.map((o) => o.id)).size).toBe(OPPORTUNITIES.length);
  });
  it('has entries with required shape', () => {
    expect(OPPORTUNITIES.length).toBeGreaterThanOrEqual(3);
    for (const o of OPPORTUNITIES) {
      expect(o.verifiedSourceUrl).toMatch(/^https:/);
      expect(o.assistantKnowledge.length).toBeGreaterThan(0);
      for (const k of o.assistantKnowledge) expect(o.sections.some((s) => s.id === k.targetSectionId)).toBe(true);
    }
  });
});

describe('assistant', () => {
  it('navigates to documents for the document-list question', () => {
    const r = respond(nfst, 'Which page has the document list?', ctx);
    expect(r.navigate?.section).toBe('documents');
    expect(r.text).toContain('Proof of enrolment');
  });
  it('navigates to the form', () => {
    expect(respond(nfst, 'take me to application form', ctx).navigate?.section).toBe('form');
    expect(respond(nfst, 'Where do I apply?', ctx).navigate?.section).toBe('form');
  });
  it('uses each scheme’s own data', () => {
    expect(respond(nos, 'what should I upload?', ctx).text).toContain('Overseas admission proof');
    expect(respond(nfst, 'what should I upload?', ctx).text).not.toContain('Overseas admission proof');
  });
  it('explains a named field and the active field from configured help', () => {
    expect(respond(nfst, 'what does research topic mean?', ctx).text).toContain('short title');
    const r = respond(nfst, 'explain this field', { ...ctx, activeField: 'institution' });
    expect(r.text).toContain('university or institute');
    expect(respond(nfst, 'explain this field', ctx).text).toMatch(/first/);
  });
  it('reports the uploaded list from draft state', () => {
    const r = respond(nfst, 'check my uploaded list', { attachedKeys: ['study_proof'] });
    expect(r.text).toContain('Proof of enrolment in research programme: attached — not verified');
    expect(r.text).toContain('Academic record (sample): not attached yet');
  });
  it('reports completed fields and explains there is no registration page', () => {
    expect(respond(nfst, 'check what I have completed', { attachedKeys: [], filledFieldKeys: ['full_name'] }).text).toContain('Full name: filled');
    const r = respond(nfst, 'take me to registration', ctx);
    expect(r.text).toMatch(/no separate registration/);
    expect(r.navigate?.section).toBe('form');
  });
  it('answers recommendation questions instead of the fallback', () => {
    const r = respond(nfst, 'i am 17 yers old student which is best scolership for me', ctx);
    expect(r.text).not.toBe(FALLBACK);
    expect(r.text).toMatch(/Which class or course/);
  });
  it('falls back safely on unknown questions', () => {
    const r = respond(nfst, 'who won the cricket match', ctx);
    expect(r.kind).toBe('fallback');
    expect(r.text.startsWith(FALLBACK)).toBe(true);
  });
  it('answers small talk like a person, not with the fallback', () => {
    for (const m of ['what you name', 'what can you hel me', 'what can you do fro me', 'who are you']) {
      const r = respond(nfst, m, ctx);
      expect(r.kind, m).toBe('answer');
      expect(r.text, m).toContain('Saarthi AI');
    }
    expect(respond(nfst, 'thanks', ctx).kind).toBe('answer');
  });
  it('refuses sensitive data', () => {
    expect(respond(nfst, 'my OTP is 123456', ctx).kind).toBe('safety');
    expect(respond(nfst, 'here is my password', ctx).kind).toBe('safety');
  });
  it('never promises selection', () => {
    expect(respond(nfst, 'will I get the award?', ctx).text).toMatch(/do not have verified/i);
  });
});

describe('drafts', () => {
  it('attach requires an accepted type and starts unconfirmed', () => {
    const d = emptyDraft(nfst.id);
    expect(attach(d, nfst, { ...pdf, key: 'nope' }).ok).toBe(false);
    expect(attach(emptyDraft(nos.id), nos, { ...pdf, key: 'overseas_admission_proof', mime: 'image/png' }).ok).toBe(false);
    const r = attach(d, nfst, pdf);
    expect(r.ok && r.value.docs[0].confirmed).toBe(false);
  });
  it('submit blocked until fields filled and uploads confirmed by the student', () => {
    let d = emptyDraft(nfst.id);
    expect(submitBlockers(d, nfst).length).toBeGreaterThan(0);
    for (const f of nfst.fields) d = setField(d, f.key, f.type === 'select' ? f.options![0] : 'x');
    for (const doc of nfst.documents) {
      const a = attach(d, nfst, { ...pdf, key: doc.key });
      if (!a.ok) throw new Error(a.error);
      d = a.value;
    }
    expect(markSubmitted(d, nfst).ok).toBe(false); // unconfirmed
    for (const doc of nfst.documents) d = confirmDoc(d, doc.key);
    const s = markSubmitted(d, nfst);
    expect(s.ok && s.value.submittedAt).toBeTruthy();
    expect(removeDoc(d, 'study_proof').submittedAt).toBeUndefined();
  });
  it('persists and reports quota failure', () => {
    const m = new Map<string, string>();
    const kv: KV = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
    const d = { [nfst.id]: setField(emptyDraft(nfst.id), 'full_name', 'Asha Demo') };
    expect(saveDrafts(kv, d).ok).toBe(true);
    expect(loadDrafts(kv)[nfst.id].fields.full_name).toBe('Asha Demo');
    m.set('tribalsaarthi.drafts.v1', '{bad');
    expect(loadDrafts(kv)).toEqual({});
    const full: KV = { getItem: () => null, setItem: () => { throw new Error('q'); }, removeItem: () => {} };
    expect(saveDrafts(full, d).ok).toBe(false);
  });
});


describe('restored discovery filters', () => {
  it('preserves valid selections and produces the same results', () => {
    const selected = { ...DEFAULT_FILTERS, level: 'research' as const, openOnly: true };
    expect(applyFilters(OPPORTUNITIES, restoreFilters(JSON.stringify(selected)))).toEqual(applyFilters(OPPORTUNITIES, selected));
  });
  it('recovers from corrupt or outdated storage', () => {
    for (const raw of ['broken', 'null', '[]', '{"q":42,"level":"invalid","openOnly":"false"}']) {
      expect(restoreFilters(raw)).toEqual(DEFAULT_FILTERS);
    }
  });
});
