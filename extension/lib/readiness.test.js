import { describe, expect, it } from 'vitest';
import { KINDS, buildReadiness } from './readiness.js';

describe('buildReadiness', () => {
  it('reports nothing found as low risk', () => {
    const r = buildReadiness([]);
    expect(r).toMatchObject({ level: 'low', total: 0, blocking: 0, groups: [] });
    expect(r.headline).toBe('Nothing obvious is missing');
  });
  it('treats a missing document or form error as high risk and counts it', () => {
    const r = buildReadiness([{ kind: 'missing-doc', text: 'Income certificate' }, { kind: 'form-error', text: 'Name is empty' }, { kind: 'form-warning', text: 'PIN looks short' }]);
    expect(r.level).toBe('high');
    expect(r.blocking).toBe(2);
    expect(r.total).toBe(3);
    expect(r.headline).toBe('Fix 2 things before you apply');
    expect(r.groups.map((g) => g.kind)).toEqual(['missing-doc', 'form-error', 'form-warning']);
  });
  it('treats warnings alone as medium risk', () => {
    const r = buildReadiness([{ kind: 'form-warning', text: 'PIN looks short' }]);
    expect(r.level).toBe('medium');
    expect(r.headline).toBe('1 thing to double-check');
  });
  it('drops duplicates, blanks and unknown kinds', () => {
    const r = buildReadiness([{ kind: 'doc-problem', text: 'a.pdf: too big' }, { kind: 'doc-problem', text: 'a.pdf: too big' }, { kind: 'doc-problem', text: '  ' }, { kind: 'nope', text: 'x' }, null]);
    expect(r.total).toBe(1);
    expect(r.groups).toEqual([{ kind: 'doc-problem', title: KINDS['doc-problem'], items: ['a.pdf: too big'] }]);
  });
  it('never claims an application will be accepted or rejected', () => {
    expect(buildReadiness([{ kind: 'missing-doc', text: 'x' }]).note).toMatch(/not a decision/);
  });
});
