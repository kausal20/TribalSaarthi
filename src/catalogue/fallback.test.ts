import { describe, expect, it } from 'vitest';
import { catalogueFallback } from './fallback';

describe('site-wide guide offline fallback', () => {
  it('lists only real schemes for recommendation questions and asks for the missing details', () => {
    const r = catalogueFallback('Which scholarship is best for me?');
    expect(r.text).toMatch(/Post Matric Scholarship for ST Students/);
    expect(r.text).toMatch(/National Overseas Scholarship/);
    expect(r.text).not.toMatch(/Practice|Research fellowship\b(?! for)|Overseas study support/);
    expect(r.text).toMatch(/class or course/);
    expect(r.text).toMatch(/Only the provider decides/);
  });
  it('never claims the AI answered', () => {
    expect(catalogueFallback('hello').text).toMatch(/not reachable/);
  });
});
