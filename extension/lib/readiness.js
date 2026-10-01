// "Rejection risk" summary: everything found while checking an application, as one clear verdict.
// Pure and shared by the extension panel and the website. It never claims an application will be accepted or rejected:
// it lists what a clerk or officer would be likely to send back.

export const KINDS = {
  'missing-doc': 'Documents still missing',
  'doc-problem': 'Documents to fix',
  'form-error': 'Form fields to complete',
  'form-warning': 'Form entries to double-check',
};
const ORDER = ['missing-doc', 'doc-problem', 'form-error', 'form-warning'];

/**
 * items: [{ kind: 'missing-doc' | 'doc-problem' | 'form-error' | 'form-warning', text }]
 * level "high": something is missing or broken; "medium": only things to double-check; "low": nothing obvious found.
 */
export function buildReadiness(items = []) {
  const clean = items.filter((i) => i && KINDS[i.kind] && typeof i.text === 'string' && i.text.trim());
  const seen = new Set();
  const unique = clean.filter((i) => { const k = `${i.kind}|${i.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const groups = ORDER.map((kind) => ({ kind, title: KINDS[kind], items: unique.filter((i) => i.kind === kind).map((i) => i.text) })).filter((g) => g.items.length);
  const blocking = unique.filter((i) => i.kind !== 'form-warning').length;
  const level = blocking ? 'high' : unique.length ? 'medium' : 'low';
  const total = unique.length;
  return {
    level,
    total,
    blocking,
    groups,
    headline: level === 'high' ? `Fix ${blocking} thing${blocking > 1 ? 's' : ''} before you apply` : level === 'medium' ? `${total} thing${total > 1 ? 's' : ''} to double-check` : 'Nothing obvious is missing',
    note: 'This is a checklist, not a decision. Only the provider decides whether an application is accepted.',
  };
}
