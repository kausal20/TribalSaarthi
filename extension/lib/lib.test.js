import { describe, expect, it } from 'vitest';
import { respond, FALLBACK } from './rules.js';
import { acceptsFile, checkDocument, checkFields, detectType, isSensitive, summarise } from './checks.js';
import { PORTAL, NSP_PORTAL, portalForHost } from './portal.js';
import { handoffMessage, isFresh, parseHandoff } from './handoff.js';

const enc = (s) => new TextEncoder().encode(s);
const pdf = (extra = '') => enc(`%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n${extra}%%EOF`);
const limits = PORTAL.docLimits;

describe('guide rules', () => {
  const links = ['Home', 'New Registration', 'Post Matric Scholarship', 'All Schemes'];
  it('answers registration from portal facts and offers navigation only if the link exists', () => {
    const r = respond('Where do I register?', { links });
    expect(r.text).toMatch(/New Registration/);
    expect(r.actions?.[0]).toEqual({ type: 'goto', label: 'New Registration' });
    expect(respond('Where do I register?', { links: ['Home'] }).actions).toBeUndefined();
  });
  it('navigates to All Schemes', () => {
    expect(respond('take me to all schemes', { links }).actions?.[0].label).toBe('All Schemes');
  });
  it('refuses secrets and auto-fill/submit', () => {
    expect(respond('my OTP is 123456', {}).kind).toBe('safety');
    expect(respond('enter my password', {}).kind).toBe('safety');
    expect(respond('submit the form for me', {}).kind).toBe('safety');
  });
  it('never navigates to blocked actions', () => {
    expect(respond('open logout', { links: ['Logout'] }).kind).toBe('fallback');
    expect(respond('go to Submit Application', { links: ['Submit Application'] }).actions).toBeUndefined();
  });
  it('does not invent per-scheme documents', () => {
    const r = respond('what documents do I need?', { uploads: [{ label: 'Income certificate' }] });
    expect(r.text).toMatch(/do not have a verified document list/);
    expect(r.text).toContain('Income certificate');
  });
  it('greets instead of saying it has no information', () => {
    expect(respond('hi', {}).text).toMatch(/Hello/);
    expect(respond('hello there', {}).kind).toBe('answer');
    expect(respond('hi my otp is 1234', {}).kind).toBe('safety');
  });
  it('falls back on unknown questions', () => {
    expect(respond('who will win the match', {}).text).toBe(FALLBACK);
  });
});

describe('National Scholarship Portal guide', () => {
  it('recognises the official host and uses NSP-specific guidance', () => {
    expect(portalForHost('scholarships.gov.in')).toBe(NSP_PORTAL);
    expect(portalForHost('evil-scholarships.gov.in')).toBeNull();
    const links = ['Students', 'Schemes on NSP', 'OTR'];
    expect(respond('Where do I register?', { links }, NSP_PORTAL).actions?.[0]).toEqual({ type: 'goto', label: 'OTR' });
    expect(respond('Take me to schemes', { links }, NSP_PORTAL).actions?.[0]).toEqual({ type: 'goto', label: 'Schemes on NSP' });
    expect(respond('What documents do I need?', {}, NSP_PORTAL).text).toMatch(/do not have a verified document list/);
  });
});

describe('document checks (local)', () => {
  it('detects real type by content', () => {
    expect(detectType(pdf())).toBe('application/pdf');
    expect(detectType(enc('hello'))).toBeNull();
  });
  it('flags corrupt/renamed, empty and oversize files', () => {
    const bad = checkDocument({ name: 'a.pdf', size: 5, bytes: enc('hello') }, limits);
    expect(bad.some((r) => r.level === 'error')).toBe(true);
    expect(checkDocument({ name: 'a.pdf', size: 0, bytes: new Uint8Array() }, limits).some((r) => /empty/.test(r.text))).toBe(true);
    const big = checkDocument({ name: 'a.pdf', size: 2_000_000, bytes: pdf() }, limits);
    expect(big.some((r) => /limit/.test(r.text) && r.level === 'warn')).toBe(true);
    expect(big.find((r) => /limit/.test(r.text)).text).toMatch(/not verified/);
  });
  it('warns on extension mismatch and encrypted PDFs, small images', () => {
    expect(checkDocument({ name: 'a.jpg', size: 100, bytes: pdf() }, limits).some((r) => r.level === 'warn' && /content is PDF/.test(r.text))).toBe(true);
    expect(checkDocument({ name: 'a.pdf', size: 100, bytes: pdf('/Encrypt 5 0 R') }, limits).some((r) => /password-protected/.test(r.text))).toBe(true);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    expect(checkDocument({ name: 'a.png', size: 100, bytes: png, dims: { w: 300, h: 200 } }, limits).some((r) => /small/.test(r.text))).toBe(true);
  });
  it('a clean file passes basic checks without claiming it is genuine', () => {
    const r = checkDocument({ name: 'a.pdf', size: 500, bytes: pdf() }, limits);
    expect(r.some((x) => x.level === 'error' || x.level === 'warn')).toBe(false);
    expect(r.at(-1).text).toMatch(/does not confirm/);
  });
});

