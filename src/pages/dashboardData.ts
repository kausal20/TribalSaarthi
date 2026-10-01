/**
 * School / officer view. EVERY number here is invented sample data for the prototype so the layout can be judged;
 * it is not collected from any student or school. A real version would count only anonymous, consented results.
 */
export const KPIS: { label: string; value: string; hint: string }[] = [
  { label: 'Applications checked', value: '1,284', hint: 'Sample total across 6 sample schools' },
  { label: 'Sent back before applying', value: '312', hint: 'Problems fixed before the student submitted' },
  { label: 'Ready to apply', value: '972', hint: 'No obvious problem found' },
  { label: 'Applications reviewed with AI', value: '441', hint: 'Guidance used before applying' },
];

export const PROBLEMS: { label: string; n: number }[] = [
  { label: 'Income certificate missing or old', n: 96 },
  { label: 'Caste certificate not clear to read', n: 71 },
  { label: 'Bank account not linked to Aadhaar', n: 58 },
  { label: 'File over the size limit', n: 44 },
  { label: 'Name differs between documents', n: 31 },
  { label: 'Photo or signature in the wrong format', n: 12 },
];

export const SCHEMES: { name: string; checked: number; back: number }[] = [
  { name: 'Post-Matric Scholarship for ST students', checked: 520, back: 141 },
  { name: 'Pre-Matric Scholarship for ST students', checked: 388, back: 79 },
  { name: 'Maharashtra tribal development schemes', checked: 241, back: 62 },
  { name: 'Other schemes in the catalogue', checked: 135, back: 30 },
];

export const WEEKS = [38, 52, 61, 74, 69, 88, 97, 110];


/** Every English string above, for the translation test. */
export const DASHBOARD_TEXT: string[] = [...KPIS.flatMap((k) => [k.label, k.hint]), ...PROBLEMS.map((p) => p.label), ...SCHEMES.map((s) => s.name)];
