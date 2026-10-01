import { describe, expect, it } from 'vitest';
import { matchSchemes, officialLink, type Profile } from './matcher';
import { findOpportunity } from './data';

const base: Profile = { living: 'home', stage: 'ug', studyIn: 'india', state: 'maharashtra', income: 'upto2.5', topInstitute: 'no' };
const ids = (p: Partial<Profile>) => matchSchemes({ ...base, ...p }).matches.map((m) => m.id);

describe('matchSchemes', () => {
  it('Maharashtra UG low income: central + state post matric, no freeship', () => {
    const r = ids({});
    expect(r).toContain('st-post-matric');
    expect(r).toContain('mh-st-post-matric');
    expect(r).not.toContain('mh-st-freeship');
  });
  it('higher income moves Maharashtra UG to freeship', () => {
    const r = ids({ income: '2.5-6' });
    expect(r).toContain('mh-st-freeship');
    expect(r).not.toContain('st-post-matric');
  });
  it('class 9-10, PhD, abroad map to their own schemes', () => {
    expect(ids({ stage: 'class9-10', state: 'other' })).toEqual(['st-pre-matric']);
    expect(ids({ stage: 'phd' })).toContain('st-nfst');
    expect(ids({ stage: 'pg', studyIn: 'abroad', income: '2.5-6' })).toEqual(['st-nos']);
  });
  it('top institute adds Top Class', () => {
    expect(ids({ topInstitute: 'yes', income: '2.5-6' })).toContain('st-top-class');
  });
  it('unsure income yields "check", not "likely"', () => {
    const m = matchSchemes({ ...base, income: 'unsure' }).matches.find((x) => x.id === 'st-post-matric');
    expect(m?.fit).toBe('check');
  });
  it('other-state note', () => {
    expect(matchSchemes({ ...base, state: 'other' }).notes.join(' ')).toMatch(/other than Maharashtra/);
  });
  it('every matched scheme exists and has an official link', () => {
    for (const p of [base, { ...base, stage: 'phd' as const }, { ...base, stage: 'iti' as const }]) {
      for (const m of matchSchemes(p).matches) {
        const o = findOpportunity(m.id);
        expect(o).toBeTruthy();
        expect(officialLink(o!)).toMatch(/^https:\/\//);
      }
    }
  });
});
