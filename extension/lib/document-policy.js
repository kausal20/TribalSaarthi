/** One gate used by every placement entry point, including old chat offers. */
export function placementProblem(doc) {
  if (doc.checks?.some(c => c.level === 'error')) return 'Fix the file errors before attaching this document.';
  if (doc.scanRequested && !doc.scan) return 'The requested AI review did not complete. Select the file again to retry or explicitly choose a local-only check.';
  if (doc.scan && (doc.scan.readable !== true || ['not_a_document', 'other_document'].includes(doc.scan.kind))) return 'The AI could not identify a readable document. Choose a clearer, recognised document before attaching it.';
  if (doc.scan?.issues?.length) return 'Resolve the document issues before attaching this file.';
  if (doc.scan?.review?.some(r => r.status === 'fail')) return 'This document did not meet a displayed portal requirement. Review the findings before replacing it.';
  return '';
}
