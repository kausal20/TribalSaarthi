import type { Level, Location, Opportunity } from './types';

export interface Filters {
  q: string;
  level: Level | 'all';
  loc: Location | 'all';
  deadline: 'all' | 'set' | 'tbc';
  category: string;
  openOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = { q: '', level: 'all', loc: 'all', deadline: 'all', category: 'all', openOnly: false };

export const LEVEL_LABEL: Record<Level, string> = { school: 'School', undergraduate: 'Undergraduate', postgraduate: 'Postgraduate', research: 'Research', vocational: 'Vocational / ITI' };

export function applyFilters(list: Opportunity[], f: Filters): Opportunity[] {
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((o) => {
    const hay = `${o.title} ${o.providerName} ${o.tagline} ${o.purpose} ${o.category} ${LEVEL_LABEL[o.level]} ${o.location} ${o.documents.map((d) => d.label).join(' ')}`.toLowerCase();
    return (
      words.every((w) => hay.includes(w)) &&
      (f.level === 'all' || o.level === f.level) &&
      (f.loc === 'all' || o.location === f.loc) &&
      (f.deadline === 'all' || (f.deadline === 'set' ? o.deadline.set : !o.deadline.set)) &&
      (f.category === 'all' || o.category === f.category) &&
      (!f.openOnly || o.status === 'Open in demo')
    );
  });
}

export const SUGGESTIONS: { label: string; preset: Partial<Filters> }[] = [
  { label: 'School scholarship', preset: { level: 'school' } },
  { label: 'College scholarship', preset: { level: 'undergraduate' } },
  { label: 'Study abroad', preset: { loc: 'Overseas' } },
  { label: 'PhD and research', preset: { level: 'research' } },
];

/** Treat restored browser data as untrusted and tolerate older filter versions. */
export function restoreFilters(raw: string | null): Filters {
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_FILTERS };
    return {
      q: typeof value.q === 'string' ? value.q : '',
      level: ['school', 'undergraduate', 'postgraduate', 'research', 'vocational'].includes(value.level) ? value.level : 'all',
      loc: ['India', 'Overseas'].includes(value.loc) ? value.loc : 'all',
      deadline: ['set', 'tbc'].includes(value.deadline) ? value.deadline : 'all',
      category: ['Fellowship', 'Scholarship'].includes(value.category) ? value.category : 'all',
      openOnly: value.openOnly === true,
    };
  } catch { return { ...DEFAULT_FILTERS }; }
}
