import type { Status } from '../types';
import { deficiencies, evaluate } from './evaluator';
import { PENDING_REVIEW } from './workflow';
import type { DemoState } from './storage';

export interface Analytics {
  total: number;
  pending: number;
  perScheme: { schemeId: string; name: string; counts: Partial<Record<Status, number>>; total: number }[];
  /** Open deficiencies (rule ID → applications), for submitted applications not yet ready for selection review */
  deficiencyCounts: { ruleId: string; count: number }[];
  followups: number;
}

export function computeAnalytics(state: DemoState): Analytics {
  const apps = state.applications;
  const perScheme = new Map<string, Analytics['perScheme'][number]>();
  for (const a of apps) {
    const row = perScheme.get(a.schemeId) ?? { schemeId: a.schemeId, name: a.schemeSnapshot.name, counts: {}, total: 0 };
    row.counts[a.status] = (row.counts[a.status] ?? 0) + 1;
    row.total++;
    perScheme.set(a.schemeId, row);
  }
  const defs = new Map<string, number>();
  for (const a of apps.filter((x) => x.status !== 'DRAFT' && x.status !== 'READY_FOR_SELECTION_REVIEW')) {
    for (const r of deficiencies(evaluate(a.schemeSnapshot, a))) defs.set(r.ruleId, (defs.get(r.ruleId) ?? 0) + 1);
  }
  return {
    total: apps.length,
    pending: apps.filter((a) => PENDING_REVIEW.includes(a.status)).length,
    perScheme: [...perScheme.values()],
    deficiencyCounts: [...defs.entries()].map(([ruleId, count]) => ({ ruleId, count })).sort((a, b) => b.count - a.count),
    followups: apps.reduce((n, a) => n + a.events.filter((e) => e.type === 'POST_SELECTION_FOLLOWUP_DEMO').length, 0),
  };
}
