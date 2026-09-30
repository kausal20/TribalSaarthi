import { describe, expect, it } from 'vitest';
import { cleanReply, sanitizeCatalogue, sanitizeScheme, schemePrompt } from './guide.mjs';

describe('guide input sanitising', () => {
  it('rejects bad ids and unsafe urls, clamps lengths', () => {
    expect(sanitizeScheme({ id: '<x>' })).toBeNull();
    const s = sanitizeScheme({ id: 'a-1', title: 'x'.repeat(999), officialUrl: 'javascript:alert(1)', eligibility: ['ok', 5] });
    expect(s.title.length).toBe(160);
    expect(s.officialUrl).toBe('');
    expect(s.eligibility).toEqual(['ok']);
    expect(sanitizeScheme({ id: 'a', officialUrl: 'https://tribal.nic.in/x' }).officialUrl).toBe('https://tribal.nic.in/x');
    expect(sanitizeCatalogue([{ id: 'BAD ID' }])).toBeNull();
  });
  it('prompt carries scheme data and the fallback line', () => {
    const p = schemePrompt(sanitizeScheme({ id: 'a', title: 'T' }));
    expect(p).toContain('"title":"T"');
    expect(p).toContain("I don't have verified information for that");
  });
  it('cleans markdown and past-tense navigation', () => {
    expect(cleanReply('**Hi** I have navigated you to the documents.')).toBe('Hi Opening the documents.');
    expect(cleanReply('## Title\ntext')).toBe('Title\ntext');
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
describe('source hygiene', () => {
  it('no stray control characters (e.g. backspace) in source files', () => {
    const bad = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|js|mjs|css|html)$/.test(f) && /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(readFileSync(p, 'utf8'))) bad.push(p); } };
    for (const d of ['src', 'server', 'extension']) walk(d);
    expect(bad).toEqual([]);
  });
});
