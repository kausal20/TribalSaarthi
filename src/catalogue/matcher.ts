import { findOpportunity } from './data';
import type { Opportunity } from './types';
import type { TFn } from '../i18n/i18n';

/**
 * Shortlists real schemes from a few non-sensitive answers. This is a pointer to where to look, never an
 * eligibility decision: only the provider decides, and every result says so.
 */
export type Stage = 'class9-10' | 'class11-12' | 'iti' | 'ug' | 'pg' | 'phd';
export type Income = 'upto2.5' | '2.5-6' | '6-8' | 'above8' | 'unsure';

export interface Profile {
  living: 'hostel' | 'home';
  stage: Stage;
  studyIn: 'india' | 'abroad';
  state: 'maharashtra' | 'other';
  income: Income;
  topInstitute: 'yes' | 'no';
}

export const STAGE_LABEL: Record<Stage, string> = {
  'class9-10': 'Class 9–10', 'class11-12': 'Class 11–12', iti: 'ITI / vocational course', ug: 'Graduation (UG)', pg: 'Post-graduation (PG)', phd: 'PhD / research',
};
export const INCOME_LABEL: Record<Income, string> = {
  'upto2.5': 'Up to ₹2.5 lakh', '2.5-6': '₹2.5 – 6 lakh', '6-8': '₹6 – 8 lakh', above8: 'Above ₹8 lakh', unsure: 'Not sure',
};

export interface Match {
  id: string;
  level: 'central' | 'state';
  fit: 'likely' | 'check';
  reasons: string[];
}

export interface MatchResult {
  matches: Match[];
  notes: string[];
}

export const summarizeProfile = (p: Profile) =>
  `ST student · ${STAGE_LABEL[p.stage]} · study in ${p.studyIn === 'india' ? 'India' : 'abroad'} · ${p.state === 'maharashtra' ? 'Maharashtra' : 'another state'} · family income ${INCOME_LABEL[p.income].toLowerCase()} · ${p.living === 'hostel' ? 'stays in a hostel' : 'lives at home'}`;

const upTo = (i: Income, cap: 2.5 | 6 | 8): 'yes' | 'maybe' | 'no' => {
  if (i === 'unsure') return 'maybe';
  const top = { 'upto2.5': 2.5, '2.5-6': 6, '6-8': 8, above8: Infinity }[i];
  return top <= cap ? 'yes' : 'no';
};
const overThan25 = (i: Income) => i !== 'upto2.5';

export function matchSchemes(p: Profile): MatchResult {
  const notes: string[] = [];
  const matches: Match[] = [];
  const add = (id: string, fit: 'likely' | 'check', reasons: string[]) => {
    matches.push({ id, level: id.startsWith('mh-') ? 'state' : 'central', fit, reasons });
  };
  const incomeFit = (cap: 2.5 | 6 | 8, label: string) => {
    const r = upTo(p.income, cap);
    return { ok: r !== 'no', fit: r === 'yes' ? ('likely' as const) : ('check' as const), why: r === 'maybe' ? `Check your family income against the ${label} limit.` : `Income within the ${label} limit.` };
  };
  const india = p.studyIn === 'india';
  const school = p.stage === 'class9-10';
  const post = ['class11-12', 'ug', 'pg'].includes(p.stage);

  if (school && india) {
    const i = incomeFit(2.5, '₹2.5 lakh');
    if (i.ok) add('st-pre-matric', i.fit, ['ST student in Class 9–10.', i.why, p.living === 'hostel' ? 'Hostellers get ₹525 a month instead of ₹225 for day scholars.' : 'Day scholars get ₹225 a month (₹525 for hostellers).']);
  }
  if ((post || p.stage === 'iti') && india) {
    const i = incomeFit(2.5, '₹2.5 lakh');
    if (i.ok) add('st-post-matric', p.stage === 'iti' ? 'check' : i.fit, [`Studying after Class 10 (${STAGE_LABEL[p.stage]}).`, i.why, 'Hostellers get a higher monthly maintenance amount than day scholars.']);
  }
  if ((p.stage === 'ug' || p.stage === 'pg') && india && p.topInstitute === 'yes') {
    const i = incomeFit(6, '₹6 lakh');
    if (i.ok) add('st-top-class', i.fit, ['Admitted to a top institution (IIT, AIIMS, IIM, NIT and similar).', i.why]);
  }
  if (p.stage === 'phd' && india) add('st-nfst', 'likely', ['Full-time PhD in India for an ST student.']);
  if ((p.stage === 'pg' || p.stage === 'phd') && !india) {
    const i = incomeFit(6, '₹6 lakh');
    if (i.ok) add('st-nos', i.fit, ['Master’s or PhD abroad, at a top-1000 QS-ranked university.', 'Age and marks limits apply; read the guidelines.', i.why]);
  }
  if (p.state === 'maharashtra' && india) {
    if (['class11-12', 'ug', 'pg'].includes(p.stage)) {
      const i = incomeFit(2.5, '₹2.5 lakh');
      if (i.ok) add('mh-st-post-matric', i.fit, ['Maharashtra’s MahaDBT route for the Post Matric Scholarship.', i.why]);
    }
    if ((p.stage === 'ug' || p.stage === 'pg') && overThan25(p.income)) {
      add('mh-st-freeship', p.income === 'unsure' ? 'check' : 'likely', ['Reimburses tuition and exam fees when family income is above ₹2.5 lakh.']);
    }
    if (p.stage === 'iti' && upTo(p.income, 8) !== 'no') {
      add('mh-st-iti-fee', upTo(p.income, 8) === 'yes' ? 'likely' : 'check', ['ITI fee reimbursement for ST students admitted through Maharashtra’s central admission.']);
    }
  }
  if (p.state === 'other' && india) {
    notes.push('State schemes for states other than Maharashtra are not in this catalogue yet. Check your own state’s scholarship portal, or the National Scholarship Portal.');
  }
  if (matches.length === 0) {
    notes.push('No scheme in this catalogue matched these answers. That does not mean none exists; check the official portals below.');
  }
  return { matches, notes };
}

export const officialLink = (o: Opportunity) => o.official?.applyUrl ?? o.verifiedSourceUrl;
export const matchedOpp = (m: Match) => findOpportunity(m.id);

/**
 * Reasons are plain English sentences (the fallback and the tests read them as-is). A few contain a value, so this
 * translates the sentence pattern and the value separately; every other reason is looked up whole.
 */
export function translateReason(t: TFn, reason: string): string {
  let m = /^Studying after Class 10 \((.+)\)\.$/.exec(reason);
  if (m) return t('Studying after Class 10 ({stage}).', { stage: t(m[1]) });
  m = /^Check your family income against the (.+) limit\.$/.exec(reason);
  if (m) return t('Check your family income against the {label} limit.', { label: t(m[1]) });
  m = /^Income within the (.+) limit\.$/.exec(reason);
  if (m) return t('Income within the {label} limit.', { label: t(m[1]) });
  return t(reason);
}
