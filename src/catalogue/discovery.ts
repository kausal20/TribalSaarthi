import type { Filters } from './filters';

export interface Portal {
  name: string;
  logo: string;
  provider: string;
  url: string;
  guideHref?: string;
}
export interface Topic {
  label: string;
  preset: Partial<Filters>;
}

/** Official portals; internal topic filtering is separate. */
export const PORTALS: Portal[] = [
  { name: 'National Scholarship Portal', logo: '/logos/nsp.svg', provider: 'Government of India', url: 'https://scholarships.gov.in/', guideHref: '#/continue/nsp' },
  { name: 'Tribal Affairs Scholarships', logo: '/logos/tribal-affairs.jpg', provider: 'Ministry of Tribal Affairs', url: 'https://tribal.nic.in/ScholarshiP.aspx' },
  { name: 'MahaDBT Scholarships', logo: '/logos/mahadbt.png', provider: 'Government of Maharashtra', url: 'https://mahadbt.maharashtra.gov.in/', guideHref: '#/continue/mahadbt' },
];

export const TOPICS: Topic[] = [
  { label: 'Undergraduate', preset: { level: 'undergraduate' } },
  { label: 'Postgraduate', preset: { level: 'postgraduate' } },
  { label: 'Research', preset: { level: 'research' } },
  { label: 'Overseas Study', preset: { loc: 'Overseas' } },
  { label: 'Pre-Matric', preset: { q: 'pre-matric' } },
  { label: 'Post-Matric', preset: { q: 'post-matric' } },
  { label: 'Eligible students', preset: { q: 'students' } },
  { label: 'Higher Education', preset: { level: 'undergraduate' } },
  { label: 'Fellowships', preset: { category: 'Fellowship' } },
  { label: 'School', preset: { level: 'school' } },
];