describe('form checks (local)', () => {
  const f = (o) => ({ id: 'x', label: '', name: '', type: 'text', required: false, filled: true, sensitive: false, value: '', ...o });
  it('reports empty required fields and format problems, skips sensitive', () => {
    const issues = checkFields([
      f({ id: '1', label: 'Full name', required: true, filled: false }),
      f({ id: '2', label: 'Mobile number', value: '12345' }),
      f({ id: '3', label: 'Email', value: 'a@b' }),
      f({ id: '4', label: 'PIN code', value: '4110' }),
      f({ id: '5', label: 'Applicant name', value: 'Asha 2' }),
      f({ id: '6', label: 'OTP', required: true, filled: false, sensitive: true }),
      f({ id: '7', label: 'Mobile number', value: '9876543210' }),
    ]);
    expect(issues.map((i) => i.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(issues[0].level).toBe('error');
  });
  it('checks missing uploads and skips disabled fields', () => {
    const result = checkFields([f({ type: 'file', label: 'Certificate', required: true, filled: false }), f({ label: 'Institution', required: true, filled: false, disabled: true })]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain('Certificate');
  });
  it('marks sensitive labels', () => {
    expect(isSensitive({ label: 'Aadhaar number', name: '', id: '' })).toBe(true);
    expect(isSensitive({ label: 'Password', name: '', id: '' })).toBe(true);
    expect(isSensitive({ label: 'Full name', name: '', id: '' })).toBe(false);
    expect(isSensitive({ label: 'PIN code', name: 'postal', id: '' })).toBe(false);
  });
  it('summarises', () => {
    expect(summarise([f({ required: true, filled: false }), f({ label: 'OTP', sensitive: true })])).toMatchObject({ total: 2, requiredEmpty: 1, sensitiveSkipped: 1 });
  });
});

describe('website handoff', () => {
  it('parses only a safe scheme id from the fragment', () => {
    expect(parseHandoff('#tsaarthi=postmatric-demo')).toBe('postmatric-demo');
    expect(parseHandoff('#/x&tsaarthi=NFST-DEMO&y=1')).toBe('nfst-demo');
    expect(parseHandoff('#tsaarthi=<script>')).toBeNull();
    expect(parseHandoff('#tsaarthi=' + 'a'.repeat(60))).toBeNull();
    expect(parseHandoff('')).toBeNull();
  });
  it('is fresh for 30 minutes only', () => {
    const now = 1_000_000;
    expect(isFresh({ id: 'x', ts: now - 60_000 }, now)).toBe(true);
    expect(isFresh({ id: 'x', ts: now - 31 * 60_000 }, now)).toBe(false);
    expect(isFresh(undefined, now)).toBe(false);
  });
  it('does not claim a MahaDBT scheme exists for demo entries that have none', () => {
    expect(handoffMessage('nfst-demo')).toMatch(/do not know of a matching/);
    expect(handoffMessage('postmatric-demo')).toMatch(/Post Matric Scholarship/);
    expect(handoffMessage('prematric-demo')).toMatch(/separate portal/);
    expect(handoffMessage('unknown')).toMatch(/You came from TribalSaarthi/);
  });
  it('describes NSP as a portal rather than claiming a demo scheme exists', () => {
    expect(handoffMessage('postmatric-demo', NSP_PORTAL)).toMatch(/practice only/);
  });
});

describe('portal upload constraints', () => {
  it('matches extensions, MIME types and image wildcards', () => {
    expect(acceptsFile('.pdf', 'CERTIFICATE.PDF', 'application/pdf')).toBe(true);
    expect(acceptsFile('image/*', 'photo.jpg', 'image/jpeg')).toBe(true);
    expect(acceptsFile('application/pdf', 'photo.jpg', 'image/jpeg')).toBe(false);
  });
  it('only treats a verified size limit as a blocking portal rule', () => {
    expect(checkDocument({ name: 'a.pdf', size: 2000000, bytes: pdf() }, { ...limits, verified: true }).some(x => x.level === 'error')).toBe(true);
    expect(checkDocument({ name: 'a.pdf', size: 2000000, bytes: pdf() }, limits).some(x => x.level === 'error')).toBe(false);
  });
});
