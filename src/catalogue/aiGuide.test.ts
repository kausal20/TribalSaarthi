import { describe, expect, it } from 'vitest';
import { OPPORTUNITIES } from './data';
import { buildSchemeContext } from './aiGuide';
import { emptyDraft, setField } from './drafts';

const opp = OPPORTUNITIES.find((o) => o.id === 'nfst-demo')!;

describe('AI scheme context', () => {
  it('carries progress as labels only, never typed values or file data', () => {
    let d = emptyDraft(opp.id);
    d = setField(d, 'full_name', 'SECRET-NAME-VALUE');
    d = { ...d, docs: [{ key: opp.documents[0].key, name: 'private-file.pdf', mime: 'application/pdf', size: 10, dataUrl: 'data:application/pdf;base64,SECRETFILEBYTES', attachedAt: 'x', confirmed: true }] };
    const ctx = buildSchemeContext(opp, d, 'form');
    const json = JSON.stringify(ctx);
    expect(json).not.toContain('SECRET-NAME-VALUE');
    expect(json).not.toContain('SECRETFILEBYTES');
    expect(json).not.toContain('private-file.pdf');
    expect(ctx.progress.fieldsFilled).toContain('Full name');
    expect(ctx.progress.documentsConfirmed).toEqual([opp.documents[0].label]);
    expect(ctx.currentSection).toBe('form');
  });
  it('includes the scheme data the answers must be grounded in', () => {
    const ctx = buildSchemeContext(opp, undefined, 'overview');
    expect(ctx.id).toBe(opp.id);
    expect(ctx.documents.length).toBe(opp.documents.length);
    expect(ctx.fields.every((f) => f.help)).toBe(true);
  });
});
