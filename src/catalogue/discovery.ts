export interface Portal {
  name: string;
  logo: string;
  provider: string;
  url: string;
  guideHref?: string;
}

/** Official portals where students actually apply. */
export const PORTALS: Portal[] = [
  { name: 'National Scholarship Portal', logo: '/logos/nsp.svg', provider: 'Government of India', url: 'https://scholarships.gov.in/', guideHref: '#/continue/nsp' },
  { name: 'Tribal Affairs Scholarships', logo: '/logos/tribal-affairs.jpg', provider: 'Ministry of Tribal Affairs', url: 'https://tribal.nic.in/ScholarshiP.aspx' },
  { name: 'MahaDBT Scholarships', logo: '/logos/mahadbt.png', provider: 'Government of Maharashtra', url: 'https://mahadbt.maharashtra.gov.in/', guideHref: '#/continue/mahadbt' },
];
