import { describe, expect, it } from 'vitest';
import { respond, FALLBACK, documentAssistance } from './rules.js';
import { acceptsFile, checkDocument, checkFields, detectType, isSensitive, summarise } from './checks.js';
import { PORTAL, NSP_PORTAL, portalForHost } from './portal.js';
import { handoffMessage, isFresh, parseHandoff } from './handoff.js';

const enc = (s) => new TextEncoder().encode(s);
const pdf = (extra = '') => enc(`%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n${extra}%%EOF`);
const limits = PORTAL.docLimits;

describe('guide rules', () => {
  it('opens consent-based document tools for attachment requests in English and Hindi', () => {
    for (const q of ['if i give you domucemnts of myn will you uplode it to the website', 'Can you upload my document?', 'मेरे दस्तावेज़ अपलोड कर सकते हैं?']) {
      expect(documentAssistance(q)?.actions).toEqual([{ type: 'scan-uploads' }]);
    }
    expect(documentAssistance('Please attach my file').text).toContain('confirm');
    expect(documentAssistance('Please attach my file').text).toContain('Some portals upload immediately');
    expect(documentAssistance('what documents do I need?')).toBeNull();
    expect(documentAssistance('upload my Aadhaar')).toBeNull();
    expect(documentAssistance('upload and submit for me')).toBeNull();
  });
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

import { readFileSync } from 'node:fs';
import { FIELD_PATTERN, asksToHandleSecret, isSensitiveField, mentionsPrivate, sharesSecret, splitWords } from './sensitive.js';
import { groupRadios } from './checks.js';

describe('private fields and messages', () => {
  it('only treats real secret words as private, not "passport" or "passing"', () => {
    for (const label of ['Password', 'Enter OTP', 'Aadhaar number', 'Bank account number', 'IFSC code', 'CAPTCHA', 'Confirm pin']) {
      expect(isSensitiveField(label), label).toBe(true);
    }
    for (const label of ['Passport size photograph', 'Passing year', 'Passed in (year)', 'PIN code', 'Pincode', 'Income certificate', 'Photo', 'Hotplate']) {
      expect(isSensitiveField(label), label).toBe(false);
    }
  });
  it('reads field names written in camelCase or with underscores', () => {
    expect(splitWords('txtOTP')).toBe('txt OTP');
    expect(isSensitiveField('', 'txtOTP')).toBe(true);
    expect(isSensitiveField('', 'ctl00_Main_txtPassingYear')).toBe(false);
    expect(isSensitiveField('', 'ddl_pin_code')).toBe(false);
  });
  it('content.js carries exactly the same field pattern', () => {
    const source = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
    const literal = /const SENSITIVE = \/(.+)\/i;/.exec(source)?.[1];
    expect(literal).toBe(FIELD_PATTERN);
  });
  it('spots a secret value in a message, but not a question about one', () => {
    for (const m of ['my otp is 482913', 'otp 482913', '482913 is my otp', 'password is Abc@123', 'my password is sunshine', 'pin: 4455', 'aadhaar 1234 5678 9012', '1234567890123456']) {
      expect(sharesSecret(m), m).toBe(true);
    }
    for (const m of ['I forgot my password', 'what is OTP', 'the otp is not coming', 'password is required', 'what goes in the PIN code field', 'where do I register', 'my mobile is 9876543210']) {
      expect(sharesSecret(m), m).toBe(false);
    }
    expect(mentionsPrivate('upload my aadhaar')).toBe(true);
    expect(mentionsPrivate('PIN code')).toBe(false);
  });
  it('asks to refuse typing a secret for the student', () => {
    expect(asksToHandleSecret('enter my password for me')).toBe(true);
    expect(asksToHandleSecret('please type the otp')).toBe(true);
    expect(asksToHandleSecret('how do I reset it')).toBe(false);
  });
  it('the local guide answers questions about secrets and refuses the values', () => {
    expect(respond('I forgot my password', {}).kind).toBe('answer');
    expect(respond('my otp is 482913', {}).kind).toBe('safety');
    expect(respond('what should I write in the PIN code field', {}).kind).not.toBe('safety');
  });
});

describe('MahaDBT 1.0 and 2.0, and Marathi labels', () => {
  it('recognises both MahaDBT hosts as the same portal', () => {
    expect(portalForHost('mahadbt.maharashtra.gov.in')).toBe(PORTAL);
    expect(portalForHost('mahadbt2.maharashtra.gov.in')).toBe(PORTAL);
    expect(portalForHost('mahadbt3.maharashtra.gov.in')).toBeNull();
  });
  it('is declared in the manifest for content scripts and host access', () => {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    expect(manifest.host_permissions).toContain('https://mahadbt2.maharashtra.gov.in/*');
    expect(manifest.content_scripts[0].matches).toContain('https://mahadbt2.maharashtra.gov.in/*');
    const worker = readFileSync(new URL('../background.js', import.meta.url), 'utf8');
    expect(worker).toContain('https://mahadbt2.maharashtra.gov.in/*');
  });
  it('offers the Marathi registration link when that is the one on the page', () => {
    const r = respond('Where do I register?', { links: ['मुख्यपृष्ठ', 'लॉगिन', 'नोंदणी करा'] });
    expect(r.actions?.[0]).toEqual({ type: 'goto', label: 'नोंदणी करा' });
  });
  it('explaining login does not move the page; asking to be taken there does', () => {
    const links = ['Home', 'Login'];
    expect(respond('how do I log in', { links }).actions).toBeUndefined();
    expect(respond('take me to login', { links }).actions?.[0]).toEqual({ type: 'goto', label: 'Login' });
  });
});

describe('radio groups and required selects', () => {
  const radio = (id, group, label, extra = {}) => ({ id, type: 'radio', name: 'gender', group, label, required: false, filled: false, sensitive: false, ...extra });
  it('counts one radio group as one question', () => {
    const list = [radio('a', 'Gender', 'Male', { required: true }), radio('b', 'Gender', 'Female'), radio('c', 'Gender', 'Other')];
    expect(groupRadios(list)).toHaveLength(1);
    expect(groupRadios(list)[0]).toMatchObject({ label: 'Gender', required: true, filled: false });
    const issues = checkFields(list);
    expect(issues).toHaveLength(1);
    expect(issues[0].text).toBe('Choose an option for “Gender”.');
    expect(summarise(list)).toMatchObject({ total: 1, requiredEmpty: 1 });
    expect(checkFields(list.map((r, i) => ({ ...r, filled: i === 1 })))).toHaveLength(0);
  });
  it('words empty selects, checkboxes and uploads for what the student has to do', () => {
    const f = (o) => ({ id: 'x', label: 'Thing', name: '', type: 'text', required: true, filled: false, sensitive: false, ...o });
    expect(checkFields([f({ type: 'select' })])[0].text).toContain('Choose an option');
    expect(checkFields([f({ type: 'checkbox' })])[0].text).toContain('Tick');
    expect(checkFields([f({ type: 'file' })])[0].text).toContain('needs a file');
  });
  it('does not call a school name or a +91 mobile number a mistake', () => {
    const f = (o) => ({ id: 'x', name: '', type: 'text', required: false, filled: true, sensitive: false, ...o });
    expect(checkFields([f({ label: 'School name', value: 'ZP School 5' })])).toHaveLength(0);
    expect(checkFields([f({ label: 'Mobile number', value: '+91 98765 43210' })])).toHaveLength(0);
    expect(checkFields([f({ label: 'Contact person name', value: 'Asha' })])).toHaveLength(0);
    expect(checkFields([f({ label: 'Marks', value: '85%' })])).toHaveLength(0);
  });
});

describe('handoff from the website', () => {
  it('greets real scheme ids honestly, including schemes that are not on MahaDBT', () => {
    expect(handoffMessage('mh-st-post-matric')).toMatch(/Post Matric Scholarship Scheme \(Government Of India\)/);
    expect(handoffMessage('mh-st-freeship')).toMatch(/Freeship/);
    expect(handoffMessage('st-nos')).toMatch(/not applied for on MahaDBT/);
    expect(handoffMessage('st-post-matric', NSP_PORTAL)).toMatch(/Post Matric Scholarship for ST Students/);
    expect(handoffMessage('st-post-matric', NSP_PORTAL)).not.toMatch(/practice only/);
  });
  it('every message keeps eligibility with the provider', () => {
    for (const id of ['mh-st-post-matric', 'mh-st-freeship', 'mh-st-iti-fee']) expect(handoffMessage(id)).toMatch(/only the provider decides/);
  });
});

import { fieldFit, rankSlots } from './checks.js';

describe('which upload field a file belongs to', () => {
  const slots = [{ label: 'Passport size photograph' }, { label: 'Income certificate' }, { label: 'Caste certificate' }];
  it('puts the field that matches the file name first', () => {
    expect(rankSlots('income_certificate.pdf', slots)[0].label).toBe('Income certificate');
    expect(rankSlots('CasteCertificate.pdf', slots)[0].label).toBe('Caste certificate');
    expect(rankSlots('my-photo.jpg', slots)[0].label).toBe('Passport size photograph');
    expect(rankSlots('Tribe validity.pdf', slots)[0].label).toBe('Caste certificate');
  });
  it('keeps the page order when the name gives no clue', () => {
    const ranked = rankSlots('IMG_2031.jpg', slots);
    expect(ranked.map((s) => s.label)).toEqual(slots.map((s) => s.label));
    expect(ranked.every((s) => s.fit === 0)).toBe(true);
  });
  it('scores shared words and same-meaning words once each', () => {
    expect(fieldFit('income.pdf', 'Income certificate')).toBe(1);
    expect(fieldFit('salary slip.pdf', 'Income certificate')).toBe(1);
    expect(fieldFit('marks.pdf', 'Income certificate')).toBe(0);
  });
});
