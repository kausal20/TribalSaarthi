import { describe, expect, it } from 'vitest';
import { hi } from './hi';
import { translate } from './i18n';
import { INCOME_LABEL, STAGE_LABEL, STATES, matchSchemes, translateReason, type Income, type Profile, type Stage } from '../catalogue/matcher';
import { LEVEL_LABEL } from '../catalogue/filters';
import { KINDS } from '../../extension/lib/readiness.js';
import { DASHBOARD_TEXT } from '../pages/dashboardData';

const FILES = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.*', '!/src/i18n/*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every string literal passed straight to t(...) in the website code. */
function literalKeys(): string[] {
  const keys = new Set<string>();
  const re = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`)/g;
  for (const text of Object.values(FILES)) {
    for (let m = re.exec(text); m; m = re.exec(text)) keys.add((m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return [...keys];
}

/** Strings that reach t() through a variable; each source is listed here or read from its real data. */
function dynamicKeys(): string[] {
  const keys = new Set<string>([
    ...STATES, 'Choose one', ...Object.values(STAGE_LABEL), ...Object.values(INCOME_LABEL), ...Object.values(LEVEL_LABEL), ...Object.values(KINDS) as string[], ...DASHBOARD_TEXT,
    // Saarthi AI sheet, suggested questions and shortcut chips
    'Where do you stay while studying?', 'At home / day scholar', 'In a hostel', 'What are you studying now?', 'Where do you study?', 'In India', 'Abroad',
    'Which state do you live in?', 'Maharashtra', 'Another state', 'Yearly family income',
    'Central schemes (Government of India)', 'State schemes', 'Opportunity',
    'What documents do I need?', 'Who is eligible?', 'How much will I get?', 'How do I apply?',
    'See the overview', 'See eligibility', 'See the document list', 'See how to apply',
    'India', 'Overseas', 'School scholarship', 'College scholarship', 'Study abroad', 'PhD and research', 'Take me to All Schemes', 'What documents does this page need?', 'Check this form', 'Opening “All Schemes” on the page.', 'Income certificate, caste certificate and marksheet. Confirm the list on the portal.', 'Fix 2 things before you apply: Full name is empty, Income certificate not selected.', '₹2.5 lakh', '₹6 lakh',
  ]);
  // Every reason and note the matcher can produce, for every possible set of answers.
  const stages = Object.keys(STAGE_LABEL) as Stage[];
  const incomes = Object.keys(INCOME_LABEL) as Income[];
  for (const stage of stages) for (const income of incomes) for (const studyIn of ['india', 'abroad'] as const) for (const state of ['maharashtra', 'other'] as const) for (const living of ['home', 'hostel'] as const) for (const topInstitute of ['yes', 'no'] as const) {
    const profile: Profile = { stage, income, studyIn, state, living, topInstitute };
    const { matches, notes } = matchSchemes(profile);
    notes.forEach((n) => keys.add(n));
    matches.forEach((m) => m.reasons.forEach((r) => {
      keys.add(r);
    }));
  }
  return [...keys];
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const REASON_PATTERNS = [/^Studying after Class 10 \(/, /^Check your family income against the /, /^Income within the /];

describe('Hindi dictionary', () => {
  for (const [name, dict] of [['hindi', hi]] as const) {
    const lang = 'hi';
    it(`${name} covers every string written as t('…')`, () => {
      expect(literalKeys().length).toBeGreaterThan(200);
      const missing = literalKeys().filter((k) => !dict[k]);
      expect(missing).toEqual([]);
    });
    it(`${name} covers every label, matcher reason and note`, () => {
      const missing = dynamicKeys().filter((k) => !REASON_PATTERNS.some((p) => p.test(k)) && !dict[k]);
      expect(missing).toEqual([]);
    });
    it(`${name} translates every matcher reason (including those with a value inside)`, () => {
      const t = (text: string, v?: Record<string, string | number>) => translate(lang, text, v);
      const untranslated: string[] = [];
      for (const k of dynamicKeys()) {
        if (!/^(Studying after|Check your family|Income within|ST student in|Hostellers|Day scholars|Admitted|Full-time|Master|Age and|Maharashtra’s|Reimburses|ITI fee)/.test(k)) continue;
        if (translateReason(t, k) === k) untranslated.push(k);
      }
      expect(untranslated).toEqual([]);
    });
    it(`${name} keeps every {placeholder} and has no empty text`, () => {
      for (const [k, v] of Object.entries(dict)) {
        expect(v.trim(), k).not.toBe('');
        expect(vars(v), k).toBe(vars(k));
      }
    });
    it(`${name} has no entries that nothing uses`, () => {
      const used = new Set([...literalKeys(), ...dynamicKeys()]);
      const stale = Object.keys(dict).filter((k) => !used.has(k) && !REASON_PATTERNS.some((p) => p.test(k)) && !/^(Studying after Class 10|Check your family income|Income within)/.test(k));
      expect(stale).toEqual([]);
    });
  }

  it('translate() falls back to English and fills placeholders', () => {
    expect(translate('en', 'Hello {n}', { n: 2 })).toBe('Hello 2');
    expect(translate('hi', 'This text is not in the dictionary')).toBe('This text is not in the dictionary');
    expect(translate('hi', '{n} messages', { n: 3 })).toBe('3 संदेश');
  });
});
