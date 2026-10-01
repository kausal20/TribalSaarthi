import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HI, PATTERNS } from './i18n-text.js';
import { trans, translateCheck } from './i18n.js';
import { checkDocument, checkFields } from './checks.js';
import { KINDS } from './readiness.js';

const js = readFileSync(new URL('../sidepanel.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../sidepanel.html', import.meta.url), 'utf8');

/** Every string the panel passes to tr(...), plus the lists whose strings reach tr(...) through a variable. */
function panelKeys() {
  const keys = new Set();
  const re = /\btr\(\s*(?:'((?:[^'\\]|\\.)*)'|`([^`$]*)`)/g;
  for (let m = re.exec(js); m; m = re.exec(js)) keys.add((m[1] ?? m[2]).replace(/\\'/g, "'"));
  for (const name of ['GOTO_WHY', 'ATTACH_WHY']) {
    const block = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`).exec(js);
    for (const x of block[1].matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(x[1]);
  }
  const lists = [...js.matchAll(/for \(const (?:q|t) of \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]));
  lists.filter((k) => k !== 'tribal' && k !== 'nsp').forEach((k) => keys.add(k));
  keys.add('the link is not available on this page');
  keys.add('the field may have changed');
  Object.values(KINDS).forEach((k) => keys.add(k));
  keys.add('This is a checklist, not a decision. Only the provider decides whether an application is accepted.');
  return [...keys];
}

/** Text the panel shows without any code: element text (plain or with <br>) and aria-label/title/placeholder. */
function staticKeys() {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<option[\s\S]*?<\/option>/g, '');
  const dec = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const keys = new Set();
  for (const m of body.matchAll(/<([a-z0-9]+)\b[^>]*>((?:[^<]|<br\s*\/?>)+)<\/\1>/gi)) {
    const t = dec(m[2].replace(/<br\s*\/?>/gi, '\n')).split('\n').map((x) => x.trim()).join('\n').trim();
    if (/\p{L}/u.test(t)) keys.add(t);
  }
  for (const m of body.matchAll(/\b(?:aria-label|title|placeholder)="([^"]+)"/g)) keys.add(dec(m[1]));
  // Names, and the one paragraph that carries markup (developer diagnostics), stay as they are.
  for (const skip of ['TribalSaarthi', 'English', 'हिन्दी', 'never']) keys.delete(skip);
  return [...keys];
}

const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe.each([['hi', HI]])('panel text in %s', (lang, dict) => {
  it('covers every string written as tr(...)', () => {
    expect(panelKeys().length).toBeGreaterThan(150);
    expect(panelKeys().filter((k) => !dict[k])).toEqual([]);
  });
  it('covers all fixed text in sidepanel.html', () => {
    expect(staticKeys().length).toBeGreaterThan(40);
    expect(staticKeys().filter((k) => !dict[k])).toEqual([]);
  });
  it('translates every on-device check message, including ones with a value inside', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 hello');
    const limits = { maxBytes: 100, accepted: ['image/png'], verified: false };
    const messages = new Set([
      ...checkDocument({ name: 'a.jpg', size: 95, bytes, dims: { w: 300, h: 200 } }, limits).map((c) => c.text),
      ...checkDocument({ name: 'a.pdf', size: 500, bytes, dims: { w: 3000, h: 2000 } }, { ...limits, verified: true }).map((c) => c.text),
      ...checkDocument({ name: 'a.pdf', size: 50, bytes: new Uint8Array([1, 2, 3]), dims: { invalid: true } }, limits).map((c) => c.text),
      ...checkDocument({ name: 'a.png', size: 0, bytes: new Uint8Array(), declaredType: '' }, limits).map((c) => c.text),
      ...checkDocument({ name: 'a.pdf', size: 150, bytes: new TextEncoder().encode('%PDF-1.4 /Encrypt /Type /Page\n'), dims: undefined }, { ...limits, accepted: ['application/pdf'] }).map((c) => c.text),
      ...checkDocument({ name: 'ok.png', size: 10, bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), dims: { w: 900, h: 700 } }, { ...limits, verified: true }).map((c) => c.text),
      ...checkFields([
        { id: 1, label: 'Email', name: 'email', type: 'text', required: false, filled: true, value: 'nope' },
        { id: 2, label: 'Mobile number', name: 'mobile', type: 'text', filled: true, value: '123' },
        { id: 3, label: 'PIN code', name: 'pin', type: 'text', filled: true, value: '12' },
        { id: 4, label: 'Applicant name', name: 'n', type: 'text', filled: true, value: 'A1' },
        { id: 5, label: 'Percentage', name: 'p', type: 'text', filled: true, value: 'abc' },
        { id: 6, label: 'Gender', name: 'g', type: 'select', required: true, filled: false },
        { id: 7, label: 'I agree', name: 'c', type: 'checkbox', required: true, filled: false },
        { id: 8, label: 'Income certificate', name: 'f', type: 'file', required: true, filled: false },
        { id: 9, label: 'Address line', name: 'a', type: 'text', required: true, filled: false },
      ]).map((i) => i.text),
    ]);
    expect(messages.size).toBeGreaterThan(12);
    const same = [...messages].filter((m) => translateCheck(lang, m) === m);
    expect(same).toEqual([]);
  });
  it('keeps every {placeholder}, and has no empty text', () => {
    for (const [k, v] of Object.entries(dict)) {
      expect(v.trim(), k).not.toBe('');
      expect(vars(v), k).toBe(vars(k));
    }
  });
  it('has no entries nothing uses', () => {
    const used = new Set([...panelKeys(), ...staticKeys(), ...PATTERNS.map(([, k]) => k), 'The file is empty.', 'The file content is not a PDF, JPG or PNG (it may be corrupt or renamed).', 'This PDF looks password-protected. Portals usually cannot read protected PDFs.', 'The PDF end marker is missing. Open the file to check whether it is complete.', 'The image could not be opened. Export a new JPG or PNG and try again.', 'Passed the basic checks. This does not confirm the document is genuine or correct.']);
    expect(Object.keys(dict).filter((k) => !used.has(k))).toEqual([]);
  });
});

describe('trans', () => {
  it('returns English unchanged, fills values, and falls back to English for unknown text', () => {
    expect(trans('en', 'Hello {n}', { n: 4 })).toBe('Hello 4');
    expect(trans('hi', 'not in the dictionary')).toBe('not in the dictionary');
    expect(trans('unsupported', 'Refresh')).toBe('Refresh');
    expect(translateCheck('hi', '“Email” does not look like an email address.')).toBe('“Email” ईमेल पते जैसा नहीं दिखता।');
  });
});
